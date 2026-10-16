import { NextRequest, NextResponse } from 'next/server'

async function sign(pwd: string) {
  const data = new TextEncoder().encode('lfdw-reporting:' + pwd)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Pages clients : le jeton est vérifié dans la page elle-même
  if (path.startsWith('/c/')) {
    const res = NextResponse.next()
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('Referrer-Policy', 'no-referrer')
    return res
  }

  const pwd = process.env.ADMIN_PASSWORD
  if (!pwd) return new NextResponse('ADMIN_PASSWORD non configuré', { status: 500 })
  if (path === '/login' || path.startsWith('/api/cron')) return NextResponse.next()
  const token = req.cookies.get('rpt_auth')?.value
  if (token && token === (await sign(pwd))) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}