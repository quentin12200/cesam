import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import type { RevertStep } from "../lib/action-log";

// Script à lancer une seule fois (manuellement) pour retrouver, à partir de
// l'historique des actions (ActionLog), la date exacte des sevrages/tarissements
// déjà effectués AVANT l'ajout des champs dateSevrage/dateTarie.
//
// Usage : npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-sevrage-dates.ts
// (nécessite DATABASE_URL / TURSO_AUTH_TOKEN comme pour le seed)
//
// Ne touche que les lignes où dateSevrage/dateTarie est encore NULL : sans effet
// si relancé, et n'écrase jamais une date déjà connue.

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

  console.log("\n📊 Résumé du backfill :");
  console.log(`   🍼 ${sevrageMisAJour} / ${veauxAMettreAJour.length} veau(x) sevré(s) complété(s) avec une date exacte`);
  console.log(`   🐄 ${tarieMiseAJour} / ${vachesAMettreAJour.length} vache(s) tarie(s) complétée(s) avec une date exacte`);
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
