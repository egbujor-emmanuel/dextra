// Records the motion-graphic scenes in video/motion.html (GSAP) to video/renders/motion-<scene>.webm.
// Writes video/renders/motion-cues.json: seconds into each recording when its animation started.
// Usage: node video/record-motion.mjs
import { renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(ROOT, 'renders')
const PAGE = pathToFileURL(resolve(ROOT, 'motion.html')).href
const SCENES = { problem: 10.6, solution: 11.2, 'step-1': 2.4, 'step-2': 2.4, 'step-3': 2.4, 'step-4': 2.4, 'step-5': 2.4, outro: 9.5 }

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? resolve(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1243/chrome-win64/chrome.exe'),
})
const cues = {}
for (const [scene, seconds] of Object.entries(SCENES)) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: OUT, size: { width: 1600, height: 900 } } })
  const page = await context.newPage()
  const t0 = Date.now()
  await page.goto(`${PAGE}#${scene}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => window.__play())
  cues[scene] = (Date.now() - t0) / 1000
  await page.waitForTimeout(seconds * 1000)
  const video = page.video()
  await context.close()
  renameSync(await video.path(), resolve(OUT, `motion-${scene}.webm`))
}
await browser.close()
writeFileSync(resolve(OUT, 'motion-cues.json'), JSON.stringify(cues, null, 1))
console.log(Object.entries(cues).map(([k, v]) => `${k}@${v.toFixed(2)}`).join(' '))
