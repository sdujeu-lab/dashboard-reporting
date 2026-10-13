const SKIP_SITEMAP = /attachment|media|image/i
const SKIP_URL = /et_pb_layout|\.(jpe?g|png|gif|webp|svg|pdf)$/i

async function get(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReportingBot)' },
    } as any)
    if (!r.ok) return ''
    return await r.text()
  } catch (e) {
    return ''
  }
}

function locs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, '&'))
  return out
}

export function keyOf(u: string): string {
  try {
    const x = new URL(u)
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase()
  } catch (e) {
    return u.toLowerCase()
  }
}

export async function sitemapPages(domain: string): Promise<string[]> {
  const base = 'https://' + domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const seeds: string[] = []
  const robots = await get(base + '/robots.txt')
  const rr = /^\s*sitemap:\s*(\S+)/gim
  let m: RegExpExecArray | null
  while ((m = rr.exec(robots))) seeds.push(m[1])
  seeds.push(base + '/sitemap_index.xml', base + '/sitemap.xml', base + '/wp-sitemap.xml')

  const seen = new Set<string>()
  const pages = new Set<string>()
  let queue = Array.from(new Set(seeds))
  let rounds = 0
  while (queue.length && rounds < 4 && seen.size < 40 && pages.size < 5000) {
    rounds++
    const batch = queue.filter((u) => !seen.has(u) && !SKIP_SITEMAP.test(u)).slice(0, 20)
    batch.forEach((u) => seen.add(u))
    const xmls = await Promise.all(batch.map((u) => get(u)))
    const next: string[] = []
    xmls.forEach((xml) => {
      if (!xml) return
      const l = locs(xml)
      if (xml.indexOf('<sitemapindex') > -1) l.forEach((u) => next.push(u))
      else l.forEach((u) => { if (!SKIP_URL.test(u)) pages.add(u) })
    })
    queue = next
    // si le premier sitemap a donné des pages, on n'essaie pas les autres graines
    if (pages.size && rounds === 1 && next.length === 0) break
  }
  return Array.from(pages)
}
