'use server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } })
const LOCATION = "Marseille,Provence-Alpes-Cote d'Azur,France"

export async function saveManualRank(formData: FormData) {
  const keywordId = String(formData.get('keyword_id'))
  const domain = String(formData.get('domain'))
  const raw = String(formData.get('rank') || '').trim()
  const url = String(formData.get('url') || '').trim() || null
  const rank = raw === '' ? null : Math.round(Number(raw))
  const bk = String(formData.get('back') || '')
  const back = bk.startsWith('/') && !bk.startsWith('//') ? bk : '/mesurer?d=' + encodeURIComponent(domain)
  if (rank !== null && (!Number.isFinite(rank) || rank < 1 || rank > 50)) redirect(back)
  const { data: stRow } = await db.from('rpt_sites').select('rank_location').eq('domain', domain).maybeSingle()
  const loc: string = (stRow as any)?.rank_location || LOCATION
  const month = new Date().toISOString().slice(0, 7) + '-01'
  const { error } = await db.from('rpt_keyword_rank').upsert({ keyword_id: keywordId, month, rank, url, location: loc, checked_at: new Date().toISOString() }, { onConflict: 'keyword_id,month' })
  if (error) throw new Error(error.message)
  await db.from('rpt_rank_errors').delete().eq('keyword_id', keywordId).eq('month', month)
  redirect(back)
}
