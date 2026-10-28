"use client";

import { useEffect, useState } from "react";
import FrequenceFields from "./FrequenceFields";

interface Option {
  value: string;
  label: string;
}

interface SelectAvecAjoutProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  placeholder: string;
  autreLabel: string;
  autrePlaceholder: string;
  referentielType?: string;
}

const VOIES: readonly Option[] = [
  { value: "IM", label: "Intramusculaire (IM)" },
  { value: "IV", label: "Intraveineuse (IV)" },
  { value: "SC", label: "Sous-cutanée (SC)" },
  { value: "VO", label: "Orale (VO)" },
  { value: "INTRANASALE", label: "Intranasale" },
  { value: "INTRAMAMMAIRE", label: "Intramammaire" },
  { value: "INTRA_UTERINE", label: "Intra-utérine" },
  { value: "CUTANEE", label: "Cutanée / externe" },
  { value: "POUR_ON", label: "Pour-on" },
  { value: "OCULAIRE", label: "Oculaire" },
];

const UNITES: readonly Option[] = [
  { value: "ml", label: "ml" },
  { value: "l", label: "litre" },
  { value: "g", label: "g" },
  { value: "mg", label: "mg" },
  { value: "comprimé", label: "comprimé" },
  { value: "bolus", label: "bolus" },
  { value: "sachet", label: "sachet" },
  { value: "dose", label: "dose" },
];

const CATEGORIES_ANIMAUX: readonly Option[] = [
  { value: "Tous bovins", label: "Tous bovins" },
  { value: "Vaches", label: "Vaches" },
  { value: "Génisses", label: "Génisses" },
  { value: "Veaux", label: "Veaux" },
  { value: "Taureaux", label: "Taureaux" },
  { value: "Animaux en lactation", label: "Animaux en lactation" },
];

function SelectAvecAjout({
  value,
  onChange,
  options,
  placeholder,
  autreLabel,
  autrePlaceholder,
  referentielType,
}: SelectAvecAjoutProps) {
  const valeurConnue = options.some((option) => option.value === value);
  const [saisieLibre, setSaisieLibre] = useState(Boolean(value && !valeurConnue));

  return (
    <div className="space-y-1.5">
      <select
        value={saisieLibre ? "__AUTRE__" : value}
        onChange={(event) => {
          if (event.target.value === "__AUTRE__") {
            setSaisieLibre(true);
            onChange("");
          } else {
            setSaisieLibre(false);
            onChange(event.target.value);
          }
        }}
        className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value="__AUTRE__">{autreLabel}</option>
      </select>
      {saisieLibre && (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => { if (referentielType && value.trim()) void fetch("/api/referentiels-preconisation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: referentielType, libelle: value }) }).then((r) => r.json()).then((saved) => saved.code && onChange(saved.code)); }}
          autoFocus
          placeholder={autrePlaceholder}
          className="w-full border border-blue-300 rounded-lg px-2.5 py-2 text-sm bg-white"
        />
      )}
    </div>
  );
}

export function VoieSelect({
  value,
  onChange,
  label = "Voie d’administration",
  options = VOIES,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  options?: readonly Option[];
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 block mb-1">{label}</span>
      <SelectAvecAjout
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Sélectionner une voie"
        autreLabel="+ Ajouter une nouvelle voie…"
        autrePlaceholder="Nom de la nouvelle voie"
        referentielType="VOIE"
      />
    </label>
  );
}

interface PreconisationFieldsProps {
  form: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function PreconisationFields({ form, onChange }: PreconisationFieldsProps) {
  const [ajouts, setAjouts] = useState<Record<string, { value: string; label: string }[]>>({});
  useEffect(() => { void fetch("/api/referentiels-preconisation").then((r) => r.ok ? r.json() : []).then((rows: { type: string; code: string; libelle: string; actif: boolean }[]) => { const groupes: Record<string, { value: string; label: string }[]> = {}; for (const row of rows.filter((item) => item.actif)) (groupes[row.type] ??= []).push({ value: row.code, label: row.libelle }); setAjouts(groupes); }); }, []);
  const options = (type: string, standards: readonly Option[]) => [...standards, ...(ajouts[type] ?? [])];
  const doseUnique = form.frequence === "DOSE_UNIQUE" || form.frequence === "Dose unique";
  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className="text-xs text-gray-500 block mb-1">Indication / motif</span>
        <input
          value={form.indicationMotif}
          onChange={(event) => onChange("indicationMotif", event.target.value)}
          placeholder="Ex. parasitisme, pneumonie…"
          className="w-full border rounded-lg px-2.5 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Catégorie d’animaux</span>
          <SelectAvecAjout
            value={form.categorieAnimaux}
            onChange={(value) => onChange("categorieAnimaux", value)}
            options={CATEGORIES_ANIMAUX}
            placeholder="Sélectionner"
            autreLabel="+ Autre catégorie…"
            autrePlaceholder="Catégorie d’animaux"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Âge / poids concerné</span>
          <input
            value={form.agePoidsConcerne}
            onChange={(event) => onChange("agePoidsConcerne", event.target.value)}
            placeholder="Ex. veaux dès 7 jours"
            className="w-full border rounded-lg px-2.5 py-2 text-sm"
          />
        </label>
        <div className="col-span-2"><VoieSelect
          value={form.voie}
          onChange={(value) => onChange("voie", value)}
          options={options("VOIE", VOIES)}
        /></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Quantité</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.dose}
            onChange={(event) => onChange("dose", event.target.value)}
            placeholder="0"
            className="w-full border rounded-lg px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Unité</span>
          <SelectAvecAjout
            value={form.unite}
            onChange={(value) => onChange("unite", value)}
            options={options("UNITE", UNITES)}
            placeholder="Sélectionner"
            autreLabel="+ Autre unité…"
            autrePlaceholder="Nouvelle unité"
          />
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-gray-500 block mb-1">Base de dosage</span>
          <SelectAvecAjout value={form.doseBase} onChange={(value) => onChange("doseBase", value)} options={options("BASE_DOSAGE", [{ value: "ANIMAL", label: "par animal" }, { value: "KG", label: "par kg" }, { value: "100KG", label: "par 100 kg" }, { value: "QUARTIER", label: "par quartier" }])} placeholder="Sélectionner" autreLabel="+ Ajouter une valeur" autrePlaceholder="Nouvelle base de dosage" referentielType="BASE_DOSAGE" />
        </label>
      </div>

      <fieldset className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2.5">
        <legend className="px-1 text-sm font-semibold text-gray-700">Rythme et durée du traitement</legend>
        <FrequenceFields value={form.frequence} onChange={(value) => onChange("frequence", value)} />
        <div className="grid grid-cols-2 gap-2">
          {!doseUnique && <label className="block">
            <span className="text-xs text-gray-500 block mb-1">Durée recommandée</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.dureeValeur}
              onChange={(event) => onChange("dureeValeur", event.target.value)}
              placeholder="Ex. 4"
              className="w-full border rounded-lg px-2.5 py-2 text-sm"
            />
          </label>}
          {!doseUnique && <label className="block">
            <span className="text-xs text-gray-500 block mb-1">Unité de durée</span>
            <select
              value={form.dureeUnite}
              onChange={(event) => onChange("dureeUnite", event.target.value)}
              className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white"
            >
              <option value="JOUR">jour(s)</option>
              <option value="HEURE">heure(s)</option>
              <option value="48H">période(s) de 48 h</option>
              <option value="SEMAINE">semaine(s)</option>
              <option value="MOIS">mois</option>
            </select>
          </label>}
          {!doseUnique && <label className="col-span-2 block">
            <span className="text-xs text-gray-500 block mb-1">Nombre total de prises (facultatif)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.nombreAdministrations}
              onChange={(event) => onChange("nombreAdministrations", event.target.value)}
              placeholder="1"
              className="w-full border rounded-lg px-2.5 py-2 text-sm"
            />
          </label>}
          {!doseUnique && <p className="col-span-2 text-xs text-gray-500">Le total concerne tout le traitement : 2 prises par jour pendant 4 jours correspondent à 8 prises prévues.</p>}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Délai d’attente viande (jours)</span>
          <input
            type="number"
            min={0}
            value={form.delaiAttenteViandeJ}
            onChange={(event) => onChange("delaiAttenteViandeJ", event.target.value)}
            placeholder="0"
            className="w-full border rounded-lg px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Délai d’attente lait (traites)</span>
          <input
            type="number"
            min={0}
            value={form.delaiAttenteLaitTraites}
            onChange={(event) => onChange("delaiAttenteLaitTraites", event.target.value)}
            placeholder="0"
            className="w-full border rounded-lg px-2.5 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-gray-500 block mb-1">Consigne complémentaire du vétérinaire / précautions</span>
        <textarea
          value={form.precautions}
          onChange={(event) => onChange("precautions", event.target.value)}
          rows={2}
          placeholder="Précisions sur la durée, les conditions de renouvellement…"
          className="w-full border rounded-lg px-2.5 py-2 text-sm resize-none"
        />
      </label>
    </div>
  );
}
