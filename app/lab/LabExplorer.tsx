"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, CalendarDays, ChevronDown, ChevronUp, Plus, House, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import LabCreatePanel from "./LabCreatePanel";

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
type Vue = "accueil" | "animaux" | "creer";
type Tri = "numero" | "sexe" | "age" | "repro";

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
  const [vue, setVue] = useState<Vue>("accueil");
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [tri, setTri] = useState<{champ: Tri | null; sens: 0 | 1 | -1}>({champ:null,sens:0});
  function changerTri(champ: Tri) { setTri(p => p.champ !== champ ? {champ,sens:1} : p.sens===1 ? {champ,sens:-1} : {champ:null,sens:0}); }
  const visibles = animaux.filter((a) =>
    (a.nutrav + " " + (a.nobovi ?? "")).toLowerCase().includes(recherche.toLowerCase())
  ).sort((a,b) => { if (!tri.champ || !tri.sens) return a.nutrav.localeCompare(b.nutrav,"fr",{numeric:true}); let d=0; if(tri.champ==="numero")d=a.nutrav.localeCompare(b.nutrav,"fr",{numeric:true}); if(tri.champ==="sexe")d=a.sexbov.localeCompare(b.sexbov); if(tri.champ==="age")d=new Date(b.danais).getTime()-new Date(a.danais).getTime(); if(tri.champ==="repro")d=(a.aEchographier?"JAUNE":a.reproduction??"ZZZ").localeCompare(b.aEchographier?"JAUNE":b.reproduction??"ZZZ"); return d*tri.sens || a.nutrav.localeCompare(b.nutrav,"fr",{numeric:true}); }).slice(0, 30);
  const prochaines = [...echeances].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15);

  return (
    <div className="space-y-4">
      <nav className="grid grid-cols-3 gap-2" aria-label="Sections du CESAM LAB">
        <button type="button" onClick={() => setVue("accueil")} className={vue==="accueil"?"rounded-xl bg-green-700 p-3 text-sm font-bold text-white":"rounded-xl bg-white p-3 text-sm font-bold text-gray-700"}><House className="mx-auto mb-1" size={20}/>Accueil</button>
        <button type="button" onClick={() => setVue("animaux")} className={vue==="animaux"?"rounded-xl bg-green-700 p-3 text-sm font-bold text-white":"rounded-xl bg-white p-3 text-sm font-bold text-gray-700"}><Search className="mx-auto mb-1" size={20}/>Troupeau</button>
        <button type="button" onClick={() => setVue("creer")} className={vue==="creer"?"rounded-xl bg-green-700 p-3 text-sm font-bold text-white":"rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800"}><Plus className="mx-auto mb-1" size={20}/>Créer</button>
      </nav>
      {vue === "accueil" && (
        <section className="space-y-3">
          <h2 className="text-xl font-black">À faire et à prévoir</h2>
          <p className="text-sm text-gray-600">Les échéances déjà connues de CESAM, sans nouvelle saisie.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setVue("animaux")} className="rounded-xl border bg-white p-4 text-left"><b className="block">{animaux.length} animaux actifs</b><span className="text-xs text-gray-500">Voir le troupeau</span></button>
            <button type="button" onClick={() => setVue("creer")} className="rounded-xl border bg-white p-4 text-left"><b className="block">Intervenir</b><span className="text-xs text-gray-500">Individuel ou collectif</span></button>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <h3 className="flex items-center gap-2 font-bold"><CalendarDays size={18}/> Vêlages prévus</h3>
            <div className="mt-3 space-y-2">{prochaines.slice(0,6).map(item=><Link href={"/troupeau/"+item.nutrav} key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-3"><span className="font-semibold">{item.nutrav} · {item.nom||"Sans nom"}</span><span className="text-sm font-semibold text-green-800">{new Date(item.date).toLocaleDateString("fr-FR")}</span></Link>)}</div>
            {prochaines.length===0&&<p className="mt-2 text-sm text-gray-500">Aucun vêlage prévu dans le calendrier.</p>}
            <Link href="/velage" className="mt-3 block text-sm font-bold text-green-800">Voir le calendrier complet dans CESAM →</Link>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <h3 className="font-bold">Autres travaux à consulter</h3>
            <p className="mt-1 text-xs text-gray-500">Ces raccourcis ouvrent les suivis existants ; ils ne constituent pas encore un agenda collectif unique.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/reproduction" className="rounded-lg bg-amber-50 p-3 text-sm font-semibold">Échographies →</Link>
              <Link href="/sanitaire/vaccins" className="rounded-lg bg-blue-50 p-3 text-sm font-semibold">Vaccins et rappels →</Link>
              <Link href="/parage" className="rounded-lg bg-green-50 p-3 text-sm font-semibold">Parage →</Link>
              <Link href="/troupeau/pesee" className="rounded-lg bg-gray-50 p-3 text-sm font-semibold">Pesées →</Link>
            </div>
          </div>
        </section>
      )}
      {vue === "accueil" && <p className="text-xs">Test technique du LAB</p>}
      {vue === "creer" && <LabCreatePanel animaux={animaux}/>}

      {vue === "animaux" && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Retrouver un animal</h2>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Numéro ou nom…" aria-label="Rechercher un animal"
            className="min-h-12 w-full rounded-xl border bg-white px-3 text-base" />
          <p className="text-xs text-gray-500">{animaux.length} animaux actifs · 30 résultats au maximum</p>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1" aria-label="Tri des animaux">
            {([["numero","N°"],["sexe","Sexe"],["age","Âge"],["repro","Repro"]] as [Tri,string][]).map(([champ,libelle]) => {
              const Ic = tri.champ!==champ ? ArrowUpDown : tri.sens===1 ? ArrowUp : ArrowDown;
              return <button key={champ} type="button" onClick={() => changerTri(champ)} aria-label={"Trier par "+libelle}
                className={tri.champ===champ?"flex min-h-10 flex-1 items-center justify-center gap-1 rounded bg-white text-xs font-bold text-green-800 shadow-sm":"flex min-h-10 flex-1 items-center justify-center gap-1 text-xs font-semibold text-gray-600"}>
                {libelle}<Ic size={12}/>
              </button>;
            })}
          </div>
          <div className="space-y-2">
            {visibles.map((animal) => (
              <div key={animal.id} className="rounded-xl border bg-white">
                <div className="flex min-h-14 items-center gap-2 p-3">
                  <Link href={`/troupeau/${animal.nutrav}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="rounded-lg bg-green-700 px-2 py-1 font-bold text-white">{animal.nutrav}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{animal.nobovi || "Sans nom"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span>{ageText(animal.danais)}</span>
                      <span aria-label={animal.sexbov === "F" ? "Femelle" : "Mâle"} className={animal.sexbov === "F" ? "font-bold text-purple-700" : "font-bold text-blue-700"}>{animal.sexbov === "F" ? "♀" : "♂"}</span>
                      {animal.reproduction && <span className={`rounded-full px-2 py-0.5 font-semibold ${reproColors[animal.aEchographier ? "JAUNE" : animal.reproduction]}`}>{reproLabels[animal.aEchographier ? "JAUNE" : animal.reproduction]}</span>}
                    </span>
                  </span>
                  </Link>
                  <button type="button" onClick={() => setOuvert(ouvert === animal.id ? null : animal.id)} aria-label={`Actions de ${animal.nutrav}`} aria-expanded={ouvert === animal.id} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-800">{ouvert === animal.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                </div>
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

    </div>
  );
}
