import { Draggable } from 'gsap/Draggable'
import { useRef, useState } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '../../lib/motion'
import { RECORDS, type RealRecord } from '../../lib/records'
import { BrutalButton } from '../ui/BrutalButton'

gsap.registerPlugin(Draggable)

/**
 * Adapted from 21st.dev "Neo-Brutalist Kinetic Deck" (daiwiikharihar/neo-brutalist-kinetic-deck): stacked thick-bordered
 * cards, hard shadows, a slight fan, drag, and a 3D flip. Ported from framer-motion to GSAP (project stack), and the
 * right-click menu replaced with visible Flip / Next buttons so it works by keyboard and touch. The cards hold the three
 * real records from the live database.
 */
const FAN = [-5, 4, 0] // rotation per stack position, back to front
const FACE = ['bg-blue-soft', 'bg-red-soft', 'bg-paper']

export function RecordDeck() {
  const root = useRef<HTMLDivElement>(null)
  // order[0] is the back of the stack, order[last] the front.
  const [order, setOrder] = useState(() => RECORDS.map((_, i) => i))
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  const front = order[order.length - 1]!
  const reduced = prefersReducedMotion()

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>('.record-card')
      const draggables = Draggable.create(cards, { type: 'x,y', bounds: root.current, edgeResistance: 0.65, zIndexBoost: true })
      return () => draggables.forEach(d => d.kill())
    },
    { scope: root },
  )

  // Fan the stack and apply flips whenever the order or flip state changes.
  useGSAP(
    () => {
      order.forEach((recordIndex, position) => {
        const el = root.current?.querySelector<HTMLElement>(`[data-record="${recordIndex}"]`)
        const inner = el?.querySelector<HTMLElement>('.record-inner')
        if (!el || !inner) return
        gsap.to(el, { rotation: FAN[position] ?? 0, zIndex: position + 1, duration: reduced ? 0 : 0.5, ease: 'back.out(1.4)' })
        gsap.to(inner, { rotationY: flipped[recordIndex] ? 180 : 0, duration: reduced ? 0 : 0.6, ease: 'power3.inOut' })
      })
    },
    { scope: root, dependencies: [order, flipped] },
  )

  const next = () => {
    const el = root.current?.querySelector<HTMLElement>(`[data-record="${front}"]`)
    if (el) gsap.to(el, { x: 0, y: 0, duration: reduced ? 0 : 0.3 })
    setOrder(o => [o[o.length - 1]!, ...o.slice(0, -1)])
  }

  return (
    <div className="grid gap-6">
      <div ref={root} className="relative mx-auto h-[25rem] w-full max-w-[26rem] [perspective:1200px]" aria-live="polite">
        {RECORDS.map((record, i) => (
          <article
            key={record.hash}
            data-record={i}
            className="record-card absolute inset-x-4 top-4 h-[21.5rem] cursor-grab active:cursor-grabbing"
            aria-hidden={i !== front}
            // Demo Shield masks only what can be seen: the front card's visible face.
            data-shield-ignore={i !== front ? '' : undefined}
            aria-label={`Record ${record.hash.slice(0, 8)}, ${record.status}`}
          >
            <div className="record-inner relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
              <Face record={record} tone={FACE[i]!} isHidden={!!flipped[i]} />
              <Back record={record} tone={FACE[i]!} isHidden={!flipped[i]} />
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <BrutalButton tone="ink" onClick={() => setFlipped(f => ({ ...f, [front]: !f[front] }))}>
          {flipped[front] ? 'Show the commitments' : 'Flip: timeline and seal'}
        </BrutalButton>
        <BrutalButton tone="paper" onClick={next}>
          Next record
        </BrutalButton>
      </div>
      <p className="text-center text-[0.9rem] text-ink-3">Drag the cards. These are the three records in the live database.</p>
    </div>
  )
}

type FaceProps = { record: RealRecord; tone: string; isHidden: boolean }

function Face({ record, tone, isHidden }: FaceProps) {
  return (
    <div className={`brut-shadow absolute inset-0 flex flex-col p-6 ${tone}`} style={{ backfaceVisibility: 'hidden' }} data-shield-ignore={isHidden ? '' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="size-8 rounded-full border-[3px] border-black bg-paper" />
        <span className={`border-[3px] border-black px-2 py-0.5 font-display text-[0.8rem] font-extrabold uppercase ${record.status === 'fulfilled' ? 'bg-blue text-white' : 'bg-paper'}`}>
          {record.status}
        </span>
      </div>
      <h3 className="mt-5 font-display text-[1.35rem] font-extrabold leading-tight">Agreed: You and Attrito</h3>
      <ul className="mt-3 grid gap-1.5 text-[1rem] leading-snug">
        {record.commitments.map(c => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mt-auto border-t-[3px] border-black pt-3 font-mono text-[0.85rem]">sha-256 {record.hash.slice(0, 12)}…</p>
    </div>
  )
}

function Back({ record, tone, isHidden }: FaceProps) {
  return (
    <div className={`brut-shadow absolute inset-0 flex flex-col p-6 ${tone}`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} data-shield-ignore={isHidden ? '' : undefined}>
      <span aria-hidden className="ml-auto size-8 rounded-full border-[3px] border-black bg-paper" />
      <h3 className="mt-3 font-display text-[1.15rem] font-extrabold">Timeline, UTC, 24 Nov 2026</h3>
      <ol className="mt-3 grid gap-2 text-[0.98rem]">
        {record.timeline.map(t => (
          <li key={t.event} className="flex justify-between gap-3 border-b-2 border-black/15 pb-1.5">
            <span>{t.event}</span>
            <span className="font-mono">{t.at}</span>
          </li>
        ))}
      </ol>
      <p className="mt-auto font-display text-[0.85rem] font-bold">SHA-256 of what was agreed</p>
      <p className="mt-1 break-all font-mono text-[0.8rem] leading-snug">{record.hash}</p>
    </div>
  )
}
