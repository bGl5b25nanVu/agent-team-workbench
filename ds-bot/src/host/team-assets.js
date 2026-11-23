import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { TEAM_ART } from '../shared/team-art.js'

// These exact public artwork routes never accept a filesystem path from a caller.
export function install(rt) {
  const { ctx } = rt
  const assets = { ...TEAM_ART, brand: { file: 'brand.png' } }
  for (const [id, { file }] of Object.entries(assets)) {
    let cached
    ctx.effect(() => ctx.connection.fetch.register({
      path: `/api/bot-art/${id}.png`,
      methods: ['GET', 'HEAD'],
      requestBody: 'buffered',
      fetch: async request => {
        try {
          if (!cached) {
            const bytes = await readFile(new URL(`./assets/${file}`, import.meta.url))
            cached = { bytes, etag: `"${createHash('sha256').update(bytes).digest('hex')}"` }
          }
          const headers = { 'content-type': 'image/png', 'cache-control': 'private, max-age=86400', etag: cached.etag, 'x-content-type-options': 'nosniff' }
          if (request.headers.get('if-none-match') === cached.etag) return new Response(null, { status: 304, headers })
          return new Response(request.method === 'HEAD' ? null : cached.bytes, { headers })
        } catch {
          return new Response('Artwork unavailable', { status: 404, headers: { 'cache-control': 'no-store' } })
        }
      },
    }), `gongzuo: artwork ${id}`)
  }
}
