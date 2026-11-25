import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

/**
 * Adapted from 21st.dev "Brutal Button" (radiumcoders/brutal-button): thick border, hard offset shadow that snaps away on
 * press. Changes: no `cn` dependency, a link variant, 44px minimum target, and tokens from DESIGN_SYSTEM.md.
 */
type Tone = 'red' | 'paper' | 'ink' | 'blue'

const TONES: Record<Tone, { bg: string; text: string }> = {
  red: { bg: 'var(--color-red)', text: '#ffffff' },
  paper: { bg: 'var(--color-paper)', text: 'var(--color-ink)' },
  ink: { bg: 'var(--color-ink)', text: '#ffffff' },
  blue: { bg: 'var(--color-blue)', text: '#ffffff' },
}

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 border-[3px] border-black px-5 font-display text-[0.95rem] font-bold transition-[transform,box-shadow] duration-150 ease-out shadow-[4px_4px_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none'

function toneStyle(tone: Tone): CSSProperties {
  return { backgroundColor: TONES[tone].bg, color: TONES[tone].text }
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; children: ReactNode }

export function BrutalButton({ tone = 'paper', className = '', style, children, ...props }: ButtonProps) {
  return (
    <button type="button" className={`${BASE} ${className}`} style={{ ...toneStyle(tone), ...style }} {...props}>
      {children}
    </button>
  )
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { tone?: Tone; children: ReactNode }

export function BrutalLink({ tone = 'paper', className = '', style, children, ...props }: LinkProps) {
  return (
    <a className={`${BASE} ${className}`} style={{ ...toneStyle(tone), ...style }} {...props}>
      {children}
    </a>
  )
}
