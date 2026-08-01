import Link from "next/link";
import { differenceInMonths } from "date-fns";
import { ArrowLeft, ArrowRight, Scale } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { neverWeighedAnimalWhere } from "@/lib/weighing-news";

export const dynamic = "force-dynamic";

export default async function NeverWeighedAnimalsPage() {
  const now = new Date();
  const animals = await prisma.animal.findMany({
    where: neverWeighedAnimalWhere(now),
    select: { id: true, nutrav: true, nobovi: true, danais: true, sexbov: true },
    orderBy: [{ danais: "asc" }, { nutrav: "asc" }],
  });

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 pb-24">
      <div className="flex items-center gap-3 border-b-2 border-black pb-3">
        <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-300" aria-label="Retour à l’accueil"><ArrowLeft size={22} /></Link>
        <div>
          <h1 className="text-2xl font-bold">Veaux jamais pesés</h1>
          <p className="text-sm text-gray-600">{animals.length} animaux actifs de 10 mois ou plus</p>
        </div>
      </div>

      <Link href="/troupeau/pesee" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-md bg-green-700 px-4 font-bold text-white">
        <Scale size={20} /> Démarrer une pesée
      </Link>

      {animals.length === 0 ? (
        <p className="mt-6 border-y border-gray-300 py-8 text-center font-semibold text-gray-600">Tous les animaux concernés ont été pesés.</p>
      ) : (
        <section className="mt-5 md:grid md:grid-cols-2 md:gap-3" aria-label="Animaux jamais pesés">
          {animals.map((animal) => (
            <Link key={animal.id} href={`/troupeau/${animal.nutrav}`} className="flex min-h-14 items-center gap-3 border-b border-gray-300 bg-white px-2 py-3 md:rounded-md md:border md:px-3">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{animal.nutrav}{animal.nobovi ? ` — ${animal.nobovi}` : ""}</p>
                <p className="text-sm text-gray-600">{animal.sexbov === "M" ? "Mâle" : "Femelle"} · {differenceInMonths(now, animal.danais)} mois</p>
              </div>
              <span className="flex min-h-11 items-center gap-1 text-sm font-semibold">Voir <ArrowRight size={16} /></span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
