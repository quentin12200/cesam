export type RoleEtapeProtocole = "dose" | "primo" | "rappel" | "entretien";

export type EtapeProtocoleExistante = {
  id: string;
  label: string;
  cycle: string;
  vaccinationsCount: number;
  traitementsCount: number;
};

export type ConversionProtocole =
  | { possible: true; ids: Record<RoleEtapeProtocole, string | null> }
  | { possible: false; raison: string };

export function roleEtapeProtocole(etape: Pick<EtapeProtocoleExistante, "label" | "cycle">): RoleEtapeProtocole | null {
  const label = etape.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (etape.cycle === "ENTRETIEN" || label.includes("ENTRETIEN")) return "entretien";
  if (label.includes("PRIMO")) return "primo";
  if (label.includes("RAPPEL")) return "rappel";
  if (label.includes("DOSE UNIQUE")) return "dose";
  return null;
}

export function preparerConversionProtocole(
  etapes: ReadonlyArray<EtapeProtocoleExistante>,
  idsDemandes: Record<RoleEtapeProtocole, string | null>,
): ConversionProtocole {
  const rolesDemandes = new Set<RoleEtapeProtocole>(
    (Object.entries(idsDemandes) as Array<[RoleEtapeProtocole, string | null]>)
      .filter(([, id]) => Boolean(id))
      .map(([role]) => role),
  );
  const utilisees = etapes.filter((etape) => etape.vaccinationsCount > 0 || etape.traitementsCount > 0);
  const utiliseesParRole = new Map<RoleEtapeProtocole, EtapeProtocoleExistante[]>();

  for (const etape of utilisees) {
    const role = roleEtapeProtocole(etape);
    if (!role || !rolesDemandes.has(role)) {
      return { possible: false, raison: `L’étape historique « ${etape.label} » ne peut pas être associée de façon sûre.` };
    }
    utiliseesParRole.set(role, [...(utiliseesParRole.get(role) ?? []), etape]);
  }
  for (const [role, candidates] of utiliseesParRole) {
    if (candidates.length > 1) {
      return { possible: false, raison: `Plusieurs étapes historiques correspondent au rôle ${role}.` };
    }
  }

  const ids = { ...idsDemandes };
  for (const role of rolesDemandes) {
    const utilisee = utiliseesParRole.get(role)?.[0];
    if (utilisee) {
      ids[role] = utilisee.id;
      continue;
    }
    const candidates = etapes.filter((etape) => roleEtapeProtocole(etape) === role && !utilisees.includes(etape));
    if (candidates.length === 1) ids[role] = candidates[0].id;
  }
  return { possible: true, ids };
}
