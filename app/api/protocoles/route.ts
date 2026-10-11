import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROTOCOLES } from "@/lib/utils";
import { logAction } from "@/lib/action-log";
import { brancheInitialeDepuisActes, etapeIdsConfigurationQuestionnaire, lireConfigurationQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";
import { referencesPharmacieValides } from "@/lib/vaccine-protocol-validation";
import { preparerConversionProtocole } from "@/lib/vaccine-protocol-name";
import { planifierExtractionVaccin, resoudreLegacyParMedicament } from "@/lib/vaccine-protocol-extraction";
import { statutDepuisEtapesFaites } from "@/lib/vaccine-statut";

function cibleErreurUniqueContientNom(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const target = (meta as { target?: unknown }).target;
  return Array.isArray(target)
    ? target.some((champ) => champ === "nom")
    : typeof target === "string" && target.includes("nom");
}

function normaliserNomInterne(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

class ExtractionVaccinRefusee extends Error {}

function nomInterneLegacy(nom: string, id: string): string {
  const suffixe = `_LEGACY_${normaliserNomInterne(id)}`;
  return nom.endsWith(suffixe) ? nom : `${nom}${suffixe}`;
}

export async function GET() {
  let protocoles = await prisma.protocoleVaccin.findMany({
    orderBy: { ordre: "asc" },
    include: { etapes: { include: { medicaments: { include: { medicament: true } } }, orderBy: { ordre: "asc" } } },
  });

  // Seed defaults if table is empty
  if (protocoles.length === 0) {
    await prisma.protocoleVaccin.createMany({
      data: DEFAULT_PROTOCOLES.map((p) => ({
        id: p.id,
        nom: p.nom,
        label: p.label,
        ordre: p.ordre,
        ageMinJours: p.ageMinJours,
        urgenceJours: p.urgenceJours,
        estRappel: p.estRappel,
        primoNom: p.primoNom,
        delaiRappelJours: p.delaiRappelJours,
        urgenceRappelJours: p.urgenceRappelJours,
        obligatoireVente: p.obligatoireVente,
        actif: p.actif,
      })),
    });
    protocoles = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" }, include: { etapes: { include: { medicaments: { include: { medicament: true } } }, orderBy: { ordre: "asc" } } } });
  }

  return NextResponse.json(protocoles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, label, ordre, ageMinJours, ageMaxJours, urgenceJours, estRappel, primoNom, delaiRappelJours, urgenceRappelJours, obligatoireVente, description, categories, sexeCible, stadeReproduction, gestante, rangVelageMin, rangVelageMax, lotCible, etapes, configurationQuestionnaire, extraireDepuisProtocoleId } = body;
  if (!nom?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "nom et label requis" }, { status: 400 });
  }
  const configurationJson = configurationQuestionnaire == null ? null : JSON.stringify(configurationQuestionnaire);
  const configuration = lireConfigurationQuestionnaire(configurationJson);
  if (configurationQuestionnaire != null && !configuration) {
    return NextResponse.json({ error: "Configuration du questionnaire invalide" }, { status: 400 });
  }
  if (configuration && !await referencesPharmacieValides(configuration)) {
    return NextResponse.json({ error: "Les préconisations doivent être validées dans la Pharmacie pour ce vaccin" }, { status: 400 });
  }
  if (configuration) {
    const etapesRecues = Array.isArray(etapes) ? etapes : [];
    const idsAttendus = etapeIdsConfigurationQuestionnaire(configuration);
    if (etapesRecues.length !== idsAttendus.length || idsAttendus.some((id) => !etapesRecues.some((etape: any) => etape.id === id))
      || etapesRecues.some((etape: any) => (etape.medicaments || []).some((liaison: any) => liaison.medicamentId !== configuration.medicamentId))) {
      return NextResponse.json({ error: "Les étapes ne correspondent pas au questionnaire" }, { status: 400 });
    }
  }
  try {
    const nomInterne = nom.trim().toUpperCase();
    const idsDemandes = configuration ? {
      dose: configuration.demarrage.type === "DOSE_UNIQUE" ? configuration.demarrage.etapeDoseId : null,
      primo: configuration.demarrage.type === "PRIMO_RAPPEL" ? configuration.demarrage.etapePrimoId : null,
      rappel: configuration.demarrage.type === "PRIMO_RAPPEL" ? configuration.demarrage.etapeRappelId : null,
      entretien: configuration.entretien.actif ? configuration.entretien.etapeId : null,
    } : { dose: null, primo: null, rappel: null, entretien: null };
    const donneesCreation = {
      nom: nomInterne,
      label: label.trim(),
      ordre: ordre ?? 99,
      ageMinJours: ageMinJours ?? 0,
      ageMaxJours: ageMaxJours ?? null,
      urgenceJours: urgenceJours ?? null,
      estRappel: estRappel ?? false,
      primoNom: primoNom?.trim() || null,
      delaiRappelJours: delaiRappelJours ?? null,
      urgenceRappelJours: urgenceRappelJours ?? null,
      obligatoireVente: obligatoireVente ?? false,
      description: description?.trim() || null,
      categoriesJson: Array.isArray(categories) ? JSON.stringify(categories) : null,
      sexeCible: sexeCible || null, stadeReproduction: stadeReproduction || null, gestante: gestante ?? null,
      rangVelageMin: rangVelageMin ?? null, rangVelageMax: rangVelageMax ?? null, lotCible: lotCible || null,
      configurationQuestionnaireJson: configurationJson,
      etapes: { create: (Array.isArray(etapes) ? etapes : []).map((e: any, index: number) => ({ ...(e.id ? { id: e.id } : {}), label: e.label, ordre: index, cycle: e.cycle || "INITIAL", reference: e.reference || "NAISSANCE", debutValeur: Number(e.debutValeur) || 0, debutUnite: e.debutUnite || "JOUR", debutPosition: e.debutPosition || "APRES", finValeur: Number(e.finValeur) || 0, finUnite: e.finUnite || "JOUR", finPosition: e.finPosition || "APRES", recurrenceMois: e.recurrenceMois ? Number(e.recurrenceMois) : null, obligatoire: e.obligatoire !== false, medicaments: { create: (e.medicaments || []).filter((m: any) => m.medicamentId).map((m: any) => ({ medicamentId: m.medicamentId, voie: m.voie || null, preconisationId: m.preconisationId || null, alternative: Boolean(m.alternative) })) } })) },
      actif: true,
    };
    const selectionConflit = {
      id: true, nom: true, label: true, configurationQuestionnaireJson: true,
      etapes: {
        orderBy: { ordre: "asc" as const },
        select: {
          id: true, label: true, cycle: true,
          medicaments: { select: { medicamentId: true } },
          _count: { select: { vaccinations: true, traitements: true } },
        },
      },
    };
    const existantParNom = await prisma.protocoleVaccin.findUnique({
      where: { nom: nomInterne },
      select: selectionConflit,
    });
    let existant = existantParNom;
    let decouvertParMedicament = false;
    if (!existant && configuration) {
      const questionnaireExistant = await prisma.protocoleVaccin.findFirst({
        where: {
          configurationQuestionnaireJson: { not: null },
          etapes: { some: { medicaments: { some: { medicamentId: configuration.medicamentId } } } },
        },
        select: { id: true, nom: true, label: true },
      });
      if (questionnaireExistant) {
        return NextResponse.json({
          error: `Le protocole questionnaire « ${questionnaireExistant.label} » existe déjà pour ce vaccin. Modifie ce protocole au lieu d’en créer un second.`,
          code: "PROTOCOLE_EXISTANT",
          protocoleId: questionnaireExistant.id,
        }, { status: 409 });
      }
      const resolution = resoudreLegacyParMedicament(await prisma.protocoleVaccin.findMany({
        where: {
          configurationQuestionnaireJson: null,
          etapes: { some: { medicaments: { some: { medicamentId: configuration.medicamentId } } } },
        },
        select: selectionConflit,
        take: 2,
      }));
      if (resolution.type === "AMBIGU") {
        return NextResponse.json({
          error: "Plusieurs protocoles historiques contiennent ce vaccin. Vérifie leurs rattachements avant de choisir lequel séparer.",
          code: "PROTOCOLES_LEGACY_AMBIGUS",
          protocoleIds: resolution.protocoleIds,
        }, { status: 409 });
      }
      if (resolution.type === "UNIQUE") {
        existant = resolution.protocole;
        decouvertParMedicament = true;
      }
    }
    if (existant) {
      const medicament = configuration
        ? await prisma.medicament.findUnique({ where: { id: configuration.medicamentId }, select: { nom: true } })
        : null;
      const medicamentIds = new Set(existant.etapes.flatMap((etape) => etape.medicaments.map((liaison) => liaison.medicamentId)));
      const memeVaccin = Boolean(configuration && medicament) && (medicamentIds.size > 0
        ? medicamentIds.size === 1 && medicamentIds.has(configuration!.medicamentId)
        : normaliserNomInterne(existant.nom) === normaliserNomInterne(medicament!.nom));
      const protocoleLegacyContientLaCible = Boolean(configuration)
        && existant.configurationQuestionnaireJson == null
        && medicamentIds.has(configuration!.medicamentId)
        && (medicamentIds.size > 1 || decouvertParMedicament);
      const etapesExistantes = existant.etapes.map((etape) => ({
        id: etape.id, label: etape.label, cycle: etape.cycle,
        vaccinationsCount: etape._count.vaccinations,
        traitementsCount: etape._count.traitements,
      }));
      if (protocoleLegacyContientLaCible && configuration && medicament) {
        const [vaccinations, traitements] = await Promise.all([
          prisma.vaccination.findMany({ where: { protocoleId: existant.id }, select: { id: true, animalId: true, medicamentId: true, etapeProtocoleId: true, date: true } }),
          prisma.traitement.findMany({ where: { protocoleVaccinId: existant.id }, select: { id: true, animalId: true, medicamentId: true, etapeProtocoleVaccinId: true, dateDebut: true } }),
        ]);
        const animalIdsLegacy = [...new Set([...vaccinations, ...traitements].map((acte) => acte.animalId))];
        const traitementsVaccinauxReels = animalIdsLegacy.length === 0 ? [] : await prisma.traitement.findMany({
          where: { animalId: { in: animalIdsLegacy }, medicamentId: { not: null }, medicament: { categorie: "VACCIN" } },
          select: { animalId: true, dateDebut: true, medicamentId: true },
        });
        const plan = planifierExtractionVaccin({
          medicamentId: configuration.medicamentId,
          etapes: existant.etapes.map((etape) => ({ id: etape.id, label: etape.label, cycle: etape.cycle, medicamentIds: etape.medicaments.map((liaison) => liaison.medicamentId) })),
          vaccinations: vaccinations.map((acte) => ({ ...acte, etapeId: acte.etapeProtocoleId })),
          traitements: traitements.map((acte) => ({ ...acte, etapeId: acte.etapeProtocoleVaccinId, date: acte.dateDebut })),
          traitementsVaccinauxReels,
          idsCibles: idsDemandes,
        });
        if (extraireDepuisProtocoleId !== existant.id) {
          return NextResponse.json({
            error: plan.possible
              ? `L’ancien protocole « ${existant.label} » contient ${medicament.nom}. Il doit être séparé avant de créer ce protocole.`
              : plan.raison,
            code: "PROTOCOLE_EXTRACTION_PROPOSEE",
            protocole: {
              id: existant.id, nom: existant.nom, label: existant.label,
              configurationQuestionnairePresente: false, memeVaccin: false, etapes: etapesExistantes,
              conversion: { possible: false },
              extraction: {
                possible: plan.possible,
                medicamentId: configuration.medicamentId,
                medicamentNom: medicament.nom,
                vaccinationsCount: plan.possible ? plan.vaccinations.length : 0,
                traitementsCount: plan.possible ? plan.traitements.length : 0,
                raison: plan.possible ? undefined : plan.raison,
              },
            },
          }, { status: 409 });
        }
        if (!plan.possible) throw new ExtractionVaccinRefusee(plan.raison);

        const protocole = await prisma.$transaction(async (tx) => {
          const legacy = await tx.protocoleVaccin.findUnique({
            where: { id: existant.id },
            select: {
              id: true, nom: true, actif: true, configurationQuestionnaireJson: true,
              etapes: { select: { id: true, label: true, cycle: true, ordre: true, obligatoire: true, medicaments: { select: { medicamentId: true } } } },
              statutsAnimaux: { select: { animalId: true } },
            },
          });
          if (!legacy || legacy.configurationQuestionnaireJson != null) throw new ExtractionVaccinRefusee("Le protocole historique a changé : recharge la page.");
          const [vaccinationsActuelles, traitementsActuels] = await Promise.all([
            tx.vaccination.findMany({ where: { protocoleId: legacy.id }, select: { id: true, animalId: true, medicamentId: true, etapeProtocoleId: true, statut: true, date: true } }),
            tx.traitement.findMany({ where: { protocoleVaccinId: legacy.id }, select: { id: true, animalId: true, medicamentId: true, etapeProtocoleVaccinId: true, dateDebut: true } }),
          ]);
          const animalIdsLegacyActuels = [...new Set([...vaccinationsActuelles, ...traitementsActuels].map((acte) => acte.animalId))];
          const traitementsVaccinauxReelsActuels = animalIdsLegacyActuels.length === 0 ? [] : await tx.traitement.findMany({
            where: { animalId: { in: animalIdsLegacyActuels }, medicamentId: { not: null }, medicament: { categorie: "VACCIN" } },
            select: { animalId: true, dateDebut: true, medicamentId: true },
          });
          const medicamentsLegacy = new Set(legacy.etapes.flatMap((etape) => etape.medicaments.map((liaison) => liaison.medicamentId)));
          if (!medicamentsLegacy.has(configuration.medicamentId)) {
            throw new ExtractionVaccinRefusee("Le protocole historique ne contient plus le vaccin demandé.");
          }
          const planActuel = planifierExtractionVaccin({
            medicamentId: configuration.medicamentId,
            etapes: legacy.etapes.map((etape) => ({ id: etape.id, label: etape.label, cycle: etape.cycle, medicamentIds: etape.medicaments.map((liaison) => liaison.medicamentId) })),
            vaccinations: vaccinationsActuelles.map((acte) => ({ ...acte, etapeId: acte.etapeProtocoleId })),
            traitements: traitementsActuels.map((acte) => ({ ...acte, etapeId: acte.etapeProtocoleVaccinId, date: acte.dateDebut })),
            traitementsVaccinauxReels: traitementsVaccinauxReelsActuels,
            idsCibles: idsDemandes,
          });
          if (!planActuel.possible) throw new ExtractionVaccinRefusee(planActuel.raison);

          const vaccinationsDeplacees = new Map(planActuel.vaccinations.map((acte) => [acte.id, acte]));
          const traitementsDeplaces = new Map(planActuel.traitements.map((acte) => [acte.id, acte]));
          const liensRestants = legacy.etapes.flatMap((etape) => etape.medicaments).filter((liaison) => liaison.medicamentId !== configuration.medicamentId).length;
          const actesRestants = vaccinationsActuelles.length + traitementsActuels.length - vaccinationsDeplacees.size - traitementsDeplaces.size;
          await tx.protocoleVaccin.update({
            where: { id: legacy.id },
            data: { nom: nomInterneLegacy(legacy.nom, legacy.id), actif: liensRestants > 0 || actesRestants > 0 ? legacy.actif : false },
          });
          const nouveau = await tx.protocoleVaccin.create({ data: donneesCreation });
          for (const acte of planActuel.vaccinations) {
            await tx.vaccination.update({ where: { id: acte.id }, data: { protocoleId: nouveau.id, etapeProtocoleId: acte.etapeCibleId } });
          }
          for (const acte of planActuel.traitements) {
            await tx.traitement.update({ where: { id: acte.id }, data: { protocoleVaccinId: nouveau.id, etapeProtocoleVaccinId: acte.etapeCibleId } });
          }
          await tx.etapeProtocoleMedicament.deleteMany({
            where: { medicamentId: configuration.medicamentId, etape: { protocoleId: legacy.id } },
          });

          const animauxConcernes = new Set([
            ...legacy.statutsAnimaux.map((statut) => statut.animalId),
            ...vaccinationsActuelles.map((acte) => acte.animalId),
            ...traitementsActuels.map((acte) => acte.animalId),
          ]);
          await tx.statutProtocoleVaccinal.deleteMany({ where: { protocoleId: { in: [legacy.id, nouveau.id] } } });
          const animaux = await tx.animal.findMany({ where: { id: { in: [...animauxConcernes] } }, select: { id: true, danais: true } });
          const naissanceParAnimal = new Map(animaux.map((animal) => [animal.id, animal.danais]));
          const etapesNouvelles = (Array.isArray(etapes) ? etapes : []).map((etape: any) => ({ id: etape.id as string, cycle: (etape.cycle || "INITIAL") as string, obligatoire: etape.obligatoire !== false }));
          const statutsAcreer: Array<{ animalId: string; protocoleId: string; statut: string; source: string; confirmeAt: Date; brancheInitialeId: string | null }> = [];
          for (const animalId of animauxConcernes) {
            const faitsNouveaux = [
              ...vaccinationsActuelles.filter((acte) => acte.animalId === animalId && acte.statut === "FAIT" && vaccinationsDeplacees.get(acte.id)?.etapeCibleId).map((acte) => ({ etapeProtocoleId: vaccinationsDeplacees.get(acte.id)!.etapeCibleId!, date: acte.date })),
              ...traitementsActuels.filter((acte) => acte.animalId === animalId && traitementsDeplaces.get(acte.id)?.etapeCibleId).map((acte) => ({ etapeProtocoleId: traitementsDeplaces.get(acte.id)!.etapeCibleId!, date: acte.dateDebut })),
            ];
            const statutNouveau = statutDepuisEtapesFaites(etapesNouvelles, new Set(faitsNouveaux.map((acte) => acte.etapeProtocoleId)));
            if (statutNouveau) {
              const danais = naissanceParAnimal.get(animalId);
              statutsAcreer.push({
                animalId, protocoleId: nouveau.id, statut: statutNouveau, source: "VACCINATION", confirmeAt: new Date(),
                brancheInitialeId: danais ? brancheInitialeDepuisActes(configuration, danais, faitsNouveaux) : null,
              });
            }
            const faitsLegacy = new Set([
              ...vaccinationsActuelles.filter((acte) => acte.animalId === animalId && acte.statut === "FAIT" && !vaccinationsDeplacees.has(acte.id) && acte.etapeProtocoleId).map((acte) => acte.etapeProtocoleId!),
              ...traitementsActuels.filter((acte) => acte.animalId === animalId && !traitementsDeplaces.has(acte.id) && acte.etapeProtocoleVaccinId).map((acte) => acte.etapeProtocoleVaccinId!),
            ]);
            const statutLegacy = statutDepuisEtapesFaites(legacy.etapes, faitsLegacy);
            if (statutLegacy) statutsAcreer.push({ animalId, protocoleId: legacy.id, statut: statutLegacy, source: "VACCINATION", confirmeAt: new Date(), brancheInitialeId: null });
          }
          if (statutsAcreer.length > 0) await tx.statutProtocoleVaccinal.createMany({ data: statutsAcreer });
          return nouveau;
        });
        return NextResponse.json(protocole, { status: 201 });
      }
      if (extraireDepuisProtocoleId) {
        return NextResponse.json({ error: "Le protocole indiqué ne correspond pas à une extraction proposée." }, { status: 409 });
      }
      const conversion = existant.configurationQuestionnaireJson
        ? { possible: false as const, raison: "Ce protocole utilise déjà le questionnaire : modifiez directement le protocole existant." }
        : !memeVaccin
          ? { possible: false as const, raison: "Ce nom appartient à un autre vaccin : la conversion automatique est impossible." }
          : preparerConversionProtocole(etapesExistantes, idsDemandes);
      const nomVaccin = medicament?.nom ?? label.trim();
      const error = conversion.possible
        ? `Un protocole existe déjà pour ${nomVaccin}. Mettre à jour ce protocole ?`
        : `Un protocole existe déjà pour ${nomVaccin}. ${conversion.raison}`;
      return NextResponse.json({
        error,
        code: "PROTOCOLE_EXISTANT",
        protocole: {
          id: existant.id, nom: existant.nom, label: existant.label,
          configurationQuestionnairePresente: Boolean(existant.configurationQuestionnaireJson),
          memeVaccin, etapes: etapesExistantes, conversion,
        },
      }, { status: 409 });
    }
    if (extraireDepuisProtocoleId) return NextResponse.json({ error: "Le protocole historique à séparer n’existe plus." }, { status: 409 });
    const protocole = await prisma.protocoleVaccin.create({ data: donneesCreation });
    const desc = `Protocole '${protocole.label}' créé`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_PROTOCOLE", desc, { op: "delete", model: "protocoleVaccin", id: protocole.id });
    } catch {}

    return NextResponse.json({ ...protocole, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (error) {
    if (error instanceof ExtractionVaccinRefusee) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const message = cibleErreurUniqueContientNom(error.meta)
        ? "Un protocole utilise déjà ce nom"
        : "Une donnée de ce protocole existe déjà";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("Échec de création du protocole vaccinal", error);
    return NextResponse.json({ error: "Le protocole n’a pas pu être enregistré" }, { status: 500 });
  }
}
