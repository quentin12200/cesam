export interface GestationRecord {
  annee: number;
  saison: "Printemps" | "Été" | "Automne" | "Hiver";
  duree: number;
  sexeVeau: "M" | "F" | null;
  typeSaillie: "IA" | "TAUREAU";
  ageMereAnnees: number;
  mereNutrav: string;
  mereNom: string | null;
}
