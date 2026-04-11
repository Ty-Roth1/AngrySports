import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/scoring/live
// Authenticated (any logged-in user) shortcut to trigger a live scoring sync
// for today. Used by the AutoSync client component so the roster page can
// self-refresh scores without needing SCORING_SYNC_SECRET on the client.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const res = await fetch(`${origin}/api/scoring/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${process.env.SCORING_SYNC_SECRET ?? ''}`,
    },
    body: JSON.stringify({ date, live: true }),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
