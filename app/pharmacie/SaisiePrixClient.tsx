"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Save, Search, Trash2, X } from "lucide-react";
import { searchTypesEvenement } from "@/lib/fuzzy-search";

interface MedicamentPrix {
  id: string;
  nom: string;
  conditionnements: Array<{
    id: string;
    quantiteFlacon: number | null;
    uniteFlacon: string | null;
    doses: number;
    prixFlaconEur: number | null;
  }>;
}

interface Props {
  medicaments: MedicamentPrix[];
  onRetour: () => void;
}

interface Ligne {
  key: string;
  id?: string;
  medicamentId: string;
  quantiteFlacon: string;
  uniteFlacon: string;
  doses: string;
  prixFlaconEur: string;
  modifiee: boolean;
}

const UNITES = ["ml", "L", "g", "kg", "dose", "comprimé", "sachet", "autre"];
const prixFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function nouvelleCle() {
  return `nouveau-${Date.now()}-${Math.random()}`;
}

function ligneVide(medicamentId: string): Ligne {
  return {
    key: nouvelleCle(),
    medicamentId,
    quantiteFlacon: "",
    uniteFlacon: "ml",
    doses: "",
    prixFlaconEur: "",
    modifiee: false,
  };
}

function lignesDuMedicament(medicament: MedicamentPrix): Ligne[] {
  if (medicament.conditionnements.length === 0) return [ligneVide(medicament.id)];
  return medicament.conditionnements.map((format) => ({
    key: format.id,
    id: format.id,
    medicamentId: medicament.id,
    quantiteFlacon: format.quantiteFlacon == null ? "" : String(format.quantiteFlacon),
    uniteFlacon: format.uniteFlacon ?? "",
    doses: format.doses > 0 ? String(format.doses) : "",
    prixFlaconEur: format.prixFlaconEur == null ? "" : String(format.prixFlaconEur),
    modifiee: false,
  }));
}

function nombre(valeur: string) {
  return Number(valeur.replace(",", "."));
}

function calculs(ligne: Ligne) {
  const quantite = nombre(ligne.quantiteFlacon);
  const prix = nombre(ligne.prixFlaconEur);
  const doses = ligne.doses.trim() ? nombre(ligne.doses) : 0;
  return {
    prixUnite: quantite > 0 && prix > 0 ? prix / quantite : null,
    prixDose: doses > 0 && prix > 0 ? prix / doses : null,
  };
}

function valider(ligne: Ligne) {
  const erreurs: string[] = [];
  if (!ligne.quantiteFlacon.trim() || !Number.isFinite(nombre(ligne.quantiteFlacon)) || nombre(ligne.quantiteFlacon) <= 0) erreurs.push("quantité");
  if (!UNITES.includes(ligne.uniteFlacon)) erreurs.push("unité");
  if (ligne.doses.trim() && (!Number.isFinite(nombre(ligne.doses)) || nombre(ligne.doses) <= 0)) erreurs.push("nombre de doses");
  if (!ligne.prixFlaconEur.trim() || !Number.isFinite(nombre(ligne.prixFlaconEur)) || nombre(ligne.prixFlaconEur) <= 0) erreurs.push("prix HT");
  return erreurs;
}

export default function SaisiePrixClient({ medicaments, onRetour }: Props) {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [suppressions, setSuppressions] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [resultatsOuverts, setResultatsOuverts] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [erreurGlobale, setErreurGlobale] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const rechercheRef = useRef<HTMLInputElement>(null);

  const medicamentsParId = useMemo(() => new Map(medicaments.map((medicament) => [medicament.id, medicament])), [medicaments]);
  const medicamentsSelectionnes = useMemo(() => {
    const ids = [...new Set(lignes.map((ligne) => ligne.medicamentId))];
    return ids.map((id) => medicamentsParId.get(id)).filter((medicament): medicament is MedicamentPrix => Boolean(medicament));
  }, [lignes, medicamentsParId]);
  const resultats = useMemo(() => {
    if (!recherche.trim()) return [];
    const selectionnes = new Set(medicamentsSelectionnes.map((medicament) => medicament.id));
    return searchTypesEvenement(recherche, medicaments)
      .filter(({ item }) => !selectionnes.has(item.id))
      .slice(0, 6);
  }, [medicaments, medicamentsSelectionnes, recherche]);

  function selectionnerMedicament(medicament: MedicamentPrix) {
    if (!lignes.some((ligne) => ligne.medicamentId === medicament.id)) {
      setLignes((courantes) => [...courantes, ...lignesDuMedicament(medicament)]);
    }
    setRecherche("");
    setResultatsOuverts(false);
    setErreurGlobale("");
    setConfirmation("");
    rechercheRef.current?.focus();
  }

  function retirerMedicament(medicament: MedicamentPrix) {
    const lignesConcernees = lignes.filter((ligne) => ligne.medicamentId === medicament.id);
    if (lignesConcernees.some((ligne) => ligne.modifiee)
      && !window.confirm("Retirer ce médicament et abandonner ses modifications non enregistrées ?")) return;
    const idsConnus = new Set(medicament.conditionnements.map((format) => format.id));
    setLignes((courantes) => courantes.filter((ligne) => ligne.medicamentId !== medicament.id));
    setSuppressions((courantes) => courantes.filter((id) => !idsConnus.has(id)));
    setErreurs((courantes) => {
      const suivantes = { ...courantes };
      for (const ligne of lignesConcernees) delete suivantes[ligne.key];
      return suivantes;
    });
    setConfirmation("");
  }

  function ajouterFormat(medicamentId: string) {
    setLignes((courantes) => [...courantes, ligneVide(medicamentId)]);
    setConfirmation("");
  }

  function modifier(key: string, champ: keyof Pick<Ligne, "quantiteFlacon" | "uniteFlacon" | "doses" | "prixFlaconEur">, valeur: string) {
    setLignes((courantes) => courantes.map((ligne) => ligne.key === key ? { ...ligne, [champ]: valeur, modifiee: true } : ligne));
    setErreurs((courantes) => {
      if (!courantes[key]) return courantes;
      const suivantes = { ...courantes };
      delete suivantes[key];
      return suivantes;
    });
    setConfirmation("");
  }

  function supprimerLigne(ligne: Ligne) {
    if (ligne.id && !window.confirm("Supprimer ce format lors du prochain enregistrement ?")) return;
    setLignes((courantes) => courantes.filter((item) => item.key !== ligne.key));
    if (ligne.id) setSuppressions((courantes) => [...courantes, ligne.id as string]);
    setConfirmation("");
  }

  async function enregistrerTout() {
    const lignesModifiees = lignes.filter((ligne) => ligne.modifiee);
    const erreursParLigne: Record<string, string[]> = {};
    for (const ligne of lignesModifiees) {
      const erreursLigne = valider(ligne);
      if (erreursLigne.length > 0) erreursParLigne[ligne.key] = erreursLigne;
    }
    setErreurs(erreursParLigne);
    setErreurGlobale("");
    setConfirmation("");
    if (Object.keys(erreursParLigne).length > 0) {
      setErreurGlobale("Corrigez les lignes signalées avant l’enregistrement.");
      return;
    }
    if (lignesModifiees.length === 0 && suppressions.length === 0) {
      setConfirmation("Aucune ligne renseignée ou modifiée.");
      return;
    }

    const idsSelectionnes = [...new Set(lignes.map((ligne) => ligne.medicamentId))];
    setEnregistrement(true);
    try {
      const response = await fetch("/api/conditionnements/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lignes: lignesModifiees.map((ligne) => ({
            id: ligne.id,
            medicamentId: ligne.medicamentId,
            quantiteFlacon: ligne.quantiteFlacon.replace(",", "."),
            uniteFlacon: ligne.uniteFlacon,
            doses: ligne.doses.replace(",", "."),
            prixFlaconEur: ligne.prixFlaconEur.replace(",", "."),
          })),
          suppressions,
        }),
      });
      const resultat = await response.json();
      if (!response.ok) {
        setErreurGlobale(Array.isArray(resultat.erreurs) ? resultat.erreurs.join(" · ") : "Enregistrement impossible");
        return;
      }

      const formatsParMedicament = new Map<string, MedicamentPrix["conditionnements"]>();
      for (const id of idsSelectionnes) formatsParMedicament.set(id, []);
      for (const format of resultat.conditionnements) {
        formatsParMedicament.get(format.medicamentId)?.push(format);
      }
      setLignes(idsSelectionnes.flatMap((id) => {
        const medicament = medicamentsParId.get(id);
        if (!medicament) return [];
        return lignesDuMedicament({ ...medicament, conditionnements: formatsParMedicament.get(id) ?? [] });
      }));
      setSuppressions([]);
      setErreurs({});
      setConfirmation("Toutes les lignes renseignées ont été enregistrées.");
    } catch {
      setErreurGlobale("Connexion impossible. Aucun changement n’a été enregistré.");
    } finally {
      setEnregistrement(false);
    }
  }

  function champs(ligne: Ligne, mobile = false) {
    const { prixUnite, prixDose } = calculs(ligne);
    const classeChamp = `w-full rounded-lg border px-2 py-2 text-sm ${erreurs[ligne.key] ? "border-red-400 bg-red-50" : "border-gray-300"}`;
    const quantite = <input inputMode="decimal" value={ligne.quantiteFlacon} onChange={(event) => modifier(ligne.key, "quantiteFlacon", event.target.value)} placeholder="200" className={classeChamp} />;
    const unite = (
      <select value={ligne.uniteFlacon} onChange={(event) => modifier(ligne.key, "uniteFlacon", event.target.value)} className={classeChamp}>
        <option value="">Choisir…</option>
        {UNITES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    );
    const nombreDoses = <input inputMode="decimal" value={ligne.doses} onChange={(event) => modifier(ligne.key, "doses", event.target.value)} placeholder="Facultatif" className={classeChamp} />;
    const prixProduit = <input inputMode="decimal" value={ligne.prixFlaconEur} onChange={(event) => modifier(ligne.key, "prixFlaconEur", event.target.value)} placeholder="54,00" className={classeChamp} />;
    const prixUnitaireTexte = prixUnite == null ? "—" : `${prixFormatter.format(prixUnite)} /${ligne.uniteFlacon || "unité"}`;
    const prixDoseTexte = prixDose == null ? "—" : `${prixFormatter.format(prixDose)} /dose`;

    if (!mobile) {
      return (
        <>
          <td className="p-2 font-medium text-gray-800">{medicamentsParId.get(ligne.medicamentId)?.nom}</td>
          <td className="p-2">{quantite}</td>
          <td className="p-2">{unite}</td>
          <td className="p-2">{nombreDoses}</td>
          <td className="p-2">{prixProduit}</td>
          <td className="whitespace-nowrap p-2 text-sm text-gray-700">{prixUnitaireTexte}</td>
          <td className="whitespace-nowrap p-2 text-sm text-gray-700">{prixDoseTexte}</td>
        </>
      );
    }
    return (
      <>
        <label className="text-xs text-gray-500">Quantité{quantite}</label>
        <label className="text-xs text-gray-500">Unité{unite}</label>
        <label className="text-xs text-gray-500">Nombre de doses{nombreDoses}</label>
        <label className="text-xs text-gray-500">Prix HT du produit{prixProduit}</label>
        <div className="text-xs"><span className="block text-gray-500">Prix HT par unité</span>{prixUnitaireTexte}</div>
        <div className="text-xs"><span className="block text-gray-500">Prix HT par dose</span>{prixDoseTexte}</div>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRetour} className="flex min-h-10 items-center gap-1 rounded-lg border bg-white px-3 text-sm text-gray-600">
          <ArrowLeft size={15} /> Retour
        </button>
        <div>
          <h3 className="font-semibold text-gray-900">Saisie groupée des formats et prix</h3>
          <p className="text-xs text-gray-500">Recherchez puis sélectionnez plusieurs médicaments.</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-3 shadow">
        <div className="relative">
          <div className="flex items-center rounded-lg border border-gray-300 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400">
            <Search size={15} className="mr-2 shrink-0 text-gray-400" />
            <input ref={rechercheRef} value={recherche}
              onChange={(event) => { setRecherche(event.target.value); setResultatsOuverts(true); }}
              onFocus={() => recherche.trim() && setResultatsOuverts(true)}
              onBlur={() => setTimeout(() => setResultatsOuverts(false), 150)}
              placeholder="Rechercher des médicaments…" className="w-full text-sm outline-none" />
            {recherche && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setRecherche("")} aria-label="Effacer la recherche"><X size={14} /></button>}
          </div>
          {resultatsOuverts && recherche.trim() && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg">
              {resultats.length > 0 ? resultats.map(({ item }) => (
                <button key={item.id} type="button" onMouseDown={() => selectionnerMedicament(item)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">{item.nom}</button>
              )) : <p className="px-3 py-2 text-sm text-gray-400">Aucun médicament correspondant</p>}
            </div>
          )}
        </div>

        {medicamentsSelectionnes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {medicamentsSelectionnes.map((medicament) => (
              <span key={medicament.id} className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-1 pl-2.5 pr-1 text-xs text-blue-700">
                {medicament.nom}
                <button type="button" onClick={() => retirerMedicament(medicament)} aria-label={`Retirer ${medicament.nom}`}
                  className="rounded-full p-0.5 hover:bg-blue-100"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {erreurGlobale && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreurGlobale}</div>}
      {confirmation && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{confirmation}</div>}

      <div className="hidden overflow-x-auto rounded-xl bg-white shadow md:block">
        <table className="min-w-[1120px] w-full text-left">
          <thead className="border-b bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="p-2 font-medium">Médicament</th>
              <th className="p-2 font-medium">Quantité du flacon</th>
              <th className="p-2 font-medium">Unité</th>
              <th className="p-2 font-medium">Nombre de doses</th>
              <th className="p-2 font-medium">Prix HT du produit</th>
              <th className="p-2 font-medium">Prix HT par unité</th>
              <th className="p-2 font-medium">Prix HT par dose</th>
              <th className="w-36 p-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignes.map((ligne) => (
              <tr key={ligne.key} className={erreurs[ligne.key] ? "bg-red-50/60" : ""}>
                {champs(ligne)}
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => ajouterFormat(ligne.medicamentId)}
                      className="whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-600 hover:bg-blue-50">+ Ajouter un format</button>
                    <button type="button" onClick={() => supprimerLigne(ligne)} aria-label="Supprimer la ligne"
                      className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                  {erreurs[ligne.key] && <span className="block text-[10px] text-red-600">{erreurs[ligne.key].join(", ")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {medicamentsSelectionnes.map((medicament) => (
          <section key={medicament.id} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-sm font-semibold text-gray-800">{medicament.nom}</h4>
              <button type="button" onClick={() => ajouterFormat(medicament.id)} className="text-xs text-blue-600">+ Ajouter un format</button>
            </div>
            {lignes.filter((ligne) => ligne.medicamentId === medicament.id).map((ligne) => (
              <div key={ligne.key} className={`rounded-xl border bg-white p-3 shadow-sm ${erreurs[ligne.key] ? "border-red-300" : "border-gray-100"}`}>
                <div className="grid grid-cols-2 gap-2">{champs(ligne, true)}</div>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  {erreurs[ligne.key] ? <span className="text-xs text-red-600">À corriger : {erreurs[ligne.key].join(", ")}</span> : <span />}
                  <button type="button" onClick={() => supprimerLigne(ligne)} className="flex items-center gap-1 text-xs text-red-600">
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {medicamentsSelectionnes.length === 0 && (
        <p className="rounded-xl bg-white py-10 text-center text-sm text-gray-400 shadow">Recherchez un médicament pour commencer.</p>
      )}

      <div className="sticky bottom-16 z-10 flex justify-end rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur">
        <button type="button" onClick={() => void enregistrerTout()} disabled={enregistrement || medicamentsSelectionnes.length === 0}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
          <Save size={15} /> Enregistrer
        </button>
      </div>
    </div>
  );
}
