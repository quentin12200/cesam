import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedEmail } from "@/lib/cesam-auth";

type ValeursFinales = {
  dateDebut: string;
  ordonnanceNumero: string | null;
  veterinaire: string | null;
  medicamentNom: string;
  dose: number | null;
  uniteDosage: string | null;
  voie: string | null;
  frequence: string | null;
  dureeJours: number | null;
  motif: string | null;
  animaux: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  precautions: string | null;
  rappels: string | null;
};

function texte(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nombre(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function entier(value: unknown): number | null {
  const parsed = nombre(value);
  return parsed === null ? null : Math.max(0, Math.round(parsed));
}

function normaliser(body: Record<string, unknown>): ValeursFinales {
  return {
    dateDebut: texte(body.dateDebut) ?? "",
    ordonnanceNumero: texte(body.ordonnanceNumero),
    veterinaire: texte(body.veterinaire),
    medicamentNom: texte(body.medicamentNom) ?? "",
    dose: nombre(body.dose),
    uniteDosage: texte(body.uniteDosage),
    voie: texte(body.voie),
    frequence: texte(body.frequence),
    dureeJours: entier(body.dureeJours),
    motif: texte(body.motif),
    animaux: texte(body.animaux),
    delaiAttenteViandeJ: entier(body.delaiAttenteViandeJ),
    delaiAttenteLaitJ: entier(body.delaiAttenteLaitJ),
    precautions: texte(body.precautions),
    rappels: texte(body.rappels),
  };
}

function calculerCorrections(initiale: Record<string, unknown>, finale: ValeursFinales) {
  const corrections: Record<string, { initiale: unknown; finale: unknown }> = {};
  for (const [champ, valeurFinale] of Object.entries(finale)) {
    const valeurInitiale = initiale[champ] ?? null;
    if (JSON.stringify(valeurInitiale) !== JSON.stringify(valeurFinale)) {
      corrections[champ] = { initiale: valeurInitiale, finale: valeurFinale };
    }
  }
  return corrections;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAuthorizedEmail(request.headers.get("cookie")))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { id } = await params;
  const extraction = await prisma.extractionOrdonnance.findUnique({ where: { id } });
  if (!extraction) return NextResponse.json({ error: "Extraction introuvable" }, { status: 404 });
  if (extraction.statut !== "A_VERIFIER") {
    return NextResponse.json(
      { error: "Cette extraction a déjà été validée", ordonnanceId: extraction.ordonnanceId },
      { status: 409 }
    );
  }

  const finale = normaliser(await request.json());
  const date = new Date(finale.dateDebut);
  if (!finale.dateDebut || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "La date de l’ordonnance est requise" }, { status: 400 });
  }
  if (!finale.medicamentNom) {
    return NextResponse.json({ error: "Le médicament principal est requis" }, { status: 400 });
  }

  let propositionInitiale: Record<string, unknown> = {};
  try {
    propositionInitiale = JSON.parse(extraction.propositionInitiale);
  } catch {}
  const corrections = calculerCorrections(propositionInitiale, finale);

  const ordonnance = await prisma.$transaction(async (tx) => {
    const created = await tx.ordonnance.create({
      data: {
        date,
        numero: finale.ordonnanceNumero,
        veterinaireNom: finale.veterinaire,
        medicamentNom: finale.medicamentNom,
        dose: finale.dose,
        uniteDosage: finale.uniteDosage,
        voie: finale.voie,
        frequence: finale.frequence,
        dureeJours: finale.dureeJours,
        motif: finale.motif,
        animaux: finale.animaux,
        delaiAttenteViandeJ: finale.delaiAttenteViandeJ,
        delaiAttenteLaitJ: finale.delaiAttenteLaitJ,
        precautions: finale.precautions,
        rappels: finale.rappels,
        photoUrl: extraction.documentUrl,
        statut: "VALIDE",
      },
    });
    await tx.extractionOrdonnance.update({
      where: { id, statut: "A_VERIFIER" },
      data: {
        statut: "VALIDEE",
        valeursCorrigees: JSON.stringify(finale),
        corrections: JSON.stringify(corrections),
        resultatFinal: JSON.stringify(finale),
        valideeLe: new Date(),
        ordonnanceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ ordonnanceId: ordonnance.id, statut: "VALIDEE" });
}
