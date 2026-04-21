import { NextResponse } from 'next/server'

// GET /api/scoring/finalize-cron
// Called by Vercel Cron at 07:00 UTC every Monday (= midnight Pacific time).
// Finalizes the previous week's matchups and updates standings.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${origin}/api/scoring/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${process.env.SCORING_SYNC_SECRET ?? ''}`,
    },
  })

  const data = await res.json()
  return NextResponse.json({ cron: true, ...data })
}
