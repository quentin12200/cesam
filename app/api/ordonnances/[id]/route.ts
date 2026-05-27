import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { statut, notes } = body;

  try {
    const ordonnance = await prisma.ordonnance.update({
      where: { id },
      data: {
        ...(statut !== undefined && { statut }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });
    return NextResponse.json(ordonnance);
  } catch {
    return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.ordonnance.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  }
}
