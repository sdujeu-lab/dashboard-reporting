'use client';

export default function DeleteButton({ keyword }: { keyword: string }) {
  return (
    <button
      type="submit"
      className="text-xs text-red-600 hover:underline"
      onClick={(e) => {
        if (!confirm(`Supprimer « ${keyword} » et tout son historique ?`)) e.preventDefault();
      }}
    >
      Supprimer
    </button>
  );
}
