import { createElement as h, useState } from 'react'
import { BotMark } from './mark.js'
import { ChevronRightIcon, CheckIcon } from './icons.js'
import { t } from './i18n.js'
import { teamInbox } from './team-workspace-model.js'

function InboxItem({ item, roster, actions }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const approval = item.approval
  const bot = roster.byId[approval?.botId ?? item.sessionId]
  const answer = async (choice) => {
    if (busy || !approval?.answerable || !approval.roomId) return
    setBusy(true); setError('')
    try { await actions.answerApproval(approval.id, choice) }
    catch (failure) { setError(failure.message ?? String(failure)) }
    finally { setBusy(false) }
  }
  const open = () => actions.openSession(item.sessionId)
  return h('article', { className: 'gw-inbox-item' },
    h('div', { className: 'gw-inbox-owner' }, h(BotMark, { bot, size: 44 }), h('div', null, h('strong', null, item.owner || t('Your team')), h('span', null, t(approval ? 'Waiting for your approval' : 'Waiting for your answer')))),
    h('h2', null, approval?.tool ?? item.question?.question ?? item.question?.title ?? t('A question for you')),
    approval?.detail?.text ? h('p', null, approval.detail.text) : null,
    approval?.reason ? h('p', { className: 'gw-note' }, approval.reason) : null,
    approval?.detail?.code ? h('pre', { className: 'gw-inbox-code' }, approval.detail.code) : null,
    item.question?.description ? h('p', null, item.question.description) : null,
    h('div', { className: 'gw-actions' },
      h('button', { type: 'button', className: 'gw-outline', onClick: open }, t('Open conversation'), h(ChevronRightIcon)),
      approval?.answerable === true && approval.roomId ? h('button', { type: 'button', className: 'gw-outline', disabled: busy, onClick: () => void answer('reject') }, t('Reject')) : null,
      approval?.answerable === true && approval.roomId ? h('button', { type: 'button', className: 'gw-primary', disabled: busy, onClick: () => void answer('allow') }, t('Allow once')) : null),
    error ? h('p', { className: 'gw-error', role: 'alert' }, error) : null)
}

export function TeamInbox({ roster, work, actions }) {
  const items = teamInbox(roster, work)
  return h('div', { className: 'gw-page' },
    h('header', { className: 'gw-page-head' }, h('div', null, h('h1', null, t('Needs your attention')), h('p', { className: 'gw-lead' }, t('Questions and approvals, together in one place.'))), h('span', { className: 'gw-count' }, items.length)),
    items.length ? h('div', { className: 'gw-inbox-list' }, items.map(item => h(InboxItem, { key: item.id, item, roster, actions })))
      : h('section', { className: 'gw-inbox-empty' }, h('span', { className: 'gw-empty-check' }, h(CheckIcon)), h('h2', null, t('You are all caught up')), h('p', null, t('Your team will bring important questions here.'))))
}
