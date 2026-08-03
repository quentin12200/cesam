import { CalendarDays } from "lucide-react";
import {
  formatGestationDuration,
  getBadgeClass,
  type EtatGestation,
} from "@/lib/utils";

interface ReproductionListBadgeProps {
  etat: EtatGestation;
  fallbackLabel: string;
  gestationDays?: number | null;
  prefix?: string;
  className?: string;
}

export default function ReproductionListBadge({
  etat,
  fallbackLabel,
  gestationDays,
  prefix = "",
  className = "",
}: ReproductionListBadgeProps) {
  const gestante = etat === "VERT";
  const label = gestante
    ? formatGestationDuration(gestationDays)
    : fallbackLabel;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
        gestante
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
          : getBadgeClass(etat)
      } ${className}`}
    >
      {gestante && <CalendarDays aria-hidden="true" size={12} strokeWidth={2.25} />}
      {prefix}{label}
    </span>
  );
}
