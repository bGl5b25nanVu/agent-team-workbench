import { createElement as h, useEffect, useRef } from 'react'
import { TeamWizard } from './team-wizard.js'
import { TeamDashboard, TeamList } from './team-dashboard.js'
import { TeamInbox } from './team-inbox.js'
import { teamRooms } from './team-workspace-model.js'
import { t } from './i18n.js'

export function TeamWorkspace({ page, roomId, recoveryId, roster, work, actions, paneLeft, leaving = false }) {
  const root = useRef(null)
  const emptyEntry = useRef(null)
  if (page !== 'teams') emptyEntry.current = null
  else if (roster.ready && emptyEntry.current === null) emptyEntry.current = teamRooms(roster).length === 0
  // Keep an empty team's wizard mounted while the creation refresh publishes its
  // new room; otherwise that refresh would discard the result and pending draft.
  const actualPage = page === 'teams' && emptyEntry.current ? 'create' : page
  useEffect(() => {
    if (leaving) return
    root.current?.focus({ preventScroll: true })
  }, [actualPage, roomId, leaving])
  return h('main', { ref: root, className: 'gw-workspace', tabIndex: -1, 'data-page': actualPage, 'data-leaving': leaving || undefined, inert: leaving || undefined, style: { left: paneLeft }, 'aria-label': t('Agent team workspace') },
    h('nav', { className: 'gw-mobile-nav', 'aria-label': t('Workspace navigation') },
      [['home', 'Workbench'], ['teams', 'My teams'], ['inbox', 'Inbox'], [null, 'Chats']].map(([target, label]) => h('button', { key: label, type: 'button', className: 'gw-text-btn', 'aria-current': page === target ? 'page' : undefined, onClick: () => actions.openWorkspace(target) }, t(label)))),
    !roster.ready ? h('div', { className: 'gw-loading', role: 'status' }, t('Loading your team…'))
      : actualPage === 'create' ? h(TeamWizard, { key: recoveryId ?? 'new', roster, actions, recoveryId })
        : page === 'inbox' ? h(TeamInbox, { roster, work, actions })
          : page === 'teams' ? h(TeamList, { roster, work, actions })
            : h(TeamDashboard, { roster, work, actions, roomId }))
}
