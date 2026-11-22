/** Tracks successful writes during a partially completed session.
 * This is client-side retry protection, NOT server-side idempotency: an uncertain
 * network response must be reconciled before retrying the same operation.
 */
export function pendingIndexes(total: number, completed: ReadonlySet<number>): number[] {
  return Array.from({ length: total }, (_, index) => index).filter(index => !completed.has(index));
}
export function markCompleted(completed: ReadonlySet<number>, index: number): Set<number> {
  return new Set([...completed, index]);
}
export function hasUncertainWrite(error: unknown): boolean {
  return error instanceof TypeError;
}
