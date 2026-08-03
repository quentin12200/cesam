export function buildVelageEditHref(velageId: string, returnTo: string) {
  const params = new URLSearchParams({ modifier: velageId, returnTo });
  return `/velage?${params.toString()}`;
}
