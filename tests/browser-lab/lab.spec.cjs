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
 page.on("pageerror",error=>violations.push(error.message));
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
 await page.reload();
 await expect(page.getByText("À faire et à prévoir")).toBeVisible();
});
