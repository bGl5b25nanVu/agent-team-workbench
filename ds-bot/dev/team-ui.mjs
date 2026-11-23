// Real Chromium + real DSH, scripted model only. Run in an isolated dev/bench.sh profile.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const [bench = 'gongzuo-ui', port = '4174', phase = 'inspect'] = process.argv.slice(2)
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const home = join(root, `.dsh-test-${bench}`)
const out = join(root, 'docs/design/verification')
mkdirSync(out, { recursive: true })
const login = readFileSync(join(home, 'web.log'), 'utf8').match(new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=[^\\s]+`))?.[0]
if (!login) throw new Error('No test-profile login URL')
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true })
const context = await browser.newContext({ viewport: { width: 1487, height: 1058 }, deviceScaleFactor: 1, locale: 'zh-CN', colorScheme: 'light' })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()) })
const shot = name => page.screenshot({ path: join(out, `${name}.png`) })
try {
  await page.goto(login)
  const notice = page.getByRole('dialog').getByRole('button', { name: /^(Continue|继续)$/ })
  await page.addLocatorHandler(notice, () => notice.click())
  await page.locator('.bt-side').waitFor({ timeout: 60000 })
  await page.locator('.gw-workspace').waitFor({ timeout: 30000 })
  await page.locator('.gw-role-card').last().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.gw-role-art img').first().waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('.gw-role-art img')].every(image => image.complete && image.naturalWidth > 0))
  await shot('gongzuo-team-desktop')
  console.log((await page.locator('.gw-workspace').innerText()).slice(0, 4500))
  assert.equal(await page.locator('.gw-role-card').count(), 6)
  console.log(`UI inspection phase: ${phase}`)
} finally {
  writeFileSync(join(out, 'browser-errors.json'), JSON.stringify(errors, null, 2))
  await browser.close()
}
