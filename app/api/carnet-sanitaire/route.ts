import { NextRequest, NextResponse } from "next/server";
import { getCarnetSanitaireRows, groupRowsByAnimal, type CarnetSanitaireRow } from "@/lib/carnet-sanitaire";

function fmt(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR");
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsvRow(r: CarnetSanitaireRow): string {
  return [
    fmt(r.date),
    r.animalNational,
    r.animalNutrav,
    r.animalNom ?? "",
    r.ordonnanceNumero ?? "",
    r.prescripteur ?? "",
    r.produit,
    r.dose,
    r.voie ?? "",
    r.motif ?? "",
    fmt(r.dateRemiseLait),
    fmt(r.dateRemiseViande),
  ].map(csvEscape).join(";");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const order = searchParams.get("order") === "animal" ? "animal" : "chrono";

  const rows = await getCarnetSanitaireRows();
  const orderedRows = order === "animal"
    ? groupRowsByAnimal(rows).flatMap((g) => g.rows)
    : rows;

  const header = [
    "Date", "N° National", "N° Travail", "Nom", "N° ordonnance", "Prescripteur",
    "Produit", "Dose", "Voie", "Motif", "Date remise en vente lait", "Date remise en vente viande",
  ].map(csvEscape).join(";");

  const csv = "﻿" + [header, ...orderedRows.map(toCsvRow)].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="carnet-sanitaire-${order}.csv"`,
    },
  });
}
