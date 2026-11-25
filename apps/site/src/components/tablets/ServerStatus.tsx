import { useEffect, useState } from 'react'
import { API_URL } from '../../lib/content'

type Status = 'checking' | 'live' | 'waking' | 'down'

/** A real health check of the live server. The free plan sleeps when idle, so a slow answer reads as "waking", not "down". */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking')
  const [checkedAt, setCheckedAt] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    const slow = window.setTimeout(() => setStatus(s => (s === 'checking' ? 'waking' : s)), 3500)
    fetch(`${API_URL}/health`, { signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(75_000)]) })
      .then(r => setStatus(r.ok ? 'live' : 'down'))
      .catch(() => setStatus(s => (ctrl.signal.aborted ? s : 'down')))
      .finally(() => {
        window.clearTimeout(slow)
        setCheckedAt(new Date().toISOString().slice(11, 19))
      })
    return () => {
      ctrl.abort()
      window.clearTimeout(slow)
    }
  }, [])

  const text = {
    checking: 'Checking the live server.',
    waking: 'Waking the live server. The free plan sleeps when idle; this takes up to a minute.',
    live: `The live server answered at ${checkedAt} UTC.`,
    down: `The live server did not answer at ${checkedAt} UTC. Try again in a minute.`,
  }[status]

  return (
    <p role="status" className="flex items-start gap-2.5 text-sm text-ink-2">
      <span
        aria-hidden
        className={`mt-[0.45em] size-2 shrink-0 rounded-full ${status === 'live' ? 'bg-ink shadow-[0_0_0_3px_rgb(243_233_214/0.25)]' : status === 'down' ? 'bg-dado' : 'animate-pulse bg-ink-3'}`}
      />
      {text}
    </p>
  )
}
