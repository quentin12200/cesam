import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { numeroNationalDuLot } from "@/lib/identification";
import { obtenirLotBouclesActif } from "@/lib/lot-boucles";

type VeauSaisi = { nutrav?: string; nunati?: string; sexe?: "M" | "F"; nom?: string; statut?: "VIVANT" | "MORT_NE" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vacheNutrav, date, sousType, capteur, pereNom } = body;
    const qualificatif = ["NORMAL", "DIFFICILE", "AVORTEMENT", "MORT_NEE"].includes(body.qualificatif) ? body.qualificatif : "NORMAL";
    if (!vacheNutrav || !date) return NextResponse.json({ error: "La vache et la date sont requises" }, { status: 400 });

    const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav } });
    if (!vache) return NextResponse.json({ error: `Vache ${vacheNutrav} non trouvée` }, { status: 404 });
    const prevTarieFaite = vache.tarieFaite;
    const prevDateTarie = vache.dateTarie;
    const identificationConfig = await prisma.exploitationConfig.findUnique({ where: { id: "singleton" } });
    const lotActif = await obtenirLotBouclesActif();

    let veaux: VeauSaisi[] = Array.isArray(body.veaux) ? body.veaux : [];
    if (!body.veaux && body.veauNutrav) veaux = [{ nutrav: body.veauNutrav, sexe: body.veauSexe, nom: body.veauNom, statut: "VIVANT" }];
    if (qualificatif === "AVORTEMENT") veaux = [];
    if (qualificatif === "MORT_NEE") veaux = (veaux.length ? veaux : [{}]).map((v) => ({ ...v, statut: "MORT_NE" }));
    veaux = veaux.slice(0, 10).map((v) => ({ ...v, nutrav: v.nutrav?.trim().toUpperCase() || undefined, nunati: v.nunati?.trim().toUpperCase() || undefined, nom: v.nom?.trim() || undefined, statut: v.statut === "MORT_NE" ? "MORT_NE" : "VIVANT" }));
    if (veaux.some((v) => v.nutrav && !/^\d{4}$/.test(v.nutrav))) return NextResponse.json({ error: "Le numéro de travail doit contenir 4 chiffres" }, { status: 400 });
    if (veaux.some((v) => v.nunati && v.nutrav !== v.nunati.slice(-4))) return NextResponse.json({ error: "Le numéro de travail doit correspondre aux 4 derniers chiffres du numéro national" }, { status: 400 });
    const numerosDuLot = lotActif ? Array.from({ length: lotActif.quantite }, (_, index) => {
      const nunati = numeroNationalDuLot(lotActif.premierNunati, index);
      return { index, nunati, nutrav: nunati.slice(-4) };
    }) : [];
    if (lotActif && veaux.some((v) => v.nutrav && (!v.nunati || !numerosDuLot.some((numero) => numero.nutrav === v.nutrav && numero.nunati === v.nunati)))) return NextResponse.json({ error: "Cette boucle n'appartient pas au lot actif. Ajoutez un nouveau lot dans les Paramètres." }, { status: 400 });
    if (new Set(veaux.flatMap((v) => v.nutrav ? [v.nutrav] : [])).size !== veaux.filter((v) => v.nutrav).length) return NextResponse.json({ error: "Un numéro de travail est utilisé plusieurs fois" }, { status: 409 });
    if (new Set(veaux.flatMap((v) => v.nunati ? [v.nunati] : [])).size !== veaux.filter((v) => v.nunati).length) return NextResponse.json({ error: "Un numéro national est utilisé plusieurs fois" }, { status: 409 });
    for (const saisi of veaux.filter((v) => v.statut === "MORT_NE")) {
      if (saisi.nutrav && await prisma.veauVelage.findFirst({ where: { nutrav: saisi.nutrav } })) return NextResponse.json({ error: `Le numéro ${saisi.nutrav} est déjà utilisé` }, { status: 409 });
      if (saisi.nunati && (await prisma.veauVelage.findFirst({ where: { nunati: saisi.nunati } }) || await prisma.animal.findUnique({ where: { numeroNational: saisi.nunati } }))) return NextResponse.json({ error: `Le numéro national ${saisi.nunati} est déjà utilisé` }, { status: 409 });
    }

    const resolus: { saisi: VeauSaisi; animalId: string | null; cree: boolean; precedent?: { sexbov: string; nobovi: string | null; mereId: string | null; danais: Date | null; numeroNational: string | null } }[] = [];
    for (const saisi of veaux) {
      if (saisi.statut === "MORT_NE" || !saisi.nutrav) { resolus.push({ saisi, animalId: null, cree: false }); continue; }
      const dejaLie = await prisma.veauVelage.findFirst({ where: { animal: { nutrav: saisi.nutrav } }, include: { velage: true } });
      if (dejaLie) return NextResponse.json({ error: `Le veau ${saisi.nutrav} est déjà lié à un vêlage` }, { status: 409 });
      let animal = await prisma.animal.findUnique({ where: { nutrav: saisi.nutrav } });
      const nationalExistant = saisi.nunati ? await prisma.animal.findUnique({ where: { numeroNational: saisi.nunati } }) : null;
      const nationalVelageExistant = saisi.nunati ? await prisma.veauVelage.findFirst({ where: { nunati: saisi.nunati } }) : null;
      if ((nationalExistant && nationalExistant.id !== animal?.id) || nationalVelageExistant) return NextResponse.json({ error: `Le numéro national ${saisi.nunati} est déjà utilisé` }, { status: 409 });
      let cree = false, precedent;
      if (!animal) {
        const sexe = saisi.sexe ?? "F";
        animal = await prisma.animal.create({ data: { nutrav: saisi.nutrav, nunati: saisi.nunati ?? `AUTO${saisi.nutrav}`, numeroNational: saisi.nunati ?? null, nobovi: saisi.nom ?? null, danais: new Date(date), sexbov: sexe, statut: "ACTIF", estGenisse: sexe === "F", categorie: sexe === "F" ? "VELLE" : null, mereId: vache.id, declarationsAdministratives: { create: { type: "NAISSANCE", statut: "A_DECLARER", service: identificationConfig?.serviceDeclaration ?? "AUCUN" } } } });
        cree = true;
      } else {
        precedent = { sexbov: animal.sexbov, nobovi: animal.nobovi, mereId: animal.mereId, danais: animal.danais, numeroNational: animal.numeroNational };
        await prisma.animal.update({ where: { id: animal.id }, data: { mereId: vache.id, danais: new Date(date), ...(saisi.sexe ? { sexbov: saisi.sexe } : {}), ...(saisi.nom ? { nobovi: saisi.nom } : {}), ...(saisi.nunati ? { numeroNational: saisi.nunati } : {}) } });
        const declaration = await prisma.declarationAdministrative.findFirst({ where: { animalId: animal.id, type: "NAISSANCE" } });
        if (!declaration) await prisma.declarationAdministrative.create({ data: { animalId: animal.id, type: "NAISSANCE", statut: "A_DECLARER", service: identificationConfig?.serviceDeclaration ?? "AUCUN" } });
      }
      resolus.push({ saisi, animalId: animal.id, cree, precedent });
    }

    const gestation = await prisma.gestation.findFirst({ where: { saillie: { animalId: vache.id }, etat: { in: ["VERT", "GRIS", "ROSE"] } }, include: { saillie: { include: { taureau: true } } }, orderBy: { createdAt: "desc" } });
    const premierVivant = resolus.find((v) => v.saisi.statut === "VIVANT" && v.animalId);
    const velage = await prisma.$transaction(async (tx) => {
      const cree = await tx.velage.create({ data: {
        vacheId: vache.id, veauId: premierVivant?.animalId ?? null, date: new Date(date), qualificatif,
        sousType: sousType ?? (qualificatif === "NORMAL" ? "SEULE" : null), capteur: capteur ?? null,
        pereNom: pereNom ?? null, pereNunati: gestation?.saillie.taureau?.nupere ?? null,
        jumeaux: veaux.length === 2, nombreVeaux: veaux.length, gestationId: gestation?.id ?? null,
        veauxDetails: { create: resolus.map((v) => ({ animalId: v.animalId, nutrav: v.saisi.nutrav ?? null, nunati: v.saisi.nunati ?? null, nom: v.saisi.nom ?? null, sexe: v.saisi.sexe ?? null, statut: v.saisi.statut ?? "VIVANT" })) },
      } });
      if (gestation) await tx.gestation.update({ where: { id: gestation.id }, data: { etat: "VELAGE" } });
      await tx.animal.update({
        where: { id: vache.id },
        data: { tarieFaite: false, dateTarie: null },
      });
      return cree;
    });

    if (capteur) await prisma.capteurVelage.updateMany({ where: { numero: capteur }, data: { actif: false, animalNutrav: null, animalNom: null, dateAttribution: null } });
    if (lotActif) {
      const indexes = veaux.flatMap((veau) => numerosDuLot.find((numero) => numero.nunati === veau.nunati && numero.nutrav === veau.nutrav)?.index ?? []).filter((index) => index >= lotActif.prochainIndex);
      if (indexes.length) {
        const prochainIndex = Math.max(...indexes) + 1;
        await prisma.lotBoucles.update({ where: { id: lotActif.id }, data: { prochainIndex, actif: prochainIndex < lotActif.quantite } });
        if (prochainIndex >= lotActif.quantite) await obtenirLotBouclesActif();
      }
    }
    let undoId = "";
    try {
      const ops: import("@/lib/action-log").RevertStep[] = [{ op: "delete", model: "velage", id: velage.id }, { op: "update", model: "animal", where: { nutrav: vacheNutrav }, data: { tarieFaite: prevTarieFaite, dateTarie: prevDateTarie?.toISOString() ?? null } }];
      for (const v of resolus) {
        if (v.cree && v.animalId) ops.push({ op: "delete", model: "animal", id: v.animalId });
        else if (v.precedent && v.saisi.nutrav) ops.push({ op: "update", model: "animal", where: { nutrav: v.saisi.nutrav }, data: { ...v.precedent, danais: v.precedent.danais?.toISOString() ?? null } });
      }
      if (gestation) ops.push({ op: "update", model: "gestation", where: { id: gestation.id }, data: { etat: gestation.etat } });
      undoId = await logAction("CREATE_VELAGE", `Vêlage enregistré pour ${vache.nobovi ?? vacheNutrav}`, ops);
    } catch {}
    return NextResponse.json({ ...velage, vacheId: vache.id, _undoId: undoId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/velages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
