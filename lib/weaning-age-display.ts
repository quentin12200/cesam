export function formatWeaningAgeDays(days: number): string {
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;

  if (months === 0) return `${remainingDays} j`;
  if (remainingDays === 0) return `${months} mois`;

  return `${months} mois ${remainingDays} j`;
}
