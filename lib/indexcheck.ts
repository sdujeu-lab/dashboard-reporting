import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import path from 'path'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false },
})
const KEY = path.join(process.cwd(), process.env.GOOGLE_KEY_FILE || 'service-account.json')
const MAX_URLS = 1500

export type IdxSt = { running: boolean; done: number; total: number; msg: string }
const g = globalThis as any
if (!g.__idxStatus) g.__idxStatus = new Map<string, IdxSt>()
export const getIdxStatus = (id: string): IdxSt | undefined => g.__idxStatus.get(String(id))
const setSt = (id: string, st: IdxSt) => g.__idxStatus.set(String(id), st)

async function getText(url: string) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (reporting)' } })
    return r.ok ? await r.text() : ''
  } catch {
    return ''
  }
}

const locs = (xml: string) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*(.*?)\s*(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))

async function collectUrls(domain: string) {
  const base = 'https://' + domain
  const robots = await getText(base + '/robots.txt')
  const found = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1])
  const defaults = ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml'].map((p) => base + p)
  const queue = [...found, ...defaults]
  const seen = new Set<string>()
  const urls = new Set<string>()
  while (queue.length && seen.size < 60) {
    const sm = queue.shift()!
    if (seen.has(sm)) continue
    seen.add(sm)
    if (/attachment|media|image/i.test(sm)) continue
    const xml = await getText(sm)
    if (!xml) continue
    if (xml.includes('<sitemapindex')) queue.push(...locs(xml))
    else locs(xml).forEach((u) => urls.add(u))
  }
  return [...urls]
}

async function inspect(sc: any, siteUrl: string, url: string) {
  const r = await sc.urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl, languageCode: 'fr-FR' },
  })
  const s = r.data.inspectionResult?.indexStatusResult
  return { indexed: s?.verdict === 'PASS', state: (s?.coverageState || s?.verdict || 'inconnu') as string }
}

export function startIndexCheck(siteId: string, domain: string, siteUrl: string) {
  const key = String(siteId)
  if (getIdxStatus(key)?.running) return
  setSt(key, { running: true, done: 0, total: 0, msg: 'Lecture du sitemap…' })

  ;(async () => {
    let done = 0
    let total = 0
    try {
      let urls = await collectUrls(domain)
      const smSet = new Set(urls)
      urls = [...new Set(urls)].filter((u) => !/\/et_pb_layout\//.test(u))
      if (!siteUrl.startsWith('sc-domain:')) urls = urls.filter((u) => u.startsWith(siteUrl))
      if (urls.length === 0) throw new Error('Aucune URL trouvée dans le sitemap pour cette propriété.')
      const cut = urls.length > MAX_URLS
      urls = urls.slice(0, MAX_URLS)
      total = urls.length
      const auth = new google.auth.GoogleAuth({
        keyFile: KEY,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      })
      const sc = google.searchconsole({ version: 'v1', auth })
      await db.from('rpt_index_urls').delete().eq('site_id', siteId)
      let indexed = 0
      let indexedSm = 0
      let totalSm = 0
      let errors = 0
      let firstErr = ''
      for (let i = 0; i < urls.length; i += 4) {
        const batch = urls.slice(i, i + 4)
        setSt(key, { running: true, done, total, msg: 'Inspection des pages…' })
        const res = await Promise.allSettled(batch.map((u) => inspect(sc, siteUrl, u)))
        const now = new Date().toISOString()
        const rows = res.map((r, j) => {
          if (r.status === 'fulfilled') {
            return { site_id: siteId, url: batch[j], indexed: r.value.indexed, state: r.value.state, checked_at: now, in_sitemap: smSet.has(batch[j]) }
          }
          errors++
          const msg = String((r.reason as any)?.message || r.reason).slice(0, 120)
          if (!firstErr) firstErr = msg
          return { site_id: siteId, url: batch[j], indexed: null, state: 'Erreur : ' + msg, checked_at: now, in_sitemap: smSet.has(batch[j]) }
        })
        indexed += rows.filter((r) => r.indexed === true).length
        indexedSm += rows.filter((r) => r.indexed === true && r.in_sitemap).length
        totalSm += rows.filter((r) => r.indexed !== null && r.in_sitemap).length
        await db.from('rpt_index_urls').upsert(rows, { onConflict: 'site_id,url' })
        done += batch.length
        if (errors >= 8 && done === errors) throw new Error(firstErr)
      }
      const checked = total - errors
      const month = new Date().toISOString().slice(0, 7) + '-01'
      await db.from('rpt_index_monthly').upsert(
        { site_id: siteId, month, total: checked, indexed, total_sitemap: totalSm, indexed_sitemap: indexedSm, checked_at: new Date().toISOString() },
        { onConflict: 'site_id,month' }
      )
      const extra = (cut ? ' (limité à ' + MAX_URLS + ' pages)' : '') + (errors ? ' · ' + errors + ' erreur(s)' : '')
      setSt(key, { running: false, done, total, msg: '✓ Sitemap : ' + indexedSm + ' pages indexées sur ' + totalSm + ' · Contrôle : ' + indexed + ' sur ' + checked + ' inspectées' + extra })
    } catch (e: any) {
      console.error('[index]', e)
      setSt(key, { running: false, done, total, msg: '✗ ' + (e.message || e) })
    }
  })()
}
