'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

function cells(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
    } else if (c === sep && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

function num(x: string | undefined): number {
  return parseInt(String(x || '').replace(/[\s\u00a0]/g, ''), 10) || 0
}

function kindOf(head: string): string {
  const h = head.toLowerCase()
  if (h === 'date') return 'day'
  if (h === 'appareil' || h === 'device') return 'device'
  if (h === 'pays' || h === 'country') return 'country'
  if (h === 'filtre' || h === 'filter') return 'filtre'
  if (h.startsWith('page') || h.startsWith('top page')) return 'page'
  if (h.startsWith('requ') || h.startsWith('quer') || h.startsWith('top quer')) return 'query'
  return ''
}

export async function importIa(siteId: string, domain: string, fd: FormData) {
  const files = fd.getAll('files') as File[]
  const msgs: string[] = []
  for (const f of files) {
    if (!f || !f.size) continue
    const text = (await f.text()).replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) { msgs.push(f.name + ' : vide'); continue }
    const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
    const head = cells(lines[0], sep)
    const kind = kindOf(head[0] || '')
    if (!kind) { msgs.push(f.name + ' : format non reconnu'); continue }
    const body = lines.slice(1).map((l) => cells(l, sep))

    let rows: { label: string; impressions: number }[] = []
    let k = kind
    if (kind === 'filtre') {
      k = 'period'
      const r = body.find((c) => (c[0] || '').toLowerCase().includes('date'))
      if (r && r[1]) rows = [{ label: r[1], impressions: 0 }]
    } else {
      rows = body.filter((c) => c[0]).map((c) => ({ label: c[0], impressions: num(c[1]) }))
    }
    if (!rows.length) { msgs.push(f.name + ' : aucune ligne'); continue }

    await supabase.from('rpt_ai_import').delete().eq('site_id', siteId).eq('kind', k)
    const payload = rows.map((r) => ({ site_id: siteId, kind: k, label: r.label, impressions: r.impressions }))
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase.from('rpt_ai_import').insert(payload.slice(i, i + 500))
      if (error) { msgs.push(f.name + ' : erreur ' + error.message); break }
    }
    msgs.push(f.name + ' : ' + rows.length + ' ligne(s) (' + k + ')')
  }
  revalidatePath('/ia')
  redirect('/ia?d=' + encodeURIComponent(domain) + '&m=' + encodeURIComponent(msgs.join(' | ') || 'Aucun fichier'))
}
