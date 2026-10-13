import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { preparerConversionProtocole, type EtapeProtocoleExistante } from "./vaccine-protocol-name.ts";
import { etapeIdsConfigurationQuestionnaire, lireConfigurationQuestionnaire, type ConfigurationQuestionnaireV1 } from "./vaccine-protocol-questionnaire.ts";

test("la configuration CRYPTIUM Primo, Rappel et Entretien avant vêlage est valide", () => {
  const configuration: ConfigurationQuestionnaireV1 = {
    version: 1,
    medicamentId: "med-cryptium",
    cible: { tousBovins: false, categories: ["GENISSE", "VACHE"] },
    demarrage: {
      type: "PRIMO_RAPPEL",
      etapePrimoId: "cryptium-primo",
      etapeRappelId: "cryptium-rappel",
      calendrierPrimo: {
        type: "AVANT_VELAGE",
        debutAvant: { valeur: 3, unite: "MOIS" },
        finAvant: { valeur: 3, unite: "SEMAINE" },
      },
      rappel: {
        type: "DELAI_FIXE",
        delai: { valeur: 28, unite: "JOUR" },
        preconisationPrimoId: "precon-sc-2ml",
        preconisationRappelId: "precon-sc-2ml",
        resterDansFenetrePrimo: true,
      },
    },
    entretien: {
      actif: true,
      etapeId: "cryptium-entretien",
      preconisationId: "precon-sc-2ml",
      calendrier: {
        type: "AVANT_VELAGE",
        debutAvant: { valeur: 3, unite: "MOIS" },
        finAvant: { valeur: 3, unite: "SEMAINE" },
      },
    },
  };

  const lue = lireConfigurationQuestionnaire(JSON.stringify(configuration));
  assert.deepEqual(lue, configuration);
  assert.deepEqual(etapeIdsConfigurationQuestionnaire(configuration), ["cryptium-primo", "cryptium-rappel", "cryptium-entretien"]);
});

const idsDemandes = { dose: null, primo: "nouvelle-primo", rappel: "nouveau-rappel", entretien: "nouvel-entretien" };
const etape = (id: string, label: string, cycle = "INITIAL", vaccinationsCount = 0, traitementsCount = 0): EtapeProtocoleExistante => ({ id, label, cycle, vaccinationsCount, traitementsCount });

test("un conflit de nom ne génère jamais de protocole suffixé", () => {
  const route = readFileSync(new URL("../app/api/protocoles/route.ts", import.meta.url), "utf8");
  const questionnaire = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(route, /code: "PROTOCOLE_EXISTANT"/);
  assert.doesNotMatch(route, /nomInterne.*_[23]/);
  assert.doesNotMatch(questionnaire, /nomProtocoleDisponible/);
});

test("un protocole existant sans historique peut être converti", () => {
  assert.deepEqual(preparerConversionProtocole([
    etape("ancienne-primo", "Primo"),
    etape("ancien-rappel", "Rappel"),
  ], idsDemandes), {
    possible: true,
    ids: { ...idsDemandes, primo: "ancienne-primo", rappel: "ancien-rappel" },
  });
});

test("les IDs Primo et Rappel déjà utilisés sont conservés", () => {
  assert.deepEqual(preparerConversionProtocole([
    etape("primo-historique", "Primo", "INITIAL", 1),
    etape("rappel-historique", "Rappel", "INITIAL", 0, 2),
  ], idsDemandes), {
    possible: true,
    ids: { ...idsDemandes, primo: "primo-historique", rappel: "rappel-historique" },
  });
});

test("une ambiguïté historique bloque la conversion", () => {
  const conversion = preparerConversionProtocole([
    etape("historique-1", "Injection 1", "INITIAL", 1),
  ], idsDemandes);
  assert.equal(conversion.possible, false);
  assert.match(conversion.possible ? "" : conversion.raison, /ne peut pas être associée de façon sûre/);
});

test("l’interface affiche l’erreur du POST et libère toujours l’enregistrement", () => {
  const source = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(source, /const \[erreurEnregistrement, setErreurEnregistrement\] = useState\(""\)/);
  assert.match(source, /const erreur = await response\.json\(\) as \{ error\?: unknown; code\?: unknown; protocole\?: ConflitProtocole; diagnostic\?: DiagnosticExtraction \}/);
  assert.match(source, /setErreurEnregistrement\(typeof erreur\.error === "string"/);
  assert.match(source, /finally \{ setSaving\(false\); \}/);
  assert.match(source, /role="alert"/);
  assert.match(source, />Mettre à jour ce protocole \?<\/button>/);
});

test("l’API ne présente comme doublon de nom que la vraie erreur Prisma P2002 sur nom", () => {
  const source = readFileSync(new URL("../app/api/protocoles/route.ts", import.meta.url), "utf8");
  assert.match(source, /error instanceof Prisma\.PrismaClientKnownRequestError/);
  assert.match(source, /error\.code === "P2002"/);
  assert.match(source, /cibleErreurUniqueContientNom\(error\.meta\)/);
  assert.match(source, /Le protocole n’a pas pu être enregistré/);
});

test("la conversion ne supprime aucun acte Vaccination ou Traitement", () => {
  const routePost = readFileSync(new URL("../app/api/protocoles/route.ts", import.meta.url), "utf8");
  const routePatch = readFileSync(new URL("../app/api/protocoles/[id]/route.ts", import.meta.url), "utf8");
  assert.match(routePost, /vaccinationsCount: etape\._count\.vaccinations/);
  assert.match(routePost, /traitementsCount: etape\._count\.traitements/);
  assert.match(routePatch, /aRetirer\.some\(\(etape\) => etape\._count\.vaccinations > 0 \|\| etape\._count\.traitements > 0\)/);
  assert.match(routePatch, /Une étape déjà utilisée ne peut pas être supprimée/);
});
