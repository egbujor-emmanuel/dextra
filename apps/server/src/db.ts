import { createClient, type Client, type InArgs, type ResultSet } from '@libsql/client'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Agreement, Proposal, Utterance } from '@dextra/core'

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

/** libSQL rows are array-like objects; hand the rest of the server plain records keyed by column name. */
function plain<T>(rs: ResultSet): T[] {
  return rs.rows.map(row => Object.fromEntries(rs.columns.map((col, i) => [col, row[i]])) as T)
}

/**
 * Thin async repository over libSQL. `DATABASE_URL` is a local SQLite file (`file:…`) in development and tests, and a
 * Turso database (`libsql://…`) in production, so data survives restarts on hosts with an ephemeral disk.
 * All SQL is parameterised.
 */
export class Db {
  private constructor(private readonly c: Client) {}

  static async open(url: string, authToken?: string): Promise<Db> {
    if (url.startsWith('file:')) mkdirSync(dirname(url.slice('file:'.length)), { recursive: true })
    const db = new Db(createClient({ url, authToken }))
    await db.c.executeMultiple(SCHEMA)
    await db.migrate()
    return db
  }

  /** In-memory database for tests. */
  static memory(): Promise<Db> {
    return Db.open(':memory:')
  }

  close(): void {
    this.c.close()
  }

  private async all<T>(sql: string, args: InArgs = []): Promise<T[]> {
    return plain<T>(await this.c.execute({ sql, args }))
  }

  private async get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
    return (await this.all<T>(sql, args))[0]
  }

  /** Returns the number of rows changed. */
  private async run(sql: string, args: InArgs = []): Promise<number> {
    return (await this.c.execute({ sql, args })).rowsAffected
  }

  /** Additive migrations for databases created by earlier builds. */
  private async migrate(): Promise<void> {
    const cols = (await this.all<{ name: string }>('PRAGMA table_info(drafts)')).map(c => c.name)
    if (!cols.includes('contact_tg_id')) await this.run('ALTER TABLE drafts ADD COLUMN contact_tg_id INTEGER')
  }

  async insertDevice(id: string, tokenHash: string, at: string): Promise<void> {
    await this.run('INSERT INTO devices (id, token_hash, created_at) VALUES (?, ?, ?)', [id, tokenHash, at])
  }

  deviceByTokenHash(tokenHash: string): Promise<DeviceRow | undefined> {
    return this.get<DeviceRow>('SELECT id, wearer_tg_id FROM devices WHERE token_hash = ?', [tokenHash])
  }

  device(id: string): Promise<DeviceRow | undefined> {
    return this.get<DeviceRow>('SELECT id, wearer_tg_id FROM devices WHERE id = ?', [id])
  }

  async bindDevice(deviceId: string, wearerTgId: number): Promise<void> {
    await this.run('UPDATE devices SET wearer_tg_id = ? WHERE id = ?', [wearerTgId, deviceId])
  }

  async devicesForWearer(tgId: number): Promise<string[]> {
    return (await this.all<{ id: string }>('SELECT id FROM devices WHERE wearer_tg_id = ?', [tgId])).map(r => r.id)
  }

  /** One live code per device: the old code is removed in the same write batch. */
  async savePairCode(code: string, deviceId: string, expiresAt: string): Promise<void> {
    await this.c.batch(
      [
        { sql: 'DELETE FROM pair_codes WHERE device_id = ?', args: [deviceId] },
        { sql: 'INSERT INTO pair_codes (code, device_id, expires_at) VALUES (?, ?, ?)', args: [code, deviceId, expiresAt] },
      ],
      'write',
    )
  }

  /** Single-use: the code is deleted and read in one statement, so two redemptions can't both succeed. */
  async takePairCode(code: string, now: string): Promise<string | undefined> {
    const row = await this.get<{ device_id: string; expires_at: string }>('DELETE FROM pair_codes WHERE code = ? RETURNING device_id, expires_at', [code])
    return row && row.expires_at > now ? row.device_id : undefined
  }

  async upsertWearer(tgId: number, name: string, at: string): Promise<void> {
    await this.run('INSERT INTO wearers (tg_id, name, updated_at) VALUES (?, ?, ?) ON CONFLICT(tg_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at', [tgId, name, at])
  }

  async setBusinessConnection(tgId: number, connectionId: string, connected: boolean, canReply: boolean, at: string): Promise<void> {
    await this.run('UPDATE wearers SET business_connection_id = ?, connected = ?, can_reply = ?, updated_at = ? WHERE tg_id = ?', [connectionId, connected ? 1 : 0, canReply ? 1 : 0, at, tgId])
  }

  wearer(tgId: number): Promise<WearerRow | undefined> {
    return this.get<WearerRow>('SELECT tg_id, name, business_connection_id, connected, can_reply FROM wearers WHERE tg_id = ?', [tgId])
  }

  wearerByConnection(connectionId: string): Promise<WearerRow | undefined> {
    return this.get<WearerRow>('SELECT tg_id, name, business_connection_id, connected, can_reply FROM wearers WHERE business_connection_id = ?', [connectionId])
  }

  async upsertContact(wearerTgId: number, c: ContactRow): Promise<void> {
    await this.run(
      `INSERT INTO contacts (wearer_tg_id, tg_id, chat_id, name, last_incoming_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(wearer_tg_id, tg_id) DO UPDATE SET chat_id = excluded.chat_id, name = excluded.name, last_incoming_at = excluded.last_incoming_at`,
      [wearerTgId, c.tg_id, c.chat_id, c.name, c.last_incoming_at],
    )
  }

  /** Most recent first, limited to people who wrote within the window (Telegram's 24 h business reply rule). */
  contacts(wearerTgId: number, sinceISO: string, limit = 20): Promise<ContactRow[]> {
    return this.all<ContactRow>('SELECT tg_id, chat_id, name, last_incoming_at FROM contacts WHERE wearer_tg_id = ? AND last_incoming_at > ? ORDER BY last_incoming_at DESC LIMIT ?', [wearerTgId, sinceISO, limit])
  }

  contact(wearerTgId: number, tgId: number): Promise<ContactRow | undefined> {
    return this.get<ContactRow>('SELECT tg_id, chat_id, name, last_incoming_at FROM contacts WHERE wearer_tg_id = ? AND tg_id = ?', [wearerTgId, tgId])
  }

  async saveAgreement(a: Agreement, deviceId: string, at: string): Promise<void> {
    await this.run(
      `INSERT INTO agreements (id, device_id, wearer_tg_id, status, json, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, json = excluded.json, updated_at = excluded.updated_at`,
      [a.id, deviceId, a.wearerTgId, a.status, JSON.stringify(a), at],
    )
  }

  async agreement(id: string): Promise<{ agreement: Agreement; deviceId: string } | undefined> {
    const row = await this.get<{ json: string; device_id: string }>('SELECT json, device_id FROM agreements WHERE id = ?', [id])
    return row ? { agreement: JSON.parse(row.json) as Agreement, deviceId: row.device_id } : undefined
  }

  async agreementsForDevice(deviceId: string, limit = 20): Promise<Agreement[]> {
    const rows = await this.all<{ json: string }>("SELECT json FROM agreements WHERE device_id = ? AND status NOT IN ('discarded') ORDER BY updated_at DESC LIMIT ?", [deviceId, limit])
    return rows.map(r => JSON.parse(r.json) as Agreement)
  }

  async insertDraft(agreementId: string, d: DraftRow, expiresAt: string): Promise<void> {
    await this.run(
      'INSERT INTO drafts (agreement_id, utterances_json, proposal_json, wearer_speaker, contact_tg_id, captured_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [agreementId, JSON.stringify(d.utterances), JSON.stringify(d.proposal), d.wearerSpeaker, d.contactTgId, d.capturedAt, expiresAt],
    )
  }

  /** UPDATE only: never resurrects a purged or deleted draft. Returns false when the draft is gone. */
  async updateDraftChoice(agreementId: string, wearerSpeaker: number, contactTgId: number | null): Promise<boolean> {
    return (await this.run('UPDATE drafts SET wearer_speaker = ?, contact_tg_id = ? WHERE agreement_id = ?', [wearerSpeaker, contactTgId, agreementId])) === 1
  }

  async draft(agreementId: string): Promise<DraftRow | undefined> {
    const row = await this.get<{ utterances_json: string; proposal_json: string; wearer_speaker: number; contact_tg_id: number | null; captured_at: string }>(
      'SELECT utterances_json, proposal_json, wearer_speaker, contact_tg_id, captured_at FROM drafts WHERE agreement_id = ?',
      [agreementId],
    )
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
  async deleteDraft(agreementId: string): Promise<void> {
    await this.run('DELETE FROM drafts WHERE agreement_id = ?', [agreementId])
  }

  purgeExpiredDrafts(now: string): Promise<number> {
    return this.run('DELETE FROM drafts WHERE expires_at <= ?', [now])
  }

  async startAmend(tgId: number, agreementId: string, at: string): Promise<void> {
    await this.run('INSERT OR REPLACE INTO amend_sessions (tg_id, agreement_id, started_at) VALUES (?, ?, ?)', [tgId, agreementId, at])
  }

  /** Open amend session started after `sinceISO` (sessions expire); not consumed until the amendment succeeds. */
  async peekAmend(tgId: number, sinceISO: string): Promise<string | undefined> {
    return (await this.get<{ agreement_id: string }>('SELECT agreement_id FROM amend_sessions WHERE tg_id = ? AND started_at > ?', [tgId, sinceISO]))?.agreement_id
  }

  async endAmend(tgId: number): Promise<void> {
    await this.run('DELETE FROM amend_sessions WHERE tg_id = ?', [tgId])
  }

  async saveChecklist(r: ChecklistRow): Promise<void> {
    await this.run('INSERT OR REPLACE INTO checklists (agreement_id, business_connection_id, chat_id, message_id) VALUES (?, ?, ?, ?)', [r.agreement_id, r.business_connection_id, r.chat_id, r.message_id])
  }

  /** Scoped to the business connection: two wearers can share a counterparty chat id. */
  checklistByMessage(connectionId: string, chatId: number, messageId: number): Promise<ChecklistRow | undefined> {
    return this.get<ChecklistRow>('SELECT agreement_id, business_connection_id, chat_id, message_id FROM checklists WHERE business_connection_id = ? AND chat_id = ? AND message_id = ?', [connectionId, chatId, messageId])
  }

  async countDevicesForWearer(tgId: number): Promise<number> {
    return Number((await this.get<{ n: number }>('SELECT COUNT(*) AS n FROM devices WHERE wearer_tg_id = ?', [tgId]))?.n ?? 0)
  }

  /** Agreements awaiting the counterparty for longer than the TTL (PRD §5: expire after 7 days). */
  async staleAwaiting(beforeISO: string): Promise<{ agreement: Agreement; deviceId: string }[]> {
    const rows = await this.all<{ json: string; device_id: string }>("SELECT json, device_id FROM agreements WHERE status IN ('sent', 'amended') AND updated_at <= ?", [beforeISO])
    return rows.map(r => ({ agreement: JSON.parse(r.json) as Agreement, deviceId: r.device_id }))
  }

  /** Contacts outside Telegram's 24 h window can't be messaged anyway; don't keep their names. */
  pruneContacts(beforeISO: string): Promise<number> {
    return this.run('DELETE FROM contacts WHERE last_incoming_at <= ?', [beforeISO])
  }
}
