'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/mots-cles', label: 'Mots-clés (GSC)' },
  { href: '/rang', label: 'Rang réel' },
  { href: '/mesurer', label: 'Mesurer les rangs' },
  { href: '/gerer', label: 'Gérer les mots-clés' },
  { href: '/clients', label: 'Clients' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="sticky top-0 z-50 border-b bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-2 text-sm">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                'rounded-md px-3 py-1.5 ' +
                (active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100')
              }
            >
              {l.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
