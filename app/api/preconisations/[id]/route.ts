import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

const FIELDS = [
  "indicationMotif", "categorieAnimaux", "agePoidsConcerne",
  "dose", "unite", "doseBase", "voie", "frequence", "dureeValeur", "dureeUnite", "nombreAdministrations",
  "precautions", "delaiAttenteViandeJ", "delaiAttenteLaitTraites", "source", "statut", "commentaireVerification",
] as const;

const NUMERIC_FIELDS = new Set(["dose", "dureeValeur", "nombreAdministrations", "delaiAttenteViandeJ", "delaiAttenteLaitTraites"]);
const TEXT_FIELDS = new Set(["indicationMotif", "categorieAnimaux", "agePoidsConcerne", "unite", "voie", "frequence", "dureeUnite", "precautions", "source", "commentaireVerification"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const prev = await prisma.preconisation.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Préconisation non trouvée" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const val = body[field];
    if (val === undefined) continue;
    prevFields[field] = (prev as unknown as Record<string, unknown>)[field];
    if (NUMERIC_FIELDS.has(field)) {
      data[field] = val === "" || val === null ? null : Number(val);
    } else if (TEXT_FIELDS.has(field)) {
      data[field] = typeof val === "string" ? (val.trim() || null) : val;
    } else {
      data[field] = val;
    }
  }

  const preconisation = await prisma.preconisation.update({ where: { id }, data });

  const desc = "Préconisation mise à jour";
  let undoId = "";
  try {
    undoId = await logAction("PATCH_PRECONISATION", desc, { op: "update", model: "preconisation", where: { id }, data: prevFields });
  } catch {}

  return NextResponse.json({ ...preconisation, _undoId: undoId, _undoDesc: desc });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prev = await prisma.preconisation.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Préconisation non trouvée" }, { status: 404 });

  await prisma.preconisation.delete({ where: { id } });

  const desc = "Préconisation supprimée";
  let undoId = "";
  try {
    undoId = await logAction("DELETE_PRECONISATION", desc, {
      op: "create", model: "preconisation",
      data: {
        medicamentId: prev.medicamentId, indicationMotif: prev.indicationMotif, categorieAnimaux: prev.categorieAnimaux,
        agePoidsConcerne: prev.agePoidsConcerne, dose: prev.dose, unite: prev.unite, doseBase: prev.doseBase,
        voie: prev.voie, frequence: prev.frequence, dureeValeur: prev.dureeValeur, dureeUnite: prev.dureeUnite,
        nombreAdministrations: prev.nombreAdministrations, precautions: prev.precautions,
        delaiAttenteViandeJ: prev.delaiAttenteViandeJ, delaiAttenteLaitTraites: prev.delaiAttenteLaitTraites,
        source: prev.source, statut: prev.statut, commentaireVerification: prev.commentaireVerification,
        updatedAt: new Date(),
      },
    });
  } catch {}

  return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
}
