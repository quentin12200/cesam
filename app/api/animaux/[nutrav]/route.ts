import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nutrav: string }> }
) {
  const { nutrav } = await params;

  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    include: {
      mere: { select: { id: true, nutrav: true, nobovi: true } },
      taureau: true,
      veaux: {
        select: { id: true, nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true },
        orderBy: { danais: "desc" },
      },
      vaccinations: { orderBy: { date: "desc" } },
      evenements: { orderBy: { date: "desc" } },
      pesees: { orderBy: { date: "desc" } },
      velagesVache: {
        orderBy: { date: "desc" },
        include: {
          veau: { select: { nutrav: true, nobovi: true, sexbov: true } },
        },
      },
      velageVeau: {
        include: {
          vache: { select: { nutrav: true, nobovi: true } },
        },
      },
      saillies: {
        orderBy: { date: "desc" },
        include: { gestation: true, taureau: true },
      },
    },
  });

  if (!animal) {
    return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
  }

  return NextResponse.json(animal);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nutrav: string }> }
) {
  const { nutrav } = await params;
  const body = await request.json();

  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    include: {
      velageVeau: { select: { vache: { select: { nutrav: true } } } },
      mere: { select: { nutrav: true } },
    },
  });
  if (!animal) return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });

  // La mère "officielle" est celle du vêlage enregistré ; à défaut (données
  // historiques/importées sans vêlage), on retombe sur le lien de généalogie direct.
  const mereNutrav = animal.velageVeau?.vache?.nutrav ?? animal.mere?.nutrav;

  // Capture previous values for undo
  const prevFields: Record<string, unknown> = {};
  if ("nobovi"        in body) prevFields.nobovi        = animal.nobovi;
  if ("statut"        in body) prevFields.statut        = animal.statut;
  if ("estGenisse"    in body) prevFields.estGenisse    = animal.estGenisse;
  if ("notes"         in body) prevFields.notes         = animal.notes;
  if ("danais"        in body) prevFields.danais        = animal.danais;
  if ("boucleFaite"   in body) { prevFields.boucleFaite = animal.boucleFaite; prevFields.dateBouclage = animal.dateBouclage; }
  if ("sevreFait"     in body) { prevFields.sevreFait = animal.sevreFait; prevFields.dateSevrage = animal.dateSevrage; }
  if ("tarieFaite"    in body) { prevFields.tarieFaite = animal.tarieFaite; prevFields.dateTarie = animal.dateTarie; }
  if ("categorie"     in body) prevFields.categorie     = animal.categorie;
  if ("groupeId"      in body) prevFields.groupeId      = animal.groupeId;
  if ("aEchographier" in body) prevFields.aEchographier = animal.aEchographier;
  if ("numeroNational" in body) prevFields.numeroNational = animal.numeroNational;

  // Read mère's tarie BEFORE cascade update
  let merePrevTarieFaite: boolean | undefined;
  let merePrevDateTarie: Date | null | undefined;
  if (body.sevreFait === true) {
    if (mereNutrav) {
      const mere = await prisma.animal.findUnique({ where: { nutrav: mereNutrav }, select: { tarieFaite: true, dateTarie: true } });
      merePrevTarieFaite = mere?.tarieFaite;
      merePrevDateTarie = mere?.dateTarie;
    }
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if ("nobovi"       in body) data.nobovi       = body.nobovi?.trim() || null;
  if ("statut"       in body) data.statut       = body.statut;
  if ("estGenisse"   in body) data.estGenisse   = body.estGenisse;
  if ("notes"        in body) data.notes        = body.notes?.trim() || null;
  if ("danais"       in body) data.danais       = new Date(body.danais);
  if ("boucleFaite"  in body) {
    data.boucleFaite = body.boucleFaite;
    data.dateBouclage = body.boucleFaite ? new Date() : null;
  }
  if ("sevreFait"    in body) {
    data.sevreFait = body.sevreFait;
    data.dateSevrage = body.sevreFait ? (body.dateSevrage ? new Date(body.dateSevrage) : new Date()) : null;
  }
  if ("tarieFaite"   in body) {
    data.tarieFaite = body.tarieFaite;
    data.dateTarie = body.tarieFaite ? new Date() : null;
  }
  if ("categorie"    in body) data.categorie    = body.categorie ?? null;
  if ("groupeId"     in body) data.groupeId     = body.groupeId ?? null;
  if ("aEchographier" in body) data.aEchographier = Boolean(body.aEchographier);
  if ("numeroNational" in body) data.numeroNational = body.numeroNational?.trim().toUpperCase() || null;

  const updated = await prisma.animal.update({ where: { nutrav }, data });

  // Cascade sevrage → mère devient tarie automatiquement (même date que le sevrage du veau)
  if (body.sevreFait === true) {
    if (mereNutrav) {
      await prisma.animal.update({
        where: { nutrav: mereNutrav },
        data: { tarieFaite: true, dateTarie: data.dateSevrage as Date },
      });
    }
  }

  const desc = `Animal ${nutrav}${animal.nobovi ? ` (${animal.nobovi})` : ''} modifié`;
  let undoId = "";
  try {
    const revertSteps: Array<{ op: string; model: string; where?: Record<string, unknown>; data?: Record<string, unknown> }> = [
      { op: "update", model: "animal", where: { nutrav }, data: prevFields },
    ];
    if (body.sevreFait === true) {
      if (mereNutrav && merePrevTarieFaite !== undefined) {
        revertSteps.push({ op: "update", model: "animal", where: { nutrav: mereNutrav }, data: { tarieFaite: merePrevTarieFaite, dateTarie: merePrevDateTarie ?? null } });
      }
    }
    undoId = await logAction("PATCH_ANIMAL", desc, revertSteps as Parameters<typeof logAction>[2]);
  } catch {}

  return NextResponse.json({ success: true, animal: updated, _undoId: undoId, _undoDesc: desc });
}

