import Link from "next/link";

export default function SessionNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Séance introuvable</h1>
      <p className="mt-2 text-gray-600">Cette séance n’existe pas dans cette base CESAM.</p>
      <Link href="/troupeau/pesee/sessions" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-black px-4 font-semibold text-white">Voir les séances</Link>
    </main>
  );
}
