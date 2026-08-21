export function getMotherWeaningDisplay(input: {
  motherNutrav: string | null;
  sevreFait: boolean;
  dateSevrage: string | null;
}) {
  if (!input.motherNutrav) return { motherLabel: "—", statusLabel: null, weaned: null };
  if (!input.sevreFait) return { motherLabel: input.motherNutrav, statusLabel: "Non sevrée", weaned: false };
  const dateLabel = input.dateSevrage
    ? new Intl.DateTimeFormat("fr-FR").format(new Date(input.dateSevrage))
    : null;
  return { motherLabel: input.motherNutrav, statusLabel: dateLabel ? `Sevrée · ${dateLabel}` : "Sevrée", weaned: true };
}
