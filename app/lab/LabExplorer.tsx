"use client";

import { useState } from "react";
import { Search, CalendarDays, Users, ChevronDown, ChevronUp } from "lucide-react";

type Animal = {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexbov: string;
  aEchographier: boolean;
  danais: string;
  reproduction: "VERT" | "ROSE" | "JAUNE" | "ROUGE" | "REPOS" | "GRIS" | null;
};
type Echeance = { id: string; nutrav: string; nom: string | null; date: string };
type Vue = "animaux" | "prevoir" | "seances";

const reproLabels: Record<string, string> = { VERT: "Gestante", ROSE: "Vêlage imminent", JAUNE: "À écho", ROUGE: "Vide", REPOS: "Repos", GRIS: "En attente" };
const reproColors: Record<string, string> = { VERT: "bg-green-100 text-green-800", ROSE: "bg-pink-100 text-pink-800", JAUNE: "bg-amber-100 text-amber-800", ROUGE: "bg-red-100 text-red-800", REPOS: "bg-sky-100 text-sky-800", GRIS: "bg-gray-100 text-gray-700" };
function ageText(date: string): string {
  const now = new Date();
  const born = new Date(date);
  let years = now.getFullYear() - born.getFullYear();
  let months = now.getMonth() - born.getMonth();
  if (now.getDate() < born.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return years > 0 ? `${years}a ${months}m` : `${months} mois`;
}

const seances = ["Échographies", "Vaccinations", "Antiparasitaires", "Soins / traitements", "Pesées", "Autre intervention"];

export default function LabExplorer({
  animaux,
  echeances,
}: {
  animaux: Animal[];
  echeances: Echeance[];
}) {
  const [vue, setVue] = useState<Vue>("animaux");
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [seance, setSeance] = useState<string | null>(null);
  const visibles = animaux.filter((a) =>
    (a.nutrav + " " + (a.nobovi ?? "")).toLowerCase().includes(recherche.toLowerCase())
  ).slice(0, 30);
  const prochaines = [...echeances].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15);

  return (
    <div className="space-y-4">
      <nav className="grid grid-cols-3 gap-2" aria-label="Sections du CESAM LAB">
        <button type="button" onClick={() => setVue("animaux")} className={vue === "animaux" ? "rounded-xl bg-green-700 p-3 text-sm font-bold text-white" : "rounded-xl bg-white p-3 text-sm font-bold text-gray-700"}>
          <Search className="mx-auto mb-1" size={20} />Animaux
        </button>
        <button type="button" onClick={() => setVue("prevoir")} className={vue === "prevoir" ? "rounded-xl bg-green-700 p-3 text-sm font-bold text-white" : "rounded-xl bg-white p-3 text-sm font-bold text-gray-700"}>
          <CalendarDays className="mx-auto mb-1" size={20} />À prévoir
        </button>
        <button type="button" onClick={() => setVue("seances")} className={vue === "seances" ? "rounded-xl bg-green-700 p-3 text-sm font-bold text-white" : "rounded-xl bg-white p-3 text-sm font-bold text-gray-700"}>
          <Users className="mx-auto mb-1" size={20} />Séances
        </button>
      </nav>

      {vue === "animaux" && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Retrouver un animal</h2>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Numéro ou nom…" aria-label="Rechercher un animal"
            className="min-h-12 w-full rounded-xl border bg-white px-3 text-base" />
          <p className="text-xs text-gray-500">{animaux.length} animaux actifs · 30 résultats au maximum</p>
          <div className="space-y-2">
            {visibles.map((animal) => (
              <div key={animal.id} className="rounded-xl border bg-white">
                <button type="button" onClick={() => setOuvert(ouvert === animal.id ? null : animal.id)}
                  className="flex min-h-14 w-full items-center gap-3 p-3 text-left">
                  <span className="rounded-lg bg-green-700 px-2 py-1 font-bold text-white">{animal.nutrav}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{animal.nobovi || "Sans nom"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span>{ageText(animal.danais)}</span>
                      <span aria-label={animal.sexbov === "F" ? "Femelle" : "Mâle"} className={animal.sexbov === "F" ? "font-bold text-purple-700" : "font-bold text-blue-700"}>{animal.sexbov === "F" ? "♀" : "♂"}</span>
                      {animal.reproduction && <span className={`rounded-full px-2 py-0.5 font-semibold ${reproColors[animal.aEchographier ? "JAUNE" : animal.reproduction]}`}>{reproLabels[animal.aEchographier ? "JAUNE" : animal.reproduction]}</span>}
                    </span>
                  </span>
                  {ouvert === animal.id ? <ChevronUp size={18} className="shrink-0 text-gray-500" /> : <ChevronDown size={18} className="shrink-0 text-gray-500" />}
                </button>
                {ouvert === animal.id && (
                  <div className="border-t bg-green-50 p-3">
                    <p className="mb-2 text-sm font-bold">Actions individuelles · démonstration</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(animal.sexbov === "F" ? ["Saillie / IA", "Écho", "Chaleur", "Vêlage", "Événement", "Pesée"] : ["Événement", "Pesée"]).map((action) => (
                        <span key={action} className="rounded-lg bg-white p-3 text-center text-xs font-semibold">{action}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {vue === "prevoir" && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Vêlages à prévoir</h2>
          <p className="text-sm text-gray-600">Échéances du calendrier actuel, en lecture seule.</p>
          {prochaines.map((item) => (
            <div key={item.id} className="flex justify-between gap-2 rounded-xl border bg-white p-3">
              <span className="font-semibold">{item.nutrav} · {item.nom || "Sans nom"}</span>
              <span className="shrink-0 text-sm font-bold text-green-800">{new Date(item.date).toLocaleDateString("fr-FR")}</span>
            </div>
          ))}
          {prochaines.length === 0 && <p>Aucune échéance trouvée.</p>}
        </section>
      )}

      {vue === "seances" && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Démarrer une séance</h2>
          <p className="text-sm text-gray-600">Parcours fictifs pour évaluer la navigation. Aucun enregistrement possible.</p>
          <div className="grid grid-cols-2 gap-2">
            {seances.map((type) => (
              <button key={type} type="button" onClick={() => setSeance(type)}
                className="min-h-20 rounded-xl border bg-white p-3 text-sm font-semibold">{type}</button>
            ))}
          </div>
          {seance && <div className="rounded-xl border border-green-300 bg-green-50 p-4">
            <p className="font-bold">{seance}</p>
            <p className="mt-1 text-sm">Ici, on pourrait choisir les animaux et préparer le travail.</p>
            <p className="mt-2 text-xs font-semibold text-green-900">Prototype · lecture seule</p>
          </div>}
        </section>
      )}
    </div>
  );
}
