// A persistent, isolated mock-backed DSH preview. Never points at a user's profile.
// npm run harness && npm run build && npm run dev
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const plugin = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(plugin, 'dev/harness/node_modules/.bin/dsh')
if (!existsSync(cli)) throw new Error('Run npm run harness before starting the preview.')
const args = process.argv.slice(2)
const portAt = args.indexOf('--port')
const port = portAt >= 0 ? args[portAt + 1] : '4173'
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535 || port === '3080') throw new Error('Use an isolated development port.')
// DSH requires a concrete bind. The preview gateway forwards to loopback and
// preserves DSH authentication; wildcard flags from preview tools are not used.
const env = {
  ...process.env,
  DSH_TEST_CLI: cli,
  DSH_TEST_HOST: '127.0.0.1',
  DSH_TEST_TRUSTED_HOST: 'terminal.local:4173',
  CONTEXT_WINDOW: '100000',
  CHECK_RATIO: '0.45',
}
const benchArgs = ['dev/bench.sh', 'gongzuo-preview', port, '8796']
const run = action => spawn('sh', [...benchArgs, action], { cwd: plugin, env, stdio: 'inherit' })
const start = run('start')
let keepAlive
let closing = false
function close(code = 0) {
  if (closing) return
  closing = true
  clearInterval(keepAlive)
  run('stop').once('exit', () => process.exit(code))
}
start.once('exit', async code => {
  if (code !== 0) { close(code ?? 1); return }
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) })
    writeFileSync(join(plugin, '../.dsh-test-gongzuo-preview/preview-health.json'), JSON.stringify({ status: response.status, checkedAt: new Date().toISOString() }))
  } catch (error) {
    writeFileSync(join(plugin, '../.dsh-test-gongzuo-preview/preview-health.json'), JSON.stringify({ error: error.message }))
  }
  console.log(`Gongzuo mock preview ready on port ${port}.`)
  keepAlive = setInterval(() => {}, 60_000)
})
process.on('SIGTERM', () => close())
process.on('SIGINT', () => close())
