export type DraftStatus = 'pending' | 'active' | 'paused' | 'completed'
export type DraftPhase = 'free_agency' | 'rookie_draft'

export interface Draft {
  id: string
  league_id: string
  phase: DraftPhase
  draft_type: 'auction' | 'snake'
  status: DraftStatus
  current_pick: number
  current_round: number
  current_team_id: string | null
  pick_time_seconds: number
  started_at: string | null
  completed_at: string | null
}

export interface DraftPick {
  id: string
  draft_id: string
  team_id: string
  player_id: string
  pick_number: number
  round: number
  bid_amount: number | null    // for auction drafts
  nominated_by_team_id: string | null
  picked_at: string
}

export interface AuctionNomination {
  id: string
  draft_id: string
  player_id: string
  nominated_by_team_id: string
  current_bid: number
  current_high_bidder_team_id: string | null
  bid_deadline: string | null
  status: 'active' | 'sold' | 'expired'
}
