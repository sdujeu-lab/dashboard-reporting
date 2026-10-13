import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false },
})

const LOCATION = "Marseille,Provence-Alpes-Cote d'Azur,France"
const RUNS = Math.min(3, Math.max(1, Number(process.env.RANK_RUNS) || 2))
const NOT_FOUND = 51
const NOTE = 'Mesuré en secours (top 20 ou France) : à revérifier sur 50 depuis la ville choisie'

export type RankSt = { running: boolean; done: number; total: number; msg: string; cost: number }
const g = globalThis as any
if (!g.__rankStatus) g.__rankStatus = new Map<string, RankSt>()

export const getRankStatus = (siteId: string): RankSt | undefined => g.__rankStatus.get(String(siteId))
const setSt = (siteId: string, st: RankSt) => g.__rankStatus.set(String(siteId), st)

async function serp(keyword: string, domain: string, depth = 50, loc = LOCATION) {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword, location_name: loc, language_code: 'fr', device: 'desktop', depth }]),
  })
  const j: any = await res.json()
  const task = j.tasks?.[0]
  if (!task || task.status_code !== 20000) throw new Error(task?.status_message || 'Erreur DataForSEO')
  const items: any[] = task.result?.[0]?.items || []
  const hit = items.find((i) => i.type === 'organic' && (i.domain || '').replace(/^www\./, '').endsWith(domain))
  if (!hit && depth < 50) throw new Error('Site absent du top ' + depth + ' (top 50 indisponible)')
  return { rank: hit ? (hit.rank_group as number) : NOT_FOUND, url: hit ? (hit.url as string) : null, cost: (task.cost as number) || 0, loc, depth }
}

async function serpRetry(keyword: string, domain: string, home: string = LOCATION) {
  let err: any
  const tries: [number, string][] = [[50, home], [50, home], [20, home], [50, 'France']]
  for (const [depth, loc] of tries) {
    try {
      return await serp(keyword, domain, depth, loc)
    } catch (e) {
      err = e
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw err
}

export function startRank(siteId: string, domain: string, scope: 'priority' | 'all' | 'errors' | 'gsc') {
  const key = String(siteId)
  if (getRankStatus(key)?.running) return
  setSt(key, { running: true, done: 0, total: 0, msg: 'Démarrage…', cost: 0 })

  ;(async () => {
    let done = 0
    let cost = 0
    const failed: string[] = []
    try {
      const { data: stRow } = await db.from('rpt_sites').select('rank_location').eq('id', siteId).maybeSingle()
      const home: string = (stRow as any)?.rank_location || LOCATION
      let q = db.from('rpt_keywords').select('id, keyword').eq('site_id', siteId).order('keyword')
      q = q.eq('priority', true)
      const { data: kws, error } = await q.range(0, 999)
      if (error) throw new Error(error.message)
      const month = new Date().toISOString().slice(0, 7) + '-01'
      const { data: errs } = await db.from('rpt_rank_errors').select('keyword_id').eq('month', month)
      const errIds = new Set((errs || []).map((x: any) => String(x.keyword_id)))
      const list = (kws || []).filter((x: any) => scope !== 'errors' || errIds.has(String(x.id))).sort((a: any, b: any) => Number(errIds.has(String(b.id))) - Number(errIds.has(String(a.id))))
      if (!list.length) throw new Error(scope === 'errors' ? 'Aucun mot-clé en erreur ce mois-ci.' : 'Aucun mot-clé à mesurer (coche prioritaire dans Gérer).')
      const total = list.length

      for (const k of list) {
        setSt(key, { running: true, done, total, msg: `Mesure : ${k.keyword}`, cost })
        const settled = await Promise.allSettled(Array.from({ length: RUNS }, () => serpRetry(k.keyword, domain, home)))
        const runs: any[] = settled.filter((x) => x.status === 'fulfilled').map((x: any) => x.value)
        if (runs.length === 0) {
          const why = (settled[0] as any).reason?.message || 'inconnu'
          failed.push(k.keyword + ' (' + why + ')')
          await db.from('rpt_rank_errors').upsert({ keyword_id: String(k.id), month, error: String(why), checked_at: new Date().toISOString() }, { onConflict: 'keyword_id,month' })
          continue
        }
        cost += runs.reduce((s, r) => s + r.cost, 0)
        runs.sort((a, b) => a.rank - b.rank)
        const med = runs[Math.floor((runs.length - 1) / 2)]
        const rank = med.rank === NOT_FOUND ? null : med.rank
        const row = { keyword_id: k.id, month, rank, url: med.url, location: med.loc, checked_at: new Date().toISOString() }
        const { error: e2 } = await db.from('rpt_keyword_rank').upsert(row, { onConflict: 'keyword_id,month' })
        if (e2) throw new Error(e2.message)
        const fb = runs.some((r) => r.loc !== home || r.depth < 50)
        if (fb) await db.from('rpt_rank_errors').upsert({ keyword_id: String(k.id), month, error: NOTE, checked_at: new Date().toISOString() }, { onConflict: 'keyword_id,month' })
        else await db.from('rpt_rank_errors').delete().eq('keyword_id', String(k.id)).eq('month', month)
        try {
          const ai = await aiCheck(k.keyword, domain, home)
          cost += ai.cost
          const { error: eAi } = await db.from('rpt_keyword_ai').upsert({ keyword_id: String(k.id), month, has_ai: ai.has, cited: ai.cited, sources: ai.sources, checked_at: new Date().toISOString() }, { onConflict: 'keyword_id,month' })
          if (eAi) console.error('[ai]', eAi.message)
        } catch (e) { console.error('[ai]', e) }
        done++
      }
      setSt(key, { running: false, done, total, msg: (failed.length ? 'Terminé : ' + done + ' mesurés, ' + failed.length + ' échec(s) : ' + failed.join(' ; ') : '✓ ' + done + ' mots-clés mesurés'), cost })
    } catch (e: any) {
      console.error('[rank]', e)
      setSt(key, { running: false, done, total: done, msg: `✗ ${e.message || e}`, cost })
    }
  })()
}

const hostOf = (u: string) => {
  const m = String(u || '').toLowerCase().match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/)
  return (m ? m[0] : '').replace(/^www\./, '')
}

async function aiCheck(keyword: string, domain: string, loc: string) {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
  let last: any
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keyword, location_name: loc, language_code: 'fr', device: 'desktop', depth: 10, load_async_ai_overview: true }]),
      })
      const j: any = await res.json()
      const t = j.tasks?.[0]
      if (!t || t.status_code !== 20000) throw new Error(t?.status_message || 'Erreur DataForSEO')
      const items: any[] = t.result?.[0]?.items || []
      const ai = items.filter((x) => x.type === 'ai_overview')
      const refs: any[] = []
      for (const a of ai) {
        for (const r of a.references || []) refs.push(r)
        for (const e of a.items || []) for (const r of e.references || []) refs.push(r)
      }
      const hosts = [...new Set(refs.map((r) => hostOf(r.domain || r.url)).filter(Boolean))]
      const mine = domain.replace(/^www\./, '').toLowerCase()
      return { has: ai.length > 0, cited: hosts.some((h) => h === mine || h.endsWith('.' + mine)), sources: hosts.slice(0, 12), cost: (t.cost as number) || 0 }
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500)) }
  }
  throw last
}
