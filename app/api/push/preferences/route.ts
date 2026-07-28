import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidSubscriptionCredentials,
  mergeNotificationPreferences,
  parseNotificationPreferences,
  validateNotificationPreferencePatch,
} from "@/lib/notification-preferences";

async function readJson(request: NextRequest) {
  try {
    return await request.json() as Record<string, unknown> & { preferences?: unknown };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!isValidSubscriptionCredentials(body)) {
    return NextResponse.json({ error: "Identification de l’appareil invalide" }, { status: 400 });
  }

  const subscription = await prisma.pushSubscription.findFirst({
    where: { endpoint: body.endpoint, auth: body.auth },
    select: {
      device: true,
      createdAt: true,
      lastNotifAt: true,
      preferencesJson: true,
    },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Abonnement introuvable pour cet appareil" }, { status: 404 });
  }

  return NextResponse.json({
    active: true,
    device: subscription.device,
    createdAt: subscription.createdAt,
    lastNotifAt: subscription.lastNotifAt,
    preferences: parseNotificationPreferences(subscription.preferencesJson),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await readJson(request);
  if (!isValidSubscriptionCredentials(body)) {
    return NextResponse.json({ error: "Identification de l’appareil invalide" }, { status: 400 });
  }

  const validation = validateNotificationPreferencePatch(body.preferences);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const subscription = await prisma.pushSubscription.findFirst({
    where: { endpoint: body.endpoint, auth: body.auth },
    select: { id: true, preferencesJson: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Abonnement introuvable pour cet appareil" }, { status: 404 });
  }

  const preferences = mergeNotificationPreferences(
    subscription.preferencesJson,
    validation.patch
  );
  await prisma.pushSubscription.update({
    where: { id: subscription.id },
    data: { preferencesJson: JSON.stringify(preferences) },
  });

  return NextResponse.json({ preferences });
}
