'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { hostOf } from '@/lib/linkcheck'

export async function setReview(siteId: string, siteDomain: string, fd: FormData) {
  const domain = hostOf(String(fd.get('domain') || '').trim())
  const status = String(fd.get('status') || '')
  if (domain && status) {
    if (status === 'reset') {
      await supabase.from('rpt_links_review').delete().eq('site_id', siteId).eq('domain', domain)
    } else {
      await supabase
        .from('rpt_links_review')
        .upsert({ site_id: siteId, domain, status, updated_at: new Date().toISOString() }, { onConflict: 'site_id,domain' })
    }
  }
  revalidatePath('/liens')
  revalidatePath('/')
  redirect('/liens?d=' + encodeURIComponent(siteDomain) + '&t=verifier')
}
