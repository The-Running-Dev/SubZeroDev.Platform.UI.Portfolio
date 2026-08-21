import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { BuilderError, buildPortfolioSite, validateProvenanceManifestV1 } from "../src/builder.js";

const root = new URL("..", import.meta.url).pathname;
const builderUrl = pathToFileURL(join(root, "src/builder.js")).href;
const model = { version: 1, header: { title: "Built" }, statistics: [], categories: [], technologies: [], recentProjects: [] };

async function fixture({ route = "/work", invalid = false, badConfig = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-builder-"));
  const order = [];
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
const order = globalThis.__szdOrder;
const source = defineSource({ id: "portfolio", timing: "build", provider: { resolve: async () => { order?.push("provider"); return { value: ${JSON.stringify(model)}, metadata: [] }; } }, validateRaw: (value) => { order?.push("raw"); return ${invalid ? "{ ok: false, issues: [] }" : "{ ok: true, value }"}; }, project: (value) => { order?.push("project"); return value; }, viewModel: { validate: (value) => { order?.push("view"); return value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] }; } } });
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: ${JSON.stringify(route)}, metadata: { title: "Route" }, presentation: { kind: "portfolio", modelSourceId: "portfolio" }, requiredSourceIds: [${badConfig ? '"missing"' : '"portfolio"'}] }], sources: [source], styles: [], navigation: [], publicAssets: [] });`;
  await writeFile(join(dir, "site.mjs"), config);
  return { dir, order };
}

test("S11.1 rejects invalid configuration before provider I/O or output mutation", async (t) => {
  const { dir, order } = await fixture({ badConfig: true }); t.after(() => rm(dir, { recursive: true, force: true })); globalThis.__szdOrder = order;
  await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error instanceof BuilderError && error.code === "config.load_failed");
  assert.deepEqual(order, []);
  await assert.rejects(readFile(join(dir, "out")));
  delete globalThis.__szdOrder;
});

test("S11.2, S11.3, and S11.7 build only declared routes in deterministic declaration order", async (t) => {
  const { dir, order } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true })); globalThis.__szdOrder = order;
  const first = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  assert.deepEqual(order, ["provider", "raw", "project", "view"]);
  assert.match(await readFile(join(dir, "out/work/index.html"), "utf8"), /szd-portfolio-overview/);
  await assert.rejects(readFile(join(dir, "out/index.html")));
  assert.match(await readFile(join(dir, "out/assets/szd-portfolio-bootstrap.js"), "utf8"), /export/);
  const record = JSON.parse(await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8"));
  assert.deepEqual(record.routes, ["/work"]); assert.deepEqual(record.files.map((file) => file.path), [...record.files.map((file) => file.path)].sort());
  const second = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }); assert.equal(second.record.artifactDigest, first.record.artifactDigest);
  assert.doesNotMatch(JSON.stringify(record), /provider|metadata|function/i); delete globalThis.__szdOrder;
});

test("S11.3 stops source processing at the first failed validation boundary", async (t) => {
  const { dir, order } = await fixture({ invalid: true }); t.after(() => rm(dir, { recursive: true, force: true })); globalThis.__szdOrder = order;
  await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error.code === "source_set.failed");
  assert.deepEqual(order, ["provider", "raw"]); delete globalThis.__szdOrder;
});

test("S11.4 validates the package-bundled provenance manifest offline", async () => {
  const manifest = JSON.parse(await readFile(join(root, "src/builder/provenance.json"), "utf8"));
  assert.equal(validateProvenanceManifestV1(manifest).ok, true);
  assert.equal(validateProvenanceManifestV1({ ...manifest, manifestDigest: "sha256:bad" }).ok, false);
});

test("S11.5 and S11.6 preserve the previous artifact on failure and block leases and recovery", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }); const before = await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8");
  process.env.SZD_PORTFOLIO_FAIL_AT = "promotion";
  await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error.code === "promotion.failed"); delete process.env.SZD_PORTFOLIO_FAIL_AT;
  assert.equal(await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8"), before);
  await writeFile(join(dir, "out.lease.json"), "held"); await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error.code === "lease.unavailable"); await rm(join(dir, "out.lease.json"));
  await writeFile(join(dir, "out.recovery.json"), "{}"); await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error.code === "recovery.required");
});
