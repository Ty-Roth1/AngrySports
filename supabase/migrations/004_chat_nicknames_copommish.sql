-- ============================================================
-- Migration 004: League Chat, Player Nicknames, Co-Commissioner
-- ============================================================

-- Co-commissioner support: add column to leagues
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS co_commissioner_id uuid references public.profiles(id);

-- Player nicknames (per-league)
CREATE TABLE IF NOT EXISTS public.player_nicknames (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  nickname    text not null,
  set_by      uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  UNIQUE (league_id, player_id)
);

-- League chat messages
CREATE TABLE IF NOT EXISTS public.league_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  body        text not null check (char_length(body) <= 2000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz  -- soft delete
);

-- Chat reactions (emoji reactions on messages)
CREATE TABLE IF NOT EXISTS public.league_chat_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.league_chat_messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  emoji       text not null check (char_length(emoji) <= 8),
  created_at  timestamptz not null default now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Pitcher probable starts (populated by a sync job)
CREATE TABLE IF NOT EXISTS public.pitcher_probable_starts (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references public.players(id) on delete cascade,
  mlb_player_id int,
  game_date   date not null,
  opponent    text,
  home_away   text check (home_away in ('home','away')),
  game_time   timestamptz,
  fetched_at  timestamptz not null default now(),
  UNIQUE (mlb_player_id, game_date)
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.player_nicknames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitcher_probable_starts ENABLE ROW LEVEL SECURITY;

-- Nicknames: readable by league members, writable by commissioner/co-commish
CREATE POLICY "League members can view nicknames"
  ON public.player_nicknames FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fantasy_teams
      WHERE fantasy_teams.league_id = player_nicknames.league_id
        AND fantasy_teams.owner_id = auth.uid()
    )
  );

CREATE POLICY "Commissioner can manage nicknames"
  ON public.player_nicknames FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = player_nicknames.league_id
        AND (leagues.commissioner_id = auth.uid() OR leagues.co_commissioner_id = auth.uid())
    )
  );

-- Chat messages: readable by league members, insert by members, update/delete own
CREATE POLICY "League members can read chat"
  ON public.league_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fantasy_teams
      WHERE fantasy_teams.league_id = league_chat_messages.league_id
        AND fantasy_teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = league_chat_messages.league_id
        AND (leagues.commissioner_id = auth.uid() OR leagues.co_commissioner_id = auth.uid())
    )
  );

CREATE POLICY "League members can send chat messages"
  ON public.league_chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.fantasy_teams
        WHERE fantasy_teams.league_id = league_chat_messages.league_id
          AND fantasy_teams.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.leagues
        WHERE leagues.id = league_chat_messages.league_id
          AND (leagues.commissioner_id = auth.uid() OR leagues.co_commissioner_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can edit or delete their own chat messages"
  ON public.league_chat_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Reactions: readable by league members, toggle by members
CREATE POLICY "League members can view reactions"
  ON public.league_chat_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.league_chat_messages m
      JOIN public.fantasy_teams ft ON ft.league_id = m.league_id
      WHERE m.id = league_chat_reactions.message_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.league_chat_messages m
      JOIN public.leagues l ON l.id = m.league_id
      WHERE m.id = league_chat_reactions.message_id
        AND (l.commissioner_id = auth.uid() OR l.co_commissioner_id = auth.uid())
    )
  );

CREATE POLICY "League members can add reactions"
  ON public.league_chat_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.league_chat_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Pitcher starts: public read
CREATE POLICY "Anyone can read probable starts"
  ON public.pitcher_probable_starts FOR SELECT
  USING (true);

-- ============================================================
-- Realtime: enable for chat tables (wrapped in DO block to
-- handle projects where the publication doesn't exist yet)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.league_chat_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.league_chat_reactions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if tables are already in the publication
END $$;
