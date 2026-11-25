import './zod-jitless'
import { validateProposal } from '@dextra/core/validate'
import { useMemo, useState } from 'react'

/** The transcript from apps/server/test/service.test.ts. Speaker 0 is you (the wearer), 1 is them. */
const TRANSCRIPT = [
  { speaker: 0, start: 0, end: 3, text: 'So you send me the deck by Friday?' },
  { speaker: 1, start: 3, end: 6, text: 'Yes, the deck by Friday. And you intro me to Sara?' },
  { speaker: 0, start: 6, end: 8, text: "Deal, I'll intro you to Sara." },
]

type Draft = { speaker: 0 | 1; what: string; amount: string; quote: string }

const PRESETS: { label: string; why: string; draft: Draft }[] = [
  { label: 'What was really said', why: 'The quote is in their own words, so it reaches the lens.', draft: { speaker: 1, what: 'send the deck', amount: '', quote: 'the deck by Friday' } },
  { label: 'Invented money', why: 'Nobody said “I will pay five thousand”.', draft: { speaker: 1, what: 'pay $5,000', amount: '$5,000', quote: 'I will pay five thousand' } },
  { label: 'Right words, wrong person', why: '“the deck by Friday” was their line, not yours.', draft: { speaker: 0, what: 'send the deck', amount: '', quote: 'the deck by Friday' } },
  { label: 'A filler quote', why: '“Yes” would match almost anything, so it backs nothing.', draft: { speaker: 1, what: 'pay the rent', amount: '', quote: 'Yes' } },
  { label: 'A link slipped in', why: 'A commitment never carries a link or a handle.', draft: { speaker: 1, what: 'send the deck via t.me/claimprize', amount: '', quote: 'the deck by Friday' } },
]

/**
 * DEXTRA's real gate (packages/core/src/validate.ts) running in this page on the real test transcript. The AI only
 * proposes; this code decides.
 */
export default function Gate() {
  const [draft, setDraft] = useState<Draft>(PRESETS[1]!.draft)
  const [active, setActive] = useState(1)

  const verdict = useMemo(() => {
    const proposal = { commitments: [{ speaker: draft.speaker, what: draft.what, quote: draft.quote, ...(draft.amount ? { amount: draft.amount } : {}) }] }
    const r = validateProposal(proposal, TRANSCRIPT, 0)
    return r.commitments.length > 0 ? { kept: true, code: 'KEPT' } : { kept: false, code: r.dropped[0]?.code ?? r.refusal ?? 'REFUSED' }
  }, [draft])

  const update = (patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }))
    setActive(-1)
  }
  const owner = draft.speaker === 0 ? 'You' : 'They'

  return (
    <section id="gate" aria-labelledby="gate-heading" className="mx-auto max-w-7xl px-4 py-[var(--space-section)] sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <h2 id="gate-heading" className="font-display text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] leading-[1.1]">
            Try to slip a promise past it.
          </h2>
          <p className="mt-4 max-w-[46ch] text-ink-2">
            An AI listening to a conversation can invent an obligation. In DEXTRA the AI only proposes. The panel on the
            right runs the same check the server runs: the quote has to be in what that person actually said, any amount
            has to have been spoken, and nothing can carry a link. Then the other person still has to confirm.
          </p>
          <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Examples to try">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setDraft(p.draft)
                  setActive(i)
                }}
                aria-pressed={active === i}
                className={`min-h-11 rounded-full border px-4 text-[0.85rem] transition-colors ${active === i ? 'border-ink bg-ink text-stone' : 'border-ink/30 hover:border-ink'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[14px] border border-ink/25 bg-stone-2/60">
          <div className="border-b border-ink/15 px-5 py-4">
            <p className="text-[0.85rem] text-ink-3">The conversation, from DEXTRA’s test suite</p>
            <ul className="mt-3 grid gap-1.5">
              {TRANSCRIPT.map(t => (
                <li key={t.text} className="grid grid-cols-[3.5rem_1fr]">
                  <span className="text-ink-3">{t.speaker === 0 ? 'You' : 'Them'}</span>
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <p className="text-[0.85rem] text-ink-3 sm:col-span-2">What the AI proposed. Change any of it.</p>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[0.85rem]">Who owes it</legend>
              <div className="flex gap-2">
                {([0, 1] as const).map(s => (
                  <button key={s} type="button" onClick={() => update({ speaker: s })} aria-pressed={draft.speaker === s} className={`min-h-11 min-w-16 rounded-lg border px-4 text-sm ${draft.speaker === s ? 'border-ink bg-ink text-stone' : 'border-ink/30'}`}>
                    {s === 0 ? 'You' : 'Them'}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="What" value={draft.what} onChange={v => update({ what: v })} />
            <Field label="Amount, if any" value={draft.amount} onChange={v => update({ amount: v })} />
            <div className="sm:col-span-2">
              <Field label="The words the AI says back it" value={draft.quote} onChange={v => update({ quote: v })} />
            </div>
          </div>

          <div role="status" aria-live="polite" className={`border-t px-5 py-5 ${verdict.kept ? 'border-ink/20 bg-ink/[0.06]' : 'border-dado bg-dado rounded-b-[13px]'}`}>
            <p className={`text-[1.05rem] ${verdict.kept ? '' : 'line-through decoration-ink/70 decoration-2'}`}>
              {owner} will {draft.what || '…'}
              {draft.amount && ` (${draft.amount})`}
            </p>
            <p className="mt-1 text-sm">
              {verdict.kept ? 'Reaches the lens for you to send.' : 'Dropped before it reaches the lens.'}{' '}
              <code className="font-mono text-[0.8rem] text-ink-3">{verdict.code}</code>
            </p>
            {active >= 0 && <p className="mt-1 text-sm text-ink-2">{PRESETS[active]!.why}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.85rem]">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={120}
        className="min-h-11 rounded-lg border border-ink/30 bg-stone px-3 py-2 outline-none transition-colors focus:border-ink"
      />
    </label>
  )
}
