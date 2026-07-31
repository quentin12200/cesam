import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateGmqKgPerDay } from "@/lib/field-weighing";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const poids = Number(body.poids);
    const sessionStartedAt = new Date(String(body.sessionStartedAt ?? ""));

    if (
      !Number.isInteger(poids) ||
      poids <= 0 ||
      poids > 2000 ||
      Number.isNaN(sessionStartedAt.getTime())
    ) {
      return NextResponse.json({ error: "Données de pesée invalides" }, { status: 400 });
    }

    const existing = await prisma.pesee.findUnique({
      where: { id },
      select: { id: true, animalId: true, date: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pesée non trouvée" }, { status: 404 });
    }

    const previous = await prisma.pesee.findFirst({
      where: {
        animalId: existing.animalId,
        createdAt: { lt: sessionStartedAt },
        id: { not: existing.id },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { poids: true, date: true },
    });

    const pesee = await prisma.pesee.update({
      where: { id },
      data: { poids },
    });

    return NextResponse.json({
      success: true,
      pesee,
      gmq: calculateGmqKgPerDay(poids, existing.date, previous),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const existing = await prisma.pesee.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pesée non trouvée" }, { status: 404 });
    }

    await prisma.pesee.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
