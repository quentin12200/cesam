import { shouldDisplayNonWeaned } from "./troupeau-display.ts";

export function getMotherWeaningDisplay(input: {
  motherNutrav: string | null;
  sevreFait: boolean;
  birthDate: string | Date;
  now?: Date;
}) {
  const nonWeaned = shouldDisplayNonWeaned(input.birthDate, input.sevreFait, input.now);
  return {
    motherLabel: input.motherNutrav?.trim() || "—",
    statusLabel: nonWeaned ? "Non sevré" : null,
    weaned: !nonWeaned,
  };
}
