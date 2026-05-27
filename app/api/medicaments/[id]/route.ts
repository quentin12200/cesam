import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    nom, dci, categorie, voie, dosagePourKg, uniteDosage,
    delaiAttenteViandeJ, prescriptionRequise, actif,
    stockActuel, stockUnite, stockSeuilAlert,
  } = body;

  try {
    const med = await prisma.medicament.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom: nom.trim().toUpperCase() }),
        ...(dci !== undefined && { dci: dci?.trim() || null }),
        ...(categorie !== undefined && { categorie }),
        ...(voie !== undefined && { voie: voie?.trim() || null }),
        ...(dosagePourKg !== undefined && { dosagePourKg }),
        ...(uniteDosage !== undefined && { uniteDosage: uniteDosage?.trim() || null }),
        ...(delaiAttenteViandeJ !== undefined && { delaiAttenteViandeJ }),
        ...(prescriptionRequise !== undefined && { prescriptionRequise }),
        ...(actif !== undefined && { actif }),
        ...(stockActuel !== undefined && { stockActuel: stockActuel != null ? Number(stockActuel) : null }),
        ...(stockUnite !== undefined && { stockUnite: stockUnite?.trim() || null }),
        ...(stockSeuilAlert !== undefined && { stockSeuilAlert: stockSeuilAlert != null ? Number(stockSeuilAlert) : null }),
      },
    });
    return NextResponse.json(med);
  } catch {
    return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 });
  }
}
