import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET() {
  const groupes = await prisma.groupe.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { animaux: true } } },
  });
  return NextResponse.json(groupes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, couleur } = body;
  if (!nom?.trim()) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  try {
    const groupe = await prisma.groupe.create({
      data: { nom: nom.trim(), couleur: couleur ?? null },
    });

    const desc = `Groupe '${groupe.nom}' créé`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_GROUPE", desc, { op: "delete", model: "groupe", id: groupe.id });
    } catch {}

    return NextResponse.json({ success: true, groupe, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Ce nom de groupe existe déjà" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const groupe = await prisma.groupe.findUnique({ where: { id } });
  if (!groupe) return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });

  await prisma.groupe.delete({ where: { id } });

  const desc = `Groupe '${groupe.nom}' supprimé`;
  let undoId = "";
  try {
    undoId = await logAction("DELETE_GROUPE", desc, {
      op: "create",
      model: "groupe",
      data: { id: groupe.id, nom: groupe.nom, couleur: groupe.couleur, updatedAt: new Date() },
    });
  } catch {}

  return NextResponse.json({ success: true, _undoId: undoId, _undoDesc: desc });
}
