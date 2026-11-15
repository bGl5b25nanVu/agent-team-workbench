import { TEAM_ART, teamArtUrl } from '../shared/team-art.js'

export const RASTER_CHARACTERS = Object.freeze(Object.fromEntries(
  Object.entries(TEAM_ART).map(([id, asset]) => [id, Object.freeze({ label: asset.label, image: teamArtUrl(id) })]),
))
export const BRAND_MARK_SRC = teamArtUrl('brand')
