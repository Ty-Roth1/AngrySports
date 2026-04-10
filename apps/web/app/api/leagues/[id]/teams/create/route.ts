import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/teams/create
// Commissioner only. Creates a Supabase auth user + profile + fantasy team.
// Body: { email, display_name, team_name, team_abbreviation, temp_password? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id, max_teams, season_year, league_settings(faab_budget)')
    .eq('id', leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden — commissioner only' }, { status: 403 })
  }

  const body = await request.json()
  const { email, display_name, team_name, team_abbreviation, temp_password } = body

  if (!email || !display_name || !team_name || !team_abbreviation) {
    return NextResponse.json({ error: 'email, display_name, team_name, and team_abbreviation are all required' }, { status: 400 })
  }

  // Check league isn't full
  const { count: teamCount } = await supabase
    .from('fantasy_teams')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)

  if ((teamCount ?? 0) >= league.max_teams) {
    return NextResponse.json({ error: `League is full (${league.max_teams} teams max)` }, { status: 422 })
  }

  const admin = createAdminClient()

  // Generate a temp password if not provided
  const password = temp_password || generateTempPassword()

  // 1. Create auth user (email + password, auto-confirmed so they can log in immediately)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // skip email confirmation — we hand them credentials directly
    user_metadata: { display_name },
  })

  if (authError) {
    // Handle "user already exists" gracefully
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return NextResponse.json({ error: `An account with ${email} already exists. Have them log in and join via invite code instead.` }, { status: 422 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const newUserId = authData.user.id

  // 2. Upsert profile (the trigger should fire, but we upsert to be safe)
  await admin.from('profiles').upsert({
    id: newUserId,
    email,
    display_name,
  }, { onConflict: 'id' })

  // 3. Create fantasy team for this user in the league
  const settings = (league.league_settings as any)
  const faabBudget = settings?.faab_budget ?? 500

  const { data: team, error: teamError } = await admin
    .from('fantasy_teams')
    .insert({
      league_id: leagueId,
      owner_id: newUserId,
      name: team_name,
      abbreviation: team_abbreviation.toUpperCase().slice(0, 4),
      faab_remaining: faabBudget,
      waiver_priority: (teamCount ?? 0) + 2,  // commissioner is 1, others follow
    })
    .select()
    .single()

  if (teamError) {
    // Clean up the auth user if team creation failed
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: teamError.message }, { status: 500 })
  }

  return NextResponse.json({
    user_id: newUserId,
    team_id: team.id,
    email,
    temp_password: password,
    display_name,
    team_name,
    message: `Account created. Share these credentials with the team owner. They can change their password after logging in.`,
  })
}

function generateTempPassword(): string {
  const words = ['Diamond', 'Slider', 'Homer', 'Batter', 'Dugout', 'Mound', 'Strike', 'Rally']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${word}${num}!`
}
