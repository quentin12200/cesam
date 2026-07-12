import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const questions = await prisma.questionTemplate.findMany({
    where: { typeEvenementId: id, actif: true },
    orderBy: { ordre: "asc" },
  });
  return NextResponse.json(
    questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    }))
  );
}
