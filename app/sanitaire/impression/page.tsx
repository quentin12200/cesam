export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { differenceInDays, addDays } from "date-fns";
import { getVaccinProtocolSteps, DEFAULT_PROTOCOLES, type ProtocoleVaccinConfig } from "@/lib/utils";
import ImpressionClient from "./ImpressionClient";

async function getProtocoles(): Promise<ProtocoleVaccinConfig[]> {
  try {
    const rows = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
    if (rows.length > 0) return rows;
  } catch { /* fallback */ }
  return DEFAULT_PROTOCOLES;
}

async function getExploitationConfig() {
  try {
    return await prisma.exploitationConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}

export default async function SanitaireImpressionPage() {
  const [protocoles, animaux, config, traitementsRaw] = await Promise.all([
    getProtocoles(),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: { vaccinations: { orderBy: { date: "asc" } } },
      orderBy: { danais: "asc" },
    }),
    getExploitationConfig(),
    prisma.traitement.findMany({
      where: {
        OR: [
          { statut: "EN_COURS" },
          { statut: "TERMINE", dateDebut: { gte: addDays(new Date(), -90) } },
        ],
      },
      include: {
        animal: { select: { nutrav: true, nobovi: true } },
        medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } },
      },
      orderBy: { dateDebut: "desc" },
      take: 100,
    }),
  ]);

  const now = new Date();
  const printDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const jeunes = animaux.filter((a) => differenceInDays(now, a.danais) <= 365 * 2);

  const traitements = traitementsRaw.map((t) => ({
    id: t.id,
    animalNutrav: t.animal.nutrav,
    animalNobovi: t.animal.nobovi,
    medicamentNom: t.medicamentNom,
    dateDebut: t.dateDebut,
    dureeJours: t.dureeJours,
    motif: t.motif,
    statut: t.statut,
    delaiAttenteViandeJ: t.medicament?.delaiAttenteViandeJ ?? null,
    delaiAttenteLaitJ: t.medicament?.delaiAttenteLaitJ ?? null,
  }));

  return (
    <>
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/sanitaire" className="text-sm text-gray-600 hover:text-gray-800">← Retour sanitaire</Link>
      </div>

      <div className="px-4 pb-8 max-w-5xl mx-auto">
        <ImpressionClient
          animaux={jeunes.map((a) => ({
            id: a.id,
            nutrav: a.nutrav,
            nobovi: a.nobovi,
            danais: a.danais,
            vaccinations: a.vaccinations.map((v) => ({ id: v.id, vaccin: v.vaccin, date: v.date })),
          }))}
          protocoles={protocoles}
          traitements={traitements}
          exploitationNom={config?.raisonSociale ?? "GAEC Samuel & Céline"}
          exploitationIPG={config?.ipg}
          telephone={config?.telephone}
          adresse={config?.adresse}
          vetNom={config?.veterinaireNom}
          vetTel={config?.veterinaireTel}
          printDate={printDate}
        />
      </div>
    </>
  );
}
