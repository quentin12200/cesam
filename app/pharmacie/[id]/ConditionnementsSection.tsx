"use client";

import { FormEvent, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

interface Conditionnement {
  id: string;
  doses: number;
  prixFlaconEur: number | null;
}

interface Props {
  medicamentId: string;
  initialConditionnements: Conditionnement[];
}

const prixFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export default function ConditionnementsSection({ medicamentId, initialConditionnements }: Props) {
  const [conditionnements, setConditionnements] = useState(initialConditionnements);
  const [modeAjout, setModeAjout] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [doses, setDoses] = useState("");
  const [prixFlaconEur, setPrixFlaconEur] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");

  function fermerFormulaire() {
    setModeAjout(false);
    setEditionId(null);
    setDoses("");
    setPrixFlaconEur("");
    setErreur("");
  }

  function modifier(conditionnement: Conditionnement) {
    setModeAjout(false);
    setEditionId(conditionnement.id);
    setDoses(String(conditionnement.doses));
    setPrixFlaconEur(conditionnement.prixFlaconEur == null ? "" : String(conditionnement.prixFlaconEur));
    setErreur("");
  }

  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    setEnregistrement(true);
    setErreur("");
    const payload = { medicamentId, doses, prixFlaconEur: prixFlaconEur.replace(",", ".") };

    try {
      const response = await fetch(editionId ? `/api/conditionnements/${editionId}` : "/api/conditionnements", {
        method: editionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible");

      const conditionnement: Conditionnement = {
        id: data.id,
        doses: data.doses,
        prixFlaconEur: data.prixFlaconEur,
      };
      setConditionnements((actuels) => editionId
        ? actuels.map((item) => item.id === editionId ? conditionnement : item)
        : [...actuels, conditionnement]);
      fermerFormulaire();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimer(id: string) {
    if (!window.confirm("Supprimer ce conditionnement ?")) return;
    const response = await fetch(`/api/conditionnements/${id}`, { method: "DELETE" });
    if (response.ok) {
      setConditionnements((actuels) => actuels.filter((item) => item.id !== id));
      if (editionId === id) fermerFormulaire();
    } else {
      setErreur("Suppression impossible");
    }
  }

  const formulaireVisible = modeAjout || editionId !== null;
  const dosesNombre = Number(doses);
  const prixNombre = Number(prixFlaconEur.replace(",", "."));

  return (
    <section className="rounded-xl bg-white p-4 shadow space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-800">Conditionnements disponibles</h3>
        {!formulaireVisible && (
          <button type="button" onClick={() => setModeAjout(true)}
            className="flex min-h-9 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
            <Plus size={13} /> Ajouter
          </button>
        )}
      </div>

      {conditionnements.length === 0 && !formulaireVisible && (
        <p className="py-2 text-center text-sm text-gray-400">Aucun conditionnement enregistré</p>
      )}

      <div className="divide-y divide-gray-100">
        {conditionnements.map((conditionnement) => (
          <div key={conditionnement.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium text-gray-800">{conditionnement.doses} dose{conditionnement.doses > 1 ? "s" : ""}</span>
              {conditionnement.prixFlaconEur == null ? (
                <span className="text-orange-600"> · prix à renseigner</span>
              ) : (
                <>
                  <span className="text-gray-500"> · {prixFormatter.format(conditionnement.prixFlaconEur)} le flacon</span>
                  <span className="block text-xs text-gray-500">{prixFormatter.format(conditionnement.prixFlaconEur / conditionnement.doses)} / dose</span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => modifier(conditionnement)} aria-label="Modifier ce conditionnement"
                className="rounded-md p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={14} /></button>
              <button type="button" onClick={() => void supprimer(conditionnement.id)} aria-label="Supprimer ce conditionnement"
                className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {formulaireVisible && (
        <form onSubmit={enregistrer} className="space-y-2 rounded-lg border border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">Doses par flacon
              <input type="number" min="1" step="1" required value={doses} onChange={(event) => setDoses(event.target.value)}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
            </label>
            <label className="text-xs text-gray-600">Prix du flacon (€)
              <input type="number" min="0.01" step="0.01" required value={prixFlaconEur} onChange={(event) => setPrixFlaconEur(event.target.value)}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
            </label>
          </div>
          {dosesNombre > 0 && prixNombre > 0 && (
            <p className="text-xs text-gray-500">Prix calculé : {prixFormatter.format(prixNombre / dosesNombre)} / dose</p>
          )}
          {erreur && <p className="text-xs text-red-600">{erreur}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={fermerFormulaire} disabled={enregistrement}
              className="flex min-h-9 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-gray-600"><X size={13} /> Annuler</button>
            <button type="submit" disabled={enregistrement}
              className="flex min-h-9 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-50">
              <Check size={13} /> {editionId ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
