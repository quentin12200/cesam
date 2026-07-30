"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  MilkOff,
  RotateCcw,
  Scissors,
  X,
} from "lucide-react";
import { formatAge } from "@/lib/utils";
import type {
  WeaningDryOffAction,
  WeaningDryOffCandidate,
} from "@/lib/weaning-dry-off";

const SWIPE_THRESHOLD = 72;
const MAX_SWIPE = 112;
const REVERSIBLE_DURATION_MS = 12 * 60 * 60 * 1000;

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
  busy,
  error,
  onQuickAction,
  onManualDryOff,
}: {
  candidate: WeaningDryOffCandidate;
  thresholdMonths: number;
  soon: boolean;
  busy: boolean;
  error: string;
  onQuickAction: (
    candidate: WeaningDryOffCandidate,
    action: WeaningDryOffAction
  ) => void;
  onManualDryOff: (candidate: WeaningDryOffCandidate) => void;
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const currentOffset = useRef(0);
  const horizontalSwipe = useRef(false);
  const quickAction: WeaningDryOffAction = candidate.recentlyWeaned
    ? "UNDO_WEANING"
    : candidate.willAutoDryOff
      ? "COMBINED"
      : "WEAN_ONLY";
  const showLastCalfMessage =
    candidate.willAutoDryOff &&
    candidate.cycleCalfCount > 1 &&
    candidate.cycleWeanedCount > 0 &&
    candidate.cyclePendingCount === 1;

  function updateOffset(value: number) {
    currentOffset.current = value;
    setSwipeOffset(value);
  }

  function onTouchStart(event: React.TouchEvent) {
    if (busy) return;
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    horizontalSwipe.current = false;
    setSwiping(true);
  }

  function onTouchMove(event: React.TouchEvent) {
    if (busy) return;
    const dx = event.touches[0].clientX - touchStartX.current;
    const dy = event.touches[0].clientY - touchStartY.current;
    if (!horizontalSwipe.current && Math.abs(dx) > Math.abs(dy) + 6) {
      horizontalSwipe.current = true;
    }
    if (!horizontalSwipe.current) return;

    const directionalOffset = candidate.recentlyWeaned
      ? Math.max(0, Math.min(MAX_SWIPE, dx))
      : Math.min(0, Math.max(-MAX_SWIPE, dx));
    updateOffset(directionalOffset);
  }

  function onTouchEnd() {
    setSwiping(false);
    if (!horizontalSwipe.current || busy) {
      updateOffset(0);
      return;
    }
    const completed = candidate.recentlyWeaned
      ? currentOffset.current >= SWIPE_THRESHOLD
      : currentOffset.current <= -SWIPE_THRESHOLD;
    updateOffset(0);
    if (completed) onQuickAction(candidate, quickAction);
  }

  const statusText = candidate.recentlyWeaned
    ? candidate.automaticDryOffAtWeaning
      ? "Sevré — mère également tarie"
      : "Sevré aujourd’hui"
    : showLastCalfMessage
      ? "Dernier veau à sevrer : la mère sera automatiquement tarie."
      : soon
        ? "Sevrage anticipé possible"
        : `Seuil de ${thresholdMonths} mois atteint`;

  return (
    <article
      className={`relative overflow-hidden rounded-lg border ${
        candidate.recentlyWeaned
          ? "border-slate-200 bg-slate-100"
          : "border-slate-200 bg-white"
      }`}
      data-swipe-direction={candidate.recentlyWeaned ? "right" : "left"}
    >
      <div
        className={`absolute inset-0 flex items-center px-4 text-xs font-bold text-white md:hidden ${
          candidate.recentlyWeaned
            ? "justify-start bg-amber-600"
            : "justify-end bg-green-700"
        }`}
      >
        {candidate.recentlyWeaned ? (
          <span className="flex items-center gap-1.5">
            <RotateCcw size={16} /> Annuler
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Scissors size={16} /> Sevrer
          </span>
        )}
      </div>

      <div
        className={`relative flex touch-pan-y select-none flex-col gap-2 p-3 sm:flex-row sm:items-start ${
          candidate.recentlyWeaned ? "bg-slate-100" : "bg-white"
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swiping ? "none" : "transform 0.2s ease",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          setSwiping(false);
          updateOffset(0);
        }}
      >
        <div className="min-w-0 flex-1">
          <Link
            href={`/troupeau/${candidate.calf.nutrav}`}
            className={`text-sm font-extrabold hover:underline ${
              candidate.recentlyWeaned ? "text-slate-700" : "text-green-800"
            }`}
          >
            {animalLabel(candidate.calf)}
          </Link>
          <p className="text-xs text-slate-600">
            {formatAge(new Date(candidate.calf.birthDate))}
            <span className="mx-1 text-slate-300">·</span>
            Mère :{" "}
            <Link
              href={`/troupeau/${candidate.mother.nutrav}`}
              className="font-semibold text-amber-800 hover:underline"
            >
              {animalLabel(candidate.mother)}
            </Link>
          </p>
          {candidate.cycleCalfCount > 1 && (
            <p className="mt-1 text-[11px] font-semibold text-slate-600">
              {candidate.cycleWeanedCount} veau
              {candidate.cycleWeanedCount > 1 ? "x" : ""} sur{" "}
              {candidate.cycleCalfCount} sevré
              {candidate.cycleWeanedCount > 1 ? "s" : ""}
            </p>
          )}
          <p
            className={`mt-1 text-[11px] font-semibold ${
              candidate.recentlyWeaned
                ? "text-slate-700"
                : showLastCalfMessage
                  ? "text-blue-700"
                  : soon
                    ? "text-slate-500"
                    : "text-orange-700"
            }`}
          >
            {statusText}
          </p>
          <p className="mt-1 text-[10px] font-medium text-slate-400 md:hidden">
            {candidate.recentlyWeaned
              ? "Glisser à droite pour annuler"
              : "Glisser à gauche pour sevrer"}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-[11px] font-semibold text-red-700">
              {error}
            </p>
          )}
          {!candidate.recentlyWeaned && candidate.needsDryOff && (
            <details className="mt-1 w-fit text-[11px] text-slate-500">
              <summary
                className="cursor-pointer list-none rounded px-1 font-bold tracking-widest hover:bg-slate-100"
                aria-label="Autres actions"
                title="Autres actions"
              >
                ···
              </summary>
              <button
                type="button"
                onClick={() => onManualDryOff(candidate)}
                disabled={busy}
                className="mt-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 font-semibold tracking-normal text-blue-800 disabled:opacity-50"
              >
                Tarir la mère séparément
              </button>
            </details>
          )}
        </div>

        <div className="hidden shrink-0 flex-wrap gap-1.5 md:flex">
          <button
            type="button"
            onClick={() => onQuickAction(candidate, quickAction)}
            disabled={busy}
            className={`min-h-9 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50 ${
              candidate.recentlyWeaned
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-700 hover:bg-green-800"
            }`}
          >
            {busy
              ? "…"
              : candidate.recentlyWeaned
                ? "Annuler"
                : "Sevrer"}
          </button>
        </div>
      </div>
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
  const [manualSelection, setManualSelection] =
    useState<WeaningDryOffCandidate | null>(null);
  const [manualDate, setManualDate] = useState(localDateValue);
  const [busyCalfId, setBusyCalfId] = useState("");
  const [error, setError] = useState<{ calfId: string; message: string } | null>(
    null
  );

  useEffect(() => setCandidates(initialCandidates), [initialCandidates]);

  useEffect(() => {
    const removeExpired = () => {
      const now = Date.now();
      setCandidates((current) =>
        current.filter(
          (candidate) =>
            !candidate.recentlyWeaned ||
            (candidate.reversibleUntil
              ? new Date(candidate.reversibleUntil).getTime() > now
              : false)
        )
      );
    };
    const timer = window.setInterval(removeExpired, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nowCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.window === "NOW"),
    [candidates]
  );
  const soonCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.window === "SOON"),
    [candidates]
  );
  const activeNowCount = nowCandidates.filter(
    (candidate) => !candidate.recentlyWeaned
  ).length;

  async function performAction(
    candidate: WeaningDryOffCandidate,
    action: WeaningDryOffAction,
    date?: string
  ) {
    if (busyCalfId) return false;
    setBusyCalfId(candidate.calf.id);
    setError(null);
    try {
      const response = await fetch("/api/sevrage-tarissement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calfId: candidate.calf.id,
          action,
          ...(action === "UNDO_WEANING"
            ? {}
            : { date: date ?? new Date().toISOString() }),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Enregistrement impossible.");
      }

      const motherDriedOff = Boolean(result.mother?.tarieFaite);
      const progress = result.cycleProgress ?? {};
      setCandidates((current) =>
        current.map((currentCandidate) => {
          if (currentCandidate.cycleId !== candidate.cycleId) {
            return currentCandidate;
          }

          const isTarget = currentCandidate.calf.id === candidate.calf.id;
          const undone = Boolean(result.undone && isTarget);
          const newlyWeaned = Boolean(
            !result.undone && isTarget && result.calf?.sevreFait
          );
          const pending = Number(
            progress.pending ?? currentCandidate.cyclePendingCount
          );
          const weaningDate = newlyWeaned
            ? String(result.calf.dateSevrage)
            : undone
              ? null
              : currentCandidate.calf.weaningDate;

          return {
            ...currentCandidate,
            calf: {
              ...currentCandidate.calf,
              weaned: newlyWeaned
                ? true
                : undone
                  ? false
                  : currentCandidate.calf.weaned,
              weaningDate,
            },
            cycleCalfCount: Number(
              progress.total ?? currentCandidate.cycleCalfCount
            ),
            cycleWeanedCount: Number(
              progress.weaned ?? currentCandidate.cycleWeanedCount
            ),
            cyclePendingCount: pending,
            recentlyWeaned: newlyWeaned
              ? true
              : undone
                ? false
                : currentCandidate.recentlyWeaned,
            reversibleUntil: newlyWeaned
              ? new Date(
                  new Date(String(result.calf.dateSevrage)).getTime() +
                    REVERSIBLE_DURATION_MS
                ).toISOString()
              : undone
                ? null
                : currentCandidate.reversibleUntil,
            automaticDryOffAtWeaning: newlyWeaned
              ? Boolean(result.automaticDryOff)
              : undone
                ? false
                : currentCandidate.automaticDryOffAtWeaning,
            needsWeaning: newlyWeaned
              ? false
              : undone
                ? true
                : currentCandidate.needsWeaning,
            willAutoDryOff:
              !motherDriedOff &&
              pending === 1 &&
              !(newlyWeaned && isTarget),
            needsDryOff: !motherDriedOff,
            mother: {
              ...currentCandidate.mother,
              driedOff: motherDriedOff,
              dryOffDate:
                result.mother?.dateTarie ??
                currentCandidate.mother.dryOffDate,
            },
          };
        })
      );
      router.refresh();
      return true;
    } catch (caught) {
      setError({
        calfId: candidate.calf.id,
        message:
          caught instanceof Error
            ? caught.message
            : "Enregistrement impossible.",
      });
      return false;
    } finally {
      setBusyCalfId("");
    }
  }

  function openManualDryOff(candidate: WeaningDryOffCandidate) {
    setManualDate(localDateValue());
    setError(null);
    setManualSelection(candidate);
  }

  async function submitManualDryOff() {
    if (!manualSelection) return;
    const saved = await performAction(
      manualSelection,
      "DRY_OFF_ONLY",
      manualDate
    );
    if (saved) setManualSelection(null);
  }

  if (candidates.length === 0) return null;

  return (
    <div
      className={
        compact
          ? "rounded-lg border-l-[3px] border-l-cyan-500 bg-cyan-50/50 p-2.5"
          : "space-y-4"
      }
    >
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
              {activeNowCount} à faire maintenant
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
            <MilkOff size={15} className="text-blue-700" />À faire maintenant
          </h2>
          {nowCandidates.map((candidate) => (
            <CandidateLine
              key={candidate.calf.id}
              candidate={candidate}
              thresholdMonths={thresholdMonths}
              soon={false}
              busy={busyCalfId === candidate.calf.id}
              error={
                error?.calfId === candidate.calf.id ? error.message : ""
              }
              onQuickAction={(selected, action) =>
                void performAction(selected, action)
              }
              onManualDryOff={openManualDryOff}
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
                busy={busyCalfId === candidate.calf.id}
                error={
                  error?.calfId === candidate.calf.id ? error.message : ""
                }
                onQuickAction={(selected, action) =>
                  void performAction(selected, action)
                }
                onManualDryOff={openManualDryOff}
              />
            ))}
          </div>
        </details>
      )}

      {manualSelection && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-dry-off-title"
            className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="manual-dry-off-title"
                  className="font-extrabold text-slate-900"
                >
                  Tarir uniquement la mère
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Veau : {animalLabel(manualSelection.calf)}
                </p>
                <p className="text-xs text-slate-500">
                  Mère : {animalLabel(manualSelection.mother)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualSelection(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              Seul le tarissement de la mère sera enregistré. Les veaux
              conserveront leur état de sevrage actuel.
            </p>
            <label className="mt-3 block text-xs font-bold text-slate-700">
              Date réalisée
              <input
                type="date"
                value={manualDate}
                max={localDateValue()}
                onChange={(event) => setManualDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setManualSelection(null)}
                disabled={Boolean(busyCalfId)}
                className="min-h-11 flex-1 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submitManualDryOff()}
                disabled={Boolean(busyCalfId) || !manualDate}
                className="min-h-11 flex-1 rounded-lg bg-blue-700 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyCalfId ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
