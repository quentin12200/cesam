import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEPARTEMENTS } from "@/lib/soutien/reagir";

const CODES_VALIDES = new Set(DEPARTEMENTS.map(([code]) => code));

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const departement = typeof body.departement === "string" ? body.departement : "";
  if (departement && !CODES_VALIDES.has(departement)) {
    return NextResponse.json({ error: "Département invalide" }, { status: 400 });
  }

  const config = await prisma.exploitationConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", departementSoutien: departement || null },
    update: { departementSoutien: departement || null },
    select: { departementSoutien: true },
  });
  return NextResponse.json(config);
}
