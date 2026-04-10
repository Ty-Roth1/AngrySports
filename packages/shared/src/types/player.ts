export type PlayerPosition = 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF' | 'DH' | 'SP' | 'RP'
export type PlayerStatus = 'active' | 'injured' | 'minors' | 'inactive'

export interface Player {
  id: string
  mlb_id: number
  full_name: string
  first_name: string
  last_name: string
  primary_position: PlayerPosition
  eligible_positions: PlayerPosition[]
  mlb_team: string
  mlb_team_id: number
  jersey_number: string | null
  bats: 'L' | 'R' | 'S' | null
  throws: 'L' | 'R' | null
  birth_date: string | null
  status: PlayerStatus
  is_rookie: boolean
  pro_debut_year: number | null
  photo_url: string | null
  updated_at: string
}

export interface PlayerStats {
  id: string
  player_id: string
  season_year: number
  game_date: string | null
  game_id: number | null
  // Batting
  ab: number
  h: number
  doubles: number
  triples: number
  hr: number
  rbi: number
  r: number
  bb: number
  so: number
  sb: number
  cs: number
  hbp: number
  sf: number
  avg: number | null
  obp: number | null
  slg: number | null
  // Pitching
  w: number
  l: number
  sv: number
  hld: number
  ip: number
  outs_recorded: number
  hits_allowed: number
  er: number
  bb_allowed: number
  k: number
  qs: number
  era: number | null
  whip: number | null
}
