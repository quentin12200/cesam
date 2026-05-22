const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const adapter = new PrismaLibSql({ url: "file:///home/user/cesam/dev.db" });
const prisma = new PrismaClient({ adapter });

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

async function main() {
  console.log("🌱 Début du seed...");

  for (let i = 1; i <= 4; i++) {
    await prisma.capteurVelage.upsert({
      where: { numero: i },
      update: {},
      create: { numero: i, actif: false, updatedAt: new Date() },
    });
  }

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

  const csvPath = path.join(process.cwd(), "82147069FR82147069IP.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((l) => l.trim() !== "");
  const headers = lines[0].split(";");

  const taureaux = new Map();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row = {};
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

  const animalMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row = {};
    headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ""));

    if (!row.NUNATI || !row.NUTRAV) continue;

    const danais = parseDate(row.DANAIS);
    if (!danais) continue;

    const taureauId = row.NUPERE ? taureaux.get(row.NUPERE) : null;
    const estSorti = row.CAUSSO && row.CAUSSO !== "";
    const statut = estSorti ? "SORTI" : "ACTIF";
    const estGenisse = row.SEXBOV === "F" && danais > new Date("2022-01-01");

    const nutrav = row.NUTRAV.toString().padStart(4, "0");

    try {
      const animal = await prisma.animal.upsert({
        where: { nunati: row.NUNATI },
        update: {},
        create: {
          copaip: row.COPAIP || "FR",
          nunati: row.NUNATI,
          nutrav,
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
    } catch (e) {
      console.error(`Erreur animal ${row.NUNATI}:`, e.message);
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row = {};
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
