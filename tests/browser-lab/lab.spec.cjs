const {test,expect}=require("@playwright/test");
const {createHmac}=require("node:crypto");
const base="http://127.0.0.1:4317";
function testToken(){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const now=Math.floor(Date.now()/1000);
 const data=enc({alg:"HS256"})+"."+enc({email:"gaec.cesam@gmail.com",iss:"cesam",iat:now,exp:now+3600});
 return data+"."+createHmac("sha256","local-fixture-only-not-a-production-secret").update(data).digest("base64url");
}
test.beforeEach(async({context,page})=>{
 await context.addCookies([{name:"cesam_session",value:testToken(),url:base,httpOnly:true,sameSite:"Lax"}]);
 const violations=[];
 await context.route("**/*",async route=>{
  const u=new URL(route.request().url());
  if(u.origin!==base||!(u.pathname==="/lab"||u.pathname==="/prototype-espace-travail"||u.pathname==="/prototype-accueil-v3"||u.pathname.startsWith("/_next/")||/^\/__nextjs_font\/geist-[a-z-]+\.woff2$/.test(u.pathname)||["/logo-cesam.jpg","/favicon.ico","/manifest.json"].includes(u.pathname))){violations.push(u.origin+u.pathname);return route.abort();}
  return route.continue();
 });
 page.on("pageerror",error=>violations.push([error.message,error.stack].filter(Boolean).join("\n")));
 page.on("response",response=>{if(response.request().resourceType()==="script"&&!response.ok()&&response.status()!==304)violations.push("Script HTTP "+response.status()+" "+response.url());});
 page.__violations=violations;
});
test.afterEach(async({page})=>{expect(page.__violations).toEqual([]);});
test("recherche, tri et ouverture d'un animal fictif",async({page})=>{
 await page.goto("/lab");
 await expect(page.getByText("CESAM LAB · Données fictives",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Troupeau",exact:true}).click();
 await page.getByRole("textbox",{name:"Rechercher un animal"}).fill("6201");
 await expect(page.getByText("Lilas",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Trier par N°"}).click();
 await page.getByRole("button",{name:"Actions de 6201"}).click();
 await expect(page.getByText("Actions individuelles · démonstration")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test("pesée fictive, contrôle de saisie et remise à zéro",async({page})=>{
 await page.goto("/lab");
 await page.getByRole("button",{name:"Créer",exact:true}).click();
 await page.getByRole("button",{name:/Passage à la contention/}).click();
 await page.getByRole("button",{name:/Commencer la simulation/}).click();
 await page.getByPlaceholder("Taper le numéro…").fill("6201");
 const weight=page.getByRole("spinbutton",{name:"Poids en kilogrammes"});
 const mark=page.getByRole("button",{name:/Marquer fait/}).first();
 await expect(mark).toBeDisabled();
 await weight.fill("345");
 await mark.click();
 await expect(page.getByText("1 bovin(s) traités")).toBeVisible();
 await page.getByRole("button",{name:"Suivi de la simulation"}).click();
 await expect(page.getByText("poids : 345 kg")).toBeVisible();
 await page.reload({waitUntil:"load"});
 await expect(page.getByText("À faire et à prévoir")).toBeVisible();
});

test("vêlage jumeaux mixtes : historique, filiation et réinitialisation",async({page})=>{
 await page.goto("/lab");
 await page.getByLabel("Nombre de veaux").selectOption("2");
 await page.getByLabel("Numéro du veau 1").fill("9901");
 await page.getByLabel("État du veau 2").selectOption("MORT_NE");
 await expect(page.getByLabel("Numéro du veau 2")).toHaveCount(0);
 await page.getByLabel("Père déclaré").selectOption("DEMO-PERE-A");
 await page.getByLabel("Père issu de la gestation").selectOption("DEMO-PERE-A");
 await page.getByRole("button",{name:"Simuler le vêlage"}).click();
 await expect(page.getByText("Naissances : 2",{exact:true})).toBeVisible();
 await expect(page.getByText("Fiches animales simulées : 1",{exact:true})).toBeVisible();
 await expect(page.getByText("Boucles consommées : 1",{exact:true})).toBeVisible();
 await expect(page.getByText("Mort-nés : 1",{exact:true})).toBeVisible();
 await expect(page.getByText("Veau 2 : historique uniquement · Père : DEMO-PERE-A",{exact:true})).toBeVisible();
 await expect(page.getByText("Statut manuel de la mère réinitialisé",{exact:true})).toBeVisible();
 await page.reload({waitUntil:"load"});
 await expect(page.getByText("Naissances : 2",{exact:true})).toHaveCount(0);
});
test("vêlage : filiation contradictoire et cycle postérieur",async({page})=>{
 await page.goto("/lab");
 await page.getByLabel("Numéro du veau 1").fill("9901");
 await page.getByLabel("Père déclaré").selectOption("DEMO-PERE-A");
 await page.getByLabel("Père issu de la gestation").selectOption("DEMO-PERE-B");
 await page.getByRole("button",{name:"Simuler le vêlage"}).click();
 await expect(page.getByText("Filiation contradictoire : vérifier le père",{exact:true})).toBeVisible();
 await expect(page.getByText("Naissances : 1",{exact:true})).toHaveCount(0);
 await page.getByLabel("Père issu de la gestation").selectOption("DEMO-PERE-A");
 await expect(page.getByLabel("Père issu de la gestation")).toHaveValue("DEMO-PERE-A");
 await expect(page.getByText("Filiation contradictoire : vérifier le père",{exact:true})).toHaveCount(0);
 await page.getByLabel("Cycle de reproduction postérieur au vêlage").check();
 await expect(page.getByLabel("Cycle de reproduction postérieur au vêlage")).toBeChecked();
 await expect(page.getByLabel("Numéro du veau 1")).toHaveValue("9901");
 await expect(page.getByLabel("Père déclaré")).toHaveValue("DEMO-PERE-A");
 await page.getByRole("button",{name:"Simuler le vêlage"}).click();
 await expect(page.getByText("Cycle ultérieur préservé",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test("validation du père : retour au contexte et prochain contrôle",async({page})=>{
 await page.goto("/lab");
 const section=page.getByRole("region",{name:"Contrôle fictif des filiations"});
 await section.getByLabel("Filtre de vérification").selectOption("tous");
 await section.getByRole("button",{name:"Vérifier demo-1"}).click();
 await section.getByLabel("Père à valider").selectOption("A");
 await section.getByRole("button",{name:"Valider le père fictif"}).click();
 await expect(section.getByText("2 filiations fictives restantes")).toBeVisible();
 await expect(section.getByLabel("Filtre de vérification")).toHaveValue("tous");
 await expect(section.locator("#filiation-demo-2")).toBeFocused();
 await expect(section.getByRole("button",{name:"Vérifier demo-1"})).toHaveCount(0);
});

test("écho : père, événement personnalisé et action avec échéance",async({page})=>{
 await page.goto("/lab");
 await page.getByRole("button",{name:"Séance écho fictive"}).click();
 const dialog=page.getByRole("dialog",{name:"Saisie d’une séance d’échographies"});
 await expect(dialog.getByText(/Père : Père démo/)).toBeVisible();
 const cow=dialog.locator("article").filter({hasText:"9802"});
 await cow.getByRole("button",{name:"Pleine",exact:true}).click();
 await cow.getByRole("button",{name:"Taureau Choisir"}).click();
 const picker=page.getByRole("dialog",{name:"Choisir un taureau"});
 await expect(picker.getByRole("button",{name:/Taureau démo|AAA IA/}).first()).toContainText("Taureau démo");
 await picker.getByPlaceholder("Nom ou numéro du taureau").fill("DEMO");
 await picker.getByRole("button",{name:/Taureau démo/}).click();
 await cow.getByRole("button",{name:/Événements · Actions · Note/}).click();
 await expect(cow.getByRole("button",{name:"Cyclée",exact:true})).toBeVisible();
 await expect(cow.getByRole("checkbox",{name:"À revérifier",exact:true})).toBeVisible();
 await cow.getByRole("button",{name:"Cyclée",exact:true}).click();
 await cow.getByRole("button",{name:"Non cyclée",exact:true}).click();
 await expect(cow.getByRole("button",{name:"Cyclée",exact:true})).toHaveAttribute("aria-pressed","false");
 await cow.getByRole("button",{name:"+ Ajouter un événement",exact:true}).click();
 await cow.getByLabel("Rechercher ou créer un événement").fill("Contrôle fictif");
 await cow.getByRole("button",{name:"Créer et sélectionner"}).click();
 await expect(cow.getByRole("button",{name:"Contrôle fictif ×"})).toBeVisible();
 await cow.getByRole("checkbox",{name:"À revérifier",exact:true}).check();
 await cow.getByLabel("Échéance À revérifier").fill("2099-01-01");
 await dialog.getByRole("button",{name:/Enregistrer 1 résultat/}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.locator("pre").filter({hasText:"demo-echo-b"})).toContainText("Contrôle fictif");
 await expect(page.locator("pre").filter({hasText:"demo-echo-b"})).toContainText("2099-01-01");
 await expect(page.locator("pre").filter({hasText:"demo-echo-b"})).toContainText("demo-bull");
});

test("écho : action personnalisée réutilisée sans doublon",async({page})=>{await page.goto("/lab");await page.getByRole("button",{name:"Séance écho fictive"}).click();const dialog=page.getByRole("dialog",{name:"Saisie d’une séance d’échographies"});const a=dialog.locator("article").filter({hasText:"9801"}),b=dialog.locator("article").filter({hasText:"9802"});await a.getByRole("button",{name:/Événements · Actions · Note/}).click();await b.getByRole("button",{name:/Événements · Actions · Note/}).click();await a.getByRole("button",{name:"+ Ajouter une action",exact:true}).click();await a.getByLabel("Rechercher ou créer une action").fill("Prélèvement fictif");await a.getByRole("button",{name:"Créer et sélectionner l’action"}).click();await a.getByLabel("Échéance Prélèvement fictif").fill("2099-01-02");await b.getByRole("button",{name:"+ Ajouter une action",exact:true}).click();await b.getByLabel("Rechercher ou créer une action").fill("prelevement fictif");await b.getByRole("button",{name:"Prélèvement fictif",exact:true}).click();await b.getByLabel("Échéance Prélèvement fictif").fill("2099-01-03");await b.getByRole("button",{name:"+ Ajouter une action",exact:true}).click();await b.getByLabel("Rechercher ou créer une action").fill("PRELEVEMENT FICTIF");await b.getByRole("button",{name:"Créer et sélectionner l’action"}).click();await expect(b.getByLabel("Échéance Prélèvement fictif")).toHaveCount(1);await dialog.getByRole("button",{name:/Enregistrer 2 résultats/}).click();await expect(dialog).toHaveCount(0);const data=JSON.parse(await page.locator("pre").filter({hasText:"demo-echo-b"}).innerText());expect(data.resultats.map(r=>r.actions)).toEqual([[{type:"Prélèvement fictif",due:"2099-01-02"}],[{type:"Prélèvement fictif",due:"2099-01-03"}]]);});

test("raccourci échographies : compteur et destination sur écran ordinateur et iPhone",async({page})=>{
 await page.goto("/lab");
 const shortcut=page.getByRole("region",{name:"Raccourci échographie fictif"}).getByRole("link",{name:/Échographies à faire/});
 await expect(shortcut).toBeVisible();
 await expect(shortcut).toHaveAttribute("href","/reproduction?filtre=JAUNE");
 await expect(shortcut.getByLabel("Nombre de femelles à échographier")).toHaveText(/^\d+$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test("bouclage fictif : annulation puis confirmation",async({page})=>{
 await page.goto("/lab");
 const zone=page.getByRole("region",{name:"Bouclage fictif"});
 const button=zone.getByRole("button",{name:"Marquer bouclé"});
 page.once("dialog",d=>d.dismiss()); await button.click(); await expect(button).toBeVisible();
 page.once("dialog",d=>d.accept()); await button.click();
 await expect(zone.getByRole("status")).toHaveText("Boucle posée (simulation)");
 await expect(button).toHaveCount(0);
});

test("écho compacte : largeur 320, 375 et 390 et conservation des saisies",async({page})=>{
 for(const width of [320,375,390]){
 await page.setViewportSize({width,height:844}); await page.goto("/lab");
 await page.getByRole("button",{name:"Séance écho fictive"}).click();
 const dialog=page.getByRole("dialog",{name:"Saisie d’une séance d’échographies"});
 const cow=dialog.locator("article").filter({hasText:"9802"});
 await expect(cow.getByRole("button",{name:"Cyclée",exact:true})).toBeHidden();
 expect((await cow.boundingBox()).height).toBeLessThan(180);
 expect(await dialog.evaluate(el=>[el,...el.querySelectorAll("header,main,article,footer")].every(n=>n.scrollWidth<=n.clientWidth+1))).toBe(true);
 await cow.getByRole("button",{name:/Événements · Actions · Note/}).click();
 await cow.getByPlaceholder("Note facultative").fill("Note fictive");
 await cow.getByRole("button",{name:"Note",exact:true}).click();
 await cow.getByRole("button",{name:"Note",exact:true}).click();
 await expect(cow.getByPlaceholder("Note facultative")).toHaveValue("Note fictive");
 await dialog.getByRole("button",{name:"Fermer",exact:true}).click();
 }
});

test("actions rapides : ouverture, fermeture extérieure et clavier",async({page})=>{
 await page.goto("/lab");
 const zone=page.getByRole("region",{name:"Actions rapides fictives"});
 const button=zone.getByRole("button",{name:"Actions",exact:true});
 const menu=zone.getByRole("group",{name:"Actions rapides"});
 await button.click(); await expect(menu).toBeVisible();
 await expect(menu.getByRole("button",{name:"Pesée"})).toBeVisible();
 await expect(menu.getByRole("button",{name:"Saillie / IA"})).toBeVisible();
 await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
 await button.click(); await zone.getByRole("heading").click(); await expect(menu).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

 test("posologies compactes : simulation ordinateur et iPhone",async({page})=>{
 for(const width of [1280,320,375,390]){
 await page.setViewportSize({width,height:844}); await page.goto("/lab");
 const zone=page.getByRole("region",{name:"Traitement fictif"});
 const ref=zone.getByRole("region",{name:"Informations de posologie de la pharmacie"});
 await expect(ref.getByRole("table")).toBeVisible(); await expect(ref.getByRole("alert")).toBeVisible();
 expect((await ref.boundingBox()).height).toBeLessThan(330);
 expect(await ref.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const dose=zone.getByLabel("Dose administrée"); await expect(dose).toHaveValue(""); await dose.fill("7");
 await expect(ref.getByText(/Fréquence/).first()).toBeHidden();
 await ref.locator("summary").click(); await expect(ref.getByText(/Fréquence/).first()).toBeVisible();
 await ref.locator("summary").click(); await expect(dose).toHaveValue("7");
 await zone.getByTitle("Changer de médicament").click(); await zone.getByRole("combobox").filter({has:page.locator("option")}).count();
 await zone.getByPlaceholder("Tapez le nom ou la substance active…").fill("TOLFINE"); await zone.getByRole("option",{name:/TOLFINE/}).click(); await expect(dose).toHaveValue("");
 }
 });

test("dose réelle : décimales, unité séparée et refus du texte libre",async({page})=>{
 await page.goto("/lab");
 const zone=page.getByRole("region",{name:"Traitement fictif"});
 const dose=zone.getByLabel("Dose administrée");
 const unit=zone.getByLabel("Unité de dose");
 const output=zone.getByLabel("Dose fictive normalisée");
 await expect(dose).toHaveValue("");
 await expect(dose).toHaveAttribute("inputmode","decimal");
 await expect(unit).toHaveValue("ml");
 await dose.fill("2,5"); await expect(output).toHaveText("2.5 ml");
 await dose.fill("2.5"); await expect(output).toHaveText("2.5 ml");
 await unit.selectOption("bolus"); await expect(output).toHaveText("2.5 bolus");
 await dose.fill("2 ml"); await expect(output).toHaveText("Dose à renseigner ou invalide");
 await dose.fill("1"); await unit.selectOption(""); await expect(output).toHaveText("Dose à renseigner ou invalide");
 await expect(unit.locator('option[value="cc"]')).toHaveCount(0);
});

test("médicament provisoire : création, doublon, délais inconnus et zéro explicite",async({page})=>{
 await page.goto("/lab");
 const zone=page.getByRole("region",{name:"Traitement fictif"});
 await zone.getByTitle("Changer de médicament").click();
 const search=zone.getByPlaceholder("Tapez le nom ou la substance active…");
 await search.fill("Produit fictif");
 await zone.getByRole("button",{name:/Créer « Produit fictif »/}).click();
 await expect(zone.getByText("Fiche provisoire à compléter en pharmacie")).toBeVisible();
 await expect(zone.getByLabel("Nombre de médicaments fictifs")).toHaveText("2");
 await expect(zone.getByLabel("Délai viande en jours")).toHaveValue("");
 await expect(zone.getByLabel("Délai lait en jours")).toHaveValue("");
 await expect(zone.getByLabel("Dose administrée")).toHaveValue("");
 await zone.getByLabel("Voie d’administration").selectOption("PO");
 await zone.getByLabel("Dose administrée").fill("1");
 await zone.getByLabel("Unité de dose").selectOption("bolus");
 await zone.getByRole("button",{name:"Enregistrer le soin fictif"}).click();
 const a=zone.getByLabel("Acte fictif 1");
 await expect(a).toContainText("Viande inconnue · Lait inconnu");
 await zone.getByLabel("Délai lait en jours").fill("0");
 await zone.getByRole("button",{name:"Enregistrer le soin fictif"}).click();
 const b=zone.getByLabel("Acte fictif 2");
 await expect(b).toContainText("Viande inconnue · Lait renseigné");
 await a.getByRole("button",{name:"Confirmer zéro fictif pour cet acte"}).click();
 await expect(a).toContainText("Viande renseignée · Lait inconnu");
 await expect(b).toContainText("Viande inconnue · Lait renseigné");
 await zone.getByTitle("Changer de médicament").click();
 await search.fill("produit fictif");
 await expect(zone.getByRole("button",{name:/Créer «/})).toHaveCount(0);
 await zone.getByRole("option",{name:/PRODUIT FICTIF/}).click();
 await expect(zone.getByLabel("Nombre de médicaments fictifs")).toHaveText("2");
});

test("restriction lait : case compacte, champ désactivé et viande indépendante",async({page})=>{
 await page.goto("/lab");const zone=page.getByRole("region",{name:"Traitement fictif"});
 await zone.getByTitle("Changer de médicament").click();
 await zone.getByPlaceholder("Tapez le nom ou la substance active…").fill("Produit fictif interdit");
 await zone.getByRole("button",{name:/Créer « Produit fictif interdit »/}).click();
 const viande=zone.getByLabel("Délai viande en jours");const lait=zone.getByLabel("Délai lait en jours");
 await viande.fill("0");await zone.getByLabel("Délai lait interdit").check();
 await expect(lait).toBeDisabled();await expect(lait).toHaveValue("");await expect(viande).toHaveValue("0");
 await zone.getByLabel("Délai lait interdit").uncheck();await expect(lait).toBeEnabled();await expect(lait).toHaveValue("");
});

test("exécutant : profil actif en premier et choix manuel conservé",async({page})=>{
 await page.goto("/lab");
 const zone=page.getByRole("region",{name:"Exécutant fictif"});
 const select=zone.getByLabel("Exécutant");
 await zone.getByRole("button",{name:"Profil Céline"}).click();
 await expect(select).toHaveValue("Céline");
 expect(await select.locator("option").allTextContents()).toEqual(["Sélectionner…","Céline","Samuel","A Démo","Z Démo"]);
 await zone.getByRole("button",{name:"Profil Samuel"}).click();
 await expect(select).toHaveValue("Samuel");
 expect(await select.locator("option").allTextContents()).toEqual(["Sélectionner…","Samuel","Céline","A Démo","Z Démo"]);
 await select.selectOption("A Démo");
 await zone.getByRole("button",{name:"Profil Céline"}).click();
 await expect(select).toHaveValue("A Démo");
 await zone.getByRole("button",{name:"Nouvel acte fictif"}).click();
 await expect(select).toHaveValue("Céline");
});
