import { prisma } from "@/lib/prisma";

export interface CampagneAnimal {
  id: string;
  nutrav: string;
  nom: string | null;
  date: Date;
}

export interface CampagneVelage {
  id: string;
  nutrav: string;
  nom: string | null;
  date: Date;
  totalVeaux: number;
  mortsNes: number;
}

export interface CampagneReproduction {
  annee: number;
  femelles: CampagneAnimal[];
  pleines: CampagneAnimal[];
  velages: CampagneVelage[];
  totalNes: number;
  nesVivants: number;
  mortsNes: number;
  veauxSevres: CampagneAnimal[];
  veauxVendusAvantSevrage: CampagneAnimal[];
  mortsAvantSevrage: CampagneAnimal[];
  tauxGestation: number | null;
  tauxVelage: number | null;
  productiviteNumerique: number | null;
}

const JOUR_MS = 86_400_000;
const DUREE_GESTATION = 285;

function ajouterJours(date: Date, jours: number) {
  return new Date(date.getTime() + jours * JOUR_MS);
}

function decompositionVelage(qualificatif: string, sousType: string | null) {
  const principal = qualificatif.trim().toUpperCase();
  const precision = sousType?.trim().toUpperCase() ?? "";

  if (principal === "AVORTEMENT") return { total: 0, mortsNes: 0, vivants: 0 };
  if (principal === "MORT_NEE" || principal === "MORT_NÉE") {
    return { total: 1, mortsNes: 1, vivants: 0 };
  }
  if (principal === "JUMEAUX") {
    if (precision === "DEUX_MORTS") return { total: 2, mortsNes: 2, vivants: 0 };
    if (precision === "UN_MORT") return { total: 2, mortsNes: 1, vivants: 1 };
    return { total: 2, mortsNes: 0, vivants: 2 };
  }
  return { total: 1, mortsNes: 0, vivants: 1 };
}

function avantSevrage(dateEvenement: Date, animal: {
  danais: Date;
  dateSevrage: Date | null;
  sevreFait: boolean;
}) {
  if (animal.dateSevrage) return dateEvenement < animal.dateSevrage;
  const ageJours = Math.floor((dateEvenement.getTime() - animal.danais.getTime()) / JOUR_MS);
  return !animal.sevreFait && ageJours >= 0 && ageJours <= 365;
}

function estVenteVif(type: string, modeVente: string | null) {
  return modeVente?.toUpperCase() === "VIF" || type === "ELEVAGE";
}

function pourcentage(numerateur: number, denominateur: number) {
  return denominateur > 0 ? Math.round((numerateur / denominateur) * 1000) / 10 : null;
}

export async function getCampagnesReproduction(nombreAnnees = 6): Promise<CampagneReproduction[]> {
  const anneeCourante = new Date().getFullYear();
  const premiereAnnee = anneeCourante - nombreAnnees + 1;
  const debutSaillies = ajouterJours(new Date(`${premiereAnnee}-01-01T00:00:00`), -DUREE_GESTATION);
  const debutNaissances = new Date(`${premiereAnnee}-01-01T00:00:00`);

  const [saillies, velages, historiques] = await Promise.all([
    prisma.saillie.findMany({
      where: { date: { gte: debutSaillies }, animal: { sexbov: "F" } },
      select: {
        date: true,
        animal: { select: { id: true, nutrav: true, nobovi: true } },
        gestation: {
          select: {
            etat: true,
            resultatEcho: true,
            dateVelagePrevue: true,
            velage: { select: { date: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.velage.findMany({
      where: { date: { gte: debutNaissances } },
      select: {
        id: true,
        date: true,
        qualificatif: true,
        sousType: true,
        vache: { select: { id: true, nutrav: true, nobovi: true } },
        veau: {
          select: {
            id: true,
            nutrav: true,
            nobovi: true,
            danais: true,
            dateSevrage: true,
            sevreFait: true,
            sortie: {
              select: {
                date: true,
                type: true,
                modeVente: true,
              },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.venteHistorique.findMany({
      where: { date: { gte: debutNaissances } },
      select: {
        date: true,
        nutrav: true,
        typeVente: true,
        causeMortalite: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const historiquesParNutrav = new Map<string, typeof historiques>();
  for (const historique of historiques) {
    if (!historique.nutrav) continue;
    const liste = historiquesParNutrav.get(historique.nutrav) ?? [];
    liste.push(historique);
    historiquesParNutrav.set(historique.nutrav, liste);
  }

  const donnees = new Map<number, {
    femelles: Map<string, CampagneAnimal>;
    pleines: Map<string, CampagneAnimal>;
    velages: Map<string, CampagneVelage>;
    totalNes: number;
    nesVivants: number;
    mortsNes: number;
    sevres: Map<string, CampagneAnimal>;
    vendus: Map<string, CampagneAnimal>;
    morts: Map<string, CampagneAnimal>;
  }>();

  for (let annee = premiereAnnee; annee <= anneeCourante; annee += 1) {
    donnees.set(annee, {
      femelles: new Map(),
      pleines: new Map(),
      velages: new Map(),
      totalNes: 0,
      nesVivants: 0,
      mortsNes: 0,
      sevres: new Map(),
      vendus: new Map(),
      morts: new Map(),
    });
  }

  for (const saillie of saillies) {
    const dateCampagne =
      saillie.gestation?.velage?.date ??
      saillie.gestation?.dateVelagePrevue ??
      ajouterJours(saillie.date, DUREE_GESTATION);
    const ligne = donnees.get(dateCampagne.getFullYear());
    if (!ligne) continue;

    const detail = {
      id: saillie.animal.id,
      nutrav: saillie.animal.nutrav,
      nom: saillie.animal.nobovi,
      date: saillie.date,
    };
    ligne.femelles.set(saillie.animal.id, detail);

    const pleine =
      saillie.gestation?.resultatEcho === "PLEINE" ||
      saillie.gestation?.etat === "VERT" ||
      saillie.gestation?.etat === "VELAGE" ||
      Boolean(saillie.gestation?.velage);
    if (pleine) ligne.pleines.set(saillie.animal.id, detail);
  }

  for (const velage of velages) {
    const ligne = donnees.get(velage.date.getFullYear());
    if (!ligne) continue;
    const compte = decompositionVelage(velage.qualificatif, velage.sousType);
    if (compte.total === 0) continue;

    ligne.velages.set(velage.vache.id, {
      id: velage.id,
      nutrav: velage.vache.nutrav,
      nom: velage.vache.nobovi,
      date: velage.date,
      totalVeaux: compte.total,
      mortsNes: compte.mortsNes,
    });
    ligne.totalNes += compte.total;
    ligne.nesVivants += compte.vivants;
    ligne.mortsNes += compte.mortsNes;

    const veau = velage.veau;
    if (!veau || compte.vivants === 0) continue;

    let dateSortie = veau.sortie?.date ?? null;
    let natureSortie: "MORT" | "VIF" | null = null;
    if (veau.sortie?.type === "MORT") {
      natureSortie = "MORT";
    } else if (veau.sortie && estVenteVif(veau.sortie.type, veau.sortie.modeVente)) {
      natureSortie = "VIF";
    } else if (!veau.sortie) {
      const historique = (historiquesParNutrav.get(veau.nutrav) ?? [])[0];
      if (historique) {
        dateSortie = historique.date;
        natureSortie = historique.causeMortalite || historique.typeVente.toLowerCase().includes("mort")
          ? "MORT"
          : historique.typeVente.toLowerCase() === "vif"
            ? "VIF"
            : null;
      }
    }

    const detail = {
      id: veau.id,
      nutrav: veau.nutrav,
      nom: veau.nobovi,
      date: dateSortie ?? veau.dateSevrage ?? velage.date,
    };

    if (dateSortie && natureSortie === "MORT" && avantSevrage(dateSortie, veau)) {
      ligne.morts.set(veau.id, detail);
    } else if (dateSortie && natureSortie === "VIF" && avantSevrage(dateSortie, veau)) {
      ligne.vendus.set(veau.id, detail);
    } else if (veau.dateSevrage) {
      ligne.sevres.set(veau.id, { ...detail, date: veau.dateSevrage });
    }
  }

  return [...donnees.entries()].map(([annee, ligne]) => {
    const femelles = [...ligne.femelles.values()];
    const pleines = [...ligne.pleines.values()];
    const velagesCampagne = [...ligne.velages.values()];
    const veauxSevres = [...ligne.sevres.values()];
    const veauxVendusAvantSevrage = [...ligne.vendus.values()];
    const mortsAvantSevrage = [...ligne.morts.values()];
    const obtenus = veauxSevres.length + veauxVendusAvantSevrage.length;

    return {
      annee,
      femelles,
      pleines,
      velages: velagesCampagne,
      totalNes: ligne.totalNes,
      nesVivants: ligne.nesVivants,
      mortsNes: ligne.mortsNes,
      veauxSevres,
      veauxVendusAvantSevrage,
      mortsAvantSevrage,
      tauxGestation: pourcentage(pleines.length, femelles.length),
      tauxVelage: pourcentage(velagesCampagne.length, femelles.length),
      productiviteNumerique: pourcentage(obtenus, femelles.length),
    };
  });
}
