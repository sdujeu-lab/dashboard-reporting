'use client'

export default function PrintButton({ label = 'Exporter en PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg border bg-white px-3 py-1.5 text-sm"
    >
      {label}
    </button>
  )
}
