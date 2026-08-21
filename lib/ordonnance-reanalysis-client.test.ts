import assert from "node:assert/strict";
import test from "node:test";
import { chargerPagesOrdonnance } from "./ordonnance-reanalysis-client.ts";

test("recharge toutes les pages originales dans leur ordre", async () => {
  const urlsDemandees: string[] = [];
  const fetcher = (async (url: string | URL | Request) => {
    const valeur = String(url);
    urlsDemandees.push(valeur);
    return new Response(new Blob([valeur], { type: "image/jpeg" }), { status: 200 });
  }) as typeof fetch;

  const pages = await chargerPagesOrdonnance(["page-1.jpg", "page-2.jpg"], fetcher);

  assert.deepEqual(urlsDemandees, ["page-1.jpg", "page-2.jpg"]);
  assert.deepEqual(pages.map((page) => page.name), ["ordonnance-page-1.jpg", "ordonnance-page-2.jpg"]);
  assert.equal(await pages[0].text(), "page-1.jpg");
  assert.equal(await pages[1].text(), "page-2.jpg");
});

test("échoue avant tout nouveau scan si une page originale est inaccessible", async () => {
  const fetcher = (async () => new Response(null, { status: 404 })) as typeof fetch;
  await assert.rejects(
    chargerPagesOrdonnance(["page-1.jpg"], fetcher),
    /page 1.*inaccessible/i,
  );
});
