export type Beat = {
  title: string
  body: string
  frame?: string
  frameAlt?: string
  bubbles: { from: 'you' | 'bot'; sender: string; text: string; buttons?: string[] }[]
}

/**
 * Message texts are copied from apps/server/src/bot.ts (card, confirmReply, sendTracker) and service.ts
 * (reminderText). "Ada" stands in for the wearer's Telegram name; "Attrito" is the other person in the real captures.
 */
export const BEATS: Beat[] = [
  {
    title: 'Listen',
    body: 'While DEXTRA is open, the phone keeps only the last 45 seconds of what the glasses hear, in memory. Nothing is written to disk, and the lens shows when it is listening.',
    frame: '/lens/02-listen.png',
    frameAlt: 'Lens: DEXTRA, listening, last 45 seconds. Agreed something? Hold to lock it.',
    bubbles: [],
  },
  {
    title: 'Lock',
    body: 'Agreed something? Hold the temple. The server transcribes it, works out who said each line, and an AI proposes the commitments. Code keeps only the ones backed by that person’s own words, and merges repeats.',
    frame: '/lens/03-card.png',
    frameAlt: 'Lens: Agreed with Attrito? Attrito: introduce you to Sarah, Wednesday 25 November. Tap to send.',
    bubbles: [],
  },
  {
    title: 'Send',
    body: 'One tap sends it as you, into the chat you already have with them. Swipe first if who-owes-what came out swapped, or to pick someone else.',
    frame: '/lens/04-sent.png',
    frameAlt: 'Lens: Sent to Attrito, waiting for them to confirm.',
    bubbles: [
      {
        from: 'you',
        sender: 'Ada (sent by DEXTRA)',
        text: 'What we just agreed, so we both have it:\n\n• Attrito: introduce you to sarah (Wed 25 Nov)\n\nConfirm or change it here: https://t.me/DextraAgreeBot?start=a_…\n\n— Dextra · said out loud, confirmed in Telegram',
      },
    ],
  },
  {
    title: 'Confirm',
    body: 'They open the link and tap Confirm. Nothing counts until they do. If something is wrong, they type the change and it comes back to your lens to accept or reject. A confirmed record gets a SHA-256 fingerprint.',
    bubbles: [
      {
        from: 'bot',
        sender: 'DextraAgreeBot',
        text: 'Confirmed ✓ The record is in your chat, and I’ve sent you buttons to tick items off when they’re done. Dictum, factum.',
      },
    ],
  },
  {
    title: 'Done',
    body: 'Both of you get the same tap-when-done buttons. The day before something is due, whoever owes it gets a reminder; if it slips, both of you do. When every item is ticked, the record is fulfilled.',
    bubbles: [
      {
        from: 'bot',
        sender: 'DextraAgreeBot',
        text: '⏰ Due tomorrow: introduce you to sarah\nYou agreed this with Ada.\n\nTap it below once it’s done.',
        buttons: ['☐ Attrito: introduce you to sarah'],
      },
    ],
  },
]
