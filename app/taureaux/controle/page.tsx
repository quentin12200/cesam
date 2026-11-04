export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeGenealogyNational } from "@/lib/animal-genealogy-data";
import FatherControlTable, { type BullControlRow, type FatherConflict } from "./FatherControlTable";

function normalizedFull(value: string | null | undefined): string | null {
  const v = normalizeGenealogyNational(value);
  return /^(?:[0-9]{8,15}|[A-Z]{2}[0-9]{8,15})$/.test(v) ? v : null;
}

export default async function FatherControlPage() {
  const [bulls, animals, breedings] = await Promise.all([
    prisma.taureau.findMany({
      select: { id: true, nupere: true, nopere: true, present: true, _count: { select: { animaux: true, saillies: true } } },
      orderBy: { nopere: "asc" },
    }),
    prisma.animal.findMany({
      select: {
        nutrav: true, nobovi: true, taureauId: true, pereNationalManuel: true,
        velageVeau: {
          select: {
            pereNunati: true,
            gestation: { select: { saillie: { select: { taureauId: true } } } },
          },
        },
      },
    }),
    prisma.saillie.findMany({ select: { taureauId: true, type: true } }),
  ]);

  const byId = new Map(bulls.map((bull) => [bull.id, bull]));
  const rows: BullControlRow[] = bulls.map((bull) => {
    const national = normalizedFull(bull.nupere);
    const directlyLinked = animals.filter((animal) => animal.taureauId === bull.id);
    const manual = national ? animals.filter((animal) => normalizedFull(animal.pereNationalManuel) === national) : [];
    const calving = national ? animals.filter((animal) => normalizedFull(animal.velageVeau?.pereNunati) === national) : [];
    const unique = new Set([...directlyLinked, ...manual, ...calving].map((animal) => animal.nutrav));
    const associated = breedings.filter((breeding) => breeding.taureauId === bull.id);
    return {
      id: bull.id,
      number: bull.nupere,
      name: bull.nopere,
      present: bull.present,
      direct: directlyLinked.length,
      manual: manual.length,
      calving: calving.length,
      offspring: unique.size,
      breeding: associated.length,
      inseminations: associated.filter((breeding) => /IA|INSEMIN/i.test(breeding.type ?? "")).length,
      childNumbers: [...unique].sort(),
    };
  });

  const conflicts: FatherConflict[] = animals.flatMap((animal) => {
    const linked = animal.taureauId ? byId.get(animal.taureauId) : null;
    const direct = normalizedFull(linked?.nupere);
    const manual = normalizedFull(animal.pereNationalManuel);
    const calving = normalizedFull(animal.velageVeau?.pereNunati);
    const values = [direct, manual, calving].filter((v): v is string => Boolean(v));
    if (new Set(values).size <= 1) return [];
    return [{
      nutrav: animal.nutrav,
      name: animal.nobovi,
      bull: linked?.nupere ?? null,
      manual: animal.pereNationalManuel,
      calving: animal.velageVeau?.pereNunati ?? null,
    }];
  });

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 pb-24 sm:p-5">
      <Link href="/taureaux" className="text-sm font-semibold text-green-700 underline">Retour aux taureaux</Link>
      <div>
        <h1 className="text-xl font-black text-gray-900">Coulisses CESAM · Tableau des pères</h1>
        <p className="mt-1 text-sm text-gray-600">
          Vue type Excel reliée aux données de CESAM : trier, rechercher, contrôler les filiations,
          corriger le nom d&apos;un reproducteur ou accéder aux opérations de fusion.
        </p>
      </div>
      <FatherControlTable rows={rows} conflicts={conflicts} />
      <p className="text-xs text-gray-500">
        Les anciennes mentions de vêlage ne sont pas réécrites depuis ce tableau.
        Une discordance signale un contrôle à effectuer, pas forcément une erreur biologique.
        Aucune correction automatique n&apos;est effectuée.
      </p>
    </main>
  );
}
