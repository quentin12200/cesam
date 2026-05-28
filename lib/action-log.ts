import { prisma } from "@/lib/prisma";

export type RevertStep =
  | { op: "delete"; model: string; id: string }
  | { op: "update"; model: string; where: Record<string, unknown>; data: Record<string, unknown> }
  | { op: "create"; model: string; data: Record<string, unknown> };

export async function logAction(
  type: string,
  description: string,
  revertData: RevertStep | RevertStep[]
): Promise<string> {
  const log = await prisma.actionLog.create({
    data: { type, description, revertData: JSON.stringify(revertData) },
  });
  return log.id;
}
