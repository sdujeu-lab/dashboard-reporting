'use server'
import { redirect } from 'next/navigation'
import { startRank } from '../../lib/rank'
import { startSync } from '../../lib/sync'
import { supabase } from '../../lib/supabase'

export async function launchRank(formData: FormData) {
  const siteId = String(formData.get('site_id'))
  const domain = String(formData.get('domain'))
  const raw = formData.get('scope')
  const scope = raw === 'errors' ? 'errors' : 'priority'
  startRank(siteId, domain, scope)
  redirect('/mesurer?d=' + encodeURIComponent(domain))
}

export async function syncGsc(siteId: string, domain: string, months: number, _fd: FormData) {
  await supabase.from('rpt_sites').update({ sync_status: 'running', sync_message: 'Démarrage…' }).eq('id', siteId)
  startSync(siteId, months)
  redirect('/mesurer?d=' + encodeURIComponent(domain))
}
