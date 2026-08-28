export interface ReproductionSummaryRow {
  lastCalvingDate: string | null;
  daysSinceLastCalving: number | null;
  lastEchoDate: string | null;
  lastEchoResult: string | null;
  lastAttemptDate: string | null;
  lastAttemptType: string | null;
  daysSinceLastAttempt: number | null;
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function attemptLabel(type: string | null): string {
  if (type === "IA") return "IA";
  if (type === "NATURELLE") return "Saillie";
  return "Tentative";
}

function echoLabel(result: string | null): string {
  if (result === "PLEINE") return "✓ Positive";
  if (result === "VIDE") return "❌ Négative";
  return "Résultat inconnu";
}

export default function ReproductionCycleSummary({
  summary,
  compact = false,
}: {
  summary: ReproductionSummaryRow;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="mt-1 w-full space-y-0.5 pl-0.5 text-[11px] leading-4 text-gray-600">
        <div>
          {summary.daysSinceLastCalving !== null
            ? `Vêlée il y a ${summary.daysSinceLastCalving} j`
            : "Dernier vêlage inconnu"}
        </div>
        <div>
          {summary.lastEchoDate
            ? `Écho ${summary.lastEchoResult === "PLEINE" ? "✓" : summary.lastEchoResult === "VIDE" ? "❌" : "?"} ${shortDate(summary.lastEchoDate)}`
            : summary.lastCalvingDate ? "Aucune écho depuis vêlage" : "Aucune écho enregistrée"}
        </div>
        {summary.lastAttemptDate && summary.daysSinceLastAttempt !== null && (
          <div>{attemptLabel(summary.lastAttemptType)} il y a {summary.daysSinceLastAttempt} j</div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5 min-w-[185px] space-y-1 text-[11px] leading-4 text-gray-600">
      <div>
        <span className="font-semibold text-gray-500">Vêlage</span>{" "}
        {summary.lastCalvingDate && summary.daysSinceLastCalving !== null
          ? <span className="text-gray-800">{shortDate(summary.lastCalvingDate)} · {summary.daysSinceLastCalving} j</span>
          : <span className="italic text-gray-400">inconnu</span>}
      </div>
      <div>
        <span className="font-semibold text-gray-500">Écho</span>{" "}
        {summary.lastEchoDate
          ? <span className="text-gray-800">{echoLabel(summary.lastEchoResult)} · {shortDate(summary.lastEchoDate)}</span>
          : <span className="text-gray-500">{summary.lastCalvingDate ? "Aucune écho depuis vêlage" : "Aucune écho enregistrée"}</span>}
      </div>
      <div>
        <span className="font-semibold text-gray-500">Dernière tentative</span>{" "}
        {summary.lastAttemptDate && summary.daysSinceLastAttempt !== null
          ? <span className="text-gray-800">{attemptLabel(summary.lastAttemptType)} {shortDate(summary.lastAttemptDate)} · {summary.daysSinceLastAttempt} j</span>
          : <span className="italic text-gray-400">aucune</span>}
      </div>
    </div>
  );
}
