export function getMotherWeaningDisplay(input: {
  motherNutrav: string | null;
  sevreFait: boolean;
}) {
  return {
    motherLabel: input.motherNutrav?.trim() || "—",
    statusLabel: input.sevreFait ? null : "Non sevrée",
    weaned: input.sevreFait,
  };
}
