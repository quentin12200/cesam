import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MODES_VALIDES = new Set(["PRIX_KG", "PRIX_TONNE", "PRIX_SAC", "PRIX_BIDON", "AUTRE"]);

function poidsReference(modeVente: string, poidsSaisi: number | null) {
  if (modeVente === "PRIX_KG") return 1;
  if (modeVente === "PRIX_TONNE") return 1000;
  return poidsSaisi;
}

async function getProduits() {
  const produits = await prisma.alimentProduit.findMany({
    include: {
      tarifs: {
        orderBy: [{ dateSaisie: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: { nom: "asc" },
  });

  return produits.map((produit) => ({
    id: produit.id,
    nom: produit.nom,
    tarifs: produit.tarifs.map((tarif) => ({
      ...tarif,
      dateSaisie: tarif.dateSaisie.toISOString(),
      createdAt: tarif.createdAt.toISOString(),
    })),
  }));
}

export async function GET() {
  try {
    return NextResponse.json({ produits: await getProduits() });
  } catch (error) {
    console.error("GET /api/finances/aliments error:", error);
    return NextResponse.json({ error: "Impossible de charger les tarifs." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nom = String(body.nom ?? "").trim();
    const modeVente = String(body.modeVente ?? "");
    const prixPaye = Number(body.prixPaye);
    const poidsSaisi = body.poidsKg === "" || body.poidsKg == null ? null : Number(body.poidsKg);
    const poidsKg = poidsReference(modeVente, poidsSaisi);

    if (!nom) {
      return NextResponse.json({ error: "Le nom du produit est obligatoire." }, { status: 400 });
    }
    if (!MODES_VALIDES.has(modeVente)) {
      return NextResponse.json({ error: "Le mode de vente est invalide." }, { status: 400 });
    }
    if (!Number.isFinite(prixPaye) || prixPaye <= 0) {
      return NextResponse.json({ error: "Le prix payé doit être supérieur à zéro." }, { status: 400 });
    }
    if (poidsKg == null || !Number.isFinite(poidsKg) || poidsKg <= 0) {
      return NextResponse.json({ error: "Le poids du contenant est obligatoire." }, { status: 400 });
    }

    const dateSaisie = new Date(`${body.dateSaisie}T12:00:00.000Z`);
    if (Number.isNaN(dateSaisie.getTime())) {
      return NextResponse.json({ error: "La date est invalide." }, { status: 400 });
    }

    const produitsExistants = await prisma.alimentProduit.findMany({
      select: { id: true, nom: true },
    });
    const existant = produitsExistants.find(
      (produit) => produit.nom.localeCompare(nom, "fr", { sensitivity: "base" }) === 0
    );
    const produit = existant
      ? existant
      : await prisma.alimentProduit.create({ data: { nom } });

    await prisma.tarifAliment.create({
      data: {
        produitId: produit.id,
        dateSaisie,
        modeVente,
        prixPaye,
        poidsKg,
        prixKg: prixPaye / poidsKg,
        fournisseur: String(body.fournisseur ?? "").trim() || null,
        marque: String(body.marque ?? "").trim() || null,
        conditionnement: String(body.conditionnement ?? "").trim() || null,
        note: String(body.note ?? "").trim() || null,
      },
    });

    return NextResponse.json({ produits: await getProduits() }, { status: 201 });
  } catch (error) {
    console.error("POST /api/finances/aliments error:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer ce tarif." }, { status: 500 });
  }
}
