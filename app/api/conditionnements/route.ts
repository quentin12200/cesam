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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { medicamentId, quantiteFlacon, uniteFlacon, doses, prixFlaconEur } = body;
  if (!medicamentId || !valeursValides(quantiteFlacon, uniteFlacon, doses, prixFlaconEur)) {
    return NextResponse.json({ error: "Quantité, unité ou prix du flacon invalides" }, { status: 400 });
  }
  const medicament = await prisma.medicament.findUnique({ where: { id: medicamentId }, select: { id: true } });
  if (!medicament) return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 });

  let conservation;
  try {
    conservation = normaliserRegleConservationSaisie(body, true);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conservation invalide" }, { status: 400 });
  }
  const conditionnement = await prisma.conditionnementMedicament.create({
    data: {
      medicamentId,
      quantiteFlacon: Number(quantiteFlacon),
      uniteFlacon: String(uniteFlacon),
      doses: doses === "" || doses == null ? 0 : Number(doses),
      prixFlaconEur: Number(prixFlaconEur),
      ...conservation,
    },
  });
  return NextResponse.json(conditionnement, { status: 201 });
}
