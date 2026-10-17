'use client'
import { useFormStatus } from 'react-dom'

export default function SubmitButton({ children, pending, className }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending: busy } = useFormStatus()
  return (
    <button disabled={busy} className={(className || 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white') + ' disabled:opacity-60'}>
      {busy ? pending : children}
    </button>
  )
}
