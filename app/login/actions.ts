'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto'

export async function login(formData: FormData) {
  const pwd = process.env.ADMIN_PASSWORD
  const given = String(formData.get('password') || '')
  if (!pwd || given !== pwd) redirect('/login?e=1')
  const token = createHash('sha256').update('lfdw-reporting:' + pwd).digest('hex')
  ;(await cookies()).set('rpt_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect('/')
}
