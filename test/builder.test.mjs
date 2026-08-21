import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { BuilderError, buildPortfolioSite, validateProvenanceManifestV1 } from "../src/builder.js";

const root = new URL("..", import.meta.url).pathname;
const builderUrl = pathToFileURL(join(root, "src/builder.js")).href;
const model = { version: 1, header: { title: "Built" }, statistics: [], categories: [], technologies: [], recentProjects: [] };
const cvModel = { version: 1, header: { name: "Built", contact: [] }, sections: [] };

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function withManifestDigest(value) {
  const candidate = { ...value, manifestDigest: "" };
  return { ...candidate, manifestDigest: `sha256:${createHash("sha256").update(canonical(candidate)).digest("hex")}` };
}

async function fixture({ route = "/work", invalid = false, badConfig = false, kind = "portfolio" } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-builder-"));
  const order = [];
  const sourceModel = kind === "cv" ? cvModel : model;
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
const order = globalThis.__szdOrder;
const source = defineSource({ id: "portfolio", timing: "build", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => { order?.push("provider"); return { value: ${JSON.stringify(sourceModel)}, metadata: [] }; } }, validateRaw: (value) => { order?.push("raw"); return ${invalid ? "{ ok: false, issues: [] }" : "{ ok: true, value }"}; }, project: (value) => { order?.push("project"); return value; }, viewModel: { kind: ${JSON.stringify(kind)}, validate: (value) => { order?.push("view"); return value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] }; } } });
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: ${JSON.stringify(route)}, metadata: { title: "Route" }, presentation: { kind: ${JSON.stringify(kind)}, modelSourceId: "portfolio" }, requiredSourceIds: [${badConfig ? '"missing"' : '"portfolio"'}] }], sources: [source], styles: [], navigation: [], publicAssets: [] });`;
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

test("S11.1 accepts no omitted or inferred build path", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const paths of [
    { configPath: "site.mjs", outDir: "out" },
    { rootDir: dir, outDir: "out" },
    { rootDir: dir, configPath: "site.mjs" },
    {},
  ]) {
    await assert.rejects(buildPortfolioSite(paths), (error) => error instanceof BuilderError && error.code === "config.invalid" && error.message === "Every build path is required");
  }
  await assert.rejects(readFile(join(dir, "out")));
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

test("S13.6 builds a CV-kind route through the same document compiler", async (t) => {
  const { dir, order } = await fixture({ kind: "cv" }); t.after(() => rm(dir, { recursive: true, force: true })); globalThis.__szdOrder = order;
  await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  assert.match(await readFile(join(dir, "out/work/index.html"), "utf8"), /szd-portfolio-cv/);
  delete globalThis.__szdOrder;
});

test("S12.1 builds a browser-gated unresolved boundary with only validated bootstrap data", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-browser-build-")); t.after(() => rm(dir, { recursive: true, force: true }));
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
const contract = { kind: "portfolio", validate: (value) => value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] } };
const build = defineSource({ id: "built", timing: "build", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => ({ value: ${JSON.stringify(model)}, metadata: [] }) }, validateRaw: (value) => ({ ok: true, value }), project: (value) => value, viewModel: contract });
const browser = defineSource({ id: "fresh", timing: "browser", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => ({ value: { secret: "raw" }, metadata: [] }) }, validateRaw: (value) => ({ ok: true, value }), project: () => (${JSON.stringify(model)}), viewModel: contract });
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: "/work", metadata: { title: "Route" }, presentation: { kind: "portfolio", modelSourceId: "fresh" }, requiredSourceIds: ["built", "fresh"] }], sources: [build, browser], styles: [], navigation: [], publicAssets: [] });`;
  await writeFile(join(dir, "site.mjs"), config);
  await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  const html = await readFile(join(dir, "out/work/index.html"), "utf8");
  assert.match(html, /data-szd-portfolio-state="unresolved"/);
  assert.doesNotMatch(html, /secret|raw/);
  const bootstrap = JSON.parse(html.match(/<script type="application\/json" id="szd-portfolio-bootstrap">([^<]+)<\/script>/)[1]);
  assert.deepEqual(bootstrap.browserSourceIds, ["fresh"]);
  assert.deepEqual(bootstrap.buildModels.map((entry) => entry.sourceId), ["built"]);
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
  assert.equal(manifest.deliveryMechanics.commit, "77209c69d9464156c38f62d47babe1e30d5a53ec");
  assert.equal(manifest.consumerOverlay.commit, "1bfa007c9211b60294b4fc56fbd9db8866724ef8");
  assert.equal(manifest.effectiveTemplateOverlay.imageDigest, "sha256:c167a4e1b6440da8e778ec1303a7441d480bde98965cdad36a02c463162f76d2");
  assert.equal(manifest.effectiveTemplateOverlay.effectiveTreeDigest, "sha256:9d78023bb20b21c289ca55ccaf9ec9c5003a1a0dc200a78ce08a0696cee5e84f");
  assert.equal(manifest.manifestDigest, "sha256:234c1473fb5bc41d19da7ddc315747969ed46c7760ad190deef7d9831c8e3beb");
  assert.ok(manifest.deliveryMechanics.files.length > 0);
  assert.ok(manifest.consumerOverlay.files.length > 0);
  assert.ok(manifest.effectiveTemplateOverlay.templateFiles.length > 0);
  assert.ok(manifest.effectiveTemplateOverlay.effectiveFiles.length > 0);
});

test("S11.4 rejects every provenance-manifest validation branch", async () => {
  const manifest = JSON.parse(await readFile(join(root, "src/builder/provenance.json"), "utf8"));
  const changed = (mutate) => {
    const value = structuredClone(manifest);
    mutate(value);
    return withManifestDigest(value);
  };
  const cases = [
    ["shape", null, "provenance.expected_object"],
    ["unknown top-level field", changed((value) => { value.unexpected = true; }), "provenance.expected_object"],
    ["version", withManifestDigest({ ...manifest, version: 2 }), "provenance.version_invalid"],
    ["delivery object", changed((value) => { value.deliveryMechanics = null; }), "provenance.delivery_invalid"],
    ["delivery unknown field", changed((value) => { value.deliveryMechanics.unexpected = true; }), "provenance.delivery_invalid"],
    ["delivery repository", changed((value) => { value.deliveryMechanics.repository = ""; }), "provenance.delivery_invalid"],
    ["delivery commit shape", changed((value) => { value.deliveryMechanics.commit = "abc"; }), "provenance.delivery_invalid"],
    ["delivery zero commit", changed((value) => { value.deliveryMechanics.commit = "0".repeat(40); }), "provenance.delivery_invalid"],
    ["delivery files type", changed((value) => { value.deliveryMechanics.files = null; }), "provenance.delivery_invalid"],
    ["delivery files empty", changed((value) => { value.deliveryMechanics.files = []; }), "provenance.delivery_invalid"],
    ["file object", changed((value) => { value.deliveryMechanics.files[0] = null; }), "provenance.delivery_invalid"],
    ["file unknown field", changed((value) => { value.deliveryMechanics.files[0].unexpected = true; }), "provenance.delivery_invalid"],
    ["file path absolute", changed((value) => { value.deliveryMechanics.files[0].path = "/escape"; }), "provenance.delivery_invalid"],
    ["file path parent", changed((value) => { value.deliveryMechanics.files[0].path = "../escape"; }), "provenance.delivery_invalid"],
    ["file path separator", changed((value) => { value.deliveryMechanics.files[0].path = "bad\\path"; }), "provenance.delivery_invalid"],
    ["file digest shape", changed((value) => { value.deliveryMechanics.files[0].digest = "sha256:bad"; }), "provenance.delivery_invalid"],
    ["file zero digest", changed((value) => { value.deliveryMechanics.files[0].digest = `sha256:${"0".repeat(64)}`; }), "provenance.delivery_invalid"],
    ["duplicate file path", changed((value) => { value.deliveryMechanics.files[1].path = value.deliveryMechanics.files[0].path; }), "provenance.delivery_invalid"],
    ["unsorted files", changed((value) => { [value.deliveryMechanics.files[0], value.deliveryMechanics.files[1]] = [value.deliveryMechanics.files[1], value.deliveryMechanics.files[0]]; }), "provenance.delivery_invalid"],
    ["consumer", withManifestDigest({ ...manifest, consumerOverlay: { ...manifest.consumerOverlay, clean: false } }), "provenance.consumer_invalid"],
    ["template object", changed((value) => { value.effectiveTemplateOverlay = null; }), "provenance.template_invalid"],
    ["template unknown field", changed((value) => { value.effectiveTemplateOverlay.unexpected = true; }), "provenance.template_invalid"],
    ["template image digest", changed((value) => { value.effectiveTemplateOverlay.imageDigest = `sha256:${"0".repeat(64)}`; }), "provenance.template_invalid"],
    ["effective tree digest", changed((value) => { value.effectiveTemplateOverlay.effectiveTreeDigest = "bad"; }), "provenance.template_invalid"],
    ["observed tags type", changed((value) => { value.effectiveTemplateOverlay.observedTags = null; }), "provenance.template_invalid"],
    ["observed tag value", changed((value) => { value.effectiveTemplateOverlay.observedTags = [""]; }), "provenance.template_invalid"],
    ["template files", changed((value) => { value.effectiveTemplateOverlay.templateFiles = []; }), "provenance.template_invalid"],
    ["effective files", changed((value) => { value.effectiveTemplateOverlay.effectiveFiles = []; }), "provenance.template_invalid"],
    ["overlay rules type", changed((value) => { value.effectiveTemplateOverlay.overlayRules = null; }), "provenance.template_invalid"],
    ["overlay rules empty", changed((value) => { value.effectiveTemplateOverlay.overlayRules = []; }), "provenance.template_invalid"],
    ["overlay rule object", changed((value) => { value.effectiveTemplateOverlay.overlayRules[0] = null; }), "provenance.template_invalid"],
    ["overlay rule unknown field", changed((value) => { value.effectiveTemplateOverlay.overlayRules[0].unexpected = true; }), "provenance.template_invalid"],
    ["overlay rule order", changed((value) => { value.effectiveTemplateOverlay.overlayRules[0].order = 2; }), "provenance.template_invalid"],
    ["overlay rule operation", changed((value) => { value.effectiveTemplateOverlay.overlayRules[0].operation = "copy"; }), "provenance.template_invalid"],
    ["overlay rule path", changed((value) => { value.effectiveTemplateOverlay.overlayRules[0].path = ""; }), "provenance.template_invalid"],
    ["manifest zero digest", { ...manifest, manifestDigest: `sha256:${"0".repeat(64)}` }, "provenance.digest_invalid"],
    ["digest", { ...manifest, manifestDigest: "sha256:bad" }, "provenance.digest_invalid"],
  ];
  for (const [name, input, code] of cases) {
    const result = validateProvenanceManifestV1(input);
    assert.equal(result.ok, false, name);
    assert.ok(result.issues.some((entry) => entry.code === code), name);
  }
});

test("S11.4 rejects the former placeholder even though its self-digest matches", () => {
  const oldPlaceholder = { consumerOverlay: { clean: true, commit: "0000000000000000000000000000000000000000", files: [], repository: "Portfolio" }, deliveryMechanics: { commit: "0000000000000000000000000000000000000000", files: [], repository: "SubZeroDev.Platform.UI.LandingPage" }, effectiveTemplateOverlay: { effectiveFiles: [], effectiveTreeDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000", imageDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000", observedTags: [], overlayRules: [], templateFiles: [] }, manifestDigest: "sha256:866930899eec0a539255b5dfb9d65f8a0ef440aa88344ae886b50825345ca63a", version: 1 };
  const placeholder = validateProvenanceManifestV1(oldPlaceholder);
  assert.equal(placeholder.ok, false);
  assert.deepEqual(placeholder.issues.map((entry) => entry.code), [
    "provenance.delivery_invalid",
    "provenance.consumer_invalid",
    "provenance.template_invalid",
  ]);
});

test("S11.4 a normal build succeeds with evidence-network access poisoned", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("evidence network is poisoned"); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  assert.match(result.record.artifactDigest, /^sha256:/);
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

test("S11.5 injected write-boundary failure leaves the previous artifact byte-for-byte unchanged", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  const before = await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8");
  process.env.SZD_PORTFOLIO_FAIL_AT = "write";
  await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error.code === "promotion.failed");
  delete process.env.SZD_PORTFOLIO_FAIL_AT;
  assert.equal(await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8"), before);
  await assert.rejects(readFile(join(dir, "out.recovery.json")));
});
