import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

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
    delaiAttenteViandeJ, delaiAttenteLaitJ, precautions, rappels,
  } = body;

  const prev = await prisma.ordonnance.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries({ statut, notes, date, numero, veterinaireNom, medicamentNom, dose, uniteDosage, voie, frequence, dureeJours, motif, animaux, photoUrl, delaiAttenteViandeJ, delaiAttenteLaitJ, precautions, rappels })) {
    if (val !== undefined) prevFields[key] = (prev as unknown as Record<string, unknown>)[key];
  }

  try {
    const ordonnance = await prisma.ordonnance.update({
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
