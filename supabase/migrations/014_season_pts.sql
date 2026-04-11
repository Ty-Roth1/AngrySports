-- Add season_pts to store computed fantasy points from MLB season stats
-- Used for player rankings (covers all players including free agents)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS season_pts numeric DEFAULT NULL;

-- Ensure position_rank exists (may not have been applied from migration 013)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS position_rank integer DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_players_season_pts
  ON public.players (season_pts DESC NULLS LAST)
  WHERE season_pts IS NOT NULL;
