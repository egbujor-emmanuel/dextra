import { fitLine, type AgreementView, type Contact, type DeviceState } from '@dextra/core'

/** Every screen the lens can show (PRD §7). */
export type Screen =
  | { kind: 'boot' }
  | { kind: 'pairing'; code: string; botUsername: string }
  | { kind: 'idle'; state: DeviceState; listening: boolean; seconds: number }
  | { kind: 'locking' }
  | { kind: 'review'; agreement: AgreementView; contact?: Contact }
  | { kind: 'sent'; agreement: AgreementView }
  | { kind: 'amended'; agreement: AgreementView }
  | { kind: 'confirmed'; agreement: AgreementView }
  | { kind: 'refusal'; code: string; message: string; back?: Screen }
  | { kind: 'records'; items: AgreementView[] }

export interface TextFrame {
  header: string
  body: string
  footer: string
}

const LINE = 46
const STATUS_MARK: Record<AgreementView['status'], string> = {
  draft: '·',
  sent: '◌',
  amended: '?',
  confirmed: '✓',
  fulfilled: '✓✓',
  discarded: '×',
  expired: '×',
}

function lines(...ls: (string | false | undefined)[]): string {
  return ls.filter((l): l is string => typeof l === 'string').map(l => fitLine(l, LINE)).join('\n')
}

/** Individual lines (each is fitted separately by `lines`, never the joined block). */
function commitmentLines(a: AgreementView, useProposed = false): (string | false)[] {
  const list = useProposed && a.proposed ? a.proposed : a.commitments
  return [...list.slice(0, 3).map(c => c.line), list.length > 3 && `+${list.length - 3} more`]
}

/** Pure: screen → three text rows. Kept free of SDK types so it is unit-testable. */
export function frameFor(s: Screen): TextFrame {
  switch (s.kind) {
    case 'boot':
      return { header: 'DEXTRA', body: 'Starting…', footer: '' }
    case 'pairing':
      return {
        header: 'DEXTRA · link Telegram',
        body: lines(`Send this to @${s.botUsername}:`, ``, `/pair ${s.code}`),
        footer: 'Code expires in 10 min',
      }
    case 'idle': {
      const status = s.listening ? `● listening · last ${Math.min(45, s.seconds)}s` : 'listening paused'
      const counts = `${s.state.open} open · ${s.state.dueSoon} due soon`
      return {
        header: 'DEXTRA',
        body: lines(status, '', 'Agreed something? Hold to lock it.'),
        footer: lines(s.state.businessConnected ? counts : 'Connect Dextra in Telegram ▸ Chat Automation'),
      }
    }
    case 'locking':
      return { header: 'DEXTRA', body: 'Locking what was said…', footer: '' }
    case 'review': {
      const to = s.contact?.name ?? s.agreement.counterpartyName
      return {
        header: lines(`Agreed with ${s.agreement.counterpartyName}?`),
        body: lines(...commitmentLines(s.agreement), ...s.agreement.warnings.slice(0, 1)),
        footer: lines(`tap ▸ send to ${to} · swipe swap · 2× drop`),
      }
    }
    case 'sent':
      return {
        header: `Sent to ${s.agreement.counterpartyName}`,
        body: lines(...commitmentLines(s.agreement), '', '◌ waiting for them to confirm'),
        footer: '2× back',
      }
    case 'amended':
      return {
        header: lines(`${s.agreement.counterpartyName} changed it`),
        body: lines(...commitmentLines(s.agreement, true), s.agreement.amendNote && `“${s.agreement.amendNote}”`),
        footer: 'tap ▸ accept · 2× reject',
      }
    case 'confirmed':
      return {
        header: `${s.agreement.counterpartyName} confirmed ✓`,
        body: lines(...commitmentLines(s.agreement), '', 'Dictum, factum.'),
        footer: 'Checklist shared in Telegram',
      }
    case 'refusal':
      return { header: 'Not locked', body: lines(s.message), footer: lines(`${s.code} · tap ▸ back`) }
    case 'records':
      return {
        header: `Records · ${s.items.length}`,
        body: s.items.length === 0 ? 'Nothing yet.' : lines(...s.items.slice(0, 5).map(recordLabel)),
        footer: '2× back',
      }
  }
}

export function recordLabel(a: AgreementView): string {
  const first = a.commitments[0]?.what ?? '—'
  return fitLine(`${STATUS_MARK[a.status]} ${a.counterpartyName}: ${first}`, 60)
}
