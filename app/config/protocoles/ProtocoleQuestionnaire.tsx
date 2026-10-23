"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Pencil, Plus, X } from "lucide-react";
import type { ConfigurationQuestionnaireV1, DureeQuestionnaire, RegleTemporelleQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";
import { lireConfigurationQuestionnaire, preconisationAutomatique } from "@/lib/vaccine-protocol-questionnaire";
import { resumeFriseQuestionnaire } from "@/lib/vaccine-questionnaire-timeline";
import { classerAdministrations } from "@/lib/vaccine-questionnaire-administration";
import { previsualiserLimiteAge, type AnimalApercuAge } from "@/lib/vaccine-age-preview";
import { resumeCibleQuestionnaire, sexeImplicite, texteDureeQuestionnaire, texteFenetreAvantVelage } from "@/lib/vaccine-questionnaire-presentation";
import { basculerCategorieVaccinale, categorieVaccinaleSelectionnee, FAMILLES_CATEGORIES } from "@/lib/vaccine-category-selection";
import { comparerPopulationCible, type CibleComparaison } from "@/lib/vaccine-category-impact";
import CategoriesProtocoleHistorique from "./CategoriesProtocoleHistorique";

type Preconisation = { id: string; dose: number | null; unite: string | null; doseBase: string | null; voie: string | null; categorieAnimaux: string | null; agePoidsConcerne: string | null; statut: string };
type Medicament = { id: string; nom: string; voie: string | null; preconisations: Preconisation[] };
type Protocole = { id: string; nom: string; label: string; actif: boolean; description: string | null; categoriesJson: string | null; configurationQuestionnaireJson: string | null; sexeCible: string | null; gestante: boolean | null; rangVelageMin: number | null; rangVelageMax: number | null; lotCible: string | null };
type ConflitProtocole = {
  id: string; nom: string; label: string; configurationQuestionnairePresente: boolean; memeVaccin: boolean;
  etapes: Array<{ id: string; label: string; cycle: string; vaccinationsCount: number; traitementsCount: number }>;
  conversion: { possible: boolean; raison?: string; ids?: { dose: string | null; primo: string | null; rappel: string | null; entretien: string | null } };
  extraction?: { possible: boolean; medicamentId: string; medicamentNom: string; vaccinationsCount: number; traitementsCount: number; raison?: string; empreinte?: string | null; bilan?: { vaccinationsDeplacees: number; traitementsDeplaces: number; vaccinationsGeneriquesNeutralisees: number; traitementsDoublonsDetaches: number; statutsAnimauxRecalcules: number; statutsAvecDecisionOuNoteAProteger: number; animauxAvecHistorique: number } | null };
};
type DiagnosticExtraction = {
  totalAmbigus: number;
  repartition: Array<{
    cause: string;
    libelle: string;
    nombre: number;
    exemples: Array<{ acteId: string; animalId: string; nutrav: string | null; date: string | null; ancienneEtape: { label: string | null } | null }>;
  }>;
};
type ActionConflit =
  | { type: "CONVERSION"; id: string; ids: NonNullable<ConflitProtocole["conversion"]["ids"]> }
  | { type: "EXTRACTION"; id: string; empreinte: string }
  | { type: "NOUVEAU_SANS_REPRISE" };
type Form = {
  nom: string; label: string; description: string; medicamentId: string; ageMaxDemarrage: DureeQuestionnaire | null; demarrageChoisi: boolean; tous: boolean; categories: string[]; sexeCible: string; gestante: string; rangVelageMin: string; rangVelageMax: string; lotCible: string;
  type: "DOSE_UNIQUE" | "PRIMO_RAPPEL"; calendrier: RegleTemporelleQuestionnaire; calendrierChoisi: boolean;
  conditionnel: boolean; rappelDefini: boolean; initialTermine: boolean; delai: DureeQuestionnaire; seuil: DureeQuestionnaire; resterDansFenetre: boolean;
  preconPrimo: string; preconRappel: string;
  avant: { id: string; primo: string; delai: DureeQuestionnaire; rappel: string };
  apres: { id: string; primo: string; delai: DureeQuestionnaire; rappel: string };
  entretien: boolean; entretienChoisi: boolean; typeEntretienChoisi: boolean; typeEntretien: "APRES_DELAI" | "AVANT_VELAGE" | "MOIS_ANNUELS";
  premier: DureeQuestionnaire; recurrence: DureeQuestionnaire; fenetreEntretien: Extract<RegleTemporelleQuestionnaire, { type: "AVANT_VELAGE" }>; moisEntretien: number[]; preconEntretien: string;
  ids: { dose: string; primo: string; rappel: string; entretien: string };
};
type AdministrationForm = { voie: string; dose: string; unite: string; doseBase: string; condition: string };

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const d = (valeur: number, unite: DureeQuestionnaire["unite"] = "JOUR"): DureeQuestionnaire => ({ valeur, unite });
const id = (prefixe: string) => `${prefixe}-${crypto.randomUUID()}`;
const fenetreVelage = (): Extract<RegleTemporelleQuestionnaire, { type: "AVANT_VELAGE" }> => ({ type: "AVANT_VELAGE", debutAvant: d(3, "MOIS"), finAvant: d(3, "SEMAINE") });
const vide = (): Form => ({
  nom: "", label: "", description: "", medicamentId: "", ageMaxDemarrage: null, demarrageChoisi: false, tous: true, categories: [], sexeCible: "", gestante: "", rangVelageMin: "", rangVelageMax: "", lotCible: "", type: "DOSE_UNIQUE", calendrier: { type: "SANS_REGLE" }, calendrierChoisi: false,
  conditionnel: false, rappelDefini: false, initialTermine: false, delai: d(28), seuil: d(2.5, "MOIS"), resterDansFenetre: false, preconPrimo: "", preconRappel: "",
  avant: { id: id("avant-seuil"), primo: "", delai: d(8, "SEMAINE"), rappel: "" }, apres: { id: id("apres-seuil"), primo: "", delai: d(4, "SEMAINE"), rappel: "" },
  entretien: false, entretienChoisi: false, typeEntretienChoisi: false, typeEntretien: "APRES_DELAI", premier: d(6, "MOIS"), recurrence: d(6, "MOIS"), fenetreEntretien: fenetreVelage(), moisEntretien: [], preconEntretien: "",
  ids: { dose: id("dose"), primo: id("primo"), rappel: id("rappel"), entretien: id("entretien") },
});
const textePrecon = (p?: Preconisation) => p ? `${p.voie || "Voie à renseigner"} · ${p.dose == null ? "Dose à renseigner" : `${p.dose} ${p.unite || ""}`}` : "Préconisation à choisir";
const administrationVide = (medicament?: Medicament, preconisation?: Preconisation): AdministrationForm => ({
  voie: preconisation?.voie ?? medicament?.voie ?? "",
  dose: preconisation?.dose == null ? "" : String(preconisation.dose),
  unite: preconisation?.unite ?? "ml",
  doseBase: preconisation?.doseBase ?? "ANIMAL",
  condition: preconisation?.agePoidsConcerne ?? "",
});
const completerPreconisationsVides = (form: Form, preconisationId: string): Form => ({
  ...form,
  preconPrimo: form.preconPrimo || preconisationId,
  preconRappel: form.preconRappel || preconisationId,
  preconEntretien: form.preconEntretien || preconisationId,
  avant: { ...form.avant, primo: form.avant.primo || preconisationId, rappel: form.avant.rappel || preconisationId },
  apres: { ...form.apres, primo: form.apres.primo || preconisationId, rappel: form.apres.rappel || preconisationId },
});
const dateDiagnostic = (date: string | null) => {
  if (!date) return "Date inconnue";
  const valeur = new Date(date);
  return Number.isNaN(valeur.getTime()) ? "Date inconnue" : valeur.toLocaleDateString("fr-FR");
};

function Choix({ actif, children, onClick }: { actif: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={actif} onClick={onClick} className={`min-h-14 rounded-xl border-2 px-3 text-left text-sm font-semibold ${actif ? "border-green-700 bg-green-50 text-green-950" : "border-gray-200 bg-white"}`}>{children}</button>;
}
function Duree({ value, onChange, decimal = false }: { value: DureeQuestionnaire; onChange: (value: DureeQuestionnaire) => void; decimal?: boolean }) {
  return <div className="mt-1 grid grid-cols-2 gap-2"><input aria-label="Valeur" type="number" min="0" step={decimal ? ".1" : "1"} value={value.valeur} onChange={(e) => onChange({ ...value, valeur: Number(e.target.value) })} className="min-h-11 rounded-lg border px-3" /><select aria-label="Unité" value={value.unite} onChange={(e) => onChange({ ...value, unite: e.target.value as DureeQuestionnaire["unite"] })} className="min-h-11 rounded-lg border px-3"><option value="JOUR">jours</option><option value="SEMAINE">semaines</option><option value="MOIS">mois</option></select></div>;
}
function Precon({ med, value, onChange, titre }: { med: Medicament; value: string; onChange: (id: string) => void; titre: string }) {
  if (med.preconisations.length === 1) return <p className="rounded-lg bg-blue-50 p-3 text-sm"><b>{titre}</b><br />{textePrecon(med.preconisations[0])}</p>;
  return <label className="block text-sm font-medium">{titre}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-2"><option value="">Choisir une préconisation validée</option>{med.preconisations.map((p) => <option key={p.id} value={p.id}>{textePrecon(p)}{p.categorieAnimaux ? ` · ${p.categorieAnimaux}` : ""}</option>)}</select></label>;
}
function Mois({ value, onChange }: { value: number[]; onChange: (value: number[]) => void }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{MOIS.map((label, index) => { const numero = index + 1; return <Choix key={label} actif={value.includes(numero)} onClick={() => onChange(value.includes(numero) ? value.filter((item) => item !== numero) : [...value, numero].sort((a, b) => a - b))}>{label}</Choix>; })}</div>;
}

function Frise({ form, med }: { form: Form; med?: Medicament }) {
  if (!med) return null;
  const resume = resumeFriseQuestionnaire(form.demarrageChoisi ? form.type : null, {
    rappelDefini: form.initialTermine,
    initialTermine: form.initialTermine,
    entretienDefini: form.entretienChoisi && form.entretien,
  });
  const fenetreEntretien = form.typeEntretienChoisi && form.typeEntretien === "AVANT_VELAGE";
  return <aside className="rounded-2xl border border-green-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold uppercase text-green-800">Frise en direct</p><p className="mt-2 font-semibold text-gray-900">{med.nom}</p>{resume.etapesInitiales.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><b className="rounded-full bg-green-100 px-3 py-2">{resume.etapesInitiales[0]}</b>{resume.etapesInitiales.length > 1 && <><span>→{resume.afficherDelaiRappel ? ` ${form.conditionnel ? "selon l’âge à la Primo" : texteDureeQuestionnaire(form.delai)} →` : ""}</span><b className="rounded-full bg-green-100 px-3 py-2">{resume.etapesInitiales[1]}</b></>}</div>}{form.initialTermine && form.conditionnel && form.type === "PRIMO_RAPPEL" && <div className="mt-3 grid gap-2 text-xs"><p className="rounded-lg bg-gray-50 p-2"><b>Avant {texteDureeQuestionnaire(form.seuil)}</b> : {textePrecon(med.preconisations.find((p) => p.id === form.avant.primo))} → {texteDureeQuestionnaire(form.avant.delai)} → {textePrecon(med.preconisations.find((p) => p.id === form.avant.rappel))}</p><p className="rounded-lg bg-gray-50 p-2"><b>À partir de {texteDureeQuestionnaire(form.seuil)}</b> : {textePrecon(med.preconisations.find((p) => p.id === form.apres.primo))} → {texteDureeQuestionnaire(form.apres.delai)} → {textePrecon(med.preconisations.find((p) => p.id === form.apres.rappel))}</p></div>}{resume.initialTermine && <p className="mt-3 text-xs font-semibold text-green-800">✓ Protocole initial configuré</p>}{resume.entretien && <div className="mt-3 border-t pt-3 text-sm"><p>↓</p>{fenetreEntretien && <p className="font-semibold text-purple-900">À chaque prochaine gestation</p>}<b className="mt-1 inline-block rounded-full bg-purple-100 px-3 py-2 text-purple-900">Entretien</b>{fenetreEntretien && <p className="mt-1 text-xs text-purple-900">{texteDureeQuestionnaire(form.fenetreEntretien.debutAvant)} → {texteDureeQuestionnaire(form.fenetreEntretien.finAvant)} avant vêlage</p>}</div>}</aside>;
}

function ResumeFinal({ form, med }: { form: Form; med: Medicament }) {
  const unique = preconisationAutomatique(med.preconisations) ?? "";
  const administration = (preconisationId: string) => textePrecon(med.preconisations.find((preconisation) => preconisation.id === (preconisationId || unique)));
  const fenetreInitiale = form.calendrier.type === "AVANT_VELAGE" ? texteFenetreAvantVelage(form.calendrier) : null;
  return <div className="space-y-4 rounded-xl bg-white p-4 text-sm"><p className="text-gray-700">{form.tous && form.gestante === "true" ? "Tous les animaux gestants, sans restriction de catégorie (y compris grandes génisses et femelles à engraisser)." : resumeCibleQuestionnaire(form.tous, form.categories)}</p><div><b className="text-green-800">PROTOCOLE INITIAL</b>{form.type === "DOSE_UNIQUE" ? <p className="mt-1"><b>Dose unique</b> — {administration(form.preconPrimo)}</p> : form.conditionnel ? <div className="mt-1 space-y-1"><p>Deux parcours selon l’âge au moment de la Primo :</p><p><b>Avant {texteDureeQuestionnaire(form.seuil)}</b> — Primo {administration(form.avant.primo)}, puis Rappel {texteDureeQuestionnaire(form.avant.delai)} après — {administration(form.avant.rappel)}</p><p><b>À partir de {texteDureeQuestionnaire(form.seuil)}</b> — Primo {administration(form.apres.primo)}, puis Rappel {texteDureeQuestionnaire(form.apres.delai)} après — {administration(form.apres.rappel)}</p></div> : <div className="mt-1 space-y-1"><p><b>Primo</b> — {administration(form.preconPrimo)}</p><p><b>Rappel</b> — {administration(form.preconRappel)}, {texteDureeQuestionnaire(form.delai)} après la Primo</p></div>}{fenetreInitiale && <p className="mt-2">{form.type === "DOSE_UNIQUE" ? "La dose doit être réalisée" : "La Primo et le Rappel doivent être réalisés"}<br />{fenetreInitiale}.</p>}{form.calendrier.type === "AGE_MINIMUM" && <p className="mt-2">À partir de {texteDureeQuestionnaire(form.calendrier.age)}.</p>}{form.calendrier.type === "MOIS_ANNUELS" && <p className="mt-2">À une période particulière de l’année : {form.calendrier.mois.map((numero) => MOIS[numero - 1]).join(", ")}.</p>}</div><div><b className="text-purple-800">ENTRETIEN</b>{!form.entretien ? <p className="mt-1">Aucun entretien.</p> : <div className="mt-1 space-y-1">{form.typeEntretien === "AVANT_VELAGE" && <p><b>À chaque prochaine gestation :</b></p>}<p><b>1 dose</b> — {administration(form.preconEntretien)}</p>{form.typeEntretien === "APRES_DELAI" && <p>Premier entretien {texteDureeQuestionnaire(form.premier)} après le protocole initial, puis tous les {texteDureeQuestionnaire(form.recurrence)}.</p>}{form.typeEntretien === "AVANT_VELAGE" && <p>{texteFenetreAvantVelage(form.fenetreEntretien)}.</p>}{form.typeEntretien === "MOIS_ANNUELS" && <p>À une période particulière de l’année : {form.moisEntretien.map((numero) => MOIS[numero - 1]).join(", ")}.</p>}</div>}</div></div>;
}

function construire(form: Form, med: Medicament) {
  const unique = preconisationAutomatique(med.preconisations) ?? "";
  const primo = form.preconPrimo || unique, rappel = form.preconRappel || unique, entretien = form.preconEntretien || unique;
  const lien = (preconisationId: string) => [{ medicamentId: med.id, preconisationId }];
  const etapes = form.type === "DOSE_UNIQUE"
    ? [{ id: form.ids.dose, label: "Dose unique", cycle: "INITIAL", medicaments: lien(primo) }]
    : [{ id: form.ids.primo, label: "Primo", cycle: "INITIAL", medicaments: lien(primo) }, { id: form.ids.rappel, label: "Rappel", cycle: "INITIAL", medicaments: lien(rappel) }];
  if (form.entretien) etapes.push({ id: form.ids.entretien, label: "Entretien", cycle: "ENTRETIEN", medicaments: lien(entretien) });
  const configuration: ConfigurationQuestionnaireV1 = {
    version: 1, medicamentId: med.id, ...(form.ageMaxDemarrage ? { ageMaxDemarrage: form.ageMaxDemarrage } : {}), cible: { tousBovins: form.tous, categories: form.tous ? [] : form.categories },
    demarrage: form.type === "DOSE_UNIQUE" ? { type: "DOSE_UNIQUE", etapeDoseId: form.ids.dose, preconisationId: primo, calendrier: form.calendrier } : {
      type: "PRIMO_RAPPEL", etapePrimoId: form.ids.primo, etapeRappelId: form.ids.rappel, calendrierPrimo: form.calendrier,
      rappel: form.conditionnel ? { type: "BRANCHES_AGE_PRIMO", seuilAgePrimo: form.seuil, resterDansFenetrePrimo: form.resterDansFenetre, branches: [
        { id: form.avant.id, position: "AVANT_SEUIL", preconisationPrimoId: form.avant.primo || unique, delaiRappel: form.avant.delai, preconisationRappelId: form.avant.rappel || unique },
        { id: form.apres.id, position: "A_PARTIR_SEUIL", preconisationPrimoId: form.apres.primo || unique, delaiRappel: form.apres.delai, preconisationRappelId: form.apres.rappel || unique },
      ] } : { type: "DELAI_FIXE", delai: form.delai, preconisationPrimoId: primo, preconisationRappelId: rappel, resterDansFenetrePrimo: form.resterDansFenetre },
    },
    entretien: !form.entretien ? { actif: false } : { actif: true, etapeId: form.ids.entretien, preconisationId: entretien, calendrier: form.typeEntretien === "APRES_DELAI" ? { type: "APRES_DELAI", premierDelai: form.premier, recurrence: form.recurrence } : form.typeEntretien === "AVANT_VELAGE" ? form.fenetreEntretien : { type: "MOIS_ANNUELS", mois: form.moisEntretien } },
  };
  return { configuration, etapes };
}

export default function ProtocoleQuestionnaire({ protocoles, medicaments, apercuAgeAnimaux }: { protocoles: Protocole[]; medicaments: Medicament[]; apercuAgeAnimaux: AnimalApercuAge[] }) {
  const router = useRouter();
  const [medicamentsDisponibles, setMedicamentsDisponibles] = useState(medicaments);
  const [form, setForm] = useState<Form>(vide);
  const [page, setPage] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changementActifId, setChangementActifId] = useState<string | null>(null);
  const [erreurActivation, setErreurActivation] = useState("");
  const [erreurEnregistrement, setErreurEnregistrement] = useState("");
  const [conflitProtocole, setConflitProtocole] = useState<ConflitProtocole | null>(null);
  const [diagnosticExtraction, setDiagnosticExtraction] = useState<DiagnosticExtraction | null>(null);
  const [confirmationImpactAge, setConfirmationImpactAge] = useState("");
  const [confirmationImpactCible, setConfirmationImpactCible] = useState("");
  const [administrationOuverte, setAdministrationOuverte] = useState(false);
  const [administrationSaving, setAdministrationSaving] = useState(false);
  const [administrationErreur, setAdministrationErreur] = useState("");
  const [preconisationEditionId, setPreconisationEditionId] = useState<string | null>(null);
  const [administrationForm, setAdministrationForm] = useState<AdministrationForm>(() => administrationVide());
  const medicamentSelectionne = medicamentsDisponibles.find((item) => item.id === form.medicamentId);
  const administrations = useMemo(() => classerAdministrations(medicamentSelectionne?.preconisations ?? []), [medicamentSelectionne]);
  const med = useMemo(() => medicamentSelectionne ? { ...medicamentSelectionne, preconisations: administrations.valides } : undefined, [medicamentSelectionne, administrations]);
  const preconisationARevoir = administrations.aVerifier[0];
  const apercuAge = useMemo(() => {
    if (!form.medicamentId || !form.calendrierChoisi) return null;
    if (form.calendrier.type !== "AGE_MINIMUM" && form.calendrier.type !== "SANS_REGLE") return null;
    const ancienneConfiguration = editingId
      ? lireConfigurationQuestionnaire(protocoles.find((item) => item.id === editingId)?.configurationQuestionnaireJson ?? null)
      : null;
    const ancienneLimite = ancienneConfiguration?.ageMaxDemarrage ?? null;
    const nouvelleLimite = form.ageMaxDemarrage;
    if (!ancienneLimite && !nouvelleLimite) return null;
    return previsualiserLimiteAge({
      animaux: apercuAgeAnimaux,
      cible: {
        medicamentId: form.medicamentId, protocoleId: editingId,
        categories: form.tous ? [] : form.categories,
        sexeCible: form.sexeCible || null,
        gestante: form.gestante === "" ? null : form.gestante === "true",
        rangVelageMin: form.rangVelageMin ? Number(form.rangVelageMin) : null,
        rangVelageMax: form.rangVelageMax ? Number(form.rangVelageMax) : null,
        lotCible: form.lotCible || null,
      },
      ancienneLimite, nouvelleLimite, date: new Date(),
    });
  }, [apercuAgeAnimaux, editingId, form, protocoles]);
  const impactAgeImportant = Boolean(apercuAge && (apercuAge.deviendraientHorsProgramme > 0 || apercuAge.reviendraientDansProgramme > 0));
  const cleApercuAge = JSON.stringify([editingId, form.medicamentId, form.ageMaxDemarrage, form.calendrier,
    form.tous, form.categories, form.sexeCible, form.gestante, form.rangVelageMin, form.rangVelageMax, form.lotCible]);
  const impactAgeConfirme = !impactAgeImportant || confirmationImpactAge === cleApercuAge;
  const apercuCible = useMemo(() => {
    if (!form.tous && form.categories.length === 0) return null;
    const nouveau: CibleComparaison = {
      categories: form.tous ? [] : form.categories,
      sexeCible: form.sexeCible || null,
      gestante: form.gestante === "" ? null : form.gestante === "true",
      rangVelageMin: form.rangVelageMin ? Number(form.rangVelageMin) : null,
      rangVelageMax: form.rangVelageMax ? Number(form.rangVelageMax) : null,
      lotCible: form.lotCible || null,
    };
    const protocoleAvant = editingId ? protocoles.find((item) => item.id === editingId) : null;
    const configurationAvant = lireConfigurationQuestionnaire(protocoleAvant?.configurationQuestionnaireJson ?? null);
    const ancien: CibleComparaison | null = configurationAvant && protocoleAvant ? {
      categories: configurationAvant.cible.tousBovins ? [] : configurationAvant.cible.categories,
      sexeCible: protocoleAvant.sexeCible, gestante: protocoleAvant.gestante,
      rangVelageMin: protocoleAvant.rangVelageMin, rangVelageMax: protocoleAvant.rangVelageMax,
      lotCible: protocoleAvant.lotCible,
    } : null;
    return comparerPopulationCible(apercuAgeAnimaux, nouveau, ancien);
  }, [apercuAgeAnimaux, editingId, form, protocoles]);
  const impactCibleImportant = Boolean(editingId && apercuCible &&
    (apercuCible.nouvellementVises > 0 || apercuCible.neSerontPlusVises > 0));
  const cleCiblage = JSON.stringify([editingId, form.tous, form.categories,
    form.sexeCible, form.gestante, form.rangVelageMin, form.rangVelageMax, form.lotCible]);
  const impactCibleConfirme = !impactCibleImportant || confirmationImpactCible === cleCiblage;
  const preconUnique = med ? preconisationAutomatique(med.preconisations) ?? "" : "";
  const sexeDejaConnu = !form.tous ? sexeImplicite(form.categories) : null;
  const afficherSexe = sexeDejaConnu == null;
  const afficherGestation = form.sexeCible !== "M"
    && (form.tous || form.categories.some((code) => code === "GENISSE" || code === "VACHE" || code.endsWith("_GENISSE")));
  const valide = useMemo(() => {
    if (page === 0) return Boolean(med && med.preconisations.length > 0);
    if (page === 1) return form.tous || form.categories.length > 0;
    if (page === 2) return form.demarrageChoisi;
    if (page === 3) return form.calendrierChoisi && (form.calendrier.type !== "MOIS_ANNUELS" || form.calendrier.mois.length > 0);
    if (page === 4 && form.type === "PRIMO_RAPPEL") return form.rappelDefini && (!form.conditionnel || Boolean((form.avant.primo || preconUnique) && (form.avant.rappel || preconUnique) && (form.apres.primo || preconUnique) && (form.apres.rappel || preconUnique)));
    if (page === 5) return form.entretienChoisi && (!form.entretien || (form.typeEntretienChoisi && (form.typeEntretien !== "MOIS_ANNUELS" || form.moisEntretien.length > 0)));
    return true;
  }, [page, form, med, preconUnique]);

  function choisirCategories(categories: string[]) {
    const sexe = sexeImplicite(categories);
    const peutEtreGestante = categories.some((code) => code === "VACHE" || code === "GENISSE" || code.endsWith("_GENISSE"));
    setForm((ancien) => ({ ...ancien, tous: false, categories, sexeCible: sexe ? "" : ancien.sexeCible, gestante: peutEtreGestante ? ancien.gestante : "" }));
  }
  function choisirDemarrage(type: Form["type"]) {
    setForm((ancien) => ({ ...ancien, type, demarrageChoisi: true, rappelDefini: false, initialTermine: false, entretien: false, entretienChoisi: false, typeEntretienChoisi: false }));
  }
  function choisirCalendrier(calendrier: RegleTemporelleQuestionnaire) {
    setForm((ancien) => ({ ...ancien, calendrier, calendrierChoisi: true, gestante: ancien.gestante, ageMaxDemarrage: calendrier.type === "AVANT_VELAGE" || calendrier.type === "MOIS_ANNUELS" ? null : ancien.ageMaxDemarrage, initialTermine: false }));
  }
  function continuer() {
    setForm((ancien) => page === 4 ? { ...ancien, initialTermine: true } : ancien);
    setPage((value) => value + 1);
  }

  function choisirMedicament(medicamentId: string) {
    const value = medicamentsDisponibles.find((item) => item.id === medicamentId); if (!value) return;
    const valides = classerAdministrations(value.preconisations).valides;
    const code = value.nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    const p = preconisationAutomatique(valides) ?? "";
    setAdministrationOuverte(false); setPreconisationEditionId(null); setAdministrationErreur(""); setErreurEnregistrement(""); setConflitProtocole(null);
    setForm((old) => ({ ...old, medicamentId, nom: editingId ? old.nom : code, label: editingId ? old.label : value.nom, preconPrimo: p, preconRappel: p, preconEntretien: p, avant: { ...old.avant, primo: p, rappel: p }, apres: { ...old.apres, primo: p, rappel: p } }));
  }
  function ouvrirAdministration(preconisation?: Preconisation) {
    setPreconisationEditionId(preconisation?.id ?? null);
    setAdministrationForm(administrationVide(medicamentSelectionne, preconisation));
    setAdministrationErreur("");
    setAdministrationOuverte(true);
  }
  async function enregistrerAdministration(event: React.FormEvent) {
    event.preventDefault();
    if (!medicamentSelectionne) return;
    setAdministrationSaving(true); setAdministrationErreur("");
    const response = await fetch(preconisationEditionId ? `/api/preconisations/${preconisationEditionId}` : "/api/preconisations", {
      method: preconisationEditionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicamentId: medicamentSelectionne.id,
        voie: administrationForm.voie,
        dose: administrationForm.dose,
        unite: administrationForm.unite,
        doseBase: administrationForm.doseBase || "ANIMAL",
        agePoidsConcerne: administrationForm.condition,
        source: "Saisie depuis protocole", statut: "VALIDE",
      }),
    });
    if (!response.ok) {
      setAdministrationErreur("L’administration n’a pas pu être enregistrée.");
      setAdministrationSaving(false);
      return;
    }
    const enregistree = await response.json() as Preconisation;
    setMedicamentsDisponibles((actuels) => actuels.map((medicament) => medicament.id !== medicamentSelectionne.id ? medicament : {
      ...medicament,
      preconisations: preconisationEditionId
        ? medicament.preconisations.map((preconisation) => preconisation.id === enregistree.id ? enregistree : preconisation)
        : [...medicament.preconisations, enregistree],
    }));
    setForm((ancien) => completerPreconisationsVides(ancien, enregistree.id));
    setAdministrationOuverte(false); setPreconisationEditionId(null); setAdministrationSaving(false);
  }
  function creer() { setConfirmationImpactAge(""); setConfirmationImpactCible(""); setForm(vide()); setEditingId(null); setAdministrationOuverte(false); setPreconisationEditionId(null); setErreurEnregistrement(""); setConflitProtocole(null); setDiagnosticExtraction(null); setPage(0); setOuvert(true); }
  function editer(protocole: Protocole) {
    if (!protocole.configurationQuestionnaireJson) return;
    const cfg = lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson);
    if (!cfg) return;
    const next = vide();
    next.nom = protocole.nom; next.ageMaxDemarrage = cfg.ageMaxDemarrage ?? null; next.label = protocole.label; next.description = protocole.description || ""; next.medicamentId = cfg.medicamentId; next.tous = cfg.cible.tousBovins; next.categories = cfg.cible.categories; next.sexeCible = protocole.sexeCible || ""; next.gestante = protocole.gestante == null ? "" : String(protocole.gestante); next.rangVelageMin = protocole.rangVelageMin == null ? "" : String(protocole.rangVelageMin); next.rangVelageMax = protocole.rangVelageMax == null ? "" : String(protocole.rangVelageMax); next.lotCible = protocole.lotCible || "";
    next.demarrageChoisi = true; next.calendrierChoisi = true; next.rappelDefini = cfg.demarrage.type === "PRIMO_RAPPEL"; next.initialTermine = true; next.entretienChoisi = true;
    if (cfg.demarrage.type === "DOSE_UNIQUE") { next.type = "DOSE_UNIQUE"; next.ids.dose = cfg.demarrage.etapeDoseId; next.preconPrimo = cfg.demarrage.preconisationId; next.calendrier = cfg.demarrage.calendrier; }
    else { next.type = "PRIMO_RAPPEL"; next.ids.primo = cfg.demarrage.etapePrimoId; next.ids.rappel = cfg.demarrage.etapeRappelId; next.calendrier = cfg.demarrage.calendrierPrimo; next.resterDansFenetre = cfg.demarrage.rappel.resterDansFenetrePrimo; next.conditionnel = cfg.demarrage.rappel.type === "BRANCHES_AGE_PRIMO"; if (cfg.demarrage.rappel.type === "DELAI_FIXE") { next.delai = cfg.demarrage.rappel.delai; next.preconPrimo = cfg.demarrage.rappel.preconisationPrimoId; next.preconRappel = cfg.demarrage.rappel.preconisationRappelId; } else { next.seuil = cfg.demarrage.rappel.seuilAgePrimo; const avant = cfg.demarrage.rappel.branches.find((b) => b.position === "AVANT_SEUIL")!, apres = cfg.demarrage.rappel.branches.find((b) => b.position === "A_PARTIR_SEUIL")!; next.avant = { id: avant.id, primo: avant.preconisationPrimoId, delai: avant.delaiRappel, rappel: avant.preconisationRappelId }; next.apres = { id: apres.id, primo: apres.preconisationPrimoId, delai: apres.delaiRappel, rappel: apres.preconisationRappelId }; } }
    if (cfg.entretien.actif) { next.entretien = true; next.typeEntretienChoisi = true; next.ids.entretien = cfg.entretien.etapeId; next.preconEntretien = cfg.entretien.preconisationId; next.typeEntretien = cfg.entretien.calendrier.type; if (cfg.entretien.calendrier.type === "APRES_DELAI") { next.premier = cfg.entretien.calendrier.premierDelai; next.recurrence = cfg.entretien.calendrier.recurrence; } else if (cfg.entretien.calendrier.type === "AVANT_VELAGE") next.fenetreEntretien = cfg.entretien.calendrier; else next.moisEntretien = cfg.entretien.calendrier.mois; }
    setConfirmationImpactAge(""); setConfirmationImpactCible(""); setForm(next); setEditingId(protocole.id); setPage(0); setOuvert(true);
  }
  async function enregistrer(action?: ActionConflit) {
    if (!med) return;
    if (!impactAgeConfirme) {
      setPage(6);
      setErreurEnregistrement("Vérifie le nombre de bovins concernés par la limite d’âge avant de confirmer ce changement.");
      return;
    }
    if (!impactCibleConfirme) {
      setPage(6);
      setErreurEnregistrement("Vérifie le nombre de bovins qui entreraient ou sortiraient du protocole avant de confirmer les catégories.");
      return;
    }
    setSaving(true); setErreurEnregistrement(""); setConflitProtocole(null); setDiagnosticExtraction(null);
    const formAEnregistrer = action?.type === "CONVERSION" ? { ...form, ids: { dose: action.ids.dose ?? form.ids.dose, primo: action.ids.primo ?? form.ids.primo, rappel: action.ids.rappel ?? form.ids.rappel, entretien: action.ids.entretien ?? form.ids.entretien } } : form;
    const { configuration, etapes } = construire(formAEnregistrer, med);
    const protocoleId = action?.type === "CONVERSION" ? action.id : editingId;
    try {
      const response = await fetch(protocoleId ? `/api/protocoles/${protocoleId}` : "/api/protocoles", { method: protocoleId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom: form.nom, label: form.label, description: form.description, categories: form.tous ? [] : form.categories, ageMinJours: 0, ageMaxJours: null, sexeCible: form.sexeCible || null, gestante: form.gestante === "" ? null : form.gestante === "true", rangVelageMin: form.rangVelageMin ? Number(form.rangVelageMin) : null, rangVelageMax: form.rangVelageMax ? Number(form.rangVelageMax) : null, lotCible: form.lotCible || null, configurationQuestionnaire: configuration, etapes, extraireDepuisProtocoleId: action?.type === "EXTRACTION" ? action.id : undefined, empreinteExtractionPrevue: action?.type === "EXTRACTION" ? action.empreinte : undefined, creerSansRepriseHistorique: action?.type === "NOUVEAU_SANS_REPRISE" }) });
      if (!response.ok) {
        const erreur = await response.json() as { error?: unknown; code?: unknown; protocole?: ConflitProtocole; diagnostic?: DiagnosticExtraction };
        if ((erreur.code === "PROTOCOLE_EXISTANT" || erreur.code === "PROTOCOLE_EXTRACTION_PROPOSEE") && erreur.protocole) setConflitProtocole(erreur.protocole);
        if (erreur.code === "PROTOCOLE_EXTRACTION_PROPOSEE" && erreur.diagnostic) setDiagnosticExtraction(erreur.diagnostic);
        setErreurEnregistrement(typeof erreur.error === "string" ? erreur.error : "Le protocole n’a pas pu être enregistré.");
        return;
      }
      setOuvert(false); router.refresh();
    } catch {
      setErreurEnregistrement("Le protocole n’a pas pu être enregistré. Vérifie la connexion puis réessaie.");
    } finally { setSaving(false); }
  }

  async function changerActivation(protocole: Protocole) {
    if (changementActifId) return;
    if (protocole.actif && !window.confirm(`Désactiver « ${protocole.label} » ? Le protocole ne proposera plus de nouvelles échéances. Les vaccinations et traitements déjà enregistrés restent conservés.`)) return;
    setErreurActivation("");
    setChangementActifId(protocole.id);
    try {
      const reponse = await fetch(`/api/protocoles/${encodeURIComponent(protocole.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !protocole.actif }),
      });
      if (!reponse.ok) {
        const erreur = await reponse.json().catch(() => ({}));
        throw new Error(typeof erreur.error === "string" ? erreur.error : "Modification impossible.");
      }
      router.refresh();
    } catch (erreur) {
      setErreurActivation(erreur instanceof Error ? erreur.message : "Modification impossible.");
    } finally { setChangementActifId(null); }
  }

  return <div className="space-y-4"><button onClick={creer} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 font-semibold text-white"><Plus size={18} /> Créer un protocole</button>
    {ouvert && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><section className="rounded-2xl bg-gray-50 p-3 shadow-inner"><header className="mb-4 flex items-center gap-2"><div className="flex-1"><p className="text-xs font-bold text-green-800">Question {page + 1} sur 7</p><div className="mt-1 h-1.5 rounded bg-gray-200"><div className="h-full rounded bg-green-700" style={{ width: `${((page + 1) / 7) * 100}%` }} /></div></div><button onClick={() => setOuvert(false)} aria-label="Fermer"><X /></button></header><div className="space-y-4">
      {page === 0 && <><h3 className="text-xl font-black">Quel vaccin veux-tu programmer ?</h3><select value={form.medicamentId} onChange={(e) => choisirMedicament(e.target.value)} className="min-h-14 w-full rounded-xl border-2 border-green-200 bg-white px-3 font-semibold"><option value="">Choisir dans la Pharmacie</option>{medicaments.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select>{medicamentSelectionne && administrations.valides.length === 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">{preconisationARevoir ? "Une administration existe déjà mais doit être validée" : "Aucune préconisation validée : complète d’abord l’administration."}</p><div className="mt-2 flex flex-wrap gap-2">{!administrationOuverte && <button type="button" onClick={() => ouvrirAdministration(preconisationARevoir)} className="min-h-10 rounded-lg bg-amber-800 px-3 font-semibold text-white">{preconisationARevoir ? "Revoir et valider ici" : "Compléter l’administration ici"}</button>}<Link href={`/pharmacie/${medicamentSelectionne.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-amber-700 bg-white px-3 font-semibold text-amber-900">Compléter la fiche Pharmacie</Link></div>{administrationOuverte && <form onSubmit={(event) => void enregistrerAdministration(event)} className="mt-3 grid gap-3 rounded-xl border border-amber-200 bg-white p-3 sm:grid-cols-2"><label className="font-medium">Voie d’administration<select required value={administrationForm.voie} onChange={(event) => setAdministrationForm({ ...administrationForm, voie: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-2"><option value="">Choisir</option>{administrationForm.voie && !["IM", "IV", "SC", "VO", "INTRANASALE", "INTRAMAMMAIRE", "INTRA_UTERINE", "CUTANEE", "POUR_ON", "OCULAIRE"].includes(administrationForm.voie) && <option value={administrationForm.voie}>{administrationForm.voie}</option>}<option value="IM">Intramusculaire (IM)</option><option value="IV">Intraveineuse (IV)</option><option value="SC">Sous-cutanée (SC)</option><option value="VO">Orale (VO)</option><option value="INTRANASALE">Intranasale</option><option value="INTRAMAMMAIRE">Intramammaire</option><option value="INTRA_UTERINE">Intra-utérine</option><option value="CUTANEE">Cutanée / externe</option><option value="POUR_ON">Pour-on</option><option value="OCULAIRE">Oculaire</option></select></label><label className="font-medium sm:col-span-2">Dose<div className="mt-1 grid grid-cols-[minmax(0,1fr)_8rem] gap-2"><input required aria-label="Dose" type="number" min="0" step="any" value={administrationForm.dose} onChange={(event) => setAdministrationForm({ ...administrationForm, dose: event.target.value })} className="min-h-11 w-full rounded-lg border px-3" /><select required aria-label="Unité" value={administrationForm.unite} onChange={(event) => setAdministrationForm({ ...administrationForm, unite: event.target.value })} className="min-h-11 rounded-lg border px-2"><option value="ml">ml</option><option value="l">litre</option><option value="g">g</option><option value="mg">mg</option><option value="dose">dose</option><option value="comprimé">comprimé</option><option value="bolus">bolus</option><option value="sachet">sachet</option></select></div></label><label className="font-medium">Base de dosage<select required value={administrationForm.doseBase} onChange={(event) => setAdministrationForm({ ...administrationForm, doseBase: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-2"><option value="ANIMAL">Par animal</option><option value="KG">Par kg</option><option value="100KG">Par 100 kg</option><option value="QUARTIER">Par quartier</option></select></label><label className="font-medium sm:col-span-2">Dans quel cas cette administration s’applique-t-elle ? <span className="font-normal text-gray-500">(facultatif)</span><input value={administrationForm.condition} onChange={(event) => setAdministrationForm({ ...administrationForm, condition: event.target.value })} placeholder="Ex. avant 2,5 mois" className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>{administrationErreur && <p className="text-red-700 sm:col-span-2">{administrationErreur}</p>}<div className="flex gap-2 sm:col-span-2"><button type="button" onClick={() => setAdministrationOuverte(false)} className="min-h-11 rounded-lg border px-4">Annuler</button><button disabled={administrationSaving} className="ml-auto min-h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-50">{administrationSaving ? "Enregistrement…" : preconisationEditionId ? "Valider cette administration" : "Enregistrer l’administration"}</button></div></form>}</div>}<details><summary className="cursor-pointer text-sm text-gray-500">Renommer ou ajouter une note</summary><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="mt-2 w-full rounded-lg border p-2" /><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-2 w-full rounded-lg border p-2" placeholder="Note facultative" /></details></>}
      {page === 1 && <><h3 className="text-xl font-black">À quels animaux s’applique ce protocole ?</h3><div className="grid gap-2"><Choix actif={form.tous && form.gestante !== "true"} onClick={() => setForm({ ...form, tous: true, categories: [], gestante: "", sexeCible: "" })}>Tous les bovins</Choix><Choix actif={form.tous && form.gestante === "true"} onClick={() => setForm({ ...form, tous: true, categories: [], gestante: "true", sexeCible: "F", rangVelageMin: "", rangVelageMax: "", lotCible: "" })}>Tous les animaux gestants (quelle que soit leur catégorie)</Choix><Choix actif={!form.tous} onClick={() => setForm({ ...form, tous: false })}>Seulement certaines catégories</Choix></div>{!form.tous && <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Sélectionne une ou plusieurs catégories :</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAMILLES_CATEGORIES.map((famille) => (
            <div key={famille.code} className="rounded-xl border border-gray-200 bg-white p-2">
              <Choix actif={form.categories.includes(famille.code)}
                onClick={() => choisirCategories(basculerCategorieVaccinale(form.categories, famille.code))}>
                {famille.label}
              </Choix>
              {famille.enfants.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="px-1 text-xs text-gray-500">Ou précise la catégorie :</p>
                  {famille.enfants.map((enfant) => (
                    <button key={enfant.code} type="button"
                      aria-pressed={categorieVaccinaleSelectionnee(form.categories, enfant.code)}
                      onClick={() => choisirCategories(basculerCategorieVaccinale(form.categories, enfant.code))}
                      className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm font-medium ${categorieVaccinaleSelectionnee(form.categories, enfant.code) ? "border-green-600 bg-green-50 text-green-900" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                      {categorieVaccinaleSelectionnee(form.categories, enfant.code) ? "✓ " : "○ "}{enfant.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600">Une catégorie sélectionnée couvre les animaux appartenant à cette catégorie, sans modifier leurs fiches sanitaires.</p>
      </div>}<p className="rounded-lg bg-blue-50 p-3 text-sm">{resumeCibleQuestionnaire(form.tous, form.categories)}</p>{apercuCible && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><b>{apercuCible.animauxVises} bovin(s) visés</b> parmi {apercuCible.populationActive} actifs, d’après les critères sélectionnés. {editingId && <>Avec cette modification : <b>{apercuCible.nouvellementVises} entreraient</b> et <b>{apercuCible.neSerontPlusVises} sortiraient</b> du protocole.</>} <span className="block text-xs">Estimation à la date de chargement, sans modifier les animaux.</span></p>}<details className="rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold text-green-800">Affiner les animaux concernés</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{afficherSexe && <label className="text-xs text-gray-600">Sexe<select value={form.sexeCible} onChange={(e) => setForm({ ...form, sexeCible: e.target.value, gestante: e.target.value === "M" ? "" : form.gestante })} className="mt-1 min-h-10 w-full rounded border px-2"><option value="">Sexe non précisé</option><option value="F">Femelles</option><option value="M">Mâles</option></select></label>}{afficherGestation && <label className="text-xs text-gray-600">Situation de gestation<select value={form.gestante} onChange={(e) => setForm({ ...form, gestante: e.target.value })} className="mt-1 min-h-10 w-full rounded border px-2"><option value="">Situation non précisée</option><option value="true">Animaux gestants</option><option value="false">Animaux non gestants</option></select></label>}<label className="text-xs text-gray-600 sm:col-span-2">Lot facultatif<input value={form.lotCible} onChange={(e) => setForm({ ...form, lotCible: e.target.value })} className="mt-1 min-h-10 w-full rounded border px-2" /></label>{(form.rangVelageMin || form.rangVelageMax) && <details className="sm:col-span-2"><summary className="cursor-pointer text-gray-500">Critère avancé existant : rang de vêlage</summary><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="0" value={form.rangVelageMin} onChange={(e) => setForm({ ...form, rangVelageMin: e.target.value })} placeholder="Minimum" className="min-h-10 rounded border px-2" /><input type="number" min="0" value={form.rangVelageMax} onChange={(e) => setForm({ ...form, rangVelageMax: e.target.value })} placeholder="Maximum" className="min-h-10 rounded border px-2" /></div></details>}</div></details></>}
      {page === 2 && <><h3 className="text-xl font-black">Comment démarre la vaccination ?</h3><div className="grid gap-2"><Choix actif={form.demarrageChoisi && form.type === "DOSE_UNIQUE"} onClick={() => choisirDemarrage("DOSE_UNIQUE")}>Une dose unique</Choix><Choix actif={form.demarrageChoisi && form.type === "PRIMO_RAPPEL"} onClick={() => choisirDemarrage("PRIMO_RAPPEL")}>Une Primo + un Rappel</Choix></div></>}
      {page === 3 && <><h3 className="text-xl font-black">Quand peut-on faire {form.type === "DOSE_UNIQUE" ? "la dose" : "la Primo"} ?</h3><div className="grid gap-2 sm:grid-cols-2"><Choix actif={form.calendrierChoisi && form.calendrier.type === "AGE_MINIMUM"} onClick={() => choisirCalendrier({ type: "AGE_MINIMUM", age: d(0) })}>À partir d’un certain âge</Choix><Choix actif={form.calendrierChoisi && form.calendrier.type === "AVANT_VELAGE"} onClick={() => choisirCalendrier(fenetreVelage())}>Pendant une période avant vêlage</Choix><Choix actif={form.calendrierChoisi && form.calendrier.type === "MOIS_ANNUELS"} onClick={() => choisirCalendrier({ type: "MOIS_ANNUELS", mois: [] })}>À une période particulière de l’année</Choix><Choix actif={form.calendrierChoisi && form.calendrier.type === "SANS_REGLE"} onClick={() => choisirCalendrier({ type: "SANS_REGLE" })}>Pas de règle particulière</Choix></div>{form.calendrierChoisi && form.calendrier.type === "AGE_MINIMUM" && <Duree value={form.calendrier.age} decimal onChange={(age) => setForm({ ...form, calendrier: { type: "AGE_MINIMUM", age } })} />}{form.calendrierChoisi && form.calendrier.type === "AVANT_VELAGE" && <div className="space-y-2 rounded-lg bg-white p-3"><label className="grid items-center gap-2 text-sm sm:grid-cols-[auto_1fr]">Entre<Duree value={form.calendrier.debutAvant} decimal onChange={(debutAvant) => setForm({ ...form, calendrier: { ...(form.calendrier as typeof form.fenetreEntretien), debutAvant } })} /></label><label className="grid items-center gap-2 text-sm sm:grid-cols-[auto_1fr]">et<Duree value={form.calendrier.finAvant} decimal onChange={(finAvant) => setForm({ ...form, calendrier: { ...(form.calendrier as typeof form.fenetreEntretien), finAvant } })} /></label><p className="text-sm text-gray-600">avant le vêlage</p></div>}{form.calendrierChoisi && form.calendrier.type === "MOIS_ANNUELS" && <Mois value={form.calendrier.mois} onChange={(mois) => setForm({ ...form, calendrier: { type: "MOIS_ANNUELS", mois } })} />}{form.calendrierChoisi && (form.calendrier.type === "AGE_MINIMUM" || form.calendrier.type === "SANS_REGLE") && (
        <div className="rounded-xl border bg-white p-3 text-sm">
          <label className="block font-semibold text-gray-900">
            Âge maximal pour commencer cette vaccination dans ton élevage (facultatif)
            <input
              aria-label="Âge maximal de démarrage"
              type="number"
              min="0"
              step="1"
              placeholder="Laisser vide si aucune limite"
              value={form.ageMaxDemarrage?.valeur ?? ""}
              onChange={(event) => setForm((ancien) => ({
                ...ancien,
                ageMaxDemarrage: event.target.value === ""
                  ? null
                  : { valeur: Number(event.target.value), unite: ancien.ageMaxDemarrage?.unite ?? "JOUR" },
              }))}
              className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
            />
          </label>
          {form.ageMaxDemarrage && (
            <label className="mt-2 block text-xs text-gray-700">
              Unité
              <select
                value={form.ageMaxDemarrage.unite}
                onChange={(event) => setForm((ancien) => ({
                  ...ancien,
                  ageMaxDemarrage: ancien.ageMaxDemarrage
                    ? { ...ancien.ageMaxDemarrage, unite: event.target.value as DureeQuestionnaire["unite"] }
                    : null,
                }))}
                className="mt-1 min-h-11 w-full rounded-lg border px-2"
              >
                <option value="JOUR">jours</option>
                <option value="SEMAINE">semaines</option>
                <option value="MOIS">mois</option>
              </select>
            </label>
          )}
          <p className="mt-2 text-xs text-gray-600">
            Il s’agit de la fenêtre de ton programme sanitaire, pas d’une contre-indication vétérinaire.
            Le rappel reste prévu après une Primo réellement faite.
          </p>
        </div>
      )}{med && <Precon med={med} value={form.preconPrimo} onChange={(preconPrimo) => setForm({ ...form, preconPrimo })} titre="Voie et dose" />}</>}
      {page === 4 && (form.type === "DOSE_UNIQUE" ? <><h3 className="text-xl font-black">Le démarrage est défini</h3><p className="rounded-lg bg-green-50 p-4 text-sm">Une dose suffit pour terminer le protocole initial.</p></> : <><h3 className="text-xl font-black">Le délai entre la Primo et le Rappel est-il toujours le même ?</h3><div className="grid gap-2"><Choix actif={form.rappelDefini && !form.conditionnel} onClick={() => setForm({ ...form, rappelDefini: true, conditionnel: false, initialTermine: false })}>Oui, toujours le même délai</Choix><Choix actif={form.rappelDefini && form.conditionnel} onClick={() => setForm({ ...form, rappelDefini: true, conditionnel: true, initialTermine: false })}>Non, il dépend de l’âge au moment de la Primo</Choix></div>{form.rappelDefini && (!form.conditionnel ? <><label className="text-sm font-medium">Délai après la Primo<Duree value={form.delai} decimal onChange={(delai) => setForm({ ...form, delai, initialTermine: false })} /></label>{med && <Precon med={med} value={form.preconRappel} onChange={(preconRappel) => setForm({ ...form, preconRappel, initialTermine: false })} titre="Voie et dose du Rappel" />}</> : <><label className="text-sm font-medium">Âge auquel la façon change<Duree value={form.seuil} decimal onChange={(seuil) => setForm({ ...form, seuil, initialTermine: false })} /></label>{med && <div className="grid gap-3 sm:grid-cols-2">{(["avant", "apres"] as const).map((cle) => { const branche = form[cle]; return <div key={cle} className="space-y-2 rounded-xl border bg-white p-3"><b>{cle === "avant" ? "Avant cet âge" : "À partir de cet âge"}</b><Precon med={med} value={branche.primo} onChange={(primo) => setForm({ ...form, [cle]: { ...branche, primo }, initialTermine: false })} titre="Primo" /><label className="text-sm">Délai du Rappel<Duree value={branche.delai} decimal onChange={(delai) => setForm({ ...form, [cle]: { ...branche, delai }, initialTermine: false })} /></label><Precon med={med} value={branche.rappel} onChange={(rappel) => setForm({ ...form, [cle]: { ...branche, rappel }, initialTermine: false })} titre="Rappel" /></div>; })}</div>}</>)}{form.calendrier.type === "AVANT_VELAGE" && <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm"><input type="checkbox" checked={form.resterDansFenetre} onChange={(e) => setForm({ ...form, resterDansFenetre: e.target.checked, initialTermine: false })} className="mt-0.5" /><span>Le Rappel doit lui aussi être réalisé {texteFenetreAvantVelage(form.calendrier)}.</span></label>}</>)}
      {page === 5 && <><h3 className="text-xl font-black">{form.type === "PRIMO_RAPPEL" ? "Après le protocole initial, faut-il prévoir un entretien ?" : "Après cette dose, faut-il prévoir un entretien ?"}</h3><div className="grid grid-cols-2 gap-2"><Choix actif={form.entretienChoisi && form.entretien} onClick={() => setForm({ ...form, entretien: true, entretienChoisi: true })}>Oui</Choix><Choix actif={form.entretienChoisi && !form.entretien} onClick={() => setForm({ ...form, entretien: false, entretienChoisi: true, typeEntretienChoisi: false })}>Non</Choix></div>{form.entretienChoisi && form.entretien && <><div className="grid gap-2 sm:grid-cols-3"><Choix actif={form.typeEntretienChoisi && form.typeEntretien === "APRES_DELAI"} onClick={() => setForm({ ...form, typeEntretien: "APRES_DELAI", typeEntretienChoisi: true })}>Après un délai</Choix><Choix actif={form.typeEntretienChoisi && form.typeEntretien === "AVANT_VELAGE"} onClick={() => setForm({ ...form, typeEntretien: "AVANT_VELAGE", typeEntretienChoisi: true, fenetreEntretien: form.calendrier.type === "AVANT_VELAGE" ? form.calendrier : form.fenetreEntretien })}>À chaque prochaine gestation</Choix><Choix actif={form.typeEntretienChoisi && form.typeEntretien === "MOIS_ANNUELS"} onClick={() => setForm({ ...form, typeEntretien: "MOIS_ANNUELS", typeEntretienChoisi: true })}>À une période particulière de l’année</Choix></div>{form.typeEntretienChoisi && form.typeEntretien === "APRES_DELAI" && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Premier entretien après<Duree value={form.premier} decimal onChange={(premier) => setForm({ ...form, premier, recurrence: form.recurrence.valeur === form.premier.valeur && form.recurrence.unite === form.premier.unite ? premier : form.recurrence })} /></label><label className="text-sm">Puis tous les<Duree value={form.recurrence} decimal onChange={(recurrence) => setForm({ ...form, recurrence })} /></label></div>}{form.typeEntretienChoisi && form.typeEntretien === "AVANT_VELAGE" && <div className="space-y-2 rounded-lg bg-white p-3"><p className="font-semibold text-purple-900">À chaque prochaine gestation</p><label className="grid items-center gap-2 text-sm sm:grid-cols-[auto_1fr]">Entre<Duree value={form.fenetreEntretien.debutAvant} decimal onChange={(debutAvant) => setForm({ ...form, fenetreEntretien: { ...form.fenetreEntretien, debutAvant } })} /></label><label className="grid items-center gap-2 text-sm sm:grid-cols-[auto_1fr]">et<Duree value={form.fenetreEntretien.finAvant} decimal onChange={(finAvant) => setForm({ ...form, fenetreEntretien: { ...form.fenetreEntretien, finAvant } })} /></label><p className="text-sm text-gray-600">avant le vêlage</p></div>}{form.typeEntretienChoisi && form.typeEntretien === "MOIS_ANNUELS" && <Mois value={form.moisEntretien} onChange={(moisEntretien) => setForm({ ...form, moisEntretien })} />}{med && <Precon med={med} value={form.preconEntretien} onChange={(preconEntretien) => setForm({ ...form, preconEntretien })} titre="Voie et dose de l’entretien" />}</>}</>}
      {page === 6 && <><h3 className="text-xl font-black">Vérifie ton protocole</h3>{med && <ResumeFinal form={form} med={med} />}{apercuCible && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><p className="font-bold">Catégories et critères retenus</p><p className="mt-1">{apercuCible.animauxVises} bovin(s) actuellement concernés.{editingId && <> {apercuCible.nouvellementVises} entreraient et {apercuCible.neSerontPlusVises} sortiraient du protocole.</>}</p>{impactCibleImportant && <label className="mt-2 flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-1" checked={impactCibleConfirme} onChange={(event) => setConfirmationImpactCible(event.target.checked ? cleCiblage : "")} /><span>J’ai vérifié l’impact de ces catégories sur mon troupeau.</span></label>}<p className="mt-1 text-xs">Aucune injection ni historique n’est modifié par cette sélection.</p></div>}{apercuAge && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">Impact de la limite d’âge sur les bovins actifs</p><p className="mt-1">{apercuAge.deviendraientHorsProgramme} bovin(s) passeraient hors programme et {apercuAge.reviendraientDansProgramme} reviendraient dans le programme.</p><p className="mt-1 text-xs">Estimation fondée sur les catégories, âges et injections identifiées au chargement de la page. Aucun acte ne sera supprimé ou considéré comme réalisé.</p>{impactAgeImportant && <label className="mt-3 flex items-start gap-2 font-semibold"><input type="checkbox" checked={impactAgeConfirme} onChange={(event) => setConfirmationImpactAge(event.target.checked ? cleApercuAge : "")} className="mt-1" /><span>Je confirme avoir vérifié cet impact avant de modifier le protocole.</span></label>}</div>}{form.ageMaxDemarrage && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">Limite propre à l’élevage : ne plus proposer de commencer cette vaccination après {texteDureeQuestionnaire(form.ageMaxDemarrage)} d’âge. Les rappels déjà engagés restent à suivre.</p>}{erreurEnregistrement && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">{erreurEnregistrement}</p>{diagnosticExtraction && <div className="mt-3 rounded-lg border border-red-200 bg-white p-3"><p className="font-bold">{diagnosticExtraction.totalAmbigus} acte{diagnosticExtraction.totalAmbigus > 1 ? "s" : ""} ambigu{diagnosticExtraction.totalAmbigus > 1 ? "s" : ""}</p><ul className="mt-2 space-y-2">{diagnosticExtraction.repartition.map((categorie) => <li key={categorie.cause}><p>• {categorie.nombre} — {categorie.libelle}</p>{categorie.exemples.length > 0 && <ul className="ml-4 mt-1 space-y-0.5 text-xs text-red-800">{categorie.exemples.slice(0, 5).map((exemple) => <li key={exemple.acteId}>{exemple.nutrav || exemple.animalId} — {dateDiagnostic(exemple.date)} — {exemple.ancienneEtape?.label || "Étape inconnue"}</li>)}</ul>}</li>)}</ul></div>}{conflitProtocole?.memeVaccin && !conflitProtocole.configurationQuestionnairePresente && conflitProtocole.conversion.possible && conflitProtocole.conversion.ids && <button type="button" onClick={() => void enregistrer({ type: "CONVERSION", id: conflitProtocole.id, ids: conflitProtocole.conversion.ids! })} className="mt-3 min-h-11 rounded-lg bg-red-800 px-4 font-semibold text-white">Mettre à jour ce protocole ?</button>}{conflitProtocole?.extraction && <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm"><p className="font-semibold text-green-950">Créer un protocole indépendant, sans toucher aux actes anciens</p><p className="mt-1 text-green-900">L’ancien protocole et ses historiques restent inchangés. Les vaccinations passées ne seront pas considérées automatiquement comme faites dans le nouveau protocole : il faudra contrôler leurs rattachements.</p><button type="button" onClick={() => void enregistrer({ type: "NOUVEAU_SANS_REPRISE" })} className="mt-3 min-h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Créer sans reprendre les anciens actes</button></div>}{conflitProtocole?.extraction?.possible && conflitProtocole.extraction.bilan && conflitProtocole.extraction.empreinte && <div className="mt-3 rounded-xl border border-amber-300 bg-white p-3 text-gray-900">
  <p className="font-bold">Prévisualisation — aucun changement effectué</p>
  <p className="mt-1 text-xs">La séparation peut modifier les rattachements historiques suivants :</p>
  <ul className="mt-2 list-inside list-disc text-xs leading-6">
    <li>{conflitProtocole.extraction.bilan.vaccinationsDeplacees} vaccination(s) à rattacher au nouveau protocole</li>
    <li>{conflitProtocole.extraction.bilan.traitementsDeplaces} traitement(s) vaccinaux à rattacher</li>
    <li>{conflitProtocole.extraction.bilan.vaccinationsGeneriquesNeutralisees} ancienne(s) vaccination(s) générique(s) à marquer comme doublons techniques</li>
    <li>{conflitProtocole.extraction.bilan.traitementsDoublonsDetaches} traitement(s) en doublon à détacher</li>
    <li>{conflitProtocole.extraction.bilan.statutsAnimauxRecalcules} statut(s) vaccinaux existants à recalculer</li>
    <li>{conflitProtocole.extraction.bilan.statutsAvecDecisionOuNoteAProteger} décision(s) ou note(s) manuelles nécessitant une préservation</li>
  </ul>
  {conflitProtocole.extraction.bilan.statutsAvecDecisionOuNoteAProteger > 0 && <p role="alert" className="mt-2 rounded bg-red-50 p-2 text-xs font-bold text-red-900">Séparation bloquée : il faut préserver les statuts ou notes manuels avant toute migration. Aucune écriture ne sera faite.</p>}
  <p className="mt-2 text-xs font-semibold text-amber-900">Les injections réellement réalisées ne seront pas créées à nouveau. Attention : les statuts de protocole peuvent changer. Si le bilan change entre maintenant et la confirmation, CESAM refusera la séparation.</p>
  <button
    type="button"
    disabled={conflitProtocole.extraction.bilan.statutsAvecDecisionOuNoteAProteger > 0}
    onClick={() => {
      const extraction = conflitProtocole.extraction!;
      const bilan = extraction.bilan!;
      const confirmation = `Séparer ${extraction.medicamentNom} du protocole historique ?\n\n${bilan.vaccinationsDeplacees} vaccinations rattachées, ${bilan.traitementsDeplaces} traitements rattachés, ${bilan.vaccinationsGeneriquesNeutralisees} génériques neutralisées, ${bilan.traitementsDoublonsDetaches} doublons détachés, ${bilan.statutsAnimauxRecalcules} statuts à recalculer.\n\nCette action modifie l’historique des rattachements. Confirmer ?`;
      if (window.confirm(confirmation)) void enregistrer({ type: "EXTRACTION", id: conflitProtocole.id, empreinte: extraction.empreinte! });
    }}
    className="mt-3 min-h-11 w-full rounded-lg bg-red-800 px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
  >
    Confirmer la séparation de {conflitProtocole.extraction.medicamentNom}
  </button>
</div>}{conflitProtocole?.conversion.raison && <p className="mt-2">{conflitProtocole.conversion.raison}</p>}{conflitProtocole?.extraction?.raison && conflitProtocole.extraction.raison !== erreurEnregistrement && <p className="mt-2">{conflitProtocole.extraction.raison}</p>}</div>}<button disabled={saving || !med} onClick={() => void enregistrer()} className="min-h-12 w-full rounded-xl bg-green-700 font-bold text-white disabled:opacity-40">{saving ? "Enregistrement…" : "Enregistrer"}</button></>}
    </div><footer className="mt-5 flex gap-2">{page > 0 && <button onClick={() => setPage((value) => value - 1)} className="flex min-h-11 items-center gap-1 rounded-lg border bg-white px-4"><ArrowLeft size={16} /> Retour</button>}{page < 6 && <button disabled={!valide} onClick={continuer} className="ml-auto flex min-h-11 items-center gap-1 rounded-lg bg-green-700 px-5 font-semibold text-white disabled:opacity-40">Continuer <ArrowRight size={16} /></button>}</footer></section><div className="lg:sticky lg:top-3 lg:self-start"><Frise form={form} med={med} /></div></div>}
    {erreurActivation && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erreurActivation}</p>}<div className="space-y-2">{protocoles.map((protocole) => <article key={protocole.id} className="rounded-xl border bg-white p-3 shadow-sm"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><b>{protocole.label}</b>{protocole.configurationQuestionnaireJson ? <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-green-800"><Check size={13} /> Questionnaire versionné</p> : <p className="mt-1 text-xs text-amber-800">Configuration historique conservée : planner legacy inchangé. Édition automatique désactivée pour éviter toute perte.</p>}</div><button type="button" onClick={() => changerActivation(protocole)} disabled={changementActifId !== null} aria-label={`${protocole.actif ? "Désactiver" : "Réactiver"} ${protocole.label}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${protocole.actif ? "bg-green-100 text-green-900" : "bg-gray-100 text-gray-700"}`}>{changementActifId === protocole.id ? "Enregistrement…" : protocole.actif ? "Actif · Désactiver" : "Inactif · Réactiver"}</button>{protocole.configurationQuestionnaireJson && <button onClick={() => editer(protocole)} aria-label={`Modifier ${protocole.label}`}><Pencil size={16} /></button>}</div>{!protocole.configurationQuestionnaireJson && <CategoriesProtocoleHistorique protocole={protocole} animaux={apercuAgeAnimaux} />}</article>)}</div>
  </div>;
}
