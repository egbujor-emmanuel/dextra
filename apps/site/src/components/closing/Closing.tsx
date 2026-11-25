import { useRef } from 'react'
import { BOT_HANDLE, BOT_URL, EVAL, INVARIANTS, REPO_URL, TESTS } from '../../lib/content'
import { gsap, prefersReducedMotion, useGSAP } from '../../lib/motion'
import { BrutalLink } from '../ui/BrutalButton'
import { CopyCommand } from '../ui/CopyCommand'

/** A real sequence, so numbering is meaningful. */
const STEPS = [
  { title: 'Listen', text: 'The phone keeps the last 45 seconds the glasses hear, in memory only.' },
  { title: 'Lock', text: 'Hold the temple. Who promised what appears on the lens, backed by their words.' },
  { title: 'Send', text: 'One tap sends it as you, into the chat you already have with them.' },
  { title: 'Confirm', text: 'They tap Confirm, or change it. Nothing counts until they do.' },
  { title: 'Done', text: 'Both of you tick items off. Whoever owes it gets a reminder the day before.' },
]

export function Steps() {
  const root = useRef<HTMLElement>(null)
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      // Stagger List preset from the design system, triggered once when the steps scroll into view.
      gsap.from('.step', {
        opacity: 0,
        scale: 0.92,
        y: 16,
        duration: 0.4,
        stagger: { each: 0.06, from: 'start' },
        ease: 'back.out(1.4)',
        scrollTrigger: { trigger: root.current, start: 'top 75%', once: true },
      })
    },
    { scope: root },
  )
  return (
    <section ref={root} id="how" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-[var(--space-section)] sm:px-6">
      <h2 id="how-heading" className="text-[clamp(1.9rem,1.3rem+1.8vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
        From a spoken promise to a kept one.
      </h2>
      <ol className="brut-shadow mt-10 grid bg-paper sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step border-b-[3px] border-black p-6 last:border-b-0 sm:odd:border-r-[3px] lg:border-b-0 lg:border-r-[3px] lg:last:border-r-0">
            <p className={`grid size-11 place-items-center border-[3px] border-black font-display text-[1.25rem] font-extrabold ${i === 0 ? 'bg-red text-white' : 'bg-paper'}`}>{i + 1}</p>
            <h3 className="mt-4 text-[1.2rem] font-extrabold">{s.title}</h3>
            <p className="mt-1.5 text-ink-2">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function Proof() {
  const stats = [
    { value: String(TESTS), label: 'automated tests pass across the glasses app, the server and the shared core' },
    { value: EVAL.precision, label: `precision on ${EVAL.cases} labelled conversations (${EVAL.commitments} commitments), free ${EVAL.model} model` },
    { value: EVAL.recall, label: 'recall on the same eval' },
    { value: String(EVAL.inventedPassed), label: 'invented commitments got past the gate' },
  ]
  return (
    <section aria-labelledby="proof-heading" className="mx-auto max-w-7xl px-4 pb-[var(--space-section)] sm:px-6">
      <h2 id="proof-heading" className="text-[clamp(1.9rem,1.3rem+1.8vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
        What we measured.
      </h2>
      <dl className="brut-shadow mt-10 grid bg-paper sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-col-reverse justify-end border-b-[3px] border-black p-6 last:border-b-0 sm:odd:border-r-[3px] lg:border-b-0 lg:border-r-[3px] lg:last:border-r-0">
            <dt className="mt-3 text-ink-2">{s.label}</dt>
            <dd className={`font-display text-[3.2rem] font-extrabold leading-none ${i === 3 ? 'text-red' : ''}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-[70ch] text-ink-2">
        {INVARIANTS} safety rules each point to the test that proves them, in the{' '}
        <a className="font-semibold underline decoration-red decoration-2 underline-offset-4" href={`${REPO_URL}/blob/master/THREAT_MODEL.md`}>
          threat model
        </a>
        . On 24 Nov the whole path ran live with two real Telegram accounts: pair, lock, send, confirm, tick, fulfilled. Judges
        can follow the{' '}
        <a className="font-semibold underline decoration-red decoration-2 underline-offset-4" href={`${REPO_URL}/blob/master/JUDGES.md`}>
          five-minute path
        </a>
        .
      </p>
    </section>
  )
}

const TRY = [
  { title: 'Start the simulator', command: `git clone ${REPO_URL} && cd dextra && npm install && npm run try` },
  { title: 'Link Telegram', text: `Send the code on the lens to ${BOT_HANDLE}. Then add it under Settings, Chat Automation, and allow Reply to messages.` },
  { title: 'Open the 24-hour window', text: 'From your second account, send your account any message, like “hi”.' },
  { title: 'Agree something', text: 'Talk near the mic, press Long Press, then Click to send. Confirm it on the second account.' },
]

export function Try() {
  return (
    <section id="try" aria-labelledby="try-heading" className="border-t-[3px] border-black bg-red text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-[var(--space-section)] sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <h2 id="try-heading" className="text-[clamp(1.9rem,1.3rem+1.8vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
            Try it with two Telegram accounts.
          </h2>
          <p className="mt-4 max-w-[42ch] text-white">
            No glasses and no API keys. The official Even simulator runs the real app against the live server, and your second
            account plays the other person.
          </p>
          <BrutalLink tone="paper" className="mt-8" href={BOT_URL} target="_blank" rel="noopener noreferrer">
            Open {BOT_HANDLE}
          </BrutalLink>
        </div>
        <ol className="grid min-w-0 gap-4">
          {TRY.map((s, i) => (
            <li key={s.title} className="brut grid min-w-0 grid-cols-[2.75rem_1fr] gap-x-4 bg-paper p-4 text-ink">
              <span className="grid size-11 place-items-center border-[3px] border-black font-display text-[1.15rem] font-extrabold">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-display font-bold">{s.title}</p>
                {s.command ? (
                  <div className="mt-2">
                    <CopyCommand command={s.command} />
                  </div>
                ) : (
                  <p className="mt-1 text-ink-2">{s.text}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t-[3px] border-black bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <p className="font-display font-bold">
          DEXTRA <span lang="la" className="ml-2 font-sans font-normal">Dictum, factum. Said, and done.</span>
        </p>
        <p>Built for Heads Up by Even Realities, TVM Ventures and Daos Hub</p>
        <nav aria-label="Footer" className="flex gap-2">
          {[
            { href: REPO_URL, label: 'Source' },
            { href: `${REPO_URL}/blob/master/JUDGES.md`, label: 'For judges' },
            { href: '/llms.txt', label: 'llms.txt' },
          ].map(l => (
            <a key={l.label} className="inline-flex min-h-11 items-center px-2 font-semibold hover:underline" href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
