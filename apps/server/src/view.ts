import { commitmentLine, type Agreement, type AgreementView, type Commitment, type Contact } from '@dextra/core'

function lensCommitments(list: Commitment[], counterpartyName: string): AgreementView['commitments'] {
  return list.map(c => ({ id: c.id, by: c.by, what: c.what, dueISO: c.dueISO, amount: c.amount, done: c.done, line: commitmentLine(c, counterpartyName) }))
}

/** Agreement → the lens-safe view in the shared contract (no transcript, no quotes beyond what is shown). */
export function toView(a: Agreement, extra: { warnings?: string[]; contact?: Contact } = {}): AgreementView {
  const lastAmend = [...a.history].reverse().find(h => h.event === 'amend')
  return {
    id: a.id,
    status: a.status,
    counterpartyName: a.counterpartyName,
    commitments: lensCommitments(a.commitments, a.counterpartyName),
    proposed: a.proposedCommitments ? lensCommitments(a.proposedCommitments, a.counterpartyName) : undefined,
    amendNote: a.status === 'amended' ? lastAmend?.note : undefined,
    warnings: extra.warnings ?? [],
    contact: extra.contact,
    hash: a.hash,
  }
}
