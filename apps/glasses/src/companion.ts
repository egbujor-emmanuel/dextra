import { frameFor, type Screen } from './screens'

/**
 * The phone-side WebView mirrors the lens and carries setup instructions. It never shows
 * secrets. Text is set with textContent only (no HTML injection from server data).
 */
export function renderCompanion(screen: Screen): void {
  const root = document.getElementById('app')
  if (!root) return
  const f = frameFor(screen)
  const set = (id: string, text: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }
  set('lens-header', f.header)
  set('lens-body', f.body)
  set('lens-footer', f.footer)
  const help = document.getElementById('help')
  if (help) help.hidden = screen.kind !== 'pairing' && screen.kind !== 'idle'
}
