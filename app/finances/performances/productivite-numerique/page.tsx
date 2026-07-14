export const dynamic = "force-dynamic";

import BackButton from "@/app/components/BackButton";
import { prisma } from "@/lib/prisma";
import { CalendarDays, ChevronDown, Percent, Venus } from "lucide-react";

interface AnimalDetail {
  id: string;
  nutrav: string;
  nom: string | null;
  date: Date;
}

interface AnneeProductivite {
  annee: number;
  femelles: AnimalDetail[];
  veauxSevres: AnimalDetail[];
  veauxVendusAvantSevrage: AnimalDetail[];
  taux: number | null;
}

function estVeau(categorie: string | null | undefined) {
  const valeur = (categorie ?? "").trim().toUpperCase();
  return valeur.startsWith("VEAU") || valeur === "VELLE" || valeur === "VEAUX";
}

function estVenteVif(type: string, modeVente: string | null | undefined) {
  return modeVente?.toUpperCase() === "VIF" || type === "ELEVAGE";
}

function venduAvantSevrage(dateVente: Date, animal: {
  danais: Date;
  dateSevrage: Date | null;
  sevreFait: boolean;
}) {
  if (animal.dateSevrage) return dateVente < animal.dateSevrage;
  const ageJours = Math.floor((dateVente.getTime() - animal.danais.getTime()) / 86_400_000);
  return !animal.sevreFait && ageJours >= 0 && ageJours <= 365;
}

async function getProductivite(): Promise<AnneeProductivite[]> {
  const anneeCourante = new Date().getFullYear();
  const premiereAnnee = anneeCourante - 5;
  const debut = new Date(`${premiereAnnee}-01-01T00:00:00`);

  const [saillies, veauxSevres, sorties, ventesHistoriques] = await Promise.all([
    prisma.saillie.findMany({
      where: { date: { gte: debut }, animal: { sexbov: "F" } },
      select: {
        date: true,
        animal: { select: { id: true, nutrav: true, nobovi: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.animal.findMany({
      where: { dateSevrage: { gte: debut } },
      select: { id: true, nutrav: true, nobovi: true, dateSevrage: true },
      orderBy: { dateSevrage: "asc" },
    }),
    prisma.sortie.findMany({
      where: { date: { gte: debut }, type: { not: "MORT" } },
      select: {
        id: true,
        date: true,
        type: true,
        modeVente: true,
        categorieSortie: true,
        animal: {
          select: {
            id: true,
            nutrav: true,
            nobovi: true,
            danais: true,
            categorie: true,
            dateSevrage: true,
            sevreFait: true,
            velageVeau: { select: { id: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.venteHistorique.findMany({
      where: { date: { gte: debut } },
      select: {
        id: true,
        date: true,
        typeAnimal: true,
        typeVente: true,
        nutrav: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const nutravsHistoriques = [...new Set(
    ventesHistoriques.map((vente) => vente.nutrav).filter((nutrav): nutrav is string => Boolean(nutrav))
  )];
  const animauxHistoriques = nutravsHistoriques.length > 0
    ? await prisma.animal.findMany({
        where: { nutrav: { in: nutravsHistoriques } },
        select: {
          id: true,
          nutrav: true,
          nobovi: true,
          danais: true,
          categorie: true,
          dateSevrage: true,
          sevreFait: true,
          velageVeau: { select: { id: true } },
        },
      })
    : [];
  const animauxParNutrav = new Map(animauxHistoriques.map((animal) => [animal.nutrav, animal]));

  const resultats = new Map<number, {
    femelles: Map<string, AnimalDetail>;
    veauxSevres: Map<string, AnimalDetail>;
    veauxVendus: Map<string, AnimalDetail>;
  }>();

  for (let annee = premiereAnnee; annee <= anneeCourante; annee += 1) {
    resultats.set(annee, {
      femelles: new Map(),
      veauxSevres: new Map(),
      veauxVendus: new Map(),
    });
  }

  for (const saillie of saillies) {
    const ligne = resultats.get(saillie.date.getFullYear());
    ligne?.femelles.set(saillie.animal.id, {
      id: saillie.animal.id,
      nutrav: saillie.animal.nutrav,
      nom: saillie.animal.nobovi,
      date: saillie.date,
    });
  }

  for (const veau of veauxSevres) {
    if (!veau.dateSevrage) continue;
    const ligne = resultats.get(veau.dateSevrage.getFullYear());
    ligne?.veauxSevres.set(veau.id, {
      id: veau.id,
      nutrav: veau.nutrav,
      nom: veau.nobovi,
      date: veau.dateSevrage,
    });
  }

  const ventesReelles = new Set<string>();
  for (const sortie of sorties) {
    const animal = sortie.animal;
    const categorieVeau = Boolean(animal.velageVeau) || estVeau(sortie.categorieSortie) || estVeau(animal.categorie);
    if (!categorieVeau || !estVenteVif(sortie.type, sortie.modeVente)) continue;
    if (!venduAvantSevrage(sortie.date, animal)) continue;

    const ligne = resultats.get(sortie.date.getFullYear());
    ligne?.veauxVendus.set(animal.id, {
      id: animal.id,
      nutrav: animal.nutrav,
      nom: animal.nobovi,
      date: sortie.date,
    });
    ventesReelles.add(`${animal.nutrav}-${sortie.date.getFullYear()}`);
  }

  for (const vente of ventesHistoriques) {
    if (vente.typeVente.trim().toLowerCase() !== "vif" || !estVeau(vente.typeAnimal)) continue;
    if (!vente.nutrav || ventesReelles.has(`${vente.nutrav}-${vente.date.getFullYear()}`)) continue;
    const animal = animauxParNutrav.get(vente.nutrav);
    if (!animal || !venduAvantSevrage(vente.date, animal)) continue;

    const ligne = resultats.get(vente.date.getFullYear());
    ligne?.veauxVendus.set(animal.id, {
      id: animal.id,
      nutrav: animal.nutrav,
      nom: animal.nobovi,
      date: vente.date,
    });
  }

  return [...resultats.entries()].map(([annee, groupes]) => {
    const femelles = [...groupes.femelles.values()];
    const veauxSevresAnnee = [...groupes.veauxSevres.values()];
    const veauxVendus = [...groupes.veauxVendus.values()].filter(
      (veau) => !groupes.veauxSevres.has(veau.id)
    );
    const obtenus = veauxSevresAnnee.length + veauxVendus.length;
    return {
      annee,
      femelles,
      veauxSevres: veauxSevresAnnee,
      veauxVendusAvantSevrage: veauxVendus,
      taux: femelles.length > 0 ? Math.round((obtenus / femelles.length) * 1000) / 10 : null,
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

function ListeAnimaux({ titre, animaux }: { titre: string; animaux: AnimalDetail[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">{titre} ({animaux.length})</p>
      {animaux.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun animal compté</p>
      ) : (
        <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
          {animaux.map((animal) => (
            <div key={animal.id} className="min-h-10 flex items-center gap-2 py-2 text-sm">
              <span className="font-semibold text-green-700">{animal.nutrav}</span>
              <span className="min-w-0 flex-1 truncate text-gray-700">{animal.nom || "Sans nom"}</span>
              <span className="text-xs text-gray-400">{formatDate(animal.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ProductiviteNumeriquePage() {
  const resultats = await getProductivite();
  const anneeCourante = new Date().getFullYear();
  const actuel = resultats.find((item) => item.annee === anneeCourante) ?? resultats[resultats.length - 1];
  const maximum = Math.max(...resultats.map((item) => item.taux ?? 0), 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-3 mt-2">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50" iconSize={18} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-800">Productivité numérique</h2>
            <p className="text-xs text-gray-500">Veaux obtenus pour 100 femelles mises à la reproduction</p>
          </div>
        </div>

        {actuel && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-green-700" />
              <h3 className="font-semibold text-gray-800">{actuel.annee}</h3>
              <span className="ml-auto text-2xl font-bold text-green-700">{formatTaux(actuel.taux)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <Venus size={17} className="text-gray-500 mb-2" />
                <p className="text-xl font-bold text-gray-800">{actuel.femelles.length}</p>
                <p className="text-xs text-gray-500">Femelles mises à la reproduction</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-xl font-bold text-gray-800">{actuel.veauxSevres.length}</p>
                <p className="text-xs text-gray-500">Veaux sevrés</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-xl font-bold text-gray-800">{actuel.veauxVendusAvantSevrage.length}</p>
                <p className="text-xs text-gray-500">Vendus vifs avant sevrage</p>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Percent size={18} className="text-green-700" />
            <h3 className="font-semibold text-gray-800">Évolution par année</h3>
          </div>
          {resultats.slice().reverse().map((resultat) => (
            <details key={resultat.annee} className="group bg-white border border-gray-200 rounded-lg overflow-hidden">
              <summary className="min-h-14 cursor-pointer list-none flex items-center gap-3 px-3 py-2">
                <span className="w-12 font-bold text-gray-800">{resultat.annee}</span>
                <div className="min-w-0 flex-1">
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{ width: `${resultat.taux == null ? 0 : Math.min((resultat.taux / maximum) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {resultat.veauxSevres.length} sevrés + {resultat.veauxVendusAvantSevrage.length} vendus vifs / {resultat.femelles.length} femelles
                  </p>
                </div>
                <span className="font-bold text-green-700">{formatTaux(resultat.taux)}</span>
                <ChevronDown size={17} className="text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="border-t border-gray-100 p-3 space-y-4">
                <ListeAnimaux titre="Femelles mises à la reproduction" animaux={resultat.femelles} />
                <ListeAnimaux titre="Veaux sevrés sur l'exploitation" animaux={resultat.veauxSevres} />
                <ListeAnimaux titre="Veaux vendus vifs avant sevrage" animaux={resultat.veauxVendusAvantSevrage} />
              </div>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
