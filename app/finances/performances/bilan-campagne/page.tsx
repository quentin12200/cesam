export const dynamic = "force-dynamic";

import BackButton from "@/app/components/BackButton";
import { getCampagnesReproduction, type CampagneAnimal, type CampagneVelage } from "@/lib/reproduction-campaign";
import { CalendarRange, ChevronDown } from "lucide-react";

function formatTaux(taux: number | null) {
  if (taux == null) return "—";
  return `${Number.isInteger(taux) ? taux.toFixed(0) : taux.toFixed(1)} %`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR");
}

function ListeAnimaux({ titre, animaux }: { titre: string; animaux: CampagneAnimal[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">{titre} ({animaux.length})</p>
      {animaux.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun animal compté</p>
      ) : (
        <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
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

function ListeVelages({ velages }: { velages: CampagneVelage[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">Femelles ayant vêlé ({velages.length})</p>
      {velages.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun vêlage compté</p>
      ) : (
        <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
          {velages.map((velage) => (
            <div key={velage.id} className="min-h-10 flex items-center gap-2 py-2 text-sm">
              <span className="font-semibold text-green-700">{velage.nutrav}</span>
              <span className="min-w-0 flex-1 truncate text-gray-700">{velage.nom || "Sans nom"}</span>
              <span className="text-xs text-gray-400">{formatDate(velage.date)} · {velage.totalVeaux} veau{velage.totalVeaux > 1 ? "x" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function BilanCampagnePage() {
  const campagnes = await getCampagnesReproduction();
  const anneeCourante = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-3 mt-2">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50" iconSize={18} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-800">Bilan de campagne</h2>
            <p className="text-xs text-gray-500">De la mise à la reproduction jusqu&apos;au sevrage</p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900">
          <CalendarRange size={18} className="shrink-0 mt-0.5" />
          <p>Une campagne porte l&apos;année du vêlage réel ou attendu. Les résultats de la campagne en cours restent provisoires jusqu&apos;au sevrage de tous les veaux.</p>
        </div>

        <section className="space-y-2">
          {campagnes.slice().reverse().map((campagne) => {
            const obtenus = campagne.veauxSevres.length + campagne.veauxVendusAvantSevrage.length;
            return (
              <details key={campagne.annee} open={campagne.annee === anneeCourante} className="group bg-white border border-gray-200 rounded-lg overflow-hidden">
                <summary className="min-h-16 cursor-pointer list-none flex items-center gap-3 px-3 py-2">
                  <div>
                    <p className="font-bold text-gray-800">Campagne {campagne.annee}</p>
                    <p className="text-[11px] text-gray-500">{campagne.femelles.length} femelles · {campagne.velages.length} vêlages · {obtenus} veaux obtenus</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-bold text-green-700">{formatTaux(campagne.productiviteNumerique)}</p>
                    <p className="text-[10px] text-gray-400">productivité</p>
                  </div>
                  <ChevronDown size={17} className="text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>

                <div className="border-t border-gray-100 p-3 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="border border-gray-200 rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-800">{campagne.femelles.length}</p>
                      <p className="text-xs text-gray-500">Mises à la reproduction</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-800">{campagne.pleines.length}</p>
                      <p className="text-xs text-gray-500">Gestantes · {formatTaux(campagne.tauxGestation)}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-800">{campagne.velages.length}</p>
                      <p className="text-xs text-gray-500">Ont vêlé · {formatTaux(campagne.tauxVelage)}</p>
                    </div>
                    <div className="border border-green-200 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-700">{obtenus}</p>
                      <p className="text-xs text-gray-500">Veaux obtenus · {formatTaux(campagne.productiviteNumerique)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2 text-sm">
                    <p><span className="font-bold">{campagne.totalNes}</span> nés</p>
                    <p><span className="font-bold">{campagne.nesVivants}</span> nés vivants</p>
                    <p><span className="font-bold">{campagne.mortsNes}</span> morts-nés</p>
                    <p><span className="font-bold">{campagne.veauxSevres.length}</span> sevrés</p>
                    <p><span className="font-bold">{campagne.veauxVendusAvantSevrage.length}</span> vendus avant sevrage</p>
                  </div>

                  <ListeAnimaux titre="Femelles mises à la reproduction" animaux={campagne.femelles} />
                  <ListeAnimaux titre="Femelles gestantes" animaux={campagne.pleines} />
                  <ListeVelages velages={campagne.velages} />
                  <ListeAnimaux titre="Veaux sevrés" animaux={campagne.veauxSevres} />
                  <ListeAnimaux titre="Veaux vendus vifs avant sevrage" animaux={campagne.veauxVendusAvantSevrage} />
                  <ListeAnimaux titre="Veaux morts avant sevrage" animaux={campagne.mortsAvantSevrage} />
                </div>
              </details>
            );
          })}
        </section>
      </div>
    </div>
  );
}
