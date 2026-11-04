export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "@/app/components/BackButton";
import { prisma } from "@/lib/prisma";
import { normalizeGenealogyNational } from "@/lib/animal-genealogy-data";
import { GENEA_DATA, nutravFromNat } from "@/app/api/genealogie-import/data";

export default async function DescendanceTaureauPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const taureau = await prisma.taureau.findUnique({
    where: { id },
    select: { id: true, nupere: true, nopere: true, present: true },
  });
  if (!taureau) notFound();

  const bullNational = normalizeGenealogyNational(taureau.nupere);
  const hasFullNational = /^[0-9]{8,15}$/.test(bullNational);
  // Lecture seule. Les liens explicites sont prioritaires ; une parenté
  // historique n'est rapprochée qu'avec un numéro national COMPLET identique.
  const animaux = await prisma.animal.findMany({
    select: {
      id: true, nutrav: true, nunati: true, numeroNational: true,
      nobovi: true, sexbov: true, statut: true, danais: true,
      taureauId: true, pereNationalManuel: true,
      velageVeau: {
        select: {
          pereNunati: true,
          gestation: { select: { saillie: { select: { taureauId: true } } } },
        },
      },
    },
    orderBy: [{ danais: "desc" }, { nutrav: "asc" }],
  });

  const descendants = animaux.filter((animal) => {
    if (animal.taureauId === taureau.id || animal.velageVeau?.gestation?.saillie?.taureauId === taureau.id) {
      return true;
    }
    if (!hasFullNational) return false;
    return [animal.pereNationalManuel, animal.velageVeau?.pereNunati].some(
      (number) => normalizeGenealogyNational(number) === bullNational,
    );
  });
  const presents = descendants.filter((animal) => animal.statut === "ACTIF");
  const sortis = descendants.filter((animal) => animal.statut !== "ACTIF");

  // Des fiches issues d'anciens PDFs peuvent ne pas exister dans CESAM.
  // Elles sont signalées séparément : "non retrouvé" ne signifie pas "sorti".
  const nationalsInDb = new Set(
    animaux.map((animal) => normalizeGenealogyNational(animal.numeroNational ?? animal.nunati)),
  );
  const historicalUnmatched = hasFullNational
    ? GENEA_DATA.filter(
        (entry) =>
          normalizeGenealogyNational(entry.pereNat) === bullNational
          && !nationalsInDb.has(normalizeGenealogyNational(entry.veauNat)),
      )
    : [];

  const group = (
    title: string,
    items: typeof descendants,
    color: "green" | "gray",
  ) => (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className={`mb-3 font-semibold ${color === "green" ? "text-emerald-800" : "text-gray-700"}`}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun descendant dans cette catégorie.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((animal) => (
            <Link key={animal.id} href={`/troupeau/${animal.nutrav}`}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm hover:underline ${
                color === "green"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}>
              <span className="font-mono font-bold">{animal.nutrav}</span>
              {animal.nobovi && <span>· {animal.nobovi}</span>}
              {color === "gray" && <span className="text-xs">({animal.statut.toLowerCase()})</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="flex items-center gap-3">
        <BackButton className="rounded-lg bg-white p-2 text-gray-500 shadow" iconSize={18} />
        <div>
          <h1 className="text-xl font-bold text-gray-800">Descendance de {taureau.nopere ?? "ce taureau"}</h1>
          <p className="font-mono text-xs text-gray-500">{taureau.nupere}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <strong>{descendants.length} descendants enregistrés</strong>
        <span className="text-emerald-700">{presents.length} présents</span>
        <span className="text-gray-500">{sortis.length} sortis / absents du troupeau</span>
      </div>
      {group("Présents sur l'exploitation", presents, "green")}
      {group("Sortis ou absents de l'exploitation", sortis, "gray")}
      {historicalUnmatched.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">Anciens relevés non retrouvés dans CESAM ({historicalUnmatched.length})</h3>
          <p className="mt-1 text-xs text-amber-800">
            Ces animaux figurent dans l'import historique, mais leur statut n'est pas connu.
            Ils ne sont pas comptés parmi les animaux sortis.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {historicalUnmatched.map((entry) => (
              <span key={entry.veauNat} className="rounded border border-amber-200 bg-white px-2 py-1 text-xs text-amber-900">
                {nutravFromNat(entry.veauNat)}{entry.nom ? ` · ${entry.nom}` : ""}
              </span>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-gray-500">
        Descendance directe uniquement, établie avec les liens de filiation ou le numéro national exact.
        Une filiation non renseignée peut manquer. Aucun animal n'est modifié par cette page.
      </p>
      <Link href="/taureaux" className="inline-block text-sm font-medium text-green-700 underline">
        Retour au répertoire des taureaux
      </Link>
    </main>
  );
}
