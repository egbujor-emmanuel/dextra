import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Agreement, Utterance } from '@dextra/core'
import type { Proposal } from '@dextra/core'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, wearer_tg_id INTEGER, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pair_codes (code TEXT PRIMARY KEY, device_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wearers (tg_id INTEGER PRIMARY KEY, name TEXT NOT NULL, business_connection_id TEXT, connected INTEGER NOT NULL DEFAULT 0, can_reply INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contacts (wearer_tg_id INTEGER NOT NULL, tg_id INTEGER NOT NULL, chat_id INTEGER NOT NULL, name TEXT NOT NULL, last_incoming_at TEXT NOT NULL, PRIMARY KEY (wearer_tg_id, tg_id));
CREATE TABLE IF NOT EXISTS agreements (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, wearer_tg_id INTEGER NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drafts (agreement_id TEXT PRIMARY KEY, utterances_json TEXT NOT NULL, proposal_json TEXT NOT NULL, wearer_speaker INTEGER NOT NULL, contact_index INTEGER NOT NULL DEFAULT 0, captured_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS amend_sessions (tg_id INTEGER PRIMARY KEY, agreement_id TEXT NOT NULL, started_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checklists (agreement_id TEXT PRIMARY KEY, business_connection_id TEXT NOT NULL, chat_id INTEGER NOT NULL, message_id INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS agreements_device ON agreements(device_id, updated_at);
`

export interface DeviceRow { id: string; wearer_tg_id: number | null }
export interface WearerRow { tg_id: number; name: string; business_connection_id: string | null; connected: number; can_reply: number }
export interface ContactRow { tg_id: number; chat_id: number; name: string; last_incoming_at: string }
/** The draft remembers the chosen recipient by Telegram id, never by list position (contact order changes as people message). */
export interface DraftRow { utterances: Utterance[]; proposal: Proposal; wearerSpeaker: number; contactTgId: number | null; capturedAt: string }
export interface ChecklistRow { agreement_id: string; business_connection_id: string; chat_id: number; message_id: number }

/** Thin repository over node:sqlite (no native build step). All SQL is parameterised. */
export class Db {
  private readonly db: DatabaseSync

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(SCHEMA)
    this.migrate()
  }

  /** Additive migrations for databases created by earlier builds. */
  private migrate(): void {
    const cols = (this.db.prepare('PRAGMA table_info(drafts)').all() as { name: string }[]).map(c => c.name)
    if (!cols.includes('contact_tg_id')) this.db.exec('ALTER TABLE drafts ADD COLUMN contact_tg_id INTEGER')
  }

  insertDevice(id: string, tokenHash: string, at: string): void {
    this.db.prepare('INSERT INTO devices (id, token_hash, created_at) VALUES (?, ?, ?)').run(id, tokenHash, at)
  }

  deviceByTokenHash(tokenHash: string): DeviceRow | undefined {
    return this.db.prepare('SELECT id, wearer_tg_id FROM devices WHERE token_hash = ?').get(tokenHash) as DeviceRow | undefined
  }

  device(id: string): DeviceRow | undefined {
    return this.db.prepare('SELECT id, wearer_tg_id FROM devices WHERE id = ?').get(id) as DeviceRow | undefined
  }

  bindDevice(deviceId: string, wearerTgId: number): void {
    this.db.prepare('UPDATE devices SET wearer_tg_id = ? WHERE id = ?').run(wearerTgId, deviceId)
  }

  devicesForWearer(tgId: number): string[] {
    return (this.db.prepare('SELECT id FROM devices WHERE wearer_tg_id = ?').all(tgId) as { id: string }[]).map(r => r.id)
  }

  savePairCode(code: string, deviceId: string, expiresAt: string): void {
    this.db.prepare('DELETE FROM pair_codes WHERE device_id = ?').run(deviceId)
    this.db.prepare('INSERT INTO pair_codes (code, device_id, expires_at) VALUES (?, ?, ?)').run(code, deviceId, expiresAt)
  }

  takePairCode(code: string, now: string): string | undefined {
    const row = this.db.prepare('SELECT device_id, expires_at FROM pair_codes WHERE code = ?').get(code) as { device_id: string; expires_at: string } | undefined
    this.db.prepare('DELETE FROM pair_codes WHERE code = ?').run(code)
    return row && row.expires_at > now ? row.device_id : undefined
  }

  upsertWearer(tgId: number, name: string, at: string): void {
    this.db
      .prepare('INSERT INTO wearers (tg_id, name, updated_at) VALUES (?, ?, ?) ON CONFLICT(tg_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at')
      .run(tgId, name, at)
  }

  setBusinessConnection(tgId: number, connectionId: string, connected: boolean, canReply: boolean, at: string): void {
    this.db
      .prepare('UPDATE wearers SET business_connection_id = ?, connected = ?, can_reply = ?, updated_at = ? WHERE tg_id = ?')
      .run(connectionId, connected ? 1 : 0, canReply ? 1 : 0, at, tgId)
  }

  wearer(tgId: number): WearerRow | undefined {
    return this.db.prepare('SELECT * FROM wearers WHERE tg_id = ?').get(tgId) as WearerRow | undefined
  }

  wearerByConnection(connectionId: string): WearerRow | undefined {
    return this.db.prepare('SELECT * FROM wearers WHERE business_connection_id = ?').get(connectionId) as WearerRow | undefined
  }

  upsertContact(wearerTgId: number, c: ContactRow): void {
    this.db
      .prepare(
        `INSERT INTO contacts (wearer_tg_id, tg_id, chat_id, name, last_incoming_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(wearer_tg_id, tg_id) DO UPDATE SET chat_id = excluded.chat_id, name = excluded.name, last_incoming_at = excluded.last_incoming_at`,
      )
      .run(wearerTgId, c.tg_id, c.chat_id, c.name, c.last_incoming_at)
  }

  /** Most recent first, limited to people who wrote within the window (Telegram's 24 h business reply rule). */
  contacts(wearerTgId: number, sinceISO: string, limit = 20): ContactRow[] {
    return this.db
      .prepare('SELECT tg_id, chat_id, name, last_incoming_at FROM contacts WHERE wearer_tg_id = ? AND last_incoming_at > ? ORDER BY last_incoming_at DESC LIMIT ?')
      .all(wearerTgId, sinceISO, limit) as unknown as ContactRow[]
  }

  contact(wearerTgId: number, tgId: number): ContactRow | undefined {
    return this.db.prepare('SELECT tg_id, chat_id, name, last_incoming_at FROM contacts WHERE wearer_tg_id = ? AND tg_id = ?').get(wearerTgId, tgId) as ContactRow | undefined
  }

  saveAgreement(a: Agreement, deviceId: string, at: string): void {
    this.db
      .prepare(
        `INSERT INTO agreements (id, device_id, wearer_tg_id, status, json, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, json = excluded.json, updated_at = excluded.updated_at`,
      )
      .run(a.id, deviceId, a.wearerTgId, a.status, JSON.stringify(a), at)
  }

  agreement(id: string): { agreement: Agreement; deviceId: string } | undefined {
    const row = this.db.prepare('SELECT json, device_id FROM agreements WHERE id = ?').get(id) as { json: string; device_id: string } | undefined
    return row ? { agreement: JSON.parse(row.json) as Agreement, deviceId: row.device_id } : undefined
  }

  agreementsForDevice(deviceId: string, limit = 20): Agreement[] {
    return (this.db
      .prepare("SELECT json FROM agreements WHERE device_id = ? AND status NOT IN ('discarded') ORDER BY updated_at DESC LIMIT ?")
      .all(deviceId, limit) as { json: string }[]).map(r => JSON.parse(r.json) as Agreement)
  }

  insertDraft(agreementId: string, d: DraftRow, expiresAt: string): void {
    this.db
      .prepare('INSERT INTO drafts (agreement_id, utterances_json, proposal_json, wearer_speaker, contact_tg_id, captured_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(agreementId, JSON.stringify(d.utterances), JSON.stringify(d.proposal), d.wearerSpeaker, d.contactTgId, d.capturedAt, expiresAt)
  }

  /** UPDATE only: never resurrects a purged or deleted draft. Returns false when the draft is gone. */
  updateDraftChoice(agreementId: string, wearerSpeaker: number, contactTgId: number | null): boolean {
    const r = this.db.prepare('UPDATE drafts SET wearer_speaker = ?, contact_tg_id = ? WHERE agreement_id = ?').run(wearerSpeaker, contactTgId, agreementId)
    return Number(r.changes) === 1
  }

  draft(agreementId: string): DraftRow | undefined {
    const row = this.db.prepare('SELECT * FROM drafts WHERE agreement_id = ?').get(agreementId) as
      | { utterances_json: string; proposal_json: string; wearer_speaker: number; contact_tg_id: number | null; captured_at: string }
      | undefined
    if (!row) return undefined
    return {
      utterances: JSON.parse(row.utterances_json) as Utterance[],
      proposal: JSON.parse(row.proposal_json) as Proposal,
      wearerSpeaker: row.wearer_speaker,
      contactTgId: row.contact_tg_id,
      capturedAt: row.captured_at,
    }
  }

  /** Transcripts of unconfirmed drafts are deleted after 24 h; confirmed ones only keep commitments (PRD §6). */
  deleteDraft(agreementId: string): void {
    this.db.prepare('DELETE FROM drafts WHERE agreement_id = ?').run(agreementId)
  }

  purgeExpiredDrafts(now: string): number {
    return Number(this.db.prepare('DELETE FROM drafts WHERE expires_at <= ?').run(now).changes)
  }

  startAmend(tgId: number, agreementId: string, at: string): void {
    this.db.prepare('INSERT OR REPLACE INTO amend_sessions (tg_id, agreement_id, started_at) VALUES (?, ?, ?)').run(tgId, agreementId, at)
  }

  /** Open amend session started after `sinceISO` (sessions expire); not consumed until the amendment succeeds. */
  peekAmend(tgId: number, sinceISO: string): string | undefined {
    const row = this.db.prepare('SELECT agreement_id FROM amend_sessions WHERE tg_id = ? AND started_at > ?').get(tgId, sinceISO) as { agreement_id: string } | undefined
    return row?.agreement_id
  }

  endAmend(tgId: number): void {
    this.db.prepare('DELETE FROM amend_sessions WHERE tg_id = ?').run(tgId)
  }

  saveChecklist(r: ChecklistRow): void {
    this.db.prepare('INSERT OR REPLACE INTO checklists (agreement_id, business_connection_id, chat_id, message_id) VALUES (?, ?, ?, ?)').run(r.agreement_id, r.business_connection_id, r.chat_id, r.message_id)
  }

  /** Scoped to the business connection: two wearers can share a counterparty chat id. */
  checklistByMessage(connectionId: string, chatId: number, messageId: number): ChecklistRow | undefined {
    return this.db
      .prepare('SELECT * FROM checklists WHERE business_connection_id = ? AND chat_id = ? AND message_id = ?')
      .get(connectionId, chatId, messageId) as ChecklistRow | undefined
  }

  countDevicesForWearer(tgId: number): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM devices WHERE wearer_tg_id = ?').get(tgId) as { n: number }).n)
  }

  /** Agreements awaiting the counterparty for longer than the TTL (PRD §5: expire after 7 days). */
  staleAwaiting(beforeISO: string): { agreement: Agreement; deviceId: string }[] {
    return (this.db
      .prepare("SELECT json, device_id FROM agreements WHERE status IN ('sent', 'amended') AND updated_at <= ?")
      .all(beforeISO) as { json: string; device_id: string }[]).map(r => ({ agreement: JSON.parse(r.json) as Agreement, deviceId: r.device_id }))
  }

  /** Contacts outside Telegram's 24 h window can't be messaged anyway; don't keep their names. */
  pruneContacts(beforeISO: string): number {
    return Number(this.db.prepare('DELETE FROM contacts WHERE last_incoming_at <= ?').run(beforeISO).changes)
  }
}
