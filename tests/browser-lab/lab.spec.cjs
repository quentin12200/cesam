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
 await page.getByLabel("Cycle de reproduction postérieur au vêlage").check();
 await expect(page.getByLabel("Cycle de reproduction postérieur au vêlage")).toBeChecked();
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
 await cow.getByLabel("Enregistrer un taureau ?").selectOption("demo-bull");
 await cow.getByRole("button",{name:"Pleine",exact:true}).click();
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
