import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === "" || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Valeur numérique invalide");
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id },
    include: {
      traitements: { include: { animal: { select: { nutrav: true, nobovi: true } } } },
      vaccinations: { include: { animal: { select: { nutrav: true, nobovi: true } } } },
    },
  });
  if (!ordonnance) return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  return NextResponse.json(ordonnance);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    statut, notes, date, numero, veterinaireNom, medicamentNom,
    dose, uniteDosage, voie, frequence, dureeJours, motif, animaux, photoUrl,
    delaiAttenteViandeJ, delaiAttenteLaitJ, precautions, rappels, medicaments,
  } = body;

  if (medicaments !== undefined && !Array.isArray(medicaments)) {
    return NextResponse.json({ error: "Liste de médicaments invalide" }, { status: 400 });
  }

  const prev = await prisma.ordonnance.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });

  const ordonnanceIdsAutorises = medicaments?.length
    ? (prev.photoUrls
      ? await prisma.ordonnance.findMany({ where: { photoUrls: prev.photoUrls }, select: { id: true } })
      : prev.photoUrl
        ? await prisma.ordonnance.findMany({ where: { photoUrl: prev.photoUrl }, select: { id: true } })
        : [{ id }]).map((item) => item.id)
    : [id];

  const prevFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries({ statut, notes, date, numero, veterinaireNom, medicamentNom, dose, uniteDosage, voie, frequence, dureeJours, motif, animaux, photoUrl, delaiAttenteViandeJ, delaiAttenteLaitJ, precautions, rappels })) {
    if (val !== undefined) prevFields[key] = (prev as unknown as Record<string, unknown>)[key];
  }

  try {
    const ordonnance = await prisma.$transaction(async (tx) => {
      const updated = await tx.ordonnance.update({
        where: { id },
        data: {
          ...(statut !== undefined && { statut }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
          ...(date !== undefined && { date: new Date(date) }),
          ...(numero !== undefined && { numero: numero?.trim() || null }),
          ...(veterinaireNom !== undefined && { veterinaireNom: veterinaireNom?.trim() || null }),
          ...(medicamentNom !== undefined && { medicamentNom: medicamentNom?.trim() ?? "" }),
          ...(dose !== undefined && { dose: dose != null ? Number(dose) : null }),
          ...(uniteDosage !== undefined && { uniteDosage: uniteDosage?.trim() || null }),
          ...(voie !== undefined && { voie: voie?.trim() || null }),
          ...(frequence !== undefined && { frequence: frequence?.trim() || null }),
          ...(dureeJours !== undefined && { dureeJours: dureeJours != null ? Number(dureeJours) : null }),
          ...(motif !== undefined && { motif: motif?.trim() || null }),
          ...(animaux !== undefined && { animaux: animaux?.trim() || null }),
          ...(photoUrl !== undefined && { photoUrl }),
          ...(delaiAttenteViandeJ !== undefined && { delaiAttenteViandeJ: delaiAttenteViandeJ != null ? Number(delaiAttenteViandeJ) : null }),
          ...(delaiAttenteLaitJ !== undefined && { delaiAttenteLaitJ: delaiAttenteLaitJ != null ? Number(delaiAttenteLaitJ) : null }),
          ...(precautions !== undefined && { precautions: precautions?.trim() || null }),
          ...(rappels !== undefined && { rappels: rappels?.trim() || null }),
        },
      });

      for (const medicament of medicaments ?? []) {
        if (!medicament || typeof medicament.id !== "string") throw new Error("Médicament invalide");
        if (medicament.storageType === "legacy") {
          if (typeof medicament.ordonnanceId !== "string") throw new Error("Ordonnance médicament invalide");
          if (!ordonnanceIdsAutorises.includes(medicament.ordonnanceId)) {
            throw new Error("Médicament historique hors ordonnance");
          }
          const legacyResult = await tx.ordonnance.updateMany({
            where: { id: medicament.ordonnanceId },
            data: {
              medicamentNom: nullableText(medicament.nomExtrait) ?? "",
              conditionnement: nullableText(medicament.conditionnement),
              voie: nullableText(medicament.voieExtraite),
              dose: nullableNumber(medicament.dose),
              uniteDosage: nullableText(medicament.uniteDosage),
              referenceValue: nullableNumber(medicament.referenceValue),
              referenceUnit: nullableText(medicament.referenceUnit),
              dureeJours: nullableNumber(medicament.dureeExtraite),
              administrationCount: nullableNumber(medicament.administrationCount),
              administrationIntervalHours: nullableNumber(medicament.administrationIntervalHours),
              repeatCondition: nullableText(medicament.repeatCondition),
              delaiAttenteViandeJ: nullableNumber(medicament.delaiAttenteViande),
              delaiAttenteAbatsJ: nullableNumber(medicament.delaiAttenteAbats),
              delaiAttenteLaitJ: nullableNumber(medicament.delaiAttenteLait),
            },
          });
          if (legacyResult.count !== 1) throw new Error("Médicament historique hors ordonnance");
          continue;
        }
        const result = await tx.ordonnanceMedicament.updateMany({
          where: { id: medicament.id, ordonnanceId: { in: ordonnanceIdsAutorises } },
          data: {
            nomExtrait: nullableText(medicament.nomExtrait) ?? "",
            conditionnement: nullableText(medicament.conditionnement),
            voieExtraite: nullableText(medicament.voieExtraite),
            posologieExtraite: nullableText(medicament.posologieExtraite),
            dose: nullableNumber(medicament.dose),
            uniteDosage: nullableText(medicament.uniteDosage),
            referenceValue: nullableNumber(medicament.referenceValue),
            referenceUnit: nullableText(medicament.referenceUnit),
            dureeExtraite: nullableNumber(medicament.dureeExtraite),
            administrationCount: nullableNumber(medicament.administrationCount),
            administrationIntervalHours: nullableNumber(medicament.administrationIntervalHours),
            repeatCondition: nullableText(medicament.repeatCondition),
            delaiAttenteViande: nullableNumber(medicament.delaiAttenteViande),
            delaiAttenteAbats: nullableNumber(medicament.delaiAttenteAbats),
            delaiAttenteLait: nullableNumber(medicament.delaiAttenteLait),
          },
        });
        if (result.count !== 1) throw new Error("Médicament hors ordonnance");
      }

      return updated;
    });

    const desc = "Ordonnance mise à jour";
    let undoId = "";
    try {
      undoId = await logAction("PATCH_ORDONNANCE", desc, { op: "update", model: "ordonnance", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...ordonnance, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id },
    include: { _count: { select: { traitements: true, vaccinations: true } } },
  });
  if (!ordonnance) return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });

  if (ordonnance._count.traitements > 0 || ordonnance._count.vaccinations > 0) {
    return NextResponse.json(
      { error: "Cette ordonnance est liée à des traitements ou vaccinations, elle ne peut pas être supprimée" },
      { status: 409 }
    );
  }

  try {
    await prisma.ordonnance.delete({ where: { id } });

    const desc = `Ordonnance ${ordonnance.medicamentNom || ''} supprimée`;
    let undoId = "";
    try {
      undoId = await logAction("DELETE_ORDONNANCE", desc, {
        op: "create",
        model: "ordonnance",
        data: {
          date: ordonnance.date, numero: ordonnance.numero, veterinaireNom: ordonnance.veterinaireNom,
          medicamentNom: ordonnance.medicamentNom, dose: ordonnance.dose, uniteDosage: ordonnance.uniteDosage,
          voie: ordonnance.voie, dureeJours: ordonnance.dureeJours, motif: ordonnance.motif,
          animaux: ordonnance.animaux, statut: ordonnance.statut, notes: ordonnance.notes,
          photoUrl: ordonnance.photoUrl, updatedAt: new Date(),
        },
      });
    } catch {}

    return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  }
}
