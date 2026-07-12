import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { date, moment, categorie, type, temperature, description, photos, constatePar, resolu } = body;

  const prev = await prisma.evenementSanitaire.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (date !== undefined) prevFields.date = prev.date;
  if (moment !== undefined) prevFields.moment = prev.moment;
  if (categorie !== undefined) prevFields.categorie = prev.categorie;
  if (type !== undefined) prevFields.type = prev.type;
  if (temperature !== undefined) prevFields.temperature = prev.temperature;
  if (description !== undefined) prevFields.description = prev.description;
  if (photos !== undefined) prevFields.photos = prev.photos;
  if (constatePar !== undefined) prevFields.constatePar = prev.constatePar;
  if (resolu !== undefined) {
    prevFields.resolu = prev.resolu;
    prevFields.dateResolu = prev.dateResolu;
  }

  try {
    const updated = await prisma.evenementSanitaire.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(moment !== undefined && { moment }),
        ...(categorie !== undefined && { categorie }),
        ...(type !== undefined && { type: type.trim() }),
        ...(temperature !== undefined && { temperature: temperature != null && temperature !== "" ? Number(temperature) : null }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(photos !== undefined && { photos }),
        ...(constatePar !== undefined && { constatePar: constatePar?.trim() || null }),
        ...(resolu !== undefined && { resolu, dateResolu: resolu ? new Date() : null }),
      },
    });

    const desc = resolu !== undefined
      ? `Événement "${prev.type}" marqué ${resolu ? "résolu" : "non résolu"}`
      : `Événement "${prev.type}" modifié`;
    let undoId = "";
    try {
      undoId = await logAction("PATCH_EVENEMENT_SANITAIRE", desc, { op: "update", model: "evenementSanitaire", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...updated, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });
  }
}
