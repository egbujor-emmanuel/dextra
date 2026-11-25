import { EVAL, INVARIANTS, TESTS } from '../../lib/content'

/** A neubrutalist ticker band of measured facts only (values read from evidence/ and the test run). Static under reduced motion. */
const FACTS = [
  `${TESTS} tests passing`,
  `precision ${EVAL.precision}`,
  `recall ${EVAL.recall}`,
  `${EVAL.inventedPassed} invented commitments reached the lens`,
  `${INVARIANTS} safety rules, each with a test`,
  'live on a real server',
  'confirmed by a real second account',
  'audio never written to disk',
]

export function Marquee() {
  const items = [...FACTS, ...FACTS]
  return (
    <div className="mt-[var(--space-section)] overflow-hidden border-y-[3px] border-black bg-ink py-4 text-white" aria-label="Measured facts">
      <ul className="marquee-track flex w-max gap-10 whitespace-nowrap font-display text-[1.05rem] font-bold">
        {items.map((f, i) => (
          <li key={`${f}-${i}`} className="flex items-center gap-10" aria-hidden={i >= FACTS.length}>
            {f}
            <span aria-hidden className="inline-block size-2.5 rotate-45 bg-red" />
          </li>
        ))}
      </ul>
    </div>
  )
}
