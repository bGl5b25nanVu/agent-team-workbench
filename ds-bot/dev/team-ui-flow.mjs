// Real browser interactions against an isolated dev/bench.sh profile and mock model.
// Run: CHROME_BIN=/path/to/chrome node dev/team-ui-flow.mjs gongzuo-ui 4174
// The bench must remain alive in the same process environment. No backend shortcuts.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const [bench = 'gongzuo-ui', port = '4174'] = process.argv.slice(2)
assert.match(bench, /^[a-z0-9-]+$/, 'Use an isolated bench name')
assert.match(port, /^\d+$/, 'Use a numeric development port')
assert.ok(Number(port) >= 1024 && Number(port) <= 65535 && port !== '3080', 'Do not target the real service')
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const home = join(root, `.dsh-test-${bench}`)
const runId = Date.now().toString(36)
const out = resolve(process.env.GONGZUO_UI_OUTPUT || join(root, 'docs/design/verification', `flow-${runId}`))
mkdirSync(out, { recursive: true })
const roleNames = ['Coordinator', 'Researcher', 'Engineer', 'Designer', 'Tester', 'Operator']
const teamName = `UI verification ${runId}`
const memberNames = roleNames.map(name => `${name} ${runId}`)
const customMarker = `GONGZUO_UI_CUSTOM_${runId}`
const desktop = { width: 1487, height: 1058 }
const report = {
  status: 'running', startedAt: new Date().toISOString(), bench, origin: `http://127.0.0.1:${port}`,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  browser: process.env.CHROME_BIN || '/usr/bin/chromium', node: process.version, desktop,
  teamName, memberNames, steps: [], screenshots: [], pageErrors: [], consoleErrors: [], requestFailures: [],
  limits: ['Uses the scripted mock model, not a paid provider.', 'Does not submit a goal or simulate approval/recovery failures.', 'Screenshots still require a human or agent visual comparison.'],
}
const clean = value => String(value).replace(/([?&]token=)[^\s"'<>]+/g, '$1[redacted]')
const save = () => writeFileSync(join(out, 'result.json'), JSON.stringify(report, null, 2))
let browser
let page
let customInstructions
let selectedModel
let selectedPermission
let modelCallsBefore

function mockCalls() {
  const log = join(home, 'mock.jsonl')
  if (!existsSync(log)) return 0
  const text = readFileSync(log, 'utf8')
  return text.slice(0, text.lastIndexOf('\n') + 1).split('\n').filter(Boolean).length
}

async function capture(name) {
  if (!page || page.isClosed()) return
  const file = `${name}.png`
  await page.screenshot({ path: join(out, file), timeout: 15000 })
  report.screenshots.push(file)
}

async function step(name, action) {
  const entry = { name, status: 'running', startedAt: new Date().toISOString() }
  report.steps.push(entry)
  save()
  const started = Date.now()
  try {
    const detail = await action()
    entry.status = 'passed'
    if (detail !== undefined) entry.detail = detail
    console.log(`PASS ${name}`)
  } catch (error) {
    entry.status = 'failed'
    entry.error = clean(error.stack || error)
    try { await capture(`failed-${name}`) } catch (failure) { entry.screenshotError = clean(failure.message) }
    if (page && !page.isClosed()) {
      try {
        writeFileSync(join(out, `failed-${name}-visible.txt`), clean((await page.locator('body').innerText()).slice(0, 20000)))
      } catch { /* The page may have crashed before the failure capture. */ }
    }
    throw error
  } finally {
    entry.durationMs = Date.now() - started
    save()
  }
}

const workspace = () => page.locator('.gw-workspace:not([data-leaving])')
const inspector = () => workspace().locator('.gw-inspector')
const memberName = () => inspector().locator(':scope > label.gw-field input').nth(0)
const memberRole = () => inspector().locator(':scope > label.gw-field input').nth(1)
const model = () => inspector().locator(':scope > label.gw-field select')
const exploration = () => inspector().locator('.gw-more select').nth(1)
const permission = () => inspector().locator('.gw-more select').nth(2)
const instructions = () => inspector().locator('textarea.gw-instructions')
const teamInput = () => workspace().locator('.gw-team-form input')

async function moreSettings() {
  const details = inspector().locator('details.gw-more')
  if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click()
}

async function editRole(index) {
  const card = workspace().locator('.gw-role-card').nth(index)
  await card.locator('.gw-role-detail').click()
  await card.locator('.gw-role-detail[aria-pressed="true"]').waitFor()
}

async function navigate(index) {
  const mobile = workspace().locator('.gw-mobile-nav')
  const nav = await mobile.isVisible() ? mobile : page.locator('.gw-nav').first()
  await nav.getByRole('button').nth(index).click()
  if (index !== 3) await workspace().waitFor()
}

async function openWizard(fresh = false) {
  await navigate(1)
  await page.waitForFunction(() => document.querySelector('.gw-wizard, .gw-team-grid, .gw-creation-result'))
  if (!await workspace().locator('.gw-wizard').isVisible()) {
    await workspace().locator('.gw-page-head > .gw-primary').click()
  }
  await workspace().locator('.gw-role-card').last().waitFor()
  const reset = workspace().locator('.gw-reset-draft')
  if (fresh && await reset.isVisible()) await reset.click()
}

async function checkSelection(expected) {
  await page.waitForFunction(indices => {
    const inputs = [...document.querySelectorAll('.gw-workspace:not([data-leaving]) .gw-role-check input')]
    return inputs.length === 6 && inputs.every((input, index) => input.checked === indices.includes(index))
  }, expected)
  assert.equal(await workspace().locator('.gw-role-check input:checked').count(), expected.length)
}

async function options(select) {
  return select.locator('option').evaluateAll(items => items.map(item => ({ value: item.value, label: item.textContent, disabled: item.disabled })))
}

async function checkWidth(label) {
  const metrics = await workspace().evaluate(node => ({
    clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
    left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right,
    viewportWidth: innerWidth, bodyWidth: document.documentElement.scrollWidth,
  }))
  assert.ok(metrics.clientWidth > 200, `${label}: workspace is too narrow: ${JSON.stringify(metrics)}`)
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 2, `${label}: workspace overflows horizontally: ${JSON.stringify(metrics)}`)
  assert.ok(metrics.left >= -2 && metrics.right <= metrics.viewportWidth + 2, `${label}: workspace leaves the viewport: ${JSON.stringify(metrics)}`)
  assert.ok(metrics.bodyWidth <= metrics.viewportWidth + 2, `${label}: document overflows horizontally: ${JSON.stringify(metrics)}`)
  return metrics
}

try {
  await step('launch-and-authenticate', async () => {
    assert.ok(existsSync(join(home, 'mock.pid')), 'Start the isolated mock bench first')
    const login = readFileSync(join(home, 'web.log'), 'utf8').match(new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=[^\\s]+`))?.[0]
    assert.ok(login, 'No local test-profile login URL was found')
    browser = await chromium.launch({ executablePath: report.browser, headless: true })
    const context = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1, locale: 'zh-CN', colorScheme: 'light', reducedMotion: 'reduce' })
    page = await context.newPage()
    page.setDefaultTimeout(20000)
    page.on('pageerror', error => report.pageErrors.push(clean(error.message)))
    page.on('console', entry => { if (entry.type() === 'error') report.consoleErrors.push(clean(entry.text())) })
    page.on('requestfailed', request => report.requestFailures.push({ url: clean(request.url()), error: request.failure()?.errorText }))
    const notice = page.getByRole('dialog').getByRole('button', { name: /^(Continue|继续|繼續)$/ })
    await page.addLocatorHandler(notice, () => notice.click())
    await page.goto(login)
    await page.locator('.bt-side').waitFor({ timeout: 60000 })
    await workspace().waitFor({ timeout: 30000 })
  })

  await step('initial-six-role-builder', async () => {
    await openWizard(true)
    await checkSelection([0, 1, 2, 3, 4, 5])
    assert.equal(await workspace().locator('.gw-role-card').count(), 6)
    assert.ok(await workspace().locator('.gw-role-check input').nth(0).isDisabled(), 'Coordinator must remain included')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('.gw-role-art img')]
      return images.length === 6 && images.every(image => image.complete && image.naturalWidth > 0)
    })
    await capture('01-builder-desktop')
    modelCallsBefore = mockCalls()
    report.mockCallsBefore = modelCallsBefore
  })

  await step('templates-and-role-selection', async () => {
    const templates = workspace().locator('.gw-blueprint')
    await templates.nth(1).click()
    await checkSelection([0, 1, 2, 4])
    await templates.nth(2).click()
    await checkSelection([0, 1, 3, 5])
    await templates.nth(0).click()
    await checkSelection([0, 1, 2, 3, 4, 5])
    await workspace().locator('.gw-role-check input').nth(5).uncheck()
    await checkSelection([0, 1, 2, 3, 4])
    await workspace().locator('.gw-role-check input').nth(5).check()
    await checkSelection([0, 1, 2, 3, 4, 5])
  })

  await step('member-names-models-and-permissions', async () => {
    await teamInput().fill(teamName)
    for (let index = 0; index < roleNames.length; index++) {
      await editRole(index)
      await memberName().fill(memberNames[index])
      const models = (await options(model())).filter(item => item.value && !item.disabled)
      const available = models.find(item => /deepseek.*flash|flash/i.test(item.value))
      assert.ok(available, 'The mock-backed DeepSeek Flash route must be available; do not use an arbitrary live provider')
      await model().selectOption(available.value)
      assert.equal(await model().inputValue(), available.value)
      await moreSettings()
      const permissions = (await options(permission())).filter(item => item.value && !item.disabled && item.value !== 'danger-full-access')
      const preset = permissions.find(item => item.value === (index === 2 ? 'workspace-write' : 'read-only')) || permissions[0]
      assert.ok(preset, 'A non-full-access runtime permission preset must be available')
      await permission().selectOption(preset.value)
      assert.equal(await permission().inputValue(), preset.value)
      if (index === 0) { selectedModel = available.value; selectedPermission = preset.value }
    }
    await editRole(0)
    await memberRole().fill('UI coordination')
    return { selectedModel, coordinatorPermission: selectedPermission }
  })

  await step('custom-instruction-protection', async () => {
    await moreSettings()
    const originalMode = await exploration().inputValue()
    const customized = `${await instructions().inputValue()}\n\n${customMarker}: Preserve this user instruction.`
    await instructions().fill(customized)
    const proposedMode = originalMode === 'open' ? 'steady' : 'open'
    await exploration().selectOption(proposedMode)
    await inspector().locator('.gw-prompt-change').waitFor()
    assert.equal(await instructions().inputValue(), customized)
    await capture('02-custom-instruction-review')
    await inspector().getByRole('button', { name: /^(Keep my instructions|保留我的指令)$/ }).click()
    await inspector().locator('.gw-prompt-change').waitFor({ state: 'detached' })
    assert.equal(await instructions().inputValue(), customized)
    assert.equal(await exploration().inputValue(), originalMode)
    await exploration().selectOption(proposedMode)
    await inspector().getByRole('button', { name: /^(Use template instructions|采用模板指令|採用模板指令)$/ }).click()
    await inspector().locator('.gw-prompt-change').waitFor({ state: 'detached' })
    assert.equal(await exploration().inputValue(), proposedMode)
    assert.ok(!(await instructions().inputValue()).includes(customMarker))
    customInstructions = `${await instructions().inputValue()}\n\n${customMarker}: Keep the agreed scope and attach verification evidence.`
    await instructions().fill(customInstructions)
    await editRole(1)
    await editRole(0)
    await moreSettings()
    assert.equal(await instructions().inputValue(), customInstructions)
    report.coordinatorExploration = proposedMode
  })

  await step('appearance-switch-and-restore', async () => {
    await inspector().getByRole('button', { name: /^(Change appearance|更换形象|更換形象)$/ }).click()
    await inspector().locator('.gw-look-choice').nth(1).click()
    await inspector().locator('.gw-inspector-hero img[src*="team-owl"]').waitFor()
    await inspector().locator('.gw-look-choice').nth(0).click()
    await inspector().locator('.gw-inspector-hero img[src*="team-elephant"]').waitFor()
    await inspector().getByRole('button', { name: /^(Change appearance|更换形象|更換形象)$/ }).click()
  })

  await step('draft-survives-reload', async () => {
    await page.reload()
    await page.locator('.bt-side').waitFor()
    await openWizard()
    assert.equal(await teamInput().inputValue(), teamName)
    await checkSelection([0, 1, 2, 3, 4, 5])
    for (let index = 0; index < roleNames.length; index++) {
      await editRole(index)
      assert.equal(await memberName().inputValue(), memberNames[index])
    }
    await editRole(0)
    await moreSettings()
    assert.equal(await memberRole().inputValue(), 'UI coordination')
    assert.equal(await model().inputValue(), selectedModel)
    assert.equal(await permission().inputValue(), selectedPermission)
    assert.equal(await exploration().inputValue(), report.coordinatorExploration)
    assert.equal(await instructions().inputValue(), customInstructions)
  })

  await step('narrow-builder-and-keyboard', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await workspace().locator('.gw-mobile-nav').waitFor()
    await teamInput().click()
    const metrics = await checkWidth('390px builder')
    const footer = await workspace().locator('.gw-wizard-footer').evaluate(node => {
      return [...node.querySelectorAll(':scope > .gw-text-btn, .gw-selection-summary strong, :scope > .gw-primary')].map(control => {
        const { left, right, top, bottom } = control.getBoundingClientRect()
        return { text: control.textContent, left, right, top, bottom, width: control.clientWidth, contentWidth: control.scrollWidth }
      })
    })
    assert.equal(footer.length, 3, 'The narrow footer must keep Back, member count, and Next visible')
    for (let index = 0; index < footer.length; index++) {
      const control = footer[index]
      assert.ok(control.contentWidth <= control.width + 2, `Footer label is clipped: ${JSON.stringify(control)}`)
      for (const other of footer.slice(index + 1)) {
        const overlapX = Math.min(control.right, other.right) - Math.max(control.left, other.left)
        const overlapY = Math.min(control.bottom, other.bottom) - Math.max(control.top, other.top)
        assert.ok(overlapX <= 1 || overlapY <= 1, `Footer controls overlap: ${JSON.stringify({ control, other })}`)
      }
    }
    await capture('03-builder-mobile')
    await memberName().click()
    await page.keyboard.press('Tab')
    assert.ok(await memberRole().evaluate(node => node === document.activeElement), 'Tab should move from name to role')
    await capture('04-inspector-mobile')
    await page.setViewportSize(desktop)
    return { ...metrics, footer }
  })

  await step('review-and-return-to-edit', async () => {
    await workspace().locator('.gw-wizard-footer > .gw-primary').click()
    await workspace().locator('.gw-review').waitFor()
    assert.equal(await workspace().locator('.gw-review-member').count(), 6)
    assert.deepEqual(await workspace().locator('.gw-review-member strong').allTextContents(), memberNames)
    assert.equal(await workspace().locator('.gw-review-card > h2').innerText(), teamName)
    await capture('05-review-desktop')
    await workspace().getByRole('button', { name: /^(Edit members|编辑成员|編輯成員)$/ }).click()
    await moreSettings()
    assert.equal(await instructions().inputValue(), customInstructions)
    await workspace().locator('.gw-wizard-footer > .gw-primary').click()
    await workspace().locator('.gw-review').waitFor()
  })

  await step('create-team-through-ui', async () => {
    await workspace().locator('.gw-review .gw-wizard-footer > .gw-primary').click()
    await workspace().getByRole('heading', { name: /^(Your team is ready|团队已创建|團隊已建立|團隊已創建)$/ }).waitFor({ timeout: 60000 })
    assert.equal(await workspace().locator('.gw-creation-member').count(), 6)
    const statuses = await workspace().locator('.gw-creation-member > .gw-status').allTextContents()
    assert.ok(statuses.every(status => /^(Saved|已保存)$/.test(status)), `Expected six saved members: ${JSON.stringify(statuses)}`)
    assert.equal(mockCalls(), modelCallsBefore, 'Saving and configuring a team must not start model calls')
    await capture('06-creation-result')
  })

  await step('dashboard-and-persisted-settings', async () => {
    await workspace().getByRole('button', { name: /^(Open team|打开团队|打開團隊)$/ }).click()
    await workspace().locator('.gw-goal-card').waitFor()
    assert.equal(await workspace().locator('.gw-member-card').count(), 6)
    assert.equal(await workspace().locator('.gw-room-switch select option:checked').innerText(), teamName)
    await capture('07-dashboard-desktop')
    await page.reload()
    await page.locator('.bt-side').waitFor()
    await navigate(1)
    const card = workspace().locator('.gw-team-card').filter({ has: page.getByRole('heading', { name: teamName, exact: true }) })
    await card.waitFor()
    assert.equal(await card.count(), 1, 'Reload must show one saved team')
    await card.click()
    await workspace().locator('.gw-member-card').filter({ hasText: memberNames[0] }).click()
    const settings = page.locator('.bt-settings')
    await settings.waitFor()
    assert.equal(await settings.getByRole('textbox', { name: /^(Name|名字)$/ }).inputValue(), memberNames[0])
    assert.equal(await settings.getByRole('textbox', { name: /^(Instructions|说明|說明)$/ }).inputValue(), customInstructions)
    assert.equal(await settings.getByRole('textbox', { name: /^(Label|标签|標籤)$/ }).inputValue(), 'UI coordination')
    await capture('08-persisted-member-settings')
    await settings.locator('.bt-settings-close').click()
    await settings.waitFor({ state: 'detached' })
  })

  await step('team-inbox-and-mobile-navigation', async () => {
    await navigate(2)
    await workspace().locator('.gw-inbox-empty').waitFor()
    assert.equal((await workspace().locator('.gw-count').innerText()).trim(), '0')
    await capture('09-inbox-desktop')
    await navigate(0)
    await workspace().locator('.gw-goal-card').waitFor()
    await page.setViewportSize({ width: 768, height: 1024 })
    const tablet = await checkWidth('768px dashboard')
    await capture('10-dashboard-tablet')
    await page.setViewportSize({ width: 390, height: 844 })
    await workspace().locator('.gw-mobile-nav').waitFor()
    const phone = await checkWidth('390px dashboard')
    await navigate(1)
    await workspace().locator('.gw-team-card').filter({ hasText: teamName }).waitFor()
    await capture('11-teams-mobile')
    await navigate(2)
    await workspace().locator('.gw-inbox-empty').waitFor()
    await capture('12-inbox-mobile')
    await navigate(0)
    await workspace().locator('.gw-goal-card').waitFor()
    await capture('13-dashboard-mobile')
    return { tablet, phone }
  })

  await step('browser-errors-and-dormant-members', async () => {
    report.mockCallsAfter = mockCalls()
    assert.equal(report.mockCallsAfter, modelCallsBefore, 'No goal was submitted; members must remain dormant')
    assert.deepEqual(report.pageErrors, [], 'The browser reported an uncaught page error')
    assert.deepEqual(report.consoleErrors, [], 'The browser reported a console error; inspect evidence before accepting')
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = clean(error.stack || error)
  process.exitCode = 1
  console.error(`FAIL ${report.steps.at(-1)?.name ?? 'setup'}: ${clean(error.message)}`)
} finally {
  if (browser) await browser.close().catch(error => { report.closeError = clean(error.message) })
  report.finishedAt = new Date().toISOString()
  save()
  console.log(`Evidence: ${out}`)
  console.log(`Result: ${report.status}`)
}
