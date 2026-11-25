import { ReactLenis, type LenisRef } from 'lenis/react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Footer, Proof, Records, Steps, Try } from './components/closing/Closing'
import { DemoGrid } from './components/demo/DemoGrid'
import { Marquee } from './components/marquee/Marquee'
import { BrutalLink } from './components/ui/BrutalButton'
import { BOT_HANDLE, BOT_URL } from './lib/content'
import { gsap, prefersReducedMotion, ScrollTrigger } from './lib/motion'

// The live validator pulls in zod; it loads after the first screen.
const Gate = lazy(() => import('./components/gate/Gate'))

function Nav() {
  return (
    <header className="border-b-[3px] border-black bg-paper">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="inline-flex min-h-11 items-center gap-2.5 font-display text-[1.35rem] font-extrabold tracking-[-0.02em]">
          <span aria-hidden className="size-4 bg-red" />
          DEXTRA
        </a>
        <nav aria-label="Main" className="flex items-center gap-6 font-display text-[0.95rem] font-bold">
          <a className="hidden min-h-11 items-center hover:underline md:inline-flex" href="#gate">Try to fool it</a>
          <a className="hidden min-h-11 items-center hover:underline md:inline-flex" href="#records">Records</a>
          <a className="hidden min-h-11 items-center hover:underline md:inline-flex" href="#how">How it works</a>
          <BrutalLink tone="ink" href={BOT_URL} target="_blank" rel="noopener noreferrer" className="px-4">
            {BOT_HANDLE}
          </BrutalLink>
        </nav>
      </div>
    </header>
  )
}

function Page() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:border-[3px] focus:border-black focus:bg-paper focus:px-4 focus:font-bold">
        Skip to the content
      </a>
      <Nav />
      <main id="main">
        <DemoGrid />
        <Marquee />
        <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
          <Gate />
        </Suspense>
        <Records />
        <Steps />
        <Proof />
        <Try />
      </main>
      <Footer />
    </>
  )
}

/** Lenis smooth scroll driven by GSAP's ticker (one clock for scroll and ScrollTrigger); off for reduced motion. */
export function App() {
  const lenisRef = useRef<LenisRef>(null)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const lenis = lenisRef.current?.lenis
    lenis?.on('scroll', ScrollTrigger.update)
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(update)
      lenis?.off('scroll', ScrollTrigger.update)
    }
  }, [reduced])

  if (reduced) return <Page />
  return (
    <ReactLenis root options={{ autoRaf: false, anchors: true }} ref={lenisRef}>
      <Page />
    </ReactLenis>
  )
}
