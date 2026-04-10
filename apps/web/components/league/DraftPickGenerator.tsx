'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DraftPickGenerator({ leagueId, currentYear }: { leagueId: string; currentYear: number }) {
  const router = useRouter()
  const [seasonYear, setSeasonYear] = useState(currentYear + 1)
  const [rounds, setRounds] = useState(5)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/draft-picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_year: seasonYear, rounds }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error })
    } else {
      setMsg({ type: 'ok', text: data.message })
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <form onSubmit={generate} className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Season Year</label>
          <input
            type="number"
            required
            min={currentYear}
            max={currentYear + 5}
            value={seasonYear}
            onChange={e => setSeasonYear(Number(e.target.value))}
            className="input w-28"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Rounds</label>
          <input
            type="number"
            required
            min={1}
            max={20}
            value={rounds}
            onChange={e => setRounds(Number(e.target.value))}
            className="input w-20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
        >
          {loading ? 'Generating…' : 'Generate Picks'}
        </button>
      </form>
      {msg && (
        <p className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}
      <p className="text-xs text-gray-600">
        Creates one pick per team per round. Existing picks are preserved — re-running is safe. Teams can then trade these picks.
      </p>
    </div>
  )
}
