import { getSites } from '@/lib/data'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get('d')
  const sites: any[] = await getSites()
  const site = sites.find((s) => s.domain === d)
  if (!site) return new Response('Client introuvable', { status: 404 })
  const { data } = await supabase
    .from('rpt_links_review')
    .select('domain')
    .eq('site_id', String(site.id))
    .eq('status', 'disavow')
    .order('domain')
  const lines = (data || []).map((r: any) => 'domain:' + r.domain)
  const body = '# Fichier de désaveu - ' + site.domain + ' - ' + new Date().toISOString().slice(0, 10) + '\n' + lines.join('\n') + '\n'
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="disavow-' + site.domain + '.txt"',
    },
  })
}
