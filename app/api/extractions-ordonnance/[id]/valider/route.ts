import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { parseDocumentUrls } from "@/lib/ordonnance-types";
import {
  creerOrdonnanceAvecMedicaments,
  OrdonnanceValidationError,
  type OrdonnancePersistence,
} from "@/lib/ordonnance-validation";
import { securiserDateDelivrance } from "@/lib/ordonnance-dates";
import type { ChampExtrait } from "@/lib/ordonnance-types";

type MedicamentFinal = {
  medicationId: string | null;
  createMedication: boolean;
  categoryConfirmed: boolean;
  medicamentNom: string;
  numeroLot: string | null;
  substanceActive: string | null;
  concentration: string | null;
  categorie: string | null;
  familleTherapeutique: string | null;
  formePharmaceutique: string | null;
  conditionnement: string | null;
  voie: string | null;
  doseValue: number | null;
  doseUnit: string | null;
  referenceValue: number | null;
  referenceUnit: string | null;
  referenceType: string | null;
  normalizedDoseValue: number | null;
  normalizedDoseUnit: string | null;
  administrationCount: number | null;
  administrationIntervalHours: number | null;
  treatmentDurationDays: number | null;
  repeatCondition: string | null;
  administrationInstructions: string | null;
  withdrawalPeriods: { meatDays: number | null; offalDays: number | null; milkDays: number | null };
  precautions: string | null;
  evidence: Record<string, unknown>;
};

type ValeursFinales = {
  prescriptionDate: string;
  lastVisitDate: string | null;
  deliveryDate: string | null;
  ordonnanceNumero: string | null;
  veterinaire: string | null;
  motif: string | null;
  animaux: string | null;
  evidence: Record<string, unknown>;
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

function objet(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function dateOptionnelle(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normaliserMedicament(brut: Record<string, unknown>): MedicamentFinal {
  const delais = objet(brut.withdrawalPeriods);
  return {
    medicationId: texte(brut.medicationId),
    createMedication: brut.createMedication === true,
    categoryConfirmed: brut.categoryConfirmed === true,
    medicamentNom: texte(brut.medicamentNom) ?? "",
    numeroLot: texte(brut.numeroLot),
    substanceActive: texte(brut.substanceActive),
    concentration: texte(brut.concentration),
    categorie: texte(brut.categorie),
    familleTherapeutique: texte(brut.familleTherapeutique),
    formePharmaceutique: texte(brut.formePharmaceutique),
    conditionnement: texte(brut.conditionnement),
    voie: texte(brut.voie),
    doseValue: nombre(brut.doseValue),
    doseUnit: texte(brut.doseUnit),
    referenceValue: nombre(brut.referenceValue),
    referenceUnit: texte(brut.referenceUnit),
    referenceType: texte(brut.referenceType),
    normalizedDoseValue: nombre(brut.normalizedDoseValue),
    normalizedDoseUnit: texte(brut.normalizedDoseUnit),
    administrationCount: entier(brut.administrationCount),
    administrationIntervalHours: entier(brut.administrationIntervalHours),
    treatmentDurationDays: entier(brut.treatmentDurationDays),
    repeatCondition: texte(brut.repeatCondition),
    administrationInstructions: texte(brut.administrationInstructions),
    withdrawalPeriods: {
      meatDays: entier(delais.meatDays),
      offalDays: entier(delais.offalDays),
      milkDays: entier(delais.milkDays),
    },
    precautions: texte(brut.precautions),
    evidence: objet(brut.evidence),
  };
}

function normaliser(body: Record<string, unknown>): ValeursFinales {
  const medicaments = (Array.isArray(body.medicaments) ? body.medicaments : [body])
    .map((medicament) => normaliserMedicament(objet(medicament)))
    .filter((medicament) => medicament.medicamentNom);
  const evidence = objet(body.evidence);
  const deliveryEvidence = objet(evidence.deliveryDate) as unknown as ChampExtrait<unknown>;
  return {
    prescriptionDate: texte(body.prescriptionDate ?? body.dateDebut) ?? "",
    lastVisitDate: texte(body.lastVisitDate),
    deliveryDate: securiserDateDelivrance(
      texte(body.deliveryDate),
      deliveryEvidence,
    ),
    ordonnanceNumero: texte(body.ordonnanceNumero),
    veterinaire: texte(body.veterinaire),
    motif: texte(body.motif),
    animaux: texte(body.animaux),
    evidence,
    medicaments,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedEmail(request.headers.get("cookie")))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { id } = await params;
  const extraction = await prisma.extractionOrdonnance.findUnique({ where: { id } });
  if (!extraction) return NextResponse.json({ error: "Extraction introuvable" }, { status: 404 });
  if (extraction.statut !== "A_VERIFIER") {
    return NextResponse.json(
      { error: "Cette extraction a deja ete validee", ordonnanceId: extraction.ordonnanceId },
      { status: 409 },
    );
  }

  const finale = normaliser(objet(await request.json()));
  const prescriptionDate = dateOptionnelle(finale.prescriptionDate);
  if (!prescriptionDate) {
    return NextResponse.json({ error: "La date de l'ordonnance est requise" }, { status: 400 });
  }
  if (finale.medicaments.length === 0) {
    return NextResponse.json({ error: "Au moins un medicament est requis" }, { status: 400 });
  }

  const pages = parseDocumentUrls(extraction.documentUrls, extraction.documentUrl);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const created = await creerOrdonnanceAvecMedicaments(
        tx as unknown as OrdonnancePersistence,
        {
          ...finale,
          prescriptionDate,
          lastVisitDate: dateOptionnelle(finale.lastVisitDate),
          deliveryDate: dateOptionnelle(finale.deliveryDate),
        },
        pages,
      );
      await tx.extractionOrdonnance.update({
        where: { id, statut: "A_VERIFIER" },
        data: {
          statut: "VALIDEE",
          valeursCorrigees: JSON.stringify(finale),
          resultatFinal: JSON.stringify({ ...finale, ordonnanceId: created.ordonnanceId }),
          valideeLe: new Date(),
          ordonnanceId: created.ordonnanceId,
        },
      });
      return created;
    });

    return NextResponse.json({
      ordonnanceId: resultat.ordonnanceId,
      count: resultat.medicamentIds.length,
      statut: "VALIDEE",
    });
  } catch (error) {
    if (error instanceof OrdonnanceValidationError) {
      const status = error.code === "MEDICAMENT_INTROUVABLE" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
