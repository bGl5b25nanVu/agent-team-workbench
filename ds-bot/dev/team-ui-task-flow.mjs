// Continue a real team-ui-flow.mjs run through first-goal dispatch and inbox answers.
// Run: CHROME_BIN=/path/to/chrome node dev/team-ui-task-flow.mjs /path/to/flow/result.json
// Uses the existing isolated bench. All actions go through the UI; disk reads only
// observe the test runtime's persisted state and scripted model receipts.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'
import { teamCallCounts, teamCallOwner } from './team-ui-evidence.mjs'

const [sourceArg, benchArg, portArg] = process.argv.slice(2)
assert.ok(sourceArg, 'Pass the result.json from the previous team UI flow')
const sourceFile = resolve(sourceArg)
const source = JSON.parse(readFileSync(sourceFile, 'utf8'))
const bench = benchArg || source.bench
const sourceOrigin = new URL(source.origin)
const port = portArg || sourceOrigin.port
assert.equal(sourceOrigin.hostname, '127.0.0.1', 'Only the local isolated test runtime is supported')
assert.match(bench, /^[a-z0-9-]+$/)
assert.match(port, /^\d+$/)
assert.ok(Number(port) >= 1024 && Number(port) <= 65535 && port !== '3080')
assert.ok(typeof source.teamName === 'string' && source.teamName.length <= 32)
assert.ok(Array.isArray(source.memberNames) && source.memberNames.length === 6)
assert.ok(source.steps?.some(step => step.name === 'create-team-through-ui' && step.status === 'passed'), 'The earlier UI flow must have actually created its team')
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const home = join(root, `.dsh-test-${bench}`)
const out = resolve(process.env.GONGZUO_TASK_UI_OUTPUT || join(root, 'docs/design/verification', `task-${Date.now().toString(36)}`))
mkdirSync(out, { recursive: true })
const questionText = '接下来先做哪个？'
const selectedAnswer = '改标题'
const goalBrief = `GONGZUO_TASK_UI ${source.teamName}: Prepare an implementation plan with acceptance checks. Do not delegate until the scope is clear.`
const report = {
  status: 'running', startedAt: new Date().toISOString(), previousFlow: sourceFile,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  teamName: source.teamName, coordinatorName: source.memberNames[0], bench, origin: `http://127.0.0.1:${port}`,
  browser: process.env.CHROME_BIN || '/usr/bin/chromium', steps: [], screenshots: [], pageErrors: [], consoleErrors: [],
  coverage: {
    goalSubmission: 'not-run', coordinatorOnlyDispatch: 'not-run', questionCreation: 'not-run', inboxNavigation: 'not-run', questionAnswer: 'not-run',
    goalPlanningAndStages: 'not-covered: the existing mock does not call group_goal to plan or progress stages',
    permissionApproval: 'not-covered: the existing escalation fixture asks for full-access shell execution; this test does not expand permissions',
    realProviderQuality: 'not-covered: scripted mock model only',
  },
}
const clean = value => String(value).replace(/([?&]token=)[^\s"'<>]+/g, '$1[redacted]')
const save = () => writeFileSync(join(out, 'result.json'), JSON.stringify(report, null, 2))
const readState = () => JSON.parse(readFileSync(join(home, 'bot/state.json'), 'utf8'))
const roomIn = state => Object.values(state.rooms).find(room => room.name === source.teamName)
const coordinatorIn = state => Object.values(state.bots).find(bot => bot.name === source.memberNames[0])
const privateSession = bot => bot.sessionId || bot.id
const readCalls = () => {
  const path = join(home, 'mock.jsonl')
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  return text.slice(0, text.lastIndexOf('\n') + 1).split('\n').filter(Boolean).map(line => JSON.parse(line))
}
let browser
let page
let baselineCalls
let goalCallOffset
let questionCallOffset

async function until(label, condition, timeout = 60000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await condition()
    if (result) return result
    await delay(200)
  }
  throw new Error(`Timed out waiting for ${label}`)
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
      try { writeFileSync(join(out, `failed-${name}-visible.txt`), clean((await page.locator('body').innerText()).slice(0, 16000))) } catch {}
    }
    throw error
  } finally {
    entry.durationMs = Date.now() - started
    save()
  }
}

const workspace = () => page.locator('.gw-workspace:not([data-leaving])')
const pendingCard = () => page.locator('form.bt-q:visible').filter({ has: page.locator('.bt-q-title').filter({ hasText: questionText }) })
const questionFor = state => state.questions?.[privateSession(coordinatorIn(state))]
const inboxItem = () => workspace().locator('.gw-inbox-item').filter({
  has: page.getByRole('heading', { name: questionText, exact: true }),
}).filter({ has: page.locator('.gw-inbox-owner strong').filter({ hasText: source.memberNames[0] }) })

async function navigate(index) {
  await page.locator('.gw-nav').first().getByRole('button').nth(index).click()
  if (index !== 3) await workspace().waitFor()
}

async function openTeam() {
  await navigate(1)
  const card = workspace().locator('.gw-team-card').filter({ has: page.getByRole('heading', { name: source.teamName, exact: true }) })
  await card.waitFor()
  assert.equal(await card.count(), 1, 'The prior flow must identify exactly one saved team')
  await card.click()
  await workspace().locator('.gw-goal-card').waitFor()
  assert.equal(await workspace().locator('.gw-room-switch select option:checked').innerText(), source.teamName)
}

function dormantMembers(state) {
  const room = roomIn(state)
  return room.members.map(id => ({ name: state.bots[id]?.name, dormant: state.bots[id]?.dormant === true }))
}

function callEvidence(calls, state) {
  const room = roomIn(state)
  const coordinator = coordinatorIn(state)
  return calls.map(call => ({
    at: call.t, tokens: call.tokens,
    owner: teamCallOwner(call, { room, coordinator, bots: state.bots }),
    tools: (call.out || []).filter(block => block.type === 'tool_use').map(block => block.name),
  }))
}

async function settleCoordinator() {
  let count = readCalls().length
  let quietSince = Date.now()
  await until('coordinator to finish its current mock turn', async () => {
    const now = readCalls().length
    const coordinator = coordinatorIn(readState())
    const row = page.locator(`.bt-side button[data-bot-id="${coordinator.id}"]`)
    const label = await row.getAttribute('aria-label') || ''
    if (now !== count || /(?:^|, )(Working|进行中|進行中)(?:,|$)/.test(label)) {
      count = now
      quietSince = Date.now()
      return false
    }
    // Automatic memory review is scheduled two seconds after a turn. Observe it
    // as its own request instead of finishing just before its timer can fire.
    return Date.now() - quietSince >= 2800
  })
}

try {
  await step('validate-existing-isolated-team', async () => {
    assert.ok(existsSync(join(home, 'mock.pid')), 'Start the same isolated mock bench used by the previous UI flow')
    const state = readState()
    const rooms = Object.values(state.rooms).filter(room => room.name === source.teamName)
    assert.equal(rooms.length, 1)
    const room = rooms[0]
    const coordinator = coordinatorIn(state)
    assert.ok(coordinator && room.admin === coordinator.id, 'The saved coordinator must own this team')
    assert.equal(room.members.length, 6)
    assert.deepEqual(room.members.map(id => state.bots[id]?.name), source.memberNames)
    assert.ok(room.members.every(id => /deepseek.*flash|flash/i.test(state.bots[id]?.model || '')), 'This task only uses the mock-backed routes selected by the earlier UI flow')
    if (room.goal) assert.equal(room.goal.brief, goalBrief, 'A different goal already exists; do not overwrite it')
    else assert.ok(dormantMembers(state).every(member => member.dormant), 'A first-goal check needs the previously dormant team')
    assert.ok(room.members.filter(id => id !== coordinator.id).every(id => state.bots[id].dormant === true), 'Uncalled members must still be dormant')
    report.goalAlreadySubmitted = Boolean(room.goal)
    baselineCalls = readCalls().length
    return { existingGoal: Boolean(room.goal), members: dormantMembers(state) }
  })

  await step('authenticate-and-open-created-team', async () => {
    const login = readFileSync(join(home, 'web.log'), 'utf8').match(new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=[^\\s]+`))?.[0]
    assert.ok(login, 'No local test-profile login URL found')
    browser = await chromium.launch({ executablePath: report.browser, headless: true })
    const context = await browser.newContext({ viewport: { width: 1487, height: 1058 }, deviceScaleFactor: 1, locale: 'zh-CN', colorScheme: 'light', reducedMotion: 'reduce' })
    page = await context.newPage()
    page.setDefaultTimeout(20000)
    page.on('pageerror', error => report.pageErrors.push(clean(error.message)))
    page.on('console', entry => { if (entry.type() === 'error') report.consoleErrors.push(clean(entry.text())) })
    const notice = page.getByRole('dialog').getByRole('button', { name: /^(Continue|继续|繼續)$/ })
    await page.addLocatorHandler(notice, () => notice.click())
    await page.goto(login)
    await page.locator('.bt-side').waitFor({ timeout: 60000 })
    await openTeam()
    await capture('01-existing-team')
  })

  await step('submit-first-goal-through-ui', async () => {
    goalCallOffset = readCalls().length
    if (report.goalAlreadySubmitted) {
      report.coverage.goalSubmission = 'previously-submitted: matching test goal preserved; no duplicate submission'
      return { submittedThisRun: false }
    }
    await workspace().locator('.gw-goal-actions > .gw-primary').click()
    await page.locator('.bt-goal-compose').waitFor()
    await page.locator('#bt-goal-brief').fill(goalBrief)
    await capture('02-first-goal-compose')
    await page.locator('.bt-goal-cbtns .bt-send').click()
    await page.locator('.bt-island[data-goal="drafting"]').waitFor({ timeout: 60000 })
    report.coverage.goalSubmission = 'passed'
    return { submittedThisRun: true }
  })

  await step('only-coordinator-starts-for-first-goal', async () => {
    await until('the coordinator group Session model receipt', () => {
      const state = readState()
      const sessionId = roomIn(state).sessions?.[coordinatorIn(state).id]
      const calls = report.goalAlreadySubmitted ? readCalls() : readCalls().slice(goalCallOffset)
      return sessionId && calls.some(call => call.session === sessionId)
    })
    await settleCoordinator()
    const state = readState()
    const room = roomIn(state)
    const coordinator = coordinatorIn(state)
    assert.equal(room.goal.brief, goalBrief)
    assert.equal(room.goal.status, 'drafting', 'The scripted mock does not plan or advance goal stages')
    assert.notEqual(state.bots[coordinator.id].dormant, true)
    assert.ok(room.members.filter(id => id !== coordinator.id).every(id => state.bots[id].dormant === true), 'The goal woke an uncalled member')
    assert.deepEqual(Object.keys(room.sessions || {}), [coordinator.id], 'Only the coordinator should have a group execution Session')
    const calls = report.goalAlreadySubmitted
      ? readCalls().filter(call => call.session === room.sessions[coordinator.id])
      : readCalls().slice(goalCallOffset)
    const evidence = callEvidence(calls, state)
    assert.ok(evidence.some(call => call.owner === 'coordinator-group')
      && evidence.every(call => ['coordinator-group', 'group-memory-review'].includes(call.owner)), 'A first goal called an unrelated model Session or an unverified group-memory request')
    report.coverage.coordinatorOnlyDispatch = 'passed'
    report.firstGoalEvidence = { calls: evidence, counts: teamCallCounts(evidence), members: dormantMembers(state), goalStatus: room.goal.status }
    await openTeam()
    await workspace().locator('.gw-goal-card [data-state="drafting"]').waitFor()
    await capture('03-goal-drafting-dashboard')
    return report.firstGoalEvidence
  })

  await step('ask-a-real-question-in-coordinator-chat', async () => {
    const state = readState()
    const coordinator = coordinatorIn(state)
    await page.locator(`.bt-side button[data-bot-id="${coordinator.id}"]`).click()
    await workspace().waitFor({ state: 'detached' })
    questionCallOffset = readCalls().length
    const existingQuestion = questionFor(readState())
    if (existingQuestion) assert.equal(existingQuestion.question, questionText, 'Do not replace an unrelated pending question')
    else {
      const composer = page.locator('[role="textbox"][contenteditable="true"]:visible').last()
      await composer.fill('卡片 0')
      await composer.press('Enter')
    }
    await until('the real ask_user question to be saved', () => questionFor(readState())?.question === questionText)
    await pendingCard().first().waitFor()
    await settleCoordinator()
    const calls = existingQuestion ? readCalls().filter(call => call.session === privateSession(coordinator)) : readCalls().slice(questionCallOffset)
    assert.ok(calls.some(call => (call.out || []).some(block => block.type === 'tool_use' && block.name === 'ask_user')), 'The question must come from a real mock tool invocation')
    assert.ok(calls.every(call => call.session === privateSession(coordinator)), 'Question creation should only call the coordinator private Session')
    report.coverage.questionCreation = existingQuestion ? 'previously-created: pending question reused' : 'passed'
    await capture('04-real-question-card')
  })

  await step('inbox-opens-the-question-conversation', async () => {
    await navigate(2)
    await inboxItem().waitFor()
    assert.equal(await inboxItem().count(), 1)
    await capture('05-question-inbox')
    // A hidden question card must not consume an option shortcut from the workspace.
    await page.keyboard.press('a')
    await capture('06-inbox-keeps-question-pending')
    assert.equal(questionFor(readState())?.question, questionText)
    await inboxItem().getByRole('button', { name: /^(Open conversation|打开对话|打開對話)$/ }).click()
    await workspace().waitFor({ state: 'detached' })
    await pendingCard().first().waitFor()
    const coordinator = coordinatorIn(readState())
    assert.equal(await page.locator(`.bt-side button[data-bot-id="${coordinator.id}"]`).getAttribute('aria-current'), 'page')
    report.coverage.inboxNavigation = 'passed'
    await capture('07-question-opened-from-inbox')
  })

  await step('answer-question-and-clear-inbox', async () => {
    const before = readCalls().length
    const question = questionFor(readState())
    assert.ok(question?.id && question.callId, 'The actual pending question must have an ID and tool call receipt')
    await pendingCard().first().getByRole('button', { name: selectedAnswer, exact: true }).click()
    await until('the answered question to leave the pending state', () => !questionFor(readState()))
    await until('the coordinator to receive the selected answer', () => readCalls().length > before)
    await settleCoordinator()
    await page.locator('.bt-q-answered').filter({ hasText: selectedAnswer }).first().waitFor()
    const state = readState()
    const coordinator = coordinatorIn(state)
    const calls = readCalls().slice(before)
    assert.ok(calls.length > 0 && calls.every(call => call.session === privateSession(coordinator)), 'Answering should only call the owning coordinator Session')
    const receipt = calls.find(call => call.questionReply?.callId === question.callId
      && call.questionReply.answers?.some(answer => answer.id === question.id))
    assert.ok(receipt, 'The mock must log the actual structured question reply; restart the bench with the updated mock fixture')
    const answer = receipt.questionReply.answers.find(item => item.id === question.id)
    assert.equal(answer.question, questionText)
    assert.deepEqual(answer.selected, [selectedAnswer], 'The model request received a different selected answer')
    assert.equal(answer.customPresent, false)
    assert.ok((receipt.out || []).some(block => block.type === 'text' && block.text === `好，就从「${selectedAnswer}」开始。`), 'The mock acknowledged a different option than the structured answer')
    report.answerEvidence = {
      questionId: question.id, callId: question.callId, selectedAnswer,
      receivedAnswer: answer, calls: callEvidence(calls, state),
    }
    await capture('08-answered-question')
    await navigate(2)
    await inboxItem().waitFor({ state: 'detached' })
    await capture('09-inbox-after-answer')
    report.coverage.questionAnswer = 'passed'
  })

  await step('verify-remaining-members-and-browser-errors', async () => {
    const state = readState()
    const room = roomIn(state)
    const coordinator = coordinatorIn(state)
    assert.ok(room.members.filter(id => id !== coordinator.id).every(id => state.bots[id].dormant === true), 'An uncalled member started during the task flow')
    report.newCalls = callEvidence(readCalls().slice(baselineCalls), state)
    report.callCounts = teamCallCounts(report.newCalls)
    assert.ok(report.newCalls.every(call => call.owner !== 'unexpected-session'), 'An unexpected Session made a model request')
    assert.deepEqual(report.pageErrors, [], 'The browser reported an uncaught page error')
    assert.deepEqual(report.consoleErrors, [], 'The browser reported a console error; inspect the evidence before accepting')
    return { members: dormantMembers(state), modelCallsThisRun: report.newCalls.length }
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = clean(error.stack || error)
  process.exitCode = 1
  console.error(`FAIL ${report.steps.at(-1)?.name || 'setup'}: ${clean(error.message)}`)
} finally {
  if (browser) await browser.close().catch(error => { report.closeError = clean(error.message) })
  report.finishedAt = new Date().toISOString()
  save()
  console.log(`Evidence: ${out}`)
  console.log(`Result: ${report.status}`)
}
