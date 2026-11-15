import { createElement as h, Fragment, useEffect, useRef, useState } from 'react'
import { TEAM_ROLES, TEAM_BLUEPRINTS, CREATIVITY_MODES, buildRoleInstructions } from '../shared/team-presets.js'
import { BotMark } from './mark.js'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PeopleIcon, SearchIcon, PencilIcon, TerminalIcon } from './icons.js'
import { FolderMenu } from './folder-menu.js'
import { AvatarLibraryPanel } from './avatar-library.js'
import { presetName } from './permission-picker.js'
import { isLocalRoute } from './agent-routes.js'
import { hostText, t } from './i18n.js'
import { newTeamDraft, readTeamDraft, writeTeamDraft, teamPayload, teamDraftProblem } from './team-workspace-model.js'

const blueprintIcon = { software: TerminalIcon, research: SearchIcon, content: PencilIcon }
const field = (label, control, note) => h('label', { className: 'gw-field' }, h('span', { className: 'gw-label' }, t(label)), control, note ? h('span', { className: 'gw-note' }, note) : null)
const storage = () => { try { return localStorage } catch { return undefined } }
const modelName = (roster, ref) => (roster.models ?? []).find(item => item.ref === ref)?.name ?? ref
const newOperationId = () => `team-${crypto.randomUUID()}`

function RuntimeSelect({ member, roster, onChange, disabled = false }) {
  return h('select', { className: 'gw-input', 'aria-label': t('Runs on'), value: member.model || '', disabled, onChange: event => onChange(event.target.value) },
    h('option', { value: '' }, t('Configure later')),
    (roster.models ?? []).map(model => h('option', { key: model.ref, value: model.ref, disabled: model.needsKey === true }, `${model.providerName ?? model.provider ?? model.ref.split('/')[0]} · ${model.name}${model.needsKey ? ` · ${t('Needs a key')}` : ''}`)))
}

function MemberInspector({ role, member, roster, selected, update, locked, actions }) {
  const [looks, setLooks] = useState(false)
  const [library, setLibrary] = useState(false)
  const [proposed, setProposed] = useState(null)
  const reused = member.botId ? roster.byId[member.botId] : null
  const displayed = reused ?? { ...member, id: `preview-${role.id}` }
  const currentInstructions = reused?.instructions ?? member.instructions
  const changeCreativity = (creativity) => {
    if (creativity === member.creativity) return
    if (member.customized) { setProposed({ creativity, instructions: buildRoleInstructions(role.id, creativity) }); return }
    update({ creativity, instructions: buildRoleInstructions(role.id, creativity) })
  }
  return h('aside', { className: 'gw-inspector', 'aria-label': t('Member settings') },
    h('h2', null, t('Member settings')),
    h('div', { className: 'gw-inspector-hero' },
      h(BotMark, { bot: displayed, size: 156 }),
      h('div', null, h('h3', null, displayed.name), h('button', { type: 'button', className: 'gw-outline gw-small', disabled: locked || Boolean(reused), 'aria-expanded': looks, onClick: () => setLooks(value => !value) }, t('Change appearance')))),
    looks ? h('div', { className: 'gw-look-options', role: 'group', 'aria-label': t('Look') },
      TEAM_ROLES.map(option => h('button', { type: 'button', key: option.id, className: 'gw-look-choice', 'aria-label': t(option.name), 'aria-pressed': member.avatar.shape === option.character && !member.avatar.image, onClick: () => update({ avatar: { shape: option.character } }) }, h(BotMark, { bot: { avatar: { shape: option.character }, color: option.ink }, size: 40 }))),
      h('button', { type: 'button', className: 'gw-outline gw-small', onClick: () => setLibrary(value => !value), 'aria-expanded': library }, t('Avatar library'))) : null,
    library ? h(AvatarLibraryPanel, { actions, onPick: entry => { update({ avatar: { ...member.avatar, image: entry.image } }); setLibrary(false); setLooks(false) } }) : null,
    !selected ? h('p', { className: 'gw-note' }, t('Select this role to include it in your team.')) : null,
    field('Name', h('input', { className: 'gw-input', value: displayed.name, maxLength: 40, disabled: locked || Boolean(reused), onChange: event => update({ name: event.target.value }) })),
    field('Role', h('input', { className: 'gw-input', value: displayed.role ?? '', maxLength: 24, disabled: locked || Boolean(reused), onChange: event => update({ role: event.target.value }) })),
    h('div', { className: 'gw-responsibility' }, h('span', { className: 'gw-label' }, t('Responsibilities')), h('p', null, t(role.summary)), h('small', null, t(role.deliverables))),
    field('Runs on', h(RuntimeSelect, { member: reused ?? member, roster, disabled: locked || Boolean(reused), onChange: model => update({ model }) }), isLocalRoute(displayed.model)
      ? t('Local CLI tools follow their own setup. Shared connectors are not passed through automatically.')
      : displayed.model ? t('Uses a model configured on this computer.') : t('This member will wait until a model is configured.')),
    h('details', { className: 'gw-more' },
      h('summary', null, t('More settings')),
      field('Reuse an existing member', h('select', { className: 'gw-input', value: member.botId || '', disabled: locked, onChange: event => update({ botId: event.target.value }) },
        h('option', { value: '' }, t('Create a new member')),
        (roster.bots ?? []).filter(bot => !bot.private).map(bot => h('option', { key: bot.id, value: bot.id }, bot.name))), reused ? t('The existing member keeps its instructions, model, appearance, and permissions.') : null),
      field('Exploration', h('select', { className: 'gw-input', value: reused?.creativity ?? member.creativity, disabled: locked || Boolean(reused), onChange: event => changeCreativity(event.target.value) },
        CREATIVITY_MODES.map(mode => h('option', { key: mode.id, value: mode.id }, t(mode.label)))), t(CREATIVITY_MODES.find(mode => mode.id === (reused?.creativity ?? member.creativity))?.description ?? '')),
      proposed ? h('div', { className: 'gw-prompt-change', role: 'group', 'aria-label': t('Review instruction changes') },
        h('strong', null, t('Your instructions are customized')),
        h('p', { className: 'gw-note' }, t('Review the template before replacing your edits.')),
        h('details', null, h('summary', null, t('Current instructions')), h('pre', null, member.instructions)),
        h('details', { open: true }, h('summary', null, t('Proposed instructions')), h('pre', null, proposed.instructions)),
        h('div', { className: 'gw-actions' },
          h('button', { type: 'button', className: 'gw-outline gw-small', onClick: () => setProposed(null) }, t('Keep my instructions')),
          h('button', { type: 'button', className: 'gw-primary gw-small', onClick: () => { update({ ...proposed, customized: false }); setProposed(null) } }, t('Use template instructions')))) : null,
      field('Instructions', h('textarea', { className: 'gw-input gw-instructions', value: currentInstructions, rows: 8, disabled: locked || Boolean(reused), onChange: event => update({ instructions: event.target.value, customized: true }) }), member.customized && !reused ? t('Customized') : t('Includes the team agreement and role responsibilities.')),
      field('Permissions', h('select', { className: 'gw-input', value: reused?.permission ?? member.permission ?? '', disabled: locked || Boolean(reused), onChange: event => update({ permission: event.target.value }) },
        h('option', { value: '' }, t('Role default')),
        (roster.permissions?.options ?? []).map(option => h('option', { key: option.value, value: option.value }, presetName(option.value, roster.permissions)))), roster.permissions?.options?.length ? t('The selected permission preset applies before this member starts work.') : t('Permission presets are not available from this runtime.')),
      h('div', { className: 'gw-field' }, h('span', { className: 'gw-label' }, t('Member working folder')),
        h(FolderMenu, { value: reused?.workDir ?? member.workDir, group: true, actions, disabled: locked || Boolean(reused), wide: true, run: promise => Promise.resolve(promise).catch(error => actions.reportError(error, 'folder')), onPick: workDir => update({ workDir }) }))))
}

export function TeamCreationProgress({ record, actions, onRecord, onOpen, onStart, onConfigure, startReady = true, pending = false, error = '', onCheck, onRetrySaved }) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const finished = record?.status === 'complete'
  const unknown = record?.status === 'uncertain'
  const missing = record?.status === 'not-found'
  const resume = async () => {
    if (busy || !record?.canResume) return
    setBusy(true); setFailure('')
    try { onRecord(await actions.resumeTeamCreation(record.operationId)) }
    catch (problem) { setFailure(problem.message ?? String(problem)) }
    finally { setBusy(false) }
  }
  return h('div', { className: 'gw-creation-result', 'aria-live': 'polite' },
    h('div', { className: 'gw-result-face' }, h(BotMark, { bot: { avatar: { shape: 'team-elephant' }, color: 'violet' }, size: 148 })),
    h('h1', null, finished ? t('Your team is ready') : unknown ? t('Some results need checking') : missing ? t('Waiting for a saved result') : record?.status === 'failed' ? t('Your team is partly created') : t('Creating your team…')),
    h('p', { className: 'gw-lead' }, finished ? t('Your team is saved and waiting for your first goal.') : unknown ? t('Existing members are kept. Check the result before creating anything again.') : missing ? t('No saved result was found yet. A retry keeps the original request and its creation ID.') : t('Completed steps are saved. You can safely check the progress.')),
    record?.name ? h('h2', null, record.name) : null,
    h('div', { className: 'gw-creation-members' }, (record?.members ?? []).map(member => {
      const role = TEAM_ROLES.find(item => item.id === member.presetId)
      return h('div', { key: member.presetId, className: 'gw-creation-member' },
        h(BotMark, { bot: { avatar: { shape: role?.character }, color: role?.ink }, size: 48 }),
        h('span', null, member.name ?? t(role?.name ?? 'Member')),
        h('span', { className: 'gw-status' }, t(member.status === 'complete' ? 'Saved' : member.status === 'uncertain' ? 'Needs checking' : member.status === 'working' ? 'Creating…' : 'Waiting')),
        member.botId ? h('button', { type: 'button', className: 'gw-text-btn', onClick: () => actions.openSession(member.botId) }, t('Open member')) : null)
    })),
    record?.error || error || failure ? h('div', { className: 'gw-error', role: 'alert' }, hostText(failure || record?.error || error)) : null,
    h('div', { className: 'gw-actions gw-center' },
      finished ? h(Fragment, null,
        h('button', { type: 'button', className: 'gw-outline', onClick: () => onOpen(record.roomId) }, t('Open team')),
        h('button', { type: 'button', className: 'gw-primary', disabled: !startReady && !onConfigure, onClick: () => startReady ? onStart(record.roomId) : onConfigure() }, startReady ? t('Set the first goal') : t('Configure coordinator'), h(ChevronRightIcon)))
        : h(Fragment, null,
          h('button', { type: 'button', className: 'gw-outline', disabled: pending || busy, onClick: onCheck }, t('Check progress')),
          missing && onRetrySaved ? h('button', { type: 'button', className: 'gw-primary', disabled: pending || busy, onClick: onRetrySaved }, t('Retry saved request')) : null,
          record?.canResume ? h('button', { type: 'button', className: 'gw-primary', disabled: pending || busy, onClick: () => void resume() }, busy ? t('Resuming…') : t('Continue creation')) : null)))
}

export function TeamWizard({ roster, actions, recoveryId }) {
  const saved = useRef(readTeamDraft(storage(), recoveryId))
  const [draft, setDraft] = useState(() => saved.current?.draft ?? newTeamDraft(roster, t))
  const [active, setActive] = useState('coordinator')
  const [step, setStep] = useState(saved.current?.payload || recoveryId ? 'creating' : 'members')
  const [operationId, setOperationId] = useState(() => recoveryId ?? saved.current?.operationId ?? newOperationId())
  const [payload, setPayload] = useState(saved.current?.payload ?? null)
  const [record, setRecord] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const flight = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    // Inspecting another saved operation must not replace an unrelated draft.
    if (record?.status !== 'complete' && (!recoveryId || payload)) writeTeamDraft(storage(), { draft, operationId, payload })
  }, [draft, operationId, payload, record?.status, recoveryId])
  const updateRecord = (value) => {
    if (!alive.current) return
    setRecord(value)
    if (value?.status === 'complete' && readTeamDraft(storage(), value.operationId)) writeTeamDraft(storage(), null)
  }
  const check = async () => {
    if (flight.current) return
    flight.current = true; setBusy(true)
    try {
      const next = await actions.teamCreationStatus(operationId)
      updateRecord(next ?? { operationId, status: 'not-found', name: payload?.name, members: [], canResume: false })
      if (alive.current) setError('')
    } catch (failure) { if (alive.current) setError(failure.message ?? String(failure)) }
    finally { flight.current = false; if (alive.current) setBusy(false) }
  }
  useEffect(() => { if (saved.current?.payload || recoveryId) void check() }, [])
  useEffect(() => {
    if (step !== 'creating' || !record || busy) return undefined
    if (record.status !== 'working' && record.status !== 'pending') return undefined
    const timer = setTimeout(() => void check(), 2000)
    return () => clearTimeout(timer)
  }, [step, record, busy])
  const update = patch => setDraft(current => ({ ...current, members: { ...current.members, [active]: { ...current.members[active], ...patch } } }))
  const problem = teamDraftProblem(draft, roster)
  const role = TEAM_ROLES.find(item => item.id === active) ?? TEAM_ROLES[0]
  const member = draft.members[role.id]
  const selected = draft.selected.includes(role.id)
  const coordinatorId = record?.members?.find(entry => entry.presetId === 'coordinator')?.botId
  const coordinator = roster.byId[coordinatorId]
  const create = async () => {
    if (flight.current || (!payload && problem) || roster.readOnly) return
    const next = payload ?? teamPayload(draft, operationId)
    flight.current = true; setBusy(true); setError(''); setPayload(next); setStep('creating')
    writeTeamDraft(storage(), { draft, operationId, payload: next })
    try { updateRecord(await actions.createTeam(next)) }
    catch (failure) {
      try {
        const known = await actions.teamCreationStatus(operationId)
        if (known === null && String(failure.code ?? '').startsWith('bot/')) {
          updateRecord(null)
          if (alive.current) { setPayload(null); setStep('review'); setError(failure.message ?? String(failure)) }
        } else updateRecord(known ?? { operationId, status: 'not-found', name: next.name, members: [], canResume: false })
      } catch { if (alive.current) setError(t('The connection was interrupted. Check progress before trying again.')) }
    } finally { flight.current = false; if (alive.current) setBusy(false) }
  }
  const next = () => { if (!problem) { setError(''); setStep('review') } else setError(hostText(problem)) }
  const newDraft = () => {
    writeTeamDraft(storage(), null)
    setDraft(newTeamDraft(roster, t)); setOperationId(newOperationId()); setPayload(null); setRecord(null); setStep('members')
  }
  if (step === 'creating') return h(TeamCreationProgress, {
    record, actions, onRecord: updateRecord, pending: busy, error, onCheck: () => void check(), onRetrySaved: payload ? () => void create() : undefined,
    startReady: Boolean(coordinator?.model),
    onConfigure: coordinatorId ? () => actions.openSettings('bots', coordinatorId) : undefined,
    onOpen: id => actions.openWorkspace('home', id),
    onStart: id => { actions.openSession(id); actions.composeGoal(id) },
  })
  if (step === 'review') return h('div', { className: 'gw-review' },
    h('header', { className: 'gw-page-head' }, h('div', null, h('h1', null, t('Ready to work together')), h('p', { className: 'gw-lead' }, t('Review your members and choose a shared working folder.')))),
    h('section', { className: 'gw-review-card' },
      h('h2', null, draft.name),
      h('div', { className: 'gw-review-members' }, draft.selected.map(id => {
        const entry = draft.members[id]
        const bot = (entry.botId ? roster.byId[entry.botId] : null) ?? entry
        return h('div', { className: 'gw-review-member', key: id }, h(BotMark, { bot, size: 56 }), h('div', null, h('strong', null, bot.name), h('p', null, bot.role), h('small', null, bot.model ? modelName(roster, bot.model) : t('Configure later'))), h('span', { className: 'gw-status' }, t(entry.botId ? 'Existing member' : 'New member')))
      })),
      h('div', { className: 'gw-field' }, h('span', { className: 'gw-label' }, t('Shared working folder')),
        h(FolderMenu, { value: draft.workDir, group: true, actions, wide: true, run: promise => Promise.resolve(promise).catch(failure => setError(failure.message ?? String(failure))), onPick: workDir => setDraft(current => ({ ...current, workDir })) })),
      h('p', { className: 'gw-note' }, t('The coordinator assigns work when you send a goal. Saving this team does not start model calls.')),
      draft.selected.some(id => !(draft.members[id].botId ? roster.byId[draft.members[id].botId]?.model : draft.members[id].model)) ? h('p', { className: 'gw-notice' }, t('Some members need a model. Configure them before starting a goal.')) : null),
    error || problem ? h('div', { className: 'gw-error', role: 'alert' }, error || hostText(problem)) : null,
    h('footer', { className: 'gw-wizard-footer' }, h('button', { type: 'button', className: 'gw-text-btn', onClick: () => { setStep('members'); setError('') } }, h(ChevronLeftIcon), t('Edit members')),
      h('button', { type: 'button', className: 'gw-primary', disabled: busy || Boolean(problem) || Boolean(roster.readOnly), onClick: () => void create() }, busy ? t('Creating…') : t('Create team'), h(ChevronRightIcon))))
  return h('div', { className: 'gw-wizard' },
    h('div', { className: 'gw-wizard-layout' },
      h('section', { className: 'gw-picker' },
        h('header', { className: 'gw-page-head' }, h('div', null, h('h1', null, t('Build your Agent team')), h('p', { className: 'gw-lead' }, t('Choose your partners, define their roles, and reach your goals together.')))),
        h('div', { className: 'gw-team-form' },
          field('Team name', h('input', { className: 'gw-input', value: draft.name, maxLength: 32, onChange: event => setDraft(current => ({ ...current, name: event.target.value })) })),
          h('div', { className: 'gw-field gw-blueprints' }, h('span', { className: 'gw-label' }, t('Team template')), h('div', { className: 'gw-blueprint-options', role: 'group', 'aria-label': t('Team template') },
            TEAM_BLUEPRINTS.map(blueprint => h('button', { key: blueprint.id, type: 'button', className: 'gw-blueprint', 'aria-pressed': draft.blueprint === blueprint.id, onClick: () => setDraft(current => ({ ...current, blueprint: blueprint.id, selected: [...blueprint.roles] })) }, h(blueprintIcon[blueprint.id] ?? PeopleIcon), t(blueprint.name)))))),
        h('div', { className: 'gw-role-grid' }, TEAM_ROLES.map(option => {
          const entry = draft.members[option.id]
          const bot = (entry.botId ? roster.byId[entry.botId] : null) ?? entry
          const chosen = draft.selected.includes(option.id)
          return h('article', { key: option.id, className: 'gw-role-card', 'data-active': active === option.id || undefined, 'data-selected': chosen || undefined },
            h('button', { type: 'button', className: 'gw-role-detail', 'aria-label': t('Edit {name}', { name: t(option.name) }), 'aria-pressed': active === option.id, onClick: () => setActive(option.id) },
              h('span', { className: 'gw-role-art' }, h(BotMark, { bot, size: 188 })),
              h('span', { className: 'gw-role-title' }, t(option.name), entry.botId ? h('span', { className: 'gw-chip' }, t('Existing member')) : null),
              h('span', { className: 'gw-role-summary' }, t(option.summary))),
            h('label', { className: 'gw-role-check', title: t('Include {name}', { name: t(option.name) }) },
              h('input', { type: 'checkbox', checked: chosen, disabled: option.id === 'coordinator', 'aria-label': t('Include {name}', { name: t(option.name) }), onChange: event => setDraft(current => ({ ...current, selected: event.target.checked ? [...current.selected, option.id] : current.selected.filter(id => id !== option.id) })) }),
              h('span', { 'aria-hidden': true }, chosen ? h(CheckIcon) : null)))
        })),
        error ? h('div', { className: 'gw-error', role: 'alert' }, error) : null),
      h(MemberInspector, { key: active, role, member, roster, actions, selected, update, locked: false })),
    h('footer', { className: 'gw-wizard-footer' },
      h('button', { type: 'button', className: 'gw-text-btn', onClick: () => actions.openWorkspace('home') }, h(ChevronLeftIcon), t('Back')),
      h('div', { className: 'gw-selection-summary' }, h('strong', null, t('{count} members selected', { count: draft.selected.length })), h('span', null, t('Coordinated by {name}', { name: draft.members.coordinator.botId ? roster.byId[draft.members.coordinator.botId]?.name : draft.members.coordinator.name }))),
      h('button', { type: 'button', className: 'gw-primary', onClick: next, disabled: Boolean(roster.readOnly) }, t('Next: review team'), h(ChevronRightIcon))),
    saved.current && !payload ? h('button', { type: 'button', className: 'gw-reset-draft gw-text-btn', onClick: newDraft }, t('Start a fresh draft')) : null)
}
