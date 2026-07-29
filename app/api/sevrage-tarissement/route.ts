import { NextRequest, NextResponse } from "next/server";
import { endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  findCalfWithMother,
  motherFromCalf,
} from "@/lib/weaning-dry-off-data";
import type { RevertStep } from "@/lib/action-log";
import type { WeaningDryOffAction } from "@/lib/weaning-dry-off";

const ACTIONS: WeaningDryOffAction[] = [
  "COMBINED",
  "WEAN_ONLY",
  "DRY_OFF_ONLY",
];

function parseActionDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date > endOfDay(new Date())) return null;
  return date;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const calfId = typeof body?.calfId === "string" ? body.calfId : "";
  const action = body?.action as WeaningDryOffAction | undefined;
  const actionDate = parseActionDate(body?.date);

  if (!calfId || !action || !ACTIONS.includes(action) || !actionDate) {
    return NextResponse.json(
      { error: "Action ou date invalide." },
      { status: 400 }
    );
  }

  const calf = await findCalfWithMother(calfId);
  if (!calf) {
    return NextResponse.json({ error: "Veau introuvable." }, { status: 404 });
  }

  const mother = motherFromCalf(calf);
  const activeMother = mother?.statut === "ACTIF" ? mother : null;
  const mustWean = action === "COMBINED" || action === "WEAN_ONLY";
  const mustDryOff = action === "COMBINED" || action === "DRY_OFF_ONLY";

  if (mustDryOff && !activeMother) {
    return NextResponse.json(
      { error: "La mère active de ce veau n’a pas pu être retrouvée." },
      { status: 409 }
    );
  }

  const revertSteps: RevertStep[] = [];
  let undoId = "";

  try {
    await prisma.$transaction(async (tx) => {
      if (mustWean && !calf.sevreFait) {
        revertSteps.push({
          op: "update",
          model: "animal",
          where: { id: calf.id },
          data: {
            sevreFait: calf.sevreFait,
            dateSevrage: calf.dateSevrage?.toISOString() ?? null,
          },
        });
        await tx.animal.update({
          where: { id: calf.id },
          data: { sevreFait: true, dateSevrage: actionDate },
        });
      }

      if (mustDryOff && activeMother && !activeMother.tarieFaite) {
        revertSteps.push({
          op: "update",
          model: "animal",
          where: { id: activeMother.id },
          data: {
            tarieFaite: activeMother.tarieFaite,
            dateTarie: activeMother.dateTarie?.toISOString() ?? null,
          },
        });
        await tx.animal.update({
          where: { id: activeMother.id },
          data: { tarieFaite: true, dateTarie: actionDate },
        });
      }

      if (revertSteps.length > 0) {
        const description =
          action === "COMBINED"
            ? `Sevrage de ${calf.nutrav} et tarissement de ${activeMother?.nutrav}`
            : action === "WEAN_ONLY"
              ? `Sevrage de ${calf.nutrav}`
              : `Tarissement de ${activeMother?.nutrav}`;
        const log = await tx.actionLog.create({
          data: {
            type:
              action === "COMBINED"
                ? "SEVRAGE_TARISSEMENT"
                : action === "WEAN_ONLY"
                  ? "SEVRAGE"
                  : "TARISSEMENT",
            description,
            revertData: JSON.stringify(revertSteps),
          },
        });
        undoId = log.id;
      }
    });
  } catch (error) {
    console.error("POST /api/sevrage-tarissement error:", error);
    return NextResponse.json(
      { error: "L’enregistrement du sevrage ou du tarissement a échoué." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    calf: {
      id: calf.id,
      sevreFait: mustWean ? true : calf.sevreFait,
      dateSevrage: mustWean
        ? actionDate.toISOString()
        : calf.dateSevrage?.toISOString() ?? null,
    },
    mother: activeMother
      ? {
          id: activeMother.id,
          tarieFaite: mustDryOff ? true : activeMother.tarieFaite,
          dateTarie: mustDryOff
            ? actionDate.toISOString()
            : activeMother.dateTarie?.toISOString() ?? null,
        }
      : null,
    _undoId: undoId,
  });
}
