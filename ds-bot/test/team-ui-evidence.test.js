import assert from 'node:assert/strict'
import { test } from 'node:test'
import { teamCallCounts, teamCallOwner } from '../dev/team-ui-evidence.mjs'

const coordinator = { id: 'c', name: 'Coordinator', role: 'Coordination', sessionId: 'coordinator-private' }
const engineer = { id: 'e', name: 'Engineer', sessionId: 'engineer-private' }
const room = { id: 'room-original', sessionId: 'room-current-transcript', name: 'UI team', admin: 'c', members: ['c', 'e'], sessions: { c: 'coordinator-group' } }
const scope = { room, coordinator, bots: { c: coordinator, e: engineer } }
const groupSubject = 'The group chat: "UI team", with the user and Coordinator (admin), Engineer.'
const memory = {
  session: 'room-original', messages: 1, first: groupSubject.slice(0, 60), out: [{ type: 'text', text: '{"changes":[]}' }],
  memoryReview: { scope: 'group', subject: groupSubject, systemMarker: 'You keep the long-term memory of one group chat in DS Bot,', toolCount: 0 },
}

test('group memory is counted separately only on its actual automatic-review tag', () => {
  assert.equal(teamCallOwner({ session: 'coordinator-group' }, scope), 'coordinator-group')
  assert.equal(teamCallOwner({ session: 'coordinator-private' }, scope), 'coordinator-private')
  assert.equal(teamCallOwner(memory, scope), 'group-memory-review')
  assert.equal(teamCallOwner({ ...memory, session: room.sessionId }, scope), 'unexpected-session', 'Automatic reviewGroup tags room.id, even when sessionOfRoom points to a newer transcript')
  assert.deepEqual(teamCallCounts([{ owner: 'coordinator-group' }, { owner: 'group-memory-review' }, { owner: 'group-memory-review' }]), { 'coordinator-group': 1, 'group-memory-review': 2 })
})

test('unknown Sessions and insufficient memory evidence are never silently allowed', () => {
  for (const call of [
    { ...memory, session: 'engineer-private' },
    { ...memory, session: 'unrelated-room' },
    { ...memory, memoryReview: undefined },
    { ...memory, first: 'The group chat: "different team"' },
    { ...memory, memoryReview: { ...memory.memoryReview, subject: 'The group chat: "different team"' } },
    { ...memory, memoryReview: { ...memory.memoryReview, systemMarker: 'unverified marker' } },
    { ...memory, memoryReview: { ...memory.memoryReview, toolCount: 1 } },
    { ...memory, messages: 2 },
    { ...memory, out: [{ type: 'tool_use', name: 'bash' }] },
    { ...memory, out: [{ type: 'text', text: 'not a memory result' }] },
  ]) assert.equal(teamCallOwner(call, scope), 'unexpected-session')
})

test('coordinator private memory needs its own identity and marker too', () => {
  const subject = 'The Bot: Coordinator, Coordination.'
  const own = {
    ...memory, session: coordinator.sessionId, first: subject.slice(0, 60),
    memoryReview: { scope: 'bot', subject, systemMarker: 'You keep the long-term memory of one Bot in DS Bot,', toolCount: 0 },
  }
  assert.equal(teamCallOwner(own, scope), 'coordinator-private-memory-review')
  assert.equal(teamCallOwner({ ...own, session: engineer.sessionId }, scope), 'unexpected-session')
  assert.equal(teamCallOwner({ ...own, memoryReview: { ...own.memoryReview, subject: 'The Bot: Engineer.' } }, scope), 'unexpected-session')
})
