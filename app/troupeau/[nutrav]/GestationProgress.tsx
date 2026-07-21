import { formatGestationElapsed, getGestationProgress } from "@/lib/gestation-progress";

interface Props {
  startDate: Date | null;
  dueDate: Date | null;
}

export default function GestationProgress({ startDate, dueDate }: Props) {
  const progress = getGestationProgress(startDate, dueDate);

  if (!progress) {
    return (
      <span className="inline-flex rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
        Gestante
      </span>
    );
  }

  const elapsedLabel = formatGestationElapsed(progress.elapsedDays);
  const overdue = progress.remainingDays < 0;
  const showCountdown = progress.remainingDays >= 0 && progress.remainingDays <= 60;
  const overdueDays = Math.abs(progress.remainingDays);
  const statusLabel = overdue
    ? `Gestante · Terme dépassé de ${overdueDays} ${overdueDays === 1 ? "jour" : "jours"}`
    : `Gestante · ${elapsedLabel}`;
  const accessibleLabel = overdue
    ? `Gestante depuis ${elapsedLabel}, terme dépassé de ${overdueDays} ${overdueDays === 1 ? "jour" : "jours"}`
    : `Gestante depuis ${elapsedLabel}${showCountdown ? `, vêlage prévu dans ${progress.remainingDays} ${progress.remainingDays === 1 ? "jour" : "jours"}` : ""}`;

  return (
    <div className="mt-2 w-full max-w-xl" aria-label={accessibleLabel}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs font-semibold">
        <span className={overdue ? "text-red-700" : "text-green-800"}>{statusLabel}</span>
        {showCountdown && (
          <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 font-bold text-pink-700">
            J-{progress.remainingDays}
          </span>
        )}
      </div>
      <div
        className={`h-2.5 overflow-hidden rounded-full ${overdue ? "bg-red-100" : "bg-green-100"}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.percentage)}
      >
        <div
          className={`h-full rounded-full transition-[width] ${overdue ? "bg-red-500" : showCountdown ? "bg-pink-400" : "bg-green-500"}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  );
}
