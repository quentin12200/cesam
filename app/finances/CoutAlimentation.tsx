"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, ChevronUp, Info, Plus, Save, X } from "lucide-react";

type ModeVente = "PRIX_KG" | "PRIX_TONNE" | "PRIX_SAC" | "PRIX_BIDON" | "AUTRE";

interface Tarif {
  id: string;
  dateSaisie: string;
  modeVente: ModeVente;
  prixPaye: number;
  poidsKg: number;
  prixKg: number;
  fournisseur: string | null;
  marque: string | null;
  conditionnement: string | null;
  note: string | null;
}

interface Produit {
  id: string;
  nom: string;
  tarifs: Tarif[];
}

const MODES: { value: ModeVente; label: string }[] = [
  { value: "PRIX_KG", label: "Prix par kilogramme" },
  { value: "PRIX_TONNE", label: "Prix par tonne" },
  { value: "PRIX_SAC", label: "Prix par sac" },
  { value: "PRIX_BIDON", label: "Prix par bidon" },
  { value: "AUTRE", label: "Autre conditionnement" },
];

const prix = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const prixKg = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 3 });

function dateFr(date: string) {
  return new Date(date).toLocaleDateString("fr-FR");
}

function modeLabel(mode: ModeVente) {
  return MODES.find((item) => item.value === mode)?.label ?? mode;
}

export default function CoutAlimentation() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOuvert, setFormOuvert] = useState(false);
  const [detailsOuverts, setDetailsOuverts] = useState<string | null>(null);
  const [complementsOuverts, setComplementsOuverts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");
  const [nom, setNom] = useState("");
  const [dateSaisie, setDateSaisie] = useState(new Date().toISOString().slice(0, 10));
  const [modeVente, setModeVente] = useState<ModeVente>("PRIX_TONNE");
  const [prixPaye, setPrixPaye] = useState("");
  const [poidsKg, setPoidsKg] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [marque, setMarque] = useState("");
  const [conditionnement, setConditionnement] = useState("");
  const [note, setNote] = useState("");

  async function charger() {
    try {
      const response = await fetch("/api/finances/aliments", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setProduits(data.produits);
    } catch {
      setErreur("Impossible de charger les tarifs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void charger();
  }, []);

  const poidsReference = useMemo(() => {
    if (modeVente === "PRIX_KG") return 1;
    if (modeVente === "PRIX_TONNE") return 1000;
    const valeur = Number(poidsKg);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
  }, [modeVente, poidsKg]);

  const prixCalcule = Number(prixPaye) > 0 && poidsReference ? Number(prixPaye) / poidsReference : null;
  const poidsNecessaire = !["PRIX_KG", "PRIX_TONNE"].includes(modeVente);

  function fermerFormulaire() {
    setFormOuvert(false);
    setErreur("");
  }

  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErreur("");
    try {
      const response = await fetch("/api/finances/aliments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          dateSaisie,
          modeVente,
          prixPaye,
          poidsKg: poidsNecessaire ? poidsKg : null,
          fournisseur,
          marque,
          conditionnement,
          note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Enregistrement impossible.");
      setProduits(data.produits);
      setNom("");
      setPrixPaye("");
      setPoidsKg("");
      setFournisseur("");
      setMarque("");
      setConditionnement("");
      setNote("");
      setComplementsOuverts(false);
      setFormOuvert(false);
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl shadow overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-800">Coût de l'alimentation</h3>
          <p className="text-xs text-gray-500">Tarifs actuels des aliments et compléments</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOuvert(true)}
          className="h-11 px-3 flex items-center gap-1.5 rounded-lg bg-green-700 text-white text-sm font-semibold"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Ajouter un tarif</span>
          <span className="sm:hidden">Tarif</span>
        </button>
      </div>

      {formOuvert && (
        <form onSubmit={enregistrer} className="p-4 border-b border-green-100 bg-green-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Nouveau tarif</h4>
            <button type="button" onClick={fermerFormulaire} className="h-11 w-11 flex items-center justify-center text-gray-500 rounded-lg hover:bg-white" aria-label="Fermer">
              <X size={19} />
            </button>
          </div>

          {erreur && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erreur}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              Nom du produit *
              <input
                required
                list="aliments-existants"
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3 bg-white"
                placeholder="Tourteau, minéraux..."
              />
              <datalist id="aliments-existants">
                {produits.map((produit) => <option key={produit.id} value={produit.nom} />)}
              </datalist>
            </label>
            <label className="text-sm text-gray-700">
              Date de saisie *
              <input required type="date" value={dateSaisie} onChange={(event) => setDateSaisie(event.target.value)} className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3 bg-white" />
            </label>
            <label className="text-sm text-gray-700">
              Mode de vente *
              <select value={modeVente} onChange={(event) => setModeVente(event.target.value as ModeVente)} className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3 bg-white">
                {MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Prix payé (€) *
              <input required type="number" min="0.01" step="0.01" value={prixPaye} onChange={(event) => setPrixPaye(event.target.value)} className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3 bg-white" placeholder="520" />
            </label>
            {poidsNecessaire && (
              <label className="text-sm text-gray-700 sm:col-span-2">
                Poids total ou poids du contenant (kg) *
                <input required type="number" min="0.001" step="0.001" value={poidsKg} onChange={(event) => setPoidsKg(event.target.value)} className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3 bg-white" placeholder="25" />
              </label>
            )}
          </div>

          {prixCalcule !== null && (
            <div className="flex items-center justify-between rounded-lg bg-white border border-green-200 px-3 py-2">
              <span className="text-sm text-gray-600">Prix calculé</span>
              <strong className="text-green-800">{prixKg.format(prixCalcule)} / kg</strong>
            </div>
          )}

          <button type="button" onClick={() => setComplementsOuverts((value) => !value)} className="min-h-11 flex items-center gap-1.5 text-sm font-medium text-gray-600">
            Informations complémentaires
            {complementsOuverts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {complementsOuverts && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={fournisseur} onChange={(event) => setFournisseur(event.target.value)} className="h-11 border border-gray-300 rounded-lg px-3 bg-white" placeholder="Fournisseur" aria-label="Fournisseur" />
              <input value={marque} onChange={(event) => setMarque(event.target.value)} className="h-11 border border-gray-300 rounded-lg px-3 bg-white" placeholder="Marque" aria-label="Marque" />
              <input value={conditionnement} onChange={(event) => setConditionnement(event.target.value)} className="h-11 border border-gray-300 rounded-lg px-3 bg-white" placeholder="Conditionnement" aria-label="Conditionnement" />
              <input value={note} onChange={(event) => setNote(event.target.value)} className="h-11 border border-gray-300 rounded-lg px-3 bg-white" placeholder="Note" aria-label="Note" />
            </div>
          )}

          <button type="submit" disabled={saving} className="h-11 px-4 flex items-center justify-center gap-2 rounded-lg bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
            <Save size={17} />
            {saving ? "Enregistrement..." : "Enregistrer le tarif"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="px-4 py-6 text-sm text-gray-500 text-center">Chargement...</p>
      ) : produits.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 text-center">Aucun tarif d'aliment enregistré.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {produits.map((produit) => {
            const actuel = produit.tarifs[0];
            const ouvert = detailsOuverts === produit.id;
            return (
              <div key={produit.id}>
                <div className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-gray-800 truncate">{produit.nom}</p>
                    <div className="hidden sm:block min-w-0">
                      <p className="text-sm text-gray-700">{prix.format(actuel.prixPaye)}</p>
                      <p className="text-xs text-gray-500 truncate">{modeLabel(actuel.modeVente)}</p>
                    </div>
                    <div className="text-right sm:text-left font-semibold text-green-800">
                      {prixKg.format(actuel.prixKg)}<span className="text-xs font-normal">/kg</span>
                    </div>
                    <div className="hidden sm:block text-sm text-gray-500">{dateFr(actuel.dateSaisie)}</div>
                    <p className="sm:hidden col-span-2 text-xs text-gray-500">
                      {prix.format(actuel.prixPaye)} · {modeLabel(actuel.modeVente)} · {dateFr(actuel.dateSaisie)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOuverts(ouvert ? null : produit.id)}
                    className="h-11 w-11 shrink-0 flex items-center justify-center text-gray-500 hover:text-green-700 hover:bg-green-50 rounded-lg"
                    aria-label={`Informations sur ${produit.nom}`}
                    aria-expanded={ouvert}
                  >
                    <Info size={20} />
                  </button>
                </div>

                {ouvert && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-sm">
                      <div><dt className="text-xs text-gray-500">Fournisseur</dt><dd className="text-gray-800">{actuel.fournisseur ?? "Non renseigné"}</dd></div>
                      <div><dt className="text-xs text-gray-500">Marque</dt><dd className="text-gray-800">{actuel.marque ?? "Non renseignée"}</dd></div>
                      <div><dt className="text-xs text-gray-500">Conditionnement</dt><dd className="text-gray-800">{actuel.conditionnement ?? `${actuel.poidsKg.toLocaleString("fr-FR")} kg`}</dd></div>
                      <div><dt className="text-xs text-gray-500">Note</dt><dd className="text-gray-800">{actuel.note ?? "Aucune"}</dd></div>
                    </dl>

                    <h5 className="text-xs font-semibold text-gray-600 uppercase mb-2">Historique des tarifs</h5>
                    {produit.tarifs.length === 1 ? (
                      <p className="text-xs text-gray-500">Aucun ancien tarif.</p>
                    ) : (
                      <div className="divide-y divide-gray-200 border-y border-gray-200">
                        {produit.tarifs.slice(1).map((tarif) => (
                          <div key={tarif.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <div>
                              <span className="text-gray-700">{dateFr(tarif.dateSaisie)}</span>
                              <span className="text-xs text-gray-500 ml-2">{modeLabel(tarif.modeVente)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-700">{prix.format(tarif.prixPaye)}</span>
                              <span className="text-green-800 font-medium ml-2">{prixKg.format(tarif.prixKg)}/kg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
