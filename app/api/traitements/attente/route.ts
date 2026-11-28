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

  const viandeInterdite = traitements.some(t=>getAttenteInfoForTraitement(t).viandeInterdite);
  const laitInterdit = traitements.some(t=>getAttenteInfoForTraitement(t).laitInterdit);
  const viandeInconnue = traitements.some(t=>delaisInconnus(t).viande);
  const laitInconnu = traitements.some(t=>delaisInconnus(t).lait);
  return NextResponse.json({
    viandeInconnue, laitInconnu, viandeInterdite, laitInterdit,
    enAttente: viandeInterdite || laitInterdit || viandeInconnue || laitInconnu || (pire?.enAttente ?? false),
    enAttenteViande: viandeInterdite || viandeInconnue || (pire?.enAttenteViande ?? false),
    enAttenteLait: laitInterdit || laitInconnu || (pire?.enAttenteLait ?? false),
    dateFinAttenteViande: viandeInterdite || viandeInconnue ? null : pire?.dateFinAttenteViande ?? null,
    dateFinAttenteLait: laitInterdit || laitInconnu ? null : pire?.dateFinAttenteLait ?? null,
    medicamentNom,
  });
}
