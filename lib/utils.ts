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

  // Vide explicitement confirmé par écho ou annulation manuelle — priorité absolue
  if (gestationEtat === "ROUGE") return "ROUGE";

  // Pleine confirmée par écho
  if (gestationEtat === "VERT") {
    // Vélage imminent (< 30 j)
    if (dateVelagePrevue) {
      const diffJours = differenceInDays(dateVelagePrevue, now);
      if (diffJours >= 0 && diffJours <= 30) return "ROSE";
    }
    return "VERT";
  }

  // Pas de saillie enregistrée
  if (!derniereSaillie) {
    if (dernierVelage) {
      const joursDepuisVelage = differenceInDays(now, dernierVelage);
      if (joursDepuisVelage > 60) return "ROUGE";
    }
    return "ROUGE";
  }

  // Saillie enregistrée — calcul par délai
  // ROUGE ne vient jamais du délai seul : uniquement d'un écho VIDE ou d'un marquage manuel
  const joursDepuisSaillie = differenceInDays(now, derniereSaillie);
  if (joursDepuisSaillie < 35) return "GRIS";
  return "JAUNE";
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
    case "GRIS": return "Saillie récente";
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

// Protocol vaccinal — statut visuel par étape
export type StepStatus = "done" | "due" | "pending" | "not_eligible";

export interface ProtocolStep {
  vaccin: string;
  label: string;
  status: StepStatus;
  doneDate?: Date;
  eligibleDate?: Date;
  isRappel: boolean;
  isMandatory: boolean;
  isUrgent: boolean;
}

export function getVaccinProtocolSteps(
  danais: Date,
  vaccinations: { vaccin: string; date: Date }[]
): ProtocolStep[] {
  const now = new Date();
  const ageJours = differenceInDays(now, danais);
  const steps: ProtocolStep[] = [];
  const get = (nom: string) => vaccinations.find((v) => v.vaccin === nom);

  // NASALGEN
  const nasalgen = get("NASALGEN");
  steps.push({
    vaccin: "NASALGEN",
    label: "Nasalgen",
    status: nasalgen ? "done" : "due",
    doneDate: nasalgen?.date,
    isRappel: false,
    isMandatory: false,
    isUrgent: !nasalgen && ageJours > 7,
  });

  // NASALGEN_RAPPEL (90j after primo)
  if (nasalgen) {
    const joursDepuis = differenceInDays(now, nasalgen.date);
    const rappel = get("NASALGEN_RAPPEL");
    steps.push({
      vaccin: "NASALGEN_RAPPEL",
      label: "Nasalgen rappel",
      status: rappel ? "done" : joursDepuis >= 90 ? "due" : "pending",
      doneDate: rappel?.date,
      eligibleDate: joursDepuis < 90 ? addDays(nasalgen.date, 90) : undefined,
      isRappel: true,
      isMandatory: false,
      isUrgent: !rappel && joursDepuis > 105,
    });
  }

  // HIPRABOVIS (éligible 30j)
  const hipra = get("HIPRABOVIS");
  steps.push({
    vaccin: "HIPRABOVIS",
    label: "Hiprabovis",
    status: hipra ? "done" : ageJours >= 30 ? "due" : "not_eligible",
    doneDate: hipra?.date,
    eligibleDate: ageJours < 30 ? addDays(danais, 30) : undefined,
    isRappel: false,
    isMandatory: false,
    isUrgent: !hipra && ageJours > 60,
  });

  // HIPRABOVIS_RAPPEL (21j after primo)
  if (hipra) {
    const joursDepuis = differenceInDays(now, hipra.date);
    const rappel = get("HIPRABOVIS_RAPPEL");
    steps.push({
      vaccin: "HIPRABOVIS_RAPPEL",
      label: "Hiprabovis rappel",
      status: rappel ? "done" : joursDepuis >= 21 ? "due" : "pending",
      doneDate: rappel?.date,
      eligibleDate: joursDepuis < 21 ? addDays(hipra.date, 21) : undefined,
      isRappel: true,
      isMandatory: false,
      isUrgent: !rappel && joursDepuis > 35,
    });
  }

  // MHE primo (éligible 60j — obligatoire vente)
  const mhe = get("MHE");
  steps.push({
    vaccin: "MHE",
    label: "MHE primo",
    status: mhe ? "done" : ageJours >= 60 ? "due" : "not_eligible",
    doneDate: mhe?.date,
    eligibleDate: ageJours < 60 ? addDays(danais, 60) : undefined,
    isRappel: false,
    isMandatory: true,
    isUrgent: !mhe && ageJours >= 60,
  });

  // MHE_RAPPEL (21j after primo — obligatoire + J+10 pour vente)
  if (mhe) {
    const joursDepuis = differenceInDays(now, mhe.date);
    const rappel = get("MHE_RAPPEL");
    steps.push({
      vaccin: "MHE_RAPPEL",
      label: "MHE rappel",
      status: rappel ? "done" : joursDepuis >= 21 ? "due" : "pending",
      doneDate: rappel?.date,
      eligibleDate: joursDepuis < 21 ? addDays(mhe.date, 21) : undefined,
      isRappel: true,
      isMandatory: true,
      isUrgent: !rappel && joursDepuis > 35,
    });
  }

  return steps;
}

// unused but exported for convenience
export { addDays };
