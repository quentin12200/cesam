import Link from "next/link";
import { GENEA_DATA } from "@/app/api/genealogie-import/data";
import { prisma } from "@/lib/prisma";
import { normalizeGenealogyNational } from "@/lib/animal-genealogy-data";
import LabFathers from "@/app/lab/LabFathers";
export const dynamic = "force-dynamic";
export default async function CoulissesFathersPage() {
  const [bulls, children] = await Promise.all([
    prisma.taureau.findMany({ select: { id: true, nupere: true, nopere: true, copaip: true, present: true } }),
    prisma.animal.findMany({ select: { nunati: true, nutrav: true, nobovi: true, sexbov: true, danais: true, statut: true, taureauId: true, pereNationalManuel: true, pereNomManuel: true, pereTravailManuel: true, mereTravailManuel: true, mereNomManuel: true, mere: { select: { nutrav: true, nobovi: true } }, velageVeau: { select: { pereNunati: true, pereNom: true, gestation: { select: { saillie: { select: { taureauId: true } } } } } } } }),
  ]);
  const fathers = bulls.map(bull => {
          const number = normalizeGenealogyNational(bull.nupere);
          const bullName = bull.nopere?.trim().toLocaleUpperCase("fr") ?? "";
          const uniqueName = bullName.length >= 3 && bulls.filter(b => b.nopere?.trim().toLocaleUpperCase("fr") === bullName).length === 1;
          const linked = children.filter(a => {
            if (a.taureauId === bull.id || a.velageVeau?.gestation?.saillie?.taureauId === bull.id) return true;
            if (number.length >= 8 && [a.pereNationalManuel, a.velageVeau?.pereNunati].some(n => normalizeGenealogyNational(n) === number)) return true;
            // Historical names are used only when they identify exactly one bull, and no conflicting national ID is recorded.
            if (!uniqueName || a.taureauId) return false;
            const namesMatch = [a.pereNomManuel, a.velageVeau?.pereNom].some(n => n?.trim().toLocaleUpperCase("fr") === bullName);
            if (!namesMatch) return false;
            // A distinct full national number takes precedence over a manually entered name.
            const recordedNationals = [a.pereNationalManuel, a.velageVeau?.pereNunati]
              .map(normalizeGenealogyNational).filter(Boolean);
            return recordedNationals.every(n => n.length < 8 || n === number);
          });
          // Historical genealogy is read-only; match on full national numbers, never on a name or last four digits.
          const historical = GENEA_DATA.filter(entry =>
            (number.length >= 8 && normalizeGenealogyNational(entry.pereNat) === number) ||
            (uniqueName && entry.pereNom.trim().toLocaleUpperCase("fr") === bullName &&
              (number.length < 8 || normalizeGenealogyNational(entry.pereNat) === number))
          );
          const byNational = new Map(children.map(a => [normalizeGenealogyNational(a.nunati), a]));
          const linkedNationals = new Set(linked.map(a => normalizeGenealogyNational(a.nunati)));
          const historicalOnly = historical.filter(entry => {
            const nat = normalizeGenealogyNational(entry.veauNat);
            if (linkedNationals.has(nat)) return false;
            // A conflicting father in CESAM must be reviewed, not silently overwritten.
            const existing = byNational.get(nat);
            if (existing && (existing.taureauId || existing.pereNationalManuel || existing.velageVeau?.pereNunati)) return false;
            return true;
          });
          return { id: bull.id, number: bull.nupere, country: bull.copaip, name: bull.nopere, present: bull.present, offspring: linked.length + historicalOnly.length, presentOffspring: linked.filter(a => a.statut === "ACTIF").length, children: [...linked.map(a => ({ number: a.nutrav, name: a.nobovi, sex: a.sexbov, birth: a.danais?.toISOString() ?? null, mother: a.mere?.nobovi ?? a.mere?.nutrav ?? a.mereNomManuel ?? a.mereTravailManuel ?? null, status: a.statut, source: "CESAM" as const })), ...historicalOnly.map(entry => ({ number: entry.veauNat.slice(-4), name: entry.nom, sex: entry.sexe, birth: entry.danais, mother: entry.mereNat, status: "HISTORIQUE", source: "HISTORIQUE" as const }))] };
        });
  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 pb-24">
    <Link href="/config/coulisses" className="inline-flex min-h-11 items-center text-sm font-bold text-green-800 underline">Retour aux Coulisses</Link>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Données réelles : toute correction validée ici modifie CESAM.</p>
    <LabFathers fathers={fathers} />
  </div>;
}
