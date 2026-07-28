export interface WebPushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function createWebPushPayload(payload: WebPushPayload) {
  return JSON.stringify(payload);
}

export function heatReturnNotificationTag(animalId: string, heatId: string) {
  return `retour-chaleur-${animalId}-${heatId}`;
}

export function morningDigestNotificationTag(date: Date) {
  return `cesam-morning-digest-${date.toISOString().slice(0, 10)}`;
}
