'use client';

export default function DeleteClientButton({ name }: { name: string }) {
  return (
    <button
      type="submit"
      className="text-xs text-red-600 hover:underline"
      onClick={(e) => {
        if (!confirm(`Supprimer le client « ${name} » et TOUTES ses données (stats, mots-clés, positions) ? Cette action est définitive.`)) {
          e.preventDefault();
        }
      }}
    >
      Supprimer ce client
    </button>
  );
}
