'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ScheduleGenerator({
  leagueId,
  leagueStatus,
}: {
  leagueId: string
  leagueStatus: string
}) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (!confirm(
      leagueStatus === 'active'
        ? 'This will overwrite the existing schedule and reset all matchup scores. Continue?'
        : 'Generate schedule and activate the league?'
    )) return

    setLoading(true)
    setResult(null)
    setError(null)

    const res = await fetch(`/api/leagues/${leagueId}/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: startDate }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      setResult(`Schedule generated: ${data.weeks_created} weeks, ${data.matchups_created} matchups. League is now active.`)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Season Start Date (Week 1 Monday)</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="input w-52"
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && <p className="text-green-400 text-sm">{result}</p>}
      <button
        onClick={generate}
        disabled={loading}
        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
      >
        {loading ? 'Generating…' : leagueStatus === 'active' ? 'Regenerate Schedule' : 'Generate Schedule & Activate League'}
      </button>
    </div>
  )
}
