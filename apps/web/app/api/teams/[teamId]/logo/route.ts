import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/teams/[teamId]/logo
// Multipart form: field "file" — image/jpeg or image/png, max 2 MB
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('id, owner_id')
    .eq('id', teamId)
    .single()

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (team.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF allowed' }, { status: 400 })
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 2 MB' }, { status: 400 })
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${teamId}.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('team-logos')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('team-logos').getPublicUrl(path)

  // Bust any CDN cache by appending a timestamp
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  await supabase
    .from('fantasy_teams')
    .update({ logo_url: logoUrl })
    .eq('id', teamId)

  return NextResponse.json({ logo_url: logoUrl })
}
