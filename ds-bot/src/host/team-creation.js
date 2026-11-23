import { createHash, randomUUID } from 'node:crypto'
import { TEAM_BLUEPRINTS, PRESET_VERSION, TEAM_ROOM_NOTICE, getTeamRole, getCreativityMode, buildRoleInstructions } from '../shared/team-presets.js'
import { nameProblem } from '../shared/mentions.js'
import { ROOM_NAME_MAX, SECTION_NAME_MAX } from './constants.js'
import { currentColor, isColor, normalize, unquote } from './text.js'

const invalid = message => Object.assign(new Error(message), { code: 'bot/invalid' })
const conflict = message => Object.assign(new Error(message), { code: 'bot/conflict' })
const own = (table, key) => (Object.hasOwn(table ?? {}, key) ? table[key] : undefined)
const optionalString = (value, label) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw invalid(`${label} must be text`)
  return value.trim() || null
}

function operationKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{7,127}$/.test(value)) throw invalid('A team creation needs a valid operation ID')
  return value
}

// Fixed keys make the request fingerprint independent of object key order. Reused
// members are identities only: creating a team never edits their configuration.
function requestOf(body) {
  const name = unquote(optionalString(body.name, 'Team name')).replace(/\s+/g, ' ')
  if (!name || name.length > Math.min(ROOM_NAME_MAX, SECTION_NAME_MAX)) throw invalid(`Enter a team name of at most ${SECTION_NAME_MAX} characters`)
  const blueprint = optionalString(body.blueprint, 'Team template') ?? 'software'
  if (!TEAM_BLUEPRINTS.some(item => item.id === blueprint)) throw invalid('Unknown team template')
  if (!Array.isArray(body.members) || body.members.length < 2 || body.members.length > 6) throw invalid('Choose two to six team members')
  const roles = new Set()
  const members = body.members.map(input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Each member needs a role')
    const preset = getTeamRole(input.presetId)
    if (!preset || roles.has(preset.id)) throw invalid('Choose each role at most once')
    roles.add(preset.id)
    const botId = optionalString(input.botId ?? input.existingBotId, 'Existing member')
    if (botId) return { presetId: preset.id, botId }
    const creativity = optionalString(input.creativity, 'Exploration mode') ?? preset.creativity
    if (!getCreativityMode(creativity)) throw invalid('Unknown exploration mode')
    const memberName = optionalString(input.name, 'Member name') ?? preset.name
    if (memberName.length > 40) throw invalid('Member names can hold at most 40 characters')
    const problem = nameProblem(memberName)
    if (problem) throw invalid(problem)
    const role = optionalString(input.role, 'Role label') ?? preset.role
    if (role.length > 24) throw invalid('Role labels can hold at most 24 characters')
    const instructions = input.instructions === undefined ? buildRoleInstructions(preset.id, creativity) : optionalString(input.instructions, 'Instructions')
    if (!instructions) throw invalid('Each new member needs instructions')
    if (instructions.length > 100_000) throw invalid('Member instructions are too long')
    let avatar = { shape: preset.character }
    if (input.avatar !== undefined && input.avatar !== null) {
      if (typeof input.avatar !== 'object' || Array.isArray(input.avatar)) throw invalid('Invalid member avatar')
      avatar = { shape: input.avatar.shape ?? null, image: input.avatar.image ?? null }
    }
    return {
      presetId: preset.id, name: memberName, role, instructions, creativity,
      model: optionalString(input.model, 'Model'), effort: optionalString(input.effort, 'Thinking level'),
      permission: optionalString(input.permission, 'Permission preset'), workDir: optionalString(input.workDir, 'Working folder'),
      color: optionalString(input.color, 'Member color') ?? preset.ink, avatar,
    }
  })
  if (!roles.has('coordinator')) throw invalid('A team needs a coordinator')
  return { name, blueprint, workDir: optionalString(body.workDir, 'Working folder'), members }
}

export function install(rt) {
  const { state } = rt
  const running = new Map()
  const activating = new Map()
  let queue = Promise.resolve()
  const records = () => (state.teamCreations ??= {})
  const save = () => rt.save({ required: true })

  function defaultPermission(presetId) {
    const catalog = rt.permissionCatalog?.()
    if (!catalog) throw invalid('Team creation requires permission presets from DeepSeek Harness')
    const values = new Set(catalog.options.map(option => option.value))
    const choices = presetId === 'researcher' ? ['read-only', 'workspace-write'] : ['workspace-write', 'read-only']
    const chosen = choices.find(value => values.has(value))
    if (!chosen) throw invalid('Choose an available permission preset for every new member')
    return chosen
  }

  async function checkFolder(value) {
    if (!value) return undefined
    const dir = await rt.cleanWorkDir(value)
    const clash = dir === undefined ? undefined : await rt.privateClash(dir)
    if (clash) throw invalid('A team cannot work in or around a private Bot folder')
    return dir
  }

  async function planRequest(request, record) {
    const room = record?.roomId ? rt.roomOf(record.roomId) : undefined
    if (rt.findRooms(request.name).some(item => item.id !== room?.id)) throw conflict(`Another group chat is already called "${request.name}"`)
    if ((state.sections ?? []).some(item => normalize(item.name) === normalize(request.name) && item.id !== record?.sectionId)) throw conflict(`Another section is already called "${request.name}"`)
    const workDir = await checkFolder(request.workDir)
    const names = new Set()
    const reused = new Set()
    const members = []
    for (const input of request.members) {
      const step = record?.members.find(item => item.presetId === input.presetId)
      if (input.botId) {
        const bot = rt.botOf(input.botId)
        if (!bot || bot.private === true || bot.creationIncomplete === true) throw invalid('A reused member must be an available, non-private Bot')
        if (reused.has(bot.id)) throw invalid('One Bot cannot fill two roles in the same team')
        reused.add(bot.id)
        members.push({ ...input, name: bot.name })
        continue
      }
      if (step?.botId && step.status === 'complete') {
        const bot = rt.botOf(step.botId)
        if (!bot || bot.private === true) throw conflict('A created member is no longer available; it will not be recreated automatically')
        members.push({ ...input, name: bot.name, model: bot.model, permission: bot.permission })
        continue
      }
      const found = rt.findBot(input.name)
      if (names.has(normalize(input.name)) || (found && found.id !== step?.botId)) throw conflict(`A Bot named ${input.name} already exists`)
      names.add(normalize(input.name))
      if (step?.botId) {
        const bot = rt.botOf(step.botId)
        if (!bot || bot.private === true) throw conflict('A created member is no longer available; it will not be recreated automatically')
      }
      const model = input.model ? await rt.resolveModel(input.model) : undefined
      if (input.effort && !model) throw invalid('Pick a model before choosing a thinking level')
      const effort = input.effort ? await rt.resolveEffort(model, input.effort) : undefined
      const permission = input.permission ?? step?.permission ?? defaultPermission(input.presetId)
      if (permission !== undefined) rt.cleanBotPermission(permission)
      const dir = await checkFolder(input.workDir)
      const color = currentColor(input.color)
      if (!isColor(color)) throw invalid('Unknown member color')
      if (input.avatar.shape !== undefined && input.avatar.shape !== null && (typeof input.avatar.shape !== 'string' || !/^[a-z][\w-]{0,31}$/.test(input.avatar.shape))) throw invalid('Invalid member avatar shape')
      if (input.avatar.image !== undefined && input.avatar.image !== null && typeof input.avatar.image !== 'string') throw invalid('Invalid member avatar image')
      const avatar = rt.cleanAvatar(input.avatar)
      if (!avatar) throw invalid('Choose a member avatar')
      members.push({ ...input, model, effort, permission, workDir: dir, color, avatar })
    }
    return { ...request, workDir, members }
  }

  // Only metadata durably written with an entity can settle an interrupted create.
  // No match after a Session creation started means uncertainty, not permission to
  // issue another create and risk an orphan or a duplicate.
  function reconciled(source, force = false) {
    const record = structuredClone(source)
    if ((!force && running.has(record.operationId)) || record.status === 'complete') return record
    let uncertain = false
    for (const step of record.members) {
      if (step.reused) continue
      const matches = Object.values(state.bots).filter(bot => bot.teamCreation?.operationId === record.operationId && bot.teamCreation?.presetId === step.presetId)
      if (matches.length === 1) {
        step.botId = matches[0].id
        step.status = matches[0].creationIncomplete === true ? 'failed' : 'complete'
      } else if (matches.length > 1 || step.status === 'creating' || step.status === 'uncertain' || step.botId) {
        step.status = 'uncertain'
        step.error = 'The previous member creation could not be verified. Check the saved Sessions before retrying.'
        uncertain = true
      }
    }
    const rooms = Object.values(state.rooms).filter(room => room.team?.operationId === record.operationId)
    if (rooms.length === 1) {
      record.roomId = rooms[0].id
      record.roomStatus = rooms[0].creationIncomplete === true ? 'failed' : 'complete'
    } else if (rooms.length > 1 || record.roomStatus === 'creating' || record.roomStatus === 'uncertain' || record.roomId) {
      record.roomStatus = 'uncertain'
      uncertain = true
    }
    if (uncertain) {
      record.status = 'uncertain'
      record.error = 'A previous creation has an unknown outcome. Existing members are kept; no duplicate is created.'
    } else if (record.roomStatus === 'complete' && record.members.every(member => member.status === 'complete')) {
      record.status = 'complete'
      delete record.error
    } else if (record.status === 'working' || record.status === 'uncertain') {
      record.status = 'failed'
      record.error = 'Team creation was interrupted. Resume to finish the remaining steps.'
    }
    return record
  }

  function publicRecord(source) {
    const record = reconciled(source)
    return {
      operationId: record.operationId, name: record.request.name, blueprint: record.request.blueprint,
      status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt,
      ...(record.roomId ? { roomId: record.roomId } : {}),
      ...(record.sectionId ? { sectionId: record.sectionId } : {}),
      roomStatus: record.roomStatus,
      ...(record.uncertainSessionId ? { uncertainSessionId: record.uncertainSessionId } : {}),
      members: record.members.map(step => ({
        presetId: step.presetId, name: step.name, status: step.status,
        ...(step.botId ? { botId: step.botId } : {}), ...(step.reused ? { reused: true } : {}),
        ...(step.permission ? { permission: step.permission } : {}), ...(step.error ? { error: step.error } : {}),
      })),
      ...(record.error ? { error: record.error } : {}),
      canResume: record.status === 'failed' || record.status === 'pending',
    }
  }

  function teamCreationStatus(operationId) {
    const id = operationKey(operationId)
    const record = own(records(), id)
    return record ? publicRecord(record) : null
  }

  function teamCreationsView() {
    return Object.values(records()).filter(record => record?.request && Array.isArray(record.members))
      .map(publicRecord).filter(record => record.status !== 'complete').sort((a, b) => b.createdAt - a.createdAt)
  }

  async function activateTeamBot(id, sessionId) {
    const bot = rt.botOf(id)
    if (!bot) return
    if (bot.creationIncomplete === true) throw new Error('Finish creating this team member before starting work')
    if (bot.dormant !== true && !bot.teamCreation) return
    const target = sessionId ?? rt.chatOf(id)
    const key = `${id}:${target}`
    if (activating.has(key)) return activating.get(key)
    if (!bot.model) throw new Error(`Choose a model for ${bot.name} before starting work`)
    const active = (async () => {
      // Session creation and legacy model routing may use a default or warn on a
      // failed configuration. Team work must apply the chosen route and effective
      // permission to its actual recipient before any prompt can be delivered.
      await rt.applyModel(bot, { force: true, strict: true, sessionId: target })
      const permission = await rt.applyPermission(bot, target)
      if (!permission) throw new Error(`Configure permissions for ${bot.name} before starting work`)
      if (bot.dormant === true) {
        delete bot.dormant
        delete bot.kickoff
        try { await save() } catch (error) { bot.dormant = true; throw error }
      }
    })()
    activating.set(key, active)
    try { await active } finally { activating.delete(key) }
  }

  async function finishMember(bot) {
    if (bot.creationIncomplete !== true) return
    if (bot.permission) await rt.applyPermission(bot, rt.chatOf(bot.id))
    await rt.resolveAgent(bot.id)
    delete bot.creationIncomplete
    try { await save() } catch (error) { bot.creationIncomplete = true; throw error }
  }

  async function run(record, plan) {
    record.status = 'working'
    delete record.error
    record.updatedAt = Date.now()
    await save()
    let current
    try {
      if (!(state.sections ?? []).some(section => section.id === record.sectionId)) {
        state.sections ??= []
        state.sections.push({ id: record.sectionId, name: plan.name })
        await save()
      }
      for (let index = 0; index < plan.members.length; index += 1) {
        const input = plan.members[index]
        const step = record.members[index]
        current = step
        if (step.reused || step.status === 'complete') continue
        if (step.botId) {
          const bot = rt.botOf(step.botId)
          if (!bot) throw conflict('A created member is no longer available')
          await finishMember(bot)
        } else {
          step.status = 'creating'
          delete step.error
          await save()
          const bot = await rt.createBot({
            ...input, pickModel: !input.model, deferKickoff: true, sectionId: record.sectionId,
            presetVersion: PRESET_VERSION,
            teamCreation: { operationId: record.operationId, presetId: input.presetId },
          })
          step.botId = bot.id
        }
        step.status = 'complete'
        record.updatedAt = Date.now()
        await save()
      }
      current = null
      const ids = record.members.map(step => step.botId)
      rt.checkNoPrivate(ids)
      if (ids.some(id => !rt.botOf(id))) throw conflict('A team member was removed during creation')
      if (!record.roomId) {
        record.roomStatus = 'creating'
        await save()
        const room = await rt.createRoom({
          name: plan.name, members: ids, admin: record.members.find(step => step.presetId === 'coordinator').botId,
          mode: 'admin', notice: TEAM_ROOM_NOTICE, sectionId: record.sectionId, workDir: plan.workDir,
          team: { blueprint: plan.blueprint, operationId: record.operationId, createdAt: record.createdAt, members: record.members.map(({ presetId, botId }) => ({ presetId, botId })) },
        })
        record.roomId = room.id
      } else {
        const room = rt.roomOf(record.roomId)
        if (!room) throw conflict('The created group is no longer available')
        if (room.creationIncomplete === true) {
          await rt.resolveAgent(room.id)
          delete room.creationIncomplete
        }
      }
      record.roomStatus = 'complete'
      record.status = 'complete'
      record.updatedAt = Date.now()
      await save()
    } catch (error) {
      const uncertain = error.creationUncertain === true
      if (current) {
        if (error.createdBotId) current.botId = error.createdBotId
        current.status = uncertain ? 'uncertain' : 'failed'
        current.error = String(error?.message ?? error)
      } else {
        if (error.createdRoomId) record.roomId = error.createdRoomId
        record.roomStatus = uncertain ? 'uncertain' : 'failed'
      }
      if (error.createdSessionId) record.uncertainSessionId = error.createdSessionId
      record.status = uncertain ? 'uncertain' : 'failed'
      record.error = String(error?.message ?? error)
      record.updatedAt = Date.now()
      await save()
    }
    return publicRecord(record)
  }

  function schedule(operationId, fingerprint, work) {
    const active = running.get(operationId)
    if (active) {
      if (active.fingerprint !== fingerprint) return Promise.reject(conflict('This operation ID already belongs to a different team configuration'))
      return active.promise
    }
    const promise = queue.then(work)
    running.set(operationId, { fingerprint, promise })
    queue = promise.catch(() => {})
    void promise.finally(() => running.delete(operationId)).catch(() => {})
    return promise
  }

  async function createTeam(body) {
    const operationId = operationKey(body.operationId)
    const request = requestOf(body)
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex')
    const previous = own(records(), operationId)
    if (previous && previous.fingerprint !== fingerprint) throw conflict('This operation ID already belongs to a different team configuration')
    if (previous && !running.has(operationId)) return publicRecord(previous)
    return schedule(operationId, fingerprint, async () => {
      const existing = own(records(), operationId)
      if (existing) return publicRecord(existing)
      const plan = await planRequest(request)
      const record = {
        operationId, fingerprint, request, status: 'pending', createdAt: Date.now(), updatedAt: Date.now(),
        sectionId: `sec-${randomUUID().slice(0, 8)}`, roomStatus: 'pending',
        members: plan.members.map(input => ({
          presetId: input.presetId, name: input.name, status: input.botId ? 'complete' : 'pending',
          ...(input.botId ? { botId: input.botId, reused: true } : {}),
          ...(input.permission ? { permission: input.permission } : {}),
        })),
      }
      records()[operationId] = record
      await save()
      return run(record, plan)
    })
  }

  async function resumeTeamCreation(value) {
    const operationId = operationKey(value)
    const previous = own(records(), operationId)
    if (!previous) throw invalid('This team creation could not be found')
    return schedule(operationId, previous.fingerprint, async () => {
      const record = reconciled(previous, true)
      if (record.status === 'complete' || record.status === 'uncertain') return publicRecord(record)
      records()[operationId] = record
      let plan
      try { plan = await planRequest(record.request, record) } catch (error) {
        record.status = 'failed'
        record.error = String(error?.message ?? error)
        record.updatedAt = Date.now()
        await save()
        return publicRecord(record)
      }
      return run(record, plan)
    })
  }

  Object.assign(rt, { createTeam, teamCreationStatus, teamCreationsView, resumeTeamCreation, activateTeamBot })
}
