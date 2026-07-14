export const dynamic = "force-dynamic";

import BackButton from "@/app/components/BackButton";
import { prisma } from "@/lib/prisma";
import { CalendarDays, ChevronDown, HeartPulse } from "lucide-react";

interface VelageDetail {
  id: string;
  vacheNutrav: string;
  vacheNom: string | null;
  date: Date;
  totalVeaux: number;
  mortsNes: number;
}

interface MortDetail {
  id: string;
  nutrav: string;
  nom: string | null;
  dateNaissance: Date;
  dateMort: Date;
  cause: string | null;
}

interface AnneeMortalite {
  annee: number;
  naissances: VelageDetail[];
  totalNes: number;
  nesVivants: number;
  mortsNes: number;
  mortsAvantSevrage: MortDetail[];
  tauxMortsNes: number | null;
  tauxAvantSevrage: number | null;
  tauxTotal: number | null;
}

function decompositionVelage(qualificatif: string, sousType: string | null) {
  const principal = qualificatif.trim().toUpperCase();
  const precision = sousType?.trim().toUpperCase() ?? "";

  if (principal === "AVORTEMENT") return { total: 0, mortsNes: 0, vivants: 0 };
  if (principal === "MORT_NEE" || principal === "MORT_NÉE") {
    return { total: 1, mortsNes: 1, vivants: 0 };
  }
  if (principal === "JUMEAUX") {
    if (precision === "DEUX_MORTS") return { total: 2, mortsNes: 2, vivants: 0 };
    if (precision === "UN_MORT") return { total: 2, mortsNes: 1, vivants: 1 };
    return { total: 2, mortsNes: 0, vivants: 2 };
  }
  return { total: 1, mortsNes: 0, vivants: 1 };
}

function mortAvantSevrage(dateMort: Date, animal: {
  danais: Date;
  dateSevrage: Date | null;
  sevreFait: boolean;
}) {
  if (animal.dateSevrage) return dateMort < animal.dateSevrage;
  const ageJours = Math.floor((dateMort.getTime() - animal.danais.getTime()) / 86_400_000);
  return !animal.sevreFait && ageJours >= 0 && ageJours <= 365;
}

async function getMortalite(): Promise<AnneeMortalite[]> {
  const anneeCourante = new Date().getFullYear();
  const premiereAnnee = anneeCourante - 5;
  const debutNaissances = new Date(`${premiereAnnee}-01-01T00:00:00`);

  const [velages, sortiesMort, mortsHistoriques] = await Promise.all([
    prisma.velage.findMany({
      where: { date: { gte: debutNaissances } },
      select: {
        id: true,
        date: true,
        qualificatif: true,
        sousType: true,
        vache: { select: { nutrav: true, nobovi: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.sortie.findMany({
      where: { type: "MORT", date: { gte: debutNaissances } },
      select: {
        id: true,
        date: true,
        causeMortalite: true,
        animal: {
          select: {
            id: true,
            nutrav: true,
            nobovi: true,
            danais: true,
            dateSevrage: true,
            sevreFait: true,
            velageVeau: {
              select: { date: true, qualificatif: true, sousType: true },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.venteHistorique.findMany({
      where: { date: { gte: debutNaissances } },
      select: {
        id: true,
        date: true,
        nutrav: true,
        typeVente: true,
        causeMortalite: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const nutravsHistoriques = [...new Set(
    mortsHistoriques
      .filter((item) => item.causeMortalite || item.typeVente.trim().toLowerCase().includes("mort"))
      .map((item) => item.nutrav)
      .filter((nutrav): nutrav is string => Boolean(nutrav))
  )];
  const animauxHistoriques = nutravsHistoriques.length > 0
    ? await prisma.animal.findMany({
        where: { nutrav: { in: nutravsHistoriques } },
        select: {
          id: true,
          nutrav: true,
          nobovi: true,
          danais: true,
          dateSevrage: true,
          sevreFait: true,
          velageVeau: {
            select: { date: true, qualificatif: true, sousType: true },
          },
        },
      })
    : [];
  const animauxParNutrav = new Map(animauxHistoriques.map((animal) => [animal.nutrav, animal]));

  const annees = new Map<number, {
    naissances: VelageDetail[];
    totalNes: number;
    nesVivants: number;
    mortsNes: number;
    mortsAvantSevrage: Map<string, MortDetail>;
  }>();

  for (let annee = premiereAnnee; annee <= anneeCourante; annee += 1) {
    annees.set(annee, {
      naissances: [],
      totalNes: 0,
      nesVivants: 0,
      mortsNes: 0,
      mortsAvantSevrage: new Map(),
    });
  }

  for (const velage of velages) {
    const compte = decompositionVelage(velage.qualificatif, velage.sousType);
    if (compte.total === 0) continue;
    const ligne = annees.get(velage.date.getFullYear());
    if (!ligne) continue;
    ligne.totalNes += compte.total;
    ligne.nesVivants += compte.vivants;
    ligne.mortsNes += compte.mortsNes;
    ligne.naissances.push({
      id: velage.id,
      vacheNutrav: velage.vache.nutrav,
      vacheNom: velage.vache.nobovi,
      date: velage.date,
      totalVeaux: compte.total,
      mortsNes: compte.mortsNes,
    });
  }

  const mortsReelles = new Set<string>();
  for (const sortie of sortiesMort) {
    const animal = sortie.animal;
    const velage = animal.velageVeau;
    if (!velage || velage.date < debutNaissances) continue;
    if (decompositionVelage(velage.qualificatif, velage.sousType).vivants === 0) continue;
    if (!mortAvantSevrage(sortie.date, animal)) continue;

    const ligne = annees.get(velage.date.getFullYear());
    ligne?.mortsAvantSevrage.set(animal.id, {
      id: animal.id,
      nutrav: animal.nutrav,
      nom: animal.nobovi,
      dateNaissance: velage.date,
      dateMort: sortie.date,
      cause: sortie.causeMortalite,
    });
    mortsReelles.add(animal.nutrav);
  }

  for (const historique of mortsHistoriques) {
    const estMort = Boolean(historique.causeMortalite) || historique.typeVente.trim().toLowerCase().includes("mort");
    if (!estMort || !historique.nutrav || mortsReelles.has(historique.nutrav)) continue;
    const animal = animauxParNutrav.get(historique.nutrav);
    const velage = animal?.velageVeau;
    if (!animal || !velage || velage.date < debutNaissances) continue;
    if (decompositionVelage(velage.qualificatif, velage.sousType).vivants === 0) continue;
    if (!mortAvantSevrage(historique.date, animal)) continue;

    const ligne = annees.get(velage.date.getFullYear());
    ligne?.mortsAvantSevrage.set(animal.id, {
      id: animal.id,
      nutrav: animal.nutrav,
      nom: animal.nobovi,
      dateNaissance: velage.date,
      dateMort: historique.date,
      cause: historique.causeMortalite,
    });
  }

  return [...annees.entries()].map(([annee, ligne]) => {
    const mortsApresNaissance = [...ligne.mortsAvantSevrage.values()];
    const pertesTotales = ligne.mortsNes + mortsApresNaissance.length;
    return {
      annee,
      naissances: ligne.naissances,
      totalNes: ligne.totalNes,
      nesVivants: ligne.nesVivants,
      mortsNes: ligne.mortsNes,
      mortsAvantSevrage: mortsApresNaissance,
      tauxMortsNes: ligne.totalNes > 0 ? Math.round((ligne.mortsNes / ligne.totalNes) * 1000) / 10 : null,
      tauxAvantSevrage: ligne.nesVivants > 0 ? Math.round((mortsApresNaissance.length / ligne.nesVivants) * 1000) / 10 : null,
      tauxTotal: ligne.totalNes > 0 ? Math.round((pertesTotales / ligne.totalNes) * 1000) / 10 : null,
    };
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR");
}

function formatTaux(taux: number | null) {
  if (taux == null) return "—";
  return `${Number.isInteger(taux) ? taux.toFixed(0) : taux.toFixed(1)} %`;
}

function ListeVelages({ velages }: { velages: VelageDetail[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">Vêlages comptés ({velages.length})</p>
      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
        {velages.map((velage) => (
          <div key={velage.id} className="min-h-10 flex items-center gap-2 py-2 text-sm">
            <span className="font-semibold text-green-700">{velage.vacheNutrav}</span>
            <span className="min-w-0 flex-1 truncate text-gray-700">{velage.vacheNom || "Sans nom"}</span>
            <span className="text-xs text-gray-400">
              {formatDate(velage.date)} · {velage.totalVeaux} veau{velage.totalVeaux > 1 ? "x" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListeMortsNes({ velages }: { velages: VelageDetail[] }) {
  const mortsNes = velages.filter((velage) => velage.mortsNes > 0);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">Morts-nés ({mortsNes.reduce((total, item) => total + item.mortsNes, 0)})</p>
      {mortsNes.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun mort-né</p>
      ) : (
        <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
          {mortsNes.map((velage) => (
            <div key={velage.id} className="min-h-10 flex items-center gap-2 py-2 text-sm">
              <span className="font-semibold text-red-700">{velage.vacheNutrav}</span>
              <span className="min-w-0 flex-1 truncate text-gray-700">Vêlage de {velage.vacheNom || "Sans nom"}</span>
              <span className="text-xs text-gray-400">{formatDate(velage.date)} · {velage.mortsNes}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListeMortsAvantSevrage({ animaux }: { animaux: MortDetail[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">Nés vivants puis morts avant sevrage ({animaux.length})</p>
      {animaux.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun veau compté</p>
      ) : (
        <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
          {animaux.map((animal) => (
            <div key={animal.id} className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-red-700">{animal.nutrav}</span>
                <span className="min-w-0 flex-1 truncate text-gray-700">{animal.nom || "Sans nom"}</span>
                <span className="text-xs text-gray-400">{formatDate(animal.dateMort)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Né le {formatDate(animal.dateNaissance)}{animal.cause ? ` · ${animal.cause}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function MortaliteVeauxPage() {
  const resultats = await getMortalite();
  const anneeCourante = new Date().getFullYear();
  const actuel = resultats.find((item) => item.annee === anneeCourante) ?? resultats[resultats.length - 1];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-3 mt-2">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50" iconSize={18} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-800">Mortalité des veaux</h2>
            <p className="text-xs text-gray-500">Morts-nés et mortalité avant sevrage</p>
          </div>
        </div>

        {actuel && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-green-700" />
              <h3 className="font-semibold text-gray-800">{actuel.annee}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Veaux nés</p>
                <p className="text-xl font-bold text-gray-800">{actuel.totalNes}</p>
                <p className="text-[11px] text-gray-400">{actuel.nesVivants} nés vivants</p>
              </div>
              <div className="bg-white border border-red-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Morts-nés</p>
                <p className="text-xl font-bold text-red-700">{actuel.mortsNes}</p>
                <p className="text-[11px] text-gray-400">{formatTaux(actuel.tauxMortsNes)} des naissances</p>
              </div>
              <div className="bg-white border border-red-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Morts avant sevrage</p>
                <p className="text-xl font-bold text-red-700">{actuel.mortsAvantSevrage.length}</p>
                <p className="text-[11px] text-gray-400">{formatTaux(actuel.tauxAvantSevrage)} des nés vivants</p>
              </div>
              <div className="bg-white border border-gray-300 rounded-lg p-3">
                <p className="text-xs text-gray-500">Pertes totales</p>
                <p className="text-xl font-bold text-gray-800">{formatTaux(actuel.tauxTotal)}</p>
                <p className="text-[11px] text-gray-400">Morts-nés + avant sevrage</p>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <HeartPulse size={18} className="text-red-700" />
            <h3 className="font-semibold text-gray-800">Évolution par année</h3>
          </div>
          {resultats.slice().reverse().map((resultat) => (
            <details key={resultat.annee} className="group bg-white border border-gray-200 rounded-lg overflow-hidden">
              <summary className="min-h-16 cursor-pointer list-none flex items-center gap-3 px-3 py-2">
                <span className="w-12 font-bold text-gray-800">{resultat.annee}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{formatTaux(resultat.tauxTotal)}</span> de pertes totales
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {resultat.mortsNes} morts-nés · {resultat.mortsAvantSevrage.length} avant sevrage · {resultat.totalNes} nés
                  </p>
                </div>
                <ChevronDown size={17} className="text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="border-t border-gray-100 p-3 space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Morts-nés</p>
                    <p className="font-bold text-red-700">{formatTaux(resultat.tauxMortsNes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avant sevrage</p>
                    <p className="font-bold text-red-700">{formatTaux(resultat.tauxAvantSevrage)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-gray-800">{formatTaux(resultat.tauxTotal)}</p>
                  </div>
                </div>
                <ListeVelages velages={resultat.naissances} />
                <ListeMortsNes velages={resultat.naissances} />
                <ListeMortsAvantSevrage animaux={resultat.mortsAvantSevrage} />
              </div>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
