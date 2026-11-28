import { valeurCategoriePersonnalisee } from "@/lib/medicament-categories";
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
  if (typeof nom !== "string" || !nom.trim() || nom.trim().length > 160) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }
  const nomNormalise = nom.trim().replace(/\s+/g," ").toUpperCase();
  if (temporaire === true) {
    const existants = await prisma.medicament.findMany({select:{id:true,nom:true}});
    const cle = (s:string)=>s.normalize("NFC").trim().replace(/\s+/g," ").toLocaleUpperCase("fr");
    const existant = existants.find(m=>cle(m.nom)===cle(nomNormalise));
    if(existant){const med=await prisma.medicament.findUnique({where:{id:existant.id},include:{preconisations:true}});return NextResponse.json(med);}
  }
  try {
    const med = await prisma.medicament.create({
      data: {
        nom: nomNormalise,
        dci: dci?.trim() || null,
        categorie: categorie ? valeurCategoriePersonnalisee(categorie) : "AUTRE",
        voie: voie?.trim() || null,
        dosagePourKg: dosagePourKg ?? null,
        uniteDosage: temporaire === true ? null : uniteDosage?.trim() || "ml",
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

    return NextResponse.json({ ...med, preconisations: [], _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nom existe déjà" }, { status: 409 });
  }
}
