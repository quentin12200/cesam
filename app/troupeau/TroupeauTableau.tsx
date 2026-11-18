"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInDays, intervalToDuration, format } from "date-fns";
import { CalendarDays, Hourglass, Clock3, Pause, X, Stethoscope } from "lucide-react";
import {
  getCategorie,
  getCategorieLabel,
  getCategorieColor,
  getEtatGestation,
  formatAgeCompact,
  type EtatGestation,
} from "@/lib/utils";
import { getBadgeClass } from "@/lib/utils";
import AncestryEditor from "./[nutrav]/arbre/AncestryEditor";
import AnimalRowActions from "./AnimalRowActions";
import { getMotherWeaningDisplay } from "@/lib/troupeau-mother-weaning";
import { shouldDisplayNonWeaned } from "@/lib/troupeau-display";
import ReproductionCycleSummary, { type ReproductionSummaryRow } from "./ReproductionCycleSummary";

export interface AnimalRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  statut: string;
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
  dernierVeauMortNe: boolean;
  dernierVeauMort: boolean;
  gestationTermineeParVelage: boolean;
  reproductionSummary: ReproductionSummaryRow;
  mereNutrav: string | null;
  mereNom: string | null;
  mereLieeNutrav: string | null;
  pereNom: string | null;
  pereNumero: string | null;
  sevreFait: boolean;
  activeCalves: { nutrav: string; href: string | null; toWean: boolean; birthDate: string | null }[];
  dernierPoids: number | null;
  dernierePeseeDate: string | null;
  enAttente: boolean;
}

interface Props {
  animaux: AnimalRow[];
  postCalvingRestDays: number;
}

const REPRO_ICONS = { VERT: CalendarDays, ROSE: Hourglass, JAUNE: Stethoscope, GRIS: Clock3, ROUGE: X, REPOS: Pause } as const;

const ETAT_LABEL: Record<string, string> = {
  VERT: "Gestante",
  ROSE: "Vêlage proche",
  JAUNE: "Écho",
  GRIS: "Attente",
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
  const [printColumns, setPrintColumns] = useState({ nom: true, age: true, poids: true, categorie: true });
  const [printOptionsOpen, setPrintOptionsOpen] = useState(false);

  // Read current filter state
  const currentTri = searchParams.get("tri") ?? undefined;
  const currentTri2 = searchParams.get("tri2") ?? undefined;
  const reproPrimary = currentTri === "repro_asc" || currentTri === "repro_desc";
  function toggleSecondary(field: "age" | "sexe" | "categorie") {
    const asc = `${field}_asc`, desc = `${field}_desc`;
    const next = currentTri2 === asc ? desc : currentTri2 === desc ? undefined : asc;
    router.push(buildFilterUrl("tri2", next));
  }
  function secondaryHeader(field: "age" | "sexe" | "categorie", label: string) {
    const active = reproPrimary && currentTri2?.startsWith(`${field}_`);
    return <button type="button" disabled={!reproPrimary} onClick={() => toggleSecondary(field)} className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-green-200 disabled:opacity-50 ${active ? "text-yellow-300" : ""}`} title={`Tri secondaire ${label} : croissant, décroissant, puis ordre initial`}>
      {label}<span className="text-[9px] opacity-80">{active ? (currentTri2?.endsWith("_asc") ? "▲" : "▼") : "↕"}</span>{active && <span className="rounded bg-yellow-300 px-1 text-[9px] font-bold text-green-900 print:hidden">2</span>}
    </button>;
  }
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
    <div className="troupeau-print-view bg-white rounded-xl shadow overflow-hidden print:overflow-visible print:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 print:hidden">
        <span className="text-xs text-gray-500">{animaux.length} animaux dans la vue</span>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setPrintOptionsOpen((open) => !open)} className="rounded-lg border px-3 py-1.5 text-xs">Colonnes à imprimer</button><button type="button" onClick={() => window.print()} className="rounded-lg border border-green-700 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-50">Imprimer la vue</button></div>
      </div>
      {printOptionsOpen && <div className="flex flex-wrap gap-3 border-b p-3 text-xs print:hidden">{([{ key: "nom", label: "Nom" }, { key: "age", label: "Âge de la vache" }, { key: "categorie", label: "Catégorie" }] as const).map(({ key, label }) => <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={printColumns[key]} onChange={(event) => setPrintColumns((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</div>}
      <div className="hidden print:block print:mb-3"><h1 className="text-lg font-bold">CESAM — Troupeau</h1><p className="text-xs">{animaux.length} animaux · {format(new Date(), "dd/MM/yyyy")}</p></div>
      {(selectedIds.size > 0 || feedback) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-100 bg-green-50 px-4 py-3 print:hidden">
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
      <style>{`@media print {
        @page { size: A4 portrait; margin: 8mm 6mm; }
        body *:not(:has(.troupeau-print-view)):not(.troupeau-print-view):not(.troupeau-print-view *) { display: none !important; }
        body *:has(.troupeau-print-view) { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
        .troupeau-print-view { position: static !important; display: block !important; width: 100% !important; overflow: visible !important; box-shadow: none !important; }
        .troupeau-print-view .overflow-x-auto { overflow: visible !important; }
        .troupeau-print-view table { display: table !important; width: 100% !important; min-width: 0 !important; table-layout: fixed; border-collapse: collapse !important; font-size: 9px !important; }
        .troupeau-print-view thead { display: table-header-group !important; break-inside: avoid !important; }
        .troupeau-print-view thead tr { display: table-row !important; }
        .troupeau-print-view thead th { display: table-cell !important; color: #111827 !important; background: #e5e7eb !important; font-weight: 700 !important; font-size: 8.5px !important; border-bottom: 1px solid #6b7280 !important; }
        .troupeau-print-view thead button { display: none !important; }
        .troupeau-print-view .print-heading { display: inline !important; }
        .troupeau-print-view .print-category { display: inline !important; }
        .troupeau-print-view .screen-category { display: none !important; }
        .troupeau-print-view tbody { display: table-row-group !important; }
        .troupeau-print-view tr { display: table-row !important; break-inside: avoid-page; page-break-inside: avoid; }
        .troupeau-print-view th, .troupeau-print-view td { display: table-cell !important; padding: 3px 2px !important; line-height: 1.2 !important; overflow-wrap: normal !important; white-space: normal !important; vertical-align: middle !important; }
        .troupeau-print-view th:nth-child(6), .troupeau-print-view td:nth-child(6) { display: none !important; }
        .troupeau-print-view th:nth-child(2), .troupeau-print-view td:nth-child(2) { width: 11% !important; }
        .troupeau-print-view th:nth-child(3), .troupeau-print-view td:nth-child(3) { width: 16% !important; }
        .troupeau-print-view th:nth-child(4), .troupeau-print-view td:nth-child(4) { width: 9% !important; }
        .troupeau-print-view th:nth-child(7), .troupeau-print-view td:nth-child(7) { width: 14% !important; }
        .troupeau-print-view th:nth-child(8), .troupeau-print-view td:nth-child(8) { width: 16% !important; }
        .troupeau-print-view th:nth-child(9), .troupeau-print-view td:nth-child(9) { width: 14% !important; }
        .troupeau-print-view th:nth-child(10), .troupeau-print-view td:nth-child(10) { width: 20% !important; }
        .troupeau-print-view td:nth-child(2) { font-size: 11px !important; font-weight: 800 !important; color: #111827 !important; white-space: nowrap !important; }
        .troupeau-print-view td:nth-child(8), .troupeau-print-view td:nth-child(9) { font-size: 9.5px !important; font-weight: 600 !important; font-variant-numeric: tabular-nums; }
        .troupeau-print-view td:nth-child(9) { white-space: nowrap !important; }
        .troupeau-print-view td:nth-child(7) { font-size: 8.5px !important; }
        .troupeau-print-view .calf-number { font-size: 10px !important; font-weight: 800 !important; }
        .troupeau-print-view td div { min-width: 0 !important; gap: 1px !important; }
        /* Portrait: calf number stays intact; optional age and sevrage notes wrap between tokens. */
        .troupeau-print-view .calf-list { display: flex !important; flex-wrap: wrap !important; gap: 2px 5px !important; }
        .troupeau-print-view .calf-item { display: flex !important; flex-wrap: wrap !important; align-items: baseline !important; gap: 1px 4px !important; min-width: 0 !important; }
        .troupeau-print-view .calf-number { display: inline-block !important; white-space: nowrap !important; overflow-wrap: normal !important; word-break: keep-all !important; }
        .troupeau-print-view .calf-detail { white-space: nowrap !important; overflow-wrap: normal !important; word-break: keep-all !important; font-size: 8px !important; }
        .troupeau-print-view [class~="print:hidden"] { display: none !important; }
        .troupeau-print-view details { display: none !important; }
        .troupeau-print-view h1 { margin: 0 !important; }
      }`}</style>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[1080px] text-sm print:min-w-0 print:text-[9px]">
          <thead>
            <tr className="bg-green-700 text-white text-xs select-none">
              <th className="w-10 px-2 py-2.5 text-center print:hidden">
                <input
                  type="checkbox"
                  checked={allEligibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Sélectionner toutes les femelles visibles compatibles"
                  className="h-4 w-4 rounded border-green-200 accent-amber-400"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <span className="print-heading hidden">N°</span><SortHeader
                  label="N° Travail"
                  buildFilterUrl={buildFilterUrl}
                  currentTri={currentTri}
                />
              </th>
              <th className={`px-3 py-2.5 text-left font-semibold ${printColumns.nom ? "" : "print:hidden"}`}><span className="print-heading hidden">Nom</span><SortHeader label="Nom" buildFilterUrl={buildFilterUrl} triAsc="nom_asc" triDesc="nom_desc" currentTri={currentTri} /></th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <span className="print-heading hidden">Âge</span>{reproPrimary ? secondaryHeader("age", "Âge") : <SortHeader label="Âge" buildFilterUrl={buildFilterUrl} triAsc="age_asc" triDesc="age_desc" currentTri={currentTri} />}
              </th>
               <th className="px-2 py-2.5 text-left font-semibold print:hidden">{secondaryHeader("sexe", "Sexe")}</th>
              <th className={`px-3 py-2.5 text-left font-semibold ${printColumns.poids ? "" : "print:hidden"}`}>Dernier poids</th>
              <th className={`px-3 py-2.5 text-left font-semibold ${printColumns.categorie ? "" : "print:hidden"}`}><span className="print-heading hidden">Catégorie</span>{reproPrimary ? secondaryHeader("categorie", "Catégorie") : <SortHeader label="Catégorie" buildFilterUrl={buildFilterUrl} triAsc="categorie_asc" triDesc="categorie_desc" currentTri={currentTri} />}</th>
              <th className="px-3 py-2.5 text-left font-semibold"><span className="print-heading hidden">Vêlage prévu</span><span className="inline-flex items-center gap-1"><SortHeader label="Vêlage prévu" buildFilterUrl={buildFilterUrl} triAsc="repro_asc" triDesc="repro_desc" currentTri={currentTri} />{reproPrimary && <span className="rounded bg-yellow-300 px-1 text-[9px] font-bold text-green-900 print:hidden">1</span>}</span></th>
              <th className="px-3 py-2.5 text-left font-semibold"><span className="print-heading hidden">Dernier vêlage</span><SortHeader label="Dernier vêlage" buildFilterUrl={buildFilterUrl} triAsc="velage_asc" triDesc="velage_desc" currentTri={currentTri} /></th>
              <th className="px-3 py-2.5 text-left font-semibold"><span className="print-heading hidden">Veau / Sevrage</span><SortHeader label="Veau / Sevrage" buildFilterUrl={buildFilterUrl} triAsc="veau_asc" triDesc="veau_desc" currentTri={currentTri} /></th>
              <th className="w-16 px-2 py-2.5 text-center print:hidden">Actions</th>
              <th className="px-2 py-2.5 text-left font-semibold print:hidden">Parenté</th>
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
                  ? (animal.gestationTermineeParVelage ? null : animal.reproductionEtatManuel) ?? getEtatGestation(
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

              const ReproIcon = etat ? REPRO_ICONS[etat] : null;

              const gestationDays =
                etat === "VERT" && animal.gestationEtat === "VERT" && animal.saillieDate
                  ? differenceInDays(new Date(), new Date(animal.saillieDate))
                  : null;
              const motherWeaning = getMotherWeaningDisplay({
                motherNutrav: animal.mereNutrav,
                sevreFait: animal.sevreFait,
              });
              const father = [animal.pereNumero, animal.pereNom].filter(Boolean).join(" · ") || "—";
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
                  <td className="px-2 py-2.5 text-center print:hidden" onClick={(event) => event.stopPropagation()}>
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
                  <td className={`px-3 py-2.5 text-gray-800 max-w-[140px] truncate ${printColumns.nom ? "" : "print:hidden"}`}>
                    {animal.nobovi ?? (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-gray-600 whitespace-nowrap ${printColumns.age ? "" : "print:hidden"}`}>
                    {formatAgeCompact(danais)}
                  </td>
                  <td className="px-2 py-2.5 text-gray-600 print:hidden">{animal.sexbov === "F" ? "F" : "M"}</td>
                  <td className={`px-3 py-2.5 text-gray-700 whitespace-nowrap ${printColumns.poids ? "" : "print:hidden"}`}>
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
                  <td className={`px-3 py-2.5 whitespace-nowrap ${printColumns.categorie ? "" : "print:hidden"}`}>
                    <span
                      className={`screen-category text-xs font-medium px-1.5 py-0.5 rounded-full ${catColor}`}
                    >
                      {animal.sexbov === "F" ? "♀" : "♂"} {catLabel}
                    </span>
                    <span className="print-category hidden">{catLabel.replace("Grande génisse", "G. génisse").replace("Moyenne génisse", "M. génisse").replace("Petite génisse", "P. génisse").replace("Présélection génisse", "Présél. génisse").replace("Engraissement", "Engrais.").replace("À engraisser", "À engrais.")}</span>
                    {animal.enAttente && (
                      <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700" title="Délai d'attente en cours">
                        ⏱
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    {etat ? (
                      <div className="flex min-w-[160px] flex-col gap-1">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${etat === "VERT" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : getBadgeClass(etat)}`}>{ReproIcon && <ReproIcon size={12} strokeWidth={2.25} aria-hidden="true" />}{ETAT_LABEL[etat] ?? etat}</span>
                          {animal.aEchographier && etat !== "JAUNE" && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">À écho</span>
                          )}
                        </div>
                        {animal.gestationVelagePrevue && ["VERT", "ROSE", "GRIS", "JAUNE"].includes(etat) && (
                          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                            <span className={`font-semibold tabular-nums ${etat === "VERT" || etat === "ROSE" ? "text-green-800" : "text-gray-700"}`}>
                              {format(new Date(animal.gestationVelagePrevue), "dd/MM")}
                            </span>
                            {etat !== "VERT" && etat !== "ROSE" && <span className="text-[10px] text-gray-500">estimé</span>}
                          </div>
                        )}
                        <details className="group text-[11px] print:hidden" onClick={(event) => event.stopPropagation()}>
                          <summary className="w-fit cursor-pointer select-none text-gray-500 hover:text-green-800">▸ Détails</summary>
                          <div className="mt-1"><ReproductionCycleSummary summary={animal.reproductionSummary} /></div>
                        </details>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{animal.velageDate ? <span>{format(new Date(animal.velageDate), "dd/MM/yyyy")}{animal.dernierVeauMortNe && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Mort-né</span>}{animal.dernierVeauMort && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Mort</span>}</span> : "—"}</td>
                   <td className="px-3 py-2.5 text-xs" onClick={(event) => event.stopPropagation()}>
                    {animal.activeCalves.length > 0 ? (
                      <div className="calf-list flex flex-wrap items-center gap-x-2 gap-y-1">
                        {animal.activeCalves.map((calf) => (
                          <span key={calf.nutrav} className="calf-item inline-flex flex-wrap items-center gap-1">
                            {calf.href ? (
                              <button type="button"
                                onClick={() => router.push(calf.href!)}
                                className={`calf-number whitespace-nowrap font-mono font-bold underline underline-offset-2 ${calf.toWean ? "text-red-700" : "text-blue-700"}`}
                                title="Ouvrir la fiche du veau"
                              >{calf.nutrav}</button>
                            ) : <span className={`calf-number whitespace-nowrap font-mono font-bold ${calf.toWean ? "text-red-700" : "text-gray-700"}`}>{calf.nutrav}</span>}
                            {calf.birthDate && <span className="calf-detail whitespace-nowrap text-gray-600">{(() => { const d = intervalToDuration({ start: new Date(calf.birthDate), end: new Date() }); return `${(d.years ?? 0) * 12 + (d.months ?? 0)} mois ${d.days ?? 0} j`; })()}</span>}
                            {calf.toWean && <span className="calf-detail whitespace-nowrap rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-800">À sevrer</span>}
                          </span>
                        ))}
                      </div>
                    ) : displayNonWeaned && motherWeaning.statusLabel ? (
                      <span className="whitespace-nowrap font-semibold text-blue-700">🍼 {motherWeaning.statusLabel}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 print:hidden" onClick={(event) => event.stopPropagation()}>
                    <AnimalRowActions nutrav={animal.nutrav} />
                  </td>
                   <td className="px-2 py-2 text-xs print:hidden" onClick={(event) => event.stopPropagation()}>
                     <details className="relative">
                       <summary className="cursor-pointer whitespace-nowrap font-semibold text-green-700">Parenté ▾</summary>
                       <div className="mt-2 min-w-[200px] rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                         <div className="text-gray-500 mb-1">Mère</div>
                    {animal.mereLieeNutrav ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/troupeau/${animal.mereLieeNutrav}`)}
                        className="font-mono text-xs font-bold text-green-700 underline underline-offset-2 hover:text-green-900"
                        title="Ouvrir la fiche de la mère"
                      >
                        {motherWeaning.motherLabel}{animal.mereNom ? ` · ${animal.mereNom}` : ""}
                      </button>
                    ) : animal.mereNutrav ? (
                      <button type="button" onClick={() => router.push(`/troupeau/${animal.nutrav}/arbre`)}
                        className="font-mono text-xs font-semibold text-gray-700 underline decoration-dotted"
                        title="Voir ou compléter la parenté"
                      >
                        {animal.mereNutrav}{animal.mereNom ? ` · ${animal.mereNom}` : ""}
                      </button>
                    ) : <AncestryEditor animalNutrav={animal.nutrav} parent="MERE" />}
                  <div className="mt-2 border-t pt-2"><div className="text-gray-500 mb-1">Père</div>
                    {animal.pereNumero || animal.pereNom ? (
                      <button type="button" onClick={() => router.push(`/troupeau/${animal.nutrav}/arbre`)}
                        className="line-clamp-2 text-left underline decoration-dotted underline-offset-2"
                        title="Voir le père dans l'arbre généalogique"
                      >{father}</button>
                    ) : <AncestryEditor animalNutrav={animal.nutrav} parent="PERE" />}
                  </div>
                       </div>
                     </details>
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
