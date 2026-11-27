import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { genererNumerosLibresDuLot } from "@/lib/identification";
import {
  obtenirLotBouclesActif,
  obtenirNumerosIdentificationUtilises,
} from "@/lib/lot-boucles";
import { consumesLoopNumber } from "@/lib/velage-safety";
import { shouldResetReproductionAtCalving, automaticReproductionReset } from "@/lib/calving-reproduction-reset";
import { motherUpdateAfterCalving } from "@/lib/herd-renewal";

type VeauSaisi = { nutrav?: string; nunati?: string; sexe?: "M" | "F"; nom?: string; statut?: "VIVANT" | "MORT_NE" };

class CalvingConflict extends Error {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vacheNutrav, date, moment, sousType, capteur, pereNom, notes } = body;
    const pereTaureauId = typeof body.pereTaureauId === "string" ? body.pereTaureauId : null;
    const pereSelectionne = pereTaureauId ? await prisma.taureau.findUnique({ where: { id: pereTaureauId } }) : null;
    if (pereTaureauId && !pereSelectionne) return NextResponse.json({ error: "Père sélectionné introuvable" }, { status: 400 });
    const qualificatif = ["NORMAL", "DIFFICILE", "AVORTEMENT", "MORT_NEE"].includes(body.qualificatif) ? body.qualificatif : "NORMAL";
    if (!vacheNutrav || !date) return NextResponse.json({ error: "La vache et la date sont requises" }, { status: 400 });

    const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav }, include: { _count: { select: { velagesVache: true } } } });
    if (!vache) return NextResponse.json({ error: `Vache ${vacheNutrav} non trouvée` }, { status: 404 });
    const prevTarieFaite = vache.tarieFaite;
    const prevDateTarie = vache.dateTarie;
    const prevCategorie = vache.categorie;
    const prevEstGenisse = vache.estGenisse;
    const calvingDate = new Date(date);
    if (!Number.isFinite(calvingDate.getTime())) return NextResponse.json({ error: "Date de vêlage invalide" }, { status: 400 });
    const isFirstCalving = vache._count.velagesVache === 0;
    const identificationConfig = await prisma.exploitationConfig.findUnique({ where: { id: "singleton" } });
    const lotActif = await obtenirLotBouclesActif();

    let veaux: VeauSaisi[] = Array.isArray(body.veaux) ? body.veaux : [];
    if (!body.veaux && body.veauNutrav) veaux = [{ nutrav: body.veauNutrav, sexe: body.veauSexe, nom: body.veauNom, statut: "VIVANT" }];
    if (qualificatif === "AVORTEMENT") veaux = [];
    if (qualificatif === "MORT_NEE") veaux = (veaux.length ? veaux : [{}]).map((v) => ({ ...v, statut: "MORT_NE" }));
    veaux = veaux.slice(0, 10).map((v) => ({ ...v, nutrav: v.nutrav?.trim().toUpperCase() || undefined, nunati: v.nunati?.trim().toUpperCase() || undefined, nom: v.nom?.trim() || undefined, statut: v.statut === "MORT_NE" ? "MORT_NE" : "VIVANT" }));
    if (veaux.some((v) => v.nutrav && !/^\d{4}$/.test(v.nutrav))) return NextResponse.json({ error: "Le numéro de travail doit contenir 4 chiffres" }, { status: 400 });
    if (veaux.some((v) => v.nunati && v.nutrav !== v.nunati.slice(-4))) return NextResponse.json({ error: "Le numéro de travail doit correspondre aux 4 derniers chiffres du numéro national" }, { status: 400 });
    const restantesDuLot = lotActif
      ? Math.max(0, lotActif.quantite - lotActif.prochainIndex)
      : 0;
    const numerosDuLot = lotActif && restantesDuLot > 0
      ? genererNumerosLibresDuLot(
          lotActif.premierNunati,
          restantesDuLot,
          await obtenirNumerosIdentificationUtilises()
        ).numeros
      : [];
    if (lotActif && veaux.some((v) => consumesLoopNumber(v.statut) && v.nutrav && (!v.nunati || !numerosDuLot.some((numero) => numero.nutrav === v.nutrav && numero.nunati === v.nunati)))) return NextResponse.json({ error: "Cette boucle n'appartient pas au lot actif. Ajoutez un nouveau lot dans les Paramètres." }, { status: 400 });
    if (new Set(veaux.flatMap((v) => v.nutrav ? [v.nutrav] : [])).size !== veaux.filter((v) => v.nutrav).length) return NextResponse.json({ error: "Un numéro de travail est utilisé plusieurs fois" }, { status: 409 });
    if (new Set(veaux.flatMap((v) => v.nunati ? [v.nunati] : [])).size !== veaux.filter((v) => v.nunati).length) return NextResponse.json({ error: "Un numéro national est utilisé plusieurs fois" }, { status: 409 });
    for (const saisi of veaux.filter((v) => v.statut === "MORT_NE")) {
      if (saisi.nutrav && await prisma.veauVelage.findFirst({ where: { nutrav: saisi.nutrav } })) return NextResponse.json({ error: `Le numéro ${saisi.nutrav} est déjà utilisé` }, { status: 409 });
      if (saisi.nunati && (await prisma.veauVelage.findFirst({ where: { nunati: saisi.nunati } }) || await prisma.animal.findUnique({ where: { numeroNational: saisi.nunati } }))) return NextResponse.json({ error: `Le numéro national ${saisi.nunati} est déjà utilisé` }, { status: 409 });
    }

    // Précontrôle avant toute écriture : une filiation déjà confirmée ne doit pas
    // être remplacée, même si l'enregistrement du vêlage échoue ensuite.
    const gestationPrecontrole = await prisma.gestation.findFirst({
      where: { saillie: { animalId: vache.id, date: { lte: calvingDate } }, velage: { is: null }, etat: { in: ["VERT", "GRIS", "ROSE"] } },
      include: { saillie: { include: { taureau: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (pereSelectionne && gestationPrecontrole?.saillie.taureauId && gestationPrecontrole.saillie.taureauId !== pereSelectionne.id) {
      return NextResponse.json({ error: "Père différent de la gestation confirmée" }, { status: 409 });
    }
    const perePrecontrole = pereSelectionne;
    if (perePrecontrole) {
      for (const saisi of veaux.filter(v => v.statut === "VIVANT" && v.nutrav)) {
        const existing = await prisma.animal.findUnique({ where: { nutrav: saisi.nutrav! }, select: { taureauId: true } });
        if (existing?.taureauId && existing.taureauId !== perePrecontrole.id) {
          return NextResponse.json({ error: `Le veau ${saisi.nutrav} possède déjà un autre père fiable. Vérification manuelle nécessaire.` }, { status: 409 });
        }
      }
    }

    const resolus: { saisi: VeauSaisi; animalId: string | null; cree: boolean; precedent?: { sexbov: string; nobovi: string | null; mereId: string | null; danais: Date | null; numeroNational: string | null; taureauId: string | null } }[] = [];
    const gestation = gestationPrecontrole;
    const pereRetenu = pereSelectionne;
    let resetReproduction = false;
    const velage = await prisma.$transaction(async (tx) => {
      const [lastCalving, latestBreeding, motherNow] = await Promise.all([
        tx.velage.findFirst({ where: { vacheId: vache.id }, orderBy: { date: "desc" }, select: { date: true } }),
        tx.saillie.findFirst({ where: { animalId: vache.id }, orderBy: { date: "desc" }, select: { date: true } }),
        tx.animal.findUniqueOrThrow({ where: { id: vache.id }, select: { reproductionEtatModifieAt: true } }),
      ]);
      resetReproduction = shouldResetReproductionAtCalving(calvingDate, lastCalving?.date ?? null, latestBreeding?.date ?? null, motherNow.reproductionEtatModifieAt);
      for (const saisi of veaux) {
        if (saisi.statut === "MORT_NE" || !saisi.nutrav) { resolus.push({ saisi, animalId: null, cree: false }); continue; }
        const dejaLie = await tx.veauVelage.findFirst({ where: { animal: { nutrav: saisi.nutrav } }, include: { velage: true } });
        if (dejaLie) throw new CalvingConflict(`Le veau ${saisi.nutrav} est déjà lié à un vêlage`);
        let animal = await tx.animal.findUnique({ where: { nutrav: saisi.nutrav } });
        const nationalExistant = saisi.nunati ? await tx.animal.findUnique({ where: { numeroNational: saisi.nunati } }) : null;
        const nationalVelageExistant = saisi.nunati ? await tx.veauVelage.findFirst({ where: { nunati: saisi.nunati } }) : null;
        if ((nationalExistant && nationalExistant.id !== animal?.id) || nationalVelageExistant) throw new CalvingConflict(`Le numéro national ${saisi.nunati} est déjà utilisé`);
        let cree = false, precedent;
        if (!animal) {
          const sexe = saisi.sexe ?? "F";
          animal = await tx.animal.create({ data: { nutrav: saisi.nutrav, nunati: saisi.nunati ?? `AUTO${saisi.nutrav}`, numeroNational: saisi.nunati ?? null, nobovi: saisi.nom ?? null, danais: new Date(date), sexbov: sexe, statut: "ACTIF", estGenisse: sexe === "F", categorie: sexe === "F" ? "VELLE" : null, mereId: vache.id, declarationsAdministratives: { create: { type: "NAISSANCE", statut: "A_DECLARER", service: identificationConfig?.serviceDeclaration ?? "AUCUN" } } } });
          cree = true;
        } else {
          precedent = { sexbov: animal.sexbov, nobovi: animal.nobovi, mereId: animal.mereId, danais: animal.danais, numeroNational: animal.numeroNational, taureauId: animal.taureauId };
          await tx.animal.update({ where: { id: animal.id }, data: { mereId: vache.id, danais: new Date(date), ...(saisi.sexe ? { sexbov: saisi.sexe } : {}), ...(saisi.nom ? { nobovi: saisi.nom } : {}), ...(saisi.nunati ? { numeroNational: saisi.nunati } : {}) } });
          const declaration = await tx.declarationAdministrative.findFirst({ where: { animalId: animal.id, type: "NAISSANCE" } });
          if (!declaration) await tx.declarationAdministrative.create({ data: { animalId: animal.id, type: "NAISSANCE", statut: "A_DECLARER", service: identificationConfig?.serviceDeclaration ?? "AUCUN" } });
        }
        resolus.push({ saisi, animalId: animal.id, cree, precedent });
      }
      const premierVivant = resolus.find((v) => v.saisi.statut === "VIVANT" && v.animalId);
      const cree = await tx.velage.create({ data: {
        vacheId: vache.id, veauId: premierVivant?.animalId ?? null, date: new Date(date), moment: moment?.trim() || null, qualificatif,
        sousType: sousType ?? (qualificatif === "NORMAL" ? "SEULE" : null), capteur: capteur ?? null,
        pereNom: pereRetenu?.nopere ?? pereNom ?? gestation?.saillie.taureau?.nopere ?? null, pereNunati: pereRetenu?.nupere ?? gestation?.saillie.taureau?.nupere ?? null,
        jumeaux: veaux.length === 2, nombreVeaux: veaux.length, gestationId: gestation?.id ?? null, notes: notes?.trim() || null,
        veauxDetails: { create: resolus.map((v) => ({ animalId: v.animalId, nutrav: v.saisi.nutrav ?? null, nunati: v.saisi.nunati ?? null, nom: v.saisi.nom ?? null, sexe: v.saisi.sexe ?? null, statut: v.saisi.statut ?? "VIVANT" })) },
      } });
      if (pereRetenu) for (const veau of resolus) if (veau.animalId) {
        const existant = await tx.animal.findUnique({ where: { id: veau.animalId }, select: { taureauId: true } });
        if (existant?.taureauId && existant.taureauId !== pereRetenu.id) throw new CalvingConflict("Filiation existante différente : correction manuelle nécessaire");
        await tx.animal.update({ where: { id: veau.animalId }, data: { taureauId: pereRetenu.id } });
      }
      if (gestation) await tx.gestation.update({ where: { id: gestation.id }, data: { etat: "VELAGE" } });
      await tx.animal.update({
        where: { id: vache.id },
        data: { tarieFaite: false, dateTarie: null, ...motherUpdateAfterCalving(isFirstCalving), ...(resetReproduction ? automaticReproductionReset : {}) },
      });
      return cree;
    });

    if (capteur) await prisma.capteurVelage.updateMany({ where: { numero: capteur }, data: { actif: false, animalNutrav: null, animalNom: null, dateAttribution: null } });
    if (lotActif) {
      const numerosConsommes = new Set(
        veaux.flatMap((veau) =>
          consumesLoopNumber(veau.statut) &&
          numerosDuLot.some(
            (numero) =>
              numero.nunati === veau.nunati && numero.nutrav === veau.nutrav
          ) && veau.nunati
            ? [veau.nunati]
            : []
        )
      ).size;
      if (numerosConsommes > 0) {
        const prochainIndex = Math.min(
          lotActif.quantite,
          lotActif.prochainIndex + numerosConsommes
        );
        await prisma.lotBoucles.update({ where: { id: lotActif.id }, data: { prochainIndex, actif: prochainIndex < lotActif.quantite } });
        if (prochainIndex >= lotActif.quantite) await obtenirLotBouclesActif();
      }
    }
    let undoId = "";
    try {
      const ops: import("@/lib/action-log").RevertStep[] = [{ op: "delete", model: "velage", id: velage.id }, { op: "update", model: "animal", where: { nutrav: vacheNutrav }, data: { tarieFaite: prevTarieFaite, dateTarie: prevDateTarie?.toISOString() ?? null, categorie: prevCategorie, estGenisse: prevEstGenisse, ...(resetReproduction ? { reproductionEtatManuel: vache.reproductionEtatManuel, reproductionEtatPrecedent: vache.reproductionEtatPrecedent, reproductionEtatModifieAt: vache.reproductionEtatModifieAt?.toISOString() ?? null } : {}) } }];
      for (const v of resolus) {
        if (v.cree && v.animalId) ops.push({ op: "delete", model: "animal", id: v.animalId });
        else if (v.precedent && v.saisi.nutrav) ops.push({ op: "update", model: "animal", where: { nutrav: v.saisi.nutrav }, data: { ...v.precedent, danais: v.precedent.danais?.toISOString() ?? null } });
      }
      if (gestation) ops.push({ op: "update", model: "gestation", where: { id: gestation.id }, data: { etat: gestation.etat } });
      undoId = await logAction("CREATE_VELAGE", `Vêlage enregistré pour ${vache.nobovi ?? vacheNutrav}`, ops);
    } catch {}
    return NextResponse.json({ ...velage, vacheId: vache.id, _undoId: undoId }, { status: 201 });
  } catch (error) {
    if (error instanceof CalvingConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("POST /api/velages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
