import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAttenteInfoForTraitement, type AttenteInfo } from "@/lib/withdrawal";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const animalId = searchParams.get("animalId");
  if (!animalId) return NextResponse.json({ error: "animalId requis" }, { status: 400 });

  const traitements = await prisma.traitement.findMany({
    where: { animalId, dateDebut: { gte: subDays(new Date(), 90) } },
    include: { medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } } },
    orderBy: { dateDebut: "desc" },
  });

  let pire: AttenteInfo | null = null;
  let medicamentNom: string | null = null;
  for (const t of traitements) {
    const attente = getAttenteInfoForTraitement(t);
    if (!attente.enAttente) continue;
    const plusTard =
      !pire ||
      (attente.dateFinAttenteViande && (!pire.dateFinAttenteViande || attente.dateFinAttenteViande > pire.dateFinAttenteViande));
    if (plusTard) {
      pire = attente;
      medicamentNom = t.medicamentNom;
    }
  }

  return NextResponse.json({
    enAttente: pire?.enAttente ?? false,
    enAttenteViande: pire?.enAttenteViande ?? false,
    enAttenteLait: pire?.enAttenteLait ?? false,
    dateFinAttenteViande: pire?.dateFinAttenteViande ?? null,
    dateFinAttenteLait: pire?.dateFinAttenteLait ?? null,
    medicamentNom,
  });
}
