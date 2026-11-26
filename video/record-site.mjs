// Records a real walkthrough of the live site (https://dextra-site.onrender.com) with Playwright's video capture:
// a visible cursor with click ripples, real scrolling and clicks, and a small step label in the corner.
// Writes video/renders/site.webm and video/renders/site-cues.json (when each narration line starts, in seconds).
// Usage: node video/record-site.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(ROOT, 'renders')
const SITE = 'https://dextra-site.onrender.com/'
const W = 1600
const H = 900
mkdirSync(OUT, { recursive: true })

const lines = JSON.parse(readFileSync(resolve(ROOT, 'walkthrough.json'), 'utf8')).lines
const seconds = id => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(ROOT, 'voice2', `${id}.wav`)]).toString())
const label = id => lines.find(l => l.id === id).label

// Cursor, click ripple and step label drawn inside the page so they are part of the recording.
const OVERLAY = `
addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style')
  s.textContent = '#__c{position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;transition:transform .08s}'
    + '#__c svg{display:block;filter:drop-shadow(1px 2px 0 rgba(0,0,0,.35))}'
    + '.__r{position:fixed;z-index:2147483646;width:44px;height:44px;margin:-22px 0 0 -22px;border:3px solid #dc2626;border-radius:50%;pointer-events:none;animation:__r .55s ease-out forwards}'
    + '@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}'
    + '#__m{position:fixed;z-index:2147483647;right:8px;top:2px;width:12px;height:12px;background:#000}'
    + '#__p{position:fixed;z-index:2147483645;left:16px;bottom:16px;padding:6px 12px;background:#0f172a;color:#fff;border:2px solid #000;box-shadow:3px 3px 0 #000;font:700 15px/1.2 Lexend,system-ui,sans-serif;opacity:0;transition:opacity .25s}'
  document.head.appendChild(s)
  const c = document.createElement('div'); c.id = '__c'
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 9-7 1.5L8 19z" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>'
  const p = document.createElement('div'); p.id = '__p'
  const m = document.createElement('div'); m.id = '__m'
  document.body.append(c, p, m)
  // Sync marker: a 4 px square whose colour encodes the current narration line, found later in the video frames.
  window.__mark = i => { m.style.background = ['#000', '#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff', '#fff', '#f80', '#80f', '#888'][i] }
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
  addEventListener('mousedown', e => { c.style.transform = 'scale(.85)'; const r = document.createElement('div'); r.className = '__r'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 600) }, true)
  addEventListener('mouseup', () => { c.style.transform = '' }, true)
  window.__pill = t => { p.textContent = t; p.style.opacity = t ? 1 : 0 }
})`

// Use the Chromium already installed for Playwright on this machine (set CHROME_PATH to override).
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? resolve(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1243/chrome-win64/chrome.exe'),
})
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } })
await context.addInitScript(OVERLAY)
const page = await context.newPage()
const t0 = Date.now()
const cues = []
const wait = ms => page.waitForTimeout(ms)
let mouse = { x: W / 2, y: H / 2 }

async function moveTo(x, y, steps = 28) {
  await page.mouse.move(x, y, { steps })
  mouse = { x, y }
}
async function moveToEl(locator, dx = 0.5, dy = 0.5) {
  await locator.scrollIntoViewIfNeeded()
  const b = await locator.boundingBox()
  await moveTo(b.x + b.width * dx, b.y + b.height * dy)
  return b
}
async function clickEl(locator) {
  await moveToEl(locator)
  await wait(180)
  await page.mouse.down()
  await wait(90)
  await page.mouse.up()
}
// Smooth-scroll to a section the way the site's own nav does (Lenis handles anchor links).
async function go(id) {
  await page.evaluate(target => {
    const a = Object.assign(document.createElement('a'), { href: `#${target}` })
    document.body.appendChild(a); a.click(); a.remove()
  }, id)
  await wait(1600)
}
// Start a narration line, run its actions, then hold until the line has finished.
async function cue(id, actions) {
  const start = (Date.now() - t0) / 1000
  cues.push({ id, start })
  await page.evaluate(([t, i]) => { window.__pill?.(t); window.__mark?.(i) }, [label(id), cues.length])
  await actions()
  const remaining = start + seconds(id) + 0.5 - (Date.now() - t0) / 1000
  if (remaining > 0) await wait(remaining * 1000)
}

await page.goto(SITE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await moveTo(W * 0.3, H * 0.35, 1)
await wait(700)

await cue('intro', async () => {
  await moveToEl(page.locator('#demo-heading'), 0.4, 0.5)
  await wait(900)
  for (const li of await page.locator('ol li').filter({ hasText: 'Hz' }).all()) { await moveToEl(li, 0.35, 0.7); await wait(500) }
  await moveToEl(page.locator('.tg-confirm'))
})

await cue('step1', async () => {
  await clickEl(page.getByRole('link', { name: 'Try it without glasses' }))
  await wait(1800)
  const copy = page.locator('#try').getByRole('button', { name: /Copy/ })
  await moveToEl(copy)
  await wait(400)
  await clickEl(copy)
})

const trySteps = page.locator('#try ol > li')
await cue('step2', async () => { await moveToEl(trySteps.nth(1), 0.3, 0.5); await wait(900); await moveToEl(trySteps.nth(1), 0.75, 0.6) })
await cue('step3', async () => { await moveToEl(trySteps.nth(2), 0.3, 0.5); await wait(900); await moveToEl(trySteps.nth(2), 0.7, 0.6) })
await cue('step4', async () => { await moveToEl(trySteps.nth(3), 0.3, 0.5); await wait(900); await moveToEl(trySteps.nth(3), 0.7, 0.6) })
cues.push({ id: 'cut', start: (Date.now() - t0) / 1000 }) // the simulator and Telegram footage goes here
await page.evaluate(i => { window.__pill?.(''); window.__mark?.(i) }, cues.length)

await go('gate')
await cue('gate', async () => {
  await clickEl(page.getByRole('button', { name: 'Invented money' }))
  await wait(2200)
  await clickEl(page.getByRole('button', { name: 'What was really said' }))
})

await go('records')
await cue('records', async () => {
  const front = page.locator('.record-card').last()
  const b = await moveToEl(front, 0.5, 0.25)
  await page.mouse.down(); await moveTo(b.x + b.width * 0.5 - 60, b.y + b.height * 0.25 + 30, 20); await page.mouse.up()
  await wait(500)
  await clickEl(page.getByRole('button', { name: /Flip/ }))
  await wait(1800)
  await clickEl(page.getByRole('button', { name: /Show the commitments/ }))
  await wait(900)
  await clickEl(page.locator('[role=toolbar] button').first())
})

await go('proof-heading')
await cue('proof', async () => {
  for (const dd of await page.locator('dl dd').all()) { await moveToEl(dd, 0.3, 0.6); await wait(450) }
})
await wait(800)

const video = page.video()
await context.close()
await browser.close()
renameSync(await video.path(), resolve(OUT, 'site.webm'))
writeFileSync(resolve(OUT, 'site-cues.json'), JSON.stringify(cues, null, 1))
console.log('site.webm', cues.map(c => `${c.id}@${c.start.toFixed(1)}`).join(' '))
