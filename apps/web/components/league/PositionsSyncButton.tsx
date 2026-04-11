'use client'

import { useState } from 'react'

export function PositionsSyncButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/players/positions/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult(data.error ?? 'Error')
        setStatus('error')
      } else {
        setResult(`Updated ${data.updated} players (${data.playersWithMultiplePositions} multi-position)`)
        setStatus('done')
      }
    } catch {
      setResult('Network error')
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={status === 'loading'}
        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? 'Syncing…' : 'Sync Position Eligibility'}
      </button>
      {result && (
        <span className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {result}
        </span>
      )}
    </div>
  )
}
