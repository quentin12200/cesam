"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ListEnd, MoveRight, Pencil, Trash2, X } from "lucide-react";
import type { FieldSessionEntry } from "@/lib/field-weighing";
import {
  assignPriceGroup,
  generalEstimate,
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
import {
  SELECT_THROUGH_LABEL,
  emptySectionLabel,
  sectionUiState,
  selectHeaviestThrough,
} from "@/lib/price-simulation-ui";

type DraftGroup = {
  id: string | null;
  sexe: "M" | "F";
  peseeIds: string[];
  mode: PriceMode;
  tarifInput: string;
  focus: "tarif" | "animals";
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

  const total = useMemo(() => generalEstimate(groups, entries), [groups, entries]);

  function toggleSelection(sexe: "M" | "F", id: string) {
    setSelected((current) => ({
      M: sexe === "M" ? current.M : [],
      F: sexe === "F" ? current.F : [],
      [sexe]: current[sexe].includes(id)
        ? current[sexe].filter((entryId) => entryId !== id)
        : [...current[sexe], id],
    }));
  }

  function openCreate(sexe: "M" | "F", ids = selected[sexe]) {
    if (ids.length === 0) return;
    setDraft({ id: null, sexe, peseeIds: ids, mode: "PER_KG", tarifInput: "", focus: "tarif" });
    setError("");
  }

  function openEdit(group: PriceGroup, focus: "tarif" | "animals") {
    setOpenActionsId(null);
    setDraft({
      id: group.id,
      sexe: group.sexe,
      peseeIds: group.peseeIds,
      mode: group.mode,
      tarifInput: String(group.tarif).replace(".", ","),
      focus,
    });
    setError("");
  }

  const activeSex = selected.M.length > 0 ? "M" : selected.F.length > 0 ? "F" : null;
  const selectedCount = activeSex ? selected[activeSex].length : 0;

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
    <main className={`mx-auto max-w-4xl bg-white px-3 py-5 text-black ${selectedCount > 0 && !draft ? "pb-44" : "pb-24"}`}>
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
        openActionsId={openActionsId}
        onToggle={(id) => toggleSelection("M", id)}
        onSelect={(ids) => setSelected({ M: ids, F: [] })}
        onEdit={openEdit}
        onChangeGroup={(entry) => {
          setSelected({ M: [entry.id], F: [] });
          openCreate("M", [entry.id]);
        }}
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
        openActionsId={openActionsId}
        onToggle={(id) => toggleSelection("F", id)}
        onSelect={(ids) => setSelected({ M: [], F: ids })}
        onEdit={openEdit}
        onChangeGroup={(entry) => {
          setSelected({ M: [], F: [entry.id] });
          openCreate("F", [entry.id]);
        }}
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

      {activeSex && selectedCount > 0 && !draft && (
        <div className="fixed bottom-20 left-3 right-3 z-30 mx-auto max-w-3xl border-4 border-black bg-yellow-300 p-2 shadow-lg">
          <button
            type="button"
            onClick={() => openCreate(activeSex)}
            className="min-h-14 w-full bg-black px-4 text-lg font-black text-white"
          >
            {selectedCount} {selectedCount > 1 ? "ANIMAUX SÉLECTIONNÉS" : "ANIMAL SÉLECTIONNÉ"} · DÉFINIR UN PRIX
          </button>
        </div>
      )}

      <section className="mt-8 border-4 border-black">
        <div className="bg-yellow-300 p-5 text-center">
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
  openActionsId,
  onToggle,
  onSelect,
  onEdit,
  onChangeGroup,
  onDelete,
  onOpenActions,
}: {
  sexe: "M" | "F";
  entries: FieldSessionEntry[];
  groups: PriceGroup[];
  selectedIds: string[];
  openActionsId: string | null;
  onToggle: (id: string) => void;
  onSelect: (ids: string[]) => void;
  onEdit: (group: PriceGroup, focus: "tarif" | "animals") => void;
  onChangeGroup: (entry: FieldSessionEntry) => void;
  onDelete: (id: string) => void;
  onOpenActions: (id: string | null) => void;
}) {
  const animals = sortEntriesByWeight(entries.filter((entry) => entry.sexe === sexe));
  const sexGroups = groups.filter((group) => group.sexe === sexe);
  const label = sexe === "M" ? "MÂLES" : "FEMELLES";
  const ui = sectionUiState(animals.length, selectedIds.length);
  const totals = sexTotals(groups, entries, sexe);

  if (ui.empty) {
    return (
      <section className="mt-6 border-b-4 border-black pb-3">
        <h2 className="text-2xl font-black">{label}</h2>
        <p className="mt-2 font-bold">{emptySectionLabel(sexe)}</p>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <div className="border-b-4 border-black pb-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 className="text-2xl font-black">{label} · {animals.length}</h2>
          <div className="flex items-center gap-2 text-sm font-black">
            <button type="button" onClick={() => onSelect(animals.map((entry) => entry.id))} className="min-h-11 underline">
              Tout sélectionner
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => onSelect([])} className="min-h-11 underline">
              Effacer
            </button>
          </div>
        </div>
      </div>

      <div>
        {animals.map((entry, index) => {
          const assigned = groupForEntry(groups, entry.id);
          const estimate = assigned
            ? individualEstimate(entry.poids, assigned.mode, assigned.tarif)
            : null;
          return (
            <div key={entry.id} className="border-x-2 border-b-2 border-black px-3 py-2.5">
              <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(entry.id)}
                onChange={() => onToggle(entry.id)}
                className="mt-1 h-8 w-8 shrink-0 accent-black"
                aria-label={`Sélectionner ${entry.nutrav}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-black">{entry.nutrav} — {entry.poids} kg</p>
                {assigned ? (
                  <>
                    <p className="text-sm font-bold">{formatTarif(assigned)} · Groupe {sexGroups.findIndex((group) => group.id === assigned.id) + 1}</p>
                    <p className="mt-0.5 text-xl font-black">ESTIMATION : {formatEuros(estimate ?? 0)}</p>
                    <button type="button" onClick={() => onChangeGroup(entry)} className="mt-1 flex min-h-10 items-center gap-1 text-sm font-black underline">
                      <MoveRight size={17} /> Changer de groupe
                    </button>
                  </>
                ) : (
                  <p className="mt-1 text-sm font-bold">Aucun tarif appliqué</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelect(selectHeaviestThrough(animals, index))}
                className="flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs font-black underline"
                title={SELECT_THROUGH_LABEL}
                aria-label={`${SELECT_THROUGH_LABEL}, jusqu’à ${entry.nutrav}`}
              >
                <ListEnd size={18} />
                <span className="max-w-20 leading-tight sm:max-w-none">{SELECT_THROUGH_LABEL}</span>
              </button>
              </div>
            </div>
          );
        })}
      </div>

      {sexGroups.map((group, index) => (
        <PriceGroupSection
          key={group.id}
          group={group}
          number={index + 1}
          entries={entries}
          actionsOpen={openActionsId === group.id}
          onOpenActions={() => onOpenActions(openActionsId === group.id ? null : group.id)}
          onEditTarif={() => onEdit(group, "tarif")}
          onEditAnimals={() => onEdit(group, "animals")}
          onDelete={() => onDelete(group.id)}
        />
      ))}

      <SexTotalSummary label={label} stats={totals} />
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
  const movedAnimals = draft.peseeIds.flatMap((id) => {
    const assigned = groupForEntry(groups, id);
    if (!assigned || assigned.id === draft.id) return [];
    const entry = entries.find((animal) => animal.id === id);
    const groupNumber = groups.filter((group) => group.sexe === draft.sexe).findIndex((group) => group.id === assigned.id) + 1;
    return entry ? [{ entry, groupNumber }] : [];
  });
  const movedCount = movedAnimals.length;

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
          autoFocus={draft.focus === "tarif"}
          className="h-16 w-full border-3 border-black bg-white px-3 text-center text-3xl font-black"
        />
      </label>

      <p className="mt-4 font-black">ANIMAUX DU GROUPE</p>
      <div className="mt-1 max-h-64 overflow-y-auto border-t-2 border-black">
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
          {movedCount === 1
            ? `${movedAnimals[0].entry.nutrav} appartient déjà au Groupe ${movedAnimals[0].groupNumber}. Il sera déplacé vers le nouveau groupe.`
            : `${movedCount} animaux appartiennent déjà à un groupe. Ils seront déplacés vers le nouveau groupe.`}
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
  onEditTarif,
  onEditAnimals,
  onDelete,
}: {
  group: PriceGroup;
  number: number;
  entries: FieldSessionEntry[];
  actionsOpen: boolean;
  onOpenActions: () => void;
  onEditTarif: () => void;
  onEditAnimals: () => void;
  onDelete: () => void;
}) {
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
        <div className="grid grid-cols-1 border-b-2 border-black sm:grid-cols-3">
          <button type="button" onClick={onEditTarif} className="min-h-12 border-b-2 border-black bg-white font-black sm:border-b-0 sm:border-r-2"><Pencil className="mr-2 inline" size={18} />Modifier le tarif</button>
          <button type="button" onClick={onEditAnimals} className="min-h-12 border-b-2 border-black bg-white font-black sm:border-b-0 sm:border-r-2"><Pencil className="mr-2 inline" size={18} />Modifier les animaux</button>
          <button type="button" onClick={onDelete} className="min-h-12 bg-red-700 font-black text-white"><Trash2 className="mr-2 inline" size={18} />Dissoudre le groupe</button>
        </div>
      )}
      <div className="bg-yellow-100 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm font-bold">
            <p>{stats.animalCount} {stats.animalCount > 1 ? "animaux" : "animal"} · Tarif : {formatTarif(group)}</p>
            <p>Poids moyen : {stats.averageWeight} kg · Total : {stats.totalWeight} kg</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-black">TOTAL ESTIMÉ</p>
            <p className="text-2xl font-black">{formatEuros(stats.totalEstimate)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SexTotalSummary({
  label,
  stats,
}: {
  label: string;
  stats: ReturnType<typeof sexTotals>;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 border-y-4 border-black bg-neutral-100 px-3 py-3">
      <div className="font-bold">
        <p>{stats.animalCount} tarifé{stats.animalCount > 1 ? "s" : ""}</p>
        <p>{stats.totalWeight} kg</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-black">TOTAL {label}</p>
        <p className="text-2xl font-black">{formatEuros(stats.totalEstimate)}</p>
      </div>
    </div>
  );
}
