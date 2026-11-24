// One command for judges: the glasses app pointed at the LIVE server + the Even simulator. No API keys needed.
// Usage: npm run try            (system default microphone)
//        npm run try -- --aid <device id>   (a specific mic; list them with: npx evenhub-simulator --list-audio-input-devices)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const LIVE_API = process.env.DEXTRA_API ?? 'https://dextra-qfz7.onrender.com'
const PORT = 5173
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const children = []

/** One quoted command line (passing an args array with shell:true is deprecated in Node because it isn't escaped). */
function run(cmd, args, opts) {
  const line = [cmd, ...args.map(a => (/^[\w./:=-]+$/.test(a) ? a : JSON.stringify(a)))].join(' ')
  const child = spawn(line, { stdio: 'inherit', shell: true, ...opts })
  children.push(child)
  child.on('exit', code => {
    if (code) console.error(`[try] ${cmd} ${args[0]} exited with ${code}`)
  })
  return child
}

async function waitForPort(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`glasses app did not start on ${url}`)
}

process.on('SIGINT', () => {
  for (const c of children) c.kill()
  process.exit(0)
})

console.info(`[try] waking the live server ${LIVE_API} (the free plan sleeps when idle; the first call can take up to a minute)…`)
await fetch(`${LIVE_API}/health`, { signal: AbortSignal.timeout(90_000) }).then(
  r => console.info(`[try] live server: ${r.ok ? 'ready' : `HTTP ${r.status}`}`),
  () => console.warn('[try] live server did not answer yet; the app will keep retrying'),
)
run('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: resolve(root, 'apps/glasses'), env: { ...process.env, VITE_API_BASE: LIVE_API } })
await waitForPort(`http://localhost:${PORT}`)
run('npx', ['evenhub-simulator', `http://localhost:${PORT}`, '--automation-port', '9898', ...process.argv.slice(2)], { cwd: root })
console.info('[try] simulator starting. The lens shows a /pair code: send it to @DextraAgreeBot in Telegram.')
