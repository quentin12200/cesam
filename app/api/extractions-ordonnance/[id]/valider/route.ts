import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { parseDocumentUrls } from "@/lib/ordonnance-types";

type MedicamentFinal = {
  medicamentNom: string;
  numeroLot: string | null;
  dose: number | null;
  uniteDosage: string | null;
  voie: string | null;
  frequence: string | null;
  dureeJours: number | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  precautions: string | null;
  rappels: string | null;
};

type ValeursFinales = {
  dateDebut: string;
  ordonnanceNumero: string | null;
  veterinaire: string | null;
  motif: string | null;
  animaux: string | null;
  medicaments: MedicamentFinal[];
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

function normaliserMedicament(brut: Record<string, unknown>): MedicamentFinal {
  return {
    medicamentNom: texte(brut.medicamentNom) ?? "",
    numeroLot: texte(brut.numeroLot),
    dose: nombre(brut.dose),
    uniteDosage: texte(brut.uniteDosage),
    voie: texte(brut.voie),
    frequence: texte(brut.frequence),
    dureeJours: entier(brut.dureeJours),
    delaiAttenteViandeJ: entier(brut.delaiAttenteViandeJ),
    delaiAttenteLaitJ: entier(brut.delaiAttenteLaitJ),
    precautions: texte(brut.precautions),
    rappels: texte(brut.rappels),
  };
}

function normaliser(body: Record<string, unknown>): ValeursFinales {
  const brutMedicaments = Array.isArray(body.medicaments) ? body.medicaments : [body];
  const medicaments = brutMedicaments
    .map((m) => normaliserMedicament((m ?? {}) as Record<string, unknown>))
    .filter((m) => m.medicamentNom);
  return {
    dateDebut: texte(body.dateDebut) ?? "",
    ordonnanceNumero: texte(body.ordonnanceNumero),
    veterinaire: texte(body.veterinaire),
    motif: texte(body.motif),
    animaux: texte(body.animaux),
    medicaments,
  };
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
  if (finale.medicaments.length === 0) {
    return NextResponse.json({ error: "Au moins un médicament est requis" }, { status: 400 });
  }

  const pages = parseDocumentUrls(extraction.documentUrls, extraction.documentUrl);
  const photoUrlsJson = JSON.stringify(pages);

  const ordonnanceIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const med of finale.medicaments) {
      const created = await tx.ordonnance.create({
        data: {
          date,
          numero: finale.ordonnanceNumero,
          veterinaireNom: finale.veterinaire,
          medicamentNom: med.medicamentNom,
          dose: med.dose,
          uniteDosage: med.uniteDosage,
          voie: med.voie,
          frequence: med.frequence,
          dureeJours: med.dureeJours,
          motif: finale.motif,
          animaux: finale.animaux,
          delaiAttenteViandeJ: med.delaiAttenteViandeJ,
          delaiAttenteLaitJ: med.delaiAttenteLaitJ,
          precautions: med.precautions,
          rappels: med.rappels,
          photoUrl: pages[0] ?? extraction.documentUrl,
          photoUrls: photoUrlsJson,
          statut: "VALIDE",
        },
      });
      ids.push(created.id);
    }

    await tx.extractionOrdonnance.update({
      where: { id, statut: "A_VERIFIER" },
      data: {
        statut: "VALIDEE",
        valeursCorrigees: JSON.stringify(finale),
        resultatFinal: JSON.stringify({ ...finale, ordonnanceIds: ids }),
        valideeLe: new Date(),
        ordonnanceId: ids[0],
      },
    });
    return ids;
  });

  return NextResponse.json({
    ordonnanceId: ordonnanceIds[0],
    ordonnanceIds,
    count: ordonnanceIds.length,
    statut: "VALIDEE",
  });
}
