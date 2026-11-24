import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef } from 'react'
import { Attack } from './components/attack/Attack'
import { Footer, Privacy, Try } from './components/closing/Closing'
import { Hero } from './components/hero/Hero'
import { Proof } from './components/proof/Proof'
import { Story } from './components/story/Story'
import { BOT_HANDLE, BOT_URL } from './lib/content'
import { gsap, prefersReducedMotion, ScrollTrigger } from './lib/motion'

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/75 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <a href="#top" className="font-mono text-sm tracking-[0.25em] text-paper">
          DEXTRA
        </a>
        <div className="flex items-center gap-6 text-sm text-paper-2">
          <a className="hidden hover:text-paper sm:inline" href="#how">How it works</a>
          <a className="hidden hover:text-paper sm:inline" href="#proof">Proof</a>
          <a className="hidden hover:text-paper sm:inline" href="#try">Try it</a>
          <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="rounded-full border border-lens-dim px-3.5 py-1.5 text-lens transition-colors hover:bg-lens hover:text-ink">
            {BOT_HANDLE}
          </a>
        </div>
      </nav>
    </header>
  )
}

function Page() {
  return (
    <>
      <a href="#how" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-lens focus:px-3 focus:py-2 focus:text-ink">
        Skip to how it works
      </a>
      <Nav />
      <main id="top">
        <Hero />
        <Story />
        <Attack />
        <Proof />
        <Privacy />
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
