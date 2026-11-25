/**
 * The three records in DEXTRA's live database, read on 2026-11-24 (all from live runs of the eval recording played into
 * the Even simulator, confirmed by a second real Telegram account, "Attrito"). Text is exactly as stored, including the
 * speech-to-text slip "sell a deck"; only the wearer's name is replaced with "You". Times are UTC.
 */
export type RealRecord = {
  hash: string
  status: 'confirmed' | 'fulfilled'
  commitments: string[]
  timeline: { event: string; at: string }[]
}

export const RECORDS: RealRecord[] = [
  {
    hash: 'e2ace0f89e0ce2a83b9938ba53e13d85edc04c7c47ed9cec332e89651ed4b51b',
    status: 'fulfilled',
    commitments: ['You: send deck (Fri 27 Nov)', 'Attrito: introduce you to Sarah (Wed 25 Nov)', '+2 more, all ticked done'],
    timeline: [
      { event: 'Drafted on the lens', at: '15:06:35' },
      { event: 'Confirmed by Attrito', at: '15:15:31' },
      { event: 'Last item ticked done', at: '15:15:57' },
    ],
  },
  {
    hash: 'c84f7a8ccd71e71728cd56328d18d6ef9e5cbfb6121350c5ffcd054aa4c229ff',
    status: 'confirmed',
    commitments: ['You: sell a deck (Fri 27 Nov)', 'Attrito: introduce you to sarah (Wed 25 Nov)'],
    timeline: [
      { event: 'Drafted on the lens', at: '14:50:16' },
      { event: 'Sent into the chat', at: '14:50:52' },
      { event: 'Confirmed by Attrito', at: '14:51:18' },
    ],
  },
  {
    hash: 'e9de2299b901cebd7a00466aaa99687f0af32d9e3e413e665a5c37a87c2c14c0',
    status: 'confirmed',
    commitments: ['Attrito: introduce you to sarah (Wed 25 Nov)'],
    timeline: [
      { event: 'Drafted on the lens', at: '14:40:53' },
      { event: 'Sent into the chat', at: '14:41:26' },
      { event: 'Confirmed by Attrito', at: '14:44:02' },
    ],
  },
]

/** The people named in those records, as stored: the confirming account and the person to be introduced. */
export const PEOPLE = ['Attrito', 'Sarah']
