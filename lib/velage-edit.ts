import type { Prisma, PrismaClient } from "@prisma/client";
import { genererNumerosLibresDuLot } from "./identification.ts";

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

type TransactionHost = Pick<PrismaClient, "$transaction">;

export class VelageEditError extends Error {
  readonly code: "NOT_FOUND" | "INVALID" | "CONFLICT" | "UNSAFE";

  constructor(
    message: string,
    code: "NOT_FOUND" | "INVALID" | "CONFLICT" | "UNSAFE",
  ) {
    super(message);
    this.code = code;
  }
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function sameInstant(first: Date, second: Date) {
  return first.getTime() === second.getTime();
}

export async function editVelage(
  id: string,
  rawInput: EditVelageInput,
  db: TransactionHost,
) {
  const input = normalizeEditVelageInput(rawInput);
  return db.$transaction(async (tx) => editVelageInTransaction(tx, id, input));
}

async function editVelageInTransaction(tx: Prisma.TransactionClient, id: string, input: EditVelageInput) {
  const current = await tx.velage.findUnique({
    where: { id },
    include: {
      vache: { select: { id: true, nutrav: true } },
      veau: true,
      veauxDetails: { include: { animal: true } },
    },
  });
  if (!current) throw new VelageEditError("Vêlage introuvable", "NOT_FOUND");
  if (current.vache.nutrav !== input.vacheNutrav) {
    throw new VelageEditError(
      "La mère ne peut pas être modifiée sur un vêlage déjà enregistré",
      "UNSAFE",
    );
  }

  const existingDetails = new Map(current.veauxDetails.map((detail) => [detail.id, detail]));
  for (const calf of input.veaux) {
    if (calf.detailId && !existingDetails.has(calf.detailId)) {
      throw new VelageEditError("Un veau ne correspond pas à ce vêlage", "CONFLICT");
    }
  }

  const retainedDetailIds = new Set(input.veaux.flatMap((calf) => calf.detailId ? [calf.detailId] : []));
  const removedDetails = current.veauxDetails.filter((detail) => !retainedDetailIds.has(detail.id));
  if (removedDetails.some((detail) => detail.animalId)) {
    throw new VelageEditError(
      "Un veau vivant déjà lié ne peut pas être retiré depuis cette modification",
      "UNSAFE",
    );
  }
  if (removedDetails.length > 0) {
    await tx.veauVelage.deleteMany({ where: { id: { in: removedDetails.map((detail) => detail.id) } } });
  }

  const changedIdentifications = input.veaux.filter((calf) => {
    const detail = calf.detailId ? existingDetails.get(calf.detailId) : null;
    const previousNutrav = detail?.animal?.nutrav ?? detail?.nutrav ?? (calf.animalId === current.veauId ? current.veau?.nutrav : null);
    const previousNunati = detail?.animal?.numeroNational ?? detail?.nunati ?? (calf.animalId === current.veauId ? current.veau?.numeroNational : null);
    return Boolean(calf.nutrav) && (calf.nutrav !== previousNutrav || calf.nunati !== (previousNunati ?? ""));
  });
  const activeLot = changedIdentifications.length > 0
    ? await tx.lotBoucles.findFirst({ where: { actif: true }, orderBy: { createdAt: "asc" } })
    : null;
  if (activeLot) {
    const remaining = Math.max(0, activeLot.quantite - activeLot.prochainIndex);
    if (remaining < changedIdentifications.length) {
      throw new VelageEditError("Le lot de boucles actif ne contient pas assez de numéros", "CONFLICT");
    }
    const [animals, birthDetails] = await Promise.all([
      tx.animal.findMany({ select: { nutrav: true, nunati: true, numeroNational: true, nobovi: true } }),
      tx.veauVelage.findMany({ select: { nutrav: true, nunati: true, nom: true } }),
    ]);
    const available = genererNumerosLibresDuLot(activeLot.premierNunati, remaining, [
      ...animals.flatMap((animal) => [animal.nunati, animal.numeroNational].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index).map((nunati) => ({ nutrav: animal.nutrav, nunati, utilisePar: animal.nobovi }))),
      ...birthDetails.map((detail) => ({ nutrav: detail.nutrav, nunati: detail.nunati, utilisePar: detail.nom })),
    ]).numeros;
    if (changedIdentifications.some((calf) => !available.some((number) => number.nutrav === calf.nutrav && number.nunati === calf.nunati))) {
      throw new VelageEditError("Cette boucle n’appartient pas au lot actif", "CONFLICT");
    }
  }

  const newDate = new Date(input.date);
  const linkedAnimalIds: string[] = [];
  const config = await tx.exploitationConfig.findUnique({ where: { id: "singleton" }, select: { serviceDeclaration: true } });

  for (const calf of input.veaux) {
    const existingDetail = calf.detailId ? existingDetails.get(calf.detailId) : null;
    let animal = existingDetail?.animal ?? null;

    if (!animal && calf.animalId) {
      const isLegacyPrimary = current.veauId === calf.animalId;
      if (!isLegacyPrimary) throw new VelageEditError("La fiche veau ne correspond pas à ce vêlage", "CONFLICT");
      animal = await tx.animal.findUnique({ where: { id: calf.animalId } });
      if (!animal) throw new VelageEditError("Fiche veau introuvable", "NOT_FOUND");
    }

    if (calf.statut === "MORT_NE" && animal) {
      throw new VelageEditError(
        "Une fiche animale existante ne peut pas être transformée en mort-né",
        "UNSAFE",
      );
    }
    if (calf.statut === "VIVANT" && animal && !calf.nutrav) {
      throw new VelageEditError("Le numéro d’une fiche veau existante ne peut pas être vidé", "UNSAFE");
    }

    if (calf.nutrav) {
      const detailNumberOwner = await tx.veauVelage.findFirst({
        where: { nutrav: calf.nutrav, ...(existingDetail ? { id: { not: existingDetail.id } } : {}) },
      });
      if (detailNumberOwner) throw new VelageEditError(`Le numéro ${calf.nutrav} est déjà utilisé`, "CONFLICT");
    }
    if (calf.nunati) {
      const birthNumberOwner = await tx.veauVelage.findFirst({
        where: { nunati: calf.nunati, ...(existingDetail ? { id: { not: existingDetail.id } } : {}) },
      });
      if (birthNumberOwner) throw new VelageEditError(`Le numéro national ${calf.nunati} est déjà utilisé`, "CONFLICT");
    }
    if (calf.statut === "MORT_NE") {
      if (calf.nutrav && await tx.animal.findUnique({ where: { nutrav: calf.nutrav } })) {
        throw new VelageEditError(`Le numéro ${calf.nutrav} est déjà utilisé`, "CONFLICT");
      }
      if (calf.nunati && await tx.animal.findFirst({ where: { OR: [{ numeroNational: calf.nunati }, { nunati: calf.nunati }] } })) {
        throw new VelageEditError(`Le numéro national ${calf.nunati} est déjà utilisé`, "CONFLICT");
      }
    }

    if (calf.statut === "VIVANT" && calf.nutrav) {
      const numberOwner = await tx.animal.findUnique({ where: { nutrav: calf.nutrav } });
      if (numberOwner && numberOwner.id !== animal?.id) {
        throw new VelageEditError(`Le numéro ${calf.nutrav} est déjà utilisé`, "CONFLICT");
      }
      if (calf.nunati) {
        const nationalOwner = await tx.animal.findFirst({
          where: { OR: [{ numeroNational: calf.nunati }, { nunati: calf.nunati }] },
        });
        if (nationalOwner && nationalOwner.id !== animal?.id) {
          throw new VelageEditError(`Le numéro national ${calf.nunati} est déjà utilisé`, "CONFLICT");
        }
      }

      const sexe = calf.sexe || animal?.sexbov || "F";
      if (!animal) {
        animal = await tx.animal.create({
          data: {
            nutrav: calf.nutrav,
            nunati: calf.nunati || `AUTO${calf.nutrav}`,
            numeroNational: calf.nunati || null,
            nobovi: calf.nom || null,
            danais: newDate,
            sexbov: sexe,
            statut: "ACTIF",
            estGenisse: sexe === "F",
            categorie: sexe === "F" ? "VELLE" : null,
            mereId: current.vacheId,
            declarationsAdministratives: {
              create: {
                type: "NAISSANCE",
                statut: "A_DECLARER",
                service: config?.serviceDeclaration ?? "AUCUN",
              },
            },
          },
        });
      } else {
        const updateBirthDate = !existingDetail || sameInstant(animal.danais, current.date);
        await tx.animal.update({
          where: { id: animal.id },
          data: {
            nutrav: calf.nutrav,
            ...(calf.nunati
              ? { nunati: calf.nunati, numeroNational: calf.nunati }
              : animal.nunati.startsWith("AUTO")
                ? { nunati: `AUTO${calf.nutrav}`, numeroNational: null }
                : {}),
            nobovi: calf.nom || null,
            sexbov: sexe,
            estGenisse: sexe === "F",
            ...(animal.categorie === null || animal.categorie === "VELLE" ? { categorie: sexe === "F" ? "VELLE" : null } : {}),
            mereId: current.vacheId,
            ...(updateBirthDate ? { danais: newDate } : {}),
          },
        });
      }
      linkedAnimalIds.push(animal.id);
    }

    const detailData = {
      animalId: animal?.id ?? null,
      nutrav: calf.nutrav || null,
      nunati: calf.nunati || null,
      nom: calf.nom || null,
      sexe: calf.sexe || null,
      statut: calf.statut ?? "VIVANT",
    };
    if (existingDetail) {
      await tx.veauVelage.update({ where: { id: existingDetail.id }, data: detailData });
    } else {
      await tx.veauVelage.create({ data: { velageId: id, ...detailData } });
    }
  }

  const primaryAnimalId = linkedAnimalIds[0] ?? null;
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
      jumeaux: input.veaux.length === 2,
    },
  });
  if (activeLot && changedIdentifications.length > 0) {
    const prochainIndex = Math.min(activeLot.quantite, activeLot.prochainIndex + changedIdentifications.length);
    await tx.lotBoucles.update({
      where: { id: activeLot.id },
      data: { prochainIndex, actif: prochainIndex < activeLot.quantite },
    });
  }

  return tx.velage.findUnique({
    where: { id },
    include: { vache: true, veau: true, veauxDetails: { include: { animal: true } } },
  });
}
