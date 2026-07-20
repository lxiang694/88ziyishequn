import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Known polls and their valid option keys — add new entries here for future polls.
const POLLS: Record<string, string[]> = {
  vitamin_c_packaging_2026: ['A', 'B'],
}

function tally(rows: { option_key: string }[]) {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.option_key] = (counts[row.option_key] || 0) + 1
  return { counts, total: rows.length }
}

// GET /api/votes/[pollId] — public vote tally, no auth required
export async function GET(_req: NextRequest, { params }: { params: { pollId: string } }) {
  const { pollId } = params
  if (!POLLS[pollId]) return NextResponse.json({ success: false, error: '找不到此投票' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('design_votes')
    .select('option_key')
    .eq('poll_id', pollId)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: tally(data || []) })
}

// POST /api/votes/[pollId] — cast (or change) a vote, identified by a client-generated voter_key
export async function POST(req: NextRequest, { params }: { params: { pollId: string } }) {
  const { pollId } = params
  const options = POLLS[pollId]
  if (!options) return NextResponse.json({ success: false, error: '找不到此投票' }, { status: 404 })

  try {
    const body = await req.json()
    const { option_key, voter_key } = body

    if (!options.includes(option_key)) {
      return NextResponse.json({ success: false, error: '無效的選項' }, { status: 400 })
    }
    if (typeof voter_key !== 'string' || voter_key.length < 8 || voter_key.length > 100) {
      return NextResponse.json({ success: false, error: '無效的請求' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('design_votes')
      .upsert(
        { poll_id: pollId, option_key, voter_key, updated_at: new Date().toISOString() },
        { onConflict: 'poll_id,voter_key' }
      )
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    const { data, error: fetchError } = await supabaseAdmin
      .from('design_votes')
      .select('option_key')
      .eq('poll_id', pollId)
    if (fetchError) return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })

    return NextResponse.json({ success: true, data: tally(data || []) })
  } catch {
    return NextResponse.json({ success: false, error: '投票失敗' }, { status: 500 })
  }
}
