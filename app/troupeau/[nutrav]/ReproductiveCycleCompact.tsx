import Link from "next/link";
import { addDays, differenceInCalendarDays } from "date-fns";
import { ArrowRight, CircleAlert } from "lucide-react";
import {
  ECHOGRAPHY_WAIT_DAYS,
  REPRODUCTIVE_CYCLE_COLORS,
  VELAGE_IMMINENT_DAYS,
  type EtatGestation,
} from "@/lib/utils";
import {
  GESTATION_REFERENCE_DAYS,
  formatGestationElapsed,
  getGestationProgress,
} from "@/lib/gestation-progress";
import EchoButton from "./EchoButton";

interface Props {
  status: EtatGestation | null;
  animalId: string;
  nutrav: string;
  breedingDate: Date | null;
  breedingType: string | null;
  breedingId: string | null;
  dueDate: Date | null;
  lastCalvingDate: Date | null;
  restObjectiveDays: number;
  aEchographier: boolean;
}

const COLORS = REPRODUCTIVE_CYCLE_COLORS;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, differenceInCalendarDays(to, from));
}

export default function ReproductiveCycleCompact({
  status,
  animalId,
  nutrav,
  breedingDate,
  breedingType,
  breedingId,
  dueDate,
  lastCalvingDate,
  restObjectiveDays,
  aEchographier,
}: Props) {
  const today = new Date();
  const gestation = status === "VERT" || status === "ROSE"
    ? getGestationProgress(breedingDate, dueDate, today)
    : null;
  const projectedDueDate = dueDate ?? (breedingDate ? addDays(breedingDate, GESTATION_REFERENCE_DAYS) : null);
  const expectedEchoDate = breedingDate ? addDays(breedingDate, ECHOGRAPHY_WAIT_DAYS) : null;
  const daysSinceBreeding = breedingDate ? daysBetween(breedingDate, today) : 0;
  const daysSinceCalving = lastCalvingDate ? daysBetween(lastCalvingDate, today) : 0;
  const delayDays = Math.max(0, daysSinceCalving - restObjectiveDays);

  const view = (() => {
    if (status === "VERT" && gestation && projectedDueDate) {
      const preparationIn = Math.max(0, gestation.remainingDays - VELAGE_IMMINENT_DAYS);
      return {
        label: "Gestante",
        main: formatGestationElapsed(gestation.elapsedDays),
        detail: `Vêlage prévu le ${formatDate(projectedDueDate)}`,
        next: preparationIn > 0 ? `Préparation au vêlage dans ${preparationIn} jours` : "Préparation au vêlage",
        color: COLORS.pregnant,
        position: 72,
      };
    }
    if (status === "ROSE" && gestation && projectedDueDate) {
      const overdue = gestation.remainingDays < 0;
      return {
        label: overdue ? "Terme dépassé" : "Vêlage imminent",
        main: overdue ? `+${Math.abs(gestation.remainingDays)} jours` : `J-${gestation.remainingDays}`,
        detail: `Vêlage prévu le ${formatDate(projectedDueDate)}`,
        next: overdue ? "Enregistrer le vêlage" : "Préparer le vêlage",
        color: overdue ? COLORS.delay : COLORS.imminent,
        position: 94,
      };
    }
    if (status === "JAUNE") {
      const waitingDays = expectedEchoDate ? daysBetween(expectedEchoDate, today) : daysSinceBreeding;
      return {
        label: "À échographier",
        main: `Depuis ${waitingDays} jours`,
        detail: breedingDate ? `${breedingType === "IA" ? "IA" : "Saillie"} le ${formatDate(breedingDate)}` : "Saillie à renseigner",
        next: "Échographie à réaliser",
        color: COLORS.scan,
        position: 48,
      };
    }
    if (status === "GRIS") {
      return {
        label: "En attente",
        main: `Depuis ${daysSinceBreeding} jours`,
        detail: breedingDate ? `${breedingType === "IA" ? "IA" : "Saillie"} le ${formatDate(breedingDate)}` : "Reproduction enregistrée",
        next: expectedEchoDate ? `Échographie à partir du ${formatDate(expectedEchoDate)}` : "Voir le suivi",
        color: COLORS.waiting,
        position: 40,
      };
    }
    if (status === "REPOS") {
      return {
        label: "Repos",
        main: `${daysSinceCalving} jours`,
        detail: `Objectif : ${restObjectiveDays} jours`,
        next: "Aucune action urgente",
        color: COLORS.rest,
        position: 12,
      };
    }
    if (status === "ROUGE") {
      return {
        label: delayDays > 0 ? "Retard repro" : "À remettre",
        main: delayDays > 0 ? `+${delayDays} jours` : "Disponible",
        detail: "Remise à la reproduction nécessaire",
        next: "Enregistrer saillie / IA",
        color: COLORS.delay,
        position: 28,
      };
    }
    return {
      label: "À renseigner",
      main: "Cycle incomplet",
      detail: "Aucune situation reproductive connue",
      next: "Voir le suivi",
      color: COLORS.waiting,
      position: 4,
    };
  })();

  const cycleHref = `/troupeau/${encodeURIComponent(nutrav)}/cycle`;
  const action = (() => {
    if (status === "JAUNE" && breedingId && breedingDate) {
      return (
        <EchoButton
          nutrav={nutrav}
          aEchographier={status === "JAUNE" || aEchographier}
          saillieId={breedingId}
          saillieDate={breedingDate.toISOString()}
          prominent
        />
      );
    }
    if (status === "ROUGE") {
      return <Link href={`/reproduction?action=saillie&animaux=${encodeURIComponent(animalId)}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-fuchsia-600 px-3 py-2 text-center text-sm font-bold text-white">Enregistrer saillie / IA</Link>;
    }
    if (status === "GRIS") {
      return <Link href={`/troupeau/${encodeURIComponent(nutrav)}?onglet=reproduction`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-700 px-3 py-2 text-center text-sm font-bold text-white">Voir le suivi</Link>;
    }
    if (status === "ROSE") {
      const label = gestation && gestation.remainingDays < 0 ? "Enregistrer le vêlage" : "Préparer le vêlage";
      return <Link href={`/velage?nouveau=1&mere=${encodeURIComponent(nutrav)}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-orange-600 px-3 py-2 text-center text-sm font-bold text-white">{label}</Link>;
    }
    return null;
  })();

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label={`Reproduction : ${view.label}`}>
      <div className="h-1.5" style={{ backgroundColor: view.color }} />
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900">Reproduction</h3>
          <span className="max-w-[55%] truncate rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ color: view.color, backgroundColor: `${view.color}18` }}>
            {view.label}
          </span>
        </div>

        <p className="mt-2 text-xl font-black leading-none text-slate-950">{view.main}</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">{view.detail}</p>

        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Position dans le cycle reproductif">
          <div className="absolute inset-y-0 left-0 w-[18%]" style={{ backgroundColor: COLORS.rest }} />
          <div className="absolute inset-y-0 left-[18%] w-[14%]" style={{ backgroundColor: COLORS.delay }} />
          <div className="absolute inset-y-0 left-[32%] w-[20%]" style={{ backgroundColor: COLORS.waiting }} />
          <div className="absolute inset-y-0 left-[52%] w-[35%]" style={{ backgroundColor: COLORS.pregnant }} />
          <div className="absolute inset-y-0 right-0 w-[13%]" style={{ backgroundColor: COLORS.imminent }} />
          <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow" style={{ left: `${view.position}%`, backgroundColor: view.color }} />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <CircleAlert size={18} className="mt-0.5 shrink-0" style={{ color: view.color }} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{status === "REPOS" ? "Situation" : "Prochaine étape"}</p>
            <p className="text-sm font-bold leading-snug text-slate-800">{view.next}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {action}
          <Link href={cycleHref} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-extrabold" style={{ borderColor: view.color, color: view.color }}>
            Voir le cycle
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
