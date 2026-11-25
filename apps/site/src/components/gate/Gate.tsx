import './zod-jitless'
import { validateProposal } from '@dextra/core/validate'
import { useMemo, useRef, useState } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '../../lib/motion'

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
 * proposes; this code decides. The verdict lands as a stamp.
 */
export default function Gate() {
  const root = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Draft>(PRESETS[1]!.draft)
  const [active, setActive] = useState(1)

  const verdict = useMemo(() => {
    const proposal = { commitments: [{ speaker: draft.speaker, what: draft.what, quote: draft.quote, ...(draft.amount ? { amount: draft.amount } : {}) }] }
    const r = validateProposal(proposal, TRANSCRIPT, 0)
    return r.commitments.length > 0 ? { kept: true, code: 'KEPT' } : { kept: false, code: r.dropped[0]?.code ?? r.refusal ?? 'REFUSED' }
  }, [draft])

  // The stamp answers the visitor's action (motion that shows what changed).
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.fromTo('.stamp', { scale: 1.6, rotation: -24, opacity: 0 }, { scale: 1, rotation: -8, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
    },
    { scope: root, dependencies: [verdict.kept, verdict.code, draft.what] },
  )

  const update = (patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }))
    setActive(-1)
  }
  const owner = draft.speaker === 0 ? 'You' : 'They'

  return (
    <section id="gate" aria-labelledby="gate-heading" className="mx-auto max-w-7xl px-4 py-[var(--space-section)] sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 id="gate-heading" className="text-[clamp(1.9rem,1.3rem+1.8vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
            Try to slip a promise past it.
          </h2>
          <p className="mt-4 max-w-[46ch] text-ink-2">
            An AI listening to a conversation can invent an obligation. In DEXTRA the AI only proposes. This panel runs the
            same check the server runs: the quote has to be in what that person said, any amount has to have been spoken,
            and nothing can carry a link. Then the other person still has to confirm.
          </p>
          <div className="mt-7 flex flex-wrap gap-3" role="group" aria-label="Examples to try">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setDraft(p.draft)
                  setActive(i)
                }}
                aria-pressed={active === i}
                className={`min-h-11 border-[3px] border-black px-4 font-display text-[0.9rem] font-bold transition-[transform,box-shadow] duration-150 ${active === i ? 'translate-x-1 translate-y-1 bg-ink text-white shadow-none' : 'bg-paper shadow-[4px_4px_0_#000] hover:-translate-y-0.5'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={root} className="brut-shadow relative bg-paper">
          <div className="border-b-[3px] border-black bg-blue-soft px-5 py-4">
            <p className="font-display text-[0.95rem] font-bold">The conversation, from DEXTRA’s test suite</p>
            <ul className="mt-3 grid gap-1.5">
              {TRANSCRIPT.map(t => (
                <li key={t.text} className="grid grid-cols-[3.5rem_1fr]">
                  <span className="font-semibold text-ink-3">{t.speaker === 0 ? 'You' : 'Them'}</span>
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <p className="font-display text-[0.95rem] font-bold sm:col-span-2">What the AI proposed. Change any of it.</p>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[0.95rem] font-semibold">Who owes it</legend>
              <div className="flex gap-3">
                {([0, 1] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update({ speaker: s })}
                    aria-pressed={draft.speaker === s}
                    className={`min-h-11 min-w-20 border-[3px] border-black px-4 font-display font-bold ${draft.speaker === s ? 'bg-ink text-white' : 'bg-paper'}`}
                  >
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

          <div role="status" aria-live="polite" className={`relative min-h-[8.5rem] border-t-[3px] border-black px-5 py-5 ${verdict.kept ? 'bg-blue-soft' : 'bg-red-soft'}`}>
            <p className={`max-w-[68%] font-display text-[1.15rem] font-bold ${verdict.kept ? '' : 'line-through decoration-red decoration-[3px]'}`}>
              {owner} will {draft.what || '…'}
              {draft.amount && ` (${draft.amount})`}
            </p>
            <p className="mt-1 max-w-[68%]">{verdict.kept ? 'Reaches the lens for you to send.' : 'Dropped before it reaches the lens.'}</p>
            {active >= 0 && <p className="mt-1 max-w-[68%] text-ink-2">{PRESETS[active]!.why}</p>}
            <div
              className={`stamp absolute bottom-5 right-5 border-[3px] bg-paper px-3 py-1.5 text-center font-display font-extrabold uppercase ${verdict.kept ? 'border-blue text-blue' : 'border-red text-red'}`}
              style={{ transform: 'rotate(-8deg)' }}
            >
              <span className="block text-[1.25rem] leading-none">{verdict.kept ? 'Kept' : 'Refused'}</span>
              {!verdict.kept && <span className="mt-1 block font-mono text-[0.75rem] font-normal normal-case">{verdict.code}</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.95rem] font-semibold">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={120}
        className="min-h-11 border-[3px] border-black bg-paper px-3 py-2 outline-none focus:shadow-[4px_4px_0_var(--color-blue)]"
      />
    </label>
  )
}
