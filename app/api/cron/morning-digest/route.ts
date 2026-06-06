export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpush } from "@/lib/push";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getVaccinsManquants } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, reason: "no_subscriptions" });
    }

    const [vachesAvecSaillies, animaux, velagesSemaine, veauxABoucler, genissesArapatrier,
           surveillanceActive, cryptoRotavecCount, bolusCount, chaleurJ19Raw] =
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
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: now, lte: addDays(now, 21) },
          },
        }),
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: addDays(now, 21), lte: addDays(now, 90) },
          },
        }),
        prisma.gestation.count({
          where: {
            etat: { in: ["VERT", "ROSE"] },
            dateVelagePrevue: { gte: addDays(now, 21), lte: addDays(now, 45) },
          },
        }),
        // Chaleurs J+19 à J+21 (fenêtre 72h : surveiller retour de cycle)
        prisma.animal.findMany({
          where: {
            statut: "ACTIF",
            sexbov: "F",
            chaleurs: { some: { date: { gte: addDays(now, -21), lte: addDays(now, -19) } } },
          },
          include: {
            chaleurs: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
            saillies: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
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

    // Chaleurs J+19 : garder seulement celles sans saillie postérieure
    const chaleurJ19 = chaleurJ19Raw.filter((a) => {
      const derniereChaleur = a.chaleurs[0]?.date ?? null;
      if (!derniereChaleur) return false;
      const derniereSaillie = a.saillies[0]?.date ?? null;
      if (derniereSaillie && derniereSaillie >= derniereChaleur) return false;
      return true;
    });

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

    const items: string[] = [];
    if (videsEnRetard > 0)
      items.push(`${videsEnRetard} vache${videsEnRetard > 1 ? "s" : ""} vide${videsEnRetard > 1 ? "s" : ""} en retard`);
    if (aEchographier > 0)
      items.push(`${aEchographier} à échographier`);
    if (surveillanceActive > 0)
      items.push(`${surveillanceActive} en surveillance vélage`);
    if (velagesSemaine > 0)
      items.push(`${velagesSemaine} vélage${velagesSemaine > 1 ? "s" : ""} cette semaine`);
    if (veauxABoucler > 0)
      items.push(`${veauxABoucler} veau${veauxABoucler > 1 ? "x" : ""} à boucler`);
    if (veauxAVacciner > 0)
      items.push(`${veauxAVacciner} vaccin${veauxAVacciner > 1 ? "s" : ""} en retard`);
    if (genissesArapatrier > 0)
      items.push(`${genissesArapatrier} génisse${genissesArapatrier > 1 ? "s" : ""} à rapatrier`);
    if (cryptoRotavecCount > 0)
      items.push(`${cryptoRotavecCount} Crypto/Rotavec pré-vélage`);
    if (bolusCount > 0)
      items.push(`${bolusCount} bolus pré-vélage`);
    if (chaleurJ19.length > 0)
      items.push(`${chaleurJ19.length} vache${chaleurJ19.length > 1 ? "s" : ""} à surveiller retour chaleur (J+19)`);

    const body =
      items.length === 0
        ? "Rien de particulier aujourd'hui — bonne journée ! 🌿"
        : `Aujourd'hui : ${items.join(", ")}.`;

    const payload = JSON.stringify({
      title: "Bonjour 🌅 — GAEC CESAM",
      body,
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

    return NextResponse.json({ sent, items: items.length });
  } catch (err) {
    console.error("GET /api/cron/morning-digest error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
