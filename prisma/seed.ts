import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const libsql = createClient({ url: "file:./prisma/dev.db" });
const adapter = new PrismaLibSql(libsql);
const prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const [day, month, year] = dateStr.split("/");
  if (!day || !month || !year) return null;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

async function main() {
  console.log("🌱 Début du seed...");

  // Initialiser les 4 capteurs
  for (let i = 1; i <= 4; i++) {
    await prisma.capteurVelage.upsert({
      where: { numero: i },
      update: {},
      create: { numero: i, actif: false, updatedAt: new Date() },
    });
  }

  // Localisations par défaut
  const localisations = [
    { nom: "Vialette", type: "PRE" },
    { nom: "Tour Ronde", type: "PRE" },
    { nom: "Préonde", type: "PRE" },
    { nom: "Vieille stabulation", type: "BATIMENT" },
    { nom: "Nouvelle stabulation", type: "BATIMENT" },
    { nom: "Chez Jacques", type: "EXTERNE" },
  ];
  for (const loc of localisations) {
    await prisma.localisation.upsert({
      where: { nom: loc.nom },
      update: {},
      create: loc,
    });
  }

  // Lire le CSV
  const csvPath = path.join(process.cwd(), "82147069FR82147069IP.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((l) => l.trim() !== "");
  const headers = lines[0].split(";");

  const taureaux = new Map<string, string>(); // nupere -> id

  // Première passe : créer les taureaux
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ""));

    if (row.NUPERE && !taureaux.has(row.NUPERE)) {
      const taureau = await prisma.taureau.upsert({
        where: { nupere: row.NUPERE },
        update: {},
        create: {
          copaip: row.COPAPE || "FR",
          nupere: row.NUPERE,
          nopere: row.NOPERE || null,
          traper: row.TRAPER || null,
          present: false,
          updatedAt: new Date(),
        },
      });
      taureaux.set(row.NUPERE, taureau.id);
    }
  }

  // Deuxième passe : créer les animaux
  const animalMap = new Map<string, string>(); // nunati -> id

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ""));

    if (!row.NUNATI || !row.NUTRAV) continue;

    const danais = parseDate(row.DANAIS);
    if (!danais) continue;

    const taureauId = row.NUPERE ? taureaux.get(row.NUPERE) : undefined;

    // Déterminer si c'est une vache ou un veau
    // TYRASU: 79 = race, CAUSEN: motif entrée, DATEEN: date entrée
    // Si CAUSSO (motif sortie) est vide et DATESO est vide → actif
    const estSorti = row.CAUSSO && row.CAUSSO !== "";
    const statut = estSorti ? "SORTI" : "ACTIF";

    // Génisses : femelles nées après 2022 sans vélage connu
    const estGenisse = row.SEXBOV === "F" && danais > new Date("2022-01-01");

    const animal = await prisma.animal.upsert({
      where: { nunati: row.NUNATI },
      update: {},
      create: {
        copaip: row.COPAIP || "FR",
        nunati: row.NUNATI,
        nutrav: row.NUTRAV.padStart(4, "0"),
        nobovi: row.NOBOVI || null,
        danais,
        sexbov: row.SEXBOV || "F",
        statut,
        estGenisse,
        copami: row.COPAMI || null,
        numeip: row.NUMEIP || null,
        nomeip: row.NOMEIP || null,
        tramip: row.TRAMIP || null,
        taureauId: taureauId || null,
        updatedAt: new Date(),
      },
    });

    animalMap.set(row.NUNATI, animal.id);
  }

  // Troisième passe : lier les mères
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ""));

    if (!row.NUNATI || !row.NUMEIP) continue;

    const animalId = animalMap.get(row.NUNATI);
    const mereId = animalMap.get(row.NUMEIP);

    if (animalId && mereId) {
      await prisma.animal.update({
        where: { id: animalId },
        data: { mereId },
      });
    }
  }

  const totalAnimaux = await prisma.animal.count();
  const totalTaureaux = await prisma.taureau.count();
  console.log(`✅ ${totalAnimaux} animaux importés`);
  console.log(`✅ ${totalTaureaux} taureaux créés`);
  console.log("✅ 4 capteurs initialisés");
  console.log("✅ Localisations créées");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
