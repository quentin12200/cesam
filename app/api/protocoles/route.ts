import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROTOCOLES } from "@/lib/utils";
import { logAction } from "@/lib/action-log";
import { etapeIdsConfigurationQuestionnaire, lireConfigurationQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";
import { referencesPharmacieValides } from "@/lib/vaccine-protocol-validation";
import { preparerConversionProtocole } from "@/lib/vaccine-protocol-name";

function cibleErreurUniqueContientNom(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const target = (meta as { target?: unknown }).target;
  return Array.isArray(target)
    ? target.some((champ) => champ === "nom")
    : typeof target === "string" && target.includes("nom");
}

function normaliserNomInterne(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function GET() {
  let protocoles = await prisma.protocoleVaccin.findMany({
    orderBy: { ordre: "asc" },
    include: { etapes: { include: { medicaments: { include: { medicament: true } } }, orderBy: { ordre: "asc" } } },
  });

  // Seed defaults if table is empty
  if (protocoles.length === 0) {
    await prisma.protocoleVaccin.createMany({
      data: DEFAULT_PROTOCOLES.map((p) => ({
        id: p.id,
        nom: p.nom,
        label: p.label,
        ordre: p.ordre,
        ageMinJours: p.ageMinJours,
        urgenceJours: p.urgenceJours,
        estRappel: p.estRappel,
        primoNom: p.primoNom,
        delaiRappelJours: p.delaiRappelJours,
        urgenceRappelJours: p.urgenceRappelJours,
        obligatoireVente: p.obligatoireVente,
        actif: p.actif,
      })),
    });
    protocoles = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" }, include: { etapes: { include: { medicaments: { include: { medicament: true } } }, orderBy: { ordre: "asc" } } } });
  }

  return NextResponse.json(protocoles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, label, ordre, ageMinJours, ageMaxJours, urgenceJours, estRappel, primoNom, delaiRappelJours, urgenceRappelJours, obligatoireVente, description, categories, sexeCible, stadeReproduction, gestante, rangVelageMin, rangVelageMax, lotCible, etapes, configurationQuestionnaire } = body;
  if (!nom?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "nom et label requis" }, { status: 400 });
  }
  const configurationJson = configurationQuestionnaire == null ? null : JSON.stringify(configurationQuestionnaire);
  const configuration = lireConfigurationQuestionnaire(configurationJson);
  if (configurationQuestionnaire != null && !configuration) {
    return NextResponse.json({ error: "Configuration du questionnaire invalide" }, { status: 400 });
  }
  if (configuration && !await referencesPharmacieValides(configuration)) {
    return NextResponse.json({ error: "Les préconisations doivent être validées dans la Pharmacie pour ce vaccin" }, { status: 400 });
  }
  if (configuration) {
    const etapesRecues = Array.isArray(etapes) ? etapes : [];
    const idsAttendus = etapeIdsConfigurationQuestionnaire(configuration);
    if (etapesRecues.length !== idsAttendus.length || idsAttendus.some((id) => !etapesRecues.some((etape: any) => etape.id === id))
      || etapesRecues.some((etape: any) => (etape.medicaments || []).some((liaison: any) => liaison.medicamentId !== configuration.medicamentId))) {
      return NextResponse.json({ error: "Les étapes ne correspondent pas au questionnaire" }, { status: 400 });
    }
  }
  try {
    const nomInterne = nom.trim().toUpperCase();
    const existant = await prisma.protocoleVaccin.findUnique({
      where: { nom: nomInterne },
      select: {
        id: true, nom: true, label: true, configurationQuestionnaireJson: true,
        etapes: {
          orderBy: { ordre: "asc" },
          select: {
            id: true, label: true, cycle: true,
            medicaments: { select: { medicamentId: true } },
            _count: { select: { vaccinations: true, traitements: true } },
          },
        },
      },
    });
    if (existant) {
      const medicament = configuration
        ? await prisma.medicament.findUnique({ where: { id: configuration.medicamentId }, select: { nom: true } })
        : null;
      const medicamentIds = new Set(existant.etapes.flatMap((etape) => etape.medicaments.map((liaison) => liaison.medicamentId)));
      const memeVaccin = Boolean(configuration && medicament) && (medicamentIds.size > 0
        ? medicamentIds.size === 1 && medicamentIds.has(configuration!.medicamentId)
        : normaliserNomInterne(existant.nom) === normaliserNomInterne(medicament!.nom));
      const etapesExistantes = existant.etapes.map((etape) => ({
        id: etape.id, label: etape.label, cycle: etape.cycle,
        vaccinationsCount: etape._count.vaccinations,
        traitementsCount: etape._count.traitements,
      }));
      const idsDemandes = configuration ? {
        dose: configuration.demarrage.type === "DOSE_UNIQUE" ? configuration.demarrage.etapeDoseId : null,
        primo: configuration.demarrage.type === "PRIMO_RAPPEL" ? configuration.demarrage.etapePrimoId : null,
        rappel: configuration.demarrage.type === "PRIMO_RAPPEL" ? configuration.demarrage.etapeRappelId : null,
        entretien: configuration.entretien.actif ? configuration.entretien.etapeId : null,
      } : { dose: null, primo: null, rappel: null, entretien: null };
      const conversion = existant.configurationQuestionnaireJson
        ? { possible: false as const, raison: "Ce protocole utilise déjà le questionnaire : modifiez directement le protocole existant." }
        : !memeVaccin
          ? { possible: false as const, raison: "Ce nom appartient à un autre vaccin : la conversion automatique est impossible." }
          : preparerConversionProtocole(etapesExistantes, idsDemandes);
      const nomVaccin = medicament?.nom ?? label.trim();
      const error = conversion.possible
        ? `Un protocole existe déjà pour ${nomVaccin}. Mettre à jour ce protocole ?`
        : `Un protocole existe déjà pour ${nomVaccin}. ${conversion.raison}`;
      return NextResponse.json({
        error,
        code: "PROTOCOLE_EXISTANT",
        protocole: {
          id: existant.id, nom: existant.nom, label: existant.label,
          configurationQuestionnairePresente: Boolean(existant.configurationQuestionnaireJson),
          memeVaccin, etapes: etapesExistantes, conversion,
        },
      }, { status: 409 });
    }
    const protocole = await prisma.protocoleVaccin.create({
      data: {
        nom: nomInterne,
        label: label.trim(),
        ordre: ordre ?? 99,
        ageMinJours: ageMinJours ?? 0,
        ageMaxJours: ageMaxJours ?? null,
        urgenceJours: urgenceJours ?? null,
        estRappel: estRappel ?? false,
        primoNom: primoNom?.trim() || null,
        delaiRappelJours: delaiRappelJours ?? null,
        urgenceRappelJours: urgenceRappelJours ?? null,
        obligatoireVente: obligatoireVente ?? false,
        description: description?.trim() || null,
        categoriesJson: Array.isArray(categories) ? JSON.stringify(categories) : null,
        sexeCible: sexeCible || null, stadeReproduction: stadeReproduction || null, gestante: gestante ?? null,
        rangVelageMin: rangVelageMin ?? null, rangVelageMax: rangVelageMax ?? null, lotCible: lotCible || null,
        configurationQuestionnaireJson: configurationJson,
        etapes: { create: (Array.isArray(etapes) ? etapes : []).map((e: any, index: number) => ({ ...(e.id ? { id: e.id } : {}), label: e.label, ordre: index, cycle: e.cycle || "INITIAL", reference: e.reference || "NAISSANCE", debutValeur: Number(e.debutValeur) || 0, debutUnite: e.debutUnite || "JOUR", debutPosition: e.debutPosition || "APRES", finValeur: Number(e.finValeur) || 0, finUnite: e.finUnite || "JOUR", finPosition: e.finPosition || "APRES", recurrenceMois: e.recurrenceMois ? Number(e.recurrenceMois) : null, obligatoire: e.obligatoire !== false, medicaments: { create: (e.medicaments || []).filter((m: any) => m.medicamentId).map((m: any) => ({ medicamentId: m.medicamentId, voie: m.voie || null, preconisationId: m.preconisationId || null, alternative: Boolean(m.alternative) })) } })) },
        actif: true,
      },
    });
    const desc = `Protocole '${protocole.label}' créé`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_PROTOCOLE", desc, { op: "delete", model: "protocoleVaccin", id: protocole.id });
    } catch {}

    return NextResponse.json({ ...protocole, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const message = cibleErreurUniqueContientNom(error.meta)
        ? "Un protocole utilise déjà ce nom"
        : "Une donnée de ce protocole existe déjà";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("Échec de création du protocole vaccinal", error);
    return NextResponse.json({ error: "Le protocole n’a pas pu être enregistré" }, { status: 500 });
  }
}
