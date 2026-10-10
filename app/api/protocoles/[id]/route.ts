import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { etapeIdsConfigurationQuestionnaire, lireConfigurationQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";
import { referencesPharmacieValides } from "@/lib/vaccine-protocol-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    label, actif, ageMinJours, urgenceJours,
    delaiRappelJours, urgenceRappelJours, obligatoireVente, ordre,
    voiePrimo, voieRappel, rappelAnnuel, description, categories, sexeCible, stadeReproduction, gestante, rangVelageMin, rangVelageMax, lotCible, ageMaxJours, etapes, configurationQuestionnaire,
  } = body;

  const prev = await prisma.protocoleVaccin.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Protocole non trouvé" }, { status: 404 });
  const configurationJson = configurationQuestionnaire === undefined
    ? undefined
    : configurationQuestionnaire == null ? null : JSON.stringify(configurationQuestionnaire);
  const configuration = configurationJson == null ? null : lireConfigurationQuestionnaire(configurationJson);
  if (configurationJson != null && !configuration) {
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
  if (Array.isArray(etapes) && (configurationJson != null || prev.configurationQuestionnaireJson != null)) {
    const idsConserves = new Set(etapes.map((etape: { id?: string }) => etape.id).filter(Boolean));
    const [aRetirer, conflit] = await Promise.all([
      prisma.etapeProtocoleVaccin.findMany({ where: { protocoleId: id, id: { notIn: [...idsConserves] as string[] } }, select: { id: true, _count: { select: { vaccinations: true, traitements: true } } } }),
      prisma.etapeProtocoleVaccin.findFirst({ where: { id: { in: [...idsConserves] as string[] }, protocoleId: { not: id } }, select: { id: true } }),
    ]);
    if (conflit) return NextResponse.json({ error: "Identifiant d’étape déjà utilisé par un autre protocole" }, { status: 409 });
    if (aRetirer.some((etape) => etape._count.vaccinations > 0 || etape._count.traitements > 0)) {
      return NextResponse.json({ error: "Une étape déjà utilisée ne peut pas être supprimée. Désactivez plutôt le protocole et créez-en un nouveau." }, { status: 409 });
    }
  }

  const prevFields: Record<string, unknown> = {};
  if (label !== undefined) prevFields.label = prev.label;
  if (actif !== undefined) prevFields.actif = prev.actif;
  if (ageMinJours !== undefined) prevFields.ageMinJours = prev.ageMinJours;
  if (urgenceJours !== undefined) prevFields.urgenceJours = prev.urgenceJours;
  if (delaiRappelJours !== undefined) prevFields.delaiRappelJours = prev.delaiRappelJours;
  if (urgenceRappelJours !== undefined) prevFields.urgenceRappelJours = prev.urgenceRappelJours;
  if (obligatoireVente !== undefined) prevFields.obligatoireVente = prev.obligatoireVente;
  if (ordre !== undefined) prevFields.ordre = prev.ordre;
  if (voiePrimo !== undefined) prevFields.voiePrimo = (prev as Record<string, unknown>).voiePrimo;
  if (voieRappel !== undefined) prevFields.voieRappel = (prev as Record<string, unknown>).voieRappel;
  if (rappelAnnuel !== undefined) prevFields.rappelAnnuel = (prev as Record<string, unknown>).rappelAnnuel;

  try {
    const protocole = await prisma.protocoleVaccin.update({
      where: { id },
      data: {
        ...(label !== undefined && { label: label.trim() }),
        ...(actif !== undefined && { actif }),
        ...(ageMinJours !== undefined && { ageMinJours }),
        ...(urgenceJours !== undefined && { urgenceJours }),
        ...(delaiRappelJours !== undefined && { delaiRappelJours }),
        ...(urgenceRappelJours !== undefined && { urgenceRappelJours }),
        ...(obligatoireVente !== undefined && { obligatoireVente }),
        ...(ordre !== undefined && { ordre }),
        ...(voiePrimo !== undefined && { voiePrimo }),
        ...(voieRappel !== undefined && { voieRappel }),
        ...(rappelAnnuel !== undefined && { rappelAnnuel }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(categories !== undefined && { categoriesJson: JSON.stringify(categories) }),
        ...(sexeCible !== undefined && { sexeCible: sexeCible || null }), ...(stadeReproduction !== undefined && { stadeReproduction: stadeReproduction || null }),
        ...(gestante !== undefined && { gestante }), ...(rangVelageMin !== undefined && { rangVelageMin }), ...(rangVelageMax !== undefined && { rangVelageMax }),
        ...(lotCible !== undefined && { lotCible: lotCible || null }), ...(ageMaxJours !== undefined && { ageMaxJours }),
        ...(configurationJson !== undefined && { configurationQuestionnaireJson: configurationJson }),
      },
    });
    if (Array.isArray(etapes)) {
      if (configurationJson != null || prev.configurationQuestionnaireJson != null) {
        const idsConserves = etapes.map((etape: { id: string }) => etape.id);
        await prisma.etapeProtocoleVaccin.deleteMany({ where: { protocoleId: id, id: { notIn: idsConserves } } });
        for (const [index, e] of etapes.entries()) {
          const data = { label: e.label, ordre: index, cycle: e.cycle || "INITIAL", reference: "NAISSANCE", debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 0, finUnite: "JOUR", finPosition: "APRES", recurrenceMois: null, obligatoire: true };
          await prisma.etapeProtocoleVaccin.upsert({
            where: { id: e.id },
            create: { id: e.id, protocoleId: id, ...data },
            update: data,
          });
          await prisma.etapeProtocoleMedicament.deleteMany({ where: { etapeId: e.id } });
          for (const m of (e.medicaments || []).filter((item: any) => item.medicamentId)) {
            await prisma.etapeProtocoleMedicament.create({ data: { etapeId: e.id, medicamentId: m.medicamentId, voie: null, preconisationId: m.preconisationId || null, alternative: false } });
          }
        }
      } else {
        await prisma.etapeProtocoleVaccin.deleteMany({ where: { protocoleId: id } });
        for (const [index, e] of etapes.entries()) await prisma.etapeProtocoleVaccin.create({ data: { ...(e.id ? { id: e.id } : {}), protocoleId: id, label: e.label, ordre: index, cycle: e.cycle || "INITIAL", reference: e.reference || "NAISSANCE", debutValeur: Number(e.debutValeur) || 0, debutUnite: e.debutUnite || "JOUR", debutPosition: e.debutPosition || "APRES", finValeur: Number(e.finValeur) || 0, finUnite: e.finUnite || "JOUR", finPosition: e.finPosition || "APRES", recurrenceMois: e.recurrenceMois ? Number(e.recurrenceMois) : null, obligatoire: e.obligatoire !== false, medicaments: { create: (e.medicaments || []).filter((m: any) => m.medicamentId).map((m: any) => ({ medicamentId: m.medicamentId, voie: m.voie || null, preconisationId: m.preconisationId || null, alternative: Boolean(m.alternative) })) } } });
      }
    }

    const desc = `Protocole '${prev.label}' mis à jour`;
    let undoId = "";
    try {
      undoId = await logAction("PATCH_PROTOCOLE", desc, { op: "update", model: "protocoleVaccin", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...protocole, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Protocole non trouvé" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.protocoleVaccin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
