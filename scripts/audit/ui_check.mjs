// Audit: drive the built app in a real (headless) Chrome and check the interactive features.
//
// Setup (not a project dependency, install only when auditing):
//   npm i --no-save puppeteer-core
//   npm run build && npx vite preview --port 4173
// Run:
//   node scripts/audit/ui_check.mjs [baseUrl] [chromePath]
// Defaults: http://localhost:4173/lila-assessment/ and the standard Windows Chrome path.

import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://localhost:4173/lila-assessment/'
const CHROME = process.argv[3] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1440,900'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const clock = () => page.$eval('.clock', (el) => el.textContent.trim())
const toSec = (s) => {
  const [m, ss] = s.split('/')[0].trim().split(':').map(Number)
  return m * 60 + ss
}
// Hash of a sample of canvas pixels: changes when anything visible changes
const canvasSig = () =>
  page.$eval('.mapview canvas', (c) => {
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let h = 0
    for (let i = 0; i < d.length; i += 4003) h = (h * 31 + d[i]) >>> 0
    return h
  })

try {
  // 1. Overview loads
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.match')
  const rows = await page.$$eval('.match', (els) => els.length)
  check('overview: match list renders', rows > 0, `${rows} rows`)
  check('overview: heatmap note shown', (await page.$eval('.sidebar', (el) => el.textContent)).includes('traffic events across all'))
  await sleep(500)
  const sigOverview = await canvasSig()
  check('overview: canvas drawn', sigOverview !== 0)

  // 2. Select a match
  await page.click('.match')
  await page.waitForSelector('.timeline')
  const c0 = await clock()
  const [start, total] = c0.split('/').map((s) => s.trim())
  check('match: opens at full length', start === total, c0)
  check('match: URL hash has match id', (await page.evaluate(() => location.hash)).includes('match='))

  // 3. Play advances time
  await page.click('.play')
  await sleep(1500)
  const t1 = toSec(await clock())
  check('play: restarts from 0 and advances', t1 > 0 && t1 < toSec(total), await clock())

  // 4. Space bar after clicking the play button pauses exactly once (no double toggle)
  await page.keyboard.press('Space')
  await sleep(200)
  const p1 = toSec(await clock())
  await sleep(800)
  const p2 = toSec(await clock())
  check('space: pauses playback when play button has focus', p1 === p2, `${p1}s then ${p2}s`)

  // 5. Space again resumes
  await page.keyboard.press('Space')
  await sleep(1000)
  check('space: resumes', toSec(await clock()) > p2)
  await page.keyboard.press('Space')

  // 6. Scrubber
  await page.$eval('.timeline input[type=range]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, '30')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(200)
  check('scrub: moves clock to 0:30', (await clock()).startsWith('0:30'), await clock())

  // 7. Speed buttons
  await page.evaluate(() => [...document.querySelectorAll('.speeds button')].find((b) => b.textContent === '20×').click())
  check('speed: 20x becomes active', await page.evaluate(() => document.querySelector('.speeds .active')?.textContent === '20×'))

  // 8. Pan and zoom change the picture
  const box = await (await page.$('.mapview canvas')).boundingBox()
  const s1 = await canvasSig()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 5 })
  await page.mouse.up()
  await sleep(200)
  const s2 = await canvasSig()
  check('pan: drag moves the map', s1 !== s2)
  await page.mouse.wheel({ deltaY: -400 })
  await sleep(200)
  check('zoom: wheel zooms the map', (await canvasSig()) !== s2)
  await page.evaluate(() => [...document.querySelectorAll('.zoom-controls button')].find((b) => b.textContent === 'Fit').click())

  // 9. Legend toggles (move playhead to the end first so every event is on screen)
  await page.$eval('.timeline input[type=range]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, el.max)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(200)
  const s3 = await canvasSig()
  await page.evaluate(() => [...document.querySelectorAll('.legend-row')].find((r) => r.textContent.includes('Loot')).querySelector('input').click())
  await sleep(200)
  check('legend: hiding loot changes the map', (await canvasSig()) !== s3)
  await page.evaluate(() => [...document.querySelectorAll('.legend-row')].find((r) => r.textContent.includes('Loot')).querySelector('input').click())

  // 10. Heatmap scope + layers
  const clickText = (sel, text) => page.evaluate((sel, text) => [...document.querySelectorAll(sel)].find((b) => b.textContent.trim() === text).click(), sel, text)
  await clickText('.sidebar button', 'All matches')
  await sleep(200)
  check('heat: "All matches" puts heat=all in URL', (await page.evaluate(() => location.hash)).includes('heat=all'))
  await clickText('.sidebar button', 'Kills')
  await sleep(200)
  check('heat: kills layer in URL', (await page.evaluate(() => location.hash)).includes('layer=kills'))

  // 11. Reload restores the shared view
  const hashBefore = await page.evaluate(() => location.hash)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.timeline')
  check('reload: shared link restores match + layer', (await page.evaluate(() => location.hash)) === hashBefore && !!(await page.$('.match.active')))

  // 12. Switching map clears the match
  await page.evaluate(() => [...document.querySelectorAll('.seg button')].find((b) => b.textContent.includes('Lockdown')).click())
  await sleep(300)
  check('map switch: clears match and timeline', !(await page.$('.timeline')) && !(await page.evaluate(() => location.hash)).includes('match='))

  // 13. No days selected shows a message, not an empty screen
  for (const d of await page.$$('.chip.active')) await d.click()
  await sleep(200)
  check('days: none selected shows guidance', (await page.$eval('.sidebar', (el) => el.textContent)).includes('Select at least one day'))
  check('days: empty selection kept in URL', (await page.evaluate(() => location.hash)).includes('days=none'))

  // 14. Every map loads its image
  for (const m of ['Ambrose Valley', 'Grand Rift', 'Lockdown']) {
    await page.goto(BASE, { waitUntil: 'networkidle0' })
    await page.evaluate((m) => [...document.querySelectorAll('.seg button')].find((b) => b.textContent.includes(m)).click(), m)
    await sleep(800)
    check(`map image loads: ${m}`, !(await page.$('.map-loading')))
  }

  // 15. Hand-edited / broken link values fall back to defaults instead of crashing
  const errsBefore = errors.length
  await page.goto(BASE + '#map=Nope&layer=foo&days=xx&match=does-not-exist', { waitUntil: 'networkidle0' })
  await sleep(500)
  check('bad link: app still renders', !!(await page.$('.sidebar')) && errors.filter((e) => !e.includes('404')).length === errsBefore)
  check('bad link: unknown match shows an error message', (await page.$eval('main', (el) => el.textContent)).includes('Could not load match'))
  // The 404 for the missing match file is expected here; drop it before the final check
  errors.splice(errsBefore)

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  check('script ran to the end', false, e.message)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${failed ? 'FAIL' : 'PASS'}: ${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
