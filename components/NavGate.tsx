'use client'

import { usePathname } from 'next/navigation'

export default function NavGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname.startsWith('/c/') || pathname.startsWith('/synthese/pdf')) return null
  return <>{children}</>
}