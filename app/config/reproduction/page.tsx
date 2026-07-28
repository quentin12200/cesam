export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { parseReproductionRules } from "@/lib/reproduction-rules";
import BackButton from "@/app/components/BackButton";
import PostCalvingSettingsForm from "./PostCalvingSettingsForm";
import ReproductionRulesForm from "./ReproductionRulesForm";

export default async function ReproductionRulesPage() {
  const stored = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: {
      reproductionRulesJson: true,
      reproReposObjectifJours: true,
      tarissementVeauAgeMois: true,
    },
  }).catch(() => null);

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-slate-50 px-3 py-4 sm:px-5">
      <header className="mb-4 flex items-center gap-3">
        <BackButton className="rounded-lg bg-white p-2 text-slate-500 shadow-sm" iconSize={18} />
        <div><p className="text-xs font-bold text-green-700">Paramètres · Reproduction</p><h1 className="text-xl font-black text-slate-900">Reproduction</h1></div>
      </header>
      <div className="space-y-5">
        <PostCalvingSettingsForm
          initial={{
            reproReposObjectifJours: stored?.reproReposObjectifJours ?? 60,
            tarissementVeauAgeMois: stored?.tarissementVeauAgeMois ?? 6,
          }}
        />
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Règles du cycle</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Phases, alertes et événements du suivi reproductif.
            </p>
          </div>
          <ReproductionRulesForm initial={parseReproductionRules(stored?.reproductionRulesJson)} />
        </section>
      </div>
    </main>
  );
}
