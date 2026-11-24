const TRANSCRIPT = [
  { who: 'You', text: 'So you send me the deck by Friday?' },
  { who: 'Them', text: 'Yes, the deck by Friday. And you intro me to Sara?' },
  { who: 'You', text: "Deal, I'll intro you to Sara." },
]

const PROPOSED = [
  { what: 'Them: send the deck · Fri', quote: '“the deck by Friday”', kept: true, code: 'KEPT' },
  { what: 'You: intro to Sara', quote: '“I’ll intro you to Sara”', kept: true, code: 'KEPT' },
  { what: 'Them: pay $5,000', quote: '“I will pay five thousand”', kept: false, code: 'UNSUPPORTED_BY_TRANSCRIPT' },
]

/** The attack the product refuses, shown with the actual test case from apps/server/test/service.test.ts. */
export function Attack() {
  return (
    <section aria-labelledby="attack-heading" className="border-y border-line bg-ink-2">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-[var(--space-section)] lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-paper-3">What it refuses</p>
          <h2 id="attack-heading" className="max-w-[20ch] text-section font-medium leading-tight tracking-[-0.015em]">
            If nobody said it, it never reaches the lens.
          </h2>
          <p className="mt-5 max-w-[46ch] text-paper-2">
            An AI listening to a conversation can invent an obligation. DEXTRA lets the AI only propose. Deterministic
            code keeps a commitment when its quote appears in what <em>that person</em> said, any amount was actually
            spoken, and it carries no links. Then the other person still has to confirm it.
          </p>
          <p className="mt-4 text-sm text-paper-3">
            Test: <code className="font-mono text-paper-2">keeps only quote-backed commitments</code> in the server suite.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-ink font-mono text-[0.82rem]">
          <div className="border-b border-line px-5 py-3 text-paper-3">transcript</div>
          <ul className="grid gap-1.5 px-5 py-4">
            {TRANSCRIPT.map(line => (
              <li key={line.text}>
                <span className="text-paper-3">{line.who.padEnd(5, ' ')}</span> <span className="text-paper">{line.text}</span>
              </li>
            ))}
          </ul>
          <div className="border-y border-line px-5 py-3 text-paper-3">AI proposed → code decided</div>
          <ul className="grid gap-3 px-5 py-4">
            {PROPOSED.map(p => (
              <li key={p.what} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-4">
                <span className={p.kept ? 'text-paper' : 'text-paper-3 line-through decoration-warn/70'}>
                  {p.what} <span className="text-paper-3">{p.quote}</span>
                </span>
                <span className={p.kept ? 'text-lens' : 'text-warn'}>{p.code}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
