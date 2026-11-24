import { useRef, useState } from 'react'
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '../../lib/motion'
import { ChatBubble } from '../ui/ChatBubble'
import { BEATS } from './beats'

/** The product's own order: listen → lock → send → confirm → done. Pinned on wide screens, stacked otherwise. */
export function Story() {
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px)', () => {
        gsap.utils.toArray<HTMLElement>('.beat').forEach((el, i) => {
          ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: self => self.isActive && setActive(i) })
          gsap.fromTo(el, { opacity: 0.25 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 75%', end: 'top 45%', scrub: true } })
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  const beat = BEATS[active]!

  return (
    <section ref={root} id="how" aria-labelledby="how-heading" className="relative mx-auto max-w-6xl px-6 py-[var(--space-section)]">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-paper-3">How it works</p>
      <h2 id="how-heading" className="max-w-[24ch] text-section font-medium leading-tight tracking-[-0.015em]">
        Five moments, from a spoken promise to a done one.
      </h2>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_1fr]">
        <ol className="grid gap-[28vh] lg:pb-[30vh]">
          {BEATS.map((b, i) => (
            <li key={b.title} className="beat max-w-[46ch]">
              <p className="font-mono text-xs text-lens-dim">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-medium text-paper">{b.title}</h3>
              <p className="mt-3 text-paper-2">{b.body}</p>
              {/* On narrow screens each beat carries its own visual. */}
              <div className="mt-8 lg:hidden">
                <BeatVisual index={i} />
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-[18vh]" aria-live="polite">
            <BeatVisual index={active} key={beat.title} />
          </div>
        </div>
      </div>
    </section>
  )
}

function BeatVisual({ index }: { index: number }) {
  const b = BEATS[index]!
  return (
    <div className="grid gap-5">
      {b.frame && (
        <figure>
          <div className="relative aspect-[2/1] overflow-hidden rounded-[22px] border border-line bg-[#050706]">
            <img src={b.frame} alt={b.frameAlt} width={576} height={288} loading="lazy" className="lens-glow h-full w-full object-contain p-3" />
            <div className="scanlines pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          </div>
          <figcaption className="mt-2 text-xs text-paper-3">Real lens capture · Even simulator</figcaption>
        </figure>
      )}
      {b.bubbles.map(m => (
        <ChatBubble key={m.text} {...m} />
      ))}
      {b.bubbles.length > 0 && <p className="text-xs text-paper-3">Exact message wording from the bot; names are examples.</p>}
    </div>
  )
}
