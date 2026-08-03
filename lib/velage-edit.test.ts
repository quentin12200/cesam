import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { editVelage, VelageEditError, type EditVelageInput } from "./velage-edit.ts";

type AnimalRow = {
  id: string; nutrav: string; nunati: string; numeroNational: string | null; nobovi: string | null;
  danais: Date; sexbov: string; mereId: string | null; histories: string[];
};
type DetailRow = {
  id: string; velageId: string; animalId: string | null; nutrav: string | null; nunati: string | null;
  nom: string | null; sexe: string | null; statut: string;
};
type State = {
  velage: { id: string; vacheId: string; veauId: string | null; date: Date; moment: string | null; qualificatif: string; sousType: string | null; capteur: number | null; pereNom: string | null; notes: string | null; nombreVeaux: number; jumeaux: boolean };
  vache: { id: string; nutrav: string };
  animals: AnimalRow[];
  details: DetailRow[];
  animalCreates: number;
  failAtVelageUpdate?: boolean;
};

function initialState(): State {
  return {
    velage: { id: "v1", vacheId: "mere1", veauId: "a1", date: new Date("2026-07-01T00:00:00.000Z"), moment: null, qualificatif: "NORMAL", sousType: "SEULE", capteur: null, pereNom: "Taureau", notes: null, nombreVeaux: 1, jumeaux: false },
    vache: { id: "mere1", nutrav: "1000" },
    animals: [{ id: "a1", nutrav: "2001", nunati: "FR2001", numeroNational: "FR2001", nobovi: "Alpha", danais: new Date("2026-07-01T00:00:00.000Z"), sexbov: "F", mereId: "mere1", histories: ["pesee-1", "soin-1"] }],
    details: [{ id: "d1", velageId: "v1", animalId: "a1", nutrav: "2001", nunati: "FR2001", nom: "Alpha", sexe: "F", statut: "VIVANT" }],
    animalCreates: 0,
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
      const assemble = () => ({
        ...draft.velage,
        vache: draft.vache,
        veau: draft.animals.find((animal) => animal.id === draft.velage.veauId) ?? null,
        veauxDetails: draft.details.filter((detail) => detail.velageId === draft.velage.id).map((detail) => ({ ...detail, animal: draft.animals.find((animal) => animal.id === detail.animalId) ?? null })),
      });
      const tx = {
        velage: {
          findUnique: async ({ where }: { where: { id: string } }) => where.id === draft.velage.id ? assemble() : null,
          findFirst: async ({ where }: { where: { veauId?: string; id?: { not?: string } } }) => draft.velage.veauId === where.veauId && draft.velage.id !== where.id?.not ? { id: draft.velage.id } : null,
          update: async ({ data }: { data: Partial<State["velage"]> }) => {
            if (draft.failAtVelageUpdate) throw new Error("échec final simulé");
            Object.assign(draft.velage, data);
            return draft.velage;
          },
        },
        animal: {
          findUnique: async ({ where }: { where: { id?: string; nutrav?: string } }) => draft.animals.find((animal) => animal.id === where.id || animal.nutrav === where.nutrav) ?? null,
          findFirst: async ({ where }: { where: { OR?: Array<{ numeroNational?: string; nunati?: string }> } }) => draft.animals.find((animal) => where.OR?.some((clause) => animal.numeroNational === clause.numeroNational || animal.nunati === clause.nunati)) ?? null,
          update: async ({ where, data }: { where: { id: string }; data: Partial<AnimalRow> }) => {
            const animal = draft.animals.find((item) => item.id === where.id);
            if (!animal) throw new Error("animal absent");
            Object.assign(animal, data);
            return animal;
          },
          create: async ({ data }: { data: Omit<AnimalRow, "id" | "histories"> & { declarationsAdministratives?: unknown } }) => {
            const animal: AnimalRow = { ...data, id: `a${++nextAnimal}`, histories: [] };
            delete (animal as AnimalRow & { declarationsAdministratives?: unknown }).declarationsAdministratives;
            draft.animals.push(animal);
            draft.animalCreates += 1;
            return animal;
          },
        },
        veauVelage: {
          findFirst: async ({ where }: { where: { id?: { not?: string }; animalId?: string; nutrav?: string; nunati?: string } }) => draft.details.find((detail) => detail.id !== where.id?.not && ((where.animalId && detail.animalId === where.animalId) || (where.nutrav && detail.nutrav === where.nutrav) || (where.nunati && detail.nunati === where.nunati))) ?? null,
          deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { draft.details = draft.details.filter((detail) => !where.id.in.includes(detail.id)); },
          update: async ({ where, data }: { where: { id: string }; data: Partial<DetailRow> }) => {
            const detail = draft.details.find((item) => item.id === where.id);
            if (!detail) throw new Error("détail absent");
            Object.assign(detail, data);
            return detail;
          },
          create: async ({ data }: { data: Omit<DetailRow, "id"> }) => {
            const detail = { ...data, id: `d${++nextDetail}` };
            draft.details.push(detail);
            return detail;
          },
        },
        exploitationConfig: { findUnique: async () => ({ serviceDeclaration: "AUCUN" }) },
        lotBoucles: { findFirst: async () => null, update: async () => null },
      };
      const result = await work(tx);
      committed = draft;
      return result;
    },
  };
  return db;
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

test("corrige la date sans recréer le vêlage ni la fiche du premier veau", async () => {
  const db = createDatabase();
  await editVelage("v1", editInput({ date: "2026-07-03" }), db as never);
  assert.equal(db.state.velage.id, "v1");
  assert.equal(db.state.velage.date.toISOString().slice(0, 10), "2026-07-03");
  assert.equal(db.state.animals[0].id, "a1");
  assert.equal(db.state.animals[0].danais.toISOString().slice(0, 10), "2026-07-03");
  assert.equal(db.state.animalCreates, 0);
});

test("ajoute un jumeau mort-né sans créer de fiche Animal", async () => {
  const db = createDatabase();
  await editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", nom: "Beta", sexe: "M", statut: "MORT_NE" }] }), db as never);
  assert.equal(db.state.details.length, 2);
  assert.equal(db.state.details[1].statut, "MORT_NE");
  assert.equal(db.state.details[1].animalId, null);
  assert.equal(db.state.animals.length, 1);
  assert.equal(db.state.velage.jumeaux, true);
});

test("ajoute un jumeau vivant atomiquement sans toucher au premier", async () => {
  const db = createDatabase();
  await editVelage("v1", editInput({ veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", nom: "Beta", sexe: "M", statut: "VIVANT" }] }), db as never);
  assert.equal(db.state.animals.length, 2);
  assert.equal(db.state.animals[0].id, "a1");
  assert.equal(db.state.animals[1].mereId, "mere1");
  assert.equal(db.state.details[1].animalId, db.state.animals[1].id);
});

test("retire uniquement un détail mort-né et conserve la fiche vivante", async () => {
  const seed = initialState();
  seed.details.push({ id: "d2", velageId: "v1", animalId: null, nutrav: "2002", nunati: "FR2002", nom: null, sexe: "M", statut: "MORT_NE" });
  seed.velage.nombreVeaux = 2;
  seed.velage.jumeaux = true;
  const db = createDatabase(seed);
  await editVelage("v1", editInput(), db as never);
  assert.deepEqual(db.state.details.map((detail) => detail.id), ["d1"]);
  assert.equal(db.state.animals[0].id, "a1");
});

test("refuse de transformer une fiche Animal existante en mort-né", async () => {
  const db = createDatabase();
  await assert.rejects(
    editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], statut: "MORT_NE" }] }), db as never),
    (error) => error instanceof VelageEditError && error.code === "UNSAFE",
  );
});

test("modifie sexe, numéro et nom sur la fiche existante en conservant ses historiques", async () => {
  const db = createDatabase();
  await editVelage("v1", editInput({ veaux: [{ detailId: "d1", animalId: "a1", nutrav: "2099", nunati: "FR2099", nom: "Nouveau", sexe: "M", statut: "VIVANT" }] }), db as never);
  assert.deepEqual(db.state.animals[0].histories, ["pesee-1", "soin-1"]);
  assert.equal(db.state.animals[0].id, "a1");
  assert.equal(db.state.animals[0].nutrav, "2099");
  assert.equal(db.state.animals[0].sexbov, "M");
  assert.equal(db.state.animals[0].nobovi, "Nouveau");
});

test("refuse un numéro utilisé par une autre fiche", async () => {
  const seed = initialState();
  seed.animals.push({ ...seed.animals[0], id: "a2", nutrav: "2099", nunati: "FR2099", numeroNational: "FR2099", histories: [] });
  const db = createDatabase(seed);
  await assert.rejects(
    editVelage("v1", editInput({ veaux: [{ ...editInput().veaux[0], nutrav: "2099", nunati: "FR2099" }] }), db as never),
    (error) => error instanceof VelageEditError && error.code === "CONFLICT",
  );
});

test("refuse toujours le changement de mère", async () => {
  const db = createDatabase();
  await assert.rejects(
    editVelage("v1", editInput({ vacheNutrav: "9999" }), db as never),
    (error) => error instanceof VelageEditError && error.code === "UNSAFE",
  );
});

test("annule toute la transaction lorsque la dernière mise à jour échoue", async () => {
  const seed = initialState();
  seed.failAtVelageUpdate = true;
  const db = createDatabase(seed);
  const before = clone(db.state);
  await assert.rejects(editVelage("v1", editInput({ date: "2026-07-03", veaux: [...editInput().veaux, { nutrav: "2002", nunati: "FR2002", sexe: "M", statut: "VIVANT" }] }), db as never));
  assert.deepEqual(db.state, before);
});

test("les accès d’édition existent et la suppression dangereuse n’est plus exposée", () => {
  const history = readFileSync(new URL("../app/velage/page.tsx", import.meta.url), "utf8");
  const animal = readFileSync(new URL("../app/troupeau/[nutrav]/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/velage/VelageFormWrapper.tsx", import.meta.url), "utf8");
  assert.match(history, /modifier=\$\{velage\.id\}/);
  assert.match(animal, /modifier=\$\{velage\.id\}/);
  assert.match(animal, /Voir le vêlage/);
  assert.match(form, /readOnly=\{editing\}/);
  assert.match(form, /La mère ne peut pas encore être modifiée/);
  assert.match(form, /Vêlage modifié/);
  assert.match(form, /initialVelage\?\.veaux/);
  assert.match(form, /initialVelage\?\.date/);
  assert.match(history, /initialVelage=\{initialVelage\}/);
  assert.doesNotMatch(history, /method:\s*["']DELETE["']/);
  assert.doesNotMatch(animal.slice(animal.indexOf("Historique vélages")), /api\/velages\/\$\{velage\.id\}/);
  assert.equal(existsSync(new URL("../app/troupeau/[nutrav]/LierVeauButton.tsx", import.meta.url)), false);
});

test("la modification ne crée aucun événement sanitaire automatique", () => {
  const form = readFileSync(new URL("../app/velage/VelageFormWrapper.tsx", import.meta.url), "utf8");
  assert.match(form, /!editing && qualificatif === "DIFFICILE"/);
  const route = readFileSync(new URL("../app/api/velages/[id]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /evenementSanitaire|api\/evenements/);
  assert.doesNotMatch(route, /velage\.create/);
  const service = readFileSync(new URL("./velage-edit.ts", import.meta.url), "utf8");
  assert.match(service, /db\.\$transaction/);
});
