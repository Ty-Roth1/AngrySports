export type MatchupStatus = 'upcoming' | 'active' | 'final'

export interface Matchup {
  id: string
  league_id: string
  season_year: number
  week: number
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  status: MatchupStatus
  period_start: string
  period_end: string
}

export interface TeamWeeklyScore {
  id: string
  matchup_id: string
  team_id: string
  total_points: number
  breakdown: Record<string, number>  // e.g. { HR: 32, K_pitcher: 18, ... }
  last_calculated_at: string
}

export interface Transaction {
  id: string
  league_id: string
  type: 'add' | 'drop' | 'trade' | 'waiver_claim' | 'commissioner'
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  initiated_by_team_id: string
  created_at: string
  processed_at: string | null
  notes: string | null
}

export interface TransactionItem {
  id: string
  transaction_id: string
  player_id: string
  from_team_id: string | null
  to_team_id: string | null
  faab_bid: number | null
}
