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

function norm(x: string): string {
  return String(x || '')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function num(x: string | undefined): number {
  return parseInt(String(x || '').replace(/[\s\u00a0]/g, ''), 10) || 0
}

function kindOf(h0: string, h1: string, fname: string): string {
  if (h1.includes('exploration') || h1.includes('crawl')) return 'latest'
  if (norm(fname).includes('intern')) return 'skip'
  if (h0.includes('texte') || h0.includes('anchor')) return 'anchor'
  if (h0.includes('site')) return 'source'
  if (h0.includes('cible') || h0.includes('target') || h0.includes('lie') || h0.startsWith('page') || h0.includes('top linked')) return 'target'
  return ''
}

export async function importLiens(siteId: string, domain: string, fd: FormData) {
  const files = fd.getAll('files') as File[]
  const msgs: string[] = []
  const snap = new Date().toISOString().slice(0, 10)
  for (const f of files) {
    if (!f || !f.size) continue
    const text = (await f.text()).replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) { msgs.push(f.name + ' : vide'); continue }
    const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
    const head = cells(lines[0], sep)
    const h0n = norm(head[0] || '')
    const h1n = norm(head[1] || '')
    if ((h0n.includes('domain') || h0n.includes('domaine')) && h1n.includes('backlink')) {
      const dom = lines.slice(1).map((l) => cells(l, sep)).filter((c) => c[0])
      const m = new Map<string, number>()
      for (const c of dom) {
        let h = c[0]
        try { h = new URL(c[0]).hostname.replace(/^www\./, '') } catch (e) { h = c[0].replace(/^https?:\/\//, '').replace(/^www\./, '') }
        m.set(h, (m.get(h) || 0) + num(c[1]))
      }
      const pl = Array.from(m.entries()).map(([label, value]) => ({ site_id: siteId, snap, kind: 'bing_source', label, value, seen: null }))
      await supabase.from('rpt_links_import').delete().eq('site_id', siteId).eq('kind', 'bing_source').eq('snap', snap)
      for (let i = 0; i < pl.length; i += 500) {
        const { error } = await supabase.from('rpt_links_import').insert(pl.slice(i, i + 500))
        if (error) { msgs.push(f.name + ' : erreur ' + error.message); break }
      }
      msgs.push(f.name + ' : Bing domaines, ' + pl.length + ' domaine(s)')
      continue
    }
    const nh = head.map(norm)
    const iS = nh.findIndex((x) => x.includes('source'))
    const iT = nh.findIndex((x) => x.includes('target') || x.includes('cible'))
    const iA = nh.findIndex((x) => x.includes('anchor') || x.includes('ancre'))
    if (iS >= 0 && iT >= 0) {
      const b = lines.slice(1).map((l) => cells(l, sep)).filter((c) => c[iS])
      const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch (e) { return u } }
      const agg = (fn: (c: string[]) => string) => {
        const m = new Map<string, number>()
        for (const c of b) { const k = fn(c); if (k) m.set(k, (m.get(k) || 0) + 1) }
        return Array.from(m.entries()).map(([label, value]) => ({ label, value }))
      }
      const sets: any = {
        bing_source: agg((c) => hostOf(c[iS])),
        bing_target: agg((c) => c[iT]),
        bing_anchor: iA >= 0 ? agg((c) => c[iA]) : [],
      }
      for (const k of Object.keys(sets)) {
        const arr: any[] = sets[k]
        if (!arr.length) continue
        await supabase.from('rpt_links_import').delete().eq('site_id', siteId).eq('kind', k).eq('snap', snap)
        const pl = arr.map((r) => ({ site_id: siteId, snap, kind: k, label: r.label, value: r.value, seen: null }))
        for (let i = 0; i < pl.length; i += 500) {
          const { error } = await supabase.from('rpt_links_import').insert(pl.slice(i, i + 500))
          if (error) { msgs.push(f.name + ' : erreur ' + error.message); break }
        }
      }
      msgs.push(f.name + ' : Bing, ' + b.length + ' lien(s), ' + sets.bing_source.length + ' site(s)')
      continue
    }
    const kind = kindOf(norm(head[0] || ''), norm(head[1] || ''), f.name)
    if (kind === 'skip') { msgs.push(f.name + ' : liens internes ignorés'); continue }
    if (!kind) { msgs.push(f.name + ' : format non reconnu (' + head.join(' / ') + ')'); continue }
    const body = lines.slice(1).map((l) => cells(l, sep)).filter((c) => c[0])
    const payload = body.map((c) => ({
      site_id: siteId,
      snap,
      kind,
      label: c[0],
      value: kind === 'latest' ? 0 : num(c[1]),
      seen: kind === 'latest' ? c[1] || null : null,
    }))
    if (!payload.length) { msgs.push(f.name + ' : aucune ligne'); continue }
    await supabase.from('rpt_links_import').delete().eq('site_id', siteId).eq('kind', kind).eq('snap', snap)
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase.from('rpt_links_import').insert(payload.slice(i, i + 500))
      if (error) { msgs.push(f.name + ' : erreur ' + error.message); break }
    }
    msgs.push(f.name + ' : ' + payload.length + ' ligne(s) (' + kind + ')')
  }
  revalidatePath('/liens')
  redirect('/liens?d=' + encodeURIComponent(domain) + '&t=apercu&m=' + encodeURIComponent(msgs.join(' | ') || 'Aucun fichier'))
}
