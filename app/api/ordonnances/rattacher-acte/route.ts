import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierRattachementOrdonnanceActe } from "@/lib/vaccine-prescription-attachment";

/** Rattache uniquement une ordonnance à un acte existant : aucune injection créée. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const sourceType = body.sourceType;
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const ordonnanceId = typeof body.ordonnanceId === "string" ? body.ordonnanceId : "";
    if (!["VACCINATION", "TRAITEMENT"].includes(sourceType) || !sourceId || !ordonnanceId) {
      return NextResponse.json({ error: "Acte et ordonnance requis" }, { status: 400 });
    }
    const ordonnance = await prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
      select: { id: true, numero: true, medicamentId: true, medicamentNom: true,
        medicaments: { select: { medicamentId: true, nomExtrait: true, medicament: { select: { nom: true } } } } },
    });
    if (!ordonnance) return NextResponse.json({ error: "Ordonnance introuvable" }, { status: 404 });
    const acte = sourceType === "VACCINATION"
      ? await prisma.vaccination.findUnique({ where: { id: sourceId }, select: { medicamentId: true, ordonnanceId: true, vaccin: true } })
      : await prisma.traitement.findUnique({ where: { id: sourceId }, select: { medicamentId: true, ordonnanceId: true, medicamentNom: true, medicament: { select: { categorie: true } } } });
    if (!acte) return NextResponse.json({ error: "Acte introuvable" }, { status: 404 });
    const ids = [ordonnance.medicamentId, ...ordonnance.medicaments.map((item) => item.medicamentId)];
    const erreur = verifierRattachementOrdonnanceActe({
      sourceType, sourceId, ordonnanceId, acteExiste: true,
      estVaccin: sourceType === "VACCINATION" || ("medicament" in acte && acte.medicament?.categorie === "VACCIN"),
      medicamentId: acte.medicamentId, medicamentsOrdonnanceIds: ids,
      ordonnanceActuelleId: acte.ordonnanceId,
      nomVaccinActe: "vaccin" in acte ? acte.vaccin : acte.medicamentNom,
      nomsVaccinsOrdonnance: [ordonnance.medicamentNom, ...ordonnance.medicaments.flatMap((item) => [item.nomExtrait, item.medicament.nom])],
      nombreMedicamentsOrdonnance: ordonnance.medicaments.length || (ordonnance.medicamentId || ordonnance.medicamentNom.trim() ? 1 : 0),
    });
    if (erreur) return NextResponse.json({ error: erreur }, { status: erreur.includes("déjà") ? 409 : 400 });
    if (sourceType === "VACCINATION") {
      await prisma.vaccination.update({ where: { id: sourceId }, data: { ordonnanceId: ordonnance.id, ordonnanceNumero: ordonnance.numero } });
    } else {
      await prisma.traitement.update({ where: { id: sourceId }, data: { ordonnanceId: ordonnance.id, ordonnanceNumero: ordonnance.numero, ordonnanceAAssocier: false } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/ordonnances/rattacher-acte:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
