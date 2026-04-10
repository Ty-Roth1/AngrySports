-- ============================================================
-- MIGRATION 002
-- 1. Fix infinite recursion in RLS policies (leagues ↔ fantasy_teams)
-- 2. Add IF (infielder) roster slot type
-- 3. Add configurable tiered salary cap to league_settings
-- 4. Add offline draft support
-- ============================================================

-- ============================================================
-- 1. SECURITY DEFINER HELPER — breaks the RLS cycle
--    This function runs without RLS, so policies can call it
--    without triggering recursion.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_league_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT league_id
    FROM public.fantasy_teams
    WHERE owner_id = auth.uid()
  )
$$;

-- ============================================================
-- 2. DROP OLD RECURSIVE POLICIES and replace them
-- ============================================================

-- leagues
DROP POLICY IF EXISTS "League members can view league" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Commissioner can update league" ON public.leagues;

CREATE POLICY "League members can view league" ON public.leagues FOR SELECT
  USING (commissioner_id = auth.uid() OR id = ANY(public.get_my_league_ids()));
CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Commissioner can update league" ON public.leagues FOR UPDATE
  USING (commissioner_id = auth.uid());

-- fantasy_teams
DROP POLICY IF EXISTS "League members can view teams" ON public.fantasy_teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.fantasy_teams;
DROP POLICY IF EXISTS "Owners can update their team" ON public.fantasy_teams;

CREATE POLICY "League members can view teams" ON public.fantasy_teams FOR SELECT
  USING (owner_id = auth.uid() OR league_id = ANY(public.get_my_league_ids()));
CREATE POLICY "Authenticated users can create teams" ON public.fantasy_teams FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owners can update their team" ON public.fantasy_teams FOR UPDATE
  USING (owner_id = auth.uid());

-- league_settings
DROP POLICY IF EXISTS "League members can view settings" ON public.league_settings;
DROP POLICY IF EXISTS "Commissioner can manage settings" ON public.league_settings;

CREATE POLICY "League members can view settings" ON public.league_settings FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));
CREATE POLICY "Commissioner can manage settings" ON public.league_settings FOR ALL
  USING (league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- scoring_categories
DROP POLICY IF EXISTS "League members can view scoring" ON public.scoring_categories;
DROP POLICY IF EXISTS "Commissioner can manage scoring" ON public.scoring_categories;

CREATE POLICY "League members can view scoring" ON public.scoring_categories FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));
CREATE POLICY "Commissioner can manage scoring" ON public.scoring_categories FOR ALL
  USING (league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- rosters
DROP POLICY IF EXISTS "League members can view rosters" ON public.rosters;
DROP POLICY IF EXISTS "Team owners can manage roster" ON public.rosters;

CREATE POLICY "League members can view rosters" ON public.rosters FOR SELECT
  USING (team_id IN (
    SELECT id FROM public.fantasy_teams
    WHERE league_id = ANY(public.get_my_league_ids())
  ));
CREATE POLICY "Team owners can manage roster" ON public.rosters FOR ALL
  USING (team_id IN (SELECT id FROM public.fantasy_teams WHERE owner_id = auth.uid()));

-- contracts
DROP POLICY IF EXISTS "League members can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Commissioner can manage contracts" ON public.contracts;

CREATE POLICY "League members can view contracts" ON public.contracts FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));
CREATE POLICY "Commissioner can manage contracts" ON public.contracts FOR ALL
  USING (league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- drafts
DROP POLICY IF EXISTS "League members can view drafts" ON public.drafts;

CREATE POLICY "League members can view drafts" ON public.drafts FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));
CREATE POLICY "Commissioner can manage drafts" ON public.drafts FOR ALL
  USING (league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- draft_order
DROP POLICY IF EXISTS "League members can view draft order" ON public.draft_order;

CREATE POLICY "League members can view draft order" ON public.draft_order FOR SELECT
  USING (draft_id IN (
    SELECT id FROM public.drafts
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));
CREATE POLICY "Commissioner can manage draft order" ON public.draft_order FOR ALL
  USING (draft_id IN (
    SELECT id FROM public.drafts
    WHERE league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- draft_picks
DROP POLICY IF EXISTS "League members can view draft picks" ON public.draft_picks;

CREATE POLICY "League members can view draft picks" ON public.draft_picks FOR SELECT
  USING (draft_id IN (
    SELECT id FROM public.drafts
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));
CREATE POLICY "Commissioner can manage draft picks" ON public.draft_picks FOR ALL
  USING (draft_id IN (
    SELECT id FROM public.drafts
    WHERE league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- auction_nominations
DROP POLICY IF EXISTS "League members can view nominations" ON public.auction_nominations;

CREATE POLICY "League members can view nominations" ON public.auction_nominations FOR SELECT
  USING (draft_id IN (
    SELECT id FROM public.drafts
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- matchups
DROP POLICY IF EXISTS "League members can view matchups" ON public.matchups;

CREATE POLICY "League members can view matchups" ON public.matchups FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- team_weekly_scores
DROP POLICY IF EXISTS "League members can view scores" ON public.team_weekly_scores;

CREATE POLICY "League members can view scores" ON public.team_weekly_scores FOR SELECT
  USING (matchup_id IN (
    SELECT id FROM public.matchups
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- player_game_scores
DROP POLICY IF EXISTS "League members can view game scores" ON public.player_game_scores;

CREATE POLICY "League members can view game scores" ON public.player_game_scores FOR SELECT
  USING (matchup_id IN (
    SELECT id FROM public.matchups
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- transactions
DROP POLICY IF EXISTS "League members can view transactions" ON public.transactions;

CREATE POLICY "League members can view transactions" ON public.transactions FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- transaction_items
DROP POLICY IF EXISTS "League members can view transaction items" ON public.transaction_items;

CREATE POLICY "League members can view transaction items" ON public.transaction_items FOR SELECT
  USING (transaction_id IN (
    SELECT id FROM public.transactions
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- trade_proposals
DROP POLICY IF EXISTS "League members can view trades" ON public.trade_proposals;

CREATE POLICY "League members can view trades" ON public.trade_proposals FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- trade_items
DROP POLICY IF EXISTS "League members can view trade items" ON public.trade_items;

CREATE POLICY "League members can view trade items" ON public.trade_items FOR SELECT
  USING (trade_proposal_id IN (
    SELECT id FROM public.trade_proposals
    WHERE league_id = ANY(public.get_my_league_ids())
       OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid())
  ));

-- waiver_claims
DROP POLICY IF EXISTS "League members can view waivers" ON public.waiver_claims;

CREATE POLICY "League members can view waivers" ON public.waiver_claims FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- schedule_weeks
DROP POLICY IF EXISTS "League members can view schedule" ON public.schedule_weeks;

CREATE POLICY "League members can view schedule" ON public.schedule_weeks FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- announcements
DROP POLICY IF EXISTS "League members can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Commissioner can manage announcements" ON public.announcements;

CREATE POLICY "League members can view announcements" ON public.announcements FOR SELECT
  USING (league_id = ANY(public.get_my_league_ids())
      OR league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));
CREATE POLICY "Commissioner can manage announcements" ON public.announcements FOR ALL
  USING (league_id IN (SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()));

-- ============================================================
-- 3. ADD IF (Infielder) SLOT TYPE
--    Drop and recreate the check constraint on rosters.slot_type
-- ============================================================

ALTER TABLE public.rosters
  DROP CONSTRAINT IF EXISTS rosters_slot_type_check;

ALTER TABLE public.rosters
  ADD CONSTRAINT rosters_slot_type_check
  CHECK (slot_type IN ('C','1B','2B','3B','SS','IF','OF','UTIL',
                       'SP','RP','P','BENCH','TAXI','IL'));

-- ============================================================
-- 4. TIERED SALARY CAP — add config columns to league_settings
-- ============================================================

ALTER TABLE public.league_settings
  ADD COLUMN IF NOT EXISTS cap_type text NOT NULL DEFAULT 'none'
    CHECK (cap_type IN ('none', 'hard', 'soft', 'soft_tiered')),
  ADD COLUMN IF NOT EXISTS cap_floor int,               -- min spend (optional)
  ADD COLUMN IF NOT EXISTS cap_tier_size int DEFAULT 10, -- interval above soft cap
  ADD COLUMN IF NOT EXISTS cap_penalties jsonb DEFAULT '[]'::jsonb;
  -- cap_penalties format:
  -- [
  --   { "tier": 1, "min": 200, "max": 209, "penalty_pct": 25 },
  --   { "tier": 2, "min": 210, "max": 219, "penalty_pct": 50 },
  --   ...
  -- ]

-- ============================================================
-- 5. ADD spots_if TO league_settings
-- ============================================================

ALTER TABLE public.league_settings
  ADD COLUMN IF NOT EXISTS spots_if int NOT NULL DEFAULT 0;

-- ============================================================
-- 6. OFFLINE DRAFT FLAG on drafts table
-- ============================================================

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS is_offline boolean NOT NULL DEFAULT false;

-- ============================================================
-- 7. ADD blown_saves TO player_game_scores raw_stats (jsonb — no migration needed)
--    But add bs column to player stats tracking table if we add one later.
--    For now, blown saves live in raw_stats jsonb as 'bs'.
-- ============================================================
