import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { action, nutrav, nom } = body;

    if (action === "attribuer") {
      if (!nutrav?.trim()) {
        return NextResponse.json({ error: "nutrav requis" }, { status: 400 });
      }

      const prevCapteur = await prisma.capteurVelage.findUnique({ where: { id } });
      const prevState = prevCapteur ? {
        actif: prevCapteur.actif,
        animalNutrav: prevCapteur.animalNutrav,
        animalNom: prevCapteur.animalNom,
        dateAttribution: prevCapteur.dateAttribution,
      } : {};

      const capteur = await prisma.capteurVelage.update({
        where: { id },
        data: {
          actif: true,
          animalNutrav: nutrav.trim(),
          animalNom: nom?.trim() || null,
          dateAttribution: new Date(),
        },
      });

      const desc = `Capteur attribué à ${nutrav.trim()}`;
      let undoId = "";
      try {
        undoId = await logAction("PATCH_CAPTEUR_ATTRIBUER", desc, { op: "update", model: "capteurVelage", where: { id }, data: prevState });
      } catch {}

      return NextResponse.json({ ...capteur, _undoId: undoId, _undoDesc: desc });
    }

    if (action === "liberer") {
      const prevCapteur = await prisma.capteurVelage.findUnique({ where: { id } });
      const prevState = prevCapteur ? {
        actif: prevCapteur.actif,
        animalNutrav: prevCapteur.animalNutrav,
        animalNom: prevCapteur.animalNom,
        dateAttribution: prevCapteur.dateAttribution,
      } : {};

      const capteur = await prisma.capteurVelage.update({
        where: { id },
        data: {
          actif: false,
          animalNutrav: null,
          animalNom: null,
          dateAttribution: null,
        },
      });

      const desc = `Capteur libéré`;
      let undoId = "";
      try {
        undoId = await logAction("PATCH_CAPTEUR_LIBERER", desc, { op: "update", model: "capteurVelage", where: { id }, data: prevState });
      } catch {}

      return NextResponse.json({ ...capteur, _undoId: undoId, _undoDesc: desc });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/capteurs/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
