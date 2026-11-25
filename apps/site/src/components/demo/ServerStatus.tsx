import { useEffect, useState } from 'react'
import { API_URL } from '../../lib/content'

type Status = 'checking' | 'live' | 'waking' | 'down'

/** A real health check of the live server, plus a UTC clock. The free plan sleeps when idle, so slow reads as "waking". */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking')
  const [clock, setClock] = useState(() => new Date().toISOString().slice(11, 19))

  useEffect(() => {
    const ctrl = new AbortController()
    const slow = window.setTimeout(() => setStatus(s => (s === 'checking' ? 'waking' : s)), 3500)
    fetch(`${API_URL}/health`, { signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(75_000)]) })
      .then(r => setStatus(r.ok ? 'live' : 'down'))
      .catch(() => setStatus(s => (ctrl.signal.aborted ? s : 'down')))
      .finally(() => window.clearTimeout(slow))
    const tick = window.setInterval(() => setClock(new Date().toISOString().slice(11, 19)), 1000)
    return () => {
      ctrl.abort()
      window.clearTimeout(slow)
      window.clearInterval(tick)
    }
  }, [])

  const text = {
    checking: 'Checking the live server',
    waking: 'Waking the free server, up to a minute',
    live: 'Live server answering',
    down: 'Live server not answering',
  }[status]

  return (
    <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem]">
      <span aria-hidden className={`size-3 border-2 border-black ${status === 'live' ? 'bg-blue' : status === 'down' ? 'bg-red' : 'animate-pulse bg-white'}`} />
      <span className="font-semibold">{text}</span>
      <span className="font-mono text-[0.85rem] text-ink-3">{clock} UTC</span>
    </p>
  )
}
