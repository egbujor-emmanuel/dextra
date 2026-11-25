/**
 * Real data only.
 * - HEARD: the eval recording's three lines (evals/audio-kokoro, two synthetic voices) with each line's median pitch as
 *   measured by DEXTRA's own estimatePitch (packages/core/src/pitch.ts): 113 Hz, 204 Hz, 118 Hz.
 * - RECORD: a confirmed record read from the live Turso database on 2026-11-24 (one live run of that recording played
 *   into the simulator mic). The wearer's name is replaced with "You".
 */
export const HEARD = [
  { voice: 'A', hz: 113, text: 'So you will send me the pitch deck by Friday, right?' },
  { voice: 'B', hz: 204, text: 'Yes, I will send the deck by Friday. And can you introduce me to Sara?' },
  { voice: 'A', hz: 118, text: 'Deal. I will introduce you to Sara this week.', quote: 'I will introduce you to Sara this week.' },
] as const

export const RECORD = {
  counterparty: 'Attrito',
  commitment: { by: 'Attrito', what: 'introduce you to sarah', due: 'Wed 25 Nov', quote: 'I will introduce you to Sarah this week.' },
  hash: 'e9de2299b901cebd7a00466aaa99687f0af32d9e3e413e665a5c37a87c2c14c0',
  timeline: [
    { event: 'Drafted on the lens', at: '14:40:53' },
    { event: 'Sent into the chat', at: '14:41:26' },
    { event: 'Confirmed by Attrito', at: '14:44:02' },
  ],
  date: '24 Nov 2026, UTC',
} as const

export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-5)}`
