-- ============================================================
-- Migration 007: Add is_second_year flag to players
-- Second-year players (exceeded rookie limits the prior season)
-- are taxi-squad eligible alongside true rookies
-- ============================================================

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_second_year boolean NOT NULL DEFAULT false;
