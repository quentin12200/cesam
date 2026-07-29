export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminMessaging } from "@/lib/firebase-admin";
import { differenceInDays, addDays, subHours } from "date-fns";
import { getEtatGestation, getVaccinsManquants } from "@/lib/utils";

export async function POST() {
  try {
    const now = new Date();
    const cutoff = subHours(now, 12);

    const tokens = await prisma.fcmToken.findMany({
      where: { OR: [{ lastNotifAt: null }, { lastNotifAt: { lt: cutoff } }] },
    });

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, reason: "already_sent" });
    }

    const alerts: string[] = [];

    const [vachesAvecSaillies, animaux, velagesSemaine, veauxABoucler, genissesArapatrier, surveillanceActive, cryptoRotavecCount, bolusCount, reproductionConfig] =
      await Promise.all([
        prisma.animal.findMany({
          where: { statut: "ACTIF", sexbov: "F", estGenisse: false, OR: [{ categorie: null }, { categorie: { not: "ENGRAISSEMENT" } }] },
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
          where: { etat: { in: ["VERT", "ROSE"] }, dateVelagePrevue: { gte: now, lte: addDays(now, 7) } },
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
        prisma.gestation.count({
          where: { etat: { in: ["VERT", "ROSE"] }, dateVelagePrevue: { gte: now, lte: addDays(now, 21) } },
        }),
        prisma.gestation.count({
          where: { etat: { in: ["VERT", "ROSE"] }, dateVelagePrevue: { gte: addDays(now, 21), lte: addDays(now, 90) } },
        }),
        prisma.gestation.count({
          where: { etat: { in: ["VERT", "ROSE"] }, dateVelagePrevue: { gte: addDays(now, 21), lte: addDays(now, 45) } },
        }),
        prisma.exploitationConfig.findUnique({
          where: { id: "singleton" },
          select: { reproReposObjectifJours: true },
        }).catch(() => null),
      ]);

    let aEchographier = 0, videsEnRetard = 0;
    for (const v of vachesAvecSaillies) {
      const etat = getEtatGestation(
        v.saillies[0]?.date ?? null,
        v.saillies[0]?.gestation?.etat ?? null,
        v.saillies[0]?.gestation?.dateVelagePrevue ?? null,
        v.velagesVache[0]?.date ?? null,
        v.aEchographier,
        reproductionConfig?.reproReposObjectifJours ?? 60
      );
      if (etat === "JAUNE") aEchographier++;
      if (etat === "ROUGE") videsEnRetard++;
    }

    let veauxAVacciner = 0;
    for (const a of animaux) {
      const age = differenceInDays(now, a.danais);
      if (age <= 730) {
        const manquants = getVaccinsManquants(a.danais, a.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date })));
        if (manquants.length > 0) veauxAVacciner++;
      }
    }

    if (videsEnRetard > 0) alerts.push(`🔴 ${videsEnRetard} vache${videsEnRetard > 1 ? "s" : ""} vide${videsEnRetard > 1 ? "s" : ""} en retard`);
    if (aEchographier > 0) alerts.push(`🟡 ${aEchographier} à échographier`);
    if (surveillanceActive > 0) alerts.push(`🔔 ${surveillanceActive} vache${surveillanceActive > 1 ? "s" : ""} en surveillance active`);
    if (velagesSemaine > 0) alerts.push(`🍼 ${velagesSemaine} vélage${velagesSemaine > 1 ? "s" : ""} cette semaine`);
    if (veauxABoucler > 0) alerts.push(`🏷️ ${veauxABoucler} veau${veauxABoucler > 1 ? "x" : ""} à boucler`);
    if (veauxAVacciner > 0) alerts.push(`💉 ${veauxAVacciner} vaccin${veauxAVacciner > 1 ? "s" : ""} en retard`);
    if (genissesArapatrier > 0) alerts.push(`⚠️ ${genissesArapatrier} génisse${genissesArapatrier > 1 ? "s" : ""} à rapatrier`);
    if (cryptoRotavecCount > 0) alerts.push(`💊 ${cryptoRotavecCount} Crypto/Rotavec pré-vélage`);
    if (bolusCount > 0) alerts.push(`🔵 ${bolusCount} bolus pré-vélage`);

    if (alerts.length === 0) return NextResponse.json({ sent: 0, reason: "no_alerts" });

    const messaging = getAdminMessaging();
    const tokenStrings = tokens.map((t) => t.token);

    const response = await messaging.sendEachForMulticast({
      tokens: tokenStrings,
      notification: {
        title: "GAEC CESAM 🐄",
        body: alerts.join(" • "),
      },
      webpush: {
        notification: { icon: "/icon-192.png", badge: "/icon-192.png", tag: "cesam-daily" },
        fcmOptions: { link: "/" },
      },
    });

    // Mark sent + remove invalid tokens
    const toDelete: string[] = [];
    response.responses.forEach((r, i) => {
      if (r.success) {
        // mark lastNotifAt async (fire and forget ok here)
        prisma.fcmToken.update({ where: { token: tokenStrings[i] }, data: { lastNotifAt: now } }).catch(() => null);
      } else {
        const code = r.error?.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
          toDelete.push(tokenStrings[i]);
        }
      }
    });

    if (toDelete.length > 0) {
      await prisma.fcmToken.deleteMany({ where: { token: { in: toDelete } } });
    }

    return NextResponse.json({ sent: response.successCount, failed: response.failureCount, alerts: alerts.length });
  } catch (err) {
    console.error("FCM send error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
