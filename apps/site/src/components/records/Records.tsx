import type { CSSProperties } from 'react'
import { DemoShield } from '@/components/ui/demo-shield'
import { PEOPLE } from '@/lib/records'
import { RecordDeck } from './RecordDeck'

/**
 * Token overrides so the shield's small labels pass 4.5:1: darker muted text, and the site's recording red (#dc2626)
 * in place of the component's #ff3b2f for the lamp, the sweep and the "exposed" count.
 */
const SHIELD_TOKENS = { '--mute': '#5c584f', '--tally': '#dc2626' } as CSSProperties

/**
 * Records: the three real records as a deck (21st kinetic deck, ported to GSAP), under Demo Shield (21st / MouseUI) so a
 * record can be shown on a call with the people in it masked. The shield starts off; the names it masks come from the
 * records themselves.
 */
export default function Records() {
  return (
    <section id="records" aria-labelledby="records-heading" className="border-y-[3px] border-black bg-blue-soft">
      <DemoShield words={PEOPLE} watermark={false} style={SHIELD_TOKENS}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-32 pt-[var(--space-section)] font-sans sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 id="records-heading" className="text-[clamp(1.9rem,1.3rem+1.8vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
            One record, agreed by both people.
          </h2>
          <p className="mt-4 max-w-[46ch] text-ink-2">
            Not a note only you can see, and not a transcript of everything said. Just what was promised, by whom, and the
            moment the other person agreed, sealed with a SHA-256 of what was agreed. Then you both tick it off, and
            whoever owes it gets a reminder the day before.
          </p>
          <p className="mt-4 max-w-[46ch] text-ink-2">
            Showing one on a call? Turn the shield on below, or press Ctrl+Shift+H, and the names in it are masked.
          </p>
        </div>
        <RecordDeck />
      </div>
      </DemoShield>
    </section>
  )
}
