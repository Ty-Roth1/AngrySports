-- Fix: add unique constraint to player_game_scores so upserts work correctly.
-- Without this, every sync run inserted duplicates instead of updating.

-- Step 1: Remove duplicate rows, keeping the most recently calculated one
-- for each (player_id, matchup_id, mlb_game_id) combination.
delete from public.player_game_scores
where id not in (
  select distinct on (player_id, matchup_id, mlb_game_id) id
  from public.player_game_scores
  order by player_id, matchup_id, mlb_game_id, calculated_at desc
);

-- Step 2: Add the unique constraint so future upserts work as intended.
alter table public.player_game_scores
  add constraint player_game_scores_player_matchup_game_unique
  unique (player_id, matchup_id, mlb_game_id);
