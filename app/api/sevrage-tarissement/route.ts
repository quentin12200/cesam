import { endOfDay } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCalfWithCurrentCycle } from "@/lib/weaning-dry-off-data";
import type { RevertStep } from "@/lib/action-log";
import type { WeaningDryOffAction } from "@/lib/weaning-dry-off";

const ACTIONS: WeaningDryOffAction[] = [
  "COMBINED",
  "WEAN_ONLY",
  "DRY_OFF_ONLY",
  "UNDO_WEANING",
];

function parseActionDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime()) || date > endOfDay(new Date())) return null;
  return date;
}

type StoredUpdateStep = {
  op: "update";
  model: string;
  where?: { id?: string; nutrav?: string };
  data?: Record<string, unknown>;
};

function readUpdateSteps(value: string): StoredUpdateStep[] {
  try {
    const raw = JSON.parse(value);
    return (Array.isArray(raw) ? raw : [raw]).filter(
      (step): step is StoredUpdateStep =>
        step?.op === "update" && step?.model === "animal"
    );
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const calfId = typeof body?.calfId === "string" ? body.calfId : "";
  const action = body?.action as WeaningDryOffAction | undefined;
  const actionDate = parseActionDate(body?.date);

  if (
    !calfId ||
    !action ||
    !ACTIONS.includes(action) ||
    (action !== "UNDO_WEANING" && !actionDate)
  ) {
    return NextResponse.json(
      { error: "Action ou date invalide." },
      { status: 400 }
    );
  }

  const context = await findCalfWithCurrentCycle(calfId);
  if (!context) {
    return NextResponse.json(
      { error: "Le cycle mère–veau actuel n’a pas pu être établi." },
      { status: 409 }
    );
  }

  const { calf, currentCycle } = context;
  const mother = currentCycle.mother;

  if (action === "UNDO_WEANING") {
    const reversibleSince = new Date(Date.now() - 12 * 60 * 60 * 1000);
    if (
      !calf.sevreFait ||
      !calf.dateSevrage ||
      calf.dateSevrage < reversibleSince
    ) {
      return NextResponse.json(
        { error: "Ce sevrage n’est plus annulable depuis cette liste." },
        { status: 409 }
      );
    }

    const logs = await prisma.actionLog.findMany({
      where: {
        type: {
          in: [
            "SEVRAGE",
            "SEVRAGE_TARISSEMENT_AUTO",
            "SEVRAGE_TARISSEMENT",
            "TARISSEMENT_MANUEL",
            "TARISSEMENT",
            "PATCH_ANIMAL",
          ],
        },
        reverted: false,
        createdAt: { gte: reversibleSince },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        revertData: true,
        createdAt: true,
      },
    });
    const weaningLog = logs.find((log) =>
      readUpdateSteps(log.revertData).some(
        (step) =>
          (step.where?.id === calf.id ||
            step.where?.nutrav === calf.nutrav) &&
          step.data?.sevreFait === false
      )
    );
    if (!weaningLog) {
      return NextResponse.json(
        { error: "L’action de sevrage à annuler n’a pas été retrouvée." },
        { status: 409 }
      );
    }

    const latestDryOffLog = logs.find((log) =>
      readUpdateSteps(log.revertData).some(
        (step) =>
          (step.where?.id === mother.id ||
            step.where?.nutrav === mother.nutrav) &&
          step.data?.tarieFaite === false
      )
    );
    const latestDryOffWasAutomatic = Boolean(
      latestDryOffLog &&
        ([
          "SEVRAGE_TARISSEMENT_AUTO",
          "SEVRAGE_TARISSEMENT",
        ].includes(latestDryOffLog.type) ||
          (latestDryOffLog.type === "PATCH_ANIMAL" &&
            readUpdateSteps(latestDryOffLog.revertData).some(
              (step) => step.data?.sevreFait === false
            )))
    );
    const automaticMotherStep =
      latestDryOffLog && latestDryOffWasAutomatic
        ? readUpdateSteps(latestDryOffLog.revertData).find(
            (step) =>
              (step.where?.id === mother.id ||
                step.where?.nutrav === mother.nutrav) &&
              step.data?.tarieFaite === false
          )
        : null;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.animal.update({
          where: { id: calf.id },
          data: { sevreFait: false, dateSevrage: null },
        });
        if (automaticMotherStep?.data && mother.tarieFaite) {
          await tx.animal.update({
            where: { id: mother.id },
            data: {
              tarieFaite: Boolean(automaticMotherStep.data.tarieFaite),
              dateTarie:
                typeof automaticMotherStep.data.dateTarie === "string"
                  ? new Date(automaticMotherStep.data.dateTarie)
                  : null,
            },
          });
        }
        await tx.actionLog.update({
          where: { id: weaningLog.id },
          data: { reverted: true, revertedAt: new Date() },
        });
      });
    } catch (error) {
      console.error("UNDO /api/sevrage-tarissement error:", error);
      return NextResponse.json(
        { error: "L’annulation du sevrage a échoué." },
        { status: 500 }
      );
    }

    const motherStillDriedOff = automaticMotherStep
      ? false
      : mother.tarieFaite;
    return NextResponse.json({
      ok: true,
      undone: true,
      cycleProgress: {
        total: currentCycle.linkedCalves.length,
        weaned: Math.max(
          0,
          currentCycle.linkedCalves.filter(
            (linkedCalf) => linkedCalf.sevreFait
          ).length - 1
        ),
        pending: currentCycle.pendingCalves.length + 1,
      },
      calf: { id: calf.id, sevreFait: false, dateSevrage: null },
      mother: {
        id: mother.id,
        tarieFaite: motherStillDriedOff,
        dateTarie: motherStillDriedOff
          ? mother.dateTarie?.toISOString() ?? null
          : null,
      },
    });
  }

  const mustWean = action !== "DRY_OFF_ONLY";
  const manualDryOff = action === "DRY_OFF_ONLY";

  if (mustWean && calf.sevreFait) {
    return NextResponse.json(
      { error: "Ce veau est déjà enregistré comme sevré." },
      { status: 409 }
    );
  }

  let automaticDryOff = false;
  const effectiveActionDate = actionDate as Date;
  const revertSteps: RevertStep[] = [];
  let undoId = "";

  try {
    await prisma.$transaction(async (tx) => {
      if (mustWean) {
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
          data: { sevreFait: true, dateSevrage: effectiveActionDate },
        });
        const remainingCalves = await tx.animal.count({
          where: {
            id: { in: currentCycle.linkedCalves.map((linkedCalf) => linkedCalf.id) },
            statut: "ACTIF",
            sevreFait: false,
          },
        });
        automaticDryOff = !mother.tarieFaite && remainingCalves === 0;
      }

      const mustDryOff = manualDryOff || automaticDryOff;
      if (mustDryOff && !mother.tarieFaite) {
        revertSteps.push({
          op: "update",
          model: "animal",
          where: { id: mother.id },
          data: {
            tarieFaite: mother.tarieFaite,
            dateTarie: mother.dateTarie?.toISOString() ?? null,
          },
        });
        await tx.animal.update({
          where: { id: mother.id },
          data: { tarieFaite: true, dateTarie: effectiveActionDate },
        });
      }

      if (revertSteps.length > 0) {
        const description = mustWean
          ? automaticDryOff
            ? `Sevrage de ${calf.nutrav} et tarissement automatique de ${mother.nutrav}`
            : `Sevrage de ${calf.nutrav}`
          : `Tarissement manuel de ${mother.nutrav}`;
        const log = await tx.actionLog.create({
          data: {
            type: mustWean
              ? automaticDryOff
                ? "SEVRAGE_TARISSEMENT_AUTO"
                : "SEVRAGE"
              : "TARISSEMENT_MANUEL",
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

  const cycleWeanedCount =
    currentCycle.linkedCalves.filter((linkedCalf) => linkedCalf.sevreFait)
      .length + (mustWean ? 1 : 0);
  const cyclePendingCount = Math.max(
    0,
    currentCycle.pendingCalves.length - (mustWean ? 1 : 0)
  );
  const mustDryOff = manualDryOff || automaticDryOff;

  return NextResponse.json({
    ok: true,
    automaticDryOff,
    cycleProgress: {
      total: currentCycle.linkedCalves.length,
      weaned: cycleWeanedCount,
      pending: cyclePendingCount,
    },
    calf: {
      id: calf.id,
      sevreFait: mustWean ? true : calf.sevreFait,
      dateSevrage: mustWean
        ? effectiveActionDate.toISOString()
        : calf.dateSevrage?.toISOString() ?? null,
    },
    mother: {
      id: mother.id,
      tarieFaite: mustDryOff ? true : mother.tarieFaite,
      dateTarie: mustDryOff
        ? effectiveActionDate.toISOString()
        : mother.dateTarie?.toISOString() ?? null,
    },
    _undoId: undoId,
  });
}
