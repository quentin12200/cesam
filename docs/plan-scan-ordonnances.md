# Plan — Scan d'ordonnances (audit + feuille de route)

> Document de travail figé le 2026-07-15. Sert de point de reprise pour la
> suite du chantier « extraction IA d'ordonnances ». Décisions produit prises
> avec l'utilisateur en fin de session.

## Décisions actées

1. **Multi-médicaments → plusieurs ordonnances.** Une ordonnance papier peut
   lister 2-3 médicaments numérotés. À la validation, on crée **une
   `Ordonnance` distincte par médicament** (1 traitement = 1 ordonnance, on
   reste compatible avec l'existant).
2. **Priorité d'implémentation : sécurité d'abord, puis multi-photos.**

## Ce que révèlent les ordonnances réelles

- **Une ordonnance = plusieurs pages/photos.** Exemple observé :
  `ordonnance n°26-03-0290[V]` a une page 1/2 (médicament + posologie) et une
  page 2/2 (**délai d'attente viande/lait**). Le délai d'attente — champ le
  plus critique pour l'éleveur — est fréquemment sur une page différente du
  médicament. **Le multi-photos est nécessaire à la justesse, pas un confort.**
- **Une ordonnance = souvent plusieurs médicaments**, chacun avec son
  `n° lot`, sa posologie, sa quantité délivrée et son propre délai d'attente.
- Modèle très régulier (clinique « SELARL Vétérinaires des Bastides ») :
  en-tête clinique → cheptel/GAEC → vétérinaire + n° d'inscription →
  `ordonnance n°… / le JJ/MM/AAAA` → médicaments numérotés.

## Audit sécurité (à traiter EN PREMIER)

### 🔴 1. Cookie de session falsifiable
`lib/cesam-auth.ts` lit `cesam_session=<email>` **en clair** et le compare à
une liste d'emails écrite dans le dépôt. N'importe qui peut forger le cookie
et devenir « autorisé », donc lire toutes les ordonnances.
**Fix :** cookie signé (HMAC ou JWT via un secret serveur `CESAM_SESSION_SECRET`),
vérifié côté serveur. Prévoir l'invalidation des sessions existantes (re-login).

### 🔴 2. Routes non protégées
- `app/api/scan-ordonnance/route.ts` : **aucun** contrôle d'auth → proxy OpenAI
  ouvert sur la clé (`OPENAI_API_KEY`), abusable / coûteux.
- `app/api/extractions-ordonnance/**` : aucun contrôle d'auth.
- Il n'existe pas de `middleware.ts` racine qui rattrape `/api/*`.
**Fix :** appeler `getAuthorizedEmail` (version signée) au début de chaque route
ordonnance, ou un `middleware.ts` couvrant `/api/scan-ordonnance`,
`/api/extractions-ordonnance`, `/api/documents/ordonnances`.

## Audit fiabilité (après la sécurité)

- **PDF cassé pour l'IA.** `scan-ordonnance/route.ts` envoie le PDF en
  `image_url` à Chat Completions — non supporté. L'upload Firebase réussit mais
  l'analyse échoue. → passer à l'API Responses avec `input_file`, ou convertir
  le PDF en images côté serveur.
- **Limite de taille.** Le code annonce 10 Mo (`documents/ordonnances/route.ts`)
  mais Vercel coupe le corps des fonctions à 4,5 Mo, et le base64 gonfle de
  +33 %. → aligner la limite (~3 Mo de fichier) ou passer par un upload direct
  (signed URL) sans transiter le base64 dans le corps JSON.
- **« Vérifier plus tard » perd les saisies** tant que l'ordonnance n'est pas
  validée. → persister `valeursCorrigees` au fil de l'eau.
- **Pas de retour auto vers le traitement** quand le scan est lancé depuis un
  traitement (`TraitementForm.tsx`). → mémoriser l'origine et re-router +
  associer après validation.
- **Remplacement de document d'une ordonnance existante** utilise encore
  l'ancien envoi direct Firebase (parcours différent du nouveau).

## Feuille de route

### Étape 1 — Sécurité (invisible mais bloquante)
1. `CESAM_SESSION_SECRET` en variable d'env.
2. Signer le cookie à la connexion (`app/api/auth/session/route.ts`).
3. Vérifier la signature dans `lib/cesam-auth.ts`.
4. Ajouter le contrôle d'auth sur `scan-ordonnance` + `extractions-ordonnance`
   (ou `middleware.ts`).

### Étape 2 — Multi-photos + prompt + multi-médicaments
1. **UI** `app/ordonnances/OrdonnancesClient.tsx:303` : ajouter `multiple` à
   l'input `type="file"`, gérer un `FileList` (2-3 photos).
2. **Client** `lib/scan-ordonnance-client.ts` : uploader N documents, envoyer
   les N images en **un seul** appel scan (Chat Completions accepte plusieurs
   blocs `image_url` dans un message), stocker N `documentUrl`.
3. **Route scan** `app/api/scan-ordonnance/route.ts` : accepter un tableau
   d'images + nouveau prompt (ci-dessous) renvoyant un **tableau `medicaments`**.
4. **Schéma Prisma** `ExtractionOrdonnance` :
   - `documentUrl: String` → plusieurs documents (`documentUrls Json` ou table
     `DocumentExtraction` liée).
   - stocker plusieurs médicaments extraits (JSON dans `propositionInitiale`
     suffit sans doute, à décider).
   - migration dédiée.
5. **Validation** : créer **une `Ordonnance` par médicament** coché.
6. **Écran de vérification** `app/ordonnances/a-verifier/[id]/…` : afficher
   plusieurs pages + une liste de médicaments éditables.

## Prompt IA cible (calibré sur les exemples)

```
Tu analyses une ordonnance vétérinaire française pour bovins. On te fournit
UNE OU PLUSIEURS photos qui forment UNE SEULE ordonnance (pages 1/2, 2/2…) :
combine les informations de toutes les images. Réponds UNIQUEMENT en JSON valide.

Champs de l'ordonnance :
- ordonnanceNumero : n° imprimé (ex "26-03-0290"), sans le suffixe [V]
- datePrescription : "le JJ/MM/AAAA" → YYYY-MM-DD
- veterinaire : prénom + nom du prescripteur (ex "Valentine POURCEL")
- veterinaireNumeroInscription : n° national d'inscription si présent
- espece / race : ex "Bovins viande", "Blonde d'Aquitaine"
- renouvellementInterdit : true si "renouvellement interdit" apparaît

medicaments : TABLEAU, un objet par médicament numéroté (1-, 2-, …) :
- nom : nom commercial complet (ex "REPROSTENOL SYNCH SOL INJ 1 FL 2ML")
- numeroLot : après "n° lot"
- substanceActive, formePharmaceutique
- voie (IM/SC/IV/PO/nasale/cutanée), dose (nombre), uniteDosage (ml/mg…)
- posologie : résumé de l'administration
- quantiteDelivree : après "Délivré ce jour Qté"
- delaiAttenteViandeJ, delaiAttenteLaitJ : en jours (0 si "0 jour"/"0 heure").
  ATTENTION : souvent sur une page différente du médicament.

Mets null si une information n'est ni visible ni lisible. JSON uniquement.
```

## Vérifications faites côté audit
- Lecture du code : `scan-ordonnance/route.ts`, `scan-ordonnance-client.ts`,
  `documents/ordonnances/route.ts`, `cesam-auth.ts`, `OrdonnancesClient.tsx`,
  `prisma/schema.prisma` (modèle `ExtractionOrdonnance`).
- Absence de `middleware.ts` racine confirmée.
- Absence d'appel d'auth dans `app/api/extractions-ordonnance/` confirmée.
- Structure des ordonnances validée sur 3 photos d'exemple (multi-pages +
  multi-médicaments observés).
