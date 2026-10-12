'use server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } })
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export async function setCity(formData: FormData) {
  const domain = String(formData.get('domain'))
  const city = String(formData.get('city') || '').trim()
  const back = '/mesurer?d=' + encodeURIComponent(domain)
  if (!city) redirect(back + '&e=' + encodeURIComponent('Indique une ville.'))
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
  let list: any[] = []
  try {
    const res = await fetch('https://api.dataforseo.com/v3/serp/google/locations/fr', { headers: { Authorization: `Basic ${auth}` }, cache: 'no-store' })
    const j: any = await res.json()
    list = j.tasks?.[0]?.result || []
  } catch (e) { list = [] }
  const q = norm(city)
  const first = (n: string) => norm(n).split(',')[0]
  const hits = list.filter((l) => String(l.location_name).split(',').length >= 2 && norm(l.location_name).startsWith(q))
  const exact = hits.filter((l) => first(l.location_name) === q.split(',')[0])
  const pick = exact[0] || hits[0]
  if (!pick) {
    const regs = list.filter((l) => String(l.location_name).split(',').length === 2).map((l) => String(l.location_name).split(',')[0]).join(', ')
    redirect(back + '&e=' + encodeURIComponent('Introuvable chez DataForSEO : ' + city + (list.length ? '. Régions possibles : ' + regs : ' (liste indisponible)')))
  }
  const { error } = await db.from('rpt_sites').update({ rank_location: pick.location_name }).eq('domain', domain)
  if (error) redirect(back + '&e=' + encodeURIComponent(error.message))
  redirect(back + '&ok=' + encodeURIComponent(pick.location_name))
}
