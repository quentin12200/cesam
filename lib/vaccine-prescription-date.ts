/** Compare calendar days, not instants: an ordonnance issued on injection day is valid. */
export function ordonnanceCompatibleDate(dateOrdonnance: Date | string, dateInjection: Date | string): boolean {
  const jour = (value: Date | string) => {
    const date = value instanceof Date ? value.toISOString() : value;
    const iso = date.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) ? iso : null;
  };
  const ordonnance = jour(dateOrdonnance);
  const injection = jour(dateInjection);
  return ordonnance !== null && injection !== null && ordonnance <= injection;
}
