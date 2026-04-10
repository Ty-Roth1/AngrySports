-- Add rank column to players for waiver wire sorting
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS rank integer DEFAULT NULL;

-- Index for fast waiver wire sorts
CREATE INDEX IF NOT EXISTS idx_players_rank ON public.players (rank) WHERE rank IS NOT NULL;
