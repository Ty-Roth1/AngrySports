export interface FantasyTeam {
  id: string
  league_id: string
  owner_id: string
  name: string
  abbreviation: string
  logo_url: string | null
  waiver_priority: number
  faab_remaining: number
  created_at: string
}

export type RosterSlotType =
  | 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF' | 'UTIL'
  | 'SP' | 'RP' | 'P' | 'BENCH' | 'TAXI' | 'IL'

export interface RosterSlot {
  id: string
  team_id: string
  player_id: string
  slot_type: RosterSlotType
  acquisition_type: 'draft' | 'waiver' | 'trade' | 'free_agent'
  acquisition_date: string
}

export interface Contract {
  id: string
  league_id: string
  team_id: string
  player_id: string
  years_total: number
  years_remaining: number
  salary: number             // auction dollar value or salary cap hit
  contract_type: 'standard' | 'rookie' | 'extension'
  is_protected: boolean      // keeper protection flag
  signed_at: string
  expires_after_season: number
}
