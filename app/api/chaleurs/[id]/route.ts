import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { date, notes } = await request.json();
    if (!date) {
      return NextResponse.json({ error: "Date requise" }, { status: 400 });
    }
    const chaleurDate = new Date(date);
    if (Number.isNaN(chaleurDate.getTime())) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
    const chaleur = await prisma.chaleur.update({
      where: { id },
      data: {
        date: chaleurDate,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(chaleur);
  } catch (error) {
    console.error(`PATCH /api/chaleurs/${id} error:`, error);
    return NextResponse.json({ error: "Modification impossible" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.chaleur.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/chaleurs/${id} error:`, error);
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  }
}
