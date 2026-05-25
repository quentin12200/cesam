export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getVaccinsManquants, formatAge, formatDateShort } from "@/lib/utils";
import Link from "next/link";
import CowIcon from "@/components/CowIcon";
import ChecklistSection, {
  type ChecklistItem,
  type SubItem,
} from "@/app/components/ChecklistSection";
import QuickSearch from "@/app/components/QuickSearch";
import {
  Baby,
  Wifi,
  AlertTriangle,
  Syringe,
  RefreshCw,
  Tag,
  Scissors,
  Activity,
  CalendarCheck,
  MilkOff,
} from "lucide-react";

async function getDashboardData() {
  const now = new Date();
  const sevenDaysLater = addDays(now, 7);
  const thirtyDaysLater = addDays(now, 30);
  const ninetyDaysLater = addDays(now, 90);
  const twentyOneDaysLater = addDays(now, 21);
  const sixMonthsAgo = addDays(now, -180);
  const fiveMonthsAgo = addDays(now, -150);

  const [
    vachesActives,
    veauxActifs,
    capteurs,
    vachesAvecSaillies,
    veauxPourVaccins,
    evenementsSanitairesUrgents,
    velagesSemaine,
    velagesPrevus,
    vaccinationPreVelage,
    // Checklist: veaux à boucler (with details)
    veauxABouclerList,
    // Checklist: veaux à sevrer ≥6 mois
    veauxASevrerList,
    // Collapsible: presque sevrables (5-6 mois)
    veauxPresqueSevrables,
    // Checklist: vaches à tarir (calving in 40-70 days)
    vachesATarirList,
    // Génisses primipares à rapatrier (calving in 30-90 days, jamais vêlé)
    genissesArapatrier,
    // Vaches avec vélage dans les 23 prochains jours (à poser capteur)
    vachesACapteur,
    // Composition
    nbVaches,
    nbGenissesBabies,
    nbGenissesMoyennes,
    nbGenissesGrandes,
    nbMales,
  ] = await Promise.all([
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", velageVeau: { is: null } } }),
    prisma.animal.count({ where: { statut: "ACTIF", OR: [{ sexbov: "M" }, { estGenisse: true }] } }),
    prisma.capteurVelage.findMany({ orderBy: { numero: "asc" } }),
    prisma.animal.findMany({
      where: { statut: "ACTIF", sexbov: "F", estGenisse: false },
      include: {
        saillies: {
          orderBy: { date: "desc" },
          take: 1,
          include: { gestation: true },
        },
        velagesVache: { orderBy: { date: "desc" }, take: 1 },
      },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: { vaccinations: { select: { vaccin: true, date: true } } },
    }),
    prisma.evenementSanitaire.count({ where: { resolu: false } }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: now, lte: sevenDaysLater },
      },
    }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: now, lte: thirtyDaysLater },
      },
    }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: twentyOneDaysLater, lte: ninetyDaysLater },
      },
    }),
    // Veaux à boucler avec infos mère
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        boucleFaite: false,
        velageVeau: { isNot: null },
      },
      select: {
        nutrav: true,
        nobovi: true,
        danais: true,
        velageVeau: {
          select: { vache: { select: { nutrav: true, nobovi: true } } },
        },
      },
      orderBy: { danais: "asc" },
    }),
    // Veaux à sevrer: ≥6 mois, pas encore sevrés
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sevreFait: false,
        velageVeau: { isNot: null },
        danais: { lte: sixMonthsAgo },
      },
      select: {
        nutrav: true,
        nobovi: true,
        danais: true,
        velageVeau: {
          select: { vache: { select: { nutrav: true, nobovi: true } } },
        },
      },
      orderBy: { danais: "asc" },
    }),
    // Presque sevrables: 5 à 6 mois
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sevreFait: false,
        velageVeau: { isNot: null },
        danais: { gte: sixMonthsAgo, lte: fiveMonthsAgo },
      },
      select: {
        nutrav: true,
        nobovi: true,
        danais: true,
        velageVeau: {
          select: { vache: { select: { nutrav: true, nobovi: true } } },
        },
      },
      orderBy: { danais: "asc" },
    }),
    // Vaches à tarir: vélage prévu dans 40-70 jours, pas encore tarées
    prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, 40), lte: addDays(now, 70) },
        saillie: {
          animal: { statut: "ACTIF", sexbov: "F", estGenisse: false, tarieFaite: false },
        },
      },
      select: {
        dateVelagePrevue: true,
        saillie: {
          select: {
            animal: { select: { nutrav: true, nobovi: true, danais: true } },
          },
        },
      },
      orderBy: { dateVelagePrevue: "asc" },
    }),
    // Génisses primipares à rapatrier (calving en 30-90j, aucun vélage antérieur)
    prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: addDays(now, 30), lte: ninetyDaysLater },
        saillie: {
          animal: { statut: "ACTIF", velagesVache: { none: {} } },
        },
      },
      select: {
        dateVelagePrevue: true,
        saillie: { select: { animal: { select: { nutrav: true, nobovi: true } } } },
      },
      orderBy: { dateVelagePrevue: "asc" },
    }),
    // Vaches avec vélage dans les 23 prochains jours (pose capteur)
    prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: now, lte: addDays(now, 23) },
      },
      select: {
        dateVelagePrevue: true,
        saillie: { select: { animal: { select: { nutrav: true, nobovi: true } } } },
      },
      orderBy: { dateVelagePrevue: "asc" },
    }),
    // Composition du troupeau
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: false } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -365) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -730), lt: addDays(now, -365) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: true, danais: { gte: addDays(now, -1095), lt: addDays(now, -730) } } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "M" } }),
  ]);

  let vachesPleine = 0;
  let aEchographier = 0;
  let vachesVidesEnRetard = 0;

  for (const vache of vachesAvecSaillies) {
    const derniereSaillie = vache.saillies[0]?.date ?? null;
    const gestation = vache.saillies[0]?.gestation ?? null;
    const dateVelagePrevue = gestation?.dateVelagePrevue ?? null;
    const etatGestation = gestation?.etat ?? null;
    const dernierVelage = vache.velagesVache[0]?.date ?? null;

    const etat = getEtatGestation(
      derniereSaillie,
      etatGestation,
      dateVelagePrevue,
      dernierVelage
    );

    if (etat === "VERT" || etat === "ROSE") vachesPleine++;
    if (etat === "JAUNE") aEchographier++;
    if (etat === "ROUGE") vachesVidesEnRetard++;
  }

  let veauxAVacciner = 0;
  for (const animal of veauxPourVaccins) {
    const ageJours = differenceInDays(now, animal.danais);
    if (ageJours <= 365 * 2) {
      const vaccinsManquants = getVaccinsManquants(
        animal.danais,
        animal.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date }))
      );
      if (vaccinsManquants.length > 0) veauxAVacciner++;
    }
  }

  const pctPleine =
    vachesActives > 0 ? Math.round((vachesPleine / vachesActives) * 100) : 0;

  // Build checklist items
  const bouclageItems: ChecklistItem[] = veauxABouclerList.map((a) => {
    const ageJours = differenceInDays(now, a.danais);
    const mere = a.velageVeau?.vache;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: `${ageJours} j`,
      extra: mere
        ? `Mère: ${mere.nutrav}${mere.nobovi ? " " + mere.nobovi : ""}`
        : undefined,
      isUrgent: ageJours >= 15,
      apiField: "boucleFaite",
    };
  });

  const sevrageItems: ChecklistItem[] = veauxASevrerList.map((a) => {
    const mere = a.velageVeau?.vache;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: formatAge(a.danais),
      extra: mere
        ? `Mère: ${mere.nutrav}${mere.nobovi ? " " + mere.nobovi : ""}`
        : undefined,
      apiField: "sevreFait",
    };
  });

  const presqueSevrables: SubItem[] = veauxPresqueSevrables.map((a) => {
    const mere = a.velageVeau?.vache;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: formatAge(a.danais),
      extra: mere
        ? `Mère: ${mere.nutrav}${mere.nobovi ? " " + mere.nobovi : ""}`
        : undefined,
    };
  });

  const tarirItems: ChecklistItem[] = vachesATarirList.map((g) => {
    const a = g.saillie.animal;
    const joursRestants = g.dateVelagePrevue
      ? differenceInDays(g.dateVelagePrevue, now)
      : null;
    return {
      nutrav: a.nutrav,
      nom: a.nobovi ?? null,
      ageLabel: formatAge(a.danais),
      extra: g.dateVelagePrevue
        ? `Vélage: ${formatDateShort(g.dateVelagePrevue)} (J-${joursRestants})`
        : undefined,
      apiField: "tarieFaite",
    };
  });

  return {
    vachesActives,
    veauxActifs,
    capteurs,
    vachesPleine,
    pctPleine,
    aEchographier,
    veauxAVacciner,
    velagesPrevus,
    velagesSemaine,
    vachesVidesEnRetard,
    evenementsSanitairesUrgents,
    vaccinationPreVelage,
    bouclageItems,
    sevrageItems,
    presqueSevrables,
    tarirItems,
    genissesArapatrier,
    vachesACapteur,
    nbVaches,
    nbGenissesBabies,
    nbGenissesMoyennes,
    nbGenissesGrandes,
    nbMales,
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();
  const capteursActifs = data.capteurs.filter((c) => c.actif);
  const capteursActifsNutravs = new Set(capteursActifs.map((c) => c.animalNutrav).filter(Boolean));

  // Cows within 23 days calving WITHOUT a sensor already assigned
  const vachesACapteurSansCapteur = data.vachesACapteur.filter(
    (g) => !capteursActifsNutravs.has(g.saillie.animal.nutrav)
  );

  const hasAlertesJour =
    data.vachesVidesEnRetard > 0 ||
    data.evenementsSanitairesUrgents > 0 ||
    data.bouclageItems.length > 0 ||
    data.vaccinationPreVelage > 0 ||
    data.aEchographier > 0 ||
    data.veauxAVacciner > 0 ||
    vachesACapteurSansCapteur.length > 0;

  const hasAlertesHebdo =
    data.velagesSemaine > 0 ||
    data.sevrageItems.length > 0 ||
    data.tarirItems.length > 0 ||
    data.genissesArapatrier.length > 0;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Recherche rapide */}
      <QuickSearch />
      <h2 className="text-xl font-bold text-gray-800 mt-2">Tableau de bord</h2>

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
          <div className="bg-green-100 rounded-full p-2">
            <CowIcon size={24} className="text-green-700" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{data.vachesActives}</div>
            <div className="text-xs text-gray-500">Vaches actives</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
          <div className="bg-blue-100 rounded-full p-2">
            <Baby size={24} className="text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{data.veauxActifs}</div>
            <div className="text-xs text-gray-500">Veaux & génisses</div>
          </div>
        </div>
      </div>

      {/* CE QUE JE DOIS FAIRE AUJOURD'HUI */}
      {hasAlertesJour && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Ce que je dois faire aujourd&apos;hui
          </h3>
          <div className="space-y-2">
            {data.vachesVidesEnRetard > 0 && (
              <Link
                href="/reproduction?filtre=ROUGE"
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Vaches vides en retard</span>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.vachesVidesEnRetard}
                </span>
              </Link>
            )}
            {data.evenementsSanitairesUrgents > 0 && (
              <Link
                href="/sanitaire"
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Interventions sanitaires urgentes</span>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.evenementsSanitairesUrgents}
                </span>
              </Link>
            )}
            {data.vaccinationPreVelage > 0 && (
              <Link
                href="/sanitaire"
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center gap-2">
                  <Syringe size={16} className="text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">
                    Vaccins pré-vélage (Crypto / Rotavec)
                  </span>
                </div>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.vaccinationPreVelage}
                </span>
              </Link>
            )}
            {data.aEchographier > 0 && (
              <Link
                href="/reproduction"
                className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Vaches à échographier</span>
                </div>
                <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
                  {data.aEchographier}
                </span>
              </Link>
            )}
            {data.veauxAVacciner > 0 && (
              <Link
                href="/sanitaire"
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <Syringe size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Veaux à vacciner</span>
                </div>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.veauxAVacciner}
                </span>
              </Link>
            )}
            {vachesACapteurSansCapteur.length > 0 && (
              <Link
                href="/velage"
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center gap-2">
                  <Wifi size={16} className="text-orange-600" />
                  <div>
                    <div className="text-sm font-medium text-orange-800">Poser capteur vélage</div>
                    <div className="text-xs text-orange-600 mt-0.5">
                      {vachesACapteurSansCapteur.map((g) =>
                        g.saillie.animal.nobovi ?? g.saillie.animal.nutrav
                      ).join(", ")}
                    </div>
                  </div>
                </div>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {vachesACapteurSansCapteur.length}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* CHECKLIST: Veaux à boucler */}
      <ChecklistSection
        title="Veaux à boucler"
        icon={<Tag size={18} />}
        items={data.bouclageItems}
        actionLabel="Bouclé"
        color="orange"
      />

      {/* Focus hebdomadaire J+7 */}
      {hasAlertesHebdo && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarCheck size={18} className="text-blue-500" />
            Cette semaine (J+7)
          </h3>
          <div className="space-y-2">
            {data.velagesSemaine > 0 && (
              <Link
                href="/velage"
                className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-200"
              >
                <div className="flex items-center gap-2">
                  <Baby size={16} className="text-pink-600" />
                  <span className="text-sm font-medium text-pink-800">Vélages prévus cette semaine</span>
                </div>
                <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.velagesSemaine}
                </span>
              </Link>
            )}
            {data.genissesArapatrier.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Génisses à rapatrier à la ferme</span>
                  </div>
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {data.genissesArapatrier.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {data.genissesArapatrier.map((g, i) => {
                    const jours = g.dateVelagePrevue
                      ? differenceInDays(g.dateVelagePrevue, new Date())
                      : null;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs text-amber-700">
                        <Link href={`/troupeau/${g.saillie.animal.nutrav}`} className="font-mono bg-white border border-amber-200 px-1.5 py-0.5 rounded">
                          {g.saillie.animal.nutrav}
                        </Link>
                        <span>{g.saillie.animal.nobovi ?? "1er vélage"}</span>
                        {jours !== null && (
                          <span className="font-semibold">J-{jours}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-600 mt-2 italic">⚠️ Primipare — surveillance renforcée requise</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHECKLIST: Veaux à sevrer */}
      <ChecklistSection
        title="Veaux à sevrer"
        icon={<Scissors size={18} />}
        items={data.sevrageItems}
        actionLabel="Sevré"
        color="green"
        subSection={
          data.presqueSevrables.length > 0
            ? { title: "Presque sevrables (5–6 mois)", items: data.presqueSevrables }
            : undefined
        }
      />

      {/* CHECKLIST: Vaches à tarir */}
      <ChecklistSection
        title="Vaches à tarir"
        icon={<MilkOff size={18} />}
        items={data.tarirItems}
        actionLabel="Tarie"
        color="blue"
      />

      {/* Stats rapides */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Stats rapides</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{data.pctPleine}%</div>
            <div className="text-xs text-gray-600 mt-1">Vaches pleines</div>
            <div className="text-xs text-gray-400">
              {data.vachesPleine} / {data.vachesActives}
            </div>
          </div>
          <div className="text-center p-3 bg-pink-50 rounded-lg">
            <div className="text-2xl font-bold text-pink-600">{data.velagesPrevus}</div>
            <div className="text-xs text-gray-600 mt-1">Vélages prévus</div>
            <div className="text-xs text-gray-400">30 prochains jours</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{data.aEchographier}</div>
            <div className="text-xs text-gray-600 mt-1">À échographier</div>
            <div className="text-xs text-gray-400">Saillies 35-45j</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.veauxAVacciner}</div>
            <div className="text-xs text-gray-600 mt-1">Vaccins en retard</div>
            <div className="text-xs text-gray-400">Protocoles</div>
          </div>
        </div>
      </div>

      {/* Composition du troupeau */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <CowIcon size={18} className="text-green-700" />
          Composition du troupeau
        </h3>
        <div className="space-y-1.5">
          {([
            { label: "Vaches", count: data.nbVaches, color: "bg-green-100 text-green-700", href: "/troupeau?lot=vaches" },
            { label: "Génisses < 1 an", count: data.nbGenissesBabies, color: "bg-sky-100 text-sky-700", href: "/troupeau?lot=babies" },
            { label: "Génisses 1–2 ans", count: data.nbGenissesMoyennes, color: "bg-indigo-100 text-indigo-700", href: "/troupeau?lot=moyennes" },
            { label: "Génisses 2–3 ans", count: data.nbGenissesGrandes, color: "bg-purple-100 text-purple-700", href: "/troupeau?lot=grandes" },
            { label: "Mâles", count: data.nbMales, color: "bg-gray-100 text-gray-600", href: "/troupeau?sexe=M" },
          ] as const).map(({ label, count, color, href }) => (
            <Link key={label} href={href} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="text-sm text-gray-700">{label}</span>
              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${color}`}>{count}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
          <span>Total actifs</span>
          <span className="font-semibold text-gray-700">
            {data.nbVaches + data.nbGenissesBabies + data.nbGenissesMoyennes + data.nbGenissesGrandes + data.nbMales}
          </span>
        </div>
      </div>

      {/* Capteurs */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Wifi size={18} className="text-green-700" />
          Capteurs vélage
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {data.capteurs.map((capteur) => (
            <div
              key={capteur.id}
              className={`p-3 rounded-lg border ${
                capteur.actif ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Capteur {capteur.numero}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    capteur.actif ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                  }`}
                >
                  {capteur.actif ? "ACTIF" : "LIBRE"}
                </span>
              </div>
              {capteur.actif && capteur.animalNom && (
                <div className="text-xs text-gray-600 mt-1">
                  {capteur.animalNom} - {capteur.animalNutrav}
                </div>
              )}
              {capteur.actif && capteur.dateAttribution && (
                <div className="text-xs text-gray-400">
                  Depuis le {new Date(capteur.dateAttribution).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          {capteursActifs.length} capteur{capteursActifs.length > 1 ? "s" : ""} actif
          {capteursActifs.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
