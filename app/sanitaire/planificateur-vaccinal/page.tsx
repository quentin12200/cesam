export const dynamic = "force-dynamic";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, CalendarDays, Syringe } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  determinerProchaineInjection,
  statutDateVaccinale,
  type StatutProtocoleVaccinal,
  type TypeInjectionVaccinale,
} from "@/lib/vaccine-planner";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

function typeInjectionDepuisEtape(etape: { cycle: string; ordre: number; label: string } | null): TypeInjectionVaccinale | null {
  if (!etape) return null;
  if (etape.cycle === "ENTRETIEN") return "ENTRETIEN";
  if (etape.ordre === 0 || /primo\s*1|1\s*\/\s*2/i.test(etape.label)) return "PRIMO_1";
  if (etape.ordre === 1 || /rappel|2\s*\/\s*2/i.test(etape.label)) return "RAPPEL";
  return null;
}

export default async function PlanificateurVaccinalPage({
  searchParams,
}: {
  searchParams: Promise<{ protocole?: string }>;
}) {
  const { protocole: protocoleDemande } = await searchParams;
  const protocoles = await prisma.protocoleVaccin.findMany({
    where: { actif: true, etapes: { some: { reference: "VELAGE" } } },
    include: { etapes: { orderBy: { ordre: "asc" }, include: { medicaments: { include: { medicament: true } } } } },
    orderBy: { ordre: "asc" },
  });
  const protocole = protocoles.find((item) => item.id === protocoleDemande) ?? protocoles[0] ?? null;
  const animaux = protocole ? await prisma.animal.findMany({
    where: { statut: "ACTIF", sexbov: "F", saillies: { some: { gestation: { is: { dateVelagePrevue: { not: null }, etat: { in: ["VERT", "ROSE"] } } } } } },
    select: {
      id: true,
      nutrav: true,
      groupe: { select: { nom: true } },
      localisation: { select: { nom: true } },
      saillies: { where: { gestation: { is: { dateVelagePrevue: { not: null }, etat: { in: ["VERT", "ROSE"] } } } }, orderBy: { date: "desc" }, take: 1, select: { gestation: true } },
      statutsProtocolesVaccinaux: { where: { protocoleId: protocole.id }, take: 1 },
      vaccinations: { where: { protocoleId: protocole.id }, include: { etapeProtocole: { select: { cycle: true, ordre: true, label: true } } }, orderBy: { date: "desc" } },
    },
    orderBy: { nutrav: "asc" },
  }) : [];

  const aujourdhui = new Date();
  const actions = animaux.flatMap((animal) => {
    const gestation = animal.saillies[0]?.gestation;
    if (!gestation?.dateVelagePrevue) return [];
    const statut = (animal.statutsProtocolesVaccinaux[0]?.statut ?? "A_CONFIRMER") as StatutProtocoleVaccinal;
    const faitesCycle = animal.vaccinations.filter((vaccination) => vaccination.gestationId === gestation.id);
    const prochaine = determinerProchaineInjection({
      statut,
      dateVelagePrevue: gestation.dateVelagePrevue,
      vaccinationsCycle: faitesCycle.map((vaccination) => ({
        date: vaccination.date,
        type: (vaccination.typeInjection as TypeInjectionVaccinale | null) || typeInjectionDepuisEtape(vaccination.etapeProtocole),
      })),
    });
    return [{ animal, gestation, statut, ...prochaine, etatDate: prochaine.fenetre ? statutDateVaccinale(aujourdhui, prochaine.fenetre) : null }];
  });
  const aConfirmer = actions.filter((action) => action.aConfirmer).length;
  const aFaire = actions.filter((action) => action.type !== null).length;
  const urgentes = actions.filter((action) => action.etatDate === "URGENT").length;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <div className="flex items-center gap-3"><Link href="/sanitaire" className="rounded-lg bg-white p-2 shadow"><ArrowLeft size={18} /></Link><div><h1 className="text-xl font-bold text-gray-800">Planificateur pré-vêlage</h1><p className="text-xs text-gray-500">Première vue · aucune session n’est enregistrée automatiquement</p></div></div>
      {protocoles.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">{protocoles.map((item) => <Link key={item.id} href={`/sanitaire/planificateur-vaccinal?protocole=${item.id}`} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${item.id === protocole?.id ? "bg-green-700 text-white" : "bg-white text-gray-600"}`}>{item.label}</Link>)}</div>}
      {!protocole ? <div className="rounded-xl bg-white p-5 text-center text-sm text-gray-500">Aucun protocole actif lié au vêlage. Configurez d’abord ses étapes dans Protocoles.</div> : <>
        <section className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-white p-3 shadow"><b className="block text-xl text-gray-800">{aFaire}</b><span className="text-xs text-gray-500">à faire</span></div><div className="rounded-xl bg-orange-50 p-3"><b className="block text-xl text-orange-700">{aConfirmer}</b><span className="text-xs text-orange-700">à confirmer</span></div><div className="rounded-xl bg-red-50 p-3"><b className="block text-xl text-red-700">{urgentes}</b><span className="text-xs text-red-700">urgentes</span></div></section>
        <section className="space-y-2">{actions.map(({ animal, gestation, aConfirmer: actionAConfirmer, type, fenetre, etatDate }) => <article key={animal.id} className="rounded-xl bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><b className="font-mono text-gray-900">{animal.nutrav}</b><p className="text-xs text-gray-500">Vêlage {dateCourte.format(gestation.dateVelagePrevue!)}</p></div>{actionAConfirmer ? <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800"><AlertTriangle size={12} /> Protocole à confirmer</span> : type ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"><Syringe size={12} /> {type === "PRIMO_1" ? "PRIMO 1/2" : type}</span> : <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">Cycle couvert</span>}</div>{fenetre && <div className="mt-2 flex items-center gap-1 text-xs text-gray-600"><CalendarDays size={13} /> {type === "RAPPEL" ? `Rappel le ${dateCourte.format(fenetre.debut)}` : `Possible du ${dateCourte.format(fenetre.debut)} au ${dateCourte.format(fenetre.fin)}`} {etatDate === "URGENT" && <b className="text-red-600">· dernière possibilité proche</b>}</div>}<p className="mt-1 text-xs text-gray-400">{[animal.groupe?.nom, animal.localisation?.nom].filter(Boolean).join(" · ") || "Lot non renseigné"}</p></article>)}</section>
      </>}
    </main>
  );
}
