import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { prisma } from "@/lib/prisma";
import {
  creerMedicamentPharmacieDepuisOrdonnance,
  CreationPharmacieError,
  type CreationPharmacieInput,
  type CreationPharmaciePersistence,
} from "@/lib/ordonnance-pharmacy-creation";

function nullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function inputFromBody(body: Record<string, unknown>): CreationPharmacieInput {
  return {
    confirmed: body.confirmed === true,
    categoryConfirmed: body.categoryConfirmed === true,
    medicamentNom: nullableText(body.medicamentNom) ?? "",
    conditionnement: nullableText(body.conditionnement),
    formePharmaceutique: nullableText(body.formePharmaceutique),
    voie: nullableText(body.voie),
    substanceActive: nullableText(body.substanceActive),
    concentration: nullableText(body.concentration),
    categorie: nullableText(body.categorie),
    doseValue: nullableNumber(body.doseValue),
    doseUnit: nullableText(body.doseUnit),
    referenceValue: nullableNumber(body.referenceValue),
    referenceUnit: nullableText(body.referenceUnit),
    referenceType: nullableText(body.referenceType),
    administrationCount: nullableNumber(body.administrationCount),
    treatmentDurationDays: nullableNumber(body.treatmentDurationDays),
    administrationIntervalHours: nullableNumber(body.administrationIntervalHours),
    repeatCondition: nullableText(body.repeatCondition),
    meatDays: nullableNumber(body.meatDays),
    offalDays: nullableNumber(body.offalDays),
    milkDays: nullableNumber(body.milkDays),
    precautions: nullableText(body.precautions),
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
  const extraction = await prisma.extractionOrdonnance.findUnique({
    where: { id },
    select: { statut: true },
  });
  if (!extraction) return NextResponse.json({ error: "Extraction introuvable" }, { status: 404 });
  if (extraction.statut !== "A_VERIFIER") {
    return NextResponse.json({ error: "Cette ordonnance a déjà été validée." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const result = await prisma.$transaction((tx) =>
      creerMedicamentPharmacieDepuisOrdonnance(
        tx as unknown as CreationPharmaciePersistence,
        inputFromBody(body),
      )
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CreationPharmacieError) {
      return NextResponse.json(
        { error: error.message, code: error.code, candidats: error.candidats },
        { status: error.code === "DOUBLON_POSSIBLE" ? 409 : 400 },
      );
    }
    throw error;
  }
}
