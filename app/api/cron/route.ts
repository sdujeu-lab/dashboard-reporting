import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startSync } from '../../../lib/sync'
import { startRank } from '../../../lib/rank'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.nextUrl.searchParams.get('key') !== secret) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: sites } = await db.from('rpt_sites').select('id, domain')
  for (const s of sites || []) {
    startSync(s.id, 1)
    startRank(s.id, s.domain, 'priority')
  }
  return NextResponse.json({ started: (sites || []).length })
}
