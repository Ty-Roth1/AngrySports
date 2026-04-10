-- ============================================================
-- MIGRATION 003 — Phase 3-6: Write policies + schema additions
-- ============================================================

-- Add unique constraint on player_game_scores for idempotent scoring sync
-- (IF NOT EXISTS not supported for constraints in PG — use DO block)
DO $$ BEGIN
  ALTER TABLE public.player_game_scores
    ADD CONSTRAINT player_game_scores_unique_game
    UNIQUE (player_id, matchup_id, mlb_game_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TRANSACTIONS — team owners can create
-- ============================================================

CREATE POLICY "Team owners can insert transactions" ON public.transactions FOR INSERT
  WITH CHECK (
    initiated_by_team_id IN (SELECT id FROM public.fantasy_teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Commissioner can insert transactions" ON public.transactions FOR INSERT
  WITH CHECK (
    league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  );

-- ============================================================
-- TRANSACTION ITEMS — insert alongside own transactions
-- ============================================================

CREATE POLICY "Team owners can insert transaction items" ON public.transaction_items FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE initiated_by_team_id IN (SELECT id FROM public.fantasy_teams WHERE owner_id = auth.uid())
         OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
    )
  );

-- ============================================================
-- WAIVER CLAIMS — team owners submit; commissioner manages
-- ============================================================

CREATE POLICY "Team owners can submit waiver claims" ON public.waiver_claims FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM public.fantasy_teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Team owners can cancel their waiver claims" ON public.waiver_claims FOR UPDATE
  USING (
    team_id IN (SELECT id FROM public.fantasy_teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Commissioner can manage all waiver claims" ON public.waiver_claims FOR ALL
  USING (
    league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  );

-- ============================================================
-- MATCHUPS — commissioner can create/update (for schedule gen + score updates)
-- ============================================================

CREATE POLICY "Commissioner can manage matchups" ON public.matchups FOR ALL
  USING (
    league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  );

-- ============================================================
-- SCHEDULE WEEKS — commissioner can manage
-- ============================================================

CREATE POLICY "Commissioner can manage schedule weeks" ON public.schedule_weeks FOR ALL
  USING (
    league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  );

-- ============================================================
-- TEAM WEEKLY SCORES — insert/update (service role via admin client)
-- We rely on admin client to bypass RLS for these two tables.
-- Add a commissioner policy as a safety net.
-- ============================================================

CREATE POLICY "Commissioner can manage weekly scores" ON public.team_weekly_scores FOR ALL
  USING (
    matchup_id IN (
      SELECT id FROM public.matchups
      WHERE league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
    )
  );

CREATE POLICY "Commissioner can manage player game scores" ON public.player_game_scores FOR ALL
  USING (
    matchup_id IN (
      SELECT id FROM public.matchups
      WHERE league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
    )
  );

-- ============================================================
-- WAIVER TYPE — add 'none' option (open free agency, no waivers)
-- ============================================================

ALTER TABLE public.league_settings
  DROP CONSTRAINT IF EXISTS league_settings_waiver_type_check;

ALTER TABLE public.league_settings
  ADD CONSTRAINT league_settings_waiver_type_check
  CHECK (waiver_type IN ('standard', 'faab', 'reverse_standings', 'none'));
