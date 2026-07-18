import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { normaliserPattes } from "@/lib/parage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalIds, nutravs, date, moment, categorie, type, symptomes, reponses, temperature, description, photos, constatePar, traitements, parage } = body;

    if (!type?.trim() || !date) {
      return NextResponse.json({ error: "type et date requis" }, { status: 400 });
    }

    const symptomesList: { libelle: string; typeEvenementId?: string | null }[] = Array.isArray(symptomes)
      ? symptomes
          .filter((s: { libelle?: string }) => s?.libelle?.trim())
          .map((s: { libelle: string; typeEvenementId?: string | null }) => ({ libelle: s.libelle.trim(), typeEvenementId: s.typeEvenementId ?? null }))
      : [];

    const reponsesList: { questionId: string; valeur: string; libelleEnregistre: string }[] = Array.isArray(reponses)
      ? reponses.filter((r: { questionId?: string; valeur?: unknown }) => r?.questionId && r.valeur !== undefined)
      : [];

    const paragePattes = parage ? normaliserPattes(parage.pattes) : [];
    if (parage && paragePattes.length === 0) {
      return NextResponse.json({ error: "Au moins une patte est requise pour le parage" }, { status: 400 });
    }

    let resolvedCategorie: string | null = categorie ?? null;
    const premierTypeId = symptomesList[0]?.typeEvenementId;
    if (!resolvedCategorie && premierTypeId) {
      const premierType = await prisma.typeEvenement.findUnique({ where: { id: premierTypeId }, select: { categorie: true } });
      resolvedCategorie = premierType?.categorie ?? null;
    }

    let ids: string[] = Array.isArray(animalIds) ? animalIds : [];
    if (ids.length === 0 && Array.isArray(nutravs) && nutravs.length > 0) {
      const animaux = await prisma.animal.findMany({
        where: { nutrav: { in: nutravs } },
        select: { id: true },
      });
      ids = animaux.map((a) => a.id);
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: "animalIds ou nutravs requis" }, { status: 400 });
    }

    const resolvedDate = new Date(date);
    const now = new Date();

    const evenements = await Promise.all(
      ids.map((animalId: string) =>
        prisma.evenementSanitaire.create({
          data: {
            animalId,
            categorie: resolvedCategorie,
            type: type.trim(),
            date: resolvedDate,
            moment: moment ?? null,
            temperature: temperature != null && temperature !== "" ? Number(temperature) : null,
            description: description?.trim() || null,
            photos: photos ?? null,
            constatePar: constatePar?.trim() || null,
            updatedAt: now,
            ...(symptomesList.length > 0
              ? { symptomes: { create: symptomesList.map((s) => ({ libelle: s.libelle, typeEvenementId: s.typeEvenementId ?? null })) } }
              : {}),
            ...(reponsesList.length > 0
              ? { reponses: { create: reponsesList.map((r) => ({ questionId: r.questionId, valeur: r.valeur, libelleEnregistre: r.libelleEnregistre })) } }
              : {}),
          },
        })
      )
    );

    // Traitement(s) optionnel(s), créés dans la même opération que l'événement :
    // un traitement s'applique à tous les animaux ciblés, lié à l'événement propre à chacun.
    interface TraitementDraft {
      medicamentId?: string | null;
      medicamentNom: string;
      voie?: string | null;
      executant?: string | null;
      dose?: number | null;
      doseParAnimal?: Record<string, number | null>;
      uniteDosage?: string | null;
      frequence?: string | null;
      dureeJours?: number | null;
      doseUnique?: boolean;
      motif?: string | null;
      delaiAttenteViandeJ?: number | null;
      delaiAttenteLaitJ?: number | null;
    }
    const traitementsList: TraitementDraft[] = Array.isArray(traitements)
      ? traitements.filter((t: TraitementDraft) => t?.medicamentNom?.trim())
      : [];

    let traitementsCrees: { id: string }[] = [];
    if (traitementsList.length > 0) {
      const parAnimal = new Map(evenements.map((e) => [e.animalId, e.id]));
      traitementsCrees = await Promise.all(
        traitementsList.flatMap((t) =>
          ids.map((animalId) =>
            prisma.traitement.create({
              data: {
                animalId,
                evenementId: parAnimal.get(animalId) ?? null,
                medicamentId: t.medicamentId || null,
                medicamentNom: t.medicamentNom.trim(),
                dateDebut: resolvedDate,
                dureeJours: t.doseUnique ? 1 : Math.max(1, t.dureeJours ?? 1),
                doseUnique: t.doseUnique === true,
                voie: t.voie || null,
                frequence: t.frequence || null,
                dose: t.doseParAnimal?.[animalId] ?? t.dose ?? null,
                uniteDosage: t.uniteDosage || null,
                motif: t.motif || null,
                executant: t.executant || null,
                moment: moment ?? null,
                delaiAttenteViandeJ: t.delaiAttenteViandeJ ?? null,
                delaiAttenteLaitJ: t.delaiAttenteLaitJ ?? null,
                statut: t.doseUnique ? "TERMINE" : "EN_COURS",
              },
              select: { id: true },
            })
          )
        )
      );
    }

    let paragesCrees: { id: string }[] = [];
    if (parage) {
      paragesCrees = await Promise.all(
        evenements.map((evenement) =>
          prisma.parage.create({
            data: {
              animalId: evenement.animalId,
              evenementId: evenement.id,
              date: resolvedDate,
              motif: parage.motif === "BOITERIE" ? "BOITERIE" : "PARAGE",
              pattes: JSON.stringify(paragePattes),
              notes: typeof parage.note === "string" && parage.note.trim() ? parage.note.trim() : null,
              statut: "A_VOIR",
            },
            select: { id: true },
          })
        )
      );
    }

    const desc = `Événement sanitaire "${type.trim()}" enregistré pour ${evenements.length} animal(s)`
      + (traitementsCrees.length > 0 ? ` avec ${traitementsCrees.length} traitement(s)` : "")
      + (paragesCrees.length > 0 ? ` et ${paragesCrees.length} ajout(s) au parage` : "");
    let undoId = "";
    try {
      undoId = await logAction(
        "BATCH_EVENEMENT_SANITAIRE",
        desc,
        [
          ...evenements.map((e) => ({ op: "delete" as const, model: "evenementSanitaire", id: e.id })),
          ...traitementsCrees.map((t) => ({ op: "delete" as const, model: "traitement", id: t.id })),
          ...paragesCrees.map((p) => ({ op: "delete" as const, model: "parage", id: p.id })),
        ]
      );
    } catch {}

    return NextResponse.json({
      count: evenements.length,
      evenements: evenements.map((e) => ({ id: e.id, animalId: e.animalId })),
      traitementsCount: traitementsCrees.length,
      paragesCount: paragesCrees.length,
      _undoId: undoId,
      _undoDesc: desc,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/evenements/batch error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
