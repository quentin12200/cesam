import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import type { RevertStep } from "../lib/action-log";

// Script à lancer une seule fois (manuellement) pour :
//  1. retrouver, à partir de l'historique des actions (ActionLog), la date
//     exacte des sevrages/tarissements déjà effectués AVANT l'ajout des
//     champs dateSevrage/dateTarie ;
//  2. corriger les vaches marquées "non tarie" alors qu'elles n'ont plus
//     aucun veau actif non sevré (la cascade sevrage→tarissement ne se
//     déclenchait que via le vêlage enregistré ; les veaux liés uniquement
//     par la généalogie directe — sans vêlage — ne mettaient pas à jour
//     leur mère).
//
// Usage : npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-sevrage-dates.ts
// (nécessite DATABASE_URL / TURSO_AUTH_TOKEN comme pour le seed)
//
// Idempotent et non destructif : ne touche que les lignes où
// dateSevrage/dateTarie est encore NULL, ou tarieFaite encore à false ;
// n'écrase jamais une date ou un statut déjà connu.

const DB_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

const adapter = new PrismaLibSql({
  url: DB_URL,
  ...(AUTH_TOKEN ? { authToken: AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);

async function main() {
  console.log("🔎 Lecture de l'historique des actions (ActionLog)...");

  const logs = await prisma.actionLog.findMany({
    where: { type: "PATCH_ANIMAL", reverted: false },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, revertData: true },
  });

  const dateSevrageParNutrav = new Map<string, Date>();
  const dateTarieParNutrav = new Map<string, Date>();

  for (const log of logs) {
    let steps: RevertStep[];
    try {
      const parsed = JSON.parse(log.revertData);
      steps = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      continue;
    }

    for (const step of steps) {
      if (step.op !== "update" || step.model !== "animal") continue;
      const nutrav = (step.where as { nutrav?: string } | undefined)?.nutrav;
      if (!nutrav) continue;
      const data = step.data as Record<string, unknown>;

      // revertData contient la valeur PRÉCÉDENTE (celle à restaurer en cas d'undo) :
      // sevreFait === false ici signifie que cette action a fait passer sevreFait à true.
      if ("sevreFait" in data && data.sevreFait === false) {
        dateSevrageParNutrav.set(nutrav, log.createdAt); // dernière occurrence = la plus récente (asc order)
      }
      if ("tarieFaite" in data && data.tarieFaite === false) {
        dateTarieParNutrav.set(nutrav, log.createdAt);
      }
    }
  }

  console.log(`   ${dateSevrageParNutrav.size} date(s) de sevrage retrouvée(s) dans l'historique.`);
  console.log(`   ${dateTarieParNutrav.size} date(s) de tarissement retrouvée(s) dans l'historique.`);

  const veauxAMettreAJour = await prisma.animal.findMany({
    where: { sevreFait: true, dateSevrage: null },
    select: { nutrav: true },
  });

  let sevrageMisAJour = 0;
  for (const v of veauxAMettreAJour) {
    const date = dateSevrageParNutrav.get(v.nutrav);
    if (!date) continue;
    await prisma.animal.update({ where: { nutrav: v.nutrav }, data: { dateSevrage: date } });
    sevrageMisAJour++;
  }

  const vachesAMettreAJour = await prisma.animal.findMany({
    where: { tarieFaite: true, dateTarie: null },
    select: { nutrav: true },
  });

  let tarieMiseAJour = 0;
  for (const v of vachesAMettreAJour) {
    const date = dateTarieParNutrav.get(v.nutrav);
    if (!date) continue;
    await prisma.animal.update({ where: { nutrav: v.nutrav }, data: { dateTarie: date } });
    tarieMiseAJour++;
  }

  console.log("\n🔎 Vérification tarieFaite / réalité (veau actif non sevré) pour toutes les vaches...");

  const vaches = await prisma.animal.findMany({
    where: { sexbov: "F", estGenisse: false },
    select: {
      nutrav: true,
      tarieFaite: true,
      veaux: { select: { statut: true, sevreFait: true, dateSevrage: true } },
      velagesVache: { select: { veau: { select: { statut: true, sevreFait: true, dateSevrage: true } } } },
    },
  });

  let tarieCorrigees = 0;
  for (const vache of vaches) {
    if (vache.tarieFaite) continue; // on ne corrige que les faux négatifs (déjà "oui" : on ne touche pas)

    const veauxVelage = vache.velagesVache
      .map((v) => v.veau)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const tousLesVeaux = [...vache.veaux, ...veauxVelage];

    if (tousLesVeaux.length === 0) continue; // jamais vêlé : pas de tarissement à déduire
    const aUnVeauActifNonSevre = tousLesVeaux.some((v) => v.statut === "ACTIF" && !v.sevreFait);
    if (aUnVeauActifNonSevre) continue; // encore en train d'allaiter : rien à corriger

    const datesSevrageConnues = tousLesVeaux
      .filter((v) => v.sevreFait && v.dateSevrage)
      .map((v) => v.dateSevrage as Date);
    const dateTarieDeduite =
      datesSevrageConnues.length > 0
        ? new Date(Math.max(...datesSevrageConnues.map((d) => d.getTime())))
        : null;

    await prisma.animal.update({
      where: { nutrav: vache.nutrav },
      data: { tarieFaite: true, dateTarie: dateTarieDeduite },
    });
    tarieCorrigees++;
  }

  console.log(`   ${tarieCorrigees} vache(s) recalculée(s) : tarieFaite corrigé à "oui" (plus aucun veau actif non sevré).`);

  console.log("\n📊 Résumé du backfill :");
  console.log(`   🍼 ${sevrageMisAJour} / ${veauxAMettreAJour.length} veau(x) sevré(s) complété(s) avec une date exacte`);
  console.log(`   🐄 ${tarieMiseAJour} / ${vachesAMettreAJour.length} vache(s) tarie(s) complétée(s) avec une date exacte`);
  console.log(`   🩹 ${tarieCorrigees} vache(s) dont le statut "tarie" était incorrect et a été corrigé`);
  const restantsSevrage = veauxAMettreAJour.length - sevrageMisAJour;
  const restantsTarie = vachesAMettreAJour.length - tarieMiseAJour;
  if (restantsSevrage > 0 || restantsTarie > 0) {
    console.log(
      `   ⚠️  ${restantsSevrage} sevrage(s) et ${restantsTarie} tarissement(s) restent sans date connue`
    );
    console.log("      (antérieurs à la mise en place du journal d'actions — aucune trace exploitable).");
  }
  console.log("✅ Backfill terminé.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
