import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Default scoring categories for a new league
function defaultScoringCategories(leagueId: string) {
  return [
    // Batting
    { league_id: leagueId, stat_key: 'R',    label: 'Run',             points_per_unit: 3,    is_batting: true,  is_pitching: false, is_negative: false, sort_order: 1 },
    { league_id: leagueId, stat_key: 'HR',   label: 'Home Run',        points_per_unit: 16,   is_batting: true,  is_pitching: false, is_negative: false, sort_order: 2 },
    { league_id: leagueId, stat_key: 'RBI',  label: 'RBI',             points_per_unit: 3,    is_batting: true,  is_pitching: false, is_negative: false, sort_order: 3 },
    { league_id: leagueId, stat_key: 'SB',   label: 'Stolen Base',     points_per_unit: 6,    is_batting: true,  is_pitching: false, is_negative: false, sort_order: 4 },
    { league_id: leagueId, stat_key: 'BB_b', label: 'Walk (Batter)',   points_per_unit: 4,    is_batting: true,  is_pitching: false, is_negative: false, sort_order: 5 },
    { league_id: leagueId, stat_key: 'H',    label: 'Hit',             points_per_unit: 4,    is_batting: true,  is_pitching: false, is_negative: false, sort_order: 6 },
    { league_id: leagueId, stat_key: '2B',   label: 'Double',          points_per_unit: 8,    is_batting: true,  is_pitching: false, is_negative: false, sort_order: 7 },
    { league_id: leagueId, stat_key: '3B',   label: 'Triple',          points_per_unit: 12,   is_batting: true,  is_pitching: false, is_negative: false, sort_order: 8 },
    { league_id: leagueId, stat_key: 'SO_b', label: 'Strikeout (Batter)', points_per_unit: -1, is_batting: true, is_pitching: false, is_negative: true,  sort_order: 9 },
    { league_id: leagueId, stat_key: 'CS',   label: 'Caught Stealing', points_per_unit: -3,   is_batting: true,  is_pitching: false, is_negative: true,  sort_order: 10 },
    // Pitching
    { league_id: leagueId, stat_key: 'W',    label: 'Win',             points_per_unit: 3,    is_batting: false, is_pitching: true,  is_negative: false, sort_order: 20 },
    { league_id: leagueId, stat_key: 'SV',   label: 'Save',            points_per_unit: 17.5, is_batting: false, is_pitching: true,  is_negative: false, sort_order: 21 },
    { league_id: leagueId, stat_key: 'BS',   label: 'Blown Save',      points_per_unit: -7.5, is_batting: false, is_pitching: true,  is_negative: true,  sort_order: 22 },
    { league_id: leagueId, stat_key: 'HLD',  label: 'Hold',            points_per_unit: 10,   is_batting: false, is_pitching: true,  is_negative: false, sort_order: 23 },
    { league_id: leagueId, stat_key: 'K',    label: 'Strikeout (Pitcher)', points_per_unit: 2.5, is_batting: false, is_pitching: true, is_negative: false, sort_order: 24 },
    { league_id: leagueId, stat_key: 'IP',   label: 'Inning Pitched',  points_per_unit: 4.5,  is_batting: false, is_pitching: true,  is_negative: false, sort_order: 25 },
    { league_id: leagueId, stat_key: 'OUTS', label: 'Out Recorded',    points_per_unit: 1.5,  is_batting: false, is_pitching: true,  is_negative: false, sort_order: 26 },
    { league_id: leagueId, stat_key: 'QS',   label: 'Quality Start',   points_per_unit: 8,    is_batting: false, is_pitching: true,  is_negative: false, sort_order: 27 },
    { league_id: leagueId, stat_key: 'ER',   label: 'Earned Run',      points_per_unit: -3,   is_batting: false, is_pitching: true,  is_negative: true,  sort_order: 28 },
    { league_id: leagueId, stat_key: 'L',    label: 'Loss',            points_per_unit: -3,   is_batting: false, is_pitching: true,  is_negative: true,  sort_order: 29 },
    { league_id: leagueId, stat_key: 'BB_p', label: 'Walk (Pitcher)',  points_per_unit: -1,   is_batting: false, is_pitching: true,  is_negative: true,  sort_order: 30 },
  ]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    max_teams,
    scoring_type,
    is_keeper_league,
    is_contract_league,
    max_keepers_per_team,
    has_taxi_squad,
    taxi_squad_size,
    playoff_teams,
    playoff_start_week,
    regular_season_weeks,
    // Settings
    spots_c, spots_1b, spots_2b, spots_3b, spots_ss, spots_if, spots_of,
    spots_util, spots_sp, spots_rp, spots_p, spots_bench, spots_il,
    draft_type,
    auction_budget,
    snake_rounds,
    pick_time_seconds,
    rookie_draft_rounds,
    waiver_type,
    faab_budget,
    trade_deadline_week,
    max_contract_years,
    rookie_contract_years,
    salary_cap,
    cap_type,
    cap_tier_size,
    // Commissioner's team
    team_name,
    team_abbreviation,
  } = body

  // 1. Create the league
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .insert({
      name,
      commissioner_id: user.id,
      max_teams: max_teams ?? 12,
      scoring_type: scoring_type ?? 'head_to_head_points',
      is_keeper_league: is_keeper_league ?? false,
      is_contract_league: is_contract_league ?? false,
      max_keepers_per_team: max_keepers_per_team ?? 0,
      has_taxi_squad: has_taxi_squad ?? false,
      taxi_squad_size: taxi_squad_size ?? 3,
      playoff_teams: playoff_teams ?? 4,
      playoff_start_week: playoff_start_week ?? 22,
      regular_season_weeks: regular_season_weeks ?? 21,
    })
    .select()
    .single()

  if (leagueError) {
    return NextResponse.json({ error: leagueError.message }, { status: 500 })
  }

  // 2. Create league settings
  const { error: settingsError } = await supabase
    .from('league_settings')
    .insert({
      league_id: league.id,
      spots_c: spots_c ?? 1,
      spots_1b: spots_1b ?? 1,
      spots_2b: spots_2b ?? 1,
      spots_3b: spots_3b ?? 1,
      spots_ss: spots_ss ?? 1,
      spots_if: spots_if ?? 0,
      spots_of: spots_of ?? 3,
      spots_util: spots_util ?? 1,
      spots_sp: spots_sp ?? 2,
      spots_rp: spots_rp ?? 2,
      spots_p: spots_p ?? 2,
      spots_bench: spots_bench ?? 4,
      spots_il: spots_il ?? 2,
      draft_type: draft_type ?? 'auction',
      auction_budget: auction_budget ?? 260,
      snake_rounds: snake_rounds ?? 25,
      pick_time_seconds: pick_time_seconds ?? 90,
      rookie_draft_rounds: rookie_draft_rounds ?? 5,
      waiver_type: waiver_type ?? 'faab',
      faab_budget: faab_budget ?? 500,
      trade_deadline_week: trade_deadline_week ?? 20,
      max_contract_years: max_contract_years ?? 3,
      rookie_contract_years: rookie_contract_years ?? 2,
      salary_cap: salary_cap ?? null,
      cap_type: cap_type ?? 'none',
      cap_tier_size: cap_tier_size ?? 10,
    })

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  // 3. Create default scoring categories
  const { error: scoringError } = await supabase
    .from('scoring_categories')
    .insert(defaultScoringCategories(league.id))

  if (scoringError) {
    return NextResponse.json({ error: scoringError.message }, { status: 500 })
  }

  // 4. Create the commissioner's fantasy team
  const { data: team, error: teamError } = await supabase
    .from('fantasy_teams')
    .insert({
      league_id: league.id,
      owner_id: user.id,
      name: team_name ?? 'My Team',
      abbreviation: team_abbreviation ?? 'TM1',
      faab_remaining: faab_budget ?? 500,
      waiver_priority: 1,
    })
    .select()
    .single()

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 })
  }

  return NextResponse.json({ league, team })
}
