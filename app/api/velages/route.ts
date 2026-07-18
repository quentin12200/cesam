import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vacheNutrav, veauNutrav, veauSexe, veauNom, date, moment, qualificatif, sousType, capteur, pereNom } = body;

    if (!vacheNutrav || !date) {
      return NextResponse.json({ error: "vacheNutrav et date sont requis" }, { status: 400 });
    }

    const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav } });
    if (!vache) {
      return NextResponse.json({ error: `Vache avec NUTRAV ${vacheNutrav} non trouvée` }, { status: 404 });
    }

    const prevTarieFaite = vache.tarieFaite;

    // Résoudre le veau et récupérer ses données avant modif pour undo
    let veauId: string | undefined;
    let veauPrev: { sexbov: string; nobovi: string | null; mereId: string | null; danais: Date | null } | undefined;
    let veauCree = false;
    if (veauNutrav) {
      let veau = await prisma.animal.findUnique({ where: { nutrav: veauNutrav } });
      if (!veau) {
        // Créer le veau automatiquement avec les infos disponibles
        const sexe = veauSexe ?? "F";
        const estFemelle = sexe === "F";
        veau = await prisma.animal.create({
          data: {
            nutrav: veauNutrav,
            nunati: `AUTO${veauNutrav}`,  // placeholder, à mettre à jour avec le vrai N° national
            nobovi: veauNom ?? null,
            danais: new Date(date),
            sexbov: sexe,
            statut: "ACTIF",
            estGenisse: estFemelle,
            categorie: estFemelle ? "VELLE" : null,
            mereId: vache.id,
          },
        });
        veauCree = true;
      } else {
        veauPrev = { sexbov: veau.sexbov, nobovi: veau.nobovi, mereId: veau.mereId, danais: veau.danais };
        const updateData: Record<string, unknown> = {
          mereId: vache.id,
          danais: new Date(date),
        };
        if (veauSexe) updateData.sexbov = veauSexe;
        if (veauNom) updateData.nobovi = veauNom;
        await prisma.animal.update({ where: { nutrav: veauNutrav }, data: updateData });
      }
      veauId = veau.id;
    }

    // Chercher la gestation ouverte la plus récente (même si déjà liée à un vélage orphelin)
    const derniereGestation = await prisma.gestation.findFirst({
      where: {
        saillie: { animalId: vache.id },
        etat: { in: ["VERT", "GRIS", "ROSE"] },
      },
      include: { saillie: { include: { taureau: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Récupérer pereNunati depuis le taureau de la saillie
    const pereNunati = derniereGestation?.saillie?.taureau?.nupere ?? null;
    const isJumeaux = qualificatif === "JUMEAUX";

    // Vérifier que le veau n'est pas déjà lié à un autre vélage
    if (veauId) {
      const veauDejaLie = await prisma.velage.findUnique({ where: { veauId } });
      if (veauDejaLie) {
        // Si c'est le même vélage (même vache, même date) : probablement un doublon d'envoi
        // Dans ce cas on clôture quand même la gestation si elle est encore ouverte
        if (derniereGestation) {
          await prisma.gestation.update({
            where: { id: derniereGestation.id },
            data: { etat: "VELAGE" },
          });
        }
        return NextResponse.json(
          { error: `Ce veau (${veauNutrav}) est déjà enregistré dans un vélage du ${new Date(veauDejaLie.date).toLocaleDateString("fr-FR")}` },
          { status: 409 }
        );
      }
    }

    // Transaction atomique : créer le vélage + clôturer la gestation + mettre à jour la vache
    const [velage] = await prisma.$transaction([
      prisma.velage.create({
        data: {
          vacheId: vache.id,
          veauId: veauId ?? null,
          date: new Date(date),
          moment: moment ?? null,
          qualificatif: qualificatif ?? "NORMAL",
          sousType: sousType ?? null,
          capteur: capteur ?? null,
          pereNom: pereNom ?? null,
          pereNunati: pereNunati ?? null,
          jumeaux: isJumeaux,
          gestationId: derniereGestation?.id ?? null,
        },
      }),
      ...(derniereGestation
        ? [prisma.gestation.update({ where: { id: derniereGestation.id }, data: { etat: "VELAGE" } })]
        : []),
      prisma.animal.update({ where: { nutrav: vacheNutrav }, data: { tarieFaite: false } }),
    ]);

    // Libérer le capteur si utilisé (hors transaction car updateMany non supporté)
    if (capteur) {
      await prisma.capteurVelage.updateMany({
        where: { numero: capteur },
        data: { actif: false, animalNutrav: null, animalNom: null, dateAttribution: null },
      });
    }

    const desc = `Vêlage enregistré pour ${vache.nobovi ?? vacheNutrav}`;
    let undoId = "";
    try {
      const undoOps: import("@/lib/action-log").RevertStep[] = [
        { op: "delete", model: "velage", id: velage.id },
        { op: "update", model: "animal", where: { nutrav: vacheNutrav }, data: { tarieFaite: prevTarieFaite } },
      ];
      if (veauNutrav && veauCree && veauId) {
        // Veau créé automatiquement : l'undo le supprime
        undoOps.push({ op: "delete", model: "animal", id: veauId });
      } else if (veauNutrav && veauPrev) {
        undoOps.push({
          op: "update", model: "animal", where: { nutrav: veauNutrav },
          data: { mereId: veauPrev.mereId ?? null, danais: veauPrev.danais?.toISOString() ?? null, sexbov: veauPrev.sexbov, nobovi: veauPrev.nobovi ?? null },
        });
      }
      if (derniereGestation) {
        undoOps.push({ op: "update", model: "gestation", where: { id: derniereGestation.id }, data: { etat: derniereGestation.etat } });
      }
      undoId = await logAction("CREATE_VELAGE", desc, undoOps);
    } catch {}

    return NextResponse.json({
      ...velage,
      _undoId: undoId,
      _undoDesc: desc,
      _veauCree: veauCree ? veauNutrav : undefined,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/velages error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
