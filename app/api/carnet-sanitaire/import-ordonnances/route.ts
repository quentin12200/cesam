import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseSemicolonCsv } from "@/lib/csv";

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

interface CandidateRow {
  date: Date;
  national: string;
  ordonnanceNumero: string;
  produit: string;
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

  const candidates: CandidateRow[] = [];
  for (const r of dataRows) {
    const ordonnanceNumero = r[7]?.trim();
    if (!ordonnanceNumero) continue;
    const date = parseFrDate(r[0] ?? "");
    const national = digitsOnly(r[4] ?? "");
    const produit = (r[9] ?? "").trim();
    if (!date || !national || !produit) continue;
    candidates.push({ date, national, ordonnanceNumero, produit });
  }

  const [animaux, traitements, vaccinations] = await Promise.all([
    prisma.animal.findMany({ select: { id: true, nunati: true } }),
    prisma.traitement.findMany({ select: { id: true, animalId: true, dateDebut: true, medicamentNom: true, ordonnanceNumero: true } }),
    prisma.vaccination.findMany({ select: { id: true, animalId: true, date: true, vaccin: true } }),
  ]);

  const animalByNational = new Map(animaux.map((a) => [digitsOnly(a.nunati), a.id]));

  let updated = 0;
  let alreadySet = 0;
  let matchedVaccination = 0;
  let unmatched = 0;
  const unmatchedSample: string[] = [];

  for (const row of candidates) {
    const animalId = animalByNational.get(row.national);
    if (!animalId) {
      unmatched++;
      if (unmatchedSample.length < 20) unmatchedSample.push(`N° National ${row.national} introuvable — ${row.produit} du ${row.date.toLocaleDateString("fr-FR")}`);
      continue;
    }

    const produitUpper = row.produit.toUpperCase();
    const t = traitements.find((t) =>
      t.animalId === animalId &&
      sameDay(new Date(t.dateDebut), row.date) &&
      (t.medicamentNom.toUpperCase() === produitUpper ||
        t.medicamentNom.toUpperCase().includes(produitUpper) ||
        produitUpper.includes(t.medicamentNom.toUpperCase()))
    );

    if (t) {
      if (t.ordonnanceNumero) {
        alreadySet++;
      } else {
        await prisma.traitement.update({ where: { id: t.id }, data: { ordonnanceNumero: row.ordonnanceNumero } });
        t.ordonnanceNumero = row.ordonnanceNumero;
        updated++;
      }
      continue;
    }

    const v = vaccinations.find((v) =>
      v.animalId === animalId &&
      sameDay(new Date(v.date), row.date) &&
      (v.vaccin.toUpperCase() === produitUpper ||
        v.vaccin.toUpperCase().includes(produitUpper) ||
        produitUpper.includes(v.vaccin.toUpperCase()))
    );
    if (v) {
      matchedVaccination++;
      continue;
    }

    unmatched++;
    if (unmatchedSample.length < 20) unmatchedSample.push(`${row.produit} du ${row.date.toLocaleDateString("fr-FR")} (animal ${row.national})`);
  }

  return NextResponse.json({
    totalCandidateRows: candidates.length,
    updated,
    alreadySet,
    matchedVaccination,
    unmatched,
    unmatchedSample,
  });
}
