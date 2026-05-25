import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const animal = await prisma.animal.findUnique({ where: { nutrav } });
  if (!animal) return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if ("nobovi"       in body) data.nobovi       = body.nobovi?.trim() || null;
  if ("statut"       in body) data.statut       = body.statut;
  if ("estGenisse"   in body) data.estGenisse   = body.estGenisse;
  if ("notes"        in body) data.notes        = body.notes?.trim() || null;
  if ("danais"       in body) data.danais       = new Date(body.danais);
  if ("boucleFaite"  in body) data.boucleFaite  = body.boucleFaite;
  if ("sevreFait"    in body) data.sevreFait    = body.sevreFait;
  if ("tarieFaite"   in body) data.tarieFaite   = body.tarieFaite;
  if ("categorie"    in body) data.categorie    = body.categorie ?? null;
  if ("groupeId"     in body) data.groupeId     = body.groupeId ?? null;
  if ("aEchographier" in body) data.aEchographier = Boolean(body.aEchographier);

  const updated = await prisma.animal.update({ where: { nutrav }, data });
  return NextResponse.json({ success: true, animal: updated });
}

