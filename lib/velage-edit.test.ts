import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  deleteVelage,
  editVelage,
  VelageEditError,
  type AnimalDeletionInspection,
  type EditVelageInput,
} from "./velage-edit.ts";
import {
  consumesLoopNumber,
  findRemovalBlockages,
  normalizeVelageCalves,
  type AnimalRemovalFacts,
  type RemovalBlockage,
} from "./velage-safety.ts";

test("seul un veau vivant consomme un numéro de boucle", () => {
  assert.equal(consumesLoopNumber("VIVANT"), true);
  assert.equal(consumesLoopNumber("MORT_NE"), false);
});

type DeclarationRow = { id: string; animalId: string; type: string; statut: string; service: string };
type AnimalRow = {
  id: string;
  nutrav: string;
  nunati: string;
  numeroNational: string | null;
  nobovi: string | null;
  danais: Date;
  sexbov: string;
  mereId: string | null;
  categorie: string | null;
  histories: RemovalBlockage[];
};
type DetailRow = {
  id: string;
  velageId: string;
  animalId: string | null;
  nutrav: string | null;
  nunati: string | null;
  nom: string | null;
  sexe: string | null;
  statut: string;
  createdAt: Date;
};
type VelageRow = {
  id: string;
  vacheId: string;
  veauId: string | null;
  gestationId: string | null;
  date: Date;
  moment: string | null;
  qualificatif: string;
  sousType: string | null;
  capteur: number | null;
  pereNom: string | null;
  notes: string | null;
  nombreVeaux: number;
  jumeaux: boolean;
};
type State = {
  velage: VelageRow | null;
  vache: { id: string; nutrav: string; nobovi: string | null };
  animals: AnimalRow[];
  details: DetailRow[];
  declarations: DeclarationRow[];
  gestation: { id: string; etat: string } | null;
  lot: { id: string; premierNunati: string; quantite: number; prochainIndex: number; actif: boolean; createdAt: Date } | null;
  animalCreates: number;
  velageCreates: number;
  failOnAnimalDelete: boolean;
};

function initialState(): State {
  return {
    velage: {
      id: "v1",
      vacheId: "mere1",
      veauId: "a1",
      gestationId: "g1",
      date: new Date("2026-07-01T00:00:00.000Z"),
      moment: null,
      qualificatif: "NORMAL",
      sousType: "SEULE",
      capteur: null,
      pereNom: "Taureau",
      notes: null,
      nombreVeaux: 1,
      jumeaux: false,
    },
    vache: { id: "mere1", nutrav: "1000", nobovi: "Mère" },
    animals: [{
      id: "a1",
      nutrav: "2001",
      nunati: "FR2001",
      numeroNational: "FR2001",
      nobovi: "Alpha",
      danais: new Date("2026-07-01T00:00:00.000Z"),
      sexbov: "F",
      mereId: "mere1",
      categorie: "VELLE",
      histories: [],
    }],
    details: [{
      id: "d1",
      velageId: "v1",
      animalId: "a1",
      nutrav: "2001",
      nunati: "FR2001",
      nom: "Alpha",
      sexe: "F",
      statut: "VIVANT",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    }],
    declarations: [{ id: "dec1", animalId: "a1", type: "NAISSANCE", statut: "A_DECLARER", service: "AUCUN" }],
    gestation: { id: "g1", etat: "VELAGE" },
    lot: null,
    animalCreates: 0,
    velageCreates: 0,
    failOnAnimalDelete: false,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createDatabase(seed = initialState()) {
  let committed = clone(seed);
  const db = {
    get state() { return committed; },
    async $transaction<T>(work: (tx: unknown) => Promise<T>) {
      const draft = clone(committed);
      let nextAnimal = draft.animals.length + 1;
      let nextDetail = draft.details.length + 1;
      let nextDeclaration = draft.declarations.length + 1;
      const assemble = () => {
        if (!draft.velage) return null;
        return {
          ...draft.velage,
          vache: draft.vache,
          veau: draft.animals.find((animal) => animal.id === draft.velage?.veauId) ?? null,
          gestation: draft.gestation,
          veauxDetails: draft.details
            .filter((detail) => detail.velageId === draft.velage?.id)
            .map((detail) => ({ ...detail, animal: draft.animals.find((animal) => animal.id === detail.animalId) ?? null })),
        };
      };
      const tx = {
        __state: draft,
        velage: {
          findUnique: async ({ where }: { where: { id: string } }) => draft.velage?.id === where.id ? assemble() : null,
          findFirst: async ({ where }: { where: { veauId?: string; id?: { not?: string } } }) => {
            const velage = draft.velage;
            if (!velage) return null;
            return velage.veauId === where.veauId && velage.id !== where.id?.not ? { id: velage.id } : null;
          },
          update: async ({ where, data }: { where: { id: string }; data: Partial<VelageRow> }) => {
            if (!draft.velage || draft.velage.id !== where.id) throw new Error("vêlage absent");
            Object.assign(draft.velage, data);
            return draft.velage;
          },
          delete: async ({ where }: { where: { id: string } }) => {
            if (!draft.velage || draft.velage.id !== where.id) throw new Error("vêlage absent");
            draft.details = draft.details.filter((detail) => detail.velageId !== where.id);
            draft.velage = null;
          },
        },
        animal: {
          findUnique: async ({ where }: { where: { id?: string; nutrav?: string } }) => draft.animals.find((animal) => animal.id === where.id || animal.nutrav === where.nutrav) ?? null,
          findFirst: async ({ where }: { where: { OR?: Array<{ numeroNational?: string; nunati?: string }> } }) => draft.animals.find((animal) => where.OR?.some((clause) => animal.numeroNational === clause.numeroNational || animal.nunati === clause.nunati)) ?? null,
          findMany: async () => draft.animals,
          update: async ({ where, data }: { where: { id: string }; data: Partial<AnimalRow> }) => {
            const animal = draft.animals.find((item) => item.id === where.id);
            if (!animal) throw new Error("animal absent");
            Object.assign(animal, data);
            return animal;
          },
          create: async ({ data }: { data: Omit<AnimalRow, "id" | "histories"> & { declarationsAdministratives?: { create: Omit<DeclarationRow, "id" | "animalId"> } } }) => {
            const nested = data.declarationsAdministratives;
            const animal = { ...data, id: `a${++nextAnimal}`, histories: [] } as AnimalRow & { declarationsAdministratives?: unknown };
            delete animal.declarationsAdministratives;
            draft.animals.push(animal);
            draft.animalCreates += 1;
            if (nested) draft.declarations.push({ ...nested.create, id: `dec${++nextDeclaration}`, animalId: animal.id });
            return animal;
          },
          delete: async ({ where }: { where: { id: string } }) => {
            if (draft.failOnAnimalDelete) throw new Error("échec suppression animal");
            draft.animals = draft.animals.filter((animal) => animal.id !== where.id);
          },
          deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
            if (draft.failOnAnimalDelete) throw new Error("échec suppression animal");
            draft.animals = draft.animals.filter((animal) => !where.id.in.includes(animal.id));
          },
        },
        veauVelage: {
          findMany: async () => draft.details,
          findFirst: async ({ where }: { where: { id?: { not?: string }; animalId?: string; nutrav?: string; nunati?: string } }) => draft.details.find((detail) => detail.id !== where.id?.not && (
            (where.animalId !== undefined && detail.animalId === where.animalId)
            || (where.nutrav !== undefined && detail.nutrav === where.nutrav)
            || (where.nunati !== undefined && detail.nunati === where.nunati)
          )) ?? null,
          update: async ({ where, data }: { where: { id: string }; data: Partial<DetailRow> }) => {
            const detail = draft.details.find((item) => item.id === where.id);
            if (!detail) throw new Error("détail absent");
            Object.assign(detail, data);
            return detail;
          },
          create: async ({ data }: { data: Omit<DetailRow, "id" | "createdAt"> }) => {
            const detail = { ...data, id: `d${++nextDetail}`, createdAt: new Date() };
            draft.details.push(detail);
            return detail;
          },
        },
        declarationAdministrative: {
          findFirst: async ({ where }: { where: { animalId: string; type: string } }) => draft.declarations.find((declaration) => declaration.animalId === where.animalId && declaration.type === where.type) ?? null,
          create: async ({ data }: { data: Omit<DeclarationRow, "id"> }) => {
            const declaration = { ...data, id: `dec${++nextDeclaration}` };
            draft.declarations.push(declaration);
            return declaration;
          },
          deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
            draft.declarations = draft.declarations.filter((declaration) => !where.id.in.includes(declaration.id));
          },
        },
        gestation: {
          updateMany: async ({ where, data }: { where: { id: string; etat: string }; data: { etat: string } }) => {
            if (draft.gestation?.id === where.id && draft.gestation.etat === where.etat) draft.gestation.etat = data.etat;
          },
        },
        exploitationConfig: { findUnique: async () => ({ serviceDeclaration: "AUCUN" }) },
        lotBoucles: {
          findFirst: async () => draft.lot?.actif ? draft.lot : null,
          update: async ({ data }: { data: Partial<NonNullable<State["lot"]>> }) => {
            if (draft.lot) Object.assign(draft.lot, data);
            return draft.lot;
          },
        },
      };
      const result = await work(tx);
      committed = draft;
      return result;
    },
  };
  return db;
}

async function fakeInspect(tx: unknown, animalId: string): Promise<AnimalDeletionInspection> {
  const state = (tx as { __state: State }).__state;
  const animal = state.animals.find((item) => item.id === animalId);
  if (!animal) throw new VelageEditError("Fiche veau introuvable", "NOT_FOUND");
  return {
    animalId,
    nutrav: animal.nutrav,
    blockages: animal.histories,
    removableDeclarationIds: state.declarations
      .filter((item) => item.animalId === animalId && item.type === "NAISSANCE" && item.statut === "A_DECLARER")
      .map((item) => item.id),
  };
}

function editInput(overrides: Partial<EditVelageInput> = {}): EditVelageInput {
  return {
    vacheNutrav: "1000",
    date: "2026-07-01",
    qualificatif: "NORMAL",
    sousType: "SEULE",
    veaux: [{ detailId: "d1", animalId: "a1", nutrav: "2001", nunati: "FR2001", nom: "Alpha", sexe: "F", statut: "VIVANT" }],
    ...overrides,
  };
}

test("modifie la date sur le même vêlage et les mêmes fiches vivantes", async () => {
  const seed = initialState();
  seed.animals.push({ ...seed.animals[0], id: "a2", nutrav: "2002", nunati: "FR2002", numeroNational: "FR2002", nobovi: "Beta", sexbov: "M", histories: [] });
  seed.details.push({ ...seed.details[0], id: "d2", animalId: "a2", nutrav: "2002", nunati: "FR2002", nom: "Beta", sexe: "M" });
  seed.velage!.nombreVeaux = 2;
  seed.velage!.jumeaux = true;
  const db = createDatabase(seed);
  await editVelage("v1", editInput({ date: "2026-07-03", veaux: [
    editInput().veaux[0],
    { detailId: "d2", animalId: "a2", nutrav: "2002", nunati: "FR2002", nom: "Beta", sexe: "M", statut: "VIVANT" },
  ] }), db as never, fakeInspect as never);
  assert.equal(db.state.velage?.id, "v1");
  assert.equal(db.state.velageCreates, 0);
  assert.deepEqual(db.state.animals.map((animal) => animal.id), ["a1", "a2"]);
  assert.ok(db.state.animals.every((animal) => animal.danais.toISOString().startsWith("2026-07-03")));
});

test("ajoute un jumeau mort-né sans fiche Animal", async () => {
  const db = createDatabase();
  await editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", sexe: "M", statut: "MORT_NE" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.animals.length, 1);
  assert.equal(db.state.details.length, 2);
  assert.equal(db.state.details[1].animalId, null);
  assert.equal(db.state.velage?.nombreVeaux, 2);
  assert.equal(db.state.velage?.jumeaux, true);
});

test("contrôle le numéro d’un mort-né sans jamais consommer de boucle", async () => {
  const seed = initialState();
  seed.lot = { id: "lot1", premierNunati: "FR2001", quantite: 10, prochainIndex: 1, actif: true, createdAt: new Date() };
  const db = createDatabase(seed);
  await editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", sexe: "M", statut: "MORT_NE" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.lot?.prochainIndex, 1);
  assert.equal(db.state.animals.length, 1);

  const duplicateSeed = initialState();
  duplicateSeed.animals.push({ ...duplicateSeed.animals[0], id: "a2", nutrav: "2002", nunati: "FR2002", numeroNational: "FR2002", histories: [] });
  const duplicateDb = createDatabase(duplicateSeed);
  await assert.rejects(
    editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", sexe: "M", statut: "MORT_NE" }] }), duplicateDb as never, fakeInspect as never),
    (error) => error instanceof VelageEditError && error.code === "CONFLICT",
  );
});

test("ajoute un jumeau vivant, conserve le premier et consomme une boucle une fois", async () => {
  const seed = initialState();
  seed.lot = { id: "lot1", premierNunati: "FR2001", quantite: 10, prochainIndex: 1, actif: true, createdAt: new Date() };
  const db = createDatabase(seed);
  await editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", sexe: "M", statut: "VIVANT" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.animals[0].id, "a1");
  assert.equal(db.state.animals.length, 2);
  assert.equal(db.state.animalCreates, 1);
  assert.equal(db.state.lot?.prochainIndex, 2);
  assert.equal(db.state.declarations.filter((item) => item.animalId === db.state.animals[1].id).length, 1);
});

test("réutilise une fiche compatible non liée sans doublon", async () => {
  const seed = initialState();
  seed.animals.push({ ...seed.animals[0], id: "a2", nutrav: "2002", nunati: "FR2002", numeroNational: "FR2002", nobovi: null, mereId: null, histories: [] });
  const db = createDatabase(seed);
  await editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", nom: "Beta", sexe: "M", statut: "VIVANT" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.animals.length, 2);
  assert.equal(db.state.animalCreates, 0);
  assert.equal(db.state.details[1].animalId, "a2");
  assert.equal(db.state.animals[1].mereId, "mere1");
  assert.equal(db.state.declarations.filter((item) => item.animalId === "a2").length, 1);
});

test("refuse une fiche existante incompatible et ne fusionne jamais deux animaux", async () => {
  const seed = initialState();
  seed.animals.push({ ...seed.animals[0], id: "a2", nutrav: "2002", nunati: "FR2002", numeroNational: "FR2002", mereId: "autre-mere", histories: [] });
  const db = createDatabase(seed);
  await assert.rejects(
    editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", sexe: "M", statut: "VIVANT" }] }), db as never, fakeInspect as never),
    (error) => error instanceof VelageEditError && error.code === "CONFLICT",
  );
  assert.equal(db.state.details.length, 1);
});

test("accepte les numéros actuels et modifie sexe, numéro et nom sans toucher aux historiques", async () => {
  const seed = initialState();
  seed.animals[0].histories = [{ category: "pesée(s)", count: 2 }, { category: "traitement(s)", count: 1 }];
  const db = createDatabase(seed);
  await editVelage("v1", editInput(), db as never, fakeInspect as never);
  await editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], nutrav: "2099", nunati: "FR2099", nom: "Nouveau", sexe: "M" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.animals[0].id, "a1");
  assert.equal(db.state.animals[0].nutrav, "2099");
  assert.equal(db.state.animals[0].nunati, "FR2099");
  assert.equal(db.state.animals[0].numeroNational, "FR2099");
  assert.equal(db.state.animals[0].sexbov, "M");
  assert.equal(db.state.animals[0].nobovi, "Nouveau");
  assert.equal(db.state.animals[0].histories.length, 2);
  assert.equal(db.state.details[0].nunati, "FR2099");
});

test("refuse un numéro de travail ou national utilisé ailleurs", async () => {
  const seed = initialState();
  seed.animals.push({ ...seed.animals[0], id: "a2", nutrav: "2099", nunati: "FR2099", numeroNational: "FR2099", histories: [] });
  const db = createDatabase(seed);
  await assert.rejects(
    editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], nutrav: "2099", nunati: "FR2099" }] }), db as never, fakeInspect as never),
    (error) => error instanceof VelageEditError && error.code === "CONFLICT",
  );
});

test("refuse le changement de mère et le passage en avortement avec un veau", async () => {
  const db = createDatabase();
  await assert.rejects(editVelage("v1", editInput({ vacheNutrav: "9999" }), db as never, fakeInspect as never), VelageEditError);
  await assert.rejects(editVelage("v1", editInput({ qualificatif: "AVORTEMENT", veaux: [] }), db as never, fakeInspect as never), VelageEditError);
});

test("normalise un ancien veauId et évite le doublon avec VeauVelage", () => {
  const state = initialState();
  const animal = state.animals[0];
  const detail = state.details[0];
  const source = { veau: animal, veauxDetails: [{ ...detail, animal }] };
  assert.equal(normalizeVelageCalves(source).length, 1);
  assert.equal(normalizeVelageCalves({ veau: animal, veauxDetails: [{ ...detail, statut: "MORT_NE", animal }] })[0].statut, "VIVANT");
  assert.equal(normalizeVelageCalves({ veau: animal, veauxDetails: [] })[0].detailId, null);
});

test("enregistre un ancien vêlage avec seulement veauId dans un unique VeauVelage", async () => {
  const seed = initialState();
  seed.details = [];
  const db = createDatabase(seed);
  await editVelage("v1", editInput({ veaux: [{ detailId: null, animalId: "a1", nutrav: "2001", nunati: "FR2001", nom: "Alpha", sexe: "F", statut: "VIVANT" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.details.length, 1);
  assert.equal(db.state.details[0].animalId, "a1");
  assert.equal(db.state.animals.length, 1);
});

test("interdit de retirer tout veau déjà enregistré", async () => {
  const seed = initialState();
  seed.details.push({ ...seed.details[0], id: "d2", animalId: null, nutrav: "2002", nunati: "FR2002", statut: "MORT_NE" });
  const db = createDatabase(seed);
  await assert.rejects(editVelage("v1", editInput(), db as never, fakeInspect as never), VelageEditError);
  assert.equal(db.state.details.length, 2);
});

test("transforme un mort-né en vivant dans le même détail", async () => {
  const seed = initialState();
  seed.velage!.veauId = null;
  seed.animals = [];
  seed.declarations = [];
  seed.details = [{ ...seed.details[0], animalId: null, statut: "MORT_NE" }];
  const db = createDatabase(seed);
  await editVelage("v1", editInput({ veaux: [{ detailId: "d1", animalId: null, nutrav: "2001", nunati: "FR2001", nom: "Alpha", sexe: "F", statut: "VIVANT" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.details.length, 1);
  assert.ok(db.state.details[0].animalId);
  assert.equal(db.state.animals.length, 1);
  assert.equal(db.state.declarations.length, 1);
});

test("transforme un vivant sans historique en mort-né et conserve le détail", async () => {
  const db = createDatabase();
  await editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], statut: "MORT_NE" }] }), db as never, fakeInspect as never);
  assert.equal(db.state.animals.length, 0);
  assert.equal(db.state.declarations.length, 0);
  assert.equal(db.state.details.length, 1);
  assert.equal(db.state.details[0].animalId, null);
  assert.equal(db.state.details[0].statut, "MORT_NE");
  assert.equal(db.state.velage?.veauId, null);
});

test("bloque vivant vers mort-né dès qu’un historique existe", async () => {
  const seed = initialState();
  seed.animals[0].histories = [{ category: "pesée(s)", count: 1 }];
  const db = createDatabase(seed);
  await assert.rejects(
    editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], statut: "MORT_NE" }] }), db as never, fakeInspect as never),
    (error) => error instanceof VelageEditError && /1 pesée/.test(error.message),
  );
  assert.equal(db.state.animals.length, 1);
  assert.equal(db.state.details[0].animalId, "a1");
});

test("annule entièrement une conversion vivant vers mort-né si la suppression échoue", async () => {
  const seed = initialState();
  seed.failOnAnimalDelete = true;
  const db = createDatabase(seed);
  const before = clone(db.state);
  await assert.rejects(editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], statut: "MORT_NE" }] }), db as never, fakeInspect as never));
  assert.deepEqual(db.state, before);
});

test("autorise la suppression atomique de tous les jumeaux sans historique", async () => {
  const seed = initialState();
  seed.animals.push({ ...seed.animals[0], id: "a2", nutrav: "2002", nunati: "FR2002", numeroNational: "FR2002", histories: [] });
  seed.details.push({ ...seed.details[0], id: "d2", animalId: "a2", nutrav: "2002", nunati: "FR2002" });
  seed.declarations.push({ id: "dec2", animalId: "a2", type: "NAISSANCE", statut: "A_DECLARER", service: "AUCUN" });
  seed.velage!.nombreVeaux = 2;
  seed.velage!.jumeaux = true;
  const db = createDatabase(seed);
  const preview = await deleteVelage("v1", db as never, fakeInspect as never);
  assert.equal(preview.allowed, true);
  assert.equal(preview.animalRecordsToDelete, 2);
  assert.equal(db.state.velage, null);
  assert.equal(db.state.animals.length, 0);
  assert.equal(db.state.details.length, 0);
  assert.equal(db.state.declarations.length, 0);
  assert.equal(db.state.gestation?.etat, "VERT");
  assert.equal(db.state.vache.id, "mere1");
});

test("ne réécrit pas une gestation dont l’état a changé depuis", async () => {
  const seed = initialState();
  seed.gestation!.etat = "ROSE";
  const db = createDatabase(seed);
  await deleteVelage("v1", db as never, fakeInspect as never);
  assert.equal(db.state.gestation?.etat, "ROSE");
});

test("bloque toute suppression si un veau possède pesée, soin, traitement ou sortie", async () => {
  for (const category of ["pesée(s)", "événement(s) sanitaire(s)", "traitement(s)", "sortie"]) {
    const seed = initialState();
    seed.animals[0].histories = [{ category, count: 1 }];
    const db = createDatabase(seed);
    await assert.rejects(deleteVelage("v1", db as never, fakeInspect as never), VelageEditError);
    assert.ok(db.state.velage);
    assert.equal(db.state.animals.length, 1);
  }
});

test("inventorie tous les autres historiques importants", () => {
  const facts: AnimalRemovalFacts = {
    nutrav: "2001",
    counts: {
      pesees: 1,
      evenements: 1,
      traitements: 1,
      vaccinations: 1,
      parages: 1,
      complementsAlim: 1,
      chaleurs: 1,
      saillies: 1,
      demandesEchographie: 1,
      velagesVache: 1,
      descendants: 1,
      ventes: 1,
      capteurs: 1,
    },
    hasSortie: true,
    otherBirthLinks: 1,
    protectedDeclarations: 1,
    removableBirthDeclarations: 1,
    hasOperationalState: true,
  };
  const categories = findRemovalBlockages(facts).map((item) => item.category);
  assert.equal(categories.length, 17);
  assert.ok(categories.includes("vaccination(s)"));
  assert.ok(categories.includes("parage(s)"));
  assert.ok(categories.includes("descendant(s)"));
  assert.ok(categories.includes("historique(s) de vente"));
  assert.ok(categories.includes("attribution(s) de capteur"));
  assert.ok(categories.includes("déclaration administrative transmise ou non supprimable"));
  assert.ok(categories.includes("donnée d’élevage ou de reproduction"));
});

test("annule entièrement une suppression si la dernière opération échoue", async () => {
  const seed = initialState();
  seed.failOnAnimalDelete = true;
  const db = createDatabase(seed);
  const before = clone(db.state);
  await assert.rejects(deleteVelage("v1", db as never, fakeInspect as never));
  assert.deepEqual(db.state, before);
});

test("l’édition ne crée aucun événement et la suppression ne force jamais danais à null", () => {
  const service = readFileSync(new URL("./velage-edit.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/velages/[id]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(service, /evenementSanitaire|api\/evenements/);
  assert.doesNotMatch(service, /danais:\s*null/);
  assert.doesNotMatch(service, /velage\.create/);
  assert.match(service, /db\.\$transaction/);
  assert.match(route, /export async function GET/);
  assert.match(route, /deleteVelage/);
});

test("les accès existent pour l’historique, la mère et le deuxième jumeau", () => {
  const history = readFileSync(new URL("../app/velage/page.tsx", import.meta.url), "utf8");
  const animal = readFileSync(new URL("../app/troupeau/[nutrav]/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/velage/VelageFormWrapper.tsx", import.meta.url), "utf8");
  assert.match(history, /modifier=\$\{velage\.id\}/);
  assert.match(animal, /animal\.velageVeau \?\? animal\.veauxVelage\[0\]\?\.velage/);
  assert.match(animal, /Voir le vêlage/);
  assert.match(animal, /VelageActions/);
  assert.match(form, /readOnly=\{editing\}/);
  assert.match(form, /Enregistrer les modifications/);
  assert.match(form, /Vêlage modifié/);
  assert.equal(existsSync(new URL("../app/troupeau/[nutrav]/LierVeauButton.tsx", import.meta.url)), false);
});

test("changer le vêlage à modifier remonte le formulaire prérempli et conserve le PATCH", () => {
  const page = readFileSync(new URL("../app/velage/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/velage/VelageFormWrapper.tsx", import.meta.url), "utf8");

  assert.match(page, /key=\{params\.modifier \?\? "nouveau"\}/);
  assert.match(page, /initialVelage=\{initialVelage\}/);
  assert.match(form, /useState\(initialVelage\?\.vacheNutrav \?\? initialMere\)/);
  assert.match(form, /useState\(initialVelage\?\.date\.slice\(0, 10\)/);
  assert.match(form, /useState<Veau\[\]>\(initialVelage\?\.veaux \?\?/);
  assert.match(form, /useState<Qualificatif>\(initialVelage\?\.qualificatif \?\?/);
  assert.match(form, /method: editing \? "PATCH" : "POST"/);
  assert.match(form, /`\/api\/velages\/\$\{initialVelage\.id\}`/);
  assert.match(form, /closeToOrigin\("\/velage"\)/);
});

test("le formulaire propose les prochaines vaches à vêler sans remplacer la saisie libre", () => {
  const page = readFileSync(new URL("../app/velage/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/velage/VelageFormWrapper.tsx", import.meta.url), "utf8");

  assert.match(page, /prochainesAVeler=\{gestationCalendar\.map/);
  assert.match(page, /dateVelagePrevue: row\.dateVelagePrevue\.toISOString\(\)/);
  assert.match(form, /Prochaines à vêler/);
  assert.match(form, /\.includes\(filtre\)/);
  assert.match(form, /\.slice\(0, 10\)/);
  assert.match(form, /onChange=\{\(e\) => \{ changerMere\(e\.target\.value\); setSuggestionsOpen\(true\); \}\}/);
  assert.match(form, /void chargerMere\(suggestion\.nutrav\)/);
  assert.match(form, /suggestion\.nobovi/);
  assert.match(form, /suggestion\.dateVelagePrevue/);
  assert.match(form, /setSuggestionsOpen\(false\)/);
});
