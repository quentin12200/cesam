import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

type VeauSaisi = { nutrav?: string; sexe?: "M" | "F"; nom?: string; statut?: "VIVANT" | "MORT_NE" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vacheNutrav, date, sousType, capteur, pereNom } = body;
    const qualificatif = ["NORMAL", "DIFFICILE", "AVORTEMENT", "MORT_NEE"].includes(body.qualificatif) ? body.qualificatif : "NORMAL";
    if (!vacheNutrav || !date) return NextResponse.json({ error: "La vache et la date sont requises" }, { status: 400 });

    const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav } });
    if (!vache) return NextResponse.json({ error: `Vache ${vacheNutrav} non trouvée` }, { status: 404 });
    const prevTarieFaite = vache.tarieFaite;

    let veaux: VeauSaisi[] = Array.isArray(body.veaux) ? body.veaux : [];
    if (!body.veaux && body.veauNutrav) veaux = [{ nutrav: body.veauNutrav, sexe: body.veauSexe, nom: body.veauNom, statut: "VIVANT" }];
    if (qualificatif === "AVORTEMENT") veaux = [];
    if (qualificatif === "MORT_NEE") veaux = (veaux.length ? veaux : [{}]).map((v) => ({ ...v, statut: "MORT_NE" }));
    veaux = veaux.slice(0, 10).map((v) => ({ ...v, nutrav: v.nutrav?.trim().toUpperCase() || undefined, nom: v.nom?.trim() || undefined, statut: v.statut === "MORT_NE" ? "MORT_NE" : "VIVANT" }));

    const resolus: { saisi: VeauSaisi; animalId: string | null; cree: boolean; precedent?: { sexbov: string; nobovi: string | null; mereId: string | null; danais: Date | null } }[] = [];
    for (const saisi of veaux) {
      if (saisi.statut === "MORT_NE" || !saisi.nutrav) { resolus.push({ saisi, animalId: null, cree: false }); continue; }
      const dejaLie = await prisma.veauVelage.findFirst({ where: { animal: { nutrav: saisi.nutrav } }, include: { velage: true } });
      if (dejaLie) return NextResponse.json({ error: `Le veau ${saisi.nutrav} est déjà lié à un vêlage` }, { status: 409 });
      let animal = await prisma.animal.findUnique({ where: { nutrav: saisi.nutrav } });
      let cree = false, precedent;
      if (!animal) {
        const sexe = saisi.sexe ?? "F";
        animal = await prisma.animal.create({ data: { nutrav: saisi.nutrav, nunati: `AUTO${saisi.nutrav}`, nobovi: saisi.nom ?? null, danais: new Date(date), sexbov: sexe, statut: "ACTIF", estGenisse: sexe === "F", categorie: sexe === "F" ? "VELLE" : null, mereId: vache.id } });
        cree = true;
      } else {
        precedent = { sexbov: animal.sexbov, nobovi: animal.nobovi, mereId: animal.mereId, danais: animal.danais };
        await prisma.animal.update({ where: { id: animal.id }, data: { mereId: vache.id, danais: new Date(date), ...(saisi.sexe ? { sexbov: saisi.sexe } : {}), ...(saisi.nom ? { nobovi: saisi.nom } : {}) } });
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
        veauxDetails: { create: resolus.map((v) => ({ animalId: v.animalId, nutrav: v.saisi.nutrav ?? null, nom: v.saisi.nom ?? null, sexe: v.saisi.sexe ?? null, statut: v.saisi.statut ?? "VIVANT" })) },
      } });
      if (gestation) await tx.gestation.update({ where: { id: gestation.id }, data: { etat: "VELAGE" } });
      await tx.animal.update({ where: { id: vache.id }, data: { tarieFaite: false } });
      return cree;
    });

    if (capteur) await prisma.capteurVelage.updateMany({ where: { numero: capteur }, data: { actif: false, animalNutrav: null, animalNom: null, dateAttribution: null } });
    let undoId = "";
    try {
      const ops: import("@/lib/action-log").RevertStep[] = [{ op: "delete", model: "velage", id: velage.id }, { op: "update", model: "animal", where: { nutrav: vacheNutrav }, data: { tarieFaite: prevTarieFaite } }];
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
