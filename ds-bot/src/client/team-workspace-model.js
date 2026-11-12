import { TEAM_ROLES, buildRoleInstructions } from '../shared/team-presets.js'
import { nameProblem } from '../shared/mentions.js'
import { startModel } from './bot-draft.js'

export const TEAM_DRAFT_KEY = 'ds-bot:team-draft-v1'

export function newTeamDraft(roster, translate = value => value) {
  const used = new Set((roster.bots ?? []).map(bot => bot.name.toLowerCase()))
  const unique = (name) => {
    let next = name
    let suffix = 2
    while (used.has(next.toLowerCase())) next = `${name} ${suffix++}`
    used.add(next.toLowerCase())
    return next
  }
  return {
    name: translate('My development team'), blueprint: 'software', workDir: '',
    selected: TEAM_ROLES.map(role => role.id),
    members: Object.fromEntries(TEAM_ROLES.map(role => [role.id, {
      presetId: role.id, name: unique(translate(role.name)), role: translate(role.role),
      instructions: buildRoleInstructions(role.id, role.creativity), creativity: role.creativity,
      model: startModel(roster) || '', permission: '', workDir: '',
      avatar: { shape: role.character }, color: role.ink, botId: '', customized: false,
    }])),
  }
}

export function teamPayload(draft, operationId) {
  return {
    operationId, name: draft.name.trim(), blueprint: draft.blueprint,
    ...(draft.workDir.trim() ? { workDir: draft.workDir.trim() } : {}),
    members: draft.selected.map((presetId) => {
      const member = draft.members[presetId]
      if (member.botId) return { presetId, botId: member.botId }
      return {
        presetId, name: member.name.trim(), role: member.role.trim(),
        instructions: member.instructions, creativity: member.creativity,
        model: member.model || null, avatar: member.avatar, color: member.color,
        ...(member.permission ? { permission: member.permission } : {}),
        ...(member.workDir.trim() ? { workDir: member.workDir.trim() } : {}),
      }
    }),
  }
}

export function teamDraftProblem(draft, roster) {
  if (!draft.name.trim()) return 'Enter a team name'
  if (draft.name.trim().length > 32) return 'Team names can have at most 32 characters'
  if (!draft.selected.includes('coordinator')) return 'Select a coordinator'
  if (draft.selected.length < 2) return 'Select at least two members'
  if (!(roster.permissions?.options ?? []).length) return 'Team creation requires permission presets from DeepSeek Harness'
  const names = new Set((roster.bots ?? []).map(bot => bot.name.toLowerCase()))
  const reused = new Set()
  for (const id of draft.selected) {
    const member = draft.members[id]
    if (!member) return 'Choose a valid role'
    if (member.botId) {
      const bot = roster.byId?.[member.botId] ?? roster.bots.find(item => item.id === member.botId)
      if (!bot || bot.private) return 'Choose an available team member'
      if (reused.has(bot.id)) return 'Each member can fill one role in this team'
      reused.add(bot.id)
      continue
    }
    const name = member.name.trim()
    if (!name) return 'Enter a name for every new member'
    if (name.length > 40) return 'Member names can have at most 40 characters'
    const problem = nameProblem(name)
    if (problem) return problem
    if (names.has(name.toLowerCase())) return 'Member names must be unique'
    names.add(name.toLowerCase())
    if (member.role.length > 24) return 'Role labels can have at most 24 characters'
    if (!member.instructions.trim()) return 'Add instructions for every new member'
    if (member.model && !(roster.models ?? []).some(model => model.ref === member.model && model.needsKey !== true)) return 'Choose an available model or configure it later'
    if (member.permission && !(roster.permissions?.options ?? []).some(option => option.value === member.permission)) return 'Choose an available permission preset'
  }
  return ''
}

export function readTeamDraft(storage, operationId) {
  try {
    const saved = JSON.parse(storage?.getItem(TEAM_DRAFT_KEY) ?? 'null')
    if (!saved?.draft || !Array.isArray(saved.draft.selected) || !saved.draft.members) return null
    if (operationId && saved.operationId !== operationId) return null
    if (!saved.draft.selected.every(id => TEAM_ROLES.some(role => role.id === id) && saved.draft.members[id])) return null
    if (typeof saved.draft.name !== 'string' || typeof saved.draft.workDir !== 'string') return null
    if (!TEAM_ROLES.every(role => {
      const member = saved.draft.members[role.id]
      return member && ['name', 'role', 'instructions', 'workDir'].every(key => typeof member[key] === 'string') && typeof member.avatar?.shape === 'string'
    })) return null
    if (saved.payload && (typeof saved.operationId !== 'string' || saved.payload.operationId !== saved.operationId)) return null
    return saved
  } catch { return null }
}

export function writeTeamDraft(storage, saved) {
  try {
    if (saved === null) storage?.removeItem(TEAM_DRAFT_KEY)
    else storage?.setItem(TEAM_DRAFT_KEY, JSON.stringify(saved))
  } catch { /* The server's creation record remains authoritative without browser storage. */ }
}

export const teamRooms = roster => (roster.rooms ?? []).filter(room => room.team && !room.hidden)

export function teamInbox(roster, work = {}) {
  const questions = Object.entries(roster.questions ?? {}).map(([sessionId, question]) => ({
    kind: 'question', id: `question:${sessionId}:${question.id}`, sessionId, question,
    owner: roster.roomsById?.[sessionId]?.name ?? roster.byId?.[sessionId]?.name ?? '',
  }))
  const approvals = (work.approvals ?? []).map(approval => ({
    kind: 'approval', id: `approval:${approval.id}`, approval,
    sessionId: approval.roomId ?? approval.sessionId ?? approval.botId,
    owner: roster.byId?.[approval.botId]?.name ?? '',
  }))
  return [...approvals, ...questions]
}

export function teamActivity(room, work = {}) {
  const active = new Set((work.rooms?.[room.id] ?? []).map(entry => entry.botId))
  const tasks = (room.goal?.stages ?? []).flatMap(stage => stage.tasks ?? [])
  return { active, waitingReview: tasks.filter(task => task.status === 'reported').length, done: tasks.filter(task => task.status === 'done').length }
}
