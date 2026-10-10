'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg border bg-white px-3 py-1.5 text-sm"
    >
      Exporter en PDF
    </button>
  )
}
