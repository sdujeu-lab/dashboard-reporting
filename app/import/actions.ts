'use server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { parseCsv, toInt, toFloat, toCtr, idx, kindOfFile } from '../../lib/csv'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } })

async function replaceRows(table: string, siteId: string, month: string, rows: any[]) {
  await db.from(table).delete().eq('site_id', siteId).eq('month', month)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500))
    if (error) throw new Error(table + ' : ' + error.message)
  }
}

const tot = (arr: any[]) => {
  const c = arr.reduce((s, a) => s + a.clicks, 0)
  const i = arr.reduce((s, a) => s + a.impressions, 0)
  const p = i ? arr.reduce((s, a) => s + a.position * a.impressions, 0) / i : 0
  return { c, i, p }
}

export async function setManual(formData: FormData) {
  const siteId = String(formData.get('site_id'))
  const domain = String(formData.get('domain'))
  await db.from('rpt_sites').update({ manual_import: formData.get('value') === '1' }).eq('id', siteId)
  redirect('/import?d=' + encodeURIComponent(domain))
}

export async function importCsv(formData: FormData) {
  const siteId = String(formData.get('site_id'))
  const domain = String(formData.get('domain'))
  const m = String(formData.get('month'))
  const month = m + '-01'
  const back = '/import?d=' + encodeURIComponent(domain) + '&m=' + m
  const files = formData.getAll('files').filter((f) => typeof f !== 'string' && (f as File).size > 0) as File[]
  if (!files.length) redirect(back + '&e=' + encodeURIComponent('Aucun fichier choisi.'))
  const done: string[] = []
  const skipped: string[] = []
  const sums: Record<string, { c: number; i: number; p: number }> = {}
  let pagesSum = { c: 0, i: 0, p: 0 }
  let fail = ''
  try {
    for (const f of files) {
      const rows = parseCsv(await f.text())
      if (rows.length < 2) { skipped.push(f.name + ' (vide)'); continue }
      const head = rows[0]
      const kind = kindOfFile(head[0] || '', f.name)
      if (!kind) { skipped.push(f.name + ' (type inconnu : ' + (head[0] || '?') + ')'); continue }
      const body = rows.slice(1).filter((r) => (r[0] || '').trim() && !/^total/i.test(r[0].trim()))
      if (kind === 'ga4') {
        const hl = head.map((h) => h.toLowerCase())
        const si = idx(hl, (h) => /session/.test(h) && !/engag/.test(h), 1)
        const ei = idx(hl, (h) => /engag/.test(h) && /session/.test(h), -1)
        const ui = idx(hl, (h) => /utilisateur|user/.test(h), -1)
        const ki = idx(hl, (h) => /cl[ée]s|key ?event|conversion/.test(h), -1)
        const u = new Map<string, any>()
        for (const r of body) u.set(r[0].trim(), { site_id: siteId, month, channel: r[0].trim(), sessions: toInt(r[si]), engaged_sessions: ei >= 0 ? toInt(r[ei]) : 0, users: ui >= 0 ? toInt(r[ui]) : 0, key_events: ki >= 0 ? toInt(r[ki]) : 0 })
        await replaceRows('rpt_ga4_monthly_channels', siteId, month, [...u.values()])
        done.push('GA4 : ' + u.size + ' canaux')
        continue
      }
      const ci = idx(head, /clic|click/, 1)
      const ii = idx(head, /impression/, 2)
      const ti = idx(head, /ctr/, 3)
      const pi = idx(head, /position/, 4)
      const u = new Map<string, any>()
      for (const r of body) u.set(r[0].trim(), { label: r[0].trim(), clicks: toInt(r[ci]), impressions: toInt(r[ii]), ctr: toCtr(r[ti]), position: toFloat(r[pi]) })
      const arr = [...u.values()]
      const mk = (key: string) => arr.map((a) => ({ site_id: siteId, month, [key]: a.label, clicks: a.clicks, impressions: a.impressions, ctr: a.ctr, position: a.position }))
      if (kind === 'queries') await replaceRows('rpt_gsc_monthly_queries', siteId, month, mk('query'))
      else if (kind === 'pages') { await replaceRows('rpt_gsc_monthly_pages', siteId, month, mk('page')); pagesSum = tot(arr) }
      else if (kind === 'countries') await replaceRows('rpt_gsc_monthly_countries', siteId, month, mk('country'))
      else sums[kind] = tot(arr)
      done.push(kind + ' : ' + arr.length + ' lignes')
    }
    const src = sums.devices || sums.dates
    const s = src || (pagesSum.i ? pagesSum : null)
    if (s) {
      const { error } = await db.from('rpt_gsc_monthly_summary').upsert({ site_id: siteId, month, clicks: s.c, impressions: s.i, ctr: s.i ? s.c / s.i : 0, position: s.p }, { onConflict: 'site_id,month' })
      if (error) throw new Error(error.message)
      done.push(src ? 'résumé du mois' : 'résumé approximatif (d\'après les pages)')
    }
  } catch (e: any) { fail = e.message || String(e) }
  const err = [fail, skipped.length ? 'Ignorés : ' + skipped.join(' ; ') : ''].filter(Boolean).join(' — ')
  redirect(back + (done.length ? '&ok=' + encodeURIComponent(done.join(' · ')) : '') + (err ? '&e=' + encodeURIComponent(err) : ''))
}
