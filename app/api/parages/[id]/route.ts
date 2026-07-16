import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { normaliserPattes } from "@/lib/parage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data: { statut?: string; dateFait?: Date | null; motif?: string; pattes?: string; notes?: string | null } = {};

  if (body.statut !== undefined) {
    const statut = body.statut === "A_VOIR" ? "A_VOIR" : body.statut === "FAIT" ? "FAIT" : null;
    if (!statut) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    data.statut = statut;
    data.dateFait = statut === "FAIT" ? new Date() : null;
  }
  if (body.motif !== undefined) {
    if (body.motif !== "PARAGE" && body.motif !== "BOITERIE") {
      return NextResponse.json({ error: "Motif invalide" }, { status: 400 });
    }
    data.motif = body.motif;
  }
  if (body.pattes !== undefined) {
    const pattes = normaliserPattes(body.pattes);
    if (pattes.length === 0) return NextResponse.json({ error: "Sélectionne au moins une patte" }, { status: 400 });
    data.pattes = JSON.stringify(pattes);
  }
  if (body.note !== undefined) {
    data.notes = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const existing = await prisma.parage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Ligne de parage introuvable" }, { status: 404 });

  const parage = await prisma.parage.update({
    where: { id },
    data,
  });
  const undoId = await logAction("PATCH_PARAGE", `Parage ${id} modifié`, {
    op: "update",
    model: "parage",
    where: { id },
    data: {
      statut: existing.statut,
      dateFait: existing.dateFait,
      motif: existing.motif,
      pattes: existing.pattes,
      notes: existing.notes,
    },
  });
  return NextResponse.json({ id: parage.id, statut: parage.statut, undoId });
}
