// An optional extension's directory is a projection of already-loaded Bot state.
// It must never bootstrap the team, refresh its store, or create a second identity.
export const GONGZUO_CATALOG_PROTOCOL = 'gongzuo-catalog'
export const GONGZUO_CATALOG_VERSION = 1

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const own = (table, key) => Object.hasOwn(table, key) ? table[key] : undefined
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value)
  && !['constructor', 'prototype', '__proto__'].includes(value)
const revision = value => Number.isSafeInteger(value) && value >= 0
const text = (value, limit) => typeof value === 'string' ? value.replace(/\p{Cc}/gu, ' ').slice(0, limit) : ''
const GOALS = new Set(['drafting', 'active', 'paused', 'complete', 'stopped'])
const GOAL_TASKS = new Set(['pending', 'working', 'reported', 'done'])
const ROOM_TASKS = new Set(['active', 'review', 'blocked', 'done', 'cancelled'])
const BLUEPRINTS = new Set(['software', 'research', 'content'])
const fail = (code, message) => ({ ok: false, error: { code: `catalog/${code}`, message, details: {} } })

function goalOf(goal, members) {
  if (goal === undefined || goal === null) return null
  if (!record(goal) || !id(goal.id) || !GOALS.has(goal.status) || !revision(goal.revision) || !Array.isArray(goal.stages)) return undefined
  const stageIds = new Set()
  const taskIds = new Set()
  const stages = []
  for (const stage of goal.stages) {
    if (!record(stage) || !id(stage.id) || stageIds.has(stage.id) || !Array.isArray(stage.tasks)) return undefined
    stageIds.add(stage.id)
    const tasks = []
    for (const task of stage.tasks) {
      if (!record(task) || !id(task.id) || taskIds.has(task.id) || !members.has(task.botId) || !GOAL_TASKS.has(task.status)) return undefined
      taskIds.add(task.id)
      tasks.push({ id: task.id, botId: task.botId, title: text(task.task, 2000), status: task.status })
    }
    stages.push({ id: stage.id, tasks })
  }
  return { id: goal.id, title: text(goal.title, 200), status: goal.status, revision: goal.revision, stages }
}

function roomTasksOf(source, members) {
  if (source === undefined || source === null) return []
  if (!record(source)) return undefined
  const tasks = []
  for (const [key, task] of Object.entries(source)) {
    if (!record(task) || !id(task.id) || key !== task.id || !members.has(task.botId) || !ROOM_TASKS.has(task.status)) return undefined
    tasks.push({ id: task.id, botId: task.botId, title: text(task.goal, 200), status: task.status })
  }
  return tasks
}

// Invalid or hidden targets are omitted, never repaired or inferred from names.
// room.id stays stable when its current room.sessionId advances to another part.
export function projectGongzuoTeams(state) {
  if (!record(state) || !revision(state.revision) || !record(state.rooms) || !record(state.bots)) throw new TypeError('Invalid catalog state')
  const teams = []
  for (const [key, room] of Object.entries(state.rooms)) {
    if (!record(room) || !id(room.id) || key !== room.id || room.hidden || room.private || room.creationIncomplete) continue
    if (!record(room.team) || !BLUEPRINTS.has(room.team.blueprint) || !Array.isArray(room.members) || room.members.length < 2) continue
    const members = new Set(room.members)
    if (members.size !== room.members.length || !id(room.admin) || !members.has(room.admin)) continue
    if (room.members.some(memberId => {
      const bot = id(memberId) ? own(state.bots, memberId) : undefined
      return !record(bot) || bot.id !== memberId || bot.private || bot.hidden || bot.creationIncomplete
    })) continue
    const goal = goalOf(room.goal, members)
    const roomTasks = roomTasksOf(room.tasks, members)
    if (goal === undefined || roomTasks === undefined) continue
    teams.push({
      teamId: room.id, roomId: room.id, name: text(room.name, 200),
      blueprint: room.team.blueprint, memberIds: [...room.members], adminId: room.admin,
      goal, roomTasks,
    })
  }
  return teams
}

export function createGongzuoCatalog(rt, environment = process.env) {
  // Capture deploy metadata once. A read must never generate or save an instance ID.
  const sourceInstanceId = environment.GONGZUO_SOURCE_INSTANCE_ID
  const sourceCommit = environment.GONGZUO_FORK_SOURCE_SHA
  const configured = typeof sourceInstanceId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{7,127}$/.test(sourceInstanceId)
    && typeof sourceCommit === 'string' && /^[0-9a-f]{40}$/.test(sourceCommit)
  return (request, signal) => {
    if (signal?.aborted) return fail('cancelled', 'The catalog request was cancelled.')
    if (request !== undefined && request !== null && (!record(request)
      || (request.protocol !== undefined && request.protocol !== GONGZUO_CATALOG_PROTOCOL)
      || (request.version !== undefined && request.version !== GONGZUO_CATALOG_VERSION))) {
      return fail('incompatible', 'This catalog protocol is not supported.')
    }
    if (!configured) return fail('not-configured', 'Configure an explicit Gongzuo source instance and source commit before using extensions.')
    if (rt.hasLoaded?.() !== true) return fail('not-ready', 'The Bot team has not finished loading.')
    let access
    try { access = rt.observeCatalogAccess?.() } catch {}
    if (access?.ready === false) return fail('not-ready', 'The Bot team snapshot is not ready.')
    let teams
    try { teams = projectGongzuoTeams(rt.state) } catch {
      return fail('invalid-state', 'The Bot team snapshot cannot be projected safely.')
    }
    const canDispatchWorkflows = access?.ready === true && access.canDispatchWorkflows === true && access.readOnlyReason === null
    return { ok: true, value: {
      protocol: GONGZUO_CATALOG_PROTOCOL, version: GONGZUO_CATALOG_VERSION, source: 'gongzuo-fork',
      sourceInstanceId, sourceCommit, revision: rt.state.revision,
      readOnlyReason: canDispatchWorkflows ? null : 'The current team state or its write lock cannot be verified. Workflow changes are disabled.',
      canDispatchWorkflows, teams,
    } }
  }
}
