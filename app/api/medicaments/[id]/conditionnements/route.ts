import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const doses = [...new Set((Array.isArray(body.doses) ? body.doses : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))] as number[];
  for (const nombre of doses) await prisma.conditionnementMedicament.upsert({ where: { medicamentId_doses: { medicamentId: id, doses: nombre } }, create: { medicamentId: id, doses: nombre }, update: { actif: true } });
  return NextResponse.json(await prisma.conditionnementMedicament.findMany({ where: { medicamentId: id, actif: true }, orderBy: { doses: "asc" } }));
}
