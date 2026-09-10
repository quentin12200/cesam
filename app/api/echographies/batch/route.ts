import { NextRequest, NextResponse } from "next/server";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logAction, type RevertStep } from "@/lib/action-log";
import { buildStandaloneNegativeEchoPlan } from "@/lib/standalone-negative-echo";

const DUREE_GESTATION = 285;
const SUIVIS_AUTORISES = ["CYCLEE", "METRITE", "METRABOL", "BOLUS"] as const;
type Suivi = (typeof SUIVIS_AUTORISES)[number];

interface EchoBatchInput {
  animalId: string;
  saillieId?: string | null;
  resultat: "PLEINE" | "VIDE";
  joursGestation?: number;
  suivis?: Suivi[];
  remarque?: string;
}

const SUIVI_LABELS: Record<Suivi, string> = {
  CYCLEE: "Cyclée",
  METRITE: "Métrite",
  METRABOL: "Metrabol à prévoir",
  BOLUS: "Bolus à prévoir",
};

function isSuivi(value: unknown): value is Suivi {
  return typeof value === "string" && SUIVIS_AUTORISES.includes(value as Suivi);
}

function buildObservation(input: EchoBatchInput) {
  const suivis = (Array.isArray(input.suivis) ? input.suivis : []).filter(isSuivi).map((suivi) => SUIVI_LABELS[suivi]);
  const remarque = typeof input.remarque === "string" ? input.remarque.trim() : "";
  return [...suivis, remarque].filter(Boolean).join(" · ") || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const date = typeof body.date === "string" ? body.date : "";
    const resultats = Array.isArray(body.resultats) ? body.resultats as EchoBatchInput[] : [];
    const dateEcho = new Date(date);

    if (!date || Number.isNaN(dateEcho.getTime())) {
      return NextResponse.json({ error: "La date de la séance est invalide" }, { status: 400 });
    }
    if (resultats.length === 0) {
      return NextResponse.json({ error: "Aucun résultat à enregistrer" }, { status: 400 });
    }
    if (resultats.some((item) => !item?.animalId || !["PLEINE", "VIDE"].includes(item.resultat))) {
      return NextResponse.json({ error: "Un résultat d’échographie est incomplet" }, { status: 400 });
    }
    if (resultats.some((item) => item.resultat === "PLEINE" && (!Number.isFinite(Number(item.joursGestation)) || Number(item.joursGestation) < 1 || Number(item.joursGestation) > 284))) {
      return NextResponse.json({ error: "Le stade de gestation doit être compris entre 1 et 284 jours" }, { status: 400 });
    }
    if (new Set(resultats.map((item) => item.animalId)).size !== resultats.length) {
      return NextResponse.json({ error: "Une vache apparaît plusieurs fois dans la séance" }, { status: 400 });
    }

    const revertSteps: RevertStep[] = [];
    const actionsCreees: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const input of resultats) {
        const animal = await tx.animal.findFirst({
          where: { id: input.animalId, sexbov: "F" },
          select: {
            id: true,
            nutrav: true,
            aEchographier: true,
            reproductionEtatManuel: true,
            reproductionEtatPrecedent: true,
            reproductionEtatModifieAt: true,
            demandesEchographie: {
              where: { etat: "A_FAIRE" },
              select: {
                id: true,
                origine: true,
                etat: true,
                clotureeAt: true,
                requestKey: true,
                observation: true,
                saillieId: true,
              },
            },
          },
        });
        if (!animal) throw new Error("Une vache de la séance est introuvable");

        const observation = buildObservation(input);
        let saillie = input.saillieId
          ? await tx.saillie.findFirst({
              where: { id: input.saillieId, animalId: animal.id },
              include: { gestation: true },
            })
          : null;
        let createdBreedingId: string | null = null;

        if (input.resultat === "PLEINE" && !saillie) {
          const joursGestation = Math.round(Number(input.joursGestation));
          saillie = await tx.saillie.create({
            data: {
              animalId: animal.id,
              date: addDays(dateEcho, -joursGestation),
              type: "NATURELLE",
              estimation: true,
              taureauId: null,
            },
            include: { gestation: true },
          });
          createdBreedingId = saillie.id;
        }

        revertSteps.push({
          op: "update",
          model: "animal",
          where: { id: animal.id },
          data: {
            aEchographier: animal.aEchographier,
            reproductionEtatManuel: animal.reproductionEtatManuel,
            reproductionEtatPrecedent: animal.reproductionEtatPrecedent,
            reproductionEtatModifieAt: animal.reproductionEtatModifieAt,
          },
        });

        if (!saillie) {
          const plan = buildStandaloneNegativeEchoPlan(animal, dateEcho, observation ?? undefined);
          await tx.animal.update({ where: { id: animal.id }, data: plan.animalUpdate });
          for (const update of plan.requestUpdates) {
            const previous = animal.demandesEchographie.find((item) => item.id === update.id);
            if (previous) {
              revertSteps.push({
                op: "update",
                model: "demandeEchographie",
                where: { id: previous.id },
                data: {
                  etat: previous.etat,
                  clotureeAt: previous.clotureeAt,
                  requestKey: previous.requestKey,
                  observation: previous.observation,
                },
              });
            }
            await tx.demandeEchographie.update({ where: { id: update.id }, data: update.data });
          }
          if (plan.requestCreate) {
            const created = await tx.demandeEchographie.create({ data: plan.requestCreate, select: { id: true } });
            revertSteps.push({ op: "delete", model: "demandeEchographie", id: created.id });
          }
        } else {
          const joursGestation = input.resultat === "PLEINE"
            ? Math.max(1, Math.min(284, Math.round(Number(input.joursGestation) || 1)))
            : null;
          const gestationData = {
            etat: input.resultat === "PLEINE" ? "VERT" : "ROUGE",
            dateEcho,
            resultatEcho: input.resultat,
            observationEcho: observation,
            joursGestation,
            dateVelagePrevue: joursGestation ? addDays(dateEcho, DUREE_GESTATION - joursGestation) : null,
            updatedAt: new Date(),
          };

          if (saillie.gestation) {
            revertSteps.push({
              op: "update",
              model: "gestation",
              where: { id: saillie.gestation.id },
              data: {
                etat: saillie.gestation.etat,
                dateEcho: saillie.gestation.dateEcho,
                resultatEcho: saillie.gestation.resultatEcho,
                observationEcho: saillie.gestation.observationEcho,
                joursGestation: saillie.gestation.joursGestation,
                dateVelagePrevue: saillie.gestation.dateVelagePrevue,
              },
            });
            await tx.gestation.update({ where: { id: saillie.gestation.id }, data: gestationData });
          } else {
            const created = await tx.gestation.create({ data: { saillieId: saillie.id, ...gestationData }, select: { id: true } });
            revertSteps.push({ op: "delete", model: "gestation", id: created.id });
          }
          if (createdBreedingId) {
            revertSteps.push({ op: "delete", model: "saillie", id: createdBreedingId });
          }

          const requestsToClose = animal.demandesEchographie.filter((item) => item.saillieId === null || item.saillieId === saillie.id);
          for (const echoRequest of requestsToClose) {
            revertSteps.push({
              op: "update",
              model: "demandeEchographie",
              where: { id: echoRequest.id },
              data: {
                etat: echoRequest.etat,
                clotureeAt: echoRequest.clotureeAt,
                requestKey: echoRequest.requestKey,
                observation: echoRequest.observation,
              },
            });
            await tx.demandeEchographie.update({
              where: { id: echoRequest.id },
              data: {
                etat: "REALISEE",
                clotureeAt: dateEcho,
                observation: observation ?? echoRequest.observation,
                ...(echoRequest.origine === "MANUELLE" ? { requestKey: null } : {}),
              },
            });
          }
          const remainingRequests = await tx.demandeEchographie.count({
            where: { animalId: animal.id, etat: "A_FAIRE" },
          });
          await tx.animal.update({
            where: { id: animal.id },
            data: {
              aEchographier: remainingRequests > 0,
              reproductionEtatManuel: null,
              reproductionEtatPrecedent: animal.reproductionEtatManuel,
              reproductionEtatModifieAt: dateEcho,
            },
          });
        }

        const suivis = input.resultat === "VIDE" && Array.isArray(input.suivis) ? input.suivis.filter(isSuivi) : [];
        for (const suivi of suivis) {
          if (suivi === "CYCLEE") continue;
          const type = SUIVI_LABELS[suivi];
          const evenement = await tx.evenementSanitaire.create({
            data: {
              animalId: animal.id,
              categorie: "REPRODUCTION",
              type,
              date: dateEcho,
              description: [
                `Signalé pendant l’échographie du ${dateEcho.toLocaleDateString("fr-FR")}.`,
                typeof input.remarque === "string" ? input.remarque.trim() : "",
              ].filter(Boolean).join(" "),
              resolu: false,
              updatedAt: new Date(),
            },
            select: { id: true },
          });
          actionsCreees.push(type);
          revertSteps.push({ op: "delete", model: "evenementSanitaire", id: evenement.id });
        }
      }
    });

    const description = `${resultats.length} résultat${resultats.length > 1 ? "s" : ""} d’échographie enregistré${resultats.length > 1 ? "s" : ""}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_ECHOGRAPHIE_BATCH", description, revertSteps);
    } catch {}

    return NextResponse.json({
      count: resultats.length,
      actionsCount: actionsCreees.length,
      _undoId: undoId,
      _undoDesc: description,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/echographies/batch error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erreur serveur",
    }, { status: 500 });
  }
}
