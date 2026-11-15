import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TEAM_ROLES } from '../src/shared/team-presets.js'
import { newTeamDraft, readTeamDraft, writeTeamDraft, teamPayload, teamDraftProblem, teamInbox, teamActivity, TEAM_DRAFT_KEY } from '../src/client/team-workspace-model.js'
import { createSource } from '../src/client/sources.js'
import { teamActions } from '../src/client/team-actions.js'

const roster = (extra = {}) => ({ bots: [], byId: {}, rooms: [], roomsById: {}, questions: {}, models: [{ ref: 'mock/test', name: 'Mock model' }], permissions: { options: [{ value: 'read-only' }, { value: 'workspace-write' }] }, ...extra })
const memoryStorage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('a new team keeps six distinct roles and avoids collisions with existing members', () => {
  const state = roster({ bots: [{ id: 'old', name: 'Coordinator' }, { id: 'other', name: 'Coordinator 2' }] })
  const draft = newTeamDraft(state)
  assert.equal(draft.members.coordinator.name, 'Coordinator 3')
  assert.deepEqual(draft.selected, TEAM_ROLES.map(role => role.id))
  assert.equal(new Set(Object.values(draft.members).map(member => member.name)).size, 6)
  assert.equal(teamDraftProblem(draft, state), '')
  assert.equal(teamPayload(draft, 'operation-1').members[0].model, 'mock/test')
  assert.ok(Object.values(draft.members).every(member => member.instructions.length > 1000))
})

test('reuse payload never overwrites existing member identity, permissions, or instructions', () => {
  const existing = { id: 'old', name: 'Custom coordinator', role: 'Custom', instructions: 'Keep my words', model: 'mock/test', permission: 'read-only' }
  const state = roster({ bots: [existing], byId: { old: existing } })
  const draft = newTeamDraft(state)
  draft.members.coordinator.botId = existing.id
  draft.workDir = ' /workspace/team '
  const payload = teamPayload(draft, 'operation-reuse')
  assert.deepEqual(payload.members[0], { presetId: 'coordinator', botId: 'old' })
  assert.equal(payload.workDir, '/workspace/team')
  assert.equal(teamDraftProblem(draft, state), '')
  draft.members.researcher.botId = existing.id
  assert.equal(teamDraftProblem(draft, state), 'Each member can fill one role in this team')
})

test('preflight rejects name conflicts, unavailable models, stale permissions, and private reuse', () => {
  const state = roster()
  const draft = newTeamDraft(state)
  draft.members.engineer.name = draft.members.researcher.name
  assert.equal(teamDraftProblem(draft, state), 'Member names must be unique')
  draft.members.engineer.name = 'Engineer'
  draft.members.engineer.model = 'invented/model'
  assert.equal(teamDraftProblem(draft, state), 'Choose an available model or configure it later')
  draft.members.engineer.model = ''
  assert.equal(teamDraftProblem(draft, state), '')
  assert.equal(teamPayload(draft, 'unconfigured').members.find(member => member.presetId === 'engineer').model, null)
  draft.members.engineer.permission = 'unsupported'
  assert.equal(teamDraftProblem(draft, state), 'Choose an available permission preset')
  draft.members.engineer.permission = ''
  draft.members.engineer.botId = 'private'
  state.bots.push({ id: 'private', name: 'Private', private: true })
  assert.equal(teamDraftProblem(draft, state), 'Choose an available team member')
})

test('saved pending creation retains the same request across reload and rejects malformed drafts', () => {
  const storage = memoryStorage()
  const draft = newTeamDraft(roster())
  const payload = teamPayload(draft, 'stable-operation')
  const saved = { draft, operationId: 'stable-operation', payload }
  writeTeamDraft(storage, saved)
  assert.deepEqual(readTeamDraft(storage), saved)
  assert.deepEqual(readTeamDraft(storage, 'stable-operation'), saved)
  assert.equal(readTeamDraft(storage, 'another-team-operation'), null)
  assert.deepEqual(readTeamDraft(storage), saved)
  saved.payload.operationId = 'different-operation'
  storage.setItem(TEAM_DRAFT_KEY, JSON.stringify(saved))
  assert.equal(readTeamDraft(storage), null)
  storage.setItem(TEAM_DRAFT_KEY, '{broken')
  assert.equal(readTeamDraft(storage), null)
  writeTeamDraft(storage, null)
  assert.equal(readTeamDraft(storage), null)
})

test('dashboard distinguishes submitted work from accepted work and uses actual live members', () => {
  const room = { id: 'r', members: ['a', 'b'], goal: { stages: [{ tasks: [{ botId: 'a', status: 'reported' }, { botId: 'b', status: 'done' }] }] } }
  const activity = teamActivity(room, { rooms: { r: [{ botId: 'a' }, { botId: 'a' }], unrelated: [{ botId: 'c' }] } })
  assert.equal(activity.waitingReview, 1)
  assert.equal(activity.done, 1)
  assert.deepEqual([...activity.active], ['a'])
})

test('inbox keeps approval identity and answerability while linking questions to their original chat', () => {
  const approval = { id: 'ask', botId: 'a', roomId: 'r', answerable: false, tool: 'write' }
  const state = roster({ byId: { a: { name: 'Engineer' } }, roomsById: { r: { name: 'Team' } }, questions: { r: { id: 'question', question: 'Which output?' } } })
  const items = teamInbox(state, { approvals: [approval] })
  assert.equal(items.length, 2)
  assert.equal(items[0].approval, approval)
  assert.equal(items[0].approval.answerable, false)
  assert.equal(items[0].sessionId, 'r')
  assert.equal(items[1].sessionId, 'r')
  assert.equal(items[1].owner, 'Team')
})

test('workspace actions resume a known operation without reissuing create and refresh after mutations', async () => {
  const sent = []
  let refreshed = 0
  const ui = createSource({ details: 'old', newChat: 'new', menu: 'menu', palette: 'palette', leftDrawer: true })
  const actions = teamActions({ call: async (...args) => { sent.push(args); return { operationId: 'stable' } }, after: task => task.then(value => { refreshed++; return value }), roster: createSource({}), ui })
  actions.openWorkspace('create', null, 'stable')
  assert.equal(ui.getSnapshot().teamRecovery, 'stable')
  assert.equal(ui.getSnapshot().details, null)
  assert.equal(ui.getSnapshot().leftDrawer, false)
  await actions.teamCreationStatus('stable')
  await actions.resumeTeamCreation('stable')
  assert.deepEqual(sent, [['team-creation-status', { operationId: 'stable' }], ['resume-team-creation', { operationId: 'stable' }]])
  assert.equal(refreshed, 1)
  actions.openWorkspace(null)
  assert.equal(ui.getSnapshot().workspacePage, null)
})
