import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the First Contact game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Hi — First Contact<\/title>/i);
  assert.match(html, /First <span>contact\.<\/span>/);
  assert.match(html, /Hostiles/);
  assert.match(html, /Start mission/);
  assert.match(html, /blaster-receiver/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});

test("guards spawns and renders armed combatants", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function isOpenFloor/);
  assert.match(page, /function nearestOpenSpawn/);
  assert.match(page, /isOpenFloor\(target\.x, target\.y\)/);
  assert.match(page, /WORLD\[mapY\]\[mapX\] === "0"/);
  assert.match(page, /Rifle: stock, receiver, grip, sight, and barrel/);
  assert.match(page, /updateEnemyFire/);
  assert.match(page, /className="blaster-barrel"/);
  assert.match(css, /\.blaster-receiver/);
  assert.match(css, /\.blaster-grip/);
});
