export type WorkspaceAnimalKind =
  | "VACHE"
  | "GENISSE"
  | "VELLE"
  | "VEAU"
  | "TAUREAU";

export type ReproductionStatus =
  | "PREGNANT"
  | "EMPTY"
  | "TO_CHECK"
  | "NOT_APPLICABLE";

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
  calfId: string | null;
  calfNutrav: string | null;
  reproductionStatus: ReproductionStatus;
  pregnantMonths: number | null;
  echoDue: boolean;
  weaningDue: boolean;
  treatmentDue: boolean;
  vaccinationDue: boolean;
  weightDue: boolean;
  saleBlocked: boolean;
  lastWeightKg: number | null;
  priority: 0 | 1 | 2 | 3;
};

export type WorkspaceAction =
  | "treatment"
  | "vaccination"
  | "echo"
  | "weaning"
  | "move"
  | "weight"
  | "sale";

export type WorkspaceView =
  | "today"
  | "all"
  | "young-related"
  | "cows"
  | "reproduction"
  | "weaning";

export type WorkspaceSort =
  | "priority"
  | "primary-number"
  | "related-number"
  | "youngest"
  | "oldest";

export type WorkspaceColumn =
  | "age"
  | "group"
  | "related"
  | "reproduction"
  | "alerts"
  | "work";

export type WorkspaceRow = {
  id: string;
  primary: WorkspaceAnimal;
  related: WorkspaceAnimal | null;
};

export type WorkspaceActivity = {
  id: string;
  action: WorkspaceAction;
  label: string;
  animalIds: string[];
  time: string;
};

export type WorkspaceSessionStatus = "active" | "paused";

export type WorkspaceCompletedState = Record<WorkspaceAction, string[]>;
