import { createElement as h, Fragment, useState } from 'react'
import { TEAM_BLUEPRINTS } from '../shared/team-presets.js'
import { BotMark, RoomAvatar } from './mark.js'
import { ChevronRightIcon, PlusIcon, GoalIcon, PeopleIcon, ChatsIcon, GearIcon } from './icons.js'
import { canSetGoal } from './goal.js'
import { t } from './i18n.js'
import { teamRooms, teamActivity, teamInbox } from './team-workspace-model.js'

export const taskLabel = status => t({ pending: 'To do', working: 'Working', reported: 'Awaiting review', done: 'Accepted' }[status] ?? 'To do')
const goalLabel = status => t({ drafting: 'Aligning the goal', active: 'In progress', paused: 'Paused', complete: 'Goal reached', stopped: 'Stopped' }[status] ?? 'Waiting for a goal')

export function TeamRoomCard({ room, roster, work, actions }) {
  const active = teamActivity(room, work)
  return h('button', { type: 'button', className: 'gw-team-card', onClick: () => actions.openWorkspace('home', room.id) },
    h('div', { className: 'gw-team-card-top' }, h(RoomAvatar, { room, roster, size: 64 }), h('span', { className: 'gw-status', 'data-state': room.goal?.status }, goalLabel(room.goal?.status))),
    h('h2', null, room.name),
    h('p', null, room.goal?.title || t(TEAM_BLUEPRINTS.find(item => item.id === room.team?.blueprint)?.name ?? 'Agent team')),
    h('div', { className: 'gw-team-card-foot' }, h('span', null, t('{count} members', { count: room.members.length })), h('span', null, active.active.size ? t('{count} working', { count: active.active.size }) : t('Ready when you are')), h(ChevronRightIcon)))
}

export function TeamList({ roster, work, actions }) {
  const rooms = teamRooms(roster)
  return h('div', { className: 'gw-page' },
    h('header', { className: 'gw-page-head' }, h('div', null, h('h1', null, t('My teams')), h('p', { className: 'gw-lead' }, t('Long-lived partners, clear responsibilities, shared goals.'))), h('button', { type: 'button', className: 'gw-primary', onClick: () => actions.openWorkspace('create') }, h(PlusIcon), t('Create team'))),
    h(RecoveryList, { roster, actions }),
    h('div', { className: 'gw-team-grid' }, rooms.map(room => h(TeamRoomCard, { key: room.id, room, roster, work, actions }))),
    rooms.length === 0 ? h(EmptyTeam, { actions }) : null)
}

export function RecoveryList({ roster, actions }) {
  const records = (roster.teamCreations ?? []).filter(record => record.status !== 'complete')
  return records.length ? h('section', { className: 'gw-recovery-list', 'aria-label': t('Unfinished team setup') },
    records.map(record => h('div', { className: 'gw-notice gw-recovery', key: record.operationId },
      h('div', null, h('strong', null, record.name || t('Unfinished team setup')), h('p', null, record.status === 'uncertain' ? t('Some results need checking') : t('Completed steps are saved. Continue from where you stopped.'))),
      h('button', { type: 'button', className: 'gw-outline gw-small', onClick: () => actions.openWorkspace('create', null, record.operationId) }, t('Check progress'))))) : null
}

export function EmptyTeam({ actions }) {
  return h('section', { className: 'gw-empty-team' },
    h(BotMark, { bot: { avatar: { shape: 'team-elephant' }, color: 'violet' }, size: 170 }),
    h('h2', null, t('A team for your next idea')),
    h('p', null, t('Choose the roles you need. Your coordinator brings the work together.')),
    h('button', { type: 'button', className: 'gw-primary', onClick: () => actions.openWorkspace('create') }, h(PlusIcon), t('Build my team')))
}

export function TeamDashboard({ roster, work, actions, roomId }) {
  const rooms = teamRooms(roster)
  const room = rooms.find(item => item.id === roomId) ?? rooms[0]
  const [controlBusy, setControlBusy] = useState(false)
  const [error, setError] = useState('')
  const inbox = teamInbox(roster, work)
  const running = new Set(Object.keys(work.bots ?? {}))
  for (const entries of Object.values(work.rooms ?? {})) for (const entry of entries) running.add(entry.botId)
  const control = async (action, stopWork = false) => {
    if (controlBusy || !room?.goal) return
    setControlBusy(true); setError('')
    try { await actions.goalControl(room.id, room.goal.id, action, stopWork) }
    catch (failure) { setError(failure.message ?? String(failure)) }
    finally { setControlBusy(false) }
  }
  const goal = room?.goal
  const current = goal?.stages?.[goal.current]
  const activity = room ? teamActivity(room, work) : { active: new Set(), waitingReview: 0 }
  const tasks = current?.tasks ?? []
  const admin = roster.byId[room?.admin]
  const openGoal = () => { actions.openSession(room.id); actions.toggleGoal(room.id) }
  const startGoal = () => { actions.openSession(room.id); actions.composeGoal(room.id) }
  const canStart = canSetGoal(room, roster)
  return h('div', { className: 'gw-page' },
    h('header', { className: 'gw-page-head' }, h('div', null, h('h1', null, t('Workbench')), h('p', { className: 'gw-lead' }, t('See what is moving, what is ready, and what needs you.'))), h('button', { type: 'button', className: 'gw-primary', onClick: () => actions.openWorkspace('create') }, h(PlusIcon), t('Create team'))),
    h('div', { className: 'gw-stats' },
      [[rooms.length, 'Teams', PeopleIcon], [running.size, 'Working now', GoalIcon], [inbox.length, 'Needs your attention', ChatsIcon]].map(([value, label, Icon]) => h('button', { type: 'button', className: 'gw-stat', key: label, onClick: () => actions.openWorkspace(label === 'Needs your attention' ? 'inbox' : 'teams') }, h(Icon), h('span', null, h('strong', null, value), h('small', null, t(label)))))),
    h(RecoveryList, { roster, actions }),
    !room ? h(EmptyTeam, { actions }) : h(Fragment, null,
      h('div', { className: 'gw-room-switch' }, h('label', null, t('Current team'), h('select', { value: room.id, className: 'gw-input', onChange: event => actions.openWorkspace('home', event.target.value) }, rooms.map(item => h('option', { key: item.id, value: item.id }, item.name)))),
        h('button', { type: 'button', className: 'gw-outline', onClick: () => actions.openSession(room.id) }, h(ChatsIcon), t('Open conversation')),
        h('button', { type: 'button', className: 'gw-icon-button', 'aria-label': t('Team settings'), onClick: () => actions.openSettings('groups', room.id) }, h(GearIcon))),
      h('section', { className: 'gw-goal-card' },
        h('div', { className: 'gw-goal-heading' }, h('div', null, h('span', { className: 'gw-eyebrow' }, t('Current goal')), h('h2', null, goal?.title || t('What would you like to accomplish?'))), h('span', { className: 'gw-status', 'data-state': goal?.status }, goalLabel(goal?.status))),
        h('p', null, goal?.objective || t('Tell your coordinator the result you want and how you will know it is done.')),
        goal?.stages?.length ? h('div', { className: 'gw-stage-list', role: 'list', 'aria-label': t('Goal stages') }, goal.stages.map((stage, index) => h('button', { type: 'button', role: 'listitem', className: 'gw-stage', key: index, 'data-state': stage.status, onClick: openGoal }, h('span', null, String(index + 1).padStart(2, '0')), h('strong', null, stage.title), h('small', null, t(stage.status === 'passed' ? 'Accepted' : stage.status === 'active' ? 'In progress' : 'Upcoming'))))) : null,
        h('div', { className: 'gw-goal-actions' },
          h('button', { type: 'button', className: 'gw-primary', onClick: canStart ? startGoal : openGoal, disabled: canStart ? !admin?.model : !goal }, canStart ? t('Set a goal') : t('View goal'), h(ChevronRightIcon)),
          admin && !admin.model ? h('button', { type: 'button', className: 'gw-outline', onClick: () => actions.openSettings('bots', admin.id) }, t('Configure coordinator')) : null,
          goal?.status === 'active' ? h('button', { type: 'button', className: 'gw-outline', disabled: controlBusy, onClick: () => void control('pause') }, t('Pause goal')) : null,
          goal?.status === 'paused' ? h('button', { type: 'button', className: 'gw-outline', disabled: controlBusy, onClick: () => void control('resume') }, t('Resume goal')) : null,
          activity.active.size ? h('button', { type: 'button', className: 'gw-outline', disabled: controlBusy, onClick: async () => { setControlBusy(true); setError(''); try { await actions.stopRoomWork(room.id) } catch (failure) { setError(failure.message ?? String(failure)) } finally { setControlBusy(false) } } }, t('Stop current work')) : null),
        error ? h('p', { className: 'gw-error', role: 'alert' }, error) : null),
      current ? h('section', { className: 'gw-task-section' }, h('div', { className: 'gw-section-heading' }, h('h2', null, current.title), h('span', { className: 'gw-note' }, t('{count} awaiting review', { count: tasks.filter(task => task.status === 'reported').length }))),
        current.acceptance ? h('p', { className: 'gw-note' }, current.acceptance) : null,
        h('div', { className: 'gw-task-board' }, ['pending', 'working', 'reported', 'done'].map(status => h('div', { className: 'gw-task-column', key: status }, h('h3', null, taskLabel(status), h('span', null, tasks.filter(task => task.status === status).length)), tasks.filter(task => task.status === status).map((task, index) => h('button', { type: 'button', className: 'gw-task-card', key: `${task.botId}:${index}`, onClick: openGoal }, h('p', null, task.task), h('span', { className: 'gw-task-owner' }, h(BotMark, { bot: roster.byId[task.botId], size: 28 }), roster.byId[task.botId]?.name ?? t('Member')))), tasks.every(task => task.status !== status) ? h('span', { className: 'gw-task-empty' }, t('No tasks')) : null)))) : null,
      h('section', { className: 'gw-member-section' }, h('div', { className: 'gw-section-heading' }, h('h2', null, t('Your partners')), h('span', { className: 'gw-note' }, t('Only members needed for a task start working.'))),
        h('div', { className: 'gw-members-grid' }, room.members.map(id => roster.byId[id]).filter(Boolean).map(bot => h('button', { type: 'button', className: 'gw-member-card', key: bot.id, onClick: () => actions.openSettings('bots', bot.id) }, h(BotMark, { bot, size: 84, state: activity.active.has(bot.id) ? 'working' : 'idle' }), h('strong', null, bot.name), h('span', null, bot.role), h('small', { className: 'gw-status' }, t(activity.active.has(bot.id) ? 'Working' : bot.model ? 'Ready' : 'Needs a model'))))))))
}
