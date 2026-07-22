import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEtatGestation, type EtatGestation } from "@/lib/utils";
import BackButton from "../BackButton";
import ReproductiveCycleTimeline from "../ReproductiveCycleTimeline";

interface PageProps {
  params: Promise<{ nutrav: string }>;
}

export default async function ReproductiveCyclePage({ params }: PageProps) {
  const { nutrav } = await params;
  const [animal, config] = await Promise.all([
    prisma.animal.findUnique({
      where: { nutrav },
      select: {
        nutrav: true,
        nobovi: true,
        sexbov: true,
        aEchographier: true,
        reproductionEtatManuel: true,
        reproductionEtatModifieAt: true,
        tarieFaite: true,
        dateTarie: true,
        saillies: {
          orderBy: { date: "desc" },
          take: 1,
          include: { gestation: true, taureau: true },
        },
        velagesVache: {
          orderBy: { date: "desc" },
          take: 1,
          include: {
            veau: { select: { nutrav: true, danais: true, sexbov: true, sevreFait: true } },
            veauxDetails: {
              include: {
                animal: { select: { nutrav: true, danais: true, sexbov: true, sevreFait: true } },
              },
            },
          },
        },
      },
    }),
    prisma.exploitationConfig.findUnique({
      where: { id: "singleton" },
      select: { reproReposObjectifJours: true, tarissementVeauAgeMois: true },
    }).catch(() => null),
  ]);

  if (!animal || animal.sexbov !== "F") notFound();

  const breeding = animal.saillies[0] ?? null;
  const calving = animal.velagesVache[0] ?? null;
  const status = (animal.reproductionEtatManuel as EtatGestation | null) ?? getEtatGestation(
    breeding?.date ?? null,
    breeding?.gestation?.etat ?? null,
    breeding?.gestation?.dateVelagePrevue ?? null,
    calving?.date ?? null,
    animal.aEchographier
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-slate-50 px-3 py-3 sm:px-5">
      <header className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <BackButton />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cycle reproductif</p>
          <h1 className="truncate text-lg font-extrabold text-slate-900">
            {animal.nutrav}{animal.nobovi ? ` · ${animal.nobovi}` : ""}
          </h1>
        </div>
      </header>

      <ReproductiveCycleTimeline
        status={status}
        breedingDate={breeding?.date ?? null}
        breedingType={breeding?.type ?? null}
        dueDate={breeding?.gestation?.dateVelagePrevue ?? null}
        echoDate={breeding?.gestation?.dateEcho ?? null}
        echoResult={breeding?.gestation?.resultatEcho ?? null}
        echoObservation={breeding?.gestation?.sousResultat ?? null}
        lastCalvingDate={calving?.date ?? null}
        calfNumber={calving?.veau?.nutrav ?? calving?.veauxDetails[0]?.animal?.nutrav ?? calving?.veauxDetails[0]?.nutrav ?? null}
        calfSex={calving?.veau?.sexbov ?? calving?.veauxDetails[0]?.animal?.sexbov ?? calving?.veauxDetails[0]?.sexe ?? null}
        calfBirthDate={calving?.veau?.danais ?? calving?.veauxDetails[0]?.animal?.danais ?? calving?.date ?? null}
        calfSevreDone={calving?.veau?.sevreFait ?? calving?.veauxDetails[0]?.animal?.sevreFait ?? false}
        breedingReference={breeding?.taureau?.nopere ?? breeding?.taureau?.nupere ?? null}
        statusModifiedAt={animal.reproductionEtatModifieAt ?? null}
        restObjectiveDays={config?.reproReposObjectifJours ?? 60}
        dryOffCalfAgeMonths={config?.tarissementVeauAgeMois ?? 6}
        dryOffDone={animal.tarieFaite}
        dryOffDate={animal.dateTarie ?? null}
      />
    </main>
  );
}
