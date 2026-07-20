"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Search, Trash2, X } from "lucide-react";
import { normalizeSearch } from "@/lib/fuzzy-search";

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

function texteNombre(valeur: number | null) {
  return valeur == null ? "" : String(valeur);
}

function lignesInitiales(medicaments: MedicamentPrix[]): Ligne[] {
  return medicaments.flatMap((medicament) => medicament.conditionnements.map((format) => ({
    key: format.id,
    id: format.id,
    medicamentId: medicament.id,
    quantiteFlacon: texteNombre(format.quantiteFlacon),
    uniteFlacon: format.uniteFlacon ?? "",
    doses: format.doses > 0 ? String(format.doses) : "",
    prixFlaconEur: texteNombre(format.prixFlaconEur),
    modifiee: false,
  })));
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
  if (!ligne.medicamentId) erreurs.push("médicament");
  if (!ligne.quantiteFlacon.trim() || !Number.isFinite(nombre(ligne.quantiteFlacon)) || nombre(ligne.quantiteFlacon) <= 0) erreurs.push("quantité");
  if (!UNITES.includes(ligne.uniteFlacon)) erreurs.push("unité");
  if (ligne.doses.trim() && (!Number.isFinite(nombre(ligne.doses)) || nombre(ligne.doses) <= 0)) erreurs.push("nombre de doses");
  if (!ligne.prixFlaconEur.trim() || !Number.isFinite(nombre(ligne.prixFlaconEur)) || nombre(ligne.prixFlaconEur) <= 0) erreurs.push("prix HT");
  return erreurs;
}

export default function SaisiePrixClient({ medicaments, onRetour }: Props) {
  const [lignes, setLignes] = useState<Ligne[]>(() => lignesInitiales(medicaments));
  const [suppressions, setSuppressions] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [erreurGlobale, setErreurGlobale] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const noms = useMemo(() => new Map(medicaments.map((medicament) => [medicament.id, medicament.nom])), [medicaments]);
  const lignesVisibles = useMemo(() => {
    const requete = normalizeSearch(recherche.trim());
    if (!requete) return lignes;
    return lignes.filter((ligne) => normalizeSearch(noms.get(ligne.medicamentId) ?? "").includes(requete));
  }, [lignes, noms, recherche]);

  function modifier(key: string, champ: keyof Pick<Ligne, "medicamentId" | "quantiteFlacon" | "uniteFlacon" | "doses" | "prixFlaconEur">, valeur: string) {
    setLignes((courantes) => courantes.map((ligne) => ligne.key === key ? { ...ligne, [champ]: valeur, modifiee: true } : ligne));
    setErreurs((courantes) => {
      if (!courantes[key]) return courantes;
      const suivantes = { ...courantes };
      delete suivantes[key];
      return suivantes;
    });
    setConfirmation("");
  }

  function ajouterLigne() {
    const key = `nouveau-${Date.now()}-${Math.random()}`;
    setLignes((courantes) => [...courantes, {
      key,
      medicamentId: "",
      quantiteFlacon: "",
      uniteFlacon: "ml",
      doses: "",
      prixFlaconEur: "",
      modifiee: false,
    }]);
    setRecherche("");
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

      const parMedicament = new Map<string, MedicamentPrix>();
      for (const medicament of medicaments) parMedicament.set(medicament.id, { ...medicament, conditionnements: [] });
      for (const format of resultat.conditionnements) {
        parMedicament.get(format.medicamentId)?.conditionnements.push(format);
      }
      setLignes(lignesInitiales([...parMedicament.values()]));
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
    const medicament = (
      <select value={ligne.medicamentId} onChange={(event) => modifier(ligne.key, "medicamentId", event.target.value)} className={classeChamp}>
        <option value="">Choisir…</option>
        {medicaments.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
      </select>
    );
    const quantite = (
      <input inputMode="decimal" value={ligne.quantiteFlacon} onChange={(event) => modifier(ligne.key, "quantiteFlacon", event.target.value)}
        placeholder="200" className={classeChamp} />
    );
    const unite = (
      <select value={ligne.uniteFlacon} onChange={(event) => modifier(ligne.key, "uniteFlacon", event.target.value)} className={classeChamp}>
        <option value="">Choisir…</option>
        {UNITES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    );
    const nombreDoses = (
      <input inputMode="decimal" value={ligne.doses} onChange={(event) => modifier(ligne.key, "doses", event.target.value)}
        placeholder="Facultatif" className={classeChamp} />
    );
    const prixProduit = (
      <input inputMode="decimal" value={ligne.prixFlaconEur} onChange={(event) => modifier(ligne.key, "prixFlaconEur", event.target.value)}
        placeholder="54,00" className={classeChamp} />
    );
    const prixUnitaireTexte = prixUnite == null ? "—" : `${prixFormatter.format(prixUnite)} /${ligne.uniteFlacon || "unité"}`;
    const prixDoseTexte = prixDose == null ? "—" : `${prixFormatter.format(prixDose)} /dose`;

    if (!mobile) {
      return (
        <>
          <td className="p-2">{medicament}</td>
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
        <label className="col-span-2 text-xs text-gray-500">Médicament{medicament}</label>
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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onRetour} className="flex min-h-10 items-center gap-1 rounded-lg border bg-white px-3 text-sm text-gray-600">
          <ArrowLeft size={15} /> Retour
        </button>
        <div>
          <h3 className="font-semibold text-gray-900">Saisie groupée des formats et prix</h3>
          <p className="text-xs text-gray-500">Seules les lignes renseignées ou modifiées seront enregistrées.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-3 shadow">
        <div className="flex min-w-56 flex-1 items-center rounded-lg border px-3 py-2">
          <Search size={15} className="mr-2 shrink-0 text-gray-400" />
          <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher un médicament…"
            className="w-full text-sm outline-none" />
          {recherche && <button type="button" onClick={() => setRecherche("")} aria-label="Effacer la recherche"><X size={14} /></button>}
        </div>
        <button type="button" onClick={ajouterLigne} className="flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm text-blue-600">
          <Plus size={15} /> Ajouter une ligne
        </button>
        <button type="button" onClick={() => void enregistrerTout()} disabled={enregistrement}
          className="flex min-h-10 items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50">
          <Save size={15} /> Enregistrer toutes les lignes
        </button>
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
              <th className="w-12 p-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignesVisibles.map((ligne) => (
              <tr key={ligne.key} className={erreurs[ligne.key] ? "bg-red-50/60" : ""}>
                {champs(ligne)}
                <td className="p-2">
                  <button type="button" onClick={() => supprimerLigne(ligne)} aria-label="Supprimer la ligne"
                    className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  {erreurs[ligne.key] && <span className="block text-[10px] text-red-600">{erreurs[ligne.key].join(", ")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {lignesVisibles.map((ligne) => (
          <div key={ligne.key} className={`rounded-xl border bg-white p-3 shadow-sm ${erreurs[ligne.key] ? "border-red-300" : "border-gray-100"}`}>
            <div className="grid grid-cols-2 gap-2">
              {champs(ligne, true)}
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              {erreurs[ligne.key]
                ? <span className="text-xs text-red-600">À corriger : {erreurs[ligne.key].join(", ")}</span>
                : <span />}
              <button type="button" onClick={() => supprimerLigne(ligne)} className="flex items-center gap-1 text-xs text-red-600">
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {lignesVisibles.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Aucune ligne pour cette recherche.</p>}
    </div>
  );
}
