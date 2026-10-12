'use server'
import { redirect } from 'next/navigation'
import { startIndexCheck } from '../../lib/indexcheck'

export async function launchIndex(formData: FormData) {
  const id = String(formData.get('site_id'))
  const domain = String(formData.get('domain'))
  const siteUrl = String(formData.get('site_url'))
  startIndexCheck(id, domain, siteUrl)
  redirect('/indexation?d=' + encodeURIComponent(domain))
}
