export type WorkspaceAnimalKind =
  | "VACHE"
  | "GENISSE"
  | "VELLE"
  | "VEAU"
  | "TAUREAU";

export type WorkspaceAnimal = {
  id: string;
  nutrav: string;
  name: string | null;
  birthDate: string;
  sex: "F" | "M";
  kind: WorkspaceAnimalKind;
  groupName: string | null;
  motherId: string | null;
  motherNutrav: string | null;
  calfNutrav: string | null;
  echoDue: boolean;
  weaningDue: boolean;
  saleBlocked: boolean;
};

export type WorkspaceAction = "treatment" | "weaning" | "echo";

export type WorkspaceView = "all" | "young" | "cows" | "heifers" | "weaning";

export type WorkspaceSort = "number" | "youngest" | "oldest";
