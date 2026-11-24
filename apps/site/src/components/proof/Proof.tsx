import { useEffect, useState } from 'react'
import { API_URL, EVAL, INVARIANTS, REPO_URL, TESTS } from '../../lib/content'

type Status = 'checking' | 'live' | 'waking' | 'down'

/** Free-plan servers sleep when idle; a cold start can take up to a minute, so say so instead of showing "down". */
function useServerStatus(): Status {
  const [status, setStatus] = useState<Status>('checking')
  useEffect(() => {
    const ctrl = new AbortController()
    const slow = window.setTimeout(() => setStatus(s => (s === 'checking' ? 'waking' : s)), 3500)
    fetch(`${API_URL}/health`, { signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(75_000)]) })
      .then(r => setStatus(r.ok ? 'live' : 'down'))
      .catch(() => setStatus(s => (ctrl.signal.aborted ? s : 'down')))
      .finally(() => window.clearTimeout(slow))
    return () => {
      ctrl.abort()
      window.clearTimeout(slow)
    }
  }, [])
  return status
}

const STATUS_TEXT: Record<Status, string> = {
  checking: 'Checking the live server…',
  live: 'Live server is up',
  waking: 'Waking the free server (up to a minute)…',
  down: 'Live server did not answer',
}

export function Proof() {
  const status = useServerStatus()
  const dot = status === 'live' ? 'bg-lens shadow-[0_0_10px_var(--color-lens)]' : status === 'down' ? 'bg-warn' : 'bg-paper-3 animate-pulse'
  const stats = [
    { value: String(TESTS), label: 'automated tests passing', note: 'core, glasses and server' },
    { value: EVAL.precision, label: 'precision on the extraction eval', note: `${EVAL.cases} conversations, ${EVAL.commitments} commitments` },
    { value: EVAL.recall, label: 'recall on the same eval', note: `free model: ${EVAL.model}` },
    { value: String(EVAL.inventedPassed), label: 'invented commitments reached the lens', note: 'the gate held on every case' },
  ]

  return (
    <section id="proof" aria-labelledby="proof-heading" className="mx-auto max-w-6xl px-6 py-[var(--space-section)]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-paper-3">Proof</p>
          <h2 id="proof-heading" className="text-section font-medium leading-tight tracking-[-0.015em]">
            Measured, and running now.
          </h2>
        </div>
        <p className="flex items-center gap-2.5 rounded-full border border-line px-4 py-2 text-sm text-paper-2" role="status">
          <span className={`size-2 rounded-full ${dot}`} aria-hidden />
          {STATUS_TEXT[status]}
        </p>
      </div>

      <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="bg-ink p-6">
            <dt className="min-h-[2.6em] text-sm leading-snug text-paper-2">{s.label}</dt>
            <dd className="mt-3 font-serif text-5xl leading-none text-paper">{s.value}</dd>
            <dd className="mt-3 text-xs text-paper-3">{s.note}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-8 grid gap-3 text-sm text-paper-2 md:grid-cols-3">
        <li className="rounded-xl border border-line p-4">
          <a className="font-medium text-paper hover:text-lens" href={`${REPO_URL}/blob/master/THREAT_MODEL.md`}>{INVARIANTS} safety rules →</a>
          <p className="mt-1 text-paper-3">Each mapped to the test that proves it.</p>
        </li>
        <li className="rounded-xl border border-line p-4">
          <a className="font-medium text-paper hover:text-lens" href={`${REPO_URL}/blob/master/JUDGES.md`}>Five-minute judge path →</a>
          <p className="mt-1 text-paper-3">From clone to a confirmed record.</p>
        </li>
        <li className="rounded-xl border border-line p-4">
          <span className="font-medium text-paper">Verified live, 24 Nov</span>
          <p className="mt-1 text-paper-3">Pair → lock → send → confirm → tick → fulfilled, with two real Telegram accounts.</p>
        </li>
      </ul>
    </section>
  )
}
