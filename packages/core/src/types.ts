/** Who owes the action, from the wearer's point of view. */
export type Party = 'wearer' | 'counterparty'

export type AgreementStatus = 'draft' | 'sent' | 'amended' | 'confirmed' | 'fulfilled' | 'discarded' | 'expired'

/** Typed refusal codes, so every refusal can be shown as a receipt. See PRD §6. */
export type RefusalCode =
  | 'NO_COMMITMENT'
  | 'UNSUPPORTED_BY_TRANSCRIPT'
  | 'MALFORMED_PROPOSAL'
  | 'SINGLE_SPEAKER'
  | 'NOT_PAIRED'
  | 'NO_BUSINESS_CONNECTION'
  | 'CANNOT_REPLY'
  | 'INVALID_TRANSITION'

export interface Commitment {
  id: string
  by: Party
  what: string
  dueISO?: string
  dueText?: string
  amount?: string
  /** Verbatim words from the transcript that back this commitment. */
  quote: string
  done: boolean
}

export interface HistoryEntry {
  event: string
  at: string
  by?: number
  note?: string
}

export interface Agreement {
  id: string
  createdAt: string
  wearerTgId: number
  counterpartyTgId?: number
  counterpartyName: string
  commitments: Commitment[]
  /** Counterparty's amended version, awaiting the wearer's accept/reject. */
  proposedCommitments?: Commitment[]
  status: AgreementStatus
  history: HistoryEntry[]
  hash?: string
  stampTx?: string
  /** How the confirmed record reached the shared chat: a Telegram checklist (needs Premium), a plain message, or not at all. */
  sharedAs?: 'checklist' | 'message' | 'none'
}

/** One diarized stretch of speech. `rms` is mean loudness (0..1) when we computed it. */
export interface Utterance {
  speaker: number
  start: number
  end: number
  text: string
  rms?: number
}

/** A time span the G2 host tagged with an AudioSpeakerRole (hardware only; simulator gives 'unknown'). */
export interface RoleHint {
  start: number
  end: number
  role: 'self' | 'other' | 'unknown'
}
