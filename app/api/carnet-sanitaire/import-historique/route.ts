import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseSemicolonCsv } from "@/lib/csv";

const VACCIN_PRODUCTS = new Set([
  "BOVILIS CRYPTIUM",
  "NASALGEN",
  "NASIM",
  "HIPRABOVIS SOMNI",
  "ROTAVEC CORONA",
  "HEPIZOVAC - MHE",
  "BULTAVO 3 (FCO3)",
]);

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function parseFrDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function parseDose(s: string): { dose: number | null; unite: string | null } {
  const m = s.trim().match(/^([\d.,]+)\s*(\S+)?/);
  if (!m) return { dose: null, unite: null };
  const dose = parseFloat(m[1].replace(",", "."));
  return { dose: Number.isFinite(dose) ? dose : null, unite: m[2] ?? null };
}

interface Row {
  dateDebut: Date;
  dateFin: Date;
  national: string;
  ordonnanceNumero: string | null;
  prescripteur: string | null;
  produit: string;
  dose: number | null;
  uniteDosage: string | null;
  voie: string | null;
  motif: string | null;
}

export async function POST() {
  const csvPath = path.join(process.cwd(), "data", "carnet-sanitaire-import.csv");
  let raw: string;
  try {
    raw = fs.readFileSync(csvPath, "utf8");
  } catch {
    return NextResponse.json({ error: "Fichier d'import introuvable" }, { status: 404 });
  }

  const rows = parseSemicolonCsv(raw);
  const dataRows = rows.slice(1);

  const parsed: Row[] = [];
  for (const r of dataRows) {
    const dateDebut = parseFrDate(r[0] ?? "");
    const dateFinRaw = parseFrDate(r[2] ?? "");
    const national = digitsOnly(r[4] ?? "");
    const produit = (r[9] ?? "").trim();
    if (!dateDebut || !national || !produit) continue;
    const { dose, unite } = parseDose(r[11] ?? "");
    parsed.push({
      dateDebut,
      dateFin: dateFinRaw && dateFinRaw >= dateDebut ? dateFinRaw : dateDebut,
      national,
      ordonnanceNumero: r[7]?.trim() || null,
      prescripteur: r[8]?.trim() || null,
      produit,
      dose,
      uniteDosage: unite,
      voie: r[12]?.trim() || null,
      motif: r[14]?.trim() && r[14].trim() !== ";" ? r[14].trim() : null,
    });
  }

  const [animaux, existingTraitements, existingVaccinations] = await Promise.all([
    prisma.animal.findMany({ select: { id: true, nunati: true } }),
    prisma.traitement.findMany({ select: { id: true, animalId: true, dateDebut: true, medicamentNom: true, ordonnanceNumero: true } }),
    prisma.vaccination.findMany({ select: { id: true, animalId: true, date: true, vaccin: true, ordonnanceNumero: true } }),
  ]);
  const animalByNational = new Map(animaux.map((a) => [digitsOnly(a.nunati), a.id]));

  let traitementsCrees = 0;
  let vaccinationsCreees = 0;
  let ordonnanceCompletee = 0;
  let dejaPresent = 0;
  let animalIntrouvable = 0;
  const animalIntrouvableSample: string[] = [];

  for (const row of parsed) {
    const animalId = animalByNational.get(row.national);
    if (!animalId) {
      animalIntrouvable++;
      if (animalIntrouvableSample.length < 20) {
        animalIntrouvableSample.push(`${row.produit} du ${row.dateDebut.toLocaleDateString("fr-FR")} (animal ${row.national})`);
      }
      continue;
    }

    const produitUpper = row.produit.toUpperCase();
    const isVaccin = VACCIN_PRODUCTS.has(produitUpper);

    if (isVaccin) {
      const existing = existingVaccinations.find((v) =>
        v.animalId === animalId && sameDay(new Date(v.date), row.dateDebut) && v.vaccin.toUpperCase() === produitUpper
      );
      if (existing) {
        dejaPresent++;
        if (row.ordonnanceNumero && !existing.ordonnanceNumero) {
          await prisma.vaccination.update({ where: { id: existing.id }, data: { ordonnanceNumero: row.ordonnanceNumero } });
          existing.ordonnanceNumero = row.ordonnanceNumero;
          ordonnanceCompletee++;
        }
        continue;
      }
      const created = await prisma.vaccination.create({
        data: {
          animalId,
          vaccin: row.produit,
          date: row.dateDebut,
          voie: row.voie,
          dose: row.dose,
          ordonnanceNumero: row.ordonnanceNumero,
          notes: row.prescripteur ? `Prescripteur : ${row.prescripteur}` : null,
        },
      });
      existingVaccinations.push({ id: created.id, animalId, date: row.dateDebut, vaccin: row.produit, ordonnanceNumero: row.ordonnanceNumero });
      vaccinationsCreees++;
    } else {
      const existing = existingTraitements.find((t) =>
        t.animalId === animalId && sameDay(new Date(t.dateDebut), row.dateDebut) && t.medicamentNom.toUpperCase() === produitUpper
      );
      if (existing) {
        dejaPresent++;
        if (row.ordonnanceNumero && !existing.ordonnanceNumero) {
          await prisma.traitement.update({ where: { id: existing.id }, data: { ordonnanceNumero: row.ordonnanceNumero } });
          existing.ordonnanceNumero = row.ordonnanceNumero;
          ordonnanceCompletee++;
        }
        continue;
      }
      const dureeJours = Math.max(1, diffDays(row.dateFin, row.dateDebut) + 1);
      const created = await prisma.traitement.create({
        data: {
          animalId,
          medicamentNom: row.produit,
          dateDebut: row.dateDebut,
          dureeJours,
          voie: row.voie,
          dose: row.dose,
          uniteDosage: row.uniteDosage,
          motif: row.motif,
          veterinaire: row.prescripteur,
          ordonnanceNumero: row.ordonnanceNumero,
          statut: "TERMINE",
        },
      });
      existingTraitements.push({ id: created.id, animalId, dateDebut: row.dateDebut, medicamentNom: row.produit, ordonnanceNumero: row.ordonnanceNumero });
      traitementsCrees++;
    }
  }

  return NextResponse.json({
    totalLignes: parsed.length,
    traitementsCrees,
    vaccinationsCreees,
    ordonnanceCompletee,
    dejaPresent,
    animalIntrouvable,
    animalIntrouvableSample,
  });
}
