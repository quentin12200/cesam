import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { normalizeGenealogyNational } from "@/lib/animal-genealogy-data";
import { nationalWithCountry, canonicalName, fullNational } from "@/lib/bull-identity";

export async function GET() {
  const taureaux = await prisma.taureau.findMany({
    select: { id: true, nupere: true, nopere: true, present: true, traper: true },
    orderBy: { nopere: "asc" },
  });

  return NextResponse.json({ taureaux });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nupere, nopere, traper, present } = body;

    if (!nupere?.trim()) {
      return NextResponse.json({ error: "Le numéro du taureau est requis" }, { status: 400 });
    }

    const normalized = normalizeGenealogyNational(nupere.trim());
    const candidates = await prisma.taureau.findMany({
      where: {
        OR: [
          { nupere: { contains: normalized } },
          { nupere: { contains: normalized.slice(-Math.min(8, normalized.length)) } },
        ],
      },
      select: { id: true, nupere: true, nopere: true },
    });
    const existing = candidates.find(
      (candidate) => normalizeGenealogyNational(candidate.nupere) === normalized,
    );
    if (existing) {
      return NextResponse.json({
        error: `Ce reproducteur existe déjà sous le numéro ${existing.nupere}${existing.nopere ? ` (${existing.nopere})` : ""}. Sélectionne sa fiche existante.`,
      }, { status: 409 });
    }

    // Une simple référence nominale (ex. ARGUS) ne doit jamais créer une
    // deuxième fiche si le même nom existe sous un numéro national complet.
    // L'utilisateur doit sélectionner la fiche existante, sans rapprochement
    // automatique sur un nom qui peut être partagé par plusieurs taureaux.
    if (!fullNational(nupere.trim())) {
      const enteredName = canonicalName(nopere?.trim() || nupere.trim());
      if (enteredName) {
        const all = await prisma.taureau.findMany({
          select: { id: true, nupere: true, nopere: true },
        });
        const sameNames = all.filter((bull) =>
          canonicalName(bull.nopere) === enteredName ||
          canonicalName(bull.nupere) === enteredName
        );
        if (sameNames.length > 0) {
          return NextResponse.json({
            error: `Un reproducteur portant ce nom existe déjà (${sameNames.map((b) => b.nupere).join(", ")}). Sélectionne sa fiche avant d'enregistrer l'IA ; aucune nouvelle fiche n'a été créée.`,
          }, { status: 409 });
        }
      }
    }

    const taureau = await prisma.taureau.create({
      data: {
        nupere: nationalWithCountry(nupere.trim()),
        nopere: nopere?.trim() || null,
        traper: traper?.trim() || null,
        present: present !== false,
        updatedAt: new Date(),
      },
    });

    const desc = `Taureau ${taureau.nopere ?? taureau.nupere} ajouté`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_TAUREAU", desc, { op: "delete", model: "taureau", id: taureau.id });
    } catch {}

    return NextResponse.json({ ...taureau, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/taureaux error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}


// Une correction de nom est possible sans toucher aux liens biologiques.
// Changer un identifiant national lié à des animaux nécessite un audit séparé.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const name = typeof body?.nopere === "string" ? body.nopere.trim() : null;
    if (!id || name === null || name.length > 120) {
      return NextResponse.json({ error: "Identifiant ou nom invalide." }, { status: 400 });
    }
    const bull = await prisma.taureau.findUnique({ where: { id } });
    if (!bull) return NextResponse.json({ error: "Taureau introuvable." }, { status: 404 });
    const updated = await prisma.taureau.update({ where: { id }, data: { nopere: name || null } });
    try {
      await logAction("PATCH_TAUREAU_NOM", `Nom du taureau ${bull.nupere} modifié`, {
        op: "update", model: "taureau", where: { id }, data: { nopere: bull.nopere },
      });
    } catch {}
    return NextResponse.json({ ok: true, taureau: updated });
  } catch {
    return NextResponse.json({ error: "Correction impossible." }, { status: 500 });
  }
}

async function referencesForBull(bull: { id: string; nupere: string }) {
  const normalized = normalizeGenealogyNational(bull.nupere);
  const suffix = normalized.slice(-Math.min(normalized.length, 8));
  const [animals, breedings, manual, calvings] = await Promise.all([
    prisma.animal.count({ where: { taureauId: bull.id } }),
    prisma.saillie.count({ where: { taureauId: bull.id } }),
    prisma.animal.findMany({ where: { pereNationalManuel: { contains: suffix } }, select: { pereNationalManuel: true } }),
    prisma.velage.findMany({ where: { pereNunati: { contains: suffix } }, select: { pereNunati: true } }),
  ]);
  return {
    animals, breedings,
    manual: manual.filter((item) => normalizeGenealogyNational(item.pereNationalManuel) === normalized).length,
    calvings: calvings.filter((item) => normalizeGenealogyNational(item.pereNunati) === normalized).length,
  };
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const bull = await prisma.taureau.findUnique({ where: { id } });
    if (!bull) return NextResponse.json({ error: "Taureau non trouvé" }, { status: 404 });
    const refs = await referencesForBull(bull);
    const total = refs.animals + refs.breedings + refs.manual + refs.calvings;
    if (total > 0) {
      return NextResponse.json({
        error: `Suppression refusée : ${refs.animals} lien(s) animal, ${refs.breedings} saillie(s), ${refs.manual} référence(s) manuelle(s) et ${refs.calvings} vêlage(s). Corrige ou fusionne d'abord les références.`,
        references: refs,
      }, { status: 409 });
    }
    await prisma.taureau.delete({ where: { id } });
    try {
      await logAction("DELETE_TAUREAU", `Taureau ${bull.nopere ?? bull.nupere} supprimé`, {
        op: "create", model: "taureau",
        data: { id: bull.id, nupere: bull.nupere, nopere: bull.nopere, traper: bull.traper, present: bull.present, updatedAt: new Date() },
      });
    } catch {}
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Suppression impossible. Vérifie les liens existants." }, { status: 409 });
  }
}
