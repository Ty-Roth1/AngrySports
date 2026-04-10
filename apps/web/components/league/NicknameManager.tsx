'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PlayerOption {
  id: string
  full_name: string
  primary_position: string
  mlb_team: string | null
  current_nickname?: string
}

export function NicknameManager({
  leagueId,
  players,
}: {
  leagueId: string
  players: PlayerOption[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const filtered = players.filter(p =>
    !search || p.full_name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20)

  const selected = players.find(p => p.id === selectedId)

  async function saveNickname(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !nickname.trim()) return
    setLoading(true)
    setMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/nicknames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: selectedId, nickname: nickname.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error })
    } else {
      setMsg({ type: 'ok', text: `Nickname set for ${selected?.full_name}!` })
      setNickname('')
      setSelectedId('')
      setSearch('')
      router.refresh()
    }
    setLoading(false)
  }

  async function removeNickname(playerId: string) {
    await fetch(`/api/leagues/${leagueId}/nicknames`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })
    router.refresh()
  }

  const withNicknames = players.filter(p => p.current_nickname)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      {/* Existing nicknames */}
      {withNicknames.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-gray-400 uppercase tracking-wide">Current Nicknames</h4>
          <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
            {withNicknames.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-white text-sm font-medium">{p.full_name}</span>
                  <span className="mx-2 text-gray-600">→</span>
                  <span className="text-yellow-300 text-sm font-medium">&ldquo;{p.current_nickname}&rdquo;</span>
                  <span className="ml-2 text-xs text-gray-500">{p.primary_position}</span>
                </div>
                <button
                  onClick={() => removeNickname(p.id)}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/edit nickname form */}
      <div>
        <h4 className="text-xs text-gray-400 uppercase tracking-wide mb-3">
          {withNicknames.length > 0 ? 'Add / Update Nickname' : 'Set a Nickname'}
        </h4>
        <form onSubmit={saveNickname} className="space-y-3">
          {/* Player search */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Search Player</label>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedId('') }}
              placeholder="Type player name..."
              autoComplete="off"
              className="input"
            />
            {search && !selectedId && (
              <div className="mt-1 border border-gray-700 rounded-lg overflow-hidden">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500">No rostered players found</p>
                ) : (
                  filtered.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id)
                        setSearch(p.full_name)
                        setNickname(p.current_nickname ?? '')
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors flex justify-between"
                    >
                      <span>{p.full_name}</span>
                      <span className="text-gray-500 text-xs">{p.primary_position} · {p.mlb_team ?? 'FA'}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Nickname</label>
            <input
              type="text"
              required
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder='e.g. "The Machine"'
              autoComplete="off"
              maxLength={40}
              className="input"
            />
          </div>

          {msg && (
            <p className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
          )}

          <button
            type="submit"
            disabled={loading || !selectedId || !nickname.trim()}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {loading ? 'Saving…' : 'Set Nickname'}
          </button>
        </form>
      </div>
    </div>
  )
}
