export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpush } from "@/lib/push";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getVaccinsManquants } from "@/lib/utils";
import { getHeatReturnReminder } from "@/lib/heat-return-monitoring";
import { parseReproductionRules } from "@/lib/reproduction-rules";
import {
  createWebPushPayload,
  heatReturnNotificationTag,
  morningDigestNotificationTag,
} from "@/lib/web-push-payload";

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

    const dateMinVelle = new Date(now); dateMinVelle.setDate(dateMinVelle.getDate() - 365);
    const dateMaxVelle = new Date(now); dateMaxVelle.setDate(dateMaxVelle.getDate() - 351);

    const [vachesAvecSaillies, animaux, velagesSemaine, veauxABoucler, genissesArapatrier,
           surveillanceActive, cryptoRotavecCount, bolusCount, heatReturnCandidates, vellesUrgentes,
           traitementsEnCoursRaw, ordonnancesAAssocierCount, medicamentsRaw, reproductionConfig] =
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
        // La règle de surveillance est lue dans la configuration de l'exploitation.
        prisma.animal.findMany({
          where: {
            statut: "ACTIF",
            sexbov: "F",
            chaleurs: { some: {} },
          },
          select: {
            id: true,
            nutrav: true,
            nobovi: true,
            reproductionEtatManuel: true,
            chaleurs: { orderBy: { date: "desc" }, take: 1, select: { id: true, date: true } },
            saillies: {
              select: {
                date: true,
                gestation: { select: { etat: true } },
              },
            },
            velagesVache: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
          },
        }),
        // Velles bientôt 1 an (11.5 à 12 mois)
        prisma.animal.findMany({
          where: { statut: "ACTIF", categorie: "VELLE", danais: { gte: dateMinVelle, lte: dateMaxVelle } },
          select: { nutrav: true, nobovi: true, danais: true },
        }),
        // Traitements en cours dont la durée prévue est dépassée (à clôturer ou prolonger)
        prisma.traitement.findMany({
          where: { statut: "EN_COURS" },
          select: { dateDebut: true, dureeJours: true },
        }),
        // Traitements avec une ordonnance encore à associer
        prisma.traitement.count({
          where: { ordonnanceAAssocier: true, ordonnanceId: null },
        }),
        // Médicaments dont le stock est sous le seuil d'alerte
        prisma.medicament.findMany({
          where: { actif: true, stockActuel: { not: null }, stockSeuilAlert: { not: null } },
          select: { stockActuel: true, stockSeuilAlert: true },
        }),
        prisma.exploitationConfig.findUnique({
          where: { id: "singleton" },
          select: { reproductionRulesJson: true },
        }).catch(() => null),
      ]);

    const traitementsEnRetard = traitementsEnCoursRaw.filter(
      (t) => addDays(t.dateDebut, t.dureeJours) < now
    ).length;
    const medicamentsStockBasCount = medicamentsRaw.filter(
      (m) => m.stockActuel != null && m.stockSeuilAlert != null && m.stockActuel <= m.stockSeuilAlert
    ).length;

    let aEchographier = 0;
    let videsEnRetard = 0;
    for (const v of vachesAvecSaillies) {
      const etat = getEtatGestation(
        v.saillies[0]?.date ?? null,
        v.saillies[0]?.gestation?.etat ?? null,
        v.saillies[0]?.gestation?.dateVelagePrevue ?? null,
        v.velagesVache[0]?.date ?? null,
        v.aEchographier
      );
      if (etat === "JAUNE") aEchographier++;
      if (etat === "ROUGE") videsEnRetard++;
    }

    const heatReturnRule = parseReproductionRules(reproductionConfig?.reproductionRulesJson).heatReturnMonitoring;
    const heatReturnNotifications = heatReturnCandidates
      .map((animal) => ({
        animal,
        reminder: getHeatReturnReminder(
          animal.chaleurs,
          animal.saillies,
          animal.velagesVache[0]?.date ?? null,
          heatReturnRule,
          now,
          animal.reproductionEtatManuel === "VERT" || animal.reproductionEtatManuel === "ROSE"
        ),
      }))
      .filter((item): item is typeof item & { reminder: NonNullable<typeof item.reminder> } =>
        item.reminder?.day === heatReturnRule.startDay
      );

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
    if (traitementsEnRetard > 0)
      items.push(`${traitementsEnRetard} traitement${traitementsEnRetard > 1 ? "s" : ""} en retard à clôturer`);
    if (ordonnancesAAssocierCount > 0)
      items.push(`${ordonnancesAAssocierCount} ordonnance${ordonnancesAAssocierCount > 1 ? "s" : ""} à associer`);
    if (medicamentsStockBasCount > 0)
      items.push(`${medicamentsStockBasCount} médicament${medicamentsStockBasCount > 1 ? "s" : ""} en stock bas`);
    if (vellesUrgentes.length > 0) {
      const noms = vellesUrgentes.map((v) => v.nobovi ?? v.nutrav).join(", ");
      items.unshift(`🚨 ${vellesUrgentes.length} velle${vellesUrgentes.length > 1 ? "s" : ""} à vendre rapidement (bientôt 1 an) : ${noms}`);
    }

    const body =
      items.length === 0
        ? "Rien de particulier aujourd'hui — bonne journée ! 🌿"
        : `Aujourd'hui : ${items.join(", ")}.`;

    const title = vellesUrgentes.length > 0
      ? `🚨 URGENT — ${vellesUrgentes.length} velle${vellesUrgentes.length > 1 ? "s" : ""} à vendre`
      : "Bonjour 🌅 — GAEC CESAM";

    const digestPayload = createWebPushPayload({
      title,
      body,
      url: vellesUrgentes.length > 0 ? "/troupeau" : "/",
      tag: morningDigestNotificationTag(now),
    });
    const heatReturnPayloads = heatReturnNotifications.map(({ animal, reminder }) => createWebPushPayload({
      title: "Retour en chaleur à surveiller",
      body: `Vérifier ${animal.nutrav}${animal.nobovi ? ` — ${animal.nobovi}` : ""}.`,
      url: `/troupeau/${encodeURIComponent(animal.nutrav)}`,
      tag: heatReturnNotificationTag(animal.id, reminder.heat.id),
    }));
    const payloads = [...heatReturnPayloads, digestPayload];

    let sent = 0;
    const toDelete: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        let sentToSubscription = false;
        for (const payload of payloads) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            sent++;
            sentToSubscription = true;
          } catch (err: unknown) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 410 || status === 404) {
              toDelete.push(sub.id);
              break;
            }
          }
        }
        if (sentToSubscription) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastNotifAt: now, updatedAt: now },
          });
        }
      })
    );

    if (toDelete.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: toDelete } } });
    }

    return NextResponse.json({ sent, items: items.length, heatReturnNotifications: heatReturnNotifications.length });
  } catch (err) {
    console.error("GET /api/cron/morning-digest error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
