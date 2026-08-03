import type { Prisma, PrismaClient } from "@prisma/client";
import { genererNumerosLibresDuLot } from "./identification.ts";
import {
  describeRemovalBlockage,
  findRemovalBlockages,
  normalizeVelageCalves,
  type AnimalRemovalFacts,
  type NormalizedCalf,
  type RemovalBlockage,
} from "./velage-safety.ts";

export type EditableCalfInput = {
  detailId?: string | null;
  animalId?: string | null;
  nutrav?: string;
  nunati?: string;
  sexe?: "M" | "F" | "";
  nom?: string;
  statut?: "VIVANT" | "MORT_NE";
};

export type EditVelageInput = {
  vacheNutrav: string;
  date: string;
  moment?: string | null;
  qualificatif: "NORMAL" | "DIFFICILE" | "AVORTEMENT" | "MORT_NEE";
  sousType?: string | null;
  capteur?: number | null;
  pereNom?: string | null;
  notes?: string | null;
  veaux: EditableCalfInput[];
};

export type AnimalDeletionInspection = {
  animalId: string;
  nutrav: string;
  blockages: RemovalBlockage[];
  removableDeclarationIds: string[];
};

export type VelageDeletionPreview = {
  allowed: boolean;
  message: string;
  blockers: Array<{ animalId: string; nutrav: string; categories: RemovalBlockage[]; message: string }>;
  animalRecordsToDelete: number;
  calfRecordsToDelete: number;
  stillbornRecordsToDelete: number;
  removableBirthDeclarations: number;
  preserved: string[];
};

type TransactionHost = Pick<PrismaClient, "$transaction">;
type QueryClient = Pick<PrismaClient, "velage" | "animal">;
type SafetyInspector = (
  tx: Prisma.TransactionClient,
  animalId: string,
  currentVelageId: string,
) => Promise<AnimalDeletionInspection>;

const calfAnimalSelect = {
  id: true,
  nutrav: true,
  nunati: true,
  numeroNational: true,
  nobovi: true,
  sexbov: true,
  danais: true,
} satisfies Prisma.AnimalSelect;

const velageInclude = {
  vache: { select: { id: true, nutrav: true, nobovi: true } },
  veau: { select: calfAnimalSelect },
  gestation: { select: { id: true, etat: true } },
  veauxDetails: { include: { animal: { select: calfAnimalSelect } }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.VelageInclude;

type LoadedVelage = Prisma.VelageGetPayload<{ include: typeof velageInclude }>;

export class VelageEditError extends Error {
  readonly code: "NOT_FOUND" | "INVALID" | "CONFLICT" | "UNSAFE";
  readonly preview?: VelageDeletionPreview;

  constructor(
    message: string,
    code: "NOT_FOUND" | "INVALID" | "CONFLICT" | "UNSAFE",
    preview?: VelageDeletionPreview,
  ) {
    super(message);
    this.code = code;
    this.preview = preview;
  }
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sameDay(first: Date, second: Date) {
  return first.toISOString().slice(0, 10) === second.toISOString().slice(0, 10);
}

export function normalizeEditVelageInput(input: EditVelageInput): EditVelageInput {
  const date = new Date(input.date);
  if (!input.vacheNutrav?.trim() || Number.isNaN(date.getTime())) {
    throw new VelageEditError("La mère et la date sont requises", "INVALID");
  }
  if (!["NORMAL", "DIFFICILE", "AVORTEMENT", "MORT_NEE"].includes(input.qualificatif)) {
    throw new VelageEditError("Le déroulement du vêlage est invalide", "INVALID");
  }
  const veaux: EditableCalfInput[] = (input.qualificatif === "AVORTEMENT" ? [] : input.veaux ?? []).slice(0, 10).map((veau) => ({
    detailId: optionalText(veau.detailId),
    animalId: optionalText(veau.animalId),
    nutrav: optionalText(veau.nutrav)?.toUpperCase() ?? "",
    nunati: optionalText(veau.nunati)?.toUpperCase() ?? "",
    sexe: veau.sexe === "M" || veau.sexe === "F" ? veau.sexe : "",
    nom: optionalText(veau.nom) ?? "",
    statut: input.qualificatif === "MORT_NEE" || veau.statut === "MORT_NE" ? "MORT_NE" : "VIVANT",
  }));

  for (const veau of veaux) {
    if (veau.nutrav && !/^\d{4}$/.test(veau.nutrav)) {
      throw new VelageEditError("Le numéro de travail doit contenir 4 chiffres", "INVALID");
    }
    if (veau.nunati && veau.nutrav !== veau.nunati.slice(-4)) {
      throw new VelageEditError("Le numéro de travail doit correspondre aux 4 derniers chiffres du numéro national", "INVALID");
    }
    if (veau.statut === "VIVANT" && !veau.nutrav) {
      throw new VelageEditError("Un veau vivant doit avoir un numéro de travail", "INVALID");
    }
  }
  for (const field of ["detailId", "animalId", "nutrav", "nunati"] as const) {
    const values = veaux.map((veau) => veau[field]).filter(Boolean);
    if (new Set(values).size !== values.length) {
      throw new VelageEditError("Un même veau ou numéro est présent plusieurs fois", "CONFLICT");
    }
  }

  return {
    ...input,
    vacheNutrav: input.vacheNutrav.trim().toUpperCase(),
    date: date.toISOString(),
    moment: optionalText(input.moment),
    sousType: optionalText(input.sousType),
    pereNom: optionalText(input.pereNom),
    notes: optionalText(input.notes),
    capteur: Number.isInteger(input.capteur) ? input.capteur : null,
    veaux,
  };
}

async function loadVelage(client: QueryClient | Prisma.TransactionClient, id: string): Promise<LoadedVelage | null> {
  return client.velage.findUnique({ where: { id }, include: velageInclude });
}

function editableView(velage: LoadedVelage) {
  return {
    id: velage.id,
    vacheNutrav: velage.vache.nutrav,
    vacheNom: velage.vache.nobovi,
    date: velage.date.toISOString(),
    moment: velage.moment,
    qualificatif: velage.qualificatif,
    sousType: velage.sousType,
    capteur: velage.capteur,
    pereNom: velage.pereNom,
    notes: velage.notes,
    veaux: normalizeVelageCalves(velage).map(({ animal: _animal, ...calf }) => calf),
  };
}

export async function inspectAnimalRemovalSafety(
  tx: Prisma.TransactionClient,
  animalId: string,
  currentVelageId: string,
): Promise<AnimalDeletionInspection> {
  const animal = await tx.animal.findUnique({
    where: { id: animalId },
    select: {
      id: true,
      nutrav: true,
      statut: true,
      categorie: true,
      groupeId: true,
      localisationId: true,
      notes: true,
      aEchographier: true,
      reproductionEtatManuel: true,
      reproductionEtatPrecedent: true,
      reproductionEtatModifieAt: true,
      sevreFait: true,
      dateSevrage: true,
      tarieFaite: true,
      dateTarie: true,
      sortie: { select: { id: true } },
      velageVeau: { select: { id: true } },
      veauxVelage: { select: { id: true, velageId: true } },
      declarationsAdministratives: { select: { id: true, type: true, statut: true } },
      _count: {
        select: {
          pesees: true,
          evenements: true,
          traitements: true,
          vaccinations: true,
          parages: true,
          complementsAlim: true,
          chaleurs: true,
          saillies: true,
          demandesEchographie: true,
          velagesVache: true,
          veaux: true,
        },
      },
    },
  });
  if (!animal) throw new VelageEditError("Fiche veau introuvable", "NOT_FOUND");
  const [salesCount, sensorCount] = await Promise.all([
    tx.venteHistorique.count({ where: { nutrav: animal.nutrav } }),
    tx.capteurVelage.count({ where: { animalNutrav: animal.nutrav } }),
  ]);

  const removableDeclarations = animal.declarationsAdministratives.filter(
    (declaration) => declaration.type === "NAISSANCE" && declaration.statut === "A_DECLARER",
  );
  const facts: AnimalRemovalFacts = {
    nutrav: animal.nutrav,
    counts: {
      pesees: animal._count.pesees,
      evenements: animal._count.evenements,
      traitements: animal._count.traitements,
      vaccinations: animal._count.vaccinations,
      parages: animal._count.parages,
      complementsAlim: animal._count.complementsAlim,
      chaleurs: animal._count.chaleurs,
      saillies: animal._count.saillies,
      demandesEchographie: animal._count.demandesEchographie,
      velagesVache: animal._count.velagesVache,
      descendants: animal._count.veaux,
      ventes: salesCount,
      capteurs: sensorCount,
    },
    hasSortie: Boolean(animal.sortie),
    otherBirthLinks:
      (animal.velageVeau && animal.velageVeau.id !== currentVelageId ? 1 : 0)
      + animal.veauxVelage.filter((detail) => detail.velageId !== currentVelageId).length,
    protectedDeclarations: animal.declarationsAdministratives.length - removableDeclarations.length,
    removableBirthDeclarations: removableDeclarations.length,
    hasOperationalState: Boolean(
      animal.groupeId
      || animal.localisationId
      || animal.notes
      || animal.aEchographier
      || animal.reproductionEtatManuel
      || animal.reproductionEtatPrecedent
      || animal.reproductionEtatModifieAt
      || animal.sevreFait
      || animal.dateSevrage
      || animal.tarieFaite
      || animal.dateTarie
      || animal.statut !== "ACTIF"
      || (animal.categorie !== null && animal.categorie !== "VELLE"),
    ),
  };
  return {
    animalId: animal.id,
    nutrav: animal.nutrav,
    blockages: findRemovalBlockages(facts),
    removableDeclarationIds: removableDeclarations.map((declaration) => declaration.id),
  };
}

async function buildDeletionPreview(
  tx: Prisma.TransactionClient,
  velage: LoadedVelage,
  inspect: SafetyInspector,
) {
  const calves = normalizeVelageCalves(velage);
  const animalIds = [...new Set(calves.flatMap((calf) => calf.animalId ? [calf.animalId] : []))];
  const inspections = await Promise.all(animalIds.map((animalId) => inspect(tx, animalId, velage.id)));
  const blockers = inspections.flatMap((inspection) => inspection.blockages.length > 0 ? [{
    animalId: inspection.animalId,
    nutrav: inspection.nutrav,
    categories: inspection.blockages,
    message: describeRemovalBlockage(inspection.nutrav, inspection.blockages),
  }] : []);
  const preview: VelageDeletionPreview = {
    allowed: blockers.length === 0,
    message: blockers.length > 0
      ? blockers.map((blocker) => blocker.message).join(" ")
      : `Ce vêlage, ${velage.veauxDetails.length} enregistrement(s) de veau et ${animalIds.length} fiche(s) animale(s) sans historique seront supprimés. La mère et ses autres données seront conservées.`,
    blockers,
    animalRecordsToDelete: animalIds.length,
    calfRecordsToDelete: velage.veauxDetails.length,
    stillbornRecordsToDelete: calves.filter((calf) => !calf.animalId).length,
    removableBirthDeclarations: inspections.reduce((total, inspection) => total + inspection.removableDeclarationIds.length, 0),
    preserved: ["la mère", "les autres données de la mère", "les numéros déjà consommés du lot de boucles"],
  };
  return { preview, inspections, animalIds };
}

export async function getVelageDetails(id: string, db: QueryClient & TransactionHost) {
  const velage = await loadVelage(db, id);
  if (!velage) throw new VelageEditError("Vêlage introuvable", "NOT_FOUND");
  const deletion = await db.$transaction(async (tx) => (await buildDeletionPreview(tx, velage, inspectAnimalRemovalSafety)).preview);
  return { ...editableView(velage), deletion };
}

export async function deleteVelage(
  id: string,
  db: TransactionHost,
  inspect: SafetyInspector = inspectAnimalRemovalSafety,
) {
  return db.$transaction(async (tx) => {
    const velage = await loadVelage(tx, id);
    if (!velage) throw new VelageEditError("Vêlage introuvable", "NOT_FOUND");
    const { preview, inspections, animalIds } = await buildDeletionPreview(tx, velage, inspect);
    if (!preview.allowed) throw new VelageEditError(preview.message, "UNSAFE", preview);

    if (velage.gestationId) {
      await tx.gestation.updateMany({
        where: { id: velage.gestationId, etat: "VELAGE" },
        data: { etat: "VERT" },
      });
    }
    await tx.velage.update({ where: { id }, data: { veauId: null } });
    const declarationIds = inspections.flatMap((inspection) => inspection.removableDeclarationIds);
    if (declarationIds.length > 0) {
      await tx.declarationAdministrative.deleteMany({ where: { id: { in: declarationIds } } });
    }
    await tx.velage.delete({ where: { id } });
    if (animalIds.length > 0) await tx.animal.deleteMany({ where: { id: { in: animalIds } } });
    return preview;
  });
}

async function ensureBirthDeclaration(tx: Prisma.TransactionClient, animalId: string, service: string) {
  const existing = await tx.declarationAdministrative.findFirst({ where: { animalId, type: "NAISSANCE" } });
  if (!existing) {
    await tx.declarationAdministrative.create({
      data: { animalId, type: "NAISSANCE", statut: "A_DECLARER", service },
    });
  }
}

function previousCalfIdentification(calf: EditableCalfInput, details: Map<string, LoadedVelage["veauxDetails"][number]>, current: LoadedVelage) {
  const detail = calf.detailId ? details.get(calf.detailId) : null;
  if (detail) return {
    nutrav: detail.animal?.nutrav ?? detail.nutrav ?? "",
    nunati: detail.animal?.numeroNational ?? detail.nunati ?? "",
  };
  if (calf.animalId === current.veauId && current.veau) {
    return { nutrav: current.veau.nutrav, nunati: current.veau.numeroNational ?? "" };
  }
  return { nutrav: "", nunati: "" };
}

export async function editVelage(
  id: string,
  rawInput: EditVelageInput,
  db: TransactionHost,
  inspect: SafetyInspector = inspectAnimalRemovalSafety,
) {
  const input = normalizeEditVelageInput(rawInput);
  return db.$transaction(async (tx) => {
    const current = await loadVelage(tx, id);
    if (!current) throw new VelageEditError("Vêlage introuvable", "NOT_FOUND");
    if (current.vache.nutrav !== input.vacheNutrav) {
      throw new VelageEditError("La mère ne peut pas être modifiée sur un vêlage déjà enregistré", "UNSAFE");
    }

    const existingDetails = new Map(current.veauxDetails.map((detail) => [detail.id, detail]));
    for (const calf of input.veaux) {
      if (calf.detailId && !existingDetails.has(calf.detailId)) {
        throw new VelageEditError("Un veau ne correspond pas à ce vêlage", "CONFLICT");
      }
      const detail = calf.detailId ? existingDetails.get(calf.detailId) : null;
      if (detail && calf.animalId !== detail.animalId) {
        throw new VelageEditError("L’identité stable d’un veau ne peut pas être remplacée", "CONFLICT");
      }
      if (!detail && calf.animalId && calf.animalId !== current.veauId) {
        throw new VelageEditError("La fiche veau ne correspond pas à ce vêlage", "CONFLICT");
      }
    }

    const retainedDetailIds = new Set(input.veaux.flatMap((calf) => calf.detailId ? [calf.detailId] : []));
    if (current.veauxDetails.some((detail) => !retainedDetailIds.has(detail.id))) {
      throw new VelageEditError("Un veau déjà enregistré ne peut pas être retiré de cette modification", "UNSAFE");
    }
    const legacyPrimaryMissing = current.veauId
      && !current.veauxDetails.some((detail) => detail.animalId === current.veauId)
      && !input.veaux.some((calf) => calf.animalId === current.veauId);
    if (legacyPrimaryMissing) {
      throw new VelageEditError("Le veau principal existant ne peut pas être retiré de cette modification", "UNSAFE");
    }
    if (input.qualificatif === "AVORTEMENT" && (current.veauId || current.veauxDetails.length > 0)) {
      throw new VelageEditError("Le passage en avortement supprimerait des veaux existants. Cette modification est bloquée.", "UNSAFE");
    }

    const activeLot = await tx.lotBoucles.findFirst({ where: { actif: true }, orderBy: { createdAt: "asc" } });
    let availableLotNumbers: Array<{ nutrav: string; nunati: string }> = [];
    if (activeLot) {
      const remaining = Math.max(0, activeLot.quantite - activeLot.prochainIndex);
      if (remaining > 0) {
        const [animals, details] = await Promise.all([
          tx.animal.findMany({ select: { nutrav: true, nunati: true, numeroNational: true, nobovi: true } }),
          tx.veauVelage.findMany({ select: { nutrav: true, nunati: true, nom: true } }),
        ]);
        availableLotNumbers = genererNumerosLibresDuLot(activeLot.premierNunati, remaining, [
          ...animals.flatMap((animal) => [animal.nunati, animal.numeroNational]
            .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index)
            .map((nunati) => ({ nutrav: animal.nutrav, nunati, utilisePar: animal.nobovi }))),
          ...details.map((detail) => ({ nutrav: detail.nutrav, nunati: detail.nunati, utilisePar: detail.nom })),
        ]).numeros;
      }
    }
    const consumedLotNumbers = new Set<string>();
    const config = await tx.exploitationConfig.findUnique({ where: { id: "singleton" }, select: { serviceDeclaration: true } });
    const newDate = new Date(input.date);
    const linkedAnimalIds: string[] = [];

    // Libère temporairement la relation principale pour autoriser une conversion sûre.
    await tx.velage.update({ where: { id }, data: { veauId: null } });

    for (const calf of input.veaux) {
      const existingDetail = calf.detailId ? existingDetails.get(calf.detailId) : null;
      let animal = existingDetail?.animal
        ? await tx.animal.findUnique({ where: { id: existingDetail.animal.id } })
        : null;
      if (!animal && !existingDetail && calf.animalId === current.veauId && current.veau) {
        animal = await tx.animal.findUnique({ where: { id: current.veau.id } });
      }
      const previous = previousCalfIdentification(calf, existingDetails, current);
      const identificationChanged = calf.nutrav !== previous.nutrav || (calf.nunati ?? "") !== previous.nunati;
      if (calf.nutrav) {
        const detailNumberOwner = await tx.veauVelage.findFirst({
          where: { nutrav: calf.nutrav, ...(existingDetail ? { id: { not: existingDetail.id } } : {}) },
        });
        if (detailNumberOwner) throw new VelageEditError(`Le numéro ${calf.nutrav} est déjà utilisé par un autre vêlage`, "CONFLICT");
      }
      if (calf.nunati) {
        const detailNationalOwner = await tx.veauVelage.findFirst({
          where: { nunati: calf.nunati, ...(existingDetail ? { id: { not: existingDetail.id } } : {}) },
        });
        if (detailNationalOwner) throw new VelageEditError(`Le numéro national ${calf.nunati} est déjà utilisé par un autre vêlage`, "CONFLICT");
      }

      if (calf.statut === "MORT_NE") {
        if (calf.nutrav) {
          const workOwner = await tx.animal.findUnique({ where: { nutrav: calf.nutrav } });
          if (workOwner && workOwner.id !== animal?.id) {
            throw new VelageEditError(`Le numéro ${calf.nutrav} est déjà utilisé par une autre fiche`, "CONFLICT");
          }
        }
        if (calf.nunati) {
          const nationalOwner = await tx.animal.findFirst({ where: { OR: [{ numeroNational: calf.nunati }, { nunati: calf.nunati }] } });
          if (nationalOwner && nationalOwner.id !== animal?.id) {
            throw new VelageEditError(`Le numéro national ${calf.nunati} est déjà utilisé par une autre fiche`, "CONFLICT");
          }
        }
        if (animal) {
          const safety = await inspect(tx, animal.id, id);
          if (safety.blockages.length > 0) {
            throw new VelageEditError(describeRemovalBlockage(safety.nutrav, safety.blockages), "UNSAFE");
          }
          const detailData = {
            animalId: null,
            nutrav: calf.nutrav || animal.nutrav,
            nunati: calf.nunati || animal.numeroNational,
            nom: calf.nom || animal.nobovi,
            sexe: calf.sexe || animal.sexbov,
            statut: "MORT_NE",
          };
          if (existingDetail) await tx.veauVelage.update({ where: { id: existingDetail.id }, data: detailData });
          else await tx.veauVelage.create({ data: { velageId: id, ...detailData } });
          if (safety.removableDeclarationIds.length > 0) {
            await tx.declarationAdministrative.deleteMany({ where: { id: { in: safety.removableDeclarationIds } } });
          }
          await tx.animal.delete({ where: { id: animal.id } });
        } else {
          const detailData = {
            animalId: null,
            nutrav: calf.nutrav || null,
            nunati: calf.nunati || null,
            nom: calf.nom || null,
            sexe: calf.sexe || null,
            statut: "MORT_NE",
          };
          if (existingDetail) await tx.veauVelage.update({ where: { id: existingDetail.id }, data: detailData });
          else await tx.veauVelage.create({ data: { velageId: id, ...detailData } });
        }
        continue;
      }

      if (!calf.nutrav) throw new VelageEditError("Un veau vivant doit avoir un numéro de travail", "INVALID");
      const numberOwner = await tx.animal.findUnique({ where: { nutrav: calf.nutrav } });
      let reusedExistingNumber = false;
      let resolvedNunati = calf.nunati || "";
      if (numberOwner && numberOwner.id !== animal?.id) {
        if (animal) throw new VelageEditError(`Le numéro ${calf.nutrav} est déjà utilisé par une autre fiche`, "CONFLICT");
        const [otherDetail, otherPrimary] = await Promise.all([
          tx.veauVelage.findFirst({ where: { animalId: numberOwner.id } }),
          tx.velage.findFirst({ where: { veauId: numberOwner.id, id: { not: id } }, select: { id: true } }),
        ]);
        const compatibleDate = sameDay(numberOwner.danais, newDate) || sameDay(numberOwner.danais, current.date);
        if (otherDetail || otherPrimary || (numberOwner.mereId && numberOwner.mereId !== current.vacheId) || !compatibleDate) {
          throw new VelageEditError(`Le veau ${calf.nutrav} existe mais n’est pas compatible avec ce vêlage`, "CONFLICT");
        }
        const existingNational = numberOwner.numeroNational
          ?? (numberOwner.nunati.startsWith("AUTO") ? "" : numberOwner.nunati);
        if (resolvedNunati && existingNational && resolvedNunati !== existingNational) {
          throw new VelageEditError(`Le numéro national du veau ${calf.nutrav} ne correspond pas à sa fiche existante`, "CONFLICT");
        }
        if (!resolvedNunati) resolvedNunati = existingNational;
        animal = numberOwner;
        reusedExistingNumber = true;
      }
      if (resolvedNunati) {
        const nationalOwner = await tx.animal.findFirst({
          where: { OR: [{ numeroNational: resolvedNunati }, { nunati: resolvedNunati }] },
        });
        if (nationalOwner && nationalOwner.id !== animal?.id) {
          throw new VelageEditError(`Le numéro national ${resolvedNunati} est déjà utilisé par une autre fiche`, "CONFLICT");
        }
      }

      if (activeLot && identificationChanged && !reusedExistingNumber) {
        const fromLot = availableLotNumbers.some((number) => number.nutrav === calf.nutrav && number.nunati === resolvedNunati);
        if (!fromLot || !resolvedNunati) {
          throw new VelageEditError("Cette boucle n’appartient pas au lot actif", "CONFLICT");
        }
        consumedLotNumbers.add(resolvedNunati);
      }

      const sex = calf.sexe || animal?.sexbov || "F";
      if (!animal) {
        animal = await tx.animal.create({
          data: {
            nutrav: calf.nutrav,
            nunati: resolvedNunati || `AUTO${calf.nutrav}`,
            numeroNational: resolvedNunati || null,
            nobovi: calf.nom || null,
            danais: newDate,
            sexbov: sex,
            statut: "ACTIF",
            estGenisse: sex === "F",
            categorie: sex === "F" ? "VELLE" : null,
            mereId: current.vacheId,
            declarationsAdministratives: {
              create: { type: "NAISSANCE", statut: "A_DECLARER", service: config?.serviceDeclaration ?? "AUCUN" },
            },
          },
        });
      } else {
        animal = await tx.animal.update({
          where: { id: animal.id },
          data: {
            nutrav: calf.nutrav,
            nunati: resolvedNunati || `AUTO${calf.nutrav}`,
            numeroNational: resolvedNunati || null,
            nobovi: calf.nom || null,
            danais: newDate,
            sexbov: sex,
            estGenisse: sex === "F",
            ...(animal.categorie === null || animal.categorie === "VELLE" ? { categorie: sex === "F" ? "VELLE" : null } : {}),
            mereId: current.vacheId,
          },
        });
        await ensureBirthDeclaration(tx, animal.id, config?.serviceDeclaration ?? "AUCUN");
      }
      linkedAnimalIds.push(animal.id);
      const detailData = {
        animalId: animal.id,
        nutrav: calf.nutrav,
        nunati: resolvedNunati || null,
        nom: calf.nom || null,
        sexe: sex,
        statut: "VIVANT",
      };
      if (existingDetail) await tx.veauVelage.update({ where: { id: existingDetail.id }, data: detailData });
      else await tx.veauVelage.create({ data: { velageId: id, ...detailData } });
    }

    const primaryAnimalId = current.veauId && linkedAnimalIds.includes(current.veauId)
      ? current.veauId
      : linkedAnimalIds[0] ?? null;
    await tx.velage.update({
      where: { id },
      data: {
        date: newDate,
        moment: input.moment,
        qualificatif: input.qualificatif,
        sousType: input.sousType,
        capteur: input.capteur,
        pereNom: input.pereNom,
        notes: input.notes,
        veauId: primaryAnimalId,
        nombreVeaux: input.veaux.length,
        jumeaux: input.veaux.length >= 2,
      },
    });
    if (activeLot && consumedLotNumbers.size > 0) {
      const nextIndex = Math.min(activeLot.quantite, activeLot.prochainIndex + consumedLotNumbers.size);
      await tx.lotBoucles.update({
        where: { id: activeLot.id },
        data: { prochainIndex: nextIndex, actif: nextIndex < activeLot.quantite },
      });
    }

    const updated = await loadVelage(tx, id);
    if (!updated) throw new VelageEditError("Vêlage introuvable après modification", "NOT_FOUND");
    return editableView(updated);
  });
}
