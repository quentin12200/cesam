"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCategorie,
  getCategorieLabel,
  getCategorieColor,
  getEtatGestation,
  getBadgeClass,
  formatAgeCompact,
  type EtatGestation,
} from "@/lib/utils";

export interface AnimalRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string; // ISO
  sexbov: string;
  estGenisse: boolean;
  tarieFaite: boolean;
  aEchographier: boolean;
  categorie: string | null;
  groupeNom: string | null;
  saillieDate: string | null;
  gestationEtat: string | null;
  gestationVelagePrevue: string | null;
  velageDate: string | null;
  veauNutrav: string | null;
  veauStatut: string | null;
}

interface Props {
  animaux: AnimalRow[];
  tri?: string;
  urlSortNutrav: string;
  urlSortAgeAsc: string;
  urlSortAgeDesc: string;
}

const ETAT_LABEL: Record<string, string> = {
  VERT: "Pleine",
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "En attente",
  ROUGE: "Vide",
};

export default function TroupeauTableau({
  animaux,
  tri,
  urlSortNutrav,
  urlSortAgeAsc,
  urlSortAgeDesc,
}: Props) {
  const router = useRouter();

  if (animaux.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">
        Aucun animal trouvé
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead>
            <tr className="bg-green-700 text-white text-xs">
              {/* N° Travail */}
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                <Link
                  href={urlSortNutrav}
                  className={`flex items-center gap-1 hover:text-green-200 transition-colors ${!tri ? "text-yellow-300" : ""}`}
                >
                  N° Travail
                  {!tri && <span className="text-yellow-300">▲</span>}
                </Link>
              </th>

              {/* Nom */}
              <th className="px-3 py-2.5 text-left font-semibold">Nom</th>

              {/* Âge */}
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  Âge
                  <span className="flex gap-0.5">
                    <Link
                      href={urlSortAgeAsc}
                      className={`hover:text-green-200 leading-none ${tri === "age_asc" ? "text-yellow-300" : ""}`}
                      title="Plus jeune d'abord"
                    >
                      ↑
                    </Link>
                    <Link
                      href={urlSortAgeDesc}
                      className={`hover:text-green-200 leading-none ${tri === "age_desc" ? "text-yellow-300" : ""}`}
                      title="Plus âgé d'abord"
                    >
                      ↓
                    </Link>
                  </span>
                </span>
              </th>

              {/* Catégorie */}
              <th className="px-3 py-2.5 text-left font-semibold">Catégorie</th>

              {/* Repro */}
              <th className="px-3 py-2.5 text-left font-semibold">Repro</th>

              {/* Tarie */}
              <th className="px-3 py-2.5 text-center font-semibold">Tarie</th>

              {/* À écho */}
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">À écho</th>

              {/* Veau */}
              <th className="px-3 py-2.5 text-left font-semibold">Veau</th>

              {/* Groupe */}
              <th className="px-3 py-2.5 text-left font-semibold">Groupe</th>
            </tr>
          </thead>
          <tbody>
            {animaux.map((animal, i) => {
              const danais = new Date(animal.danais);
              const cat = getCategorie(animal.sexbov, danais, animal.estGenisse, animal.categorie);
              const catLabel = getCategorieLabel(animal.sexbov, danais, animal.estGenisse, animal.categorie);
              const catColor = getCategorieColor(cat);
              const ageStr = formatAgeCompact(danais);

              const etat: EtatGestation | null =
                animal.sexbov === "F" && !animal.estGenisse
                  ? getEtatGestation(
                      animal.saillieDate ? new Date(animal.saillieDate) : null,
                      animal.gestationEtat ?? null,
                      animal.gestationVelagePrevue ? new Date(animal.gestationVelagePrevue) : null,
                      animal.velageDate ? new Date(animal.velageDate) : null
                    )
                  : null;

              const veauActif =
                animal.veauNutrav && animal.veauStatut === "ACTIF" ? animal.veauNutrav : null;

              return (
                <tr
                  key={animal.id}
                  onClick={() => router.push(`/troupeau/${animal.nutrav}`)}
                  className={`border-t border-gray-100 cursor-pointer hover:bg-green-50 transition-colors ${
                    i % 2 === 1 ? "bg-gray-50/50" : ""
                  }`}
                >
                  {/* N° Travail */}
                  <td className="px-3 py-2.5 font-mono font-bold text-green-800 whitespace-nowrap">
                    {animal.nutrav}
                  </td>

                  {/* Nom */}
                  <td className="px-3 py-2.5 text-gray-800 max-w-[140px] truncate">
                    {animal.nobovi ?? <span className="text-gray-400 italic">—</span>}
                  </td>

                  {/* Âge */}
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{ageStr}</td>

                  {/* Catégorie */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catColor}`}>
                      {animal.sexbov === "F" ? "♀" : "♂"} {catLabel}
                    </span>
                  </td>

                  {/* Repro */}
                  <td className="px-3 py-2.5">
                    {etat ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${getBadgeClass(etat)}`}>
                        {ETAT_LABEL[etat] ?? etat}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Tarie */}
                  <td className="px-3 py-2.5 text-center">
                    {animal.tarieFaite ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                        Tarie
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>

                  {/* À écho */}
                  <td className="px-3 py-2.5 text-center">
                    {animal.aEchographier ? (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                        Oui
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>

                  {/* Veau */}
                  <td className="px-3 py-2.5">
                    {veauActif ? (
                      <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        {veauActif}
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>

                  {/* Groupe */}
                  <td className="px-3 py-2.5">
                    {animal.groupeNom ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {animal.groupeNom}
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
