import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install } from '../src/host/team-assets.js'

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
