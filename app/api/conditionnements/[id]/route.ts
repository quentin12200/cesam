import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normaliserRegleConservationSaisie } from "@/lib/vaccine-planner";

const UNITES = new Set(["ml", "L", "g", "kg", "dose", "comprimé", "sachet", "autre"]);

function valeursValides(quantiteFlacon: unknown, uniteFlacon: unknown, doses: unknown, prixFlaconEur: unknown) {
  const quantite = Number(quantiteFlacon);
  const dosesNombre = doses === "" || doses == null ? 0 : Number(doses);
  const prix = Number(prixFlaconEur);
  return Number.isFinite(quantite) && quantite > 0 && UNITES.has(String(uniteFlacon))
    && Number.isFinite(dosesNombre) && dosesNombre >= 0 && Number.isFinite(prix) && prix > 0;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { quantiteFlacon, uniteFlacon, doses, prixFlaconEur } = body;
  const modifierFormat = ["quantiteFlacon", "uniteFlacon", "doses", "prixFlaconEur"].some((champ) => Object.hasOwn(body, champ));
  const modifierConservation = Object.hasOwn(body, "conservationOuvertureStatut");
  if ((!modifierFormat && !modifierConservation) || (modifierFormat && !valeursValides(quantiteFlacon, uniteFlacon, doses, prixFlaconEur))) {
    return NextResponse.json({ error: "Quantité, unité ou prix du flacon invalides" }, { status: 400 });
  }
  const existe = await prisma.conditionnementMedicament.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Conditionnement non trouvé" }, { status: 404 });

  let conservation = {};
  if (modifierConservation) {
    try {
      conservation = normaliserRegleConservationSaisie(body, true);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Conservation invalide" }, { status: 400 });
    }
  }
  const conditionnement = await prisma.conditionnementMedicament.update({
    where: { id },
    data: {
      ...(modifierFormat && {
        quantiteFlacon: Number(quantiteFlacon),
        uniteFlacon: String(uniteFlacon),
        doses: doses === "" || doses == null ? 0 : Number(doses),
        prixFlaconEur: Number(prixFlaconEur),
      }),
      ...conservation,
    },
  });
  return NextResponse.json(conditionnement);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existe = await prisma.conditionnementMedicament.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Conditionnement non trouvé" }, { status: 404 });
  await prisma.conditionnementMedicament.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
