export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getVaccinsManquants, formatDate, formatAge, DEFAULT_PROTOCOLES, type ProtocoleVaccinConfig } from "@/lib/utils";
import { differenceInDays, subDays } from "date-fns";
import Link from "next/link";
import { ArrowLeft, Settings, Printer } from "lucide-react";
import SanitaireClient, {
  type VeauItem,
  type CryptoItem,
  type BolusItem,
  type RecentItem,
  type VeauProtocolItem,
} from "./SanitaireClient";

async function getProtocoles(): Promise<ProtocoleVaccinConfig[]> {
  try {
    const rows = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
    if (rows.length > 0) return rows;
  } catch {
    // table may not exist yet during first deploy
  }
  return DEFAULT_PROTOCOLES;
}

async function getSanitaireData(protocoles: ProtocoleVaccinConfig[]) {
  const now = new Date();

  const [animaux, vaccinationsRecentes, vachesAvecGestation] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: { vaccinations: { select: { id: true, vaccin: true, date: true } } },
      orderBy: { danais: "asc" },
    }),
    prisma.vaccination.findMany({
      where: { date: { gte: subDays(now, 7) } },
      include: { animal: { select: { nutrav: true, nobovi: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF", sexbov: "F", estGenisse: false },
      include: {
        saillies: { orderBy: { date: "desc" }, take: 1, include: { gestation: true } },
        vaccinations: { select: { vaccin: true, date: true } },
      },
    }),
  ]);

  // Veaux à vacciner urgents (< 2 ans avec protocole incomplet)
  const veauxAVacciner: VeauItem[] = animaux
    .filter((a) => differenceInDays(now, a.danais) <= 365 * 2)
    .map((animal) => ({
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      ageLabel: formatAge(animal.danais),
      vaccinsManquants: getVaccinsManquants(
        animal.danais,
        animal.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date })),
        protocoles
      ),
    }))
    .filter((a) => a.vaccinsManquants.length > 0)
    .sort((a, b) => {
      const ua = a.vaccinsManquants.some((v) => v.urgent);
      const ub = b.vaccinsManquants.some((v) => v.urgent);
      return ua === ub ? 0 : ua ? -1 : 1;
    });

  // Tous les veaux/génisses/mâles < 2 ans pour vue protocole complète
  const tousVeaux: VeauProtocolItem[] = animaux
    .filter((a) => differenceInDays(now, a.danais) <= 365 * 2)
    .map((animal) => ({
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      danais: animal.danais.toISOString(),
      sexbov: animal.sexbov,
      ageLabel: formatAge(animal.danais),
      vaccinations: animal.vaccinations.map((v) => ({
        id: v.id,
        vaccin: v.vaccin,
        date: v.date.toISOString(),
      })),
    }))
    .sort((a, b) => a.nutrav.localeCompare(b.nutrav));

  // Crypto/Rotavec pré-vélage (fenêtre J-21 à J-90)
  const cryptoRotavec: CryptoItem[] = vachesAvecGestation
    .map((vache) => {
      const gestation = vache.saillies[0]?.gestation;
      if (!gestation?.dateVelagePrevue) return null;
      if (!["VERT", "ROSE"].includes(gestation.etat)) return null;
      const jours = differenceInDays(new Date(gestation.dateVelagePrevue), now);
      if (jours < 21 || jours > 90) return null;
      const hasCrypto = vache.vaccinations.some(
        (v) => v.vaccin === "CRYPTO" && differenceInDays(now, v.date) < 300
      );
      const hasRotavec = vache.vaccinations.some(
        (v) => v.vaccin === "ROTAVEC" && differenceInDays(now, v.date) < 300
      );
      if (hasCrypto && hasRotavec) return null;
      return {
        id: vache.id,
        nutrav: vache.nutrav,
        nobovi: vache.nobovi,
        joursAvantVelage: jours,
        dateLabel: formatDate(gestation.dateVelagePrevue),
        hasCrypto,
        hasRotavec,
      } satisfies CryptoItem;
    })
    .filter(Boolean) as CryptoItem[];

  // Bolus pré-vélage (fenêtre J-21 à J-45)
  const bolus: BolusItem[] = vachesAvecGestation
    .map((vache) => {
      const gestation = vache.saillies[0]?.gestation;
      if (!gestation?.dateVelagePrevue) return null;
      if (!["VERT", "ROSE"].includes(gestation.etat)) return null;
      const jours = differenceInDays(new Date(gestation.dateVelagePrevue), now);
      if (jours < 21 || jours > 45) return null;
      const hasBolus = vache.vaccinations.some(
        (v) => (v.vaccin === "BOLUS" || v.vaccin === "METRABOL") && differenceInDays(now, v.date) < 300
      );
      if (hasBolus) return null;
      return {
        id: vache.id,
        nutrav: vache.nutrav,
        nobovi: vache.nobovi,
        joursAvantVelage: jours,
        dateLabel: formatDate(gestation.dateVelagePrevue),
      } satisfies BolusItem;
    })
    .filter(Boolean) as BolusItem[];

  cryptoRotavec.sort((a, b) => a.joursAvantVelage - b.joursAvantVelage);
  bolus.sort((a, b) => a.joursAvantVelage - b.joursAvantVelage);

  // Vaches avec statut vaccin pré-vélage (pour l'onglet Vaccins Vaches)
  const toutesVaches = vachesAvecGestation
    .filter((v) => v.saillies[0]?.gestation?.dateVelagePrevue)
    .map((vache) => {
      const gestation = vache.saillies[0]!.gestation!;
      const jours = differenceInDays(new Date(gestation.dateVelagePrevue!), now);
      const hasCrypto = vache.vaccinations.some((v) => v.vaccin === "CRYPTO" && differenceInDays(now, v.date) < 300);
      const hasRotavec = vache.vaccinations.some((v) => v.vaccin === "ROTAVEC" && differenceInDays(now, v.date) < 300);
      const hasBolus = vache.vaccinations.some((v) => (v.vaccin === "BOLUS" || v.vaccin === "METRABOL") && differenceInDays(now, v.date) < 300);
      return {
        id: vache.id,
        nutrav: vache.nutrav,
        nobovi: vache.nobovi,
        joursAvantVelage: jours,
        dateVelage: gestation.dateVelagePrevue!.toISOString(),
        etatGestation: gestation.etat,
        hasCrypto,
        hasRotavec,
        hasBolus,
      };
    })
    .filter((v) => ["VERT", "ROSE"].includes(v.etatGestation))
    .sort((a, b) => a.joursAvantVelage - b.joursAvantVelage);

  const recentes: RecentItem[] = vaccinationsRecentes.map((v) => ({
    id: v.id,
    nutrav: v.animal.nutrav,
    nobovi: v.animal.nobovi,
    vaccin: v.vaccin,
    dateLabel: formatDate(v.date),
  }));

  return { veauxAVacciner, tousVeaux, cryptoRotavec, bolus, toutesVaches, recentes };
}

export default async function SanitairePage() {
  const protocoles = await getProtocoles();
  const { veauxAVacciner, tousVeaux, cryptoRotavec, bolus, toutesVaches, recentes } = await getSanitaireData(protocoles);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Sanitaire</h2>
        <div className="ml-auto flex gap-2">
          <Link
            href="/sanitaire/impression"
            className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50"
            title="Imprimer le carnet sanitaire"
          >
            <Printer size={18} />
          </Link>
          <Link
            href="/config/protocoles"
            className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50"
            title="Configurer les protocoles"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>

      <SanitaireClient
        veauxAVacciner={veauxAVacciner}
        tousVeaux={tousVeaux}
        cryptoRotavec={cryptoRotavec}
        bolus={bolus}
        toutesVaches={toutesVaches}
        vaccinationsRecentes={recentes}
        protocoles={protocoles}
      />
    </div>
  );
}
