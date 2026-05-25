export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpush } from "@/lib/push";
import { differenceInDays, addDays, subHours } from "date-fns";
import { getEtatGestation, getVaccinsManquants } from "@/lib/utils";

export async function POST() {
  try {
    const now = new Date();
    const cutoff = subHours(now, 12);

    // Only send to subscriptions that haven't been notified in 12h
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { OR: [{ lastNotifAt: null }, { lastNotifAt: { lt: cutoff } }] },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, reason: "already_sent" });
    }

    // Calculate alerts
    const alerts: string[] = [];

    const [vachesAvecSaillies, animaux, velagesSemaine, veauxABoucler, genissesArapatrier,
           surveillanceActive, cryptoRotavecCount, bolusCount] =
      await Promise.all([
        prisma.animal.findMany({
          where: { statut: "ACTIF", sexbov: "F", estGenisse: false },
          include: {
            saillies: { orderBy: { date: "desc" }, take: 1, include: { gestation: true } },
            velagesVache: { orderBy: { date: "desc" }, take: 1 },
          },
        }),
        prisma.animal.findMany({
          where: { statut: "ACTIF" },
          include: { vaccinations: { select: { vaccin: true, date: true } } },
        }),
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: now, lte: addDays(now, 7) },
          },
        }),
        prisma.animal.count({
          where: { statut: "ACTIF", boucleFaite: false, velageVeau: { isNot: null } },
        }),
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: addDays(now, 30), lte: addDays(now, 90) },
            saillie: { animal: { statut: "ACTIF", velagesVache: { none: {} } } },
          },
        }),
        // Surveillance active: gestation ≥ 270 jours (9 mois), vélage dans les 21 prochains jours
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: now, lte: addDays(now, 21) },
          },
        }),
        // Crypto/Rotavec à faire (fenêtre J-21 à J-90, simplified count)
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: addDays(now, 21), lte: addDays(now, 90) },
          },
        }),
        // Bolus à donner (fenêtre J-21 à J-45)
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: addDays(now, 21), lte: addDays(now, 45) },
          },
        }),
      ]);

    let aEchographier = 0;
    let videsEnRetard = 0;
    for (const v of vachesAvecSaillies) {
      const etat = getEtatGestation(
        v.saillies[0]?.date ?? null,
        v.saillies[0]?.gestation?.etat ?? null,
        v.saillies[0]?.gestation?.dateVelagePrevue ?? null,
        v.velagesVache[0]?.date ?? null
      );
      if (etat === "JAUNE") aEchographier++;
      if (etat === "ROUGE") videsEnRetard++;
    }

    let veauxAVacciner = 0;
    for (const a of animaux) {
      const age = differenceInDays(now, a.danais);
      if (age <= 730) {
        const manquants = getVaccinsManquants(
          a.danais,
          a.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date }))
        );
        if (manquants.length > 0) veauxAVacciner++;
      }
    }

    if (videsEnRetard > 0)
      alerts.push(`🔴 ${videsEnRetard} vache${videsEnRetard > 1 ? "s" : ""} vide${videsEnRetard > 1 ? "s" : ""} en retard`);
    if (aEchographier > 0)
      alerts.push(`🟡 ${aEchographier} à échographier`);
    if (surveillanceActive > 0)
      alerts.push(`🔔 ${surveillanceActive} vache${surveillanceActive > 1 ? "s" : ""} en surveillance active (vélage <21j)`);
    if (velagesSemaine > 0)
      alerts.push(`🍼 ${velagesSemaine} vélage${velagesSemaine > 1 ? "s" : ""} cette semaine`);
    if (veauxABoucler > 0)
      alerts.push(`🏷️ ${veauxABoucler} veau${veauxABoucler > 1 ? "x" : ""} à boucler`);
    if (veauxAVacciner > 0)
      alerts.push(`💉 ${veauxAVacciner} vaccin${veauxAVacciner > 1 ? "s" : ""} en retard`);
    if (genissesArapatrier > 0)
      alerts.push(`⚠️ ${genissesArapatrier} génisse${genissesArapatrier > 1 ? "s" : ""} à rapatrier`);
    if (cryptoRotavecCount > 0)
      alerts.push(`💊 ${cryptoRotavecCount} Crypto/Rotavec pré-vélage`);
    if (bolusCount > 0)
      alerts.push(`🔵 ${bolusCount} bolus pré-vélage`);

    if (alerts.length === 0) {
      return NextResponse.json({ sent: 0, reason: "no_alerts" });
    }

    const payload = JSON.stringify({
      title: "GAEC CESAM 🐄",
      body: alerts.join(" • "),
      url: "/",
    });

    let sent = 0;
    const toDelete: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastNotifAt: now, updatedAt: now },
          });
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            toDelete.push(sub.id);
          }
        }
      })
    );

    if (toDelete.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: toDelete } } });
    }

    return NextResponse.json({ sent, alerts: alerts.length });
  } catch (err) {
    console.error("POST /api/push/send error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
