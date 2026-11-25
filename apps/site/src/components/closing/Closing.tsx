import { BOT_HANDLE, BOT_URL, EVAL, INVARIANTS, REPO_URL, TESTS } from '../../lib/content'
import { CopyCommand } from '../ui/CopyCommand'

/** A real sequence, so numbering is meaningful here (DESIGN_SYSTEM.md). */
const STEPS = [
  { title: 'Listen', text: 'The phone keeps the last 45 seconds the glasses hear, in memory only.' },
  { title: 'Lock', text: 'Hold the temple. Who promised what appears on the lens, backed by their words.' },
  { title: 'Send', text: 'One tap sends it as you, into the chat you already have with them.' },
  { title: 'Confirm', text: 'They tap Confirm, or change it. Nothing counts until they do.' },
  { title: 'Done', text: 'Both of you tick items off. Whoever owes it gets a reminder the day before.' },
]

export function Steps() {
  return (
    <section id="how" aria-labelledby="how-heading" className="border-y border-ink/20 bg-stone-2/50">
      <div className="mx-auto max-w-7xl px-4 py-[var(--space-section)] sm:px-6">
        <h2 id="how-heading" className="font-display text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)]">From a spoken promise to a kept one</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative lg:border-l lg:border-ink/20 lg:px-5 lg:first:border-l-0 lg:first:pl-0">
              <p className="font-display text-[1.6rem] leading-none text-ink-3">{i + 1}</p>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 max-w-[30ch] text-[0.95rem] text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Proof() {
  return (
    <section aria-labelledby="proof-heading" className="mx-auto max-w-7xl px-4 py-[var(--space-section)] sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <h2 id="proof-heading" className="font-display text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)] leading-tight">What we measured</h2>
        <div className="grid gap-6 text-[1.05rem] leading-relaxed">
          <p>
            <strong className="font-display text-[1.9rem] font-normal">{TESTS}</strong> automated tests pass across the glasses
            app, the server and the shared core.
          </p>
          <p>
            On {EVAL.cases} labelled conversations holding {EVAL.commitments} commitments, the free {EVAL.model} model scored{' '}
            <strong className="font-display text-[1.9rem] font-normal">{EVAL.precision}</strong> precision and{' '}
            <strong className="font-display text-[1.9rem] font-normal">{EVAL.recall}</strong> recall, and{' '}
            <strong className="font-display text-[1.9rem] font-normal">{EVAL.inventedPassed}</strong> invented commitments got past
            the gate.
          </p>
          <p>
            <strong className="font-display text-[1.9rem] font-normal">{INVARIANTS}</strong> safety rules each point to the test
            that proves them, in the{' '}
            <a className="underline decoration-ink/40 underline-offset-4 hover:decoration-ink" href={`${REPO_URL}/blob/master/THREAT_MODEL.md`}>
              threat model
            </a>
            .
          </p>
          <p className="text-[0.95rem] text-ink-2">
            On 24 Nov the whole path ran live with two real Telegram accounts: pair, lock, send, confirm, tick, fulfilled.
            Judges can follow the{' '}
            <a className="underline decoration-ink/40 underline-offset-4 hover:decoration-ink" href={`${REPO_URL}/blob/master/JUDGES.md`}>
              five-minute path
            </a>
            .
          </p>
        </div>
      </div>
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
    <section id="try" aria-labelledby="try-heading" className="bg-ink text-stone">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-[var(--space-section)] sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <h2 id="try-heading" className="font-display text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)] leading-tight">Try it with two Telegram accounts</h2>
          <p className="mt-4 max-w-[42ch] text-stone/80">
            No glasses and no API keys. The official Even simulator runs the real app against the live server, and your
            second account plays the other person.
          </p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full bg-stone px-5 py-2.5 text-sm font-medium text-ink transition-transform active:scale-[0.98]"
          >
            Open {BOT_HANDLE}
          </a>
        </div>
        <ol className="grid min-w-0 gap-7">
          {TRY.map((s, i) => (
            <li key={s.title} className="grid min-w-0 grid-cols-[2rem_1fr] gap-x-3">
              <span className="font-display text-xl leading-none text-stone/60">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium">{s.title}</p>
                {s.command ? (
                  <div className="mt-2">
                    <CopyCommand command={s.command} dark />
                  </div>
                ) : (
                  <p className="mt-1 text-[0.95rem] text-stone/80">{s.text}</p>
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
    <footer className="bg-ink text-stone/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-stone/15 px-4 py-8 text-sm sm:px-6">
        <p>
          <span lang="la" className="font-display text-base text-stone">Dictum, factum.</span> Said, and done.
        </p>
        <p>Built for Heads Up by Even Realities, TVM Ventures and Daos Hub</p>
        <nav aria-label="Footer" className="flex gap-5">
          <a className="hover:text-stone" href={REPO_URL}>Source</a>
          <a className="hover:text-stone" href={`${REPO_URL}/blob/master/JUDGES.md`}>For judges</a>
          <a className="hover:text-stone" href="/llms.txt">llms.txt</a>
        </nav>
      </div>
    </footer>
  )
}
