// These are observations of the isolated test runtime, never a source of UI state.
export function teamCallOwner(call, { room, coordinator, bots }) {
  const privateSession = coordinator.sessionId ?? coordinator.id
  const memberNames = room.members.map(id => bots[id]).filter(Boolean)
    .map(bot => `${bot.name}${room.admin === bot.id ? ' (admin)' : ''}`)
  const groupSubject = `The group chat: "${room.name}", with the user and ${memberNames.join(', ')}.`
  const botSubject = `The Bot: ${coordinator.name}${coordinator.role ? `, ${coordinator.role}` : ''}.`
  const memory = call.memoryReview
  if (memory) {
    let result
    try { result = call.out?.length === 1 && call.out[0].type === 'text' ? JSON.parse(call.out[0].text) : undefined } catch {}
    const scope = memory.scope === 'group' ? 'group chat' : memory.scope === 'bot' ? 'Bot' : ''
    const verified = scope && memory.systemMarker === `You keep the long-term memory of one ${scope} in DS Bot,`
      && memory.toolCount === 0 && call.messages === 1 && Array.isArray(result?.changes)
      && (call.first ?? '').split('\n')[0] === memory.subject?.slice(0, 60)
    if (!verified) return 'unexpected-session'
    // store.js: sessionOfRoom(room) is room.sessionId ?? room.id for the current
    // transcript. Automatic reviewGroup deliberately tags live.id instead.
    if (memory.scope === 'group' && call.session === room.id && memory.subject === groupSubject) return 'group-memory-review'
    if (memory.scope === 'bot' && call.session === privateSession && memory.subject === botSubject) return 'coordinator-private-memory-review'
    return 'unexpected-session'
  }
  if (call.session === room.sessions?.[coordinator.id]) return 'coordinator-group'
  if (call.session === privateSession) return 'coordinator-private'
  return 'unexpected-session'
}

export function teamCallCounts(calls) {
  return calls.reduce((counts, call) => {
    counts[call.owner] = (counts[call.owner] || 0) + 1
    return counts
  }, {})
}
