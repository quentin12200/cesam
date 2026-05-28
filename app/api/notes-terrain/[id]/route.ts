import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const prev = await prisma.noteTerrain.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Note non trouvée" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (typeof body.traitee === "boolean") prevFields.traitee = prev.traitee;
  if (body.texte) prevFields.texte = prev.texte;

  const note = await prisma.noteTerrain.update({
    where: { id },
    data: {
      ...(typeof body.traitee === "boolean" ? { traitee: body.traitee } : {}),
      ...(body.texte ? { texte: body.texte.trim() } : {}),
    },
  });

  const desc = "Note terrain mise à jour";
  let undoId = "";
  try {
    undoId = await logAction("PATCH_NOTE", desc, { op: "update", model: "noteTerrain", where: { id }, data: prevFields });
  } catch {}

  return NextResponse.json({ ...note, _undoId: undoId, _undoDesc: desc });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const note = await prisma.noteTerrain.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Note non trouvée" }, { status: 404 });

  await prisma.noteTerrain.delete({ where: { id } });

  const desc = "Note terrain supprimée";
  let undoId = "";
  try {
    undoId = await logAction("DELETE_NOTE", desc, {
      op: "create",
      model: "noteTerrain",
      data: { id: note.id, texte: note.texte, traitee: note.traitee, createdAt: note.createdAt },
    });
  } catch {}

  return NextResponse.json({ success: true, _undoId: undoId, _undoDesc: desc });
}
