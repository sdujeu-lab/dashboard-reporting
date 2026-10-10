'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RankRefresh() {
  const r = useRouter()
  useEffect(() => {
    const t = setInterval(() => r.refresh(), 3000)
    return () => clearInterval(t)
  }, [r])
  return null
}
