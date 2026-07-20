import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function valeursValides(doses: unknown, prixFlaconEur: unknown) {
  const dosesNombre = Number(doses);
  const prix = Number(prixFlaconEur);
  return Number.isInteger(dosesNombre) && dosesNombre > 0 && Number.isFinite(prix) && prix > 0;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { doses, prixFlaconEur } = await request.json();
  if (!valeursValides(doses, prixFlaconEur)) {
    return NextResponse.json({ error: "Nombre de doses et prix du flacon invalides" }, { status: 400 });
  }
  const existe = await prisma.conditionnementMedicament.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Conditionnement non trouvé" }, { status: 404 });

  try {
    const conditionnement = await prisma.conditionnementMedicament.update({
      where: { id },
      data: { doses: Number(doses), prixFlaconEur: Number(prixFlaconEur) },
    });
    return NextResponse.json(conditionnement);
  } catch {
    return NextResponse.json({ error: "Ce nombre de doses existe déjà pour ce médicament" }, { status: 409 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existe = await prisma.conditionnementMedicament.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Conditionnement non trouvé" }, { status: 404 });
  await prisma.conditionnementMedicament.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
