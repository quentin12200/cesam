import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function valeursValides(doses: unknown, prixFlaconEur: unknown) {
  const dosesNombre = Number(doses);
  const prix = Number(prixFlaconEur);
  return Number.isInteger(dosesNombre) && dosesNombre > 0 && Number.isFinite(prix) && prix > 0;
}

export async function POST(request: NextRequest) {
  const { medicamentId, doses, prixFlaconEur } = await request.json();
  if (!medicamentId || !valeursValides(doses, prixFlaconEur)) {
    return NextResponse.json({ error: "Nombre de doses et prix du flacon invalides" }, { status: 400 });
  }
  const medicament = await prisma.medicament.findUnique({ where: { id: medicamentId }, select: { id: true } });
  if (!medicament) return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 });

  try {
    const conditionnement = await prisma.conditionnementMedicament.create({
      data: { medicamentId, doses: Number(doses), prixFlaconEur: Number(prixFlaconEur) },
    });
    return NextResponse.json(conditionnement, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nombre de doses existe déjà pour ce médicament" }, { status: 409 });
  }
}
