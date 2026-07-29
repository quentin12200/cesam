import Link from "next/link";
import type { ReactNode } from "react";
import { Baby, HeartPulse, ScanSearch, Tags } from "lucide-react";

export type AccueilTodoGroup = {
  id: "identification" | "sante" | "reproduction" | "velages";
  title: string;
  total: number;
  summary: string;
  priority: "urgent" | "soon" | "normal";
  href: string;
};

const visuals = {
  identification: { icon: Tags, iconClass: "text-violet-600", accent: "border-l-violet-400" },
  sante: { icon: HeartPulse, iconClass: "text-blue-600", accent: "border-l-blue-500" },
  reproduction: { icon: ScanSearch, iconClass: "text-fuchsia-600", accent: "border-l-fuchsia-500" },
  velages: { icon: Baby, iconClass: "text-pink-600", accent: "border-l-pink-500" },
};

const priorityText = {
  urgent: "text-red-700",
  soon: "text-orange-700",
  normal: "text-gray-500",
};

export default function AccueilTodoSection({
  groups,
  weaningDryOff,
  weaningDryOffCount = 0,
}: {
  groups: AccueilTodoGroup[];
  weaningDryOff?: ReactNode;
  weaningDryOffCount?: number;
}) {
  const total =
    groups.reduce((sum, group) => sum + group.total, 0) +
    weaningDryOffCount;

  return (
    <section data-layout-section="accueil-a-faire" data-layout-label="À faire" className="rounded-xl bg-white p-3 shadow">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">À faire</h2>
        {total > 0 && <span className="text-xs font-semibold tabular-nums text-gray-500">{total}</span>}
      </div>

      {groups.length === 0 && !weaningDryOff ? (
        <p className="rounded-xl bg-green-50 px-4 py-4 text-center text-sm font-semibold text-green-800">
          Aucune intervention prioritaire
        </p>
      ) : (
        <div className="space-y-1.5">
          {groups.length > 0 && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {groups.map((group) => {
                const visual = visuals[group.id];
                const Icon = visual.icon;
                return (
                  <article key={group.id} className={`flex min-h-14 items-center gap-2 rounded-lg border-l-[3px] bg-gray-50 px-2.5 py-2 ${visual.accent}`}>
                    <Icon size={17} className={`shrink-0 ${visual.iconClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{group.title}</h3>
                        <span className="text-sm font-bold tabular-nums text-gray-900">{group.total}</span>
                      </div>
                      <p className={`line-clamp-1 text-[11px] font-medium ${priorityText[group.priority]}`}>
                        {group.summary}
                      </p>
                    </div>
                    <Link href={group.href} className="shrink-0 rounded-md bg-white px-2 py-1.5 text-[11px] font-semibold text-green-800 ring-1 ring-gray-200 hover:bg-green-50">
                      Voir
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
          {weaningDryOff}
        </div>
      )}
    </section>
  );
}
