import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { install } from '../src/host/team-assets.js'
import { TEAM_ART, teamArtUrl } from '../src/shared/team-art.js'

test('the six character images and brand are exact PNG routes with safe cache validation', async () => {
  const routes = []
  install({ ctx: { effect: run => run(), connection: { fetch: { register: route => routes.push(route) } } } })
  assert.deepEqual(routes.map(route => route.path), [
    '/api/bot-art/team-elephant.png', '/api/bot-art/team-owl.png',
    '/api/bot-art/team-robot.png', '/api/bot-art/team-fox.png',
    '/api/bot-art/team-hedgehog.png', '/api/bot-art/team-hummingbird.png',
    '/api/bot-art/brand.png',
  ])
  for (const route of routes) {
    assert.deepEqual(route.methods, ['GET', 'HEAD'])
    const request = new Request(`http://localhost${route.path}`)
    const response = await route.fetch(request)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.match(response.headers.get('cache-control'), /^private/)
    const bytes = new Uint8Array(await response.arrayBuffer())
    assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
    const etag = response.headers.get('etag')
    assert.match(etag, /^"[a-f0-9]{64}"$/)
    const head = await route.fetch(new Request(request.url, { method: 'HEAD' }))
    assert.equal(head.headers.get('etag'), etag)
    assert.equal((await head.arrayBuffer()).byteLength, 0)
    const unchanged = await route.fetch(new Request(request.url, { headers: { 'if-none-match': etag } }))
    assert.equal(unchanged.status, 304)
    assert.equal((await unchanged.arrayBuffer()).byteLength, 0)
  }
})

test('artwork GET and HEAD cross the authenticated DSH HTTP bridge', async t => {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  // Only this test's generated browser-session credential exists in memory.
  let record
  await ctx.plugin({
    name: 'artwork-test-credentials',
    apply: inner => inner.provide('credentials', {
      async modifyRecord(key, update) {
        record = await update(record) ?? record
        return record
      },
    }),
  })
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  await ctx.plugin(Connection)
  await ctx.plugin({ name: 'artwork-test-routes', inject: ['connection'], apply: inner => install({ ctx: inner }) })
  ctx.webServer.register({
    kind: 'exact', path: '/',
    handler: (request, response) => {
      if (ctx.connection.authorizeIndex(request, response)) response.end('ready')
    },
  })
  const origin = ctx.webServer.getOrigin()
  const login = await fetch(ctx.connection.authenticatedUrl(`${origin}/`), { redirect: 'manual' })
  assert.equal(login.status, 303)
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie, 'the isolated browser login supplies its session cookie')
  const urlFor = id => new URL(teamArtUrl(id), `${origin}/`)
  assert.equal((await fetch(urlFor('brand'))).status, 401, 'artwork must remain authenticated')
  for (const id of [...Object.keys(TEAM_ART), 'brand']) {
    const response = await fetch(urlFor(id), { headers: { cookie } })
    assert.equal(response.status, 200, `${id} must pass through DSH's HTTP request conversion`)
    assert.equal(response.headers.get('content-type'), 'image/png')
    const bytes = new Uint8Array(await response.arrayBuffer())
    assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
    const etag = response.headers.get('etag')
    const head = await fetch(urlFor(id), { method: 'HEAD', headers: { cookie } })
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('etag'), etag)
    assert.equal((await head.arrayBuffer()).byteLength, 0)
    const cached = await fetch(urlFor(id), { headers: { cookie, 'if-none-match': etag } })
    assert.equal(cached.status, 304)
    assert.equal((await cached.arrayBuffer()).byteLength, 0)
  }
  assert.equal((await fetch(urlFor('not-a-role'), { headers: { cookie } })).status, 404)
})
