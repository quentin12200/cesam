import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const UNITES = new Set(["ml", "L", "g", "kg", "dose", "comprimé", "sachet", "autre"]);

interface LignePayload {
  id?: string;
  medicamentId?: string;
  quantiteFlacon?: unknown;
  uniteFlacon?: unknown;
  doses?: unknown;
  prixFlaconEur?: unknown;
}

function validerLigne(ligne: LignePayload, index: number) {
  const quantite = Number(ligne.quantiteFlacon);
  const prix = Number(ligne.prixFlaconEur);
  const doses = ligne.doses === "" || ligne.doses == null ? 0 : Number(ligne.doses);
  if (!ligne.medicamentId) return `Ligne ${index + 1} : médicament obligatoire`;
  if (!Number.isFinite(quantite) || quantite <= 0) return `Ligne ${index + 1} : quantité obligatoire et supérieure à 0`;
  if (!UNITES.has(String(ligne.uniteFlacon))) return `Ligne ${index + 1} : unité invalide`;
  if (!Number.isFinite(doses) || doses < 0) return `Ligne ${index + 1} : nombre de doses invalide`;
  if (!Number.isFinite(prix) || prix <= 0) return `Ligne ${index + 1} : prix HT obligatoire et supérieur à 0`;
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const lignes: LignePayload[] = Array.isArray(body.lignes) ? body.lignes : [];
  const suppressions: string[] = Array.isArray(body.suppressions)
    ? body.suppressions.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const erreurs = lignes.map(validerLigne).filter((erreur): erreur is string => erreur !== null);
  if (erreurs.length > 0) return NextResponse.json({ erreurs }, { status: 400 });

  const medicamentIds = [...new Set(lignes.map((ligne) => ligne.medicamentId as string))];
  const medicaments = await prisma.medicament.findMany({
    where: { id: { in: medicamentIds } },
    select: { id: true },
  });
  const idsExistants = new Set(medicaments.map((medicament) => medicament.id));
  const idInconnu = medicamentIds.find((id) => !idsExistants.has(id));
  if (idInconnu) return NextResponse.json({ erreurs: ["Un médicament sélectionné n'existe plus"] }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    if (suppressions.length > 0) {
      await tx.conditionnementMedicament.deleteMany({ where: { id: { in: suppressions } } });
    }
    for (const ligne of lignes) {
      const data = {
        medicamentId: ligne.medicamentId as string,
        quantiteFlacon: Number(ligne.quantiteFlacon),
        uniteFlacon: String(ligne.uniteFlacon),
        doses: ligne.doses === "" || ligne.doses == null ? 0 : Number(ligne.doses),
        prixFlaconEur: Number(ligne.prixFlaconEur),
        actif: true,
      };
      if (ligne.id) {
        await tx.conditionnementMedicament.update({ where: { id: ligne.id }, data });
      } else {
        await tx.conditionnementMedicament.create({ data });
      }
    }
  });

  const conditionnements = await prisma.conditionnementMedicament.findMany({
    where: { actif: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ok: true, conditionnements });
}
