export const dynamic = "force-dynamic";

import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCategorie } from "@/lib/utils";
import { getPreparationsVaccinales } from "@/lib/vaccine-preparation-data";
import { unifierActesVaccinaux } from "@/lib/vaccine-acts";
import { construireGrilleVaccinale, type AnimalGrille, type ProtocoleGrille } from "@/lib/vaccine-grid";
import { resoudreVoieVaccinale } from "@/lib/vaccine-planner";
import PreparationVaccinCard from "./PreparationVaccinCard";
import TableauVaccinal from "./TableauVaccinal";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function achatConseille(achats: Array<{ doses: number; nombre: number }>, perte: number, conservationConnue: boolean): string {
  if (achats.length === 0) return "Aucun achat nécessaire";
  const formats = achats.map((achat) => `${achat.nombre} × ${achat.doses} doses`).join(" + ");
  if (perte <= 0) return formats;
  return `${formats} · ${perte} dose(s) ${conservationConnue ? "restante(s)" : "perdue(s)"}`;
}

export default async function VaccinsPage() {
  const [groupes, protocolesDb, animauxDb, medicamentsVaccin] = await Promise.all([
    getPreparationsVaccinales(),
    prisma.protocoleVaccin.findMany({
      where: { actif: true },
      orderBy: { ordre: "asc" },
      include: {
        etapes: {
          orderBy: { ordre: "asc" },
          include: {
            medicaments: {
              where: { alternative: false },
              select: {
                medicamentId: true,
                voie: true,
                preconisationId: true,
                medicament: {
                  select: {
                    id: true,
                    nom: true,
                    voie: true,
                    uniteDosage: true,
                    preconisations: { select: { id: true, statut: true, voie: true, dose: true, unite: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      select: {
        id: true, nutrav: true, nobovi: true, sexbov: true, danais: true, estGenisse: true, categorie: true,
        groupe: { select: { nom: true } },
        _count: { select: { velagesVache: true } },
        saillies: {
          where: { gestation: { is: { etat: { in: ["VERT", "ROSE"] } } } },
          orderBy: { date: "desc" },
          take: 1,
          select: { gestation: { select: { id: true, dateVelagePrevue: true } } },
        },
        vaccinations: { where: { statut: "FAIT" }, select: { id: true, vaccin: true, date: true, statut: true, voie: true, dose: true, medicamentId: true, protocoleId: true, etapeProtocoleId: true, gestationId: true }, orderBy: { date: "asc" } },
        // Un vaccin peut être saisi comme simple Traitement (hors séance structurée) : il doit
        // quand même remonter comme fait dans la grille. Voir lib/vaccine-acts.ts.
        traitements: { where: { medicament: { categorie: "VACCIN" } }, select: { id: true, dateDebut: true, medicamentNom: true, medicamentId: true, voie: true, dose: true, uniteDosage: true, protocoleVaccinId: true, etapeProtocoleVaccinId: true, gestationId: true } },
      },
      orderBy: { nutrav: "asc" },
    }),
    // Les blocs de la grille viennent de la pharmacie, pas seulement des protocoles configurés :
    // un vaccin comme Bovigrip doit avoir son bloc même sans protocole actif.
    prisma.medicament.findMany({
      where: { categorie: "VACCIN", actif: true },
      select: { id: true, nom: true, voie: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  const protocolesGrille: ProtocoleGrille[] = protocolesDb.map((protocole) => ({
    id: protocole.id, nom: protocole.nom, label: protocole.label,
    ageMinJours: protocole.ageMinJours, ageMaxJours: protocole.ageMaxJours,
    categoriesJson: protocole.categoriesJson, sexeCible: protocole.sexeCible, gestante: protocole.gestante,
    rangVelageMin: protocole.rangVelageMin, rangVelageMax: protocole.rangVelageMax, lotCible: protocole.lotCible,
    etapes: protocole.etapes.map((etape) => {
      const liaison = etape.medicaments[0] ?? null;
      const medicament = liaison?.medicament ?? null;
      const preconisationsValides = medicament?.preconisations.filter((item) => item.statut === "VALIDE") ?? [];
      const preconisationLiee = liaison?.preconisationId
        ? preconisationsValides.find((item) => item.id === liaison.preconisationId) ?? null
        : null;
      const preconisationsDosees = preconisationsValides.filter((item) => item.dose != null);
      const preconisationDose = preconisationLiee ?? (preconisationsDosees.length === 1 ? preconisationsDosees[0] : null);
      const preconisationVoie = preconisationLiee?.voie
        ? preconisationLiee
        : preconisationsValides.find((item) => item.voie) ?? null;
      return {
        id: etape.id, label: etape.label, ordre: etape.ordre, cycle: etape.cycle, reference: etape.reference,
        debutValeur: etape.debutValeur, debutUnite: etape.debutUnite, debutPosition: etape.debutPosition,
        finValeur: etape.finValeur, finUnite: etape.finUnite, finPosition: etape.finPosition,
        dateFixe: etape.dateFixe, recurrenceMois: etape.recurrenceMois, obligatoire: etape.obligatoire,
        medicamentId: liaison?.medicamentId ?? null,
        medicamentNom: medicament?.nom ?? null,
        voie: resoudreVoieVaccinale({
          voiePreconisation: preconisationVoie?.voie,
          voieMedicament: medicament?.voie,
          voieLiaison: liaison?.voie,
        }),
        dose: preconisationDose?.dose ?? null,
        uniteDosage: preconisationDose?.unite || medicament?.uniteDosage || null,
        medicaments: etape.medicaments.map((item) => ({ medicament: { id: item.medicament.id, nom: item.medicament.nom } })),
      };
    }),
  }));

  const animauxGrille: AnimalGrille[] = animauxDb.map((animal) => {
    const categorie = getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie);
    const gestation = animal.saillies[0]?.gestation ?? null;
    return {
      id: animal.id, nutrav: animal.nutrav, nom: animal.nobovi, sexe: animal.sexbov, danaisIso: animal.danais.toISOString(),
      categorie, nombreVelages: animal._count.velagesVache, groupeNom: animal.groupe?.nom ?? null,
      gestationId: gestation?.id ?? null, dateVelagePrevueIso: gestation?.dateVelagePrevue?.toISOString() ?? null,
      actes: unifierActesVaccinaux(
        animal.vaccinations.map((vaccination) => ({ ...vaccination, sourceType: "VACCINATION" as const, sourceId: vaccination.id })),
        animal.traitements,
      ),
    };
  });

  const grille = construireGrilleVaccinale(
    animauxGrille,
    protocolesGrille,
    medicamentsVaccin.map((m) => ({ medicamentId: m.id, nom: m.nom, voie: m.voie }))
  );

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-3 pb-24">
      <header><h1 className="text-xl font-black text-gray-900">Tableau vaccinal</h1></header>
      <TableauVaccinal blocs={grille.blocs} lignes={grille.lignes.map((ligne) => ({
        ...ligne,
        actes: ligne.actes.map((acte) => ({ ...acte, date: acte.date.toISOString() })),
        cellules: Object.fromEntries(Object.entries(ligne.cellules).map(([cle, cellule]) => [cle, {
          ...cellule,
          date: cellule.date ? cellule.date.toISOString() : null,
          actes: cellule.actes.map((acte) => ({ ...acte, date: acte.date.toISOString() })),
          prochaine: cellule.prochaine ? { ...cellule.prochaine, date: cellule.prochaine.date.toISOString() } : null,
          historiquesAValider: cellule.historiquesAValider.map((historique) => ({ ...historique, date: historique.date.toISOString() })),
        }])),
      }))} />
      {groupes.length === 0 && <section className="rounded-xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">Aucun protocole vaccinal actif.</section>}
      <details className="rounded-2xl bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-bold text-gray-900">Préparer une séance de vaccination</summary>
        <Link href="/config/protocoles?returnTo=%2Fsanitaire%2Fvaccins" className="mt-3 inline-block text-sm font-semibold text-green-800 underline">Modifier les protocoles</Link>
        <div className="mt-4 space-y-4">
          {groupes.map((groupe) => <PreparationVaccinCard key={groupe.protocoleId} groupe={{
            ...groupe,
            lignes: groupe.lignes.map((ligne) => ({ ...ligne, dateMin: ligne.dateMin.toISOString(), dateMax: ligne.dateMax.toISOString() })),
            flacons: { ...groupe.flacons, prochaineLimite: groupe.flacons.prochaineLimite?.toISOString() ?? null },
          }} />)}
        </div>
      <section id="stock" className="mt-4 rounded-2xl border p-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-900"><PackageOpen size={18} /> Stock / flacons</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {groupes.map((groupe) => (
            <div key={groupe.protocoleId} className="rounded-xl border p-3 text-sm">
              <b>{groupe.vaccin}</b>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <dt className="text-gray-500">Stock Pharmacie</dt><dd className="text-right font-semibold">{groupe.stockPharmacie}</dd>
                <dt className="text-gray-500">Flacons ouverts</dt><dd className="text-right font-semibold">{groupe.flacons.ouverts}</dd>
                <dt className="text-gray-500">Doses restantes</dt><dd className="text-right font-semibold">{groupe.flacons.dosesRestantes}</dd>
                <dt className="text-gray-500">Prochaine limite</dt><dd className="text-right font-semibold">{groupe.flacons.prochaineLimite ? dateCourte.format(groupe.flacons.prochaineLimite) : "—"}</dd>
                <dt className="text-gray-500">Besoin maintenant</dt><dd className="text-right font-semibold">{groupe.dosesNecessaires} doses</dd>
                <dt className="text-gray-500">Achat conseillé</dt><dd className="text-right font-semibold">{groupe.conditionnementRenseigne ? achatConseille(groupe.flacons.achats, groupe.flacons.perte, groupe.flacons.conservationConnue) : "Impossible de calculer — conditionnement non renseigné"}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
      </details>
    </main>
  );
}
