'use client'

import { useState } from 'react'

interface CreatedAccount {
  email: string
  temp_password: string
  display_name: string
  team_name: string
}

export function TeamCreator({ leagueId }: { leagueId: string }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamAbbr, setTeamAbbr] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedAccount | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCreated(null)

    const res = await fetch(`/api/leagues/${leagueId}/teams/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        display_name: displayName,
        team_name: teamName,
        team_abbreviation: teamAbbr,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      setCreated({
        email: data.email,
        temp_password: data.temp_password,
        display_name: data.display_name,
        team_name: data.team_name,
      })
      // Reset form
      setEmail('')
      setDisplayName('')
      setTeamName('')
      setTeamAbbr('')
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      {/* Success — show credentials */}
      {created && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 space-y-3">
          <p className="text-green-300 font-semibold text-sm">Account created for {created.team_name}!</p>
          <p className="text-xs text-gray-400">
            Share these login credentials with the team owner. They can change their password after signing in.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-sm space-y-1 select-all">
            <p className="text-gray-300">
              <span className="text-gray-500">Email:    </span>
              <span className="text-white">{created.email}</span>
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">Password: </span>
              <span className="text-yellow-300">{created.temp_password}</span>
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">Team:     </span>
              <span className="text-white">{created.team_name}</span>
            </p>
          </div>
          <button
            onClick={() => setCreated(null)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Create another account
          </button>
        </div>
      )}

      {/* Form */}
      {!created && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="manager@example.com"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="John Smith"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Team Name</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="Thunder Bats"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Abbreviation (2–4 letters)</label>
              <input
                type="text"
                required
                autoComplete="off"
                maxLength={4}
                value={teamAbbr}
                onChange={e => setTeamAbbr(e.target.value.toUpperCase())}
                placeholder="TB"
                className="input"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {loading ? 'Creating…' : 'Create Team Account'}
          </button>
          <p className="text-xs text-gray-600">
            A login will be created and a temporary password generated. The manager can change it after signing in via Account Settings.
          </p>
        </form>
      )}
    </div>
  )
}
