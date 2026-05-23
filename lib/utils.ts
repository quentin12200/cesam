import { differenceInMonths, differenceInDays, addMonths, addDays } from "date-fns";

export function formatAge(danais: Date): string {
  const now = new Date();
  const totalMois = differenceInMonths(now, danais);
  if (totalMois >= 24) {
    const ans = Math.floor(totalMois / 12);
    const moisRestants = totalMois % 12;
    if (moisRestants === 0) return `${ans} an${ans > 1 ? "s" : ""}`;
    return `${ans} an${ans > 1 ? "s" : ""} ${moisRestants} m`;
  }
  const joursRestants = differenceInDays(now, addMonths(danais, totalMois));
  return `${totalMois} m ${joursRestants} j`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("fr-FR");
}

export function formatDateShort(date: Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type EtatGestation = "GRIS" | "JAUNE" | "VERT" | "ROUGE" | "ROSE";

export function getEtatGestation(
  derniereSaillie: Date | null,
  gestationEtat: string | null,
  dateVelagePrevue: Date | null,
  dernierVelage: Date | null
): EtatGestation {
  const now = new Date();

  // Confirmée pleine
  if (gestationEtat === "VERT") return "VERT";

  // Vélage prévu dans le mois en cours
  if (dateVelagePrevue) {
    const diffJours = differenceInDays(dateVelagePrevue, now);
    if (diffJours >= 0 && diffJours <= 30) return "ROSE";
    if (gestationEtat === "VERT") return "VERT";
  }

  // Saillie récente
  if (derniereSaillie) {
    const joursDepuisSaillie = differenceInDays(now, derniereSaillie);
    if (joursDepuisSaillie < 35) return "GRIS";
    if (joursDepuisSaillie >= 35 && joursDepuisSaillie <= 45) return "JAUNE";
  }

  // Vide ou > 60j post-vélage sans saillie
  if (!derniereSaillie) {
    if (dernierVelage) {
      const joursDepuisVelage = differenceInDays(now, dernierVelage);
      if (joursDepuisVelage > 60) return "ROUGE";
    }
    return "ROUGE";
  }

  // Plus de 45 jours sans echo confirmation
  if (derniereSaillie) {
    const joursDepuisSaillie = differenceInDays(now, derniereSaillie);
    if (joursDepuisSaillie > 45 && gestationEtat !== "VERT") return "ROUGE";
  }

  return "GRIS";
}

export function getBadgeClass(etat: EtatGestation): string {
  switch (etat) {
    case "VERT": return "bg-green-500 text-white";
    case "JAUNE": return "bg-yellow-400 text-black";
    case "ROUGE": return "bg-red-500 text-white";
    case "ROSE": return "bg-pink-400 text-white";
    case "GRIS": return "bg-gray-400 text-white";
    default: return "bg-gray-400 text-white";
  }
}

export function getEtatLabel(etat: EtatGestation): string {
  switch (etat) {
    case "VERT": return "Pleine confirmée";
    case "JAUNE": return "À échographier";
    case "ROUGE": return "Vide";
    case "ROSE": return "Vélage imminent";
    case "GRIS": return "En attente";
    default: return "Inconnu";
  }
}

// Protocoles vaccins veaux
export type VaccinInfo = {
  vaccin: string;
  raison: string;
  urgent: boolean;
};

export function getVaccinsManquants(
  danais: Date,
  vaccinations: { vaccin: string; date: Date }[]
): VaccinInfo[] {
  const now = new Date();
  const ageJours = differenceInDays(now, danais);
  const manquants: VaccinInfo[] = [];

  const aVaccin = (nom: string) => vaccinations.some((v) => v.vaccin === nom);

  // NASALGEN: dès naissance
  if (!aVaccin("NASALGEN")) {
    manquants.push({ vaccin: "NASALGEN", raison: "Vaccin naissance", urgent: ageJours > 7 });
  } else if (!aVaccin("NASALGEN_RAPPEL")) {
    const premiereVacc = vaccinations.find((v) => v.vaccin === "NASALGEN");
    if (premiereVacc) {
      const joursDepuis = differenceInDays(now, premiereVacc.date);
      if (joursDepuis >= 90) {
        manquants.push({ vaccin: "NASALGEN_RAPPEL", raison: "Rappel NASALGEN +90j", urgent: joursDepuis > 105 });
      }
    }
  }

  // HIPRABOVIS: éligible >= 30j
  if (ageJours >= 30 && !aVaccin("HIPRABOVIS")) {
    manquants.push({ vaccin: "HIPRABOVIS", raison: "HIPRABOVIS (>30j)", urgent: ageJours > 60 });
  } else if (aVaccin("HIPRABOVIS") && !aVaccin("HIPRABOVIS_RAPPEL")) {
    const premiere = vaccinations.find((v) => v.vaccin === "HIPRABOVIS");
    if (premiere) {
      const joursDepuis = differenceInDays(now, premiere.date);
      if (joursDepuis >= 21) {
        manquants.push({ vaccin: "HIPRABOVIS_RAPPEL", raison: "Rappel HIPRABOVIS +21j", urgent: joursDepuis > 35 });
      }
    }
  }

  // MHE: éligible >= 60j (OBLIGATOIRE pour vente)
  if (ageJours >= 60 && !aVaccin("MHE")) {
    manquants.push({ vaccin: "MHE", raison: "MHE primo (>60j)", urgent: true });
  } else if (aVaccin("MHE") && !aVaccin("MHE_RAPPEL")) {
    const premiere = vaccinations.find((v) => v.vaccin === "MHE");
    if (premiere) {
      const joursDepuis = differenceInDays(now, premiere.date);
      if (joursDepuis >= 21) {
        manquants.push({ vaccin: "MHE_RAPPEL", raison: "MHE rappel +21j (vente)", urgent: joursDepuis > 35 });
      }
    }
  }

  return manquants;
}

export function isMheVendable(vaccinations: { vaccin: string; date: Date }[]): {
  vendable: boolean;
  reason: string;
} {
  const mhe = vaccinations.find((v) => v.vaccin === "MHE");
  const mheRappel = vaccinations.find((v) => v.vaccin === "MHE_RAPPEL");

  if (!mhe) return { vendable: false, reason: "MHE primo manquant" };
  if (!mheRappel) return { vendable: false, reason: "MHE rappel manquant" };

  const joursDepuisRappel = differenceInDays(new Date(), mheRappel.date);
  if (joursDepuisRappel < 10) {
    return { vendable: false, reason: `J+${joursDepuisRappel}/10 après rappel MHE` };
  }
  return { vendable: true, reason: "MHE complet" };
}

// unused but exported for convenience
export { addDays };
