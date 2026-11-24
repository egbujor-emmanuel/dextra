// Simulator end-to-end check (PRD §9). Requires: server on :8787, glasses dev server on :5173,
// simulator launched with --automation-port 9898. Prints one line per assertion; exits 1 on failure.
import { PNG } from 'pngjs'

const SIM = process.env.SIM_URL ?? 'http://127.0.0.1:9898'
const results = []

const sleep = ms => new Promise(r => setTimeout(r, ms))
const getJson = async p => (await fetch(`${SIM}${p}`)).json()
const input = action => fetch(`${SIM}/api/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })

async function litPixels() {
  const buf = Buffer.from(await (await fetch(`${SIM}/api/screenshot/glasses`)).arrayBuffer())
  const png = PNG.sync.read(buf)
  let lit = 0
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] > 0) lit++
  return lit
}

async function waitForConsole(marker, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { entries } = await getJson('/api/console')
    if (entries.some(e => String(e.message).includes(marker))) return entries
    await sleep(500)
  }
  throw new Error(`console never showed ${marker}`)
}

function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

async function main() {
  check('simulator automation API reachable', (await (await fetch(`${SIM}/api/ping`)).text()).includes('pong'))
  await waitForConsole('[dextra] ready')
  check('app logged ready marker', true)
  await sleep(2500) // registration + pair-code round trip to the server
  const boot = await litPixels()
  check('lens is lit after boot (no black screen)', boot > 300, `${boot} lit px`)

  const { entries } = await getJson('/api/console')
  const errors = entries.filter(e => e.level === 'error' || /Uncaught|Unhandled|Failed to fetch/i.test(String(e.message)))
  check('no console errors at boot', errors.length === 0, errors.map(e => String(e.message).slice(0, 80)).join(' | '))

  await input('double_click')
  await sleep(1200)
  const afterExit = await litPixels()
  // shutDownPageContainer(1) is called on root double-tap. Simulator 0.9.5 clears the page instead of drawing
  // the OS confirmation dialog, so this proves the exit path fires, not how the dialog looks on hardware.
  check('root double-tap fires the exit path (lens cleared in simulator)', Math.abs(afterExit - boot) > 50, `${boot} → ${afterExit} lit px`)

  const failed = results.filter(r => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  process.exit(failed ? 1 : 0)
}

main().catch(e => {
  console.log(`FAIL  e2e aborted: ${e.message}`)
  process.exit(1)
})
