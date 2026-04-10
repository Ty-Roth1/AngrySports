'use client'

import { useState } from 'react'

interface Props {
  leagueId: string
  teamId: string
  initialName: string
  initialAbbreviation?: string
  onSaved?: (name: string, abbreviation: string) => void
}

export function TeamNameEditor({ leagueId, teamId, initialName, initialAbbreviation = '', onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [abbr, setAbbr] = useState(initialAbbreviation)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), abbreviation: abbr.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error)
    } else {
      setEditing(false)
      onSaved?.(data.name ?? name.trim(), data.abbreviation ?? abbr.trim())
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="ml-2 text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors font-normal"
      >
        Rename
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 ml-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-red-500 w-48"
        placeholder="Team name"
      />
      <input
        value={abbr}
        onChange={e => setAbbr(e.target.value.toUpperCase().slice(0, 4))}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-red-500 w-16 font-mono"
        placeholder="ABR"
        maxLength={4}
      />
      <button
        onClick={save}
        disabled={loading}
        className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-white font-semibold"
      >
        {loading ? '…' : 'Save'}
      </button>
      <button
        onClick={() => { setEditing(false); setName(initialName); setAbbr(initialAbbreviation) }}
        className="text-xs text-gray-500 hover:text-gray-300"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  )
}
