"use client";

import { useState } from "react";

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

const FREQUENCES: readonly Option[] = [
  { value: "Dose unique", label: "Dose unique" },
  { value: "1 fois / jour", label: "1 fois / jour" },
  { value: "2 fois / jour", label: "2 fois / jour" },
  { value: "3 fois / jour", label: "3 fois / jour" },
  { value: "1 fois / 48 h", label: "1 fois / 48 h" },
  { value: "1 fois / semaine", label: "1 fois / semaine" },
  { value: "1 fois / mois", label: "1 fois / mois" },
  { value: "Selon besoin", label: "Selon besoin" },
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
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 block mb-1">{label}</span>
      <SelectAvecAjout
        value={value}
        onChange={onChange}
        options={VOIES}
        placeholder="Sélectionner une voie"
        autreLabel="+ Ajouter une nouvelle voie…"
        autrePlaceholder="Nom de la nouvelle voie"
      />
    </label>
  );
}

interface PreconisationFieldsProps {
  form: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function PreconisationFields({ form, onChange }: PreconisationFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-gray-500 block mb-1">Indication / motif</span>
        <input
          value={form.indicationMotif}
          onChange={(event) => onChange("indicationMotif", event.target.value)}
          placeholder="Ex. parasitisme, pneumonie…"
          className="w-full border rounded-lg px-2.5 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        <VoieSelect
          value={form.voie}
          onChange={(value) => onChange("voie", value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            options={UNITES}
            placeholder="Sélectionner"
            autreLabel="+ Autre unité…"
            autrePlaceholder="Nouvelle unité"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Base de dosage</span>
          <select
            value={form.doseBase}
            onChange={(event) => onChange("doseBase", event.target.value)}
            className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white"
          >
            <option value="ANIMAL">par animal</option>
            <option value="KG">par kg</option>
            <option value="100KG">par 100 kg</option>
            <option value="QUARTIER">par quartier</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Fréquence</span>
          <SelectAvecAjout
            value={form.frequence}
            onChange={(value) => onChange("frequence", value)}
            options={FREQUENCES}
            placeholder="Sélectionner"
            autreLabel="+ Autre fréquence…"
            autrePlaceholder="Nouvelle fréquence"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Durée</span>
          <input
            type="number"
            min={0}
            value={form.dureeValeur}
            onChange={(event) => onChange("dureeValeur", event.target.value)}
            placeholder="0"
            className="w-full border rounded-lg px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block">
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
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Nb d’administrations</span>
          <input
            type="number"
            min={1}
            value={form.nombreAdministrations}
            onChange={(event) => onChange("nombreAdministrations", event.target.value)}
            placeholder="1"
            className="w-full border rounded-lg px-2.5 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <span className="text-xs text-gray-500 block mb-1">Précautions particulières</span>
        <textarea
          value={form.precautions}
          onChange={(event) => onChange("precautions", event.target.value)}
          rows={2}
          placeholder="Informations complémentaires utiles"
          className="w-full border rounded-lg px-2.5 py-2 text-sm resize-none"
        />
      </label>
    </div>
  );
}
