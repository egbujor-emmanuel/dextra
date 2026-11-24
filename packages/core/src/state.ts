import type { Agreement, AgreementStatus, Commitment } from './types'

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION' as const
  constructor(from: AgreementStatus, event: string, reason?: string) {
    super(`Cannot ${event} an agreement that is ${from}${reason ? `: ${reason}` : ''}`)
    this.name = 'InvalidTransitionError'
  }
}

export type AgreementEvent =
  | { type: 'send'; at: string; counterpartyTgId: number }
  | { type: 'confirm'; at: string; by: number }
  | { type: 'amend'; at: string; by: number; commitments: Commitment[]; note?: string }
  | { type: 'accept'; at: string }
  | { type: 'reject'; at: string }
  | { type: 'tick'; at: string; commitmentId: string; done: boolean }
  | { type: 'discard'; at: string }
  | { type: 'expire'; at: string }

export interface DraftInput {
  id: string
  createdAt: string
  wearerTgId: number
  counterpartyName: string
  commitments: Commitment[]
}

export function createDraft(input: DraftInput): Agreement {
  return {
    ...input,
    commitments: input.commitments.map(c => ({ ...c })),
    status: 'draft',
    history: [{ event: 'created', at: input.createdAt }],
  }
}

/** Legal source statuses per event. Anything else is an InvalidTransitionError. */
const ALLOWED: Record<AgreementEvent['type'], readonly AgreementStatus[]> = {
  send: ['draft'],
  confirm: ['sent'],
  amend: ['sent'],
  accept: ['amended'],
  reject: ['amended'],
  tick: ['confirmed', 'fulfilled'], // un-ticking a fulfilled record reopens it
  discard: ['draft'],
  expire: ['sent', 'amended'],
}

function record(a: Agreement, event: AgreementEvent, patch: Partial<Agreement>, extra: { by?: number; note?: string } = {}): Agreement {
  return { ...a, ...patch, history: [...a.history, { event: event.type, at: event.at, ...extra }] }
}

function withoutProposal(a: Agreement): Agreement {
  const { proposedCommitments: _dropped, ...rest } = a
  return rest
}

/** Pure transition: returns a new Agreement, never mutates the input. */
export function transition(a: Agreement, event: AgreementEvent): Agreement {
  if (!ALLOWED[event.type].includes(a.status)) throw new InvalidTransitionError(a.status, event.type)

  switch (event.type) {
    case 'send':
      return record(a, event, { status: 'sent', counterpartyTgId: event.counterpartyTgId })
    case 'confirm':
      if (event.by !== a.counterpartyTgId) throw new InvalidTransitionError(a.status, 'confirm', 'only the counterparty can confirm')
      return record(a, event, { status: 'confirmed' }, { by: event.by })
    case 'amend':
      if (event.by !== a.counterpartyTgId) throw new InvalidTransitionError(a.status, 'amend', 'only the counterparty can amend')
      return record(a, event, { status: 'amended', proposedCommitments: event.commitments.map(c => ({ ...c })) }, { by: event.by, note: event.note })
    case 'accept':
      return record(withoutProposal(a), event, { status: 'confirmed', commitments: (a.proposedCommitments ?? a.commitments).map(c => ({ ...c })) })
    case 'reject':
      return record(withoutProposal(a), event, { status: 'sent' })
    case 'tick': {
      if (!a.commitments.some(c => c.id === event.commitmentId)) throw new InvalidTransitionError(a.status, 'tick', `unknown commitment ${event.commitmentId}`)
      const commitments = a.commitments.map(c => (c.id === event.commitmentId ? { ...c, done: event.done } : c))
      const status: AgreementStatus = commitments.every(c => c.done) ? 'fulfilled' : 'confirmed'
      return record(a, event, { commitments, status })
    }
    case 'discard':
      return record(a, event, { status: 'discarded' })
    case 'expire':
      return record(withoutProposal(a), event, { status: 'expired' })
  }
}
