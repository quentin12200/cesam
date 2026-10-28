import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidSubscriptionCredentials } from "@/lib/notification-preferences";

export async function POST(request: NextRequest) {
  try {
    const { endpoint, keys, device } = await request.json();
    if (typeof endpoint !== "string" || endpoint.length > 2048 || !/^https:\/\//.test(endpoint) ||\n        !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" ||\n        keys.p256dh.length < 16 || keys.p256dh.length > 256 ||\n        keys.auth.length < 8 || keys.auth.length > 256 ||\n        (device != null && (typeof device !== "string" || device.length > 100))) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, device: device ?? null, updatedAt: new Date() },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, device: device ?? null, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/push/subscribe error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (!isValidSubscriptionCredentials(body)) {
      return NextResponse.json({ error: "Identification de l’appareil incomplète" }, { status: 400 });
    }
    const result = await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, auth: body.auth },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Abonnement introuvable pour cet appareil" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/push/subscribe error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
