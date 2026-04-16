import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  fetchGamesForDate,
  fetchBoxScore,
  calculateFantasyPoints,
  isActiveSlot,
} from '@/lib/scoring'

// POST /api/scoring/sync
// Body: { date?: 'YYYY-MM-DD' }  — defaults to today
// This is an admin-only endpoint (uses service role key).
// Run once per day (or multiple times as games finish — idempotent via upsert).
export async function POST(request: Request) {
  const supabase = createAdminClient()

  // Simple auth check — only service key requests or verify a secret header
  const authHeader = request.headers.get('authorization')
  const apiSecret = process.env.SCORING_SYNC_SECRET
  if (apiSecret && authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const date: string = body.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // 1. Fetch MLB games for the date
  const live = body.live !== false  // default true — include in-progress games
  const games = await fetchGamesForDate(date)
  const eligibleGames = games.filter(g => {
    const s = g.status.toLowerCase()
    const isFinal = s.includes('final') || s.includes('completed') || s.includes('game over')
    const isLive  = s.includes('in progress') || s.includes('manager challenge') || s.includes('review')
    return isFinal || (live && isLive)
  })

  if (eligibleGames.length === 0) {
    return NextResponse.json({ date, synced: 0, message: 'No active or completed games found' })
  }

  // 2. Get all leagues that have an active matchup covering this date
  // Find matchups that cover this date OR are the most recent matchup per team
  // (so scores can be written even when syncing retroactively or between week boundaries)
  const { data: activeMatchups } = await supabase
    .from('matchups')
    .select('id, league_id, home_team_id, away_team_id, period_start, period_end, status')
    .lte('period_start', date)
    .in('status', ['upcoming', 'active', 'final'])

  if (!activeMatchups || activeMatchups.length === 0) {
    return NextResponse.json({ date, synced: 0, message: 'No matchups found for this date' })
  }

  // For each team, keep only the matchup with the latest period_start (their current week's matchup)
  const teamToMatchup: Record<string, typeof activeMatchups[0]> = {}
  for (const m of activeMatchups) {
    const setIfBetter = (teamId: string) => {
      const prev = teamToMatchup[teamId]
      if (!prev || m.period_start > prev.period_start) {
        teamToMatchup[teamId] = m
      }
    }
    setIfBetter(m.home_team_id)
    setIfBetter(m.away_team_id)
  }

  // All unique matchups we'll be writing to
  const allMatchupIds = [...new Set(Object.values(teamToMatchup).map(m => m.id))]
  const allMatchupsById: Record<string, typeof activeMatchups[0]> = {}
  for (const m of activeMatchups) {
    allMatchupsById[m.id] = m
  }
  const dedupedMatchups = allMatchupIds.map(id => allMatchupsById[id])

  // Update upcoming matchups to 'active'
  const upcomingIds = dedupedMatchups.filter(m => m.status === 'upcoming').map(m => m.id)
  if (upcomingIds.length > 0) {
    await supabase.from('matchups').update({ status: 'active' }).in('id', upcomingIds)
  }

  const leagueIds = [...new Set(dedupedMatchups.map(m => m.league_id))]

  // 4a. Get all team IDs in relevant leagues (flat query — avoids nested join filter issues)
  const { data: teamRows } = await supabase
    .from('fantasy_teams')
    .select('id, league_id')
    .in('league_id', leagueIds)

  if (!teamRows || teamRows.length === 0) {
    return NextResponse.json({ date, synced: 0, message: 'No teams found in active leagues', leagueIds })
  }

  const teamIdToLeagueId: Record<string, string> = {}
  for (const t of teamRows) teamIdToLeagueId[t.id] = t.league_id
  const allTeamIds = Object.keys(teamIdToLeagueId)

  // 4b. Get all rosters for those teams + player mlb_ids (flat query)
  const { data: rosterData, error: rosterError } = await supabase
    .from('rosters')
    .select('team_id, player_id, slot_type, players!inner(mlb_id)')
    .in('team_id', allTeamIds)

  if (rosterError) {
    return NextResponse.json({ date, synced: 0, message: 'Roster query error', error: rosterError.message })
  }

  if (!rosterData || rosterData.length === 0) {
    return NextResponse.json({ date, synced: 0, message: 'No roster data found', teamCount: allTeamIds.length })
  }

  // Build lookup: mlbId → [{ playerId, teamId, leagueId, slotType }]
  type RosterEntry = { playerId: string; teamId: string; leagueId: string; slotType: string }
  const mlbIdToRosters: Record<number, RosterEntry[]> = {}
  for (const row of rosterData) {
    const mlbId = (row.players as any).mlb_id as number
    const leagueId = teamIdToLeagueId[row.team_id]
    if (!mlbId || !leagueId) continue
    if (!mlbIdToRosters[mlbId]) mlbIdToRosters[mlbId] = []
    mlbIdToRosters[mlbId].push({
      playerId: row.player_id,
      teamId: row.team_id,
      leagueId,
      slotType: row.slot_type,
    })
  }

  // 5. Get scoring categories per league
  const { data: scoringData } = await supabase
    .from('scoring_categories')
    .select('league_id, stat_key, label, points_per_unit')
    .in('league_id', leagueIds)

  const leagueCategories: Record<string, { stat_key: string; label: string; points_per_unit: number }[]> = {}
  for (const cat of scoringData ?? []) {
    if (!leagueCategories[cat.league_id]) leagueCategories[cat.league_id] = []
    leagueCategories[cat.league_id].push(cat)
  }

  // 6. Fetch boxscores + calculate points
  let totalInserted = 0
  let firstUpsertError: string | null = null
  const teamScoreDeltas: Record<string, Record<string, number>> = {} // matchupId → teamId → points

  for (const game of eligibleGames) {
    const players = await fetchBoxScore(game.gamePk)

    for (const playerResult of players) {
      const rosterEntries = mlbIdToRosters[playerResult.mlbId]
      if (!rosterEntries) continue

      for (const entry of rosterEntries) {
        const matchup = teamToMatchup[entry.teamId]
        if (!matchup) continue

        const categories = leagueCategories[entry.leagueId] ?? []
        const active = isActiveSlot(entry.slotType)

        // Calculate batting points
        if (playerResult.batting) {
          const { total, breakdown } = calculateFantasyPoints(playerResult.batting, categories)
          // Write row if player had any stats OR any points (even if bench/IL)
          const hasBattingStats = Object.values(playerResult.batting).some(v => v !== 0)
          if (hasBattingStats) {
            const { error } = await supabase.from('player_game_scores').upsert({
              player_id: entry.playerId,
              matchup_id: matchup.id,
              team_id: entry.teamId,
              game_date: date,
              mlb_game_id: game.gamePk,
              raw_stats: playerResult.batting,
              fantasy_points: active ? total : 0,
              breakdown: active ? breakdown : {},
              calculated_at: new Date().toISOString(),
            }, { onConflict: 'player_id,matchup_id,mlb_game_id' })

            if (error) {
              if (!firstUpsertError) firstUpsertError = error.message
            } else {
              if (active) {
                if (!teamScoreDeltas[matchup.id]) teamScoreDeltas[matchup.id] = {}
                teamScoreDeltas[matchup.id][entry.teamId] = (teamScoreDeltas[matchup.id][entry.teamId] ?? 0) + total
              }
              totalInserted++
            }
          }
        }

        // Calculate pitching points (separate upsert key using negative gamePk for pitching)
        if (playerResult.pitching) {
          const { total, breakdown } = calculateFantasyPoints(playerResult.pitching, categories)
          const hasPitchingStats = playerResult.pitching.OUTS !== undefined && playerResult.pitching.OUTS! > 0
          if (hasPitchingStats) {
            const pitchingGameId = -(game.gamePk)  // negative to differentiate from batting
            const { error } = await supabase.from('player_game_scores').upsert({
              player_id: entry.playerId,
              matchup_id: matchup.id,
              team_id: entry.teamId,
              game_date: date,
              mlb_game_id: pitchingGameId,
              raw_stats: playerResult.pitching,
              fantasy_points: active ? total : 0,
              breakdown: active ? breakdown : {},
              calculated_at: new Date().toISOString(),
            }, { onConflict: 'player_id,matchup_id,mlb_game_id' })

            if (error) {
              if (!firstUpsertError) firstUpsertError = error.message
            } else {
              if (active) {
                if (!teamScoreDeltas[matchup.id]) teamScoreDeltas[matchup.id] = {}
                teamScoreDeltas[matchup.id][entry.teamId] = (teamScoreDeltas[matchup.id][entry.teamId] ?? 0) + total
              }
              totalInserted++
            }
          }
        }
      }
    }
  }

  // 7. Recalculate team_weekly_scores from all player_game_scores this matchup period
  for (const matchup of dedupedMatchups) {
    const { data: allGameScores } = await supabase
      .from('player_game_scores')
      .select('team_id, fantasy_points')
      .eq('matchup_id', matchup.id)

    const teamTotals: Record<string, number> = {}
    for (const gs of allGameScores ?? []) {
      teamTotals[gs.team_id] = (teamTotals[gs.team_id] ?? 0) + Number(gs.fantasy_points)
    }

    for (const [teamId, total] of Object.entries(teamTotals)) {
      const rounded = Math.round(total * 100) / 100
      await supabase.from('team_weekly_scores').upsert({
        matchup_id: matchup.id,
        team_id: teamId,
        total_points: rounded,
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: 'matchup_id,team_id' })
    }

    // Update matchup scores
    const homeScore = teamTotals[matchup.home_team_id] ?? 0
    const awayScore = teamTotals[matchup.away_team_id] ?? 0
    const roundedHome = Math.round(homeScore * 100) / 100
    const roundedAway = Math.round(awayScore * 100) / 100

    // Mark active if the date falls within this matchup's period
    const isWithinPeriod = date >= matchup.period_start && date <= matchup.period_end
    const isAfterPeriod = date > matchup.period_end
    const newStatus = isAfterPeriod ? 'final' : isWithinPeriod ? 'active' : matchup.status

    await supabase.from('matchups').update({
      home_score: roundedHome,
      away_score: roundedAway,
      status: newStatus,
    }).eq('id', matchup.id)

    // Update fantasy_teams wins/losses/ties/points_for from all final matchups
    if (newStatus === 'final' || newStatus === 'active') {
      const teamsToUpdate = [
        { id: matchup.home_team_id, score: roundedHome, oppScore: roundedAway },
        { id: matchup.away_team_id, score: roundedAway, oppScore: roundedHome },
      ]
      for (const t of teamsToUpdate) {
        // Recompute totals from all matchups for this team
        const { data: allMatchups } = await supabase
          .from('matchups')
          .select('home_team_id, away_team_id, home_score, away_score, status')
          .or(`home_team_id.eq.${t.id},away_team_id.eq.${t.id}`)
          .in('status', ['final', 'active'])

        let wins = 0, losses = 0, ties = 0, pointsFor = 0
        for (const m of allMatchups ?? []) {
          const myScore = m.home_team_id === t.id ? Number(m.home_score) : Number(m.away_score)
          const oppScore = m.home_team_id === t.id ? Number(m.away_score) : Number(m.home_score)
          pointsFor += myScore
          if (m.status === 'final') {
            if (myScore > oppScore) wins++
            else if (myScore < oppScore) losses++
            else ties++
          }
        }

        await supabase.from('fantasy_teams').update({
          wins, losses, ties,
          points_for: Math.round(pointsFor * 100) / 100,
        }).eq('id', t.id)
      }
    }
  }

  return NextResponse.json({
    date,
    games_processed: eligibleGames.length,
    synced: totalInserted,
    matchups_found: dedupedMatchups.length,
    teams_found: allTeamIds.length,
    roster_rows: rosterData.length,
    mlb_ids_tracked: Object.keys(mlbIdToRosters).length,
    categories_found: Object.fromEntries(Object.entries(leagueCategories).map(([k, v]) => [k, v.length])),
    upsert_error: firstUpsertError,
  })
}
