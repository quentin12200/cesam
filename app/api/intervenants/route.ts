import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const intervenants = await prisma.intervenant.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(intervenants);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const nom: string | undefined = body.nom;
  if (!nom?.trim()) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }

  const nomTrim = nom.trim();
  const tous = await prisma.intervenant.findMany();
  const existant = tous.find((i) => i.nom.toLowerCase() === nomTrim.toLowerCase());
  if (existant) return NextResponse.json(existant, { status: 200 });

  const intervenant = await prisma.intervenant.create({ data: { nom: nomTrim } });
  return NextResponse.json(intervenant, { status: 201 });
}
