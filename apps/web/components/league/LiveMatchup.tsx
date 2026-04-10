'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  abbreviation: string
}

interface PlayerScore {
  name: string
  pos: string
  team: string | null
  total: number
}

interface LiveMatchupProps {
  matchupId: string
  leagueId: string
  myTeamId: string
  myTeamName: string
  initialHomeScore: number
  initialAwayScore: number
  initialStatus: string
  week: number
  periodStart: string
  periodEnd: string
  isPlayoff: boolean
  homeTeam: Team
  awayTeam: Team
  initialMyScores: PlayerScore[]
  initialOppScores: PlayerScore[]
}

export function LiveMatchup({
  matchupId,
  leagueId,
  myTeamId,
  myTeamName,
  initialHomeScore,
  initialAwayScore,
  initialStatus,
  week,
  periodStart,
  periodEnd,
  isPlayoff,
  homeTeam,
  awayTeam,
  initialMyScores,
  initialOppScores,
}: LiveMatchupProps) {
  const [homeScore, setHomeScore] = useState(initialHomeScore)
  const [awayScore, setAwayScore] = useState(initialAwayScore)
  const [status, setStatus] = useState(initialStatus)
  const [myScores, setMyScores] = useState(initialMyScores)
  const [oppScores, setOppScores] = useState(initialOppScores)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const myIsHome = homeTeam.id === myTeamId
  const myScore = myIsHome ? homeScore : awayScore
  const oppScore = myIsHome ? awayScore : homeScore
  const opp = myIsHome ? awayTeam : homeTeam
  const winning = myScore > oppScore
  const tied = myScore === oppScore

  // Subscribe to matchup score updates via Realtime
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`matchup:${matchupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchups',
          filter: `id=eq.${matchupId}`,
        },
        (payload) => {
          const updated = payload.new as any
          setHomeScore(Number(updated.home_score))
          setAwayScore(Number(updated.away_score))
          setStatus(updated.status)
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_game_scores',
          filter: `matchup_id=eq.${matchupId}`,
        },
        async () => {
          // Re-fetch player breakdown when new scores arrive
          const { data: scores } = await supabase
            .from('player_game_scores')
            .select('team_id, fantasy_points, players(full_name, primary_position, mlb_team)')
            .eq('matchup_id', matchupId)

          const aggregate = (teamId: string): PlayerScore[] => {
            const teamScores = (scores ?? []).filter(s => s.team_id === teamId)
            const byPlayer: Record<string, PlayerScore> = {}
            for (const s of teamScores) {
              const p = s.players as any
              const key = teamId + p.full_name
              if (!byPlayer[key]) byPlayer[key] = { name: p.full_name, pos: p.primary_position, team: p.mlb_team, total: 0 }
              byPlayer[key].total += Number(s.fantasy_points)
            }
            return Object.values(byPlayer).sort((a, b) => b.total - a.total)
          }

          const oppTeamId = myIsHome ? awayTeam.id : homeTeam.id
          setMyScores(aggregate(myTeamId))
          setOppScores(aggregate(oppTeamId))
          setLastUpdated(new Date())
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchupId, myTeamId, myIsHome, homeTeam.id, awayTeam.id])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">
          Week {week} · {periodStart} — {periodEnd}
          {isPlayoff && <span className="ml-2 text-yellow-400">Playoffs</span>}
        </span>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-600">
              Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            status === 'final' ? 'bg-gray-700 text-gray-300' :
            status === 'active' ? 'bg-green-900 text-green-300' :
            'bg-gray-800 text-gray-400'
          }`}>
            {status === 'final' ? 'Final' : status === 'active' ? '● Live' : 'Upcoming'}
          </span>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center flex-1">
            <Link href={`/league/${leagueId}/team/${myTeamId}`} className="text-gray-400 text-sm mb-1 hover:text-red-400 transition-colors block">{myTeamName}</Link>
            <p className={`text-5xl font-black tabular-nums transition-all duration-300 ${
              winning ? 'text-green-400' : tied ? 'text-white' : 'text-gray-400'
            }`}>
              {myScore.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{myScores.length} players scoring</p>
          </div>
          <div className="text-2xl text-gray-600 font-bold flex-shrink-0">vs</div>
          <div className="text-center flex-1">
            <Link href={`/league/${leagueId}/team/${opp.id}`} className="text-gray-400 text-sm mb-1 hover:text-red-400 transition-colors block">{opp.name}</Link>
            <p className={`text-5xl font-black tabular-nums transition-all duration-300 ${
              !winning && !tied ? 'text-green-400' : tied ? 'text-white' : 'text-gray-400'
            }`}>
              {oppScore.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{oppScores.length} players scoring</p>
          </div>
        </div>
      </div>

      {(myScores.length > 0 || oppScores.length > 0) && (
        <div className="border-t border-gray-800 grid grid-cols-2 divide-x divide-gray-800">
          {[
            { label: myTeamName, scores: myScores },
            { label: opp.name, scores: oppScores },
          ].map(({ label, scores }) => (
            <div key={label}>
              <div className="px-4 py-2 border-b border-gray-800 bg-gray-800/30">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              </div>
              <div className="divide-y divide-gray-800/50">
                {scores.slice(0, 10).map(s => (
                  <div key={s.name} className="px-4 py-2 flex justify-between text-sm">
                    <div>
                      <span className="text-white font-medium">{s.name}</span>
                      <span className="text-gray-500 text-xs ml-1">{s.pos}</span>
                    </div>
                    <span className={`font-mono font-bold ${s.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.total >= 0 ? '+' : ''}{s.total.toFixed(1)}
                    </span>
                  </div>
                ))}
                {scores.length === 0 && (
                  <p className="px-4 py-4 text-xs text-gray-600">No scores yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
