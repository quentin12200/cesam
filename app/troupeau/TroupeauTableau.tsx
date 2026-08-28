"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInDays } from "date-fns";
import {
  getCategorie,
  getCategorieLabel,
  getCategorieColor,
  getEtatGestation,
  formatAgeCompact,
  type EtatGestation,
} from "@/lib/utils";
import ReproductionListBadge from "@/app/components/ReproductionListBadge";
import { getMotherWeaningDisplay } from "@/lib/troupeau-mother-weaning";
import { formatFather, shouldDisplayNonWeaned } from "@/lib/troupeau-display";
import ReproductionCycleSummary, { type ReproductionSummaryRow } from "./ReproductionCycleSummary";

export interface AnimalRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  sexbov: string;
  estGenisse: boolean;
  aEchographier: boolean;
  reproductionEtatManuel: EtatGestation | null;
  reproductionEtatPrecedent: EtatGestation | null;
  categorie: string | null;
  groupeNom: string | null;
  saillieDate: string | null;
  gestationEtat: string | null;
  gestationVelagePrevue: string | null;
  velageDate: string | null;
  reproductionSummary: ReproductionSummaryRow;
  mereNutrav: string | null;
  pereNom: string | null;
  pereNumero: string | null;
  sevreFait: boolean;
  activeCalves: { nutrav: string; href: string | null }[];
  dernierPoids: number | null;
  dernierePeseeDate: string | null;
  enAttente: boolean;
}

interface Props {
  animaux: AnimalRow[];
  postCalvingRestDays: number;
}

const ETAT_LABEL: Record<string, string> = {
  VERT: "Gestante",
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "En attente",
  ROUGE: "Vide",
  REPOS: "Repos",
};

// ─── SortHeader ──────────────────────────────────────────────────────────────

function SortHeader({
  label,
  buildFilterUrl,
  triAsc,
  triDesc,
  currentTri,
}: {
  label: string;
  buildFilterUrl: (key: string, value: string | undefined) => string;
  triAsc?: string;
  triDesc?: string;
  currentTri: string | undefined;
}) {
  const router = useRouter();
  const isAsc = currentTri === triAsc;
  const isDesc = currentTri === triDesc;
  const isActive = isAsc || isDesc || (!triAsc && !currentTri);

  function handleClick() {
    if (!triAsc) {
      // N° travail sort: reset tri
      router.push(buildFilterUrl("tri", undefined));
      return;
    }
    if (!currentTri || currentTri === triDesc) {
      router.push(buildFilterUrl("tri", triAsc));
    } else {
      router.push(buildFilterUrl("tri", triDesc));
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 hover:text-green-200 transition-colors whitespace-nowrap ${
        isActive ? "text-yellow-300" : ""
      }`}
    >
      {label}
      {triAsc ? (
        <span className="flex flex-col leading-none text-[8px]">
          <span className={isAsc ? "text-yellow-300" : "opacity-60"}>▲</span>
          <span className={isDesc ? "text-yellow-300" : "opacity-60"}>▼</span>
        </span>
      ) : (
        isActive && <span className="text-yellow-300">▲</span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TroupeauTableau({ animaux, postCalvingRestDays }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Read current filter state
  const currentTri = searchParams.get("tri") ?? undefined;
  const eligibleAnimals = animaux.filter((animal) => {
    const category = getCategorie(
      animal.sexbov,
      new Date(animal.danais),
      animal.estGenisse,
      animal.categorie,
    );
    return animal.sexbov === "F"
      && ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(category);
  });
  const eligibleIds = new Set(eligibleAnimals.map((animal) => animal.id));
  const allEligibleSelected = eligibleAnimals.length > 0
    && eligibleAnimals.every((animal) => selectedIds.has(animal.id));

  useEffect(() => {
    const visibleIds = new Set(animaux.map((animal) => animal.id));
    setSelectedIds((current) => new Set([...current].filter((id) => visibleIds.has(id))));
  }, [animaux]);

  function toggleAnimal(id: string) {
    setFeedback(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setFeedback(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allEligibleSelected) eligibleIds.forEach((id) => next.delete(id));
      else eligibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function addSelectedToEchoList() {
    const selected = eligibleAnimals.filter((animal) => selectedIds.has(animal.id));
    if (selected.length === 0 || adding) return;
    setAdding(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/animaux/echo-requests/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutravs: selected.map((animal) => animal.nutrav) }),
      });
      const result = await response.json() as {
        added?: number;
        alreadyActive?: number;
        rejected?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Ajout impossible");
      const added = result.added ?? 0;
      const alreadyActive = result.alreadyActive ?? 0;
      const rejected = result.rejected ?? 0;
      setFeedback(
        `${added} vache${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""} · ${alreadyActive} déjà à échographier${rejected > 0 ? ` · ${rejected} non ajoutée${rejected > 1 ? "s" : ""}` : ""}`,
      );
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Ajout impossible");
    } finally {
      setAdding(false);
    }
  }

  function buildFilterUrl(key: string, value: string | undefined): string {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== undefined) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    params.set("vue", "tableau");
    return `/troupeau?${params.toString()}`;
  }

  if (animaux.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">
        Aucun animal trouvé
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
        <span>Trier :</span>
        <span className="rounded-md bg-green-700 px-2 py-1 text-white">
          <SortHeader
            label="Dernier vêlage"
            buildFilterUrl={buildFilterUrl}
            triAsc="velage_asc"
            triDesc="velage_desc"
            currentTri={currentTri}
          />
        </span>
      </div>
      {(selectedIds.size > 0 || feedback) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-100 bg-green-50 px-4 py-3">
          <div>
            {selectedIds.size > 0 && (
              <p className="text-sm font-bold text-green-900">
                {selectedIds.size} vache{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
              </p>
            )}
            {feedback && <p className="text-xs font-semibold text-gray-700" role="status">{feedback}</p>}
          </div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={addSelectedToEchoList}
              disabled={adding}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 shadow-sm disabled:opacity-60"
            >
              {adding ? "Ajout…" : `Ajouter ${selectedIds.size} vache${selectedIds.size > 1 ? "s" : ""} à échographier`}
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="bg-green-700 text-white text-xs select-none">
              <th className="w-10 px-2 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={allEligibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Sélectionner toutes les femelles visibles compatibles"
                  className="h-4 w-4 rounded border-green-200 accent-amber-400"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <SortHeader
                  label="N° Travail"
                  buildFilterUrl={buildFilterUrl}
                  currentTri={currentTri}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">Nom</th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <SortHeader
                  label="Âge"
                  buildFilterUrl={buildFilterUrl}
                  triAsc="age_asc"
                  triDesc="age_desc"
                  currentTri={currentTri}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">Dernier poids</th>
              <th className="px-3 py-2.5 text-left font-semibold">Catégorie</th>
              <th className="px-3 py-2.5 text-left font-semibold">Repro</th>
              <th className="px-3 py-2.5 text-left font-semibold">Mère</th>
              <th className="px-3 py-2.5 text-left font-semibold">Père</th>
              <th className="px-3 py-2.5 text-left font-semibold">Sevrage</th>
            </tr>
          </thead>
          <tbody>
            {animaux.map((animal, i) => {
              const danais = new Date(animal.danais);
              const catLabel = getCategorieLabel(
                animal.sexbov, danais, animal.estGenisse, animal.categorie
              );
              const cat = getCategorie(
                animal.sexbov, danais, animal.estGenisse, animal.categorie
              );
              const catColor = getCategorieColor(cat);

              const etat: EtatGestation | null =
                ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(cat)
                  ? animal.reproductionEtatManuel ?? getEtatGestation(
                      animal.saillieDate ? new Date(animal.saillieDate) : null,
                      animal.gestationEtat ?? null,
                      animal.gestationVelagePrevue
                        ? new Date(animal.gestationVelagePrevue)
                        : null,
                      animal.velageDate ? new Date(animal.velageDate) : null,
                      false,
                      postCalvingRestDays
                    )
                  : null;

              const gestationDays =
                etat === "VERT" && animal.gestationEtat === "VERT" && animal.saillieDate
                  ? differenceInDays(new Date(), new Date(animal.saillieDate))
                  : null;
              const motherWeaning = getMotherWeaningDisplay({
                motherNutrav: animal.mereNutrav,
                sevreFait: animal.sevreFait,
              });
              const father = formatFather(animal.pereNom, animal.pereNumero);
              const selectable = eligibleIds.has(animal.id);
              const displayNonWeaned = shouldDisplayNonWeaned(danais, animal.sevreFait);

              return (
                <tr
                  key={animal.id}
                  onClick={() => {
                    sessionStorage.setItem("troupeau:scrollY", String(window.scrollY));
                    router.push(`/troupeau/${animal.nutrav}`);
                  }}
                  className={`border-t border-gray-100 cursor-pointer hover:bg-green-50 transition-colors ${
                    i % 2 === 1 ? "bg-gray-50/50" : ""
                  }`}
                >
                  <td className="px-2 py-2.5 text-center" onClick={(event) => event.stopPropagation()}>
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(animal.id)}
                        onChange={() => toggleAnimal(animal.id)}
                        aria-label={`Sélectionner la vache ${animal.nutrav}`}
                        className="h-4 w-4 rounded border-gray-300 accent-green-700"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-green-800 whitespace-nowrap">
                    {animal.nutrav}
                  </td>
                  <td className="px-3 py-2.5 text-gray-800 max-w-[140px] truncate">
                    {animal.nobovi ?? (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {formatAgeCompact(danais)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                    {animal.dernierPoids !== null ? (
                      <div>
                        <span className="font-semibold">{animal.dernierPoids} kg</span>
                        {animal.dernierePeseeDate && (
                          <div className="text-[10px] text-gray-400">
                            {new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(
                              -Math.max(0, Math.round((Date.now() - new Date(animal.dernierePeseeDate).getTime()) / 86400000)),
                              "day"
                            )}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catColor}`}
                    >
                      {animal.sexbov === "F" ? "♀" : "♂"} {catLabel}
                    </span>
                    {animal.enAttente && (
                      <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700" title="Délai d'attente en cours">
                        ⏱
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {etat ? (
                      <div>
                        <div className="flex flex-wrap gap-1">
                          <ReproductionListBadge
                            etat={etat}
                            fallbackLabel={ETAT_LABEL[etat] ?? etat}
                            gestationDays={gestationDays}
                          />
                          {animal.aEchographier && etat !== "JAUNE" && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
                              À écho
                            </span>
                          )}
                        </div>
                        <ReproductionCycleSummary summary={animal.reproductionSummary} />
                      </div>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs font-bold text-gray-800">{motherWeaning.motherLabel}</span>
                  </td>
                  <td className="max-w-[9rem] px-3 py-2.5 text-xs font-semibold text-gray-700">
                    <span className="line-clamp-2">{father}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {displayNonWeaned && motherWeaning.statusLabel && <span className="whitespace-nowrap text-[10px] font-semibold text-blue-700">🍼 {motherWeaning.statusLabel}</span>}
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
