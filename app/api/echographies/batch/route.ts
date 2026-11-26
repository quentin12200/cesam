import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ECHO_ACTION_CATEGORY, actionCatalogName, actionLabel, actionKey, normEcho, validateEchoExtras, validEchoDate, type EchoEvent, type EchoAction } from "@/lib/echo-session-extras";
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
  resultat?: "PLEINE" | "VIDE";
  events?: EchoEvent[];
  actions?: EchoAction[];
  bullId?: string;
  breedingDate?: string;
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

    if (!validEchoDate(date)) {
      return NextResponse.json({ error: "La date de la séance est invalide" }, { status: 400 });
    }
    if (resultats.length === 0) {
      return NextResponse.json({ error: "Aucun résultat à enregistrer" }, { status: 400 });
    }
    if (resultats.some((item) => !item?.animalId || (item.resultat!==undefined&&!["PLEINE", "VIDE"].includes(item.resultat))||(!item.resultat&&!item.events?.length&&!item.actions?.length&&!item.bullId))) {
      return NextResponse.json({ error: "Un résultat d’échographie est incomplet" }, { status: 400 });
    }
    if (resultats.some((item) => item.resultat === "PLEINE" && (!Number.isFinite(Number(item.joursGestation)) || Number(item.joursGestation) < 1 || Number(item.joursGestation) > 284))) {
      return NextResponse.json({ error: "Le stade de gestation doit être compris entre 1 et 284 jours" }, { status: 400 });
    }
    if (new Set(resultats.map((item) => item.animalId)).size !== resultats.length) {
      return NextResponse.json({ error: "Une vache apparaît plusieurs fois dans la séance" }, { status: 400 });
    }

    try {for(const item of resultats){validateEchoExtras(item.events??[],item.actions??[],date);if(item.bullId&&(typeof item.bullId!=="string"||item.saillieId))throw Error("Taureau non autorisé");if(item.bullId&&item.resultat!=="PLEINE"&&(!validEchoDate(item.breedingDate)||item.breedingDate>date))throw Error("Date de saillie connue requise");}}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Suivi invalide"},{status:400});}
    const sessionId=typeof body.sessionId==="string"&&/^[a-f0-9-]{36}$/i.test(body.sessionId)?body.sessionId:null;
    const receiptId=sessionId?"echo-session-"+sessionId:null;
    const digest=createHash("sha256").update(JSON.stringify({date,resultats})).digest("hex");
    const description = `${resultats.length} résultat(s) d’échographie enregistré(s)`;
    const revertSteps: RevertStep[] = [];
    const actionsCreees: string[] = [];

    const saved=await prisma.$transaction(async (tx) => {
      if(receiptId){const prior=await tx.actionLog.findUnique({where:{id:receiptId}});if(prior){if(prior.type!=="CREATE_ECHOGRAPHIE_BATCH"||!prior.description.endsWith(digest)||prior.reverted)throw Error("Séance déjà utilisée ou annulée");return {replayed:true,actionsCount:resultats.reduce((n,i)=>n+(i.actions?.length??0),0)};}}
      const catalogue=await tx.typeEvenement.findMany({select:{id:true,nom:true,categorie:true,actif:true}});
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
        if(input.bullId&&!await tx.taureau.findUnique({where:{id:input.bullId},select:{id:true}}))throw Error("Taureau introuvable");
        const events=input.events??[];
        for(const event of events){let entry=event.id?catalogue.find(e=>e.id===event.id&&e.actif&&e.categorie!==ECHO_ACTION_CATEGORY):catalogue.find(e=>e.categorie!==ECHO_ACTION_CATEGORY&&normEcho(e.nom)===normEcho(event.nom));if(event.id&&!entry)throw Error("Événement du catalogue introuvable");if(entry&&!entry.actif)throw Error("Événement désactivé");if(!entry){entry=await tx.typeEvenement.create({data:{nom:event.nom.trim(),categorie:normEcho(event.nom)==="metrite"?"MALADIE":"AUTRE"},select:{id:true,nom:true,categorie:true,actif:true}});catalogue.push(entry);}
          const existing=await tx.evenementSanitaire.findFirst({where:{animalId:animal.id,date:dateEcho,type:entry.nom,symptomes:{some:{typeEvenementId:entry.id}}},select:{id:true}});
          if(!existing){const created=await tx.evenementSanitaire.create({data:{animalId:animal.id,date:dateEcho,type:entry.nom,categorie:entry.categorie,resolu:["cyclee","non cyclee"].includes(normEcho(entry.nom)),description:"Observé pendant la séance d’échographie",symptomes:{create:{libelle:entry.nom,typeEvenementId:entry.id}}},select:{id:true}});revertSteps.push({op:"delete",model:"evenementSanitaire",id:created.id});}
        }
        for(const action of input.actions??[]){
          let entry=catalogue.find(e=>e.categorie===ECHO_ACTION_CATEGORY&&actionKey(actionLabel(e.nom))===actionKey(action.type));
          if(entry&&!entry.actif)throw Error("Action désactivée");
          if(!entry){entry=await tx.typeEvenement.create({data:{nom:actionCatalogName(action.type),categorie:ECHO_ACTION_CATEGORY},select:{id:true,nom:true,categorie:true,actif:true}});catalogue.push(entry);}
          const type=actionLabel(entry.nom);
          const due=new Date(action.due);
          const candidates=await tx.evenementSanitaire.findMany({where:{animalId:animal.id,date:due,categorie:{in:[ECHO_ACTION_CATEGORY,"REPRODUCTION"]}},select:{id:true,type:true}});
          if(!candidates.some(e=>actionKey(e.type)===actionKey(type))){
            const created=await tx.evenementSanitaire.create({data:{animalId:animal.id,categorie:ECHO_ACTION_CATEGORY,type,date:due,resolu:false,description:"Action à prévoir — séance du "+date},select:{id:true}});
            revertSteps.push({op:"delete",model:"evenementSanitaire",id:created.id});actionsCreees.push(type);
          }
        }
        if(!input.resultat&&!input.bullId)continue;
        let saillie = input.saillieId
          ? await tx.saillie.findFirst({
              where: { id: input.saillieId, animalId: animal.id },
              include: { gestation: true },
            })
          : null;
        let createdBreedingId: string | null = null;

        if(input.saillieId&&!saillie)throw Error("Saillie introuvable pour cette vache");
        if (!saillie && (input.resultat === "PLEINE" || input.bullId)) {
          const joursGestation = Math.round(Number(input.joursGestation));
          saillie = await tx.saillie.create({
            data: {
              animalId: animal.id,
              date: input.resultat==="PLEINE"?addDays(dateEcho, -joursGestation):new Date(input.breedingDate!),
              type: "NATURELLE",
              estimation: input.resultat==="PLEINE",
              taureauId: input.bullId??null,
            },
            include: { gestation: true },
          });
          createdBreedingId = saillie.id;
        }

        if(!input.resultat){if(createdBreedingId)revertSteps.push({op:"delete",model:"saillie",id:createdBreedingId});continue;}
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
      if(receiptId)await tx.actionLog.create({data:{id:receiptId,type:"CREATE_ECHOGRAPHIE_BATCH",description:description+" · "+digest,revertData:JSON.stringify(revertSteps)}});
      return {replayed:false,actionsCount:actionsCreees.length};
    },{maxWait:10000,timeout:30000});
    let undoId = receiptId??"";
    try {
      if(!receiptId)undoId = await logAction("CREATE_ECHOGRAPHIE_BATCH", description, revertSteps);
    } catch {}

    return NextResponse.json({
      count: resultats.length,
      actionsCount: saved.actionsCount,
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
