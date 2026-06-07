import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const row = await prisma.venteHistorique.update({
      where: { id },
      data: {
        ...(body.annee != null && { annee: parseInt(body.annee) }),
        ...(body.typeAnimal != null && { typeAnimal: body.typeAnimal }),
        ...(body.typeVente != null && { typeVente: body.typeVente }),
        ...(body.nutrav !== undefined && { nutrav: body.nutrav || null }),
        ...(body.sexe !== undefined && { sexe: body.sexe || null }),
        ...(body.poidsVif !== undefined && { poidsVif: body.poidsVif != null ? parseFloat(body.poidsVif) : null }),
        ...(body.prixKgVif !== undefined && { prixKgVif: body.prixKgVif != null ? parseFloat(body.prixKgVif) : null }),
        ...(body.poidsCarc !== undefined && { poidsCarc: body.poidsCarc != null ? parseFloat(body.poidsCarc) : null }),
        ...(body.prixKgCarc !== undefined && { prixKgCarc: body.prixKgCarc != null ? parseFloat(body.prixKgCarc) : null }),
        ...(body.acheteur !== undefined && { acheteur: body.acheteur || null }),
        ...(body.date != null && { date: new Date(body.date) }),
        ...(body.total !== undefined && { total: body.total != null ? parseFloat(body.total) : null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.venteHistorique.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
