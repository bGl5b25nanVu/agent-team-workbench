import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGongzuoCatalog, projectGongzuoTeams } from '../src/host/gongzuo-catalog.js'

const ENV = { GONGZUO_SOURCE_INSTANCE_ID: 'gongzuo-hybrid-test-0001', GONGZUO_FORK_SOURCE_SHA: 'a'.repeat(40) }
const REQUEST = { protocol: 'gongzuo-catalog', version: 1 }
const granted = () => ({ ready: true, canDispatchWorkflows: true, readOnlyReason: null })
function fixture() {
  return {
    revision: 7,
    bots: {
      'bot-admin': { id: 'bot-admin', name: 'Coordinator', instructions: 'private instruction', model: 'private-route' },
      'bot-engineer': { id: 'bot-engineer', name: 'Engineer', avatar: { image: 'private-avatar' } },
    },
    rooms: {
      'room-1': {
        id: 'room-1', sessionId: 'current-part-99', name: 'Native team',
        members: ['bot-admin', 'bot-engineer'], admin: 'bot-admin',
        team: { blueprint: 'software', operationId: 'creation-1', members: [{ presetId: 'coordinator', botId: 'bot-admin' }] },
        goal: { id: 'goal-1', title: 'Test goal', status: 'active', revision: 2, stages: [
          { id: 's1', acceptance: 'private acceptance', tasks: [{ id: 't1', botId: 'bot-engineer', task: 'Run checks', status: 'working', note: 'private note' }] },
        ], events: ['private event'] },
        tasks: { t_ab12: { id: 't_ab12', botId: 'bot-engineer', goal: 'Standalone room task', status: 'active', notes: ['private note'] } },
        log: ['private transcript'], notice: 'private notice',
      },
    },
    secrets: { key: 'not-a-real-secret' }, questions: { private: 'question' },
  }
}

test('native room identity, current membership and both task namespaces survive a minimal detached projection', () => {
  const state = fixture()
  const original = structuredClone(state)
  const reply = createGongzuoCatalog({ state, hasLoaded: () => true, observeCatalogAccess: granted }, ENV)(REQUEST)
  assert.deepEqual(reply, { ok: true, value: {
    protocol: 'gongzuo-catalog', version: 1, source: 'gongzuo-fork', sourceInstanceId: ENV.GONGZUO_SOURCE_INSTANCE_ID,
    sourceCommit: ENV.GONGZUO_FORK_SOURCE_SHA, revision: 7, readOnlyReason: null, canDispatchWorkflows: true,
    teams: [{ teamId: 'room-1', roomId: 'room-1', name: 'Native team', blueprint: 'software',
      memberIds: ['bot-admin', 'bot-engineer'], adminId: 'bot-admin',
      goal: { id: 'goal-1', title: 'Test goal', status: 'active', revision: 2, stages: [
        { id: 's1', tasks: [{ id: 't1', botId: 'bot-engineer', title: 'Run checks', status: 'working' }] },
      ] },
      roomTasks: [{ id: 't_ab12', botId: 'bot-engineer', title: 'Standalone room task', status: 'active' }],
    }],
  } })
  assert.doesNotMatch(JSON.stringify(reply), /private-|private |not-a-real-secret|current-part-99|creation-1/)
  reply.value.teams[0].memberIds.push('unowned')
  reply.value.teams[0].goal.stages[0].tasks[0].title = 'changed'
  assert.deepEqual(state, original)
})

test('catalog reads never call the mutable channel or runtime initialization paths', () => {
  const called = []
  const rt = { state: fixture(), hasLoaded: () => true, observeCatalogAccess: granted }
  for (const name of ['channelCall', 'load', 'refresh', 'bootstrap', 'save', 'createBot', 'createSession', 'retitleRoom', 'claimLock', 'catalog']) {
    rt[name] = () => { called.push(name); throw new Error('Unexpected mutable call') }
  }
  assert.equal(createGongzuoCatalog(rt, ENV)(REQUEST).ok, true)
  rt.hasLoaded = () => false
  rt.observeCatalogAccess = () => { called.push('observe-unloaded'); return granted() }
  assert.equal(createGongzuoCatalog(rt, ENV)(REQUEST).error.code, 'catalog/not-ready')
  assert.deepEqual(called, [])
})

test('missing explicit source identity or full SHA refuses before touching the store', () => {
  const rt = { hasLoaded: () => { throw new Error('Store must not be observed') } }
  for (const env of [{}, { ...ENV, GONGZUO_SOURCE_INSTANCE_ID: '' }, { ...ENV, GONGZUO_SOURCE_INSTANCE_ID: 'short' },
    { ...ENV, GONGZUO_FORK_SOURCE_SHA: 'abcd' }, { ...ENV, GONGZUO_FORK_SOURCE_SHA: 'A'.repeat(40) }]) {
    assert.equal(createGongzuoCatalog(rt, env)(REQUEST).error.code, 'catalog/not-configured')
  }
})

test('identity is captured at service construction and cannot be overridden by a request', () => {
  const env = { ...ENV }
  const catalog = createGongzuoCatalog({ state: fixture(), hasLoaded: () => true, observeCatalogAccess: granted }, env)
  env.GONGZUO_SOURCE_INSTANCE_ID = 'another-instance'
  const reply = catalog({ ...REQUEST, sourceInstanceId: 'request-instance' })
  assert.equal(reply.value.sourceInstanceId, ENV.GONGZUO_SOURCE_INSTANCE_ID)
})

test('protocol mismatches, malformed requests and cancelled requests fail closed', () => {
  const catalog = createGongzuoCatalog({ state: fixture(), hasLoaded: () => true, observeCatalogAccess: granted }, ENV)
  for (const request of [[], 'state', false, { version: '1' }, { version: 2 }, { protocol: 'other' }]) {
    assert.equal(catalog(request).error.code, 'catalog/incompatible')
  }
  assert.equal(catalog().ok, true)
  assert.equal(catalog(null).ok, true)
  const abort = new AbortController()
  abort.abort()
  assert.equal(catalog(REQUEST, abort.signal).error.code, 'catalog/cancelled')
})

test('a missing or uncertain authority observation never grants workflow dispatch', () => {
  const rt = { state: fixture(), hasLoaded: () => true }
  for (const observeCatalogAccess of [undefined, () => ({}), () => ({ ready: true, canDispatchWorkflows: true }),
    () => ({ ready: true, canDispatchWorkflows: true, readOnlyReason: 'lock lost' }), () => { throw new Error('private/path') }]) {
    const reply = createGongzuoCatalog({ ...rt, observeCatalogAccess }, ENV)(REQUEST)
    assert.equal(reply.ok, true)
    assert.equal(reply.value.canDispatchWorkflows, false)
    assert.equal(typeof reply.value.readOnlyReason, 'string')
    assert.doesNotMatch(JSON.stringify(reply), /private\/path/)
  }
})

test('only complete, visible native teams with current non-private members and an admin are candidates', () => {
  for (const mutate of [
    s => { s.rooms['room-1'].hidden = true },
    s => { s.rooms['room-1'].creationIncomplete = true },
    s => { s.rooms['room-1'].admin = 'missing' },
    s => { s.rooms['room-1'].members.push('missing') },
    s => { s.rooms['room-1'].members.push('bot-admin') },
    s => { s.bots['bot-engineer'].private = true },
    s => { s.bots['bot-engineer'].hidden = true },
    s => { s.bots['bot-engineer'].creationIncomplete = true },
    s => { delete s.bots['bot-engineer'] },
    s => { delete s.rooms['room-1'].team },
    s => { s.rooms['room-1'].team.blueprint = { id: 'software' } },
    s => { s.rooms['room-1'].id = 'another-room' },
  ]) {
    const state = fixture()
    mutate(state)
    const before = structuredClone(state)
    assert.deepEqual(projectGongzuoTeams(state), [])
    assert.deepEqual(state, before)
  }
})

test('malformed or ambiguous Goal and Room task identities cannot become launch candidates', () => {
  for (const mutate of [
    r => { delete r.goal.revision },
    r => { r.goal.revision = r.goal.updatedAt = '2026-11-20' },
    r => { r.goal.stages[0].tasks[0].botId = 'someone-else' },
    r => { r.goal.stages[0].tasks.push({ ...r.goal.stages[0].tasks[0] }) },
    r => { r.goal.stages.push({ ...r.goal.stages[0] }) },
    r => { r.tasks = [{ id: 't_ab12', botId: 'bot-engineer', status: 'active' }] },
    r => { r.tasks.t_ab12.id = 'different-id' },
    r => { r.tasks.t_ab12.botId = 'removed-member' },
  ]) {
    const state = fixture()
    mutate(state.rooms['room-1'])
    assert.deepEqual(projectGongzuoTeams(state), [])
  }
})

test('no-goal and terminal-goal teams remain truthful snapshots, never synthetic goals', () => {
  const state = fixture()
  delete state.rooms['room-1'].goal
  delete state.rooms['room-1'].tasks
  assert.equal(projectGongzuoTeams(state)[0].goal, null)
  assert.deepEqual(projectGongzuoTeams(state)[0].roomTasks, [])
  for (const status of ['drafting', 'paused', 'complete', 'stopped']) {
    const current = fixture()
    current.rooms['room-1'].goal.status = status
    assert.equal(projectGongzuoTeams(current)[0].goal.status, status)
  }
})

test('invalid root shape and revision return a typed refusal with no raw data', () => {
  for (const state of [null, {}, { ...fixture(), revision: -1 }, { ...fixture(), revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...fixture(), rooms: [] }, { ...fixture(), bots: null }]) {
    const reply = createGongzuoCatalog({ state, hasLoaded: () => true, observeCatalogAccess: granted }, ENV)(REQUEST)
    assert.equal(reply.error.code, 'catalog/invalid-state')
  }
})


test('catalog entity IDs share the workflow binding limit of 128 characters', () => {
  for (const length of [128, 129]) {
    const keys = Object.fromEntries(['room', 'admin', 'engineer', 'goal', 'stage', 'task', 'roomtask']
      .map(key => [key, key + 'x'.repeat(length - key.length)]))
    const state = fixture()
    const room = state.rooms['room-1']
    state.bots = {
      [keys.admin]: { ...state.bots['bot-admin'], id: keys.admin },
      [keys.engineer]: { ...state.bots['bot-engineer'], id: keys.engineer },
    }
    state.rooms = { [keys.room]: room }
    room.id = keys.room
    room.admin = keys.admin
    room.members = [keys.admin, keys.engineer]
    room.goal.id = keys.goal
    room.goal.stages[0].id = keys.stage
    Object.assign(room.goal.stages[0].tasks[0], { id: keys.task, botId: keys.engineer })
    room.tasks = { [keys.roomtask]: { id: keys.roomtask, botId: keys.engineer, goal: 'Room task', status: 'active' } }
    assert.equal(projectGongzuoTeams(state).length, length === 128 ? 1 : 0)
  }
})
