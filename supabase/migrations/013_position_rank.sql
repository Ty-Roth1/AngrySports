-- Add position_rank for per-position fantasy ranking
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS position_rank integer DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_players_position_rank
  ON public.players (primary_position, position_rank)
  WHERE position_rank IS NOT NULL;
