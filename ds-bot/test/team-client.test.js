import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const react = {
  createContext: value => ({ value }), useContext: context => context.value,
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: current => ({ current }), useEffect: () => {}, useLayoutEffect: () => {},
  useMemo: make => make(), useCallback: fn => fn, useId: () => 'team-test',
  useSyncExternalStore: (subscribe, read) => read(), Fragment: 'fragment',
}
const bundled = async (file) => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL(`../src/client/${file}`, import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', write: false,
    external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  })
  const modules = { react, 'react-dom': { createPortal: node => node }, '@deepseek-ai/dsh-client-ui-primitives': { MarkdownText: () => null } }
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, setTimeout, clearTimeout, URL, URLSearchParams,
    require: name => { assert.ok(name in modules, `Unknown platform module ${name}`); return modules[name] },
  })
  return module.exports
}
const [{ TeamCreationProgress }, { TeamDashboard }] = await Promise.all([bundled('team-wizard.js'), bundled('team-dashboard.js')])
const all = (node, match) => {
  if (!node || typeof node !== 'object') return []
  return [...(match(node) ? [node] : []), ...(node.children ?? []).flatMap(child => all(child, match))]
}
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : (node.children ?? []).map(text).join('')
const button = (tree, label) => all(tree, node => node.type === 'button' && text(node) === label)[0]

test('a team saved without a coordinator model guides setup before the first goal', () => {
  const calls = []
  const record = { status: 'complete', operationId: 'team-1', roomId: 'room-1', members: [] }
  const props = { record, actions: {}, onConfigure: () => calls.push('configure'), onStart: id => calls.push(id) }
  const waiting = TeamCreationProgress({ ...props, startReady: false })
  assert.equal(button(waiting, 'Set the first goal'), undefined)
  button(waiting, 'Configure coordinator').props.onClick()
  const ready = TeamCreationProgress({ ...props, startReady: true })
  button(ready, 'Set the first goal').props.onClick()
  assert.deepEqual(calls, ['configure', 'room-1'])
  const uncertain = TeamCreationProgress({ ...props, record: { status: 'uncertain', canResume: false, members: [] } })
  assert.equal(button(uncertain, 'Continue creation'), undefined)
  assert.equal(button(uncertain, 'Retry saved request'), undefined)
})

test('completed goal stages open their result while starting a new goal remains explicit', () => {
  const calls = []
  const room = { id: 'room-1', name: 'Delivery', members: ['coordinator'], admin: 'coordinator', team: {}, goal: { id: 'goal-1', title: 'Delivered', status: 'complete', current: 1, stages: [{ title: 'Release', status: 'passed', tasks: [] }] } }
  const roster = { rooms: [room], byId: { coordinator: { id: 'coordinator', name: 'Coordinator', model: 'configured/model' } }, questions: {} }
  const actions = { openSession: id => calls.push(['open', id]), toggleGoal: id => calls.push(['view', id]), composeGoal: id => calls.push(['compose', id]) }
  const tree = TeamDashboard({ roster, work: {}, actions })
  all(tree, node => node.props.className === 'gw-stage')[0].props.onClick()
  button(tree, 'Set a goal').props.onClick()
  assert.deepEqual(calls, [['open', 'room-1'], ['view', 'room-1'], ['open', 'room-1'], ['compose', 'room-1']])
})
