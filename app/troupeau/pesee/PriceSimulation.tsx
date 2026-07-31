"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import type { FieldSessionEntry } from "@/lib/field-weighing";
import {
  assignPriceGroup,
  generalEstimate,
  groupEntries,
  groupForEntry,
  groupStats,
  individualEstimate,
  parsePriceInput,
  removePriceGroup,
  sexTotals,
  sortEntriesByWeight,
  type PriceGroup,
  type PriceMode,
} from "@/lib/price-simulation";

type DraftGroup = {
  id: string | null;
  sexe: "M" | "F";
  peseeIds: string[];
  mode: PriceMode;
  tarifInput: string;
};

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEuros(value: number) {
  return euros.format(Math.round(value));
}

function formatTarif(group: Pick<PriceGroup, "mode" | "tarif">) {
  return group.mode === "PER_KG"
    ? `${group.tarif.toFixed(2).replace(".", ",")} €/kg`
    : `${group.tarif.toFixed(2).replace(".", ",")} €/tête`;
}

export default function PriceSimulation({
  entries,
  groups,
  onGroupsChange,
  onBack,
}: {
  entries: FieldSessionEntry[];
  groups: PriceGroup[];
  onGroupsChange: (groups: PriceGroup[]) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<Record<"M" | "F", string[]>>({ M: [], F: [] });
  const [draft, setDraft] = useState<DraftGroup | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const maleTotals = useMemo(() => sexTotals(groups, entries, "M"), [groups, entries]);
  const femaleTotals = useMemo(() => sexTotals(groups, entries, "F"), [groups, entries]);
  const total = useMemo(() => generalEstimate(groups, entries), [groups, entries]);

  function toggleSelection(sexe: "M" | "F", id: string) {
    setSelected((current) => ({
      ...current,
      [sexe]: current[sexe].includes(id)
        ? current[sexe].filter((entryId) => entryId !== id)
        : [...current[sexe], id],
    }));
  }

  function openCreate(sexe: "M" | "F") {
    if (selected[sexe].length === 0) return;
    setDraft({ id: null, sexe, peseeIds: selected[sexe], mode: "PER_KG", tarifInput: "" });
    setError("");
  }

  function openEdit(group: PriceGroup) {
    setOpenActionsId(null);
    setDraft({
      id: group.id,
      sexe: group.sexe,
      peseeIds: group.peseeIds,
      mode: group.mode,
      tarifInput: String(group.tarif).replace(".", ","),
    });
    setError("");
  }

  function saveDraft() {
    if (!draft || draft.peseeIds.length === 0) {
      setError("Sélectionnez au moins un animal.");
      return;
    }
    const tarif = parsePriceInput(draft.tarifInput);
    if (tarif === null) {
      setError("Saisissez un tarif positif avec deux décimales maximum.");
      return;
    }
    const nextGroup: PriceGroup = {
      id: draft.id ?? crypto.randomUUID(),
      sexe: draft.sexe,
      peseeIds: draft.peseeIds,
      mode: draft.mode,
      tarif,
    };
    onGroupsChange(assignPriceGroup(groups, nextGroup));
    setSelected((current) => ({ ...current, [draft.sexe]: [] }));
    setDraft(null);
    setError("");
  }

  return (
    <main className="mx-auto max-w-4xl bg-white px-3 py-5 pb-24 text-black">
      <div className="mb-5 flex items-center gap-3 border-b-4 border-black pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-12 min-w-12 items-center justify-center border-2 border-black"
          aria-label="Retour au récapitulatif"
        >
          <ArrowLeft size={28} strokeWidth={3} />
        </button>
        <div>
          <h1 className="text-2xl font-black">SIMULATION DE VENTE</h1>
          <p className="text-sm font-bold">Estimation uniquement · aucune vente créée</p>
        </div>
      </div>

      <SimulationSexSection
        sexe="M"
        entries={entries}
        groups={groups}
        selectedIds={selected.M}
        draft={draft}
        openActionsId={openActionsId}
        onToggle={(id) => toggleSelection("M", id)}
        onSelect={(ids) => setSelected((current) => ({ ...current, M: ids }))}
        onCreate={() => openCreate("M")}
        onEdit={openEdit}
        onDelete={(id) => {
          onGroupsChange(removePriceGroup(groups, id));
          setOpenActionsId(null);
        }}
        onOpenActions={setOpenActionsId}
      />

      {draft?.sexe === "M" && (
        <GroupEditor
          draft={draft}
          entries={entries}
          groups={groups}
          error={error}
          onChange={setDraft}
          onSave={saveDraft}
          onCancel={() => {
            setDraft(null);
            setError("");
          }}
        />
      )}

      <SimulationSexSection
        sexe="F"
        entries={entries}
        groups={groups}
        selectedIds={selected.F}
        draft={draft}
        openActionsId={openActionsId}
        onToggle={(id) => toggleSelection("F", id)}
        onSelect={(ids) => setSelected((current) => ({ ...current, F: ids }))}
        onCreate={() => openCreate("F")}
        onEdit={openEdit}
        onDelete={(id) => {
          onGroupsChange(removePriceGroup(groups, id));
          setOpenActionsId(null);
        }}
        onOpenActions={setOpenActionsId}
      />

      {draft?.sexe === "F" && (
        <GroupEditor
          draft={draft}
          entries={entries}
          groups={groups}
          error={error}
          onChange={setDraft}
          onSave={saveDraft}
          onCancel={() => {
            setDraft(null);
            setError("");
          }}
        />
      )}

      <section className="mt-8 border-4 border-black">
        <h2 className="bg-black px-4 py-3 text-xl font-black text-white">TOTAUX DE LA SIMULATION</h2>
        <TotalsLine label="MÂLES" stats={maleTotals} />
        <TotalsLine label="FEMELLES" stats={femaleTotals} />
        <div className="border-t-4 border-black bg-yellow-300 p-5 text-center">
          <p className="text-lg font-black">TOTAL GÉNÉRAL ESTIMÉ</p>
          <p className="mt-1 text-4xl font-black">{formatEuros(total)}</p>
        </div>
      </section>
    </main>
  );
}

function SimulationSexSection({
  sexe,
  entries,
  groups,
  selectedIds,
  draft,
  openActionsId,
  onToggle,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onOpenActions,
}: {
  sexe: "M" | "F";
  entries: FieldSessionEntry[];
  groups: PriceGroup[];
  selectedIds: string[];
  draft: DraftGroup | null;
  openActionsId: string | null;
  onToggle: (id: string) => void;
  onSelect: (ids: string[]) => void;
  onCreate: () => void;
  onEdit: (group: PriceGroup) => void;
  onDelete: (id: string) => void;
  onOpenActions: (id: string | null) => void;
}) {
  const animals = sortEntriesByWeight(entries.filter((entry) => entry.sexe === sexe));
  const sexGroups = groups.filter((group) => group.sexe === sexe);
  const label = sexe === "M" ? "MÂLES" : "FEMELLES";

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between border-b-4 border-black pb-2">
        <h2 className="text-2xl font-black">{label}</h2>
        <span className="font-black">{animals.length} {animals.length > 1 ? "animaux" : "animal"}</span>
      </div>
      <div className="flex flex-wrap gap-2 py-3">
        <button type="button" onClick={() => onSelect(animals.map((entry) => entry.id))} className="min-h-11 border-2 border-black px-3 font-black">
          Tout sélectionner
        </button>
        <button type="button" onClick={() => onSelect([])} className="min-h-11 border-2 border-black px-3 font-black">
          Tout désélectionner
        </button>
      </div>

      <div className="border-t-2 border-black">
        {animals.map((entry, index) => {
          const assigned = groupForEntry(groups, entry.id);
          return (
            <div key={entry.id} className="flex min-h-16 items-center gap-3 border-x-2 border-b-2 border-black px-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(entry.id)}
                onChange={() => onToggle(entry.id)}
                className="h-8 w-8 shrink-0 accent-black"
                aria-label={`Sélectionner ${entry.nutrav}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black">{entry.nutrav} · {entry.poids} kg</p>
                <p className="text-sm font-bold">
                  {assigned ? `Groupe ${sexGroups.findIndex((group) => group.id === assigned.id) + 1} · ${formatTarif(assigned)}` : "Aucun tarif appliqué"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelect(animals.slice(0, index + 1).map((animal) => animal.id))}
                className="min-h-11 shrink-0 border-2 border-black px-2 text-xs font-black"
              >
                Jusqu’ici
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={selectedIds.length === 0 || draft !== null}
        onClick={onCreate}
        className="mt-3 min-h-14 w-full border-3 border-black bg-green-600 px-4 text-lg font-black disabled:bg-neutral-300"
      >
        CRÉER UN GROUPE DE PRIX · {selectedIds.length}
      </button>

      {sexGroups.map((group, index) => (
        <PriceGroupSection
          key={group.id}
          group={group}
          number={index + 1}
          entries={entries}
          actionsOpen={openActionsId === group.id}
          onOpenActions={() => onOpenActions(openActionsId === group.id ? null : group.id)}
          onEdit={() => onEdit(group)}
          onDelete={() => onDelete(group.id)}
        />
      ))}
    </section>
  );
}

function GroupEditor({
  draft,
  entries,
  groups,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: DraftGroup;
  entries: FieldSessionEntry[];
  groups: PriceGroup[];
  error: string;
  onChange: (draft: DraftGroup) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const animals = sortEntriesByWeight(entries.filter((entry) => entry.sexe === draft.sexe));
  const tarif = parsePriceInput(draft.tarifInput);
  const previewGroup: PriceGroup = {
    id: draft.id ?? "preview",
    sexe: draft.sexe,
    peseeIds: draft.peseeIds,
    mode: draft.mode,
    tarif: tarif ?? 0,
  };
  const preview = groupStats(previewGroup, entries);
  const movedCount = draft.peseeIds.filter((id) => {
    const assigned = groupForEntry(groups, id);
    return assigned && assigned.id !== draft.id;
  }).length;

  return (
    <section className="mt-7 border-4 border-black bg-yellow-100 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">{draft.id ? "MODIFIER LE GROUPE" : "NOUVEAU GROUPE"} · {draft.sexe === "M" ? "MÂLES" : "FEMELLES"}</h2>
        <button type="button" onClick={onCancel} className="min-h-11 min-w-11 border-2 border-black" aria-label="Fermer l’éditeur">
          <X className="mx-auto" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 border-2 border-black">
        <button
          type="button"
          onClick={() => onChange({ ...draft, mode: "PER_KG" })}
          className={`min-h-14 border-r-2 border-black font-black ${draft.mode === "PER_KG" ? "bg-black text-white" : "bg-white"}`}
        >
          PRIX AU KILO
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...draft, mode: "PER_HEAD" })}
          className={`min-h-14 font-black ${draft.mode === "PER_HEAD" ? "bg-black text-white" : "bg-white"}`}
        >
          PRIX PAR TÊTE
        </button>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block font-black">TARIF {draft.mode === "PER_KG" ? "(€/KG)" : "(€/TÊTE)"}</span>
        <input
          value={draft.tarifInput}
          onChange={(event) => {
            const value = event.target.value;
            if (/^\d*(?:[,.]\d{0,2})?$/.test(value)) onChange({ ...draft, tarifInput: value });
          }}
          inputMode="decimal"
          autoFocus
          className="h-16 w-full border-3 border-black bg-white px-3 text-center text-3xl font-black"
        />
      </label>

      <div className="mt-4 max-h-64 overflow-y-auto border-t-2 border-black">
        {animals.map((entry) => (
          <label key={entry.id} className="flex min-h-14 items-center gap-3 border-x-2 border-b-2 border-black bg-white px-3">
            <input
              type="checkbox"
              checked={draft.peseeIds.includes(entry.id)}
              onChange={() => onChange({
                ...draft,
                peseeIds: draft.peseeIds.includes(entry.id)
                  ? draft.peseeIds.filter((id) => id !== entry.id)
                  : [...draft.peseeIds, entry.id],
              })}
              className="h-8 w-8 accent-black"
            />
            <strong className="flex-1">{entry.nutrav}</strong>
            <strong>{entry.poids} kg</strong>
          </label>
        ))}
      </div>

      {movedCount > 0 && (
        <p className="mt-3 border-2 border-black bg-white p-3 font-black">
          {movedCount} {movedCount > 1 ? "animaux sont déjà tarifés" : "animal est déjà tarifé"}. Valider {movedCount > 1 ? "les déplacera" : "le déplacera"} vers ce groupe.
        </p>
      )}
      {error && <p className="mt-3 font-black text-red-800">{error}</p>}

      <div className="mt-4 bg-white p-3 text-center">
        <p className="font-black">APERÇU · {preview.animalCount} ANIMAUX</p>
        <p className="text-3xl font-black">{formatEuros(preview.totalEstimate)}</p>
      </div>
      <button type="button" onClick={onSave} className="mt-4 min-h-16 w-full border-3 border-black bg-green-600 px-4 text-lg font-black">
        <Check className="mr-2 inline" strokeWidth={3} />
        {movedCount > 0 ? "DÉPLACER ET ENREGISTRER" : "ENREGISTRER LE GROUPE"}
      </button>
    </section>
  );
}

function PriceGroupSection({
  group,
  number,
  entries,
  actionsOpen,
  onOpenActions,
  onEdit,
  onDelete,
}: {
  group: PriceGroup;
  number: number;
  entries: FieldSessionEntry[];
  actionsOpen: boolean;
  onOpenActions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const animals = groupEntries(group, entries);
  const stats = groupStats(group, entries);
  return (
    <section className="mt-5 border-4 border-black">
      <div className="flex items-center justify-between bg-black px-3 py-2 text-white">
        <h3 className="text-lg font-black">GROUPE {number} · {group.sexe === "M" ? "MÂLES" : "FEMELLES"}</h3>
        <button type="button" onClick={onOpenActions} className="flex min-h-11 items-center gap-1 px-2 font-black">
          Actions <ChevronDown size={20} />
        </button>
      </div>
      {actionsOpen && (
        <div className="grid grid-cols-2 border-b-2 border-black">
          <button type="button" onClick={onEdit} className="min-h-12 border-r-2 border-black bg-white font-black"><Pencil className="mr-2 inline" size={18} />Modifier</button>
          <button type="button" onClick={onDelete} className="min-h-12 bg-red-700 font-black text-white"><Trash2 className="mr-2 inline" size={18} />Supprimer</button>
        </div>
      )}
      {animals.map((entry) => {
        const estimate = individualEstimate(entry.poids, group.mode, group.tarif);
        return (
          <div key={entry.id} className="border-b-2 border-black px-3 py-3 last:border-b-0">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-black">{entry.nutrav}</p>
                <p className="text-sm font-bold">{entry.poids} kg · {formatTarif(group)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black">ESTIMATION</p>
                <strong className="text-2xl font-black">{formatEuros(estimate)}</strong>
              </div>
            </div>
          </div>
        );
      })}
      <div className="border-t-4 border-black bg-yellow-200 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <span>{stats.animalCount} animaux</span><span className="text-right">Poids moyen : {stats.averageWeight} kg</span>
          <span>Poids total : {stats.totalWeight} kg</span><span className="text-right">{formatTarif(group)}</span>
        </div>
        <p className="mt-3 text-center text-3xl font-black">TOTAL : {formatEuros(stats.totalEstimate)}</p>
        <p className="text-center font-black">Moyenne/tête : {formatEuros(stats.averageEstimate)}</p>
      </div>
    </section>
  );
}

function TotalsLine({ label, stats }: { label: string; stats: ReturnType<typeof sexTotals> }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 border-b-2 border-black p-4">
      <div>
        <p className="text-lg font-black">{label}</p>
        <p className="font-bold">{stats.animalCount} tarifé{stats.animalCount > 1 ? "s" : ""} · {stats.totalWeight} kg</p>
      </div>
      <strong className="self-center text-2xl font-black">{formatEuros(stats.totalEstimate)}</strong>
    </div>
  );
}
