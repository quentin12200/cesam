// Script à exécuter une seule fois pour insérer les stats historiques depuis l'Excel
// Usage: npx tsx scripts/seed-stats-historiques.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const historiques = [
  { annee: 2021, veauxCount: 37, veauxKgTotal: 15682, veauxPrixMoyen: 2.96, veauxCA: 46337, vachesCount: 9, vachesKgCarcasse: 4550, vachesPrixMoyen: 4.16, vachesCA: 18943, velagesCount: 0 },
  { annee: 2022, veauxCount: 46, veauxKgTotal: 19343, veauxPrixMoyen: 3.34, veauxCA: 64598, vachesCount: 10, vachesKgCarcasse: 4901, vachesPrixMoyen: 4.99, vachesCA: 24652, velagesCount: 0 },
  { annee: 2023, veauxCount: 17, veauxKgTotal: 6919, veauxPrixMoyen: 3.59, veauxCA: 25425, vachesCount: 2, vachesKgCarcasse: 957, vachesPrixMoyen: 5.35, vachesCA: 5131, velagesCount: 0 },
  { annee: 2024, veauxCount: 48, veauxKgTotal: 21260, veauxPrixMoyen: 3.97, veauxCA: 85850, vachesCount: 9, vachesKgCarcasse: 4552, vachesPrixMoyen: 5.91, vachesCA: 26952, velagesCount: 0 },
  { annee: 2025, veauxCount: 43, veauxKgTotal: 18887, veauxPrixMoyen: 5.61, veauxCA: 106135, vachesCount: 4, vachesKgCarcasse: 1909, vachesPrixMoyen: 6.38, vachesCA: 12200, velagesCount: 0 },
];

async function main() {
  for (const h of historiques) {
    await prisma.statsAnnuelle.upsert({
      where: { annee: h.annee },
      create: { id: `hist-${h.annee}`, ...h, updatedAt: new Date() },
      update: { ...h, updatedAt: new Date() },
    });
    console.log(`✓ ${h.annee}: ${h.veauxCount} veaux CA=${h.veauxCA}€ | ${h.vachesCount} vaches CA=${h.vachesCA}€`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
