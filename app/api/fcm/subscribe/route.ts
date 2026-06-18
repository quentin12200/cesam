import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { token, device } = await request.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await prisma.fcmToken.upsert({
    where: { token },
    create: { token, device: device ?? null },
    update: { device: device ?? undefined, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await prisma.fcmToken.deleteMany({ where: { token } });
  return NextResponse.json({ ok: true });
}
