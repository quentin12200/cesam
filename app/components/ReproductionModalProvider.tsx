"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ACTION_VISUALS } from "@/components/action-visuals";
import {
  showOriginConfirmation,
  TRANSIENT_MODAL_HISTORY_KEY,
} from "@/lib/origin-navigation";

export interface ReproductionModalAnimal {
  id: string;
  nutrav: string;
  nom?: string | null;
}

interface InitialBull {
  id?: string | null;
  reference?: string | null;
  nom?: string | null;
}

export interface ReproductionModalRequest {
  action: "chaleur" | "saillie";
  animals: ReproductionModalAnimal[];
  type?: "NATURELLE" | "IA";
  date?: string;
  initialBull?: InitialBull | null;
  simulationAware?: boolean;
}

interface Bull {
  id: string;
  nupere: string;
  nopere: string | null;
  present: boolean;
  traper: string | null;
}

interface ReproductionModalContextValue {
  openReproductionModal: (request: ReproductionModalRequest) => void;
}

const ReproductionModalContext = createContext<ReproductionModalContextValue | null>(null);
const MODAL_HISTORY_KEY = "__cesamReproductionModal";
const ChaleurIcon = ACTION_VISUALS.chaleur.icon;
const SaillieIcon = ACTION_VISUALS.saillieIA.icon;

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function ReproductionActionModal({
  request,
  onClose,
  onSaved,
}: {
  request: ReproductionModalRequest;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [date, setDate] = useState(request.date || localDateValue());
  const [time, setTime] = useState(localTimeValue());
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"NATURELLE" | "IA">(request.type ?? "NATURELLE");
  const [bulls, setBulls] = useState<Bull[]>([]);
  const [bullsLoading, setBullsLoading] = useState(request.action === "saillie");
  const [selectedBullId, setSelectedBullId] = useState(request.initialBull?.id ?? "");
  const [naturalBullName, setNaturalBullName] = useState(
    request.type === "NATURELLE" ? request.initialBull?.nom ?? "" : ""
  );
  const [iaReference, setIaReference] = useState(
    request.type === "IA" ? request.initialBull?.reference ?? "" : ""
  );
  const [iaName, setIaName] = useState(
    request.type === "IA" ? request.initialBull?.nom ?? "" : ""
  );
  const [iaOrigin, setIaOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (request.action !== "saillie") return;
    let active = true;
    fetch("/api/taureaux", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: { taureaux?: Bull[] }) => {
        if (active) setBulls(data.taureaux ?? []);
      })
      .catch(() => {
        if (active) setError("Impossible de charger la liste des taureaux.");
      })
      .finally(() => {
        if (active) setBullsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request.action]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const animalIds = request.animals.map((animal) => animal.id);
  const farmBulls = bulls.filter((bull) => bull.present);
  const iaBulls = bulls.filter((bull) => !bull.present);

  function simulatedWriteIsBlocked() {
    if (!request.simulationAware) return false;
    const scenario = document.querySelector<HTMLSelectElement>("[data-reproduction-preview-scenario]");
    if (!scenario || scenario.value === "real") return false;
    setError("Revenez sur Données réelles pour enregistrer un événement.");
    return true;
  }

  async function submitHeat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || simulatedWriteIsBlocked()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/chaleurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalIds,
          date,
          observedAt: new Date(`${date}T${time}`).toISOString(),
          notes: notes.trim() || null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Enregistrement impossible");
      const baseMessage = animalIds.length > 1
        ? `✓ Chaleur enregistrée pour ${animalIds.length} vaches !`
        : "✓ Chaleur enregistrée !";
      onSaved(result?.duplicateWarning
        ? `${baseMessage} Attention : une chaleur existait déjà à cette date.`
        : baseMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La chaleur n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  async function createBullIfNeeded() {
    if (selectedBullId) return selectedBullId;
    if (type === "NATURELLE" && naturalBullName.trim()) {
      const response = await fetch("/api/taureaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nupere: naturalBullName.trim(),
          nopere: naturalBullName.trim(),
          present: true,
        }),
      });
      if (response.status === 409) {
        return bulls.find((bull) =>
          bull.nupere === naturalBullName.trim() || bull.nopere === naturalBullName.trim()
        )?.id;
      }
      const created = await response.json().catch(() => null);
      if (!response.ok) throw new Error(created?.error ?? "Création du taureau impossible");
      return created.id as string;
    }
    if (type === "IA" && iaReference.trim()) {
      const response = await fetch("/api/taureaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nupere: iaReference.trim(),
          nopere: iaName.trim() || null,
          traper: iaOrigin.trim() || null,
          present: false,
        }),
      });
      if (response.status === 409) {
        return bulls.find((bull) => bull.nupere === iaReference.trim())?.id;
      }
      const created = await response.json().catch(() => null);
      if (!response.ok) throw new Error(created?.error ?? "Création de l’IA impossible");
      return created.id as string;
    }
    return undefined;
  }

  async function submitBreeding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || simulatedWriteIsBlocked()) return;
    setSaving(true);
    setError("");
    try {
      const taureauId = await createBullIfNeeded();
      const response = await fetch("/api/saillies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds, date, type, taureauId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Enregistrement impossible");
      onSaved(animalIds.length > 1
        ? `✓ Saillie enregistrée pour ${animalIds.length} vaches !`
        : "✓ Saillie enregistrée !");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La saillie n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={request.action === "chaleur" ? "Enregistrer une chaleur" : "Enregistrer une saillie ou une IA"}
      className="fixed inset-0 z-[65] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            {request.action === "chaleur"
              ? <ChaleurIcon size={20} className="text-pink-600" />
              : <SaillieIcon size={20} className="text-fuchsia-600" />}
            {request.action === "chaleur" ? "Chaleur" : "Saillie / IA"}
          </h3>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="mb-1 text-xs font-semibold text-green-800">
            {request.animals.length} vache{request.animals.length > 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {request.animals.map((animal) => (
              <span key={animal.id} className="rounded-lg border border-green-200 bg-white px-2 py-1 text-xs text-gray-700">
                <span className="font-mono font-semibold">{animal.nutrav}</span>
                {animal.nom ? ` — ${animal.nom}` : ""}
              </span>
            ))}
          </div>
        </div>

        {request.action === "chaleur" ? (
          <form onSubmit={submitHeat} className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <div>
                <label htmlFor="global-heat-date" className="mb-1 block text-sm font-medium text-gray-700">Date d’observation</label>
                <input id="global-heat-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
              </div>
              <div>
                <label htmlFor="global-heat-time" className="mb-1 block text-sm font-medium text-gray-700">Heure</label>
                <input id="global-heat-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
              </div>
            </div>
            <div>
              <label htmlFor="global-heat-notes" className="mb-1 block text-sm font-medium text-gray-700">Notes <span className="font-normal text-gray-400">(optionnel)</span></label>
              <input id="global-heat-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ex : chaleur forte, montée, mucus…" className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving || !date || !time || animalIds.length === 0} className="w-full rounded-xl bg-pink-600 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? "Enregistrement…" : animalIds.length > 1 ? `Enregistrer pour ${animalIds.length} vaches` : "Enregistrer la chaleur"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitBreeding} className="space-y-4">
            <div>
              <label htmlFor="global-breeding-date" className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input id="global-breeding-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Type</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setType("NATURELLE")} className={`rounded-xl border-2 py-3 text-sm font-semibold ${type === "NATURELLE" ? "border-green-700 bg-green-700 text-white" : "border-gray-200 text-gray-600"}`}>🐄 Naturelle</button>
                <button type="button" onClick={() => setType("IA")} className={`rounded-xl border-2 py-3 text-sm font-semibold ${type === "IA" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-600"}`}>💉 Insémination</button>
              </div>
            </div>

            {bullsLoading && <p className="text-sm text-gray-500">Chargement des taureaux…</p>}
            {!bullsLoading && type === "NATURELLE" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Taureau <span className="font-normal text-gray-400">(optionnel)</span></label>
                {farmBulls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {farmBulls.map((bull) => (
                      <button key={bull.id} type="button" aria-pressed={selectedBullId === bull.id} onClick={() => { setSelectedBullId((id) => id === bull.id ? "" : bull.id); setNaturalBullName(""); }} className={`flex min-h-20 flex-col items-center justify-center rounded-xl border-2 px-1 py-2 text-xs ${selectedBullId === bull.id ? "border-green-700 bg-green-700 text-white" : "border-gray-200 text-gray-700"}`}>
                        <span className="text-xl">🐂</span>
                        <span className="font-bold">{bull.nopere ?? bull.nupere}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input value={naturalBullName} onChange={(event) => { setNaturalBullName(event.target.value); setSelectedBullId(""); }} placeholder="Rechercher ou ajouter un autre taureau" className="mt-3 w-full rounded-xl border border-gray-200 p-3 text-sm" />
                {naturalBullName && !selectedBullId && <p className="mt-1 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs text-yellow-700">Le taureau « {naturalBullName} » sera créé automatiquement.</p>}
              </div>
            )}

            {!bullsLoading && type === "IA" && (
              <div className="space-y-3">
                {iaBulls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {iaBulls.map((bull) => (
                      <button key={bull.id} type="button" onClick={() => { setSelectedBullId((id) => id === bull.id ? "" : bull.id); setIaReference(""); }} className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium ${selectedBullId === bull.id ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-600"}`}>
                        {bull.nopere ?? bull.nupere}{bull.traper ? ` · ${bull.traper}` : ""}
                      </button>
                    ))}
                  </div>
                )}
                <div className={`space-y-2 ${selectedBullId ? "pointer-events-none opacity-30" : ""}`}>
                  <input value={iaReference} onChange={(event) => { setIaReference(event.target.value); setSelectedBullId(""); }} placeholder="Référence / N° paillette" className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={iaName} onChange={(event) => setIaName(event.target.value)} placeholder="Nom taureau" className="rounded-xl border border-gray-200 p-3 text-sm" />
                    <input value={iaOrigin} onChange={(event) => setIaOrigin(event.target.value)} placeholder="Race / Origine" className="rounded-xl border border-gray-200 p-3 text-sm" />
                  </div>
                </div>
              </div>
            )}

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving || !date || animalIds.length === 0} className="w-full rounded-xl bg-green-700 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? "Enregistrement…" : animalIds.length > 1 ? `Enregistrer pour ${animalIds.length} vaches` : "Enregistrer la saillie"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ReproductionModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [request, setRequest] = useState<ReproductionModalRequest | null>(null);
  const historyEntryActive = useRef(false);

  const closeModal = useCallback(() => {
    setRequest(null);
    if (historyEntryActive.current && window.history.state?.[MODAL_HISTORY_KEY]) {
      historyEntryActive.current = false;
      window.history.back();
    } else {
      window.sessionStorage.removeItem(TRANSIENT_MODAL_HISTORY_KEY);
    }
  }, []);

  useEffect(() => {
    const closeOnBack = () => {
      window.sessionStorage.removeItem(TRANSIENT_MODAL_HISTORY_KEY);
      if (!historyEntryActive.current) return;
      historyEntryActive.current = false;
      setRequest(null);
    };
    window.addEventListener("popstate", closeOnBack);
    return () => window.removeEventListener("popstate", closeOnBack);
  }, []);

  const openReproductionModal = useCallback((nextRequest: ReproductionModalRequest) => {
    if (nextRequest.animals.length === 0) return;
    if (!historyEntryActive.current) {
      window.history.pushState(
        { ...window.history.state, [MODAL_HISTORY_KEY]: true },
        "",
        window.location.href
      );
      historyEntryActive.current = true;
      window.sessionStorage.setItem(TRANSIENT_MODAL_HISTORY_KEY, "1");
    }
    setRequest(nextRequest);
  }, []);

  const handleSaved = useCallback((message: string) => {
    setRequest(null);
    showOriginConfirmation(message);
    router.refresh();
    if (historyEntryActive.current && window.history.state?.[MODAL_HISTORY_KEY]) {
      historyEntryActive.current = false;
      window.history.back();
    } else {
      window.sessionStorage.removeItem(TRANSIENT_MODAL_HISTORY_KEY);
    }
  }, [router]);

  return (
    <ReproductionModalContext.Provider value={{ openReproductionModal }}>
      {children}
      {request && (
        <ReproductionActionModal
          request={request}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </ReproductionModalContext.Provider>
  );
}

export function useReproductionModal() {
  const context = useContext(ReproductionModalContext);
  if (!context) throw new Error("useReproductionModal doit être utilisé dans ReproductionModalProvider");
  return context;
}
