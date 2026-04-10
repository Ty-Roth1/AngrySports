'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function StartDraftContent({ leagueId }: { leagueId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phase = searchParams.get('phase') ?? 'free_agency'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startDraft() {
    setLoading(true)
    const res = await fetch(`/api/leagues/${leagueId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, is_offline: true }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }
    router.push(`/league/${leagueId}/draft`)
  }

  return (
    <div className="max-w-md mx-auto py-20 text-center space-y-6">
      <h1 className="text-2xl font-bold">
        {phase === 'rookie_draft' ? 'Rookie Draft' : 'Free Agency Draft'}
      </h1>
      <p className="text-gray-400">
        {phase === 'rookie_draft'
          ? 'Snake draft for prospects and players not taken in free agency.'
          : 'Offline mode — you\'ll manually enter each pick as it happens.'}
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={startDraft}
        disabled={loading}
        className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition-colors"
      >
        {loading ? 'Starting...' : 'Start Draft'}
      </button>
    </div>
  )
}

export default function StartDraftPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <StartDraftContent leagueId={params.id} />
    </Suspense>
  )
}
