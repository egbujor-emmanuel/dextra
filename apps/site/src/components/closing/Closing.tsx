import { BOT_HANDLE, BOT_URL, REPO_URL } from '../../lib/content'
import { CopyCommand } from '../ui/CopyCommand'

const PRIVACY = [
  { title: 'Audio', text: 'Held in phone memory for 45 seconds, sent once when you lock, never written to disk.' },
  { title: 'Transcripts', text: 'Unconfirmed drafts are deleted after 24 hours. A confirmed record keeps only the commitments.' },
  { title: 'Your chats', text: 'DEXTRA keeps only who wrote to you and when. Message text is never stored or sent to an AI.' },
  { title: 'Consent', text: 'The other person sees exactly what they confirm, and can change it before it counts.' },
]

export function Privacy() {
  return (
    <section aria-labelledby="privacy-heading" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-[var(--space-section)]">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-paper-3">Privacy</p>
        <h2 id="privacy-heading" className="max-w-[22ch] text-section font-medium leading-tight tracking-[-0.015em]">
          Built for the room you’re in.
        </h2>
        <dl className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {PRIVACY.map(p => (
            <div key={p.title} className="border-l border-lens-dim/60 pl-5">
              <dt className="font-medium text-paper">{p.title}</dt>
              <dd className="mt-1.5 text-paper-2">{p.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

const STEPS: { title: string; text?: string; command?: string }[] = [
  { title: 'Start the simulator', command: `git clone ${REPO_URL} && cd dextra && npm install && npm run try` },
  { title: 'Link Telegram', text: `Send the code on the lens to ${BOT_HANDLE}. Then add it under Settings ▸ Chat Automation and allow Reply to messages.` },
  { title: 'Open the 24-hour window', text: 'From your second account, send your account any message, like “hi”.' },
  { title: 'Agree something', text: 'Talk near the mic, press Long Press, then Click to send. Confirm it on the second account.' },
]

export function Try() {
  return (
    <section id="try" aria-labelledby="try-heading" className="relative overflow-hidden border-t border-line bg-ink-2">
      <div className="pointer-events-none absolute -right-40 top-1/2 size-[36rem] -translate-y-1/2 rounded-full bg-lens/10 blur-[120px]" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-[var(--space-section)] lg:grid-cols-2">
        <div>
          <h2 id="try-heading" className="text-section font-medium leading-tight tracking-[-0.015em]">Try it with two Telegram accounts.</h2>
          <p className="mt-4 max-w-[44ch] text-paper-2">
            No glasses and no API keys. The simulator runs the real app against the live server; your second account plays
            the other person.
          </p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full bg-lens px-5 py-2.5 text-sm font-medium text-ink transition-[box-shadow] hover:shadow-[0_0_30px_-4px_var(--color-lens)] active:scale-[0.98]"
          >
            Open {BOT_HANDLE}
          </a>
        </div>
        <ol className="grid min-w-0 gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid min-w-0 grid-cols-[2rem_1fr] gap-x-3">
              <span className="font-mono text-sm text-lens-dim">0{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium text-paper">{s.title}</p>
                {s.command ? <div className="mt-2"><CopyCommand command={s.command} /></div> : <p className="mt-1 text-sm text-paper-2">{s.text}</p>}
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
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-paper-3">
        <p>
          <span className="serif-italic text-lg text-paper">Dictum, factum.</span> <span className="ml-2">Said, done.</span>
        </p>
        <p>Built for Heads Up · Even Realities × TVM Ventures × Daos Hub</p>
        <nav aria-label="Footer" className="flex gap-5">
          <a className="hover:text-paper" href={REPO_URL}>GitHub</a>
          <a className="hover:text-paper" href={`${REPO_URL}/blob/master/JUDGES.md`}>Judges</a>
          <a className="hover:text-paper" href="/llms.txt">llms.txt</a>
        </nav>
      </div>
    </footer>
  )
}
