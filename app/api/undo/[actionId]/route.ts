import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { RevertStep } from "@/lib/action-log";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params;

  const log = await prisma.actionLog.findUnique({ where: { id: actionId } });
  if (!log) return NextResponse.json({ error: "Action non trouvée" }, { status: 404 });
  if (log.reverted) return NextResponse.json({ error: "Déjà annulée" }, { status: 409 });

  const raw = JSON.parse(log.revertData);
  const steps: RevertStep[] = Array.isArray(raw) ? raw : [raw];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    for (const step of steps) {
      if (step.op === "delete") {
        await db[step.model].delete({ where: { id: step.id } });
      } else if (step.op === "update") {
        await db[step.model].update({ where: step.where, data: step.data });
      } else if (step.op === "create") {
        await db[step.model].create({ data: step.data });
      }
    }

    await prisma.actionLog.update({
      where: { id: actionId },
      data: { reverted: true, revertedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/undo error:", err);
    return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 });
  }
}
