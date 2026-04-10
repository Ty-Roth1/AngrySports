'use client'

import { useState } from 'react'

export default function AdminPage() {
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)

  const [scoreDate, setScoreDate] = useState(new Date().toISOString().split('T')[0])
  const [scoreStatus, setScoreStatus] = useState<string | null>(null)
  const [scoreLoading, setScoreLoading] = useState(false)

  const [probableStatus, setProbableStatus] = useState<string | null>(null)
  const [probableLoading, setProbableLoading] = useState(false)

  const [rankStatus, setRankStatus] = useState<string | null>(null)
  const [rankLoading, setRankLoading] = useState(false)

  const [seedLeagueId, setSeedLeagueId] = useState('')
  const [seedStatus, setSeedStatus] = useState<string | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)

  async function handleSeedRosters() {
    if (!seedLeagueId.trim()) return
    setSeedLoading(true)
    setSeedStatus(null)
    const res = await fetch('/api/admin/seed-rosters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: seedLeagueId.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSeedStatus(`Error: ${data.error}`)
    } else {
      const lines = data.report.map((r: any) =>
        r.status === 'team_not_found'
          ? `❌ "${r.team}" — team not found in league`
          : `✓ ${r.team}: ${r.inserted} players added${r.not_found.length ? ` | Missing: ${r.not_found.join(', ')}` : ''}`
      )
      setSeedStatus(lines.join('\n'))
    }
    setSeedLoading(false)
  }

  // Backfill range
  const [backfillStart, setBackfillStart] = useState('')
  const [backfillEnd, setBackfillEnd] = useState(new Date().toISOString().split('T')[0])
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null)
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleSync() {
    setSyncLoading(true)
    setSyncStatus(null)
    const res = await fetch('/api/players/sync', { method: 'POST' })
    const data = await res.json()
    setSyncStatus(res.ok ? `Synced ${data.synced} players for the ${data.season} season.` : `Error: ${data.error}`)
    setSyncLoading(false)
  }

  async function handleRankingSync() {
    setRankLoading(true)
    setRankStatus(null)
    const res = await fetch('/api/players/rankings', { method: 'POST' })
    const data = await res.json()
    setRankStatus(res.ok ? `Ranked ${data.ranked} players for the ${data.season} season.` : `Error: ${data.error}`)
    setRankLoading(false)
  }

  async function handleProbableSync() {
    setProbableLoading(true)
    setProbableStatus(null)
    const res = await fetch('/api/pitchers/probable', { method: 'POST' })
    const data = await res.json()
    setProbableStatus(res.ok ? `Synced ${data.synced} probable starters (today + next 2 days).` : `Error: ${data.error}`)
    setProbableLoading(false)
  }

  async function handleScoreSync() {
    setScoreLoading(true)
    setScoreStatus(null)
    const res = await fetch('/api/scoring/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: scoreDate }),
    })
    const data = await res.json()
    if (res.ok) {
      const parts = [
        `${scoreDate}: ${data.games_processed} game(s) processed, ${data.synced} scores written.`,
        data.matchups_found !== undefined ? `Matchups: ${data.matchups_found}, Teams: ${data.teams_found}, Roster rows: ${data.roster_rows}, MLB IDs tracked: ${data.mlb_ids_tracked}` : '',
        data.categories_found ? `Categories: ${JSON.stringify(data.categories_found)}` : 'WARNING: No scoring categories found',
        data.upsert_error ? `UPSERT ERROR: ${data.upsert_error}` : '',
        data.message ? `Note: ${data.message}` : '',
      ].filter(Boolean)
      setScoreStatus(parts.join(' | '))
    } else {
      setScoreStatus(`Error: ${data.error ?? data.message}`)
    }
    setScoreLoading(false)
  }

  async function handleBackfill() {
    if (!backfillStart || !backfillEnd) return
    setBackfillLoading(true)
    setBackfillStatus(null)
    setBackfillProgress(null)

    // Generate all dates in the range
    const dates: string[] = []
    const cur = new Date(backfillStart)
    const end = new Date(backfillEnd)
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() + 1)
    }

    let totalGames = 0
    let totalScores = 0
    let errors = 0

    for (let i = 0; i < dates.length; i++) {
      setBackfillProgress({ done: i, total: dates.length })
      try {
        const res = await fetch('/api/scoring/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dates[i] }),
        })
        const data = await res.json()
        if (res.ok) {
          totalGames += data.games_processed ?? 0
          totalScores += data.synced ?? 0
        } else {
          errors++
        }
      } catch {
        errors++
      }
    }

    setBackfillProgress({ done: dates.length, total: dates.length })
    setBackfillStatus(
      `Backfill complete: ${dates.length} days, ${totalGames} games, ${totalScores} player scores synced.` +
      (errors > 0 ? ` (${errors} days had errors)` : '')
    )
    setBackfillLoading(false)
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1 text-white">Admin Tools</h1>
        <p className="text-gray-400 text-sm">Internal tools for managing the platform.</p>
      </div>

      {/* Player Sync */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">MLB Player Sync</h2>
        <p className="text-sm text-gray-400">
          Pulls all active MLB players from the official MLB Stats API and upserts them.
          Run once per day during the season.
        </p>
        <button onClick={handleSync} disabled={syncLoading}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition-colors text-white">
          {syncLoading ? 'Syncing...' : 'Sync Players Now'}
        </button>
        {syncStatus && (
          <p className={`text-sm ${syncStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{syncStatus}</p>
        )}
      </div>

      {/* Player Rankings */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Player Rankings Sync</h2>
        <p className="text-sm text-gray-400">
          Computes fantasy rankings from season stats via the MLB API. Rankings are used to sort the waiver wire.
          Run weekly or whenever you want fresher rankings.
        </p>
        <button onClick={handleRankingSync} disabled={rankLoading}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition-colors text-white">
          {rankLoading ? 'Syncing...' : 'Sync Player Rankings'}
        </button>
        {rankStatus && (
          <p className={`text-sm ${rankStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{rankStatus}</p>
        )}
      </div>

      {/* Probable Starters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Probable Starters Sync</h2>
        <p className="text-sm text-gray-400">
          Fetches probable starting pitchers for today and the next 2 days.
          Run daily so the waivers page shows starting badges.
        </p>
        <button onClick={handleProbableSync} disabled={probableLoading}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition-colors text-white">
          {probableLoading ? 'Syncing...' : 'Sync Probable Starters'}
        </button>
        {probableStatus && (
          <p className={`text-sm ${probableStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{probableStatus}</p>
        )}
      </div>

      {/* Score Diagnostics */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Score Diagnostics</h2>
        <p className="text-sm text-gray-400">
          Open in a new tab to see what&apos;s in the DB: matchups, player_game_scores counts, and recent score rows.
          Add <code className="text-gray-300">?league_id=YOUR_LEAGUE_ID</code> to see league-specific data.
        </p>
        <a
          href="/api/debug/scores"
          target="_blank"
          className="inline-block px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors text-white text-sm"
        >
          Open Diagnostics →
        </a>
      </div>

      {/* Single-day Score Sync */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Daily Score Sync</h2>
        <p className="text-sm text-gray-400">
          Sync scores for a single date. Safe to re-run — results are upserted.
        </p>
        <div className="flex items-center gap-3">
          <input type="date" value={scoreDate} onChange={e => setScoreDate(e.target.value)} className="input w-44" />
          <button onClick={handleScoreSync} disabled={scoreLoading}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition-colors text-white">
            {scoreLoading ? 'Syncing...' : 'Sync Scores'}
          </button>
        </div>
        {scoreStatus && (
          <p className={`text-sm ${scoreStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{scoreStatus}</p>
        )}
      </div>

      {/* Retroactive Backfill */}
      <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Retroactive Score Backfill</h2>
        <p className="text-sm text-gray-400">
          Sync all scores across a date range — use this to catch up weeks 1–3 before going live.
          Runs day-by-day; may take a few minutes for long ranges.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input type="date" value={backfillStart} onChange={e => setBackfillStart(e.target.value)} className="input w-40" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input type="date" value={backfillEnd} onChange={e => setBackfillEnd(e.target.value)} className="input w-40" />
          </div>
          <button
            onClick={handleBackfill}
            disabled={backfillLoading || !backfillStart}
            className="mt-5 px-5 py-2.5 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 rounded-lg font-semibold transition-colors text-white"
          >
            {backfillLoading ? 'Running…' : 'Run Backfill'}
          </button>
        </div>
        {backfillProgress && backfillLoading && (
          <div className="space-y-1">
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(backfillProgress.done / backfillProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {backfillProgress.done} / {backfillProgress.total} days synced…
            </p>
          </div>
        )}
        {backfillStatus && (
          <p className={`text-sm ${backfillStatus.includes('error') ? 'text-yellow-400' : 'text-green-400'}`}>
            {backfillStatus}
          </p>
        )}
      </div>

      {/* Seed Rosters */}
      <div className="bg-gray-900 border border-blue-900/40 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Seed Rosters (One-Time Setup)</h2>
        <p className="text-sm text-gray-400">
          Populates all 10 teams with predefined rosters. Clears existing rosters first.
          Make sure team names in the league match exactly, and run MLB Player Sync first.
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">League ID</label>
          <input
            type="text"
            value={seedLeagueId}
            onChange={e => setSeedLeagueId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="input w-full font-mono text-xs"
          />
        </div>
        <button
          onClick={handleSeedRosters}
          disabled={seedLoading || !seedLeagueId.trim()}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg font-semibold transition-colors text-white"
        >
          {seedLoading ? 'Seeding…' : 'Seed All Rosters'}
        </button>
        {seedStatus && (
          <pre className={`text-xs whitespace-pre-wrap ${seedStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {seedStatus}
          </pre>
        )}
      </div>
    </div>
  )
}
