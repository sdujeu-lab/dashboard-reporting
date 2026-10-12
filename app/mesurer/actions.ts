'use server'
import { redirect } from 'next/navigation'
import { startRank } from '../../lib/rank'

export async function launchRank(formData: FormData) {
  const siteId = String(formData.get('site_id'))
  const domain = String(formData.get('domain'))
  const raw = formData.get('scope')
  const scope = raw === 'all' ? 'all' : raw === 'errors' ? 'errors' : 'priority'
  startRank(siteId, domain, scope)
  redirect('/mesurer?d=' + encodeURIComponent(domain))
}
