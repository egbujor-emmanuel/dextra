import { ReactLenis, type LenisRef } from 'lenis/react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Footer, Proof, Steps, Try } from './components/closing/Closing'
import { Tablets } from './components/tablets/Tablets'
import { BOT_HANDLE, BOT_URL } from './lib/content'
import { gsap, prefersReducedMotion, ScrollTrigger } from './lib/motion'

// The live validator pulls in zod; it loads after the first screen.
const Gate = lazy(() => import('./components/gate/Gate'))

function Nav() {
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-5 sm:px-6">
      <a href="#top" className="font-display text-xl tracking-[0.08em]">
        DEXTRA
      </a>
      <nav aria-label="Main" className="flex items-center gap-5 text-sm">
        <a className="hidden hover:underline sm:inline" href="#gate">Try to fool it</a>
        <a className="hidden hover:underline sm:inline" href="#how">How it works</a>
        <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ink/40 px-3.5 py-1.5 transition-colors hover:border-ink">
          {BOT_HANDLE}
        </a>
      </nav>
    </header>
  )
}

function Page() {
  return (
    <>
      <Nav />
      <main id="top">
        <Tablets />
        <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
          <Gate />
        </Suspense>
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
