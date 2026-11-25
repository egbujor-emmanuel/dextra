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
      <a href="/" className="inline-flex min-h-11 items-center font-display text-xl tracking-[0.08em]">
        DEXTRA
      </a>
      <nav aria-label="Main" className="flex items-center gap-5 text-sm">
        <a className="hidden min-h-11 items-center hover:underline sm:inline-flex" href="#gate">Try to fool it</a>
        <a className="hidden min-h-11 items-center hover:underline sm:inline-flex" href="#how">How it works</a>
        <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-ink/40 px-4 transition-colors hover:border-ink">
          {BOT_HANDLE}
        </a>
      </nav>
    </header>
  )
}

function Page() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-ink focus:px-4 focus:text-stone">
        Skip to the content
      </a>
      <Nav />
      <main id="main">
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
