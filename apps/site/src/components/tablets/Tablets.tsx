import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BOT_HANDLE, BOT_URL } from '../../lib/content'
import { gsap, prefersReducedMotion, useGSAP } from '../../lib/motion'
import { HEARD, RECORD, shortHash } from '../../lib/record'
import { LensDisplay } from '../lens/LensDisplay'
import { CopyCommand } from '../ui/CopyCommand'
import { ServerStatus } from './ServerStatus'

const MAX_HZ = 260
/** Lens frames from lib/content FRAMES: 0 listening, 1 agreement card, 2 sent. */
const FINAL_FRAME = 2

/**
 * The first screen is a Roman diptych: what was said, cut into wax line by line with each voice's measured pitch, and
 * what was agreed, closed with the record's real SHA-256 as the seal. The G2 lens sits below as the witness.
 */
export function Tablets() {
  const root = useRef<HTMLElement>(null)
  const reduced = prefersReducedMotion()
  const [frame, setFrame] = useState(reduced ? FINAL_FRAME : 0)

  // One orchestrated moment on load (DESIGN_SYSTEM.md, principle 2). Reduced motion shows the final state.
  useGSAP(
    () => {
      if (reduced) return
      const incisionTl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      incisionTl
        .from('.cut-line', { clipPath: 'inset(0 100% 0 0)', duration: 1.0, stagger: 0.95 }, 0.3)
        .from('.pitch-mark', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, stagger: 0.95 }, 0.35)
        .call(() => setFrame(1), [], 3.1)
        .from('.agreed-part', { autoAlpha: 0, y: 6, duration: 0.6, stagger: 0.3 }, 3.5)
        .call(() => setFrame(FINAL_FRAME), [], 4.9)
        .fromTo('.seal', { autoAlpha: 0, scale: 1.7, rotate: -28 }, { autoAlpha: 1, scale: 1, rotate: -9, duration: 0.55, ease: 'back.out(2.2)' }, 5.4)
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="intro-heading" className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:pt-10">
      <div className="mb-8 grid gap-5 lg:grid-cols-[auto_1fr] lg:items-end lg:gap-12">
        <div>
          <p lang="la" className="font-display text-[clamp(1.9rem,1.4rem+1.6vw,2.9rem)] leading-none">Spondes? Spondeo.</p>
          <p className="mt-2 text-sm text-ink-2">“Do you promise?” “I promise.” In Rome, those spoken words made a contract.</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 lg:justify-end">
          <h1 id="intro-heading" className="max-w-[40ch] text-[1.08rem] font-medium leading-snug">
            DEXTRA does it again with Even G2 glasses: say what you agreed, and the other person confirms it in Telegram.
          </h1>
          <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-stone transition-transform active:scale-[0.98]">
            Open {BOT_HANDLE}
          </a>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_28px_1fr] lg:gap-0">
        <Tablet title="What was said" note="kept in phone memory, last 45 seconds">
          <ol className="grid gap-5">
            {HEARD.map(line => (
              <li key={line.text}>
                <p className="flex items-center gap-3 text-[0.78rem] text-stylus-2">
                  <span className="w-16 shrink-0">Voice {line.voice}</span>
                  <span className="h-[3px] flex-1 rounded-full bg-black/35">
                    <span className="pitch-mark block h-[3px] rounded-full bg-stylus/70" style={{ width: `${Math.round((line.hz / MAX_HZ) * 100)}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right">{line.hz} Hz</span>
                </p>
                <p className="cut-line incised mt-1.5 text-[1.02rem] leading-snug">
                  {'quote' in line ? (
                    <>
                      Deal. <span className="underline decoration-stylus/60 decoration-1 underline-offset-[5px]">{line.quote}</span>
                    </>
                  ) : (
                    line.text
                  )}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[0.8rem] leading-relaxed text-stylus-2">
            Speech-to-text heard one voice on this short clip, so DEXTRA told the two people apart by measured pitch. The
            underlined words back the commitment.
          </p>
        </Tablet>

        <Hinge />

        <Tablet title="What was agreed" note="the record both people keep">
          <div className="agreed-part">
            <p className="font-display incised text-[1.5rem] leading-tight">
              {RECORD.commitment.by} will {RECORD.commitment.what}
            </p>
            <p className="mt-1 text-[0.9rem] text-stylus-2">Due {RECORD.commitment.due}</p>
          </div>
          <ol className="agreed-part mt-6 grid gap-2 border-t border-black/30 pt-4 text-[0.88rem]">
            {RECORD.timeline.map(t => (
              <li key={t.event} className="flex justify-between gap-4">
                <span className="incised">{t.event}</span>
                <span className="text-stylus-2">{t.at}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-end justify-between gap-4">
            <p className="agreed-part max-w-[26ch] text-[0.8rem] leading-relaxed text-stylus-2">
              Sealed with the SHA-256 of what was agreed. Times are UTC, {RECORD.date.replace(', UTC', '')}.
            </p>
            <Seal hash={RECORD.hash} />
          </div>
        </Tablet>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,460px)_1fr] lg:items-center lg:gap-14">
        {/* The witness: the G2 lens, showing what the wearer saw at each step. */}
        <LensDisplay frame={frame} />
        <div className="grid gap-5">
          <p className="max-w-[56ch] text-ink-2">
            The glasses keep the last 45 seconds in memory. Hold the temple and the lens shows who promised what, backed by
            their own words. One tap sends it into your chat with them, and nothing counts until they tap Confirm. Then both
            of you tick it off, and whoever owes it gets a reminder the day before.
          </p>
          <div className="grid max-w-md gap-3">
            <p className="text-sm">No glasses? Run the official Even simulator against the live server, no keys needed:</p>
            <CopyCommand command="npm run try" />
          </div>
          <ServerStatus />
        </div>
      </div>

      <p className="mt-8 border-t border-ink/20 pt-4 text-xs leading-relaxed text-ink-3">
        What was said and its pitch come from DEXTRA’s eval recording. The lens frames and the record come from one live run
        of that recording through the Even simulator, read back from the live database. The wearer’s name is shown as “you”.
      </p>
    </section>
  )
}

function Tablet({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <article className="tablet-frame rounded-[14px] p-3 sm:p-3.5">
      <div className="wax h-full rounded-[8px] p-5 sm:p-6">
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display incised text-[1.25rem]">{title}</h2>
          <p className="text-[0.78rem] text-stylus-2">{note}</p>
        </header>
        {children}
      </div>
    </article>
  )
}

/** The cord holding the two leaves of the diptych together. */
function Hinge() {
  return (
    <div aria-hidden className="relative hidden lg:block">
      <div className="absolute inset-y-10 left-1/2 w-[6px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#5a3d27] to-[#3b2818]" />
      {[0.25, 0.75].map(t => (
        <span key={t} className="absolute left-1/2 size-4 -translate-x-1/2 rounded-full border-2 border-[#5a3d27] bg-stone" style={{ top: `${t * 100}%` }} />
      ))}
    </div>
  )
}

/** An oxblood wax seal pressed with the first characters of the record's real SHA-256. */
function Seal({ hash }: { hash: string }) {
  return (
    <div
      className="seal grid size-[86px] shrink-0 place-items-center text-center"
      style={{
        borderRadius: '47% 53% 51% 49% / 52% 46% 54% 48%',
        background: 'radial-gradient(circle at 35% 30%, #b04a33, #8c2f1c 55%, #5e1d10)',
        boxShadow: 'inset 0 -4px 8px rgb(0 0 0 / 0.45), inset 0 3px 6px rgb(255 190 160 / 0.25), 0 4px 10px rgb(0 0 0 / 0.5)',
        transform: 'rotate(-9deg)',
      }}
      title={`SHA-256 ${hash}`}
    >
      <div className="grid size-[64px] place-items-center rounded-full border border-black/25 shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]">
        <span className="font-mono text-[0.62rem] leading-tight text-[#f0c9b6]">
          {shortHash(hash).split('…')[0]}
          <br />
          sha-256
        </span>
      </div>
      <span className="sr-only">Sealed with SHA-256 {hash}</span>
    </div>
  )
}
