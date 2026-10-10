'use server'
import { redirect } from 'next/navigation'
import { startRank } from '../../lib/rank'

export async function launchRank(formData: FormData) {
  const siteId = String(formData.get('site_id'))
  const domain = String(formData.get('domain'))
  const scope = formData.get('scope') === 'all' ? 'all' : 'priority'
  startRank(siteId, domain, scope)
  redirect('/mesurer?d=' + encodeURIComponent(domain))
}
