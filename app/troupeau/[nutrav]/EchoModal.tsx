"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScanLine, X } from "lucide-react";
import { VELAGE_IMMINENT_COLORS } from "@/lib/utils";

const DUREE_GESTATION = 285;
const today = new Date().toISOString().slice(0, 10);
const ECART_TOLERE_JOURS = 10;

interface BreedingChoice {
  id: string;
  date: string;
  type: string;
  estimation: boolean;
  taureauId: string | null;
  taureau: { id: string; nupere: string; nopere: string | null } | null;
}

interface BullChoice {
  id: string;
  nupere: string;
  nopere: string | null;
  present: boolean;
}

interface Props {
  nutrav: string;
  saillieId?: string | null;
  saillieDate?: string | null;
  initialMode?: "PLANIFIER" | "ENREGISTRER";
  onClose: () => void;
  onDone: () => void;
}

export default function EchoModal({
  nutrav,
  saillieId,
  saillieDate,
  initialMode = "PLANIFIER",
  onClose,
  onDone,
}: Props) {
  const joursDepuisSaillie = saillieDate ? differenceInDays(new Date(), new Date(saillieDate)) : 1;
  const [mode, setMode] = useState<"PLANIFIER" | "ENREGISTRER">(initialMode);
  const [date, setDate] = useState(today);
  const [resultat, setResultat] = useState<"PLEINE" | "VIDE">("PLEINE");
  const [joursGestation, setJoursGestation] = useState(Math.max(1, joursDepuisSaillie));
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [breedings, setBreedings] = useState<BreedingChoice[]>([]);
  const [bulls, setBulls] = useState<BullChoice[]>([]);
  const [originMode, setOriginMode] = useState<"EXISTANTE" | "NOUVELLE">("EXISTANTE");
  const [selectedBreedingId, setSelectedBreedingId] = useState("");
  const [originSelectionTouched, setOriginSelectionTouched] = useState(false);
  const [selectedBullId, setSelectedBullId] = useState("");
  const [newBreedingType, setNewBreedingType] = useState<"NATURELLE" | "IA">("NATURELLE");
  const [newBreedingDate, setNewBreedingDate] = useState(today);
  const [otherBullReference, setOtherBullReference] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/animaux/${nutrav}`, { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/taureaux", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([animal, bullData]) => {
      const lastCalvingDate = animal.velagesVache?.[0]?.date ? new Date(animal.velagesVache[0].date) : null;
      const currentBreedings = (animal.saillies ?? []).filter((breeding: BreedingChoice) => !lastCalvingDate || new Date(breeding.date) > lastCalvingDate);
      setAnimalId(animal.id ?? "");
      setBreedings(currentBreedings);
      setBulls(bullData.taureaux ?? []);
    }).catch(() => setError("Impossible de charger les tentatives de reproduction."));
  }, [nutrav]);

  const dateVelagePrevue = useMemo(() => {
    if (mode !== "ENREGISTRER" || resultat !== "PLEINE" || !date) return null;
    return addDays(new Date(date), DUREE_GESTATION - joursGestation);
  }, [date, joursGestation, mode, resultat]);
  const joursRestants = dateVelagePrevue ? differenceInDays(dateVelagePrevue, new Date()) : null;
  const dateDebutEstimee = useMemo(
    () => addDays(date ? new Date(date) : new Date(), -joursGestation),
    [date, joursGestation]
  );
  const proposedBreeding = useMemo(() => {
    return [...breedings].sort((left, right) =>
      Math.abs(differenceInDays(new Date(left.date), dateDebutEstimee))
      - Math.abs(differenceInDays(new Date(right.date), dateDebutEstimee))
    )[0] ?? null;
  }, [breedings, dateDebutEstimee]);
  const selectedBreeding = breedings.find((breeding) => breeding.id === selectedBreedingId) ?? null;
  const selectedGap = selectedBreeding ? Math.abs(differenceInDays(new Date(selectedBreeding.date), dateDebutEstimee)) : 0;

  useEffect(() => {
    if (!proposedBreeding || originSelectionTouched) return;
    setSelectedBreedingId(proposedBreeding.id);
  }, [originSelectionTouched, proposedBreeding]);

  useEffect(() => {
    if (selectedBreeding) setSelectedBullId(selectedBreeding.taureauId ?? "");
  }, [selectedBreeding]);

  useEffect(() => {
    setNewBreedingDate(format(dateDebutEstimee, "yyyy-MM-dd"));
  }, [dateDebutEstimee]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      let originSaillieId = saillieId ?? "";
      let originDate = saillieDate ? new Date(saillieDate) : dateDebutEstimee;
      let originBullId = selectedBullId;
      let updateTaureau = false;

      if (mode === "ENREGISTRER" && resultat === "PLEINE") {
        if (originMode === "EXISTANTE") {
          if (!selectedBreeding) throw new Error("Sélectionnez une saillie ou une IA existante.");
          originSaillieId = selectedBreeding.id;
          originDate = new Date(selectedBreeding.date);
          updateTaureau = selectedBullId !== (selectedBreeding.taureauId ?? "");
          if (selectedGap > ECART_TOLERE_JOURS && !window.confirm("L’âge de gestation estimé ne correspond pas précisément à cette saillie ou IA. Vérifiez la tentative retenue.\n\nConserver cette tentative ?")) {
            setSaving(false);
            return;
          }
        } else {
          if (!animalId || !newBreedingDate) throw new Error("La nouvelle tentative probable est incomplète.");
          if (originBullId === "OTHER") {
            if (!otherBullReference.trim()) throw new Error("Renseignez la référence du taureau ou de l’IA.");
            const bullResponse = await fetch("/api/taureaux", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nupere: otherBullReference.trim(), nopere: otherBullReference.trim(), present: newBreedingType === "NATURELLE" }),
            });
            const createdBull = await bullResponse.json();
            if (!bullResponse.ok) throw new Error(createdBull.error ?? "Création du taureau impossible");
            originBullId = createdBull.id;
          }
          const breedingResponse = await fetch("/api/saillies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              animalId,
              date: newBreedingDate,
              type: newBreedingType,
              taureauId: originBullId && originBullId !== "UNKNOWN" ? originBullId : null,
              estimation: true,
            }),
          });
          const createdBreeding = await breedingResponse.json();
          if (!breedingResponse.ok) throw new Error(createdBreeding.error ?? "Création de la tentative probable impossible");
          originSaillieId = createdBreeding.id;
          originDate = new Date(newBreedingDate);
          updateTaureau = false;
        }
      }

      if (mode === "ENREGISTRER" && !originSaillieId) throw new Error("Aucune saillie ou IA n’est disponible pour enregistrer cette échographie.");
      const response = await fetch(
        mode === "PLANIFIER" ? `/api/animaux/${nutrav}/echo-request` : "/api/echographies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "PLANIFIER" ? {
            datePlanification: date,
            saillieId: saillieId ?? null,
            observation: observation.trim() || undefined,
            motif: "CONTROLE_SUPPLEMENTAIRE",
          } : {
            saillieId: originSaillieId,
            date,
            resultat,
            joursGestation: resultat === "PLEINE" ? joursGestation : undefined,
            dateVelagePrevue: resultat === "PLEINE" ? addDays(originDate, DUREE_GESTATION).toISOString() : undefined,
            updateTaureau,
            taureauId: selectedBullId && selectedBullId !== "UNKNOWN" ? selectedBullId : null,
            remarque: observation.trim() || undefined,
          }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Erreur serveur");
        return;
      }
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-gray-900"><ScanLine size={18} className="text-yellow-600" />Échographie — {nutrav}</h3>
          <button type="button" onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-gray-700">Que voulez-vous faire ?</legend>
            <div className="grid gap-2">
              <button type="button" onClick={() => setMode("PLANIFIER")} className={`min-h-11 rounded-xl border-2 px-3 text-left text-sm font-bold ${mode === "PLANIFIER" ? "border-yellow-500 bg-yellow-50 text-yellow-900" : "border-gray-200 text-gray-600"}`}>Ajouter à la liste des vaches à échographier</button>
              <button type="button" onClick={() => setMode("ENREGISTRER")} className={`min-h-11 rounded-xl border-2 px-3 text-left text-sm font-bold ${mode === "ENREGISTRER" ? "border-yellow-500 bg-yellow-50 text-yellow-900" : "border-gray-200 text-gray-600"}`}>Enregistrer une échographie</button>
            </div>
          </fieldset>

          <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm"><span className="text-gray-500">Animal</span><strong className="float-right font-mono text-gray-900">{nutrav}</strong></div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{mode === "PLANIFIER" ? "Date de planification" : "Date de l’échographie"}</label>
            <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} required className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            {saillieDate && <p className="mt-1 text-xs text-gray-400">Tentative associée : {format(new Date(saillieDate), "d MMM yyyy", { locale: fr })}</p>}
          </div>

          {mode === "ENREGISTRER" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Résultat</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setResultat("PLEINE")} className={`min-h-11 rounded-xl border-2 text-sm font-bold ${resultat === "PLEINE" ? "border-green-500 bg-green-500 text-white" : "border-gray-200 text-gray-600"}`}>✓ Pleine</button>
                  <button type="button" onClick={() => setResultat("VIDE")} className={`min-h-11 rounded-xl border-2 text-sm font-bold ${resultat === "VIDE" ? "border-red-500 bg-red-500 text-white" : "border-gray-200 text-gray-600"}`}>× Vide</button>
                </div>
              </div>

              {resultat === "PLEINE" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Stade de gestation (jours)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} max={284} value={joursGestation} onChange={(event) => setJoursGestation(Math.max(1, Math.min(284, Number(event.target.value) || 1)))} className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-center text-sm font-bold" />
                    <span className="text-sm text-gray-500">jours de gestation</span>
                  </div>
                  {dateVelagePrevue && (
                    <div className={`mt-2 rounded-xl border px-3 py-2.5 text-sm ${joursRestants !== null && joursRestants <= 21 ? `${VELAGE_IMMINENT_COLORS.surface} ${VELAGE_IMMINENT_COLORS.border}` : "border-green-100 bg-green-50"}`}>
                      <div className="flex justify-between"><span className="text-gray-600">Vêlage prévu</span><strong>{format(dateVelagePrevue, "d MMM yyyy", { locale: fr })}</strong></div>
                    </div>
                  )}

                  <section className="mt-4 space-y-3 rounded-xl border border-green-200 bg-green-50/50 p-3">
                    <h4 className="text-sm font-extrabold text-green-900">Saillie ou IA à l’origine de la gestation</h4>
                    <p className="text-xs text-green-900">Date estimée de début de gestation : <strong>{format(dateDebutEstimee, "d MMM yyyy", { locale: fr })}</strong></p>
                    {proposedBreeding && (
                      <p className="text-xs text-gray-600">
                        Tentative proposée : <strong>{proposedBreeding.type === "IA" ? "IA" : "Saillie naturelle"} du {format(new Date(proposedBreeding.date), "d MMM yyyy", { locale: fr })}</strong>
                        {" · "}écart {Math.abs(differenceInDays(new Date(proposedBreeding.date), dateDebutEstimee))} j
                      </p>
                    )}

                    <div className="grid gap-2">
                      <button type="button" onClick={() => setOriginMode("EXISTANTE")} className={`min-h-11 rounded-lg border px-3 text-left text-xs font-bold ${originMode === "EXISTANTE" ? "border-green-600 bg-white text-green-800" : "border-gray-200 bg-white text-gray-600"}`}>Utiliser une saillie ou IA déjà enregistrée</button>
                      <button type="button" onClick={() => setOriginMode("NOUVELLE")} className={`min-h-11 rounded-lg border px-3 text-left text-xs font-bold ${originMode === "NOUVELLE" ? "border-green-600 bg-white text-green-800" : "border-gray-200 bg-white text-gray-600"}`}>Créer une nouvelle saillie probable</button>
                    </div>

                    {originMode === "EXISTANTE" ? (
                      <>
                        <label className="block text-xs font-semibold text-gray-600">Tentative retenue
                          <select
                            value={selectedBreedingId}
                            onChange={(event) => {
                              setOriginSelectionTouched(true);
                              setSelectedBreedingId(event.target.value);
                            }}
                            className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm"
                          >
                            <option value="">Sélectionner…</option>
                            {breedings.map((breeding) => (
                              <option key={breeding.id} value={breeding.id}>
                                {breeding.type === "IA" ? "IA" : "Saillie"} · {format(new Date(breeding.date), "d MMM yyyy", { locale: fr })} · {breeding.taureau?.nopere ?? breeding.taureau?.nupere ?? "Père inconnu"} · écart {Math.abs(differenceInDays(new Date(breeding.date), dateDebutEstimee))} j
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedBreeding && selectedGap > ECART_TOLERE_JOURS && <p className="rounded-lg bg-orange-100 p-2 text-xs font-semibold text-orange-800">L’âge de gestation estimé ne correspond pas précisément à cette saillie ou IA. Vérifiez la tentative retenue.</p>}
                      </>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-gray-600">Date probable<input type="date" value={newBreedingDate} onChange={(event) => setNewBreedingDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm" /></label>
                        <label className="text-xs font-semibold text-gray-600">Type<select value={newBreedingType} onChange={(event) => setNewBreedingType(event.target.value as "NATURELLE" | "IA")} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm"><option value="NATURELLE">Saillie naturelle</option><option value="IA">IA</option></select></label>
                      </div>
                    )}

                    <label className="block text-xs font-semibold text-gray-600">{newBreedingType === "IA" ? "Référence IA / père" : "Taureau / père"}
                      <select value={selectedBullId || "UNKNOWN"} onChange={(event) => setSelectedBullId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm">
                        <option value="UNKNOWN">Père inconnu</option>
                        {bulls.map((bull) => <option key={bull.id} value={bull.id}>{bull.nopere ?? bull.nupere}{bull.present ? " · présent" : " · IA"}</option>)}
                        {originMode === "NOUVELLE" && <option value="OTHER">Autre taureau ou référence</option>}
                      </select>
                    </label>
                    {originMode === "NOUVELLE" && selectedBullId === "OTHER" && <input value={otherBullReference} onChange={(event) => setOtherBullReference(event.target.value)} placeholder="Nom ou référence" className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" />}
                  </section>
                </div>
              )}
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Observation (facultative)</label>
            <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <button type="submit" disabled={saving || !date} className="min-h-12 w-full rounded-xl bg-yellow-500 px-4 text-sm font-bold text-white hover:bg-yellow-600 disabled:opacity-50">
            {saving ? "Enregistrement…" : mode === "PLANIFIER" ? "Ajouter à la liste" : "Enregistrer l’écho"}
          </button>
        </form>
      </div>
    </div>
  );
}
