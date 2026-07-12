import { NextRequest, NextResponse } from "next/server";
import { getEvenementsCarnetRows, groupEvenementsByAnimal, type EvenementCarnetRow } from "@/lib/carnet-sanitaire";
import { getCategorieLabel } from "@/lib/evenements-sanitaires";

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsvRow(r: EvenementCarnetRow): string {
  return [
    fmt(r.date),
    r.moment ?? "",
    r.animalNutrav,
    r.animalNom ?? "",
    getCategorieLabel(r.categorie),
    r.symptomes.length > 1 ? r.symptomes.join(" • ") : r.type,
    r.temperature != null ? String(r.temperature) : "",
    r.description ?? "",
    r.constatePar ?? "",
    r.resolu ? "Résolu" : "En cours",
  ].map(csvEscape).join(";");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const order = searchParams.get("order") === "animal" ? "animal" : "chrono";

  const rows = await getEvenementsCarnetRows();
  const orderedRows = order === "animal"
    ? groupEvenementsByAnimal(rows).flatMap((g) => g.rows)
    : rows;

  const header = [
    "Date", "Moment", "N° Travail", "Nom", "Catégorie", "Événement", "Température", "Commentaire", "Constaté par", "Statut",
  ].map(csvEscape).join(";");

  const csv = "﻿" + [header, ...orderedRows.map(toCsvRow)].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="evenements-sanitaires-${order}.csv"`,
    },
  });
}
