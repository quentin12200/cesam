import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAttenteInfoForTraitement, delaisInconnus, type AttenteInfo } from "@/lib/withdrawal";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const animalId = searchParams.get("animalId");
  if (!animalId) return NextResponse.json({ error: "animalId requis" }, { status: 400 });

  const traitements = await prisma.traitement.findMany({
    where: { animalId },
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

  const viandeInconnue = traitements.some(t=>delaisInconnus(t).viande);
  const laitInconnu = traitements.some(t=>delaisInconnus(t).lait);
  return NextResponse.json({
    viandeInconnue, laitInconnu,
    enAttente: viandeInconnue || laitInconnu || (pire?.enAttente ?? false),
    enAttenteViande: viandeInconnue || (pire?.enAttenteViande ?? false),
    enAttenteLait: laitInconnu || (pire?.enAttenteLait ?? false),
    dateFinAttenteViande: pire?.dateFinAttenteViande ?? null,
    dateFinAttenteLait: pire?.dateFinAttenteLait ?? null,
    medicamentNom,
  });
}
