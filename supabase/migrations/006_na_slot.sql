-- ============================================================
-- Migration 006: Add NA (Not Active / Minor League) roster slot
-- ============================================================

-- Drop and recreate the slot_type check to include NA
ALTER TABLE public.rosters
  DROP CONSTRAINT IF EXISTS rosters_slot_type_check;

ALTER TABLE public.rosters
  ADD CONSTRAINT rosters_slot_type_check
  CHECK (slot_type IN (
    'C','1B','2B','3B','SS','IF','OF','UTIL',
    'SP','RP','P',
    'BENCH','IL','TAXI','NA'
  ));
