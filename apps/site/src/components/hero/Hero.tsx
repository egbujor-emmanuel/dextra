import { useRef } from 'react'
import { BOT_HANDLE, BOT_URL, REPO_URL } from '../../lib/content'
import { EASE, gsap, prefersReducedMotion, SplitText, useGSAP } from '../../lib/motion'
import { LensDisplay } from '../lens/LensDisplay'
import { CopyCommand } from '../ui/CopyCommand'

export function Hero() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const split = SplitText.create('.hero-title', { type: 'lines', mask: 'lines' })
      // Line masks clip descenders (the g in "Telegram"); give them room without moving the layout.
      for (const m of split.masks) Object.assign((m as HTMLElement).style, { paddingBottom: '0.14em', marginBottom: '-0.14em' })
      const heroRevealTl = gsap.timeline({ defaults: { ease: EASE } })
      heroRevealTl
        .from(split.lines, { yPercent: 110, duration: 1.1, stagger: 0.08 })
        .from('.hero-fade', { y: 16, opacity: 0, duration: 0.9, stagger: 0.08 }, '-=0.7')
        .from('.hero-lens', { y: 30, opacity: 0, scale: 0.97, duration: 1.4 }, '-=1.0')
      return () => split.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="hero-heading" className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <div>
        <p className="hero-fade mb-6 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-paper-2">
          <span className="size-1.5 rounded-full bg-lens" aria-hidden />
          For Even G2 glasses · works in Telegram
        </p>
        <h1 id="hero-heading" className="hero-title text-hero font-medium leading-[1.08] tracking-[-0.02em] text-paper">
          Say what you agreed. The other person confirms it in Telegram.
        </h1>
        <p className="hero-fade mt-6 max-w-[52ch] text-paper-2">
          DEXTRA keeps the last 45 seconds of your conversation in memory. When you agree something, hold the temple: the
          glasses show who promised what, and one tap sends it to the other person in your chat. Nothing counts until they
          tap Confirm.
        </p>
        <div className="hero-fade mt-8 flex flex-wrap items-center gap-3">
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-lens px-5 py-2.5 text-sm font-medium text-ink transition-[transform,box-shadow] hover:shadow-[0_0_30px_-4px_var(--color-lens)] active:scale-[0.98]"
          >
            Open {BOT_HANDLE}
          </a>
          <a href="#how" className="rounded-full border border-line px-5 py-2.5 text-sm text-paper-2 transition-colors hover:border-paper-3 hover:text-paper">
            How it works
          </a>
        </div>
        <div className="hero-fade mt-8 max-w-md">
          <p className="mb-2 text-xs text-paper-3">
            No glasses? Run the official Even simulator against the live server (no API keys):
          </p>
          <CopyCommand command="npm run try" />
          <p className="mt-2 text-xs text-paper-3">
            after cloning <a className="underline decoration-line underline-offset-4 hover:text-paper-2" href={REPO_URL}>the repo</a> and running <code className="font-mono">npm install</code>
          </p>
        </div>
      </div>
      <LensDisplay className="hero-lens" />
    </section>
  )
}
