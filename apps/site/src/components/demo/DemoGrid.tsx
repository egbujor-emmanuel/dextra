import { useRef, useState } from 'react'
import { BOT_HANDLE, BOT_URL } from '../../lib/content'
import { gsap, prefersReducedMotion, useGSAP } from '../../lib/motion'
import { HEARD, RECORD } from '../../lib/record'
import { LensDisplay } from '../lens/LensDisplay'
import { BrutalLink } from '../ui/BrutalButton'
import { CopyCommand } from '../ui/CopyCommand'
import { ServerStatus } from './ServerStatus'

const MAX_HZ = 260
const FINAL_FRAME = 2 // lib/content FRAMES: 0 listening, 1 agreement card, 2 sent

/**
 * Product demo first (UI UX Pro Max pattern "Product Demo + Features"), as a visible neubrutalist grid: every cell
 * carries real content — the eval recording's lines with measured pitch, real lens captures, the bot's exact card text
 * and a confirmed record's real time.
 */
export function DemoGrid() {
  const root = useRef<HTMLElement>(null)
  const reduced = prefersReducedMotion()
  const [frame, setFrame] = useState(reduced ? FINAL_FRAME : 0)

  useGSAP(
    () => {
      if (reduced) return
      // Stagger List preset from the design system: back.out(1.4), 0.06 s per cell.
      const demoRevealTl = gsap.timeline()
      demoRevealTl
        .from('.cell', { opacity: 0, scale: 0.96, y: 16, duration: 0.45, stagger: { each: 0.06, grid: 'auto', from: 'start' }, ease: 'back.out(1.4)' })
        .from('.pitch', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, stagger: 0.25, ease: 'power2.out' }, 0.5)
        .call(() => setFrame(1), [], 1.8)
        .call(() => setFrame(FINAL_FRAME), [], 3.6)
        .from('.tg-confirm', { opacity: 0, x: 12, duration: 0.4, ease: 'power2.out' }, 3.8)
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="demo-heading" className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div className="brut-shadow grid bg-paper lg:grid-cols-12">
        {/* Statement */}
        <div className="cell border-b-[3px] border-black p-6 sm:p-8 lg:col-span-7 lg:border-r-[3px]">
          <h1 id="demo-heading" className="max-w-[16ch] text-[clamp(2.1rem,1.3rem+2.5vw,3.3rem)] font-extrabold leading-[1.02] tracking-[-0.025em]">
            Say it out loud. They confirm it in Telegram.
          </h1>
          <p className="mt-5 max-w-[52ch] text-ink-2">
            DEXTRA is an Even G2 app. It keeps the last 45 seconds in memory; hold the temple and the lens shows who
            promised what. One tap sends it into your chat with them, and nothing counts until they tap Confirm.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <BrutalLink tone="red" href={BOT_URL} target="_blank" rel="noopener noreferrer">
              Open {BOT_HANDLE}
            </BrutalLink>
            <BrutalLink tone="paper" href="#try">
              Try it without glasses
            </BrutalLink>
          </div>
        </div>

        {/* Recording state: what the glasses heard, with each voice's measured pitch */}
        <div className="cell flex flex-col gap-5 border-b-[3px] border-black bg-red-soft p-6 sm:p-8 lg:col-span-5">
          <div>
            <p className="flex items-center gap-3 font-display text-[1.6rem] font-extrabold text-red">
              <span aria-hidden className="size-4 animate-pulse rounded-full bg-red motion-reduce:animate-none" />
              REC
            </p>
            <p className="mt-1 text-ink-2">The last 45 seconds, in phone memory only. Nothing is written to disk.</p>
          </div>
          <ol className="grid gap-4">
            {HEARD.map(line => (
              <li key={line.text}>
                <div className="flex items-center gap-3 font-display text-[0.85rem] font-bold">
                  <span className="w-16 shrink-0">Voice {line.voice}</span>
                  <span className="h-2.5 flex-1 border-2 border-black bg-paper">
                    <span className="pitch block h-full bg-blue" style={{ width: `${Math.round((line.hz / MAX_HZ) * 100)}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-blue">{line.hz} Hz</span>
                </div>
                <p className="mt-1 text-[0.98rem] leading-snug">
                  {'quote' in line ? (
                    <>
                      Deal. <mark className="bg-paper px-0.5 font-semibold text-ink underline decoration-red decoration-2 underline-offset-4">{line.quote}</mark>
                    </>
                  ) : (
                    line.text
                  )}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-auto border-t-[3px] border-black pt-4">
            <ServerStatus />
          </div>
        </div>

        {/* The lens */}
        <div className="cell border-b-[3px] border-black bg-ink p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r-[3px]">
          <LensDisplay frame={frame} dark />
        </div>

        {/* Telegram */}
        <div className="cell flex flex-col gap-4 bg-blue-soft p-6 lg:col-span-4">
          <p className="font-display font-bold">In your Telegram chat</p>
          <div className="brut bg-paper p-4 text-[0.95rem] leading-relaxed">
            <p className="text-[0.85rem] font-semibold text-ink-3">You, sent by DEXTRA</p>
            <p className="mt-2">What we just agreed, so we both have it:</p>
            <p className="mt-2">
              • {RECORD.commitment.by}: {RECORD.commitment.what} ({RECORD.commitment.due})
            </p>
            <p className="mt-2 break-all text-blue">https://t.me/DextraAgreeBot?start=a_…</p>
          </div>
          <p className="tg-confirm brut self-end bg-paper px-3 py-2 font-display text-[0.95rem] font-bold">
            {RECORD.counterparty} tapped Confirm ✓ <span className="font-mono font-normal">{RECORD.timeline[2].at}</span>
          </p>
        </div>

      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-center">
        <CopyCommand command="npm run try" />
        <p className="text-[0.9rem] leading-relaxed text-ink-3">
          The three lines and their pitch come from DEXTRA’s eval recording. The lens frames, the message and the confirmation
          come from one live run of it, read back from the live database.
        </p>
      </div>
    </section>
  )
}
