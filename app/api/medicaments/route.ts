import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET() {
  const medicaments = await prisma.medicament.findMany({
    include: {
      preconisations: {
        where: { statut: { in: ["VALIDE", "A_VERIFIER", "IMPORTE"] } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { nom: "asc" },
  });
  return NextResponse.json(medicaments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, dci, categorie, voie, dosagePourKg, uniteDosage, delaiAttenteViandeJ, delaiAttenteLaitJ, prescriptionRequise, temporaire } = body;
  if (!nom?.trim()) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }
  try {
    const med = await prisma.medicament.create({
      data: {
        nom: nom.trim().toUpperCase(),
        dci: dci?.trim() || null,
        categorie: categorie ?? "AUTRE",
        voie: voie?.trim() || null,
        dosagePourKg: dosagePourKg ?? null,
        uniteDosage: uniteDosage?.trim() || "ml",
        delaiAttenteViandeJ: delaiAttenteViandeJ ?? null,
        delaiAttenteLaitJ: delaiAttenteLaitJ ?? null,
        prescriptionRequise: prescriptionRequise ?? false,
        temporaire: temporaire ?? false,
        actif: true,
      },
    });
    const desc = `Médicament '${med.nom}' ajouté`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_MEDICAMENT", desc, { op: "delete", model: "medicament", id: med.id });
    } catch {}

    return NextResponse.json({ ...med, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nom existe déjà" }, { status: 409 });
  }
}
