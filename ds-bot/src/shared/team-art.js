export const TEAM_ART = Object.freeze({
  'team-elephant': Object.freeze({ label: 'Coordinator', file: 'coordinator-elephant.png' }),
  'team-owl': Object.freeze({ label: 'Researcher', file: 'researcher-owl.png' }),
  'team-robot': Object.freeze({ label: 'Engineer', file: 'engineer-robot.png' }),
  'team-fox': Object.freeze({ label: 'Designer', file: 'designer-fox.png' }),
  'team-hedgehog': Object.freeze({ label: 'Tester', file: 'tester-hedgehog.png' }),
  'team-hummingbird': Object.freeze({ label: 'Operator', file: 'operator-hummingbird.png' }),
})

export const TEAM_ART_VERSION = '1'
export const teamArtUrl = id => `api/bot-art/${id}.png?v=${TEAM_ART_VERSION}`
