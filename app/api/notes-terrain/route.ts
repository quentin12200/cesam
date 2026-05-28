import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpush } from "@/lib/push";

export async function GET() {
  const notes = await prisma.noteTerrain.findMany({
    where: { traitee: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const { texte } = await request.json();
  if (!texte?.trim()) {
    return NextResponse.json({ error: "texte requis" }, { status: 400 });
  }

  const note = await prisma.noteTerrain.create({
    data: { texte: texte.trim() },
  });

  // Push notification instantanée à tous les abonnés
  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length > 0) {
      const body = texte.length > 100 ? texte.slice(0, 97) + "…" : texte;
      const payload = JSON.stringify({
        title: "🎙️ Note terrain dictée",
        body,
        url: "/",
      });
      const toDelete: string[] = [];
      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (err: unknown) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 410 || status === 404) toDelete.push(sub.id);
          }
        })
      );
      if (toDelete.length > 0) {
        await prisma.pushSubscription.deleteMany({ where: { id: { in: toDelete } } });
      }
    }
  } catch {
    // Push failure doesn't fail the note creation
  }

  return NextResponse.json(note, { status: 201 });
}
