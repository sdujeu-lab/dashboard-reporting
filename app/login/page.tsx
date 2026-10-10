import { login } from './actions'

export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="text-xl font-semibold">Reporting clients</h1>
      <form action={login} className="mt-6 flex flex-col gap-3">
        <input type="password" name="password" placeholder="Mot de passe" autoFocus className="rounded-lg border px-3 py-2" />
        {sp.e && <p className="text-sm text-red-600">Mot de passe incorrect.</p>}
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-white">Se connecter</button>
      </form>
    </main>
  )
}
