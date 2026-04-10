# Angry Sports — Fantasy Baseball Platform

A full-featured, custom fantasy baseball web app built for keeper/contract leagues. Supports live scoring, auctions, trades, rosters, waivers, and more.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Styling | Tailwind CSS v4 |
| Deployment | Vercel |
| Data | MLB Stats API (statsapi.mlb.com) |

---

## Features

### League Management
- Create and configure leagues with custom roster spots, scoring categories, and settings
- Commissioner and co-commissioner roles with full admin access
- Contract leagues with salary caps, multi-year deals, and contract types
- Taxi squads for rookies and second-year players
- NA slot for minor league stash players

### Draft
- Auction draft with live bidding, timers, and nomination queue
- Real-time draft room using Supabase Realtime
- Rookie draft support with tradeable pick assets

### Roster & Lineup
- Full position eligibility system (C, 1B, 2B, 3B, SS, IF, OF, UTIL, SP, RP, P, BN, IL, TAXI, NA)
- Daily lineup management with date navigation (view past stats, set future lineups)
- Commissioner roster management: add, drop, and move players on any team
- Player headshots via the MLB media CDN

### Scoring
- Live fantasy point calculation from MLB box scores
- Configurable scoring categories with custom point values (per-league)
- Auto-refresh during game hours (every 2 minutes)
- Vercel cron job runs every 10 minutes during game windows (4pm–11pm UTC)
- Retroactive backfill tool for syncing historical game dates

### Waivers & Free Agents
- FAAB bidding system with configurable budgets
- Free agent search with position filtering
- Waiver wire sorted by player value (active players first, then by position scarcity)

### Trades
- Propose, accept, and reject trades between teams
- Trade deadline enforcement
- Trade review period with commissioner veto option
- Tradeable draft pick assets

### Standings & Matchups
- Weekly head-to-head matchups with live score updates via Supabase Realtime
- Full standings table with W/L/T, PF, PA, and last-5 streak
- Playoff cutline indicator
- Matchup history per team

### Player Database
- Full MLB roster sync from the official MLB Stats API
- Rookie and second-year player flags
- Player status tracking (active, injured, minors, inactive)
- Fantasy rankings computed from season stats

### Commissioner Tools
- Roster spot configuration (per slot type)
- Schedule generation (round-robin regular season + playoffs)
- Single-day score sync and date-range backfill
- Player rankings sync
- Probable starter sync (today + 2 days)
- Player nickname manager
- Score diagnostics endpoint

### Chat
- League chat with per-message timestamps
- Player nickname display

---

## Project Structure

```
fanbase_app/
├── apps/
│   └── web/                        # Next.js app
│       ├── app/
│       │   ├── admin/              # Admin tools (sync, diagnostics)
│       │   ├── api/
│       │   │   ├── leagues/        # League CRUD, settings, roster ops, trades
│       │   │   ├── players/        # Player sync, rankings
│       │   │   ├── pitchers/       # Probable starter sync
│       │   │   ├── scoring/        # Score sync + cron
│       │   │   └── debug/          # Diagnostic endpoints
│       │   ├── dashboard/          # User home (league list)
│       │   ├── league/[id]/
│       │   │   ├── roster/         # My roster + lineup management
│       │   │   ├── matchup/        # Current week matchup + history
│       │   │   ├── standings/      # League standings
│       │   │   ├── waivers/        # Free agent pickups
│       │   │   ├── trades/         # Trade center
│       │   │   ├── transactions/   # Transaction log
│       │   │   ├── chat/           # League chat
│       │   │   ├── draft/          # Auction/rookie draft room
│       │   │   ├── commissioner/   # Commissioner roster management
│       │   │   ├── settings/       # League settings
│       │   │   └── team/[teamId]/  # Public team roster view
│       │   └── players/[id]/       # Player profile page
│       ├── components/
│       │   └── league/             # RosterGrid, LiveMatchup, WaiverBoard, etc.
│       ├── lib/
│       │   ├── scoring.ts          # Fantasy point engine + MLB API helpers
│       │   ├── supabase/           # Client, server, and admin Supabase clients
│       │   └── ...
│       └── vercel.json             # Cron job configuration
├── supabase/
│   └── migrations/                 # All DB schema migrations (001–008)
└── package.json
```

---

## Local Development

### Prerequisites
- Node.js 18+
- A Supabase project
- npm

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Ty-Roth1/fanbase-app.git
   cd fanbase_app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run database migrations**

   In your Supabase dashboard → SQL Editor, run each file in order:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_fix_rls_and_additions.sql
   supabase/migrations/003_phase3_6_policies.sql
   supabase/migrations/004_chat_nicknames_copommish.sql
   supabase/migrations/005_trades.sql
   supabase/migrations/006_na_slot.sql
   supabase/migrations/007_second_year_players.sql
   supabase/migrations/008_player_rank.sql
   ```

5. **Start the dev server**
   ```bash
   cd apps/web
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Set **Root Directory** to `apps/web`
4. Add environment variables in Vercel project settings:

   | Key | Description |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
   | `NEXT_PUBLIC_APP_URL` | Your production Vercel URL |
   | `SCORING_SYNC_SECRET` | Optional: secret to protect the scoring sync endpoint |
   | `CRON_SECRET` | Secret for authenticating Vercel cron requests |

5. In Supabase → **Authentication → URL Configuration**, set your Vercel domain as the Site URL and add it to Redirect URLs.

> **Note:** Vercel cron jobs require a Pro plan. For free tier, run score syncs manually from `/admin`.

---

## Admin Tools (`/admin`)

| Tool | Description |
|---|---|
| MLB Player Sync | Pulls all active MLB players and upserts to DB. Run daily. |
| Player Rankings Sync | Computes fantasy rankings from season stats. Run weekly. |
| Probable Starters Sync | Fetches probable SPs for today + 2 days. Run daily. |
| Score Diagnostics | Opens a JSON view of DB state for debugging. |
| Daily Score Sync | Sync scores for a specific date. Safe to re-run. |
| Retroactive Backfill | Sync scores across a date range (e.g. to catch up missed days). |

---

## Scoring Pipeline

1. **Cron** hits `/api/scoring/cron` every 10 minutes during game hours
2. Fetches completed/live MLB games from the MLB Stats API
3. Pulls each game's box score and extracts player batting/pitching stats
4. Matches players to rostered fantasy teams via `mlb_id`
5. Calculates fantasy points using each league's scoring categories
6. Upserts per-player rows to `player_game_scores` keyed to the correct weekly matchup
7. Recalculates `team_weekly_scores` and updates matchup home/away scores

Scores are only counted for players in **active slots** (not BENCH, IL, TAXI, or NA).

---

## Scoring Categories (Defaults)

**Batting**

| Stat | Points |
|---|---|
| Run (R) | +3 |
| Home Run (HR) | +16 |
| RBI | +3 |
| Stolen Base (SB) | +6 |
| Walk (BB) | +4 |
| Hit (H) | +4 |
| Double (2B) | +8 |
| Triple (3B) | +12 |
| Strikeout (SO) | −1 |
| Caught Stealing (CS) | −3 |

**Pitching**

| Stat | Points |
|---|---|
| Win (W) | +3 |
| Save (SV) | +17.5 |
| Hold (HLD) | +10 |
| Blown Save (BS) | −7.5 |
| Strikeout (K) | +2.5 |
| Inning Pitched (IP) | +4.5 |
| Quality Start (QS) | +8 |
| Earned Run (ER) | −3 |
| Loss (L) | −3 |
| Walk (BB) | −1 |

All categories are configurable per league via the Commissioner Settings page.
