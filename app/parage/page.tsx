export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { lirePattes } from "@/lib/parage";
import ParageClient, { type LigneParage } from "./ParageClient";

function serialiser(row: {
  id: string;
  animalId: string;
  date: Date;
  motif: string;
  pattes: string;
  notes: string | null;
  statut: string;
  dateFait: Date | null;
  animal: { nutrav: string; nobovi: string | null };
}): LigneParage {
  return {
    id: row.id,
    animalId: row.animalId,
    nutrav: row.animal.nutrav,
    nom: row.animal.nobovi,
    date: row.date.toISOString(),
    motif: row.motif,
    pattes: lirePattes(row.pattes),
    notes: row.notes,
    statut: row.statut,
    dateFait: row.dateFait?.toISOString() ?? null,
  };
}

export default async function ParagePage() {
  const [aFaire, historique, groupes] = await Promise.all([
    prisma.parage.findMany({
      where: { statut: "A_VOIR" },
      include: { animal: { select: { nutrav: true, nobovi: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.parage.findMany({
      where: { statut: "FAIT" },
      include: { animal: { select: { nutrav: true, nobovi: true } } },
      orderBy: { dateFait: "desc" },
      take: 100,
    }),
    prisma.groupe.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
  ]);

  return (
    <ParageClient
      aFaire={aFaire.map(serialiser)}
      historique={historique.map(serialiser)}
      groupes={groupes}
    />
  );
}
