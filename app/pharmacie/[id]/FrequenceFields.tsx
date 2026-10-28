"use client";

import { useState } from "react";
import { ecrireFrequence, lireFrequence, type FrequenceMode } from "@/lib/preconisation-schedule";

export default function FrequenceFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const frequence = lireFrequence(value);
  // Le mode reste sélectionné lorsque l'utilisateur efface le nombre pour le remplacer.
  const [mode, setMode] = useState<FrequenceMode>(frequence.mode);
  const [moments, setMoments] = useState(frequence.moments);
  const numerique = mode === "JOUR" || mode === "HEURE" || mode === "INTERVALLE_JOURS";

  return <div className="space-y-2">
    <label className="block">
      <span className="text-xs text-gray-500 block mb-1">Fréquence recommandée</span>
      <select value={mode} onChange={(event) => {
        const prochainMode = event.target.value as FrequenceMode;
        setMode(prochainMode);
        setMoments("");
        onChange(ecrireFrequence(prochainMode, prochainMode === "HEURE" ? "24" : prochainMode === "INTERVALLE_JOURS" ? "2" : prochainMode === "JOUR" ? "1" : ""));
      }} className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white">
        <option value="">Sélectionner une fréquence</option>
        <option value="DOSE_UNIQUE">Prise unique</option>
        <option value="JOUR">Une ou plusieurs fois par jour</option>
        <option value="HEURE">Toutes les X heures</option>
        <option value="INTERVALLE_JOURS">Tous les X jours</option>
        <option value="AUTRE">Autre fréquence / consigne libre</option>
      </select>
    </label>
    {numerique && <label className="block">
      <span className="text-xs text-gray-500 block mb-1">{mode === "JOUR" ? "Nombre de prises par jour" : mode === "HEURE" ? "Intervalle entre deux prises (heures)" : "Intervalle entre deux prises (jours)"}</span>
      <input type="number" min={1} step={1} required value={frequence.valeur} onChange={(event) => onChange(ecrireFrequence(mode, event.target.value, moments))} className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white" />
    </label>}
    {mode === "JOUR" && <label className="block">
      <span className="text-xs text-gray-500 block mb-1">Moments des prises (facultatif)</span>
      <input value={moments} onChange={(event) => {
        setMoments(event.target.value);
        onChange(ecrireFrequence(mode, frequence.valeur, event.target.value));
      }} placeholder="Ex. matin et soir" className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white" />
    </label>}
    {mode === "AUTRE" && <label className="block">
      <span className="text-xs text-gray-500 block mb-1">Fréquence ou consigne particulière</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ex. une prise puis renouveler selon la consigne" className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white" />
    </label>}
  </div>;
}
