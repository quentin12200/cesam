export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { sameBullCandidates, fullNational } from "@/lib/bull-identity";
import BullDuplicatesClient, { type DuplicatePair } from "./BullDuplicatesClient";

export default async function BullDuplicateAuditPage() {
  const bulls = await prisma.taureau.findMany({
    select: {
      id: true, nupere: true, nopere: true,
      _count: { select: { animaux: true, saillies: true } },
    },
    orderBy: { nopere: "asc" },
  });
  const pairs: DuplicatePair[] = [];
  // Une fiche à numéro complet est toujours conservée, sinon aucun bouton
  // de fusion n'est proposé. Aucun regroupement sur nom seul.
  for (let i = 0; i < bulls.length; i++) {
    for (let j = i + 1; j < bulls.length; j++) {
      const a = bulls[i], b = bulls[j];
      const confidence = sameBullCandidates(a, b);
      if (!confidence) continue;
      const keep = fullNational(a.nupere) ? a : fullNational(b.nupere) ? b : null;
      if (!keep) continue;
      const remove = keep.id === a.id ? b : a;
      pairs.push({
        keep: { id: keep.id, number: keep.nupere, name: keep.nopere },
        remove: { id: remove.id, number: remove.nupere, name: remove.nopere },
        confidence,
        linkedAnimals: remove._count.animaux,
        linkedBreedings: remove._count.saillies,
      });
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <Link href="/taureaux" className="text-sm font-semibold text-green-700 underline">Retour aux taureaux</Link>
      <h1 className="text-xl font-bold">Vérifier les doublons des reproducteurs</h1>
      <p className="text-sm text-gray-600">
        Cette page recherche les fiches ayant le même numéro national, ou un numéro court
        et un nom correspondant à une fiche complète. Une référence historique
        dans un vêlage n&apos;est pas forcément une deuxième fiche Taureau.
      </p>
      <BullDuplicatesClient pairs={pairs} />
      <p className="text-xs text-gray-500">
        Aucun rapprochement automatique. Les noms seuls et les quatre derniers chiffres
        seuls ne suffisent pas. La fusion conserve les saillies et les animaux liés,
        sans modifier les textes historiques des vêlages.
      </p>
    </main>
  );
}
