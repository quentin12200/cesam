"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MilkOff, Scissors, X } from "lucide-react";
import { formatAge } from "@/lib/utils";
import {
  applySuccessfulWeaningDryOffAction,
  type WeaningDryOffAction,
  type WeaningDryOffCandidate,
} from "@/lib/weaning-dry-off";

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function animalLabel(animal: { nutrav: string; nobovi: string | null }) {
  return `${animal.nutrav}${animal.nobovi ? ` — ${animal.nobovi}` : ""}`;
}

function CandidateLine({
  candidate,
  thresholdMonths,
  soon,
  onAction,
}: {
  candidate: WeaningDryOffCandidate;
  thresholdMonths: number;
  soon: boolean;
  onAction: (
    candidate: WeaningDryOffCandidate,
    action: WeaningDryOffAction
  ) => void;
}) {
  const [separate, setSeparate] = useState(false);
  const primaryLabel =
    candidate.needsWeaning && candidate.needsDryOff
      ? soon
        ? "Enregistrer maintenant"
        : "Sevrer / tarir"
      : candidate.needsWeaning
        ? "Sevrer le veau"
        : "Tarir la mère";
  const primaryAction: WeaningDryOffAction =
    candidate.needsWeaning && candidate.needsDryOff
      ? "COMBINED"
      : candidate.needsWeaning
        ? "WEAN_ONLY"
        : "DRY_OFF_ONLY";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Link
            href={`/troupeau/${candidate.calf.nutrav}`}
            className="text-sm font-extrabold text-green-800 hover:underline"
          >
            {animalLabel(candidate.calf)}
          </Link>
          <p className="text-xs text-slate-600">
            {formatAge(new Date(candidate.calf.birthDate))}
            <span className="mx-1 text-slate-300">·</span>
            Mère :{" "}
            {candidate.mother ? (
              <Link
                href={`/troupeau/${candidate.mother.nutrav}`}
                className="font-semibold text-amber-800 hover:underline"
              >
                {animalLabel(candidate.mother)}
              </Link>
            ) : (
              <span className="font-semibold text-red-700">non reliée</span>
            )}
          </p>
          <p
            className={`mt-1 text-[11px] font-semibold ${
              soon ? "text-slate-500" : "text-orange-700"
            }`}
          >
            {soon
              ? "Sevrage anticipé possible"
              : `Seuil de ${thresholdMonths} mois atteint`}
          </p>
          {(!candidate.needsWeaning || !candidate.needsDryOff) && (
            <p className="mt-1 text-[11px] font-semibold text-blue-700">
              {candidate.needsWeaning
                ? "La mère est déjà tarie : seul le sevrage reste à enregistrer."
                : "Le veau est déjà sevré : seul le tarissement reste à enregistrer."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onAction(candidate, primaryAction)}
            disabled={!candidate.needsWeaning && !candidate.needsDryOff}
            className="min-h-9 rounded-lg bg-green-700 px-3 text-xs font-bold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {primaryLabel}
          </button>
          {candidate.mother && candidate.needsWeaning && candidate.needsDryOff && (
            <button
              type="button"
              onClick={() => setSeparate((value) => !value)}
              className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Gérer séparément
            </button>
          )}
        </div>
      </div>
      {separate && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
          {candidate.needsWeaning && (
            <button
              type="button"
              onClick={() => onAction(candidate, "WEAN_ONLY")}
              className="rounded-lg bg-orange-50 px-2.5 py-2 text-xs font-bold text-orange-800 ring-1 ring-orange-200"
            >
              Sevrer uniquement le veau
            </button>
          )}
          {candidate.needsDryOff && (
            <button
              type="button"
              onClick={() => onAction(candidate, "DRY_OFF_ONLY")}
              className="rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-800 ring-1 ring-blue-200"
            >
              Tarir uniquement la mère
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function WeaningDryOffPanel({
  initialCandidates,
  thresholdMonths,
  compact = false,
}: {
  initialCandidates: WeaningDryOffCandidate[];
  thresholdMonths: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [selection, setSelection] = useState<{
    candidate: WeaningDryOffCandidate;
    action: WeaningDryOffAction;
  } | null>(null);
  const [date, setDate] = useState(localDateValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCandidates(initialCandidates), [initialCandidates]);

  const nowCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.window === "NOW"),
    [candidates]
  );
  const soonCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.window === "SOON"),
    [candidates]
  );

  function openAction(
    candidate: WeaningDryOffCandidate,
    action: WeaningDryOffAction
  ) {
    setDate(localDateValue());
    setError("");
    setSelection({ candidate, action });
  }

  async function submit() {
    if (!selection) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/sevrage-tarissement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calfId: selection.candidate.calf.id,
          action: selection.action,
          date,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Enregistrement impossible.");
      }

      setCandidates((current) =>
        current.flatMap((candidate) => {
          if (candidate.calf.id !== selection.candidate.calf.id) {
            return [candidate];
          }
          const updated = applySuccessfulWeaningDryOffAction(
            candidate,
            selection.action,
            date
          );
          return updated ? [updated] : [];
        })
      );
      setSelection(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <div className={compact ? "rounded-lg border-l-[3px] border-l-cyan-500 bg-cyan-50/50 p-2.5" : "space-y-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-cyan-100 p-1.5 text-cyan-800">
            <Scissors size={16} />
          </span>
          <div>
            <Link
              href="/troupeau/sevrage"
              className="text-sm font-extrabold text-slate-900 hover:text-green-800 hover:underline"
            >
              Sevrage et tarissement
            </Link>
            <p className="text-[11px] text-slate-500">
              {nowCandidates.length} à faire maintenant
            </p>
          </div>
        </div>
        <Link
          href="/troupeau/sevrage"
          className="shrink-0 text-[11px] font-bold text-green-800 hover:underline"
        >
          Voir tous les sevrages
        </Link>
      </div>

      {nowCandidates.length > 0 && (
        <div className="mt-2 space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
            <MilkOff size={15} className="text-blue-700" />
            À faire maintenant
          </h2>
          {nowCandidates.map((candidate) => (
            <CandidateLine
              key={candidate.calf.id}
              candidate={candidate}
              thresholdMonths={thresholdMonths}
              soon={false}
              onAction={openAction}
            />
          ))}
        </div>
      )}

      {soonCandidates.length > 0 && (
        <details className="group mt-2 rounded-lg border border-slate-200 bg-white">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-xs font-bold text-slate-700">
            Bientôt à prévoir — {soonCandidates.length} veau
            {soonCandidates.length > 1 ? "x" : ""}
            <ChevronDown
              size={15}
              className="text-slate-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="space-y-2 border-t border-slate-100 p-2">
            {soonCandidates.map((candidate) => (
              <CandidateLine
                key={candidate.calf.id}
                candidate={candidate}
                thresholdMonths={thresholdMonths}
                soon
                onAction={openAction}
              />
            ))}
          </div>
        </details>
      )}

      {selection && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="weaning-action-title"
            className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="weaning-action-title" className="font-extrabold text-slate-900">
                  {selection.action === "WEAN_ONLY"
                    ? "Sevrer uniquement le veau"
                    : selection.action === "DRY_OFF_ONLY"
                      ? "Tarir uniquement la mère"
                      : "Sevrer le veau et tarir la mère"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Veau : {animalLabel(selection.candidate.calf)}
                </p>
                <p className="text-xs text-slate-500">
                  Mère :{" "}
                  {selection.candidate.mother
                    ? animalLabel(selection.candidate.mother)
                    : "non reliée"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 rounded-lg bg-cyan-50 p-3 text-xs leading-5 text-cyan-900">
              {selection.action === "COMBINED"
                ? "Le sevrage du veau et le tarissement de la mère seront enregistrés à cette date."
                : selection.action === "WEAN_ONLY"
                  ? "Seul le sevrage du veau sera enregistré à cette date."
                  : "Seul le tarissement de la mère sera enregistré à cette date."}
            </p>

            <label className="mt-3 block text-xs font-bold text-slate-700">
              Date réalisée
              <input
                type="date"
                value={date}
                max={localDateValue()}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>

            {error && (
              <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelection(null)}
                disabled={saving}
                className="min-h-11 flex-1 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving || !date}
                className="min-h-11 flex-1 rounded-lg bg-green-700 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
