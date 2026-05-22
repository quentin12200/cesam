import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const taureaux = await prisma.taureau.findMany({
    select: { id: true, nupere: true, nopere: true },
    orderBy: { nopere: "asc" },
  });

  return NextResponse.json({ taureaux });
}
