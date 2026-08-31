import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { normaliserPattes } from "@/lib/parage";

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

interface VaccinationSession {
  protocoleId: string;
  vaccin: string;
  medicamentId: string;
  voie?: string | null;
  dose?: number | null;
  animaux: Array<{
    animalId: string;
    etapeProtocoleId: string;
    gestationId?: string | null;
    typeInjection?: string | null;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalIds, nutravs, date, moment, categorie, type, symptomes, reponses, temperature, description, photos, constatePar, traitements, parage } = body;
    const vaccinationSession = body.vaccinationSession as VaccinationSession | null | undefined;
    if (!type?.trim() || !date) return NextResponse.json({ error: "type et date requis" }, { status: 400 });

    const symptomesList: { libelle: string; typeEvenementId?: string | null }[] = Array.isArray(symptomes)
      ? symptomes.filter((s: { libelle?: string }) => s?.libelle?.trim()).map((s: { libelle: string; typeEvenementId?: string | null }) => ({ libelle: s.libelle.trim(), typeEvenementId: s.typeEvenementId ?? null }))
      : [];
    const reponsesList: { questionId: string; valeur: string; libelleEnregistre: string }[] = Array.isArray(reponses)
      ? reponses.filter((r: { questionId?: string; valeur?: unknown }) => r?.questionId && r.valeur !== undefined)
      : [];
    const paragePattes = parage ? normaliserPattes(parage.pattes) : [];
    if (parage && paragePattes.length === 0) return NextResponse.json({ error: "Au moins une patte est requise pour le parage" }, { status: 400 });

    let resolvedCategorie: string | null = categorie ?? null;
    const premierTypeId = symptomesList[0]?.typeEvenementId;
    if (!resolvedCategorie && premierTypeId) {
      const premierType = await prisma.typeEvenement.findUnique({ where: { id: premierTypeId }, select: { categorie: true } });
      resolvedCategorie = premierType?.categorie ?? null;
    }

    let ids: string[] = Array.isArray(animalIds) ? [...new Set(animalIds)] as string[] : [];
    if (ids.length === 0 && Array.isArray(nutravs) && nutravs.length > 0) {
      const animaux = await prisma.animal.findMany({ where: { nutrav: { in: nutravs } }, select: { id: true } });
      ids = animaux.map((animal) => animal.id);
    }
    if (ids.length === 0) return NextResponse.json({ error: "animalIds ou nutravs requis" }, { status: 400 });

    let vaccinationConfig: {
      session: VaccinationSession;
      etapes: Array<{ id: string; ordre: number; cycle: string; reference: string; obligatoire: boolean; protocoleId: string }>;
      medicamentNom: string;
    } | null = null;
    if (vaccinationSession) {
      const idsSession = vaccinationSession.animaux.map((animal) => animal.animalId);
      if (idsSession.length === 0 || idsSession.length !== ids.length || ids.some((id) => !idsSession.includes(id))) {
        return NextResponse.json({ error: "La sélection vaccinale ne correspond pas aux animaux de la séance" }, { status: 400 });
      }
      if (!vaccinationSession.protocoleId || !vaccinationSession.medicamentId || vaccinationSession.dose != null && !Number.isFinite(Number(vaccinationSession.dose))) {
        return NextResponse.json({ error: "Contexte vaccinal invalide" }, { status: 400 });
      }
      const gestationIds = vaccinationSession.animaux.map((animal) => animal.gestationId).filter((id): id is string => Boolean(id));
      const [protocole, medicament, gestations] = await Promise.all([
        prisma.protocoleVaccin.findUnique({
          where: { id: vaccinationSession.protocoleId },
          select: { etapes: { select: { id: true, ordre: true, cycle: true, reference: true, obligatoire: true, protocoleId: true, medicaments: { select: { medicamentId: true } } } } },
        }),
        prisma.medicament.findUnique({ where: { id: vaccinationSession.medicamentId }, select: { nom: true } }),
        prisma.gestation.findMany({ where: { id: { in: gestationIds } }, select: { id: true, saillie: { select: { animalId: true } } } }),
      ]);
      if (!protocole || !medicament || vaccinationSession.animaux.some((animal) => {
        const etape = protocole.etapes.find((item) => item.id === animal.etapeProtocoleId);
        const gestationValide = !animal.gestationId || gestations.some((gestation) => gestation.id === animal.gestationId && gestation.saillie.animalId === animal.animalId);
        return !etape || !gestationValide || !etape.medicaments.some((liaison) => liaison.medicamentId === vaccinationSession.medicamentId);
      })) return NextResponse.json({ error: "Étape vaccinale ou médicament invalide" }, { status: 400 });
      vaccinationConfig = { session: vaccinationSession, etapes: protocole.etapes, medicamentNom: medicament.nom };
    }

    const traitementsList: TraitementDraft[] = Array.isArray(traitements)
      ? traitements.filter((traitement: TraitementDraft) => traitement?.medicamentNom?.trim())
      : [];
    const resolvedDate = new Date(date);
    const now = new Date();
    const statutsVaccinauxAvant = vaccinationConfig
      ? await prisma.statutProtocoleVaccinal.findMany({
          where: {
            protocoleId: vaccinationConfig.session.protocoleId,
            animalId: { in: vaccinationConfig.session.animaux.map((animal) => animal.animalId) },
          },
          select: { id: true, animalId: true, statut: true, source: true, confirmeAt: true },
        })
      : [];

    const resultat = await prisma.$transaction(async (tx) => {
      const evenements = await Promise.all(ids.map((animalId) => tx.evenementSanitaire.create({
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
          ...(symptomesList.length > 0 ? { symptomes: { create: symptomesList.map((symptome) => ({ libelle: symptome.libelle, typeEvenementId: symptome.typeEvenementId ?? null })) } } : {}),
          ...(reponsesList.length > 0 ? { reponses: { create: reponsesList.map((reponse) => ({ questionId: reponse.questionId, valeur: reponse.valeur, libelleEnregistre: reponse.libelleEnregistre })) } } : {}),
        },
      })));
      const parAnimal = new Map(evenements.map((evenement) => [evenement.animalId, evenement.id]));
      const traitementsCrees = await Promise.all(traitementsList.flatMap((traitement) => ids.map((animalId) => tx.traitement.create({
        data: {
          animalId,
          evenementId: parAnimal.get(animalId) ?? null,
          medicamentId: traitement.medicamentId || null,
          medicamentNom: traitement.medicamentNom.trim(),
          dateDebut: resolvedDate,
          dureeJours: traitement.doseUnique ? 1 : Math.max(1, traitement.dureeJours ?? 1),
          doseUnique: traitement.doseUnique === true,
          voie: traitement.voie || null,
          frequence: traitement.doseUnique ? null : traitement.frequence || null,
          dose: traitement.doseParAnimal?.[animalId] ?? traitement.dose ?? null,
          uniteDosage: traitement.uniteDosage || null,
          motif: traitement.motif || null,
          executant: traitement.executant || null,
          moment: moment ?? null,
          delaiAttenteViandeJ: traitement.delaiAttenteViandeJ ?? null,
          delaiAttenteLaitJ: traitement.delaiAttenteLaitJ ?? null,
          statut: traitement.doseUnique ? "TERMINE" : "EN_COURS",
        },
        select: { id: true },
      }))));
      const paragesCrees = parage ? await Promise.all(evenements.map((evenement) => tx.parage.create({
        data: { animalId: evenement.animalId, evenementId: evenement.id, date: resolvedDate, motif: parage.motif === "BOITERIE" ? "BOITERIE" : "PARAGE", pattes: JSON.stringify(paragePattes), notes: typeof parage.note === "string" && parage.note.trim() ? parage.note.trim() : null, statut: "A_VOIR" },
        select: { id: true },
      }))) : [];

      const vaccinationsCrees = vaccinationConfig ? await Promise.all(vaccinationConfig.session.animaux.map((animal) => tx.vaccination.create({
        data: {
          animalId: animal.animalId,
          vaccin: vaccinationConfig.medicamentNom,
          date: resolvedDate,
          voie: vaccinationConfig.session.voie?.trim() || null,
          dose: vaccinationConfig.session.dose == null ? null : Number(vaccinationConfig.session.dose),
          medicamentId: vaccinationConfig.session.medicamentId,
          protocoleId: vaccinationConfig.session.protocoleId,
          etapeProtocoleId: animal.etapeProtocoleId,
          gestationId: vaccinationConfig.etapes.find((etape) => etape.id === animal.etapeProtocoleId)?.reference === "VELAGE" ? animal.gestationId || null : null,
          typeInjection: vaccinationConfig.etapes.find((etape) => etape.id === animal.etapeProtocoleId)?.cycle === "ENTRETIEN"
            ? "ENTRETIEN"
            : vaccinationConfig.etapes.filter((etape) => etape.cycle !== "ENTRETIEN").sort((a, b) => a.ordre - b.ordre)[0]?.id === animal.etapeProtocoleId ? "PRIMO_1" : "RAPPEL",
          updatedAt: now,
        },
        select: { id: true, animalId: true },
      }))) : [];

      const statutsVaccinauxModifies: Array<{ id: string; animalId: string }> = [];
      if (vaccinationConfig) {
        for (const animal of vaccinationConfig.session.animaux) {
          const etape = vaccinationConfig.etapes.find((item) => item.id === animal.etapeProtocoleId)!;
          let statut = "PROTOCOLE_ACQUIS";
          if (etape.cycle !== "ENTRETIEN") {
            const initialesRequises = vaccinationConfig.etapes.filter((item) => item.cycle !== "ENTRETIEN" && item.obligatoire).map((item) => item.id);
            const realisees = await tx.vaccination.findMany({ where: { animalId: animal.animalId, protocoleId: vaccinationConfig.session.protocoleId, etapeProtocoleId: { in: initialesRequises } }, select: { etapeProtocoleId: true } });
            statut = initialesRequises.every((id) => realisees.some((vaccination) => vaccination.etapeProtocoleId === id)) ? "PROTOCOLE_ACQUIS" : "PRIMO_EN_COURS";
          }
          const statutModifie = await tx.statutProtocoleVaccinal.upsert({
            where: { animalId_protocoleId: { animalId: animal.animalId, protocoleId: vaccinationConfig.session.protocoleId } },
            create: { animalId: animal.animalId, protocoleId: vaccinationConfig.session.protocoleId, statut, source: "VACCINATION", confirmeAt: now },
            update: { statut, source: "VACCINATION", confirmeAt: now },
            select: { id: true, animalId: true },
          });
          statutsVaccinauxModifies.push(statutModifie);
        }
      }
      return { evenements, traitementsCrees, paragesCrees, vaccinationsCrees, statutsVaccinauxModifies };
    });

    const desc = `Événement sanitaire "${type.trim()}" enregistré pour ${resultat.evenements.length} animal(s)`
      + (resultat.traitementsCrees.length > 0 ? ` avec ${resultat.traitementsCrees.length} traitement(s)` : "")
      + (resultat.vaccinationsCrees.length > 0 ? ` et ${resultat.vaccinationsCrees.length} vaccination(s)` : "")
      + (resultat.paragesCrees.length > 0 ? ` et ${resultat.paragesCrees.length} ajout(s) au parage` : "");
    const statutsVaccinauxRevert = resultat.statutsVaccinauxModifies.map((statutModifie) => {
      const avant = statutsVaccinauxAvant.find((statut) => statut.animalId === statutModifie.animalId);
      return avant
        ? {
            op: "update" as const,
            model: "statutProtocoleVaccinal",
            where: { id: statutModifie.id },
            data: { statut: avant.statut, source: avant.source, confirmeAt: avant.confirmeAt },
          }
        : { op: "delete" as const, model: "statutProtocoleVaccinal", id: statutModifie.id };
    });
    let undoId = "";
    try {
      undoId = await logAction("BATCH_EVENEMENT_SANITAIRE", desc, [
        ...resultat.evenements.map((evenement) => ({ op: "delete" as const, model: "evenementSanitaire", id: evenement.id })),
        ...resultat.traitementsCrees.map((traitement) => ({ op: "delete" as const, model: "traitement", id: traitement.id })),
        ...resultat.vaccinationsCrees.map((vaccination) => ({ op: "delete" as const, model: "vaccination", id: vaccination.id })),
        ...statutsVaccinauxRevert,
        ...resultat.paragesCrees.map((parageCree) => ({ op: "delete" as const, model: "parage", id: parageCree.id })),
      ]);
    } catch {}
    return NextResponse.json({
      count: resultat.evenements.length,
      evenements: resultat.evenements.map((evenement) => ({ id: evenement.id, animalId: evenement.animalId })),
      traitementsCount: resultat.traitementsCrees.length,
      vaccinationsCount: resultat.vaccinationsCrees.length,
      paragesCount: resultat.paragesCrees.length,
      _undoId: undoId,
      _undoDesc: desc,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/evenements/batch error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
