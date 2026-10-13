export function hostOf(u: string): string {
  try {
    return new URL(u.indexOf('://') > -1 ? u : 'http://' + u).hostname.replace(/^www\./, '').toLowerCase()
  } catch (e) {
    return u.toLowerCase()
  }
}

const BAD_TLD = ['xyz', 'top', 'click', 'loan', 'win', 'bid', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'date', 'download', 'stream', 'science', 'party', 'review', 'trade', 'men', 'racing', 'cricket', 'accountant', 'faith', 'zip', 'mov', 'icu', 'cyou', 'monster', 'buzz']
const OK_CC = ['fr', 'be', 'ch', 'lu', 'mc', 're', 'gp', 'mq', 'nc', 'pf', 'eu', 'io', 'co', 'ai', 'tv', 'me']
const BAD_WORDS = ['casino', 'poker', 'porn', 'xxx', 'escort', 'viagra', 'cialis', 'pharma', 'payday', 'slots', 'jackpot', 'backlink', 'linkbuilding', 'buylinks', 'forex', 'replica', 'crypto', 'adult']

export function suspicion(domain: string): string[] {
  const d = domain.toLowerCase()
  const parts = d.split('.')
  const tld = parts[parts.length - 1]
  const name = parts.length > 1 ? parts[parts.length - 2] : d
  const out: string[] = []
  if (BAD_TLD.includes(tld)) out.push('extension à risque (.' + tld + ')')
  else if (tld.length === 2 && !OK_CC.includes(tld)) out.push('extension étrangère (.' + tld + ')')
  for (const w of BAD_WORDS) {
    if (d.includes(w)) { out.push('mot suspect « ' + w + ' »'); break }
  }
  if ((name.match(/-/g) || []).length >= 3) out.push('beaucoup de tirets')
  if ((name.match(/\d/g) || []).length >= 4) out.push('beaucoup de chiffres')
  if (name.length > 30) out.push('nom très long')
  return out
}
