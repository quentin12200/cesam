import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const doses = [...new Set((Array.isArray(body.doses) ? body.doses : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))] as number[];
  for (const nombre of doses) {
    const existant = await prisma.conditionnementMedicament.findFirst({ where: { medicamentId: id, doses: nombre } });
    if (existant) await prisma.conditionnementMedicament.update({ where: { id: existant.id }, data: { actif: true } });
    else await prisma.conditionnementMedicament.create({ data: { medicamentId: id, doses: nombre } });
  }
  return NextResponse.json(await prisma.conditionnementMedicament.findMany({ where: { medicamentId: id, actif: true }, orderBy: { doses: "asc" } }));
}
