export function isLabRoute(pathname: string | null): boolean {
 return ["/lab", "/prototype-espace-travail", "/prototype-accueil-v3"].some(root=>pathname===root||pathname?.startsWith(root+"/"));
}
