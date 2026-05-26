import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sorties = await prisma.sortie.findMany({
    where: { type: "MORT", causeMortalite: { not: null } },
    select: { causeMortalite: true },
  });
  const distinctCauses = [...new Set(sorties.map((s) => s.causeMortalite as string))].sort();
  return NextResponse.json(distinctCauses);
}
