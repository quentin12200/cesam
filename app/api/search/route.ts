import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import { getVaccinProtocolSteps, isMheVendable } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const animaux = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      OR: [
        { nutrav: { contains: q } },
        { nobovi: { contains: q } },
        { nunati: { contains: q } },
      ],
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      danais: true,
      sexbov: true,
      estGenisse: true,
      vaccinations: { select: { vaccin: true, date: true } },
      pesees: { orderBy: { date: "desc" }, take: 1, select: { poids: true, date: true } },
      saillies: {
        orderBy: { date: "desc" },
        take: 1,
        select: { gestation: { select: { etat: true, dateVelagePrevue: true } } },
      },
    },
    take: 8,
    orderBy: { nutrav: "asc" },
  });

  const now = new Date();

  const results = animaux.map((a) => {
    const ageJours = differenceInDays(now, a.danais);
    const moisAge = Math.floor(ageJours / 30);
    const ageLabel =
      moisAge >= 24
        ? `${Math.floor(moisAge / 12)} ans ${moisAge % 12 > 0 ? `${moisAge % 12} m` : ""}`.trim()
        : `${moisAge} m`;

    const mhe = isMheVendable(a.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date })));
    const etat = a.saillies[0]?.gestation?.etat ?? null;
    const dernierePesee = a.pesees[0] ?? null;
    const categorie =
      a.sexbov === "F" ? (a.estGenisse ? "Génisse" : "Vache") : "Mâle";

    return {
      id: a.id,
      nutrav: a.nutrav,
      nom: a.nobovi,
      ageLabel,
      categorie,
      etatGestation: etat,
      mheVendable: mhe.vendable,
      mheRaison: mhe.reason,
      dernierPoids: dernierePesee?.poids ?? null,
    };
  });

  return NextResponse.json(results);
}
