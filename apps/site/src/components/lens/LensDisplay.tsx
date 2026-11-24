import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { FRAMES } from '../../lib/content'
import { gsap, prefersReducedMotion } from '../../lib/motion'

const FRAME_MS = 2800

// The shader library is the heaviest dependency; the plain capture shows first, the WebGL lens takes over when loaded.
const LensDistortion = lazy(() => import('./lens-shader').then(m => ({ default: m.LensDistortion })))

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

type Props = {
  /** Show one fixed frame; otherwise the real captures cycle. */
  frame?: number
  className?: string
}

function PlainFrame({ src }: { src: string }) {
  return <img src={src} alt="" width={576} height={288} className="lens-glow h-full w-full object-contain" fetchPriority="high" />
}

/**
 * The G2 waveguide as a WebGL lens: a real simulator capture seen through a slight barrel warp and faint colour
 * fringing. Falls back to the plain capture without WebGL or with reduced motion.
 */
export function LensDisplay({ frame, className = '' }: Props) {
  const [index, setIndex] = useState(frame ?? 0)
  const glass = useRef<HTMLDivElement>(null)
  const useShader = useMemo(() => webglAvailable() && !prefersReducedMotion(), [])
  const current = FRAMES[(frame ?? index) % FRAMES.length]!

  useEffect(() => {
    if (frame !== undefined || prefersReducedMotion()) return
    const timer = window.setInterval(() => setIndex(i => (i + 1) % FRAMES.length), FRAME_MS)
    return () => window.clearInterval(timer)
  }, [frame])

  // A display refresh, not a slide: a quick dip and recover on every frame change.
  useEffect(() => {
    if (!glass.current || prefersReducedMotion()) return
    gsap.fromTo(glass.current, { opacity: 0.4 }, { opacity: 1, duration: 0.45, ease: 'power2.out' })
  }, [current.src])

  return (
    <figure className={`relative ${className}`}>
      <div className="relative aspect-[2/1] overflow-hidden rounded-[28px] border border-line bg-[#040605] p-[3%] shadow-[0_40px_120px_-40px_rgb(92_255_157/0.3),inset_0_1px_0_rgb(255_255_255/0.06)]">
        <div ref={glass} className="relative h-full w-full [filter:brightness(1.25)_drop-shadow(0_0_8px_rgb(92_255_157/0.35))]">
          {useShader ? (
            <Suspense fallback={<PlainFrame src={current.src} />}>
              <LensDistortion
                image={current.src}
                fit="contain"
                scale={1}
                speed={0}
                spread={0.06}
                count={10}
                dispersion={0.35}
                dispersionColor={0.25}
                focusCenter={0.95}
                focusEdges={1}
                swirl={0}
                lensBulge={0.06}
                grainOverlay={0.06}
                style={{ width: '100%', height: '100%' }}
                aria-hidden
              />
            </Suspense>
          ) : (
            <PlainFrame src={current.src} />
          )}
        </div>
        <div className="scanlines pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        {/* Glass reflection along the top edge of the lens. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.035] via-white/[0.01] to-transparent" aria-hidden />
      </div>
      <figcaption className="mt-3 flex items-center gap-2 text-xs text-paper-3">
        <span className="inline-block size-1.5 rounded-full bg-lens shadow-[0_0_8px_var(--color-lens)]" aria-hidden />
        <span>
          Real capture from the Even simulator · <span className="text-paper-2">{current.label}</span>
        </span>
      </figcaption>
      <span className="sr-only">The glasses display shows: {current.label}.</span>
    </figure>
  )
}
