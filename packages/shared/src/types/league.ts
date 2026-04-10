export type DraftType = 'auction' | 'snake'
export type ScoringType = 'head_to_head_points' | 'rotisserie'
export type LeagueStatus = 'setup' | 'drafting' | 'active' | 'offseason'

export interface League {
  id: string
  name: string
  commissioner_id: string
  status: LeagueStatus
  scoring_type: ScoringType
  season_year: number
  max_teams: number
  is_keeper_league: boolean
  is_contract_league: boolean
  has_taxi_squad: boolean
  taxi_squad_size: number
  created_at: string
}

export interface LeagueSettings {
  id: string
  league_id: string
  // Roster slot counts
  roster_spots_c: number
  roster_spots_1b: number
  roster_spots_2b: number
  roster_spots_3b: number
  roster_spots_ss: number
  roster_spots_of: number
  roster_spots_util: number
  roster_spots_sp: number
  roster_spots_rp: number
  roster_spots_p: number
  roster_spots_bench: number
  taxi_squad_size: number
  // Draft settings
  draft_type: DraftType
  auction_budget: number
  snake_rounds: number
  // Waiver settings
  waiver_type: 'standard' | 'faab'
  faab_budget: number
  // Contract settings (contract leagues)
  max_contract_years: number
  rookie_contract_years: number
}

export interface ScoringCategory {
  id: string
  league_id: string
  stat_key: string        // e.g. 'HR', 'K', 'IP', 'OUTS', 'ERA'
  label: string           // e.g. 'Home Run', 'Strikeout', 'Innings Pitched'
  points_per_unit: number // e.g. 4, 2, 3, 1
  is_batting: boolean
  is_pitching: boolean
}
