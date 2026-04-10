import { NextResponse } from 'next/server'

// GET /api/scoring/cron
// Called by Vercel Cron every 10 minutes during game hours (4pm–11pm UTC = noon–7pm ET).
// Vercel automatically provides the CRON_SECRET authorization header.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = new Date().toISOString().split('T')[0]

  // Call the existing scoring sync endpoint internally
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
  return NextResponse.json({ cron: true, ...data })
}
