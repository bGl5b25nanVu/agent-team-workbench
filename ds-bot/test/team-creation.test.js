import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../index.js'
import { TEAM_ROLES, PRESET_VERSION } from '../src/shared/team-presets.js'
import { fakeContext } from './fake-ctx.js'
import { afterRound } from './relay-rows.js'

function setup(t, { saved, home = mkdtempSync(join(tmpdir(), 'gongzuo-team-')), permissions = true } = {}) {
  if (saved) writeFileSync(join(home, 'state.json'), JSON.stringify(saved))
  const requests = []
  const assignedPermissions = []
  const selections = []
  const createdSessions = []
  const archived = []
  const controls = {}
  const presets = ['read-only', 'workspace-write', 'danger-full-access']
  const services = permissions ? {
    permissionPresets: {
      catalog: () => ({ options: presets.map(value => ({ value, name: value })), defaultPreset: 'danger-full-access' }),
      resolve(name) { if (!presets.includes(name)) throw new Error(`Unknown permission ${name}`); return {} },
      set(session, name) {
        if (controls.failPermission) throw new Error('Could not apply permission')
        assignedPermissions.push([session.id, name])
      },
    },
  } : {}
  const ctx = fakeContext({ services })
  const workspaces = new Map()
  let sequence = 0
  Object.assign(ctx, {
    llm: {
      listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
      listModels: async () => controls.models ?? [{ id: 'test-model' }],
      resolveModelInfo: async () => ({}),
    },
    workspaceRegistry: {
      get: id => workspaces.get(id),
      resolveByPath: async path => [...workspaces.values()].find(workspace => workspace.path === path),
      create: async path => {
        const workspace = { id: `w${workspaces.size + 1}`, path }
        workspaces.set(workspace.id, workspace)
        return workspace
      },
      archiveSession: async id => { archived.push(id) },
    },
    sessionController: {
      create: async () => {
        if (controls.loseCreate) throw new Error('Session create connection lost')
        const sessionId = `test-${process.pid}-${Date.now()}-${++sequence}`
        createdSessions.push(sessionId)
        return { sessionId }
      },
      resolveAgent: async id => ({ agent: { ...ctx.scopeAgent(id), followup: message => requests.push({ id, message }) } }),
      selectModel: async selection => {
        if (controls.failSelectSession === selection.sessionId) throw new Error('Could not select the group model')
        selections.push(selection)
      },
      prompt: async request => { requests.push(request); return {} },
    },
    sessionTitle: { rename: async () => {} },
    sessions: { flush: async () => {} },
  })
  let channel
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = options => {
    if (options.path === '/api/bot') channel = options
    return register(options)
  }
  const rt = createRuntime(ctx, { home })
  const call = async (endpoint, payload = {}) => {
    const response = await channel.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))
    return response.json()
  }
  const close = () => ctx.dispose()
  t.after(async () => { await close(); rmSync(home, { recursive: true, force: true, maxRetries: 5 }) })
  return { rt, ctx, call, close, home, requests, assignedPermissions, createdSessions, archived, controls, selections }
}

const input = (operationId = 'team-test-0001') => ({
  operationId, name: 'My delivery team', blueprint: 'software',
  members: TEAM_ROLES.map(role => ({ presetId: role.id, name: `Team ${role.name}`, model: 'deepseek/test-model' })),
})
const pause = () => new Promise(resolve => setTimeout(resolve, 30))

test('create-team saves six dormant identities and an admin group without issuing a model turn', async t => {
  const { rt, call, requests, assignedPermissions, createdSessions } = setup(t)
  const response = await call('create-team', input())
  assert.equal(response.ok, true, JSON.stringify(response))
  const record = response.value
  assert.equal(record.status, 'complete')
  assert.equal(createdSessions.length, 7)
  assert.equal(Object.keys(rt.state.bots).length, 6)
  assert.deepEqual(rt.state.mainBotIds, [])
  const room = rt.roomOf(record.roomId)
  assert.equal(room.mode, 'admin')
  assert.equal(room.admin, record.members.find(member => member.presetId === 'coordinator').botId)
  assert.equal(room.permission, undefined)
  assert.equal(room.team.operationId, input().operationId)
  assert.equal(room.team.members.length, 6)
  for (const member of record.members) {
    const bot = rt.botOf(member.botId)
    assert.equal(bot.dormant, true)
    assert.equal(bot.kickoff, undefined)
    assert.equal(bot.presetId, member.presetId)
    assert.equal(bot.presetVersion, PRESET_VERSION)
    assert.ok(bot.instructions.length > 1000)
    assert.equal(bot.permission, member.presetId === 'researcher' ? 'read-only' : 'workspace-write')
  }
  assert.equal(assignedPermissions.length, 6)
  await pause()
  assert.equal(requests.length, 0)
})

test('repeated and concurrent requests share IDs while changed payloads conflict', async t => {
  const { rt, call, createdSessions } = setup(t)
  const [one, two] = await Promise.all([call('create-team', input()), call('create-team', input())])
  assert.equal(one.ok, true, JSON.stringify(one))
  assert.deepEqual(one.value, two.value)
  assert.equal(createdSessions.length, 7)
  const replay = await call('create-team', input())
  assert.equal(replay.value.roomId, one.value.roomId)
  const changed = await call('create-team', { ...input(), name: 'Different team' })
  assert.equal(changed.ok, false)
  assert.equal(changed.error.code, 'bot/conflict')
  assert.equal(Object.keys(rt.state.rooms).length, 1)
  assert.equal(createdSessions.length, 7)
})

test('every configuration is validated before the first entity is created', async t => {
  const { rt, call, createdSessions } = setup(t)
  const cases = [
    request => { request.members[5].model = 'unknown/model' },
    request => { request.members[5].permission = 'unknown-permission' },
    request => { request.members[5].name = request.members[0].name },
    request => { request.members[5].name = 'a@b' },
    request => { request.members[5].creativity = 'unbounded' },
    request => { request.members[5].avatar = { image: 'not-an-image' } },
    request => { request.members[5].workDir = '/this-folder-does-not-exist-gongzuo' },
    request => { request.members.shift() },
  ]
  for (let index = 0; index < cases.length; index += 1) {
    const request = input(`validation-${index}`)
    cases[index](request)
    const response = await call('create-team', request)
    assert.equal(response.ok, false, `case ${index}: ${JSON.stringify(response)}`)
    assert.equal(createdSessions.length, 0)
    assert.equal(Object.keys(rt.state.bots).length, 0)
    assert.equal(rt.state.sections.length, 0)
  }
  assert.equal((await call('team-creation-status', { operationId: 'never-created-operation' })).value, null)
})

test('a known fourth-member failure preserves three members and resumes only unfinished work', async t => {
  const { rt, call, createdSessions, archived } = setup(t)
  const createBot = rt.createBot
  let attempted = 0
  rt.createBot = options => {
    if (++attempted === 4) throw new Error('Synthetic precreation failure')
    return createBot(options)
  }
  const failed = (await call('create-team', input())).value
  assert.equal(failed.status, 'failed')
  assert.equal(failed.canResume, true)
  const kept = failed.members.slice(0, 3).map(member => member.botId)
  assert.equal(createdSessions.length, 3)
  assert.equal(failed.members[3].status, 'failed')
  const repeated = (await call('create-team', input())).value
  assert.equal(repeated.status, 'failed')
  assert.equal(createdSessions.length, 3)
  rt.createBot = createBot
  const complete = (await call('resume-team-creation', { operationId: input().operationId })).value
  assert.equal(complete.status, 'complete', JSON.stringify(complete))
  assert.deepEqual(complete.members.slice(0, 3).map(member => member.botId), kept)
  assert.equal(createdSessions.length, 7)
  assert.deepEqual(archived, [])
})

test('a group failure preserves all members and safely resumes the group alone', async t => {
  const { rt, call, createdSessions } = setup(t)
  const createRoom = rt.createRoom
  rt.createRoom = () => { throw new Error('Synthetic group precreation failure') }
  const failed = (await call('create-team', input())).value
  assert.equal(failed.status, 'failed')
  const kept = failed.members.map(member => member.botId)
  assert.equal(createdSessions.length, 6)
  rt.createRoom = createRoom
  const complete = (await call('resume-team-creation', { operationId: input().operationId })).value
  assert.equal(complete.status, 'complete', JSON.stringify(complete))
  assert.deepEqual(complete.members.map(member => member.botId), kept)
  assert.equal(createdSessions.length, 7)
})

test('an unknown Session creation outcome stops retries and preserves the operation', async t => {
  const { call, controls, createdSessions } = setup(t)
  controls.loseCreate = true
  const failed = (await call('create-team', input())).value
  assert.equal(failed.status, 'uncertain')
  assert.equal(failed.canResume, false)
  controls.loseCreate = false
  const resumed = (await call('resume-team-creation', { operationId: input().operationId })).value
  assert.equal(resumed.status, 'uncertain')
  assert.equal(createdSessions.length, 0)
  assert.equal((await call('team-creation-status', { operationId: input().operationId })).value.status, 'uncertain')
})

test('permission application failures retain a dormant member and retry configuration without duplication', async t => {
  const { rt, call, controls, createdSessions, archived } = setup(t)
  controls.failPermission = true
  const failed = (await call('create-team', input())).value
  assert.equal(failed.status, 'failed', JSON.stringify(failed))
  const botId = failed.members[0].botId
  assert.ok(botId)
  assert.equal(rt.botOf(botId).creationIncomplete, true)
  await assert.rejects(rt.activateTeamBot(botId), /Finish creating/)
  assert.equal(createdSessions.length, 1)
  controls.failPermission = false
  const complete = (await call('resume-team-creation', { operationId: input().operationId })).value
  assert.equal(complete.status, 'complete', JSON.stringify(complete))
  assert.equal(complete.members[0].botId, botId)
  assert.equal(rt.botOf(botId).creationIncomplete, undefined)
  assert.equal(createdSessions.length, 7)
  assert.deepEqual(archived, [])
})

test('editing profiles and adding models do not wake dormant members; actual work wakes only its recipient', async t => {
  const { rt, ctx, call, requests } = setup(t)
  const request = input()
  request.members = request.members.map(member => ({ ...member, model: null }))
  const record = (await call('create-team', request)).value
  const recipient = record.members[0].botId
  const other = record.members[1].botId
  assert.equal((await call('update-bot', { id: recipient, instructions: 'Updated instructions', role: 'Updated role', model: 'deepseek/test-model' })).ok, true)
  await rt.releaseKickoff(rt.botOf(recipient))
  await pause()
  assert.equal(requests.length, 0)
  assert.equal(rt.botOf(recipient).dormant, true)
  await ctx.sessionController.prompt({ sessionId: recipient, content: [{ type: 'text', text: 'Start this task' }] })
  assert.equal(rt.botOf(recipient).dormant, undefined)
  assert.equal(rt.botOf(other).dormant, true)
  assert.equal(requests.length, 1)
  assert.equal((await call('update-bot', { id: other, model: 'deepseek/test-model' })).ok, true)
  await rt.deliver({ toId: other, fromId: recipient, text: 'Research this detail', role: 'request' })
  assert.equal(rt.botOf(other).dormant, undefined)
  assert.equal(requests.length, 2)
})

test('a saved interrupted create reconciles the durable member instead of creating it twice', async t => {
  const first = setup(t)
  const createBot = first.rt.createBot
  let attempted = 0
  first.rt.createBot = options => {
    if (++attempted === 2) throw new Error('Pause after the first member')
    return createBot(options)
  }
  const failed = (await first.call('create-team', input())).value
  const saved = JSON.parse(readFileSync(join(first.home, 'state.json'), 'utf8'))
  const record = saved.teamCreations[input().operationId]
  record.status = 'working'
  record.members[0].status = 'creating'
  delete record.members[0].botId
  await first.close()
  const second = setup(t, { saved })
  const recovered = (await second.call('team-creation-status', { operationId: input().operationId })).value
  assert.equal(recovered.status, 'failed')
  assert.equal(recovered.members[0].botId, failed.members[0].botId)
  const complete = (await second.call('resume-team-creation', { operationId: input().operationId })).value
  assert.equal(complete.status, 'complete', JSON.stringify(complete))
  assert.equal(complete.members[0].botId, failed.members[0].botId)
  assert.equal(second.createdSessions.length, 6)
  assert.equal(second.requests.length, 0)
})

test('reuse preserves the existing identity and configuration and rejects private or duplicate members', async t => {
  const { rt, call, createdSessions } = setup(t)
  await rt.load()
  const existing = await rt.createBot({ name: 'Existing coordinator', role: 'Custom', instructions: 'Keep this exact text', avatar: { shape: 'cat' }, pickModel: true, deferKickoff: true })
  const before = structuredClone(existing)
  const request = input()
  request.members[0] = { presetId: 'coordinator', botId: existing.id }
  const complete = (await call('create-team', request)).value
  assert.equal(complete.status, 'complete')
  assert.equal(complete.members[0].botId, existing.id)
  assert.deepEqual(rt.botOf(existing.id), before)
  assert.equal(createdSessions.length, 7)
  const privateRequest = input('private-member-case')
  privateRequest.name = 'Private test'
  privateRequest.members[0] = { presetId: 'coordinator', botId: existing.id }
  rt.botOf(existing.id).private = true
  assert.equal((await call('create-team', privateRequest)).ok, false)
  delete rt.botOf(existing.id).private
  privateRequest.members[1] = { presetId: 'researcher', botId: existing.id }
  assert.equal((await call('create-team', privateRequest)).ok, false)
  assert.equal(createdSessions.length, 7)
})

test('the first goal calls only the coordinator; other team members stay dormant', async t => {
  const { rt, ctx, call, requests } = setup(t)
  const record = (await call('create-team', input())).value
  const room = rt.roomOf(record.roomId)
  const goal = await call('goal-draft', { roomId: room.id, text: 'Prepare a delivery plan' })
  assert.equal(goal.ok, true, JSON.stringify(goal))
  const queued = requests.find(request => request.id === room.id)?.message
  assert.equal(queued?.source.role, 'goal')
  let sequence = 0
  const emit = (id, type, data) => {
    for (const listener of ctx.listeners.get('session/event') ?? []) {
      if (listener.length >= 2) listener({ id }, { type, seq: ++sequence, data })
    }
  }
  emit(room.id, 'user/message', { content: queued.content, source: queued.source })
  const abort = new AbortController()
  t.after(() => abort.abort())
  const relay = ctx.registeredTools.get('group_relay')
  const finished = Promise.resolve(relay.execute({}, { agent: { id: room.id }, callId: 'first-team-goal', signal: abort.signal }))
    .then(value => afterRound(rt, room.id, value))
  const until = Date.now() + 3000
  while (!requests.some(request => request.message?.source?.role === 'room') && Date.now() < until) await pause()
  const called = requests.filter(request => request.message?.source?.role === 'room')
  assert.equal(called.length, 1)
  const admin = rt.botOf(room.admin)
  assert.equal(rt.groupOwners.get(called[0].id)?.botId, admin.id)
  assert.equal(admin.dormant, undefined)
  assert.ok(room.members.filter(id => id !== admin.id).every(id => rt.botOf(id).dormant === true))
  emit(called[0].id, 'turn/start', { turn: 1 })
  emit(called[0].id, 'user/message', { content: called[0].message.content, source: called[0].message.source })
  emit(called[0].id, 'assistant/message', { message: { content: [{ type: 'text', text: 'Delivery plan prepared.' }] } })
  emit(called[0].id, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  await finished
})

test('state can bootstrap a separate Main after an API-created team already uses the default coordinator name', async t => {
  const { call, requests } = setup(t)
  const request = input()
  request.members = request.members.map(({ presetId, model }) => ({ presetId, model }))
  const created = await call('create-team', request)
  assert.equal(created.ok, true, JSON.stringify(created))
  const state = await call('state')
  assert.equal(state.ok, true, JSON.stringify(state))
  const adminId = created.value.members.find(member => member.presetId === 'coordinator').botId
  assert.ok(!state.value.mainBotIds.includes(adminId))
  assert.equal(state.value.bots.find(bot => bot.id === state.value.mainBotId).name, 'Coordinator 2')
  assert.equal(state.value.rooms.length, 1)
  assert.equal(requests.length, 0)
})

test('missing permission enforcement refuses a new team before creating any entity', async t => {
  const { call, createdSessions, rt } = setup(t, { permissions: false })
  const response = await call('create-team', input())
  assert.equal(response.ok, false)
  assert.match(response.error.message, /permission presets/)
  assert.equal(createdSessions.length, 0)
  assert.equal(rt.state.sections.length, 0)
})

test('a coordinator removed during group Session creation is retained as an uncertain receipt instead of a misled team', async t => {
  const { rt, call, ctx, createdSessions, archived } = setup(t)
  const create = ctx.sessionController.create
  ctx.sessionController.create = async (...args) => {
    const result = await create(...args)
    if (createdSessions.length === 7) {
      const coordinator = Object.values(rt.state.bots).find(bot => bot.presetId === 'coordinator')
      delete rt.state.bots[coordinator.id]
    }
    return result
  }
  const response = await call('create-team', input())
  assert.equal(response.ok, true)
  assert.equal(response.value.status, 'uncertain')
  assert.equal(response.value.canResume, false)
  assert.equal(response.value.uncertainSessionId, createdSessions[6])
  assert.equal(Object.keys(rt.state.rooms).length, 0)
  assert.deepEqual(archived, [])
})

test('a failure after Session creation retains its known receipt for reconciliation', async t => {
  const { call, ctx, createdSessions, archived } = setup(t)
  ctx.sessionTitle.rename = async () => { throw new Error('Rename failed after create') }
  const response = await call('create-team', input())
  assert.equal(response.ok, true)
  assert.equal(response.value.status, 'uncertain')
  assert.equal(response.value.uncertainSessionId, createdSessions[0])
  assert.equal(response.value.canResume, false)
  assert.deepEqual(archived, [])
})

test('a team member whose requested folder disappears does not silently run in the team workspace', async t => {
  const { rt, call, createdSessions } = setup(t)
  const folder = mkdtempSync(join(tmpdir(), 'gongzuo-work-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const request = input()
  request.members[0].workDir = folder
  const createBot = rt.createBot
  rt.createBot = options => {
    rt.isFolder = async () => false
    return createBot(options)
  }
  const response = await call('create-team', request)
  assert.equal(response.ok, true)
  assert.equal(response.value.status, 'failed')
  assert.equal(response.value.canResume, true)
  assert.match(response.value.error, /working folder is no longer available/)
  assert.equal(createdSessions.length, 0)
  assert.equal(Object.keys(rt.state.bots).length, 0)
})

test('first activation applies the selected model and unconfigured members cannot inherit an unrelated default', async t => {
  const { rt, ctx, call, selections, requests } = setup(t)
  const request = input()
  request.members[1].model = null
  const created = (await call('create-team', request)).value
  const coordinator = created.members[0].botId
  const unconfigured = created.members[1].botId
  await assert.rejects(ctx.sessionController.prompt({ sessionId: unconfigured, content: [] }), /Choose a model/)
  assert.equal(rt.botOf(unconfigured).dormant, true)
  assert.equal(requests.length, 0)
  await ctx.sessionController.prompt({ sessionId: coordinator, content: [{ type: 'text', text: 'Start' }] })
  assert.ok(selections.some(selection => selection.sessionId === coordinator && selection.provider === 'deepseek' && selection.model === 'test-model'))
  assert.equal(requests.length, 1)
  assert.equal(rt.botOf(coordinator).dormant, undefined)
})

test('a removed model cannot silently activate a team member on another route', async t => {
  const { rt, ctx, call, controls, requests, selections } = setup(t)
  const created = (await call('create-team', input())).value
  const bot = rt.botOf(created.members[0].botId)
  const before = selections.length // The group's relay Session already has its own model.
  controls.models = [{ id: 'unrelated-default' }]
  await assert.rejects(ctx.sessionController.prompt({ sessionId: bot.id, content: [] }), /not available/)
  assert.equal(bot.dormant, true)
  assert.equal(requests.length, 0)
  assert.equal(selections.length, before)
})

test('a failed group model selection blocks activation and retries that same Session', async t => {
  const { rt, call, controls, requests } = setup(t)
  const created = (await call('create-team', input())).value
  const bot = rt.botOf(created.members[0].botId)
  const room = rt.roomOf(created.roomId)
  const sessionId = 'first-group-model'
  room.sessions = { [bot.id]: sessionId }
  rt.groupOwners.set(sessionId, { botId: bot.id, roomId: room.id })
  const message = { toId: bot.id, sessionId, roomId: room.id, role: 'room', text: 'Start the goal' }
  controls.failSelectSession = sessionId
  await assert.rejects(rt.deliver(message), /Could not select the group model/)
  assert.equal(bot.dormant, true)
  assert.equal(requests.length, 0)
  delete controls.failSelectSession
  await rt.deliver(message)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].id, sessionId)
  assert.equal(bot.dormant, undefined)
})

test('new group work cannot run with failed inherited permissions after the member is active', async t => {
  const { rt, ctx, call, controls, requests } = setup(t)
  const created = (await call('create-team', input())).value
  const bot = rt.botOf(created.members[0].botId)
  await ctx.sessionController.prompt({ sessionId: bot.id, content: [] })
  assert.equal(bot.dormant, undefined)
  const room = rt.roomOf(created.roomId)
  const sessionId = 'later-group-permission'
  room.sessions = { [bot.id]: sessionId }
  rt.groupOwners.set(sessionId, { botId: bot.id, roomId: room.id })
  const message = { toId: bot.id, sessionId, roomId: room.id, role: 'room', text: 'Start group work' }
  controls.failPermission = true
  await assert.rejects(rt.deliver(message), /Could not apply permission/)
  assert.equal(requests.length, 1)
  delete controls.failPermission
  await rt.deliver(message)
  assert.equal(requests.length, 2)
  assert.equal(requests[1].id, sessionId)
})
