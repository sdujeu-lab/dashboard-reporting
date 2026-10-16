'use client'

import { usePathname } from 'next/navigation'

export default function NavGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname.startsWith('/c/')) return null
  return <>{children}</>
}