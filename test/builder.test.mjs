import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

import { BuilderError, buildPortfolioSite, checkPortfolioSite, defineSource, mergePortfolioArtifact, previewPortfolioSite, startPortfolioDevServer, validateArtifactRecordV1, validatePortfolioSiteConfigV1, validateProvenanceManifestV1, validateRecoveryRecordV1 } from "../src/builder.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const builderUrl = pathToFileURL(join(root, "src/builder.js")).href;
const model = { version: 1, header: { title: "Built" }, statistics: [], categories: [], technologies: [], recentProjects: [] };
const cvModel = { version: 1, header: { name: "Built", contact: [] }, sections: [] };
const projectsModel = { version: 1, heading: "Projects", categories: [], sortChoices: [], projects: [] };
const chromeModel = { version: 1, identity: { name: "Site" }, primaryNavigation: [], secondaryNavigation: [] };
const versionModel = { version: 1, text: "v1" };
const textSizeModel = { version: 1, label: "Size", choices: [{ id: "m", label: "Medium", scaleToken: "m" }], defaultChoiceId: "m" };
const readerModeModel = { version: 1, label: "Reader", enabledLabel: "On", disabledLabel: "Off", defaultEnabled: false };

function fixtureSource(id, kind, value) {
  return defineSource({
    id,
    timing: "build",
    provider: { kind: "fixture", publicDescriptor: [], resolve: async () => ({ value, metadata: [] }) },
    validateRaw: (raw) => ({ ok: true, value: raw }),
    project: (raw) => raw,
    viewModel: { kind, validate: (candidate) => (candidate ? { ok: true, value: candidate } : { ok: false, issues: [] }) },
  });
}

function validSiteConfig(overrides = {}) {
  const portfolio = fixtureSource("portfolio", "portfolio", model);
  const chrome = fixtureSource("chrome", "site-chrome", chromeModel);
  const version = fixtureSource("version", "version-display", versionModel);
  return {
    version: 1,
    metadata: { title: "Fixture" },
    routes: [{
      path: "/",
      metadata: { title: "Root" },
      presentation: { kind: "portfolio", modelSourceId: "portfolio", chromeSourceId: "chrome", versionSourceId: "version" },
      requiredSourceIds: ["portfolio", "chrome", "version"],
    }],
    sources: [portfolio, chrome, version],
    styles: [{ kind: "portfolio-core" }],
    navigation: [{ id: "home", destination: "/" }],
    publicAssets: [],
    ...overrides,
  };
}

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

test("S15.1-S15.6 validatePortfolioSiteConfigV1 accepts a complete declaration", () => {
  const result = validatePortfolioSiteConfigV1(validSiteConfig());
  assert.equal(result.ok, true);
});

test("S15.2 rejects every planning-time route, source-reference, and cross-reference branch", () => {
  const base = validSiteConfig();
  const cases = [
    ["duplicate route path", { ...base, routes: [base.routes[0], { ...base.routes[0], requiredSourceIds: ["portfolio", "chrome", "version"] }] }, "config.duplicate_route"],
    ["escaping route path", { ...base, routes: [{ ...base.routes[0], path: "/../evil" }] }, "config.route_invalid"],
    ["double-slash route path", { ...base, routes: [{ ...base.routes[0], path: "//double" }] }, "config.route_invalid"],
    ["trailing-slash route path", { ...base, routes: [{ ...base.routes[0], path: "/trailing/" }] }, "config.route_invalid"],
    ["duplicate required source id", { ...base, routes: [{ ...base.routes[0], requiredSourceIds: ["portfolio", "portfolio", "chrome", "version"] }] }, "config.duplicate_required_source"],
    ["missing required source", { ...base, routes: [{ ...base.routes[0], requiredSourceIds: ["portfolio", "chrome", "version", "absent"] }] }, "config.missing_source"],
    ["route metadata missing title", { ...base, routes: [{ ...base.routes[0], metadata: {} }] }, "config.route_metadata_invalid"],
    ["route metadata unknown field", { ...base, routes: [{ ...base.routes[0], metadata: { title: "Root", extra: true } }] }, "config.route_metadata_invalid"],
    ["presentation slot kind mismatch", { ...base, routes: [{ ...base.routes[0], presentation: { ...base.routes[0].presentation, chromeSourceId: "portfolio" }, requiredSourceIds: ["portfolio", "version"] }] }, "config.presentation_source_invalid"],
    ["presentation slot missing from requiredSourceIds", { ...base, routes: [{ ...base.routes[0], requiredSourceIds: ["portfolio", "chrome"] }] }, "config.presentation_source_invalid"],
    ["navigation destination does not resolve to a declared route", { ...base, navigation: [{ id: "missing", destination: "/nowhere" }] }, "config.navigation_invalid"],
    ["navigation item missing id", { ...base, navigation: [{ destination: "/" }] }, "config.navigation_invalid"],
    ["deployment basePath malformed", { ...base, deployment: { basePath: "no-leading-slash" } }, "config.deployment_invalid"],
    ["deployment unknown field", { ...base, deployment: { unexpected: true } }, "config.deployment_invalid"],
  ];
  for (const [name, config, code] of cases) {
    const result = validatePortfolioSiteConfigV1(config);
    assert.equal(result.ok, false, name);
    assert.ok(result.issues.some((entry) => entry.code === code), `${name}: ${JSON.stringify(result.issues)}`);
  }
});

test("S15.2 accepts a route/source graph without a cycle field to construct one", () => {
  // Sources are flat and reference nothing; routes reference sources one-directionally. No schema field
  // lets a source reference a route or another source, so the graph is acyclic by construction.
  const result = validatePortfolioSiteConfigV1(validSiteConfig());
  assert.equal(result.ok, true);
});

test("S15.3 rejects every style and asset declaration branch", () => {
  const base = validSiteConfig();
  const cases = [
    ["duplicate portfolio-core style", { ...base, styles: [{ kind: "portfolio-core" }, { kind: "portfolio-core" }] }, "config.duplicate_style"],
    ["consumer stylesheet wrong extension", { ...base, styles: [{ kind: "consumer-stylesheet", sourcePath: "custom.txt", outputPath: "assets/custom.css" }] }, "config.style_invalid"],
    ["consumer stylesheet escaping source", { ...base, styles: [{ kind: "consumer-stylesheet", sourcePath: "../custom.css", outputPath: "assets/custom.css" }] }, "config.style_invalid"],
    ["consumer stylesheet absolute output", { ...base, styles: [{ kind: "consumer-stylesheet", sourcePath: "custom.css", outputPath: "/assets/custom.css" }] }, "config.style_invalid"],
    ["style output collides with another declared style", { ...base, styles: [{ kind: "consumer-stylesheet", sourcePath: "custom.css", outputPath: "assets/shared.css" }, { kind: "consumer-stylesheet", sourcePath: "other.css", outputPath: "assets/shared.css" }] }, "config.output_collision"],
    ["public asset escaping source", { ...base, publicAssets: [{ sourcePath: "../secret.png", outputPath: "secret.png" }] }, "config.asset_invalid"],
    ["public asset absolute output", { ...base, publicAssets: [{ sourcePath: "logo.png", outputPath: "/logo.png" }] }, "config.asset_invalid"],
    ["public asset output collides with a style", { ...base, styles: [{ kind: "portfolio-core" }], publicAssets: [{ sourcePath: "logo.png", outputPath: "assets/szd-portfolio-core.css" }] }, "config.output_collision"],
    ["public asset output collides with the bootstrap bundle", { ...base, publicAssets: [{ sourcePath: "logo.png", outputPath: "assets/szd-portfolio-bootstrap.js" }] }, "config.output_collision"],
    ["public asset output collides with another asset", { ...base, publicAssets: [{ sourcePath: "logo.png", outputPath: "shared.png" }, { sourcePath: "other.png", outputPath: "shared.png" }] }, "config.output_collision"],
  ];
  for (const [name, config, code] of cases) {
    const result = validatePortfolioSiteConfigV1(config);
    assert.equal(result.ok, false, name);
    assert.ok(result.issues.some((entry) => entry.code === code), `${name}: ${JSON.stringify(result.issues)}`);
  }
});

test("S15.3 build fails before staging promotion when a declared style or asset file is missing", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-assets-")); t.after(() => rm(dir, { recursive: true, force: true }));
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
const source = defineSource({ id: "portfolio", timing: "build", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => ({ value: ${JSON.stringify(model)}, metadata: [] }) }, validateRaw: (value) => ({ ok: true, value }), project: (value) => value, viewModel: { kind: "portfolio", validate: (value) => value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] } } });
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: "/", metadata: { title: "Root" }, presentation: { kind: "portfolio", modelSourceId: "portfolio" }, requiredSourceIds: ["portfolio"] }], sources: [source], styles: [{ kind: "consumer-stylesheet", sourcePath: "missing.css", outputPath: "assets/missing.css" }], navigation: [], publicAssets: [] });`;
  await writeFile(join(dir, "site.mjs"), config);
  await assert.rejects(buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }), (error) => error instanceof BuilderError && error.code === "asset.invalid");
  await assert.rejects(readFile(join(dir, "out/index.html")));
});

test("S15.1, S15.4, and S15.5 build a multi-route site with every route kind, ordered stylesheets, and navigation", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-multiroute-")); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "custom.css"), ".custom{color:red}");
  await writeFile(join(dir, "favicon.ico"), "icon");
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
function source(id, kind, value) { return defineSource({ id, timing: "build", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => ({ value, metadata: [] }) }, validateRaw: (v) => ({ ok: true, value: v }), project: (v) => v, viewModel: { kind, validate: (v) => v ? { ok: true, value: v } : { ok: false, issues: [] } } }); }
const overview = source("overview", "portfolio", ${JSON.stringify(model)});
const cv = source("cv", "cv", ${JSON.stringify(cvModel)});
const projects = source("projects", "projects", ${JSON.stringify(projectsModel)});
export default definePortfolioSite({
  version: 1,
  metadata: { title: "Fixture" },
  routes: [
    { path: "/", metadata: { title: "Root" }, presentation: { kind: "portfolio", modelSourceId: "overview" }, requiredSourceIds: ["overview"] },
    { path: "/cv", metadata: { title: "CV" }, presentation: { kind: "cv", modelSourceId: "cv" }, requiredSourceIds: ["cv"] },
    { path: "/work", metadata: { title: "Work" }, presentation: { kind: "projects", modelSourceId: "projects" }, requiredSourceIds: ["projects"] },
  ],
  sources: [overview, cv, projects],
  styles: [{ kind: "portfolio-core" }, { kind: "consumer-stylesheet", sourcePath: "custom.css", outputPath: "assets/custom.css" }],
  navigation: [{ id: "home", destination: "/" }, { id: "cv", destination: "/cv" }, { id: "work", destination: "/work" }],
  publicAssets: [{ sourcePath: "favicon.ico", outputPath: "favicon.ico" }],
});`;
  await writeFile(join(dir, "site.mjs"), config);
  const { record } = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  assert.deepEqual(record.routes, ["/", "/cv", "/work"]);

  const coreCss = await readFile(join(root, "src/styles.css"), "utf8");
  assert.equal(await readFile(join(dir, "out/assets/szd-portfolio-core.css"), "utf8"), coreCss);
  assert.equal(await readFile(join(dir, "out/assets/custom.css"), "utf8"), ".custom{color:red}");
  assert.equal(await readFile(join(dir, "out/favicon.ico"), "utf8"), "icon");

  const home = await readFile(join(dir, "out/index.html"), "utf8");
  const coreIndex = home.indexOf("/assets/szd-portfolio-core.css");
  const customIndex = home.indexOf("/assets/custom.css");
  assert.ok(coreIndex >= 0 && customIndex > coreIndex, "core stylesheet link precedes the consumer stylesheet link, matching declared order");
  assert.equal((home.match(/rel="stylesheet"/g) ?? []).length, 2);

  const cvHtml = await readFile(join(dir, "out/cv/index.html"), "utf8");
  assert.match(cvHtml, /szd-portfolio-cv/);
  const projectsHtml = await readFile(join(dir, "out/work/index.html"), "utf8");
  assert.match(projectsHtml, /szd-portfolio-projects-view/);
});

test("S15.4 the package's own JavaScript entrypoint imports no stylesheet", async () => {
  const source = await readFile(join(root, "src/index.js"), "utf8");
  assert.doesNotMatch(source, /import\s+["'].*\.css["']/);
});

test("S15.6 a root-only fixture emits exactly one route and no consumer product data", async (t) => {
  const { dir } = await fixture({ route: "/" }); t.after(() => rm(dir, { recursive: true, force: true }));
  const { record } = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  assert.deepEqual(record.routes, ["/"]);
  await assert.rejects(readFile(join(dir, "out/work/index.html")));
  assert.match(await readFile(join(dir, "out/index.html"), "utf8"), /szd-portfolio-overview/);
});

const checkGateIds = ["config", "provenance", "source_set", "route", "compile", "artifact"];

test("S17.1 accepts no omitted or inferred check path", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const paths of [{ configPath: "site.mjs" }, { rootDir: dir }, {}]) {
    await assert.rejects(checkPortfolioSite(paths), (error) => error instanceof BuilderError && error.code === "config.invalid" && error.message === "Every check path is required");
  }
});

test("S17.1 and S17.2 a clean fixture runs every named gate and reports all passed exactly once", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await readFile(join(dir, "site.mjs"), "utf8");
  const result = await checkPortfolioSite({ rootDir: dir, configPath: "site.mjs" });
  assert.deepEqual(result.gates.map((gate) => gate.id), checkGateIds);
  assert.ok(result.gates.every((gate) => gate.status === "passed"));
  assert.match(result.record.artifactDigest, /^sha256:/);
  assert.equal(await readFile(join(dir, "site.mjs"), "utf8"), before, "check never mutates the source repository");
  await assert.rejects(readFile(join(dir, "out")), "check never creates the consumer's ordinary output");
});

test("S17.2 a failed gate reports check.failed with the complete gate list and no later gate attempted", async (t) => {
  const { dir } = await fixture({ badConfig: true }); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(checkPortfolioSite({ rootDir: dir, configPath: "site.mjs" }), (error) => {
    assert.ok(error instanceof BuilderError);
    assert.equal(error.code, "check.failed");
    assert.deepEqual(error.gates.map((gate) => gate.id), checkGateIds);
    assert.deepEqual(error.gates.map((gate) => gate.status), ["failed", "not-run", "not-run", "not-run", "not-run", "not-run"]);
    return true;
  });
});

test("S17.3 a fault injected during check's temporary writes leaves the production output and source repository byte-for-byte unchanged", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  const before = await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8");
  const configBefore = await readFile(join(dir, "site.mjs"), "utf8");
  process.env.SZD_PORTFOLIO_FAIL_AT = "write";
  await assert.rejects(checkPortfolioSite({ rootDir: dir, configPath: "site.mjs" }), (error) => {
    assert.ok(error instanceof BuilderError);
    assert.equal(error.code, "check.failed");
    assert.deepEqual(error.gates.map((gate) => gate.status), ["passed", "passed", "passed", "passed", "failed", "not-run"]);
    return true;
  });
  delete process.env.SZD_PORTFOLIO_FAIL_AT;
  assert.equal(await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8"), before);
  assert.equal(await readFile(join(dir, "site.mjs"), "utf8"), configBefore);
});

test("S17.4 a clean fixture's check record matches an ordinary build of the same inputs", async (t) => {
  const { dir } = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const built = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  const checked = await checkPortfolioSite({ rootDir: dir, configPath: "site.mjs" });
  assert.equal(checked.record.artifactDigest, built.record.artifactDigest);
  assert.deepEqual(checked.record.files, built.record.files);
  assert.deepEqual(checked.record.routes, built.record.routes);
});

function devConfigSource(title, extra = "") {
  return `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
const source = defineSource({ id: "portfolio", timing: "build", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => { ${extra}
  return { value: ${JSON.stringify(model)}, metadata: [] };
} }, validateRaw: (value) => ({ ok: true, value }), project: (value) => value, viewModel: { kind: "portfolio", validate: (value) => value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] } } });
export default definePortfolioSite({ version: 1, metadata: { title: ${JSON.stringify(title)} }, routes: [{ path: "/", metadata: { title: ${JSON.stringify(title)} }, presentation: { kind: "portfolio", modelSourceId: "portfolio" }, requiredSourceIds: ["portfolio"] }], sources: [source], styles: [], navigation: [], publicAssets: [] });`;
}

async function devFixture(title = "Initial") {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-devsite-"));
  await writeFile(join(dir, "site.mjs"), devConfigSource(title));
  return dir;
}

async function fetchText(address, path) {
  const response = await fetch(`http://${address.host}:${address.port}${path}`);
  return { status: response.status, body: await response.text() };
}

async function fetchResponse(address, path) {
  const response = await fetch(`http://${address.host}:${address.port}${path}`);
  return { status: response.status, body: await response.text(), contentType: response.headers.get("content-type") };
}

async function rawFetch(address, rawPath) {
  return new Promise((resolveReq, rejectReq) => {
    const req = httpRequest({ host: address.host, port: address.port, path: rawPath, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolveReq({ status: res.statusCode, body }));
    });
    req.once("error", rejectReq);
    req.end();
  });
}

async function waitFor(check, { timeout = 4000, interval = 20 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const result = await check(); if (result) return result; } catch (error) { lastError = error; }
    await delay(interval);
  }
  throw lastError ?? new Error("waitFor timed out");
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolveListen) => probe.listen(0, "127.0.0.1", resolveListen));
  const port = probe.address().port;
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}

test("S18.1 requires every dev path and address value", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const paths = { rootDir: dir, configPath: "site.mjs", outDir: "out" };
  const address = { host: "127.0.0.1", port: 0 };
  const cases = [
    [{ configPath: "site.mjs", outDir: "out" }, address],
    [{ rootDir: dir, outDir: "out" }, address],
    [{ rootDir: dir, configPath: "site.mjs" }, address],
    [paths, { port: 0 }],
    [paths, { host: "127.0.0.1" }],
    [{}, {}],
  ];
  for (const [givenPaths, givenAddress] of cases) {
    await assert.rejects(startPortfolioDevServer(givenPaths, givenAddress), (error) => error instanceof BuilderError && error.code === "config.invalid");
  }
  await assert.rejects(readFile(join(dir, "out")));
});

test("S18.1 binds only after configuration, provenance, and initial build-source resolution succeed", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const port = await freePort();
  const address = { host: "127.0.0.1", port };

  await writeFile(join(dir, "site.mjs"), `import { definePortfolioSite } from ${JSON.stringify(builderUrl)};
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: "/", metadata: { title: "Root" }, presentation: { kind: "portfolio", modelSourceId: "missing" }, requiredSourceIds: ["missing"] }], sources: [], styles: [], navigation: [], publicAssets: [] });`);
  await assert.rejects(startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, address), (error) => error instanceof BuilderError && error.code === "config.load_failed");

  await writeFile(join(dir, "site.mjs"), devConfigSource("Initial", "throw new Error('boom');"));
  await assert.rejects(startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, address), (error) => error instanceof BuilderError && error.code === "source_set.failed");

  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => { probe.once("error", rejectListen); probe.listen(port, "127.0.0.1", resolveListen); });
  await new Promise((resolveClose) => probe.close(resolveClose));
});

test("S18.2 coalesces a burst of changes into one further generation, running one at a time, and the last change wins", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-devsite-")); t.after(() => rm(dir, { recursive: true, force: true }));
  const configPath = join(dir, "site.mjs");
  const trackingProvider = `globalThis.__szdDevActive = (globalThis.__szdDevActive ?? 0) + 1;
  if (globalThis.__szdDevActive > 1) globalThis.__szdDevOverlap = true;
  globalThis.__szdDevCalls = (globalThis.__szdDevCalls ?? 0) + 1;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  globalThis.__szdDevActive -= 1;`;
  await writeFile(configPath, devConfigSource("Initial", trackingProvider));
  globalThis.__szdDevCalls = 0; globalThis.__szdDevActive = 0; globalThis.__szdDevOverlap = false;
  const server = await startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port: 0 });
  t.after(() => server.close());
  await waitFor(async () => (await fetchText(server.address, "/")).body.includes("Initial"));
  assert.equal(globalThis.__szdDevCalls, 1);

  for (const title of ["Burst-1", "Burst-2", "Burst-3", "Burst-4", "Final"]) {
    await writeFile(configPath, devConfigSource(title, trackingProvider));
    await delay(5);
  }
  await waitFor(async () => (await fetchText(server.address, "/")).body.includes("Final"), { timeout: 5000 });
  assert.equal(globalThis.__szdDevOverlap, false, "no two generations ran concurrently");
  assert.ok(globalThis.__szdDevCalls < 6, `expected the burst to be coalesced, got ${globalThis.__szdDevCalls} generations`);
  delete globalThis.__szdDevCalls; delete globalThis.__szdDevActive; delete globalThis.__szdDevOverlap;
});

test("S18.3 a failing generation is visible through the development error surface and the last complete generation remains served", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const server = await startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port: 0 });
  t.after(() => server.close());
  const before = await waitFor(async () => { const response = await fetchText(server.address, "/"); return response.body.includes("Initial") ? response : undefined; });

  const originalWrite = process.stderr.write;
  const messages = [];
  process.stderr.write = (chunk, ...rest) => { messages.push(String(chunk)); return originalWrite.call(process.stderr, chunk, ...rest); };
  try {
    await writeFile(join(dir, "site.mjs"), `import { definePortfolioSite } from ${JSON.stringify(builderUrl)};
export default definePortfolioSite({ version: 1, metadata: { title: "Broken" }, routes: [], sources: [], styles: [], navigation: [], publicAssets: [] });`);
    await waitFor(() => messages.some((message) => message.includes("generation failed")));
  } finally { process.stderr.write = originalWrite; }

  const after = await fetchText(server.address, "/");
  assert.equal(after.body, before.body, "the last complete generation keeps being served");
  assert.equal(after.status, 200);
});

test("S18.4 production and development fixtures produce byte-equivalent route documents and bootstrap records", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const built = await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" });
  const expectedHtml = await readFile(join(dir, "out/index.html"), "utf8");
  const expectedBootstrap = await readFile(join(dir, "out/assets/szd-portfolio-bootstrap.js"), "utf8");
  assert.deepEqual(built.record.routes, ["/"]);

  const server = await startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "dev-out" }, { host: "127.0.0.1", port: 0 });
  t.after(() => server.close());
  const html = await waitFor(async () => { const response = await fetchText(server.address, "/"); return response.body.length > 0 ? response : undefined; });
  assert.equal(html.body, expectedHtml);
  const bootstrap = await fetchText(server.address, "/assets/szd-portfolio-bootstrap.js");
  assert.equal(bootstrap.body, expectedBootstrap);
  await assert.rejects(readFile(join(dir, "dev-out")), "dev never writes the consumer's ordinary output");
});

test("S18.5 closing releases watchers, sockets, and staging state without touching recovery state", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const stagingPrefix = "szd-portfolio-dev-";
  const before = (await readdir(tmpdir())).filter((name) => name.startsWith(stagingPrefix)).length;

  const server = await startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port: 0 });
  await waitFor(async () => (await fetchText(server.address, "/")).body.includes("Initial"));
  const during = (await readdir(tmpdir())).filter((name) => name.startsWith(stagingPrefix)).length;
  assert.ok(during > before, "an in-flight generation leaves staging state in the temp directory");

  const { host, port } = server.address;
  await server.close();
  const after = (await readdir(tmpdir())).filter((name) => name.startsWith(stagingPrefix)).length;
  assert.equal(after, before, "closing removes every staging directory this instance created");

  await assert.rejects(readFile(join(dir, "out")));
  await assert.rejects(readFile(join(dir, "out.lease.json")));
  await assert.rejects(readFile(join(dir, "out.recovery.json")));

  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => { probe.once("error", rejectListen); probe.listen(port, host, resolveListen); });
  await new Promise((resolveClose) => probe.close(resolveClose));
});

test("S18.5 closing while a generation is still in flight still removes every staging directory", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-devsite-")); t.after(() => rm(dir, { recursive: true, force: true }));
  const configPath = join(dir, "site.mjs");
  await writeFile(configPath, devConfigSource("Initial"));
  const stagingPrefix = "szd-portfolio-dev-";
  const before = (await readdir(tmpdir())).filter((name) => name.startsWith(stagingPrefix)).length;

  const server = await startPortfolioDevServer({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port: 0 });
  t.after(() => server.close());
  await waitFor(async () => (await fetchText(server.address, "/")).body.includes("Initial"));

  globalThis.__szdDevStarted = false;
  globalThis.__szdDevGate = new Promise((resolveGate) => { globalThis.__szdDevGateResolve = resolveGate; });
  await writeFile(configPath, devConfigSource("Gated", "globalThis.__szdDevStarted = true; await globalThis.__szdDevGate;"));
  try {
    await waitFor(() => globalThis.__szdDevStarted === true);

    const closePromise = server.close();
    await delay(20);
    globalThis.__szdDevGateResolve();
    await closePromise;

    await waitFor(
      async () => (await readdir(tmpdir())).filter((name) => name.startsWith(stagingPrefix)).length === before,
      { timeout: 5000 },
    );
  } finally {
    delete globalThis.__szdDevStarted; delete globalThis.__szdDevGate; delete globalThis.__szdDevGateResolve;
  }
});

test("S19.1 requires every preview path and address value", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const paths = { rootDir: dir, configPath: "site.mjs", outDir: "out" };
  const address = { host: "127.0.0.1", port: 0 };
  const cases = [
    [{ configPath: "site.mjs", outDir: "out" }, address],
    [{ rootDir: dir, outDir: "out" }, address],
    [{ rootDir: dir, configPath: "site.mjs" }, address],
    [paths, { port: 0 }],
    [paths, { host: "127.0.0.1" }],
    [{}, {}],
  ];
  for (const [givenPaths, givenAddress] of cases) {
    await assert.rejects(previewPortfolioSite(givenPaths, givenAddress), (error) => error instanceof BuilderError && error.code === "config.invalid");
  }
  await assert.rejects(readFile(join(dir, "out")));
});

test("S19.1 completes an ordinary promoted build before binding, and a failing build never binds", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const port = await freePort();
  const address = { host: "127.0.0.1", port };

  await writeFile(join(dir, "site.mjs"), `import { definePortfolioSite } from ${JSON.stringify(builderUrl)};
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: "/", metadata: { title: "Root" }, presentation: { kind: "portfolio", modelSourceId: "missing" }, requiredSourceIds: ["missing"] }], sources: [], styles: [], navigation: [], publicAssets: [] });`);
  await assert.rejects(previewPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, address), (error) => error instanceof BuilderError && error.code === "config.load_failed");
  await assert.rejects(readFile(join(dir, "out")));

  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => { probe.once("error", rejectListen); probe.listen(port, "127.0.0.1", resolveListen); });
  await new Promise((resolveClose) => probe.close(resolveClose));

  await writeFile(join(dir, "site.mjs"), devConfigSource("Initial"));
  const server = await previewPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, address);
  t.after(() => server.close());
  assert.equal(server.address.port, port);
  await assert.doesNotReject(readFile(join(dir, "out/index.html")));
});

test("S19.2 previews the exact promoted artifact using the production containment and content-type mapping", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const server = await previewPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port: 0 });
  t.after(() => server.close());
  const expectedHtml = await readFile(join(dir, "out/index.html"), "utf8");
  const expectedBootstrap = await readFile(join(dir, "out/assets/szd-portfolio-bootstrap.js"), "utf8");

  const html = await fetchResponse(server.address, "/");
  assert.equal(html.status, 200);
  assert.equal(html.body, expectedHtml);
  assert.equal(html.contentType, "text/html; charset=utf-8");

  const bootstrap = await fetchResponse(server.address, "/assets/szd-portfolio-bootstrap.js");
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body, expectedBootstrap);
  assert.equal(bootstrap.contentType, "text/javascript; charset=utf-8");
});

test("S19.3 malformed encoding, traversal, escaping symlinks, absent files, and undeclared routes all resolve to the generic not-found result", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const secretDir = await mkdtemp(join(tmpdir(), "szd-portfolio-secret-"));
  const secretFile = join(secretDir, "index.html");
  await writeFile(secretFile, "top secret");
  t.after(() => rm(secretDir, { recursive: true, force: true }));

  const server = await previewPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port: 0 });
  t.after(() => server.close());

  await mkdir(join(dir, "out", "escaped"), { recursive: true });
  await symlink(secretFile, join(dir, "out", "escaped", "index.html"));

  const escapePattern = new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const cases = ["/%", "/../../etc/passwd", "/escaped", "/nope", "/not-a-declared-route"];
  for (const path of cases) {
    const response = await rawFetch(server.address, path);
    assert.equal(response.status, 404, `expected the generic not-found result for ${path}`);
    assert.doesNotMatch(response.body, escapePattern, `must not expose a host path for ${path}`);
    assert.doesNotMatch(response.body, /top secret/, `must not read outside the artifact for ${path}`);
  }
});

test("S19.4 a bind failure returns server.bind_failed, leaves the promoted artifact valid, and releases the server's ordinary resources", async (t) => {
  const dir = await devFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const occupied = createServer();
  const port = await new Promise((resolveListen) => occupied.listen(0, "127.0.0.1", () => resolveListen(occupied.address().port)));

  await assert.rejects(
    previewPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "out" }, { host: "127.0.0.1", port }),
    (error) => error instanceof BuilderError && error.code === "server.bind_failed",
  );

  const promoted = JSON.parse(await readFile(join(dir, "out/.szd-portfolio-artifact.json"), "utf8"));
  assert.equal(validateArtifactRecordV1(promoted).ok, true);

  await new Promise((resolveClose) => occupied.close(resolveClose));
  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => { probe.once("error", rejectListen); probe.listen(port, "127.0.0.1", resolveListen); });
  await new Promise((resolveClose) => probe.close(resolveClose));
});

async function mergeFixture() {
  const { dir } = await fixture();
  await buildPortfolioSite({ rootDir: dir, configPath: "site.mjs", outDir: "artifact" });
  const artifactDir = join(dir, "artifact");
  const targetDir = join(dir, "target");
  await mkdir(join(targetDir, "keep"), { recursive: true });
  await writeFile(join(targetDir, "keep", "CNAME"), "example.com");
  await writeFile(join(targetDir, "stale.html"), "<html>stale</html>");
  return { dir, artifactDir, targetDir };
}

async function treeFiles(rootDir) {
  const entries = [];
  async function walk(dir) {
    let items;
    try { items = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const item of items) {
      const absolute = join(dir, item.name);
      if (item.isDirectory()) await walk(absolute);
      else entries.push([relative(rootDir, absolute).replaceAll("\\", "/"), await readFile(absolute, "utf8")]);
    }
  }
  await walk(rootDir);
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

test("S20.1 requires both merge paths and accepts an explicit empty protected set", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const options of [{ targetDir }, { artifactDir }, {}]) {
    await assert.rejects(mergePortfolioArtifact(options), (error) => error instanceof BuilderError && error.code === "config.invalid" && error.message === "Every merge path is required");
  }
  const result = await mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] });
  assert.match(result.artifactDigest, /^sha256:/);
  assert.equal(result.targetDir, resolve(targetDir));
});

test("S20.1 normalizes and deduplicates protected subtree paths, rejecting an escape", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: ["../escape"] }), (error) => error.code === "config.invalid");
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: ["/absolute"] }), (error) => error.code === "config.invalid");
  const result = await mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: ["keep/", "keep", "./keep"] });
  assert.match(result.artifactDigest, /^sha256:/);
  assert.equal(await readFile(join(targetDir, "keep/CNAME"), "utf8"), "example.com");
});

test("S20.2 validates the source artifact and rejects a missing record without touching the destination", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  await rm(join(artifactDir, ".szd-portfolio-artifact.json"));
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error instanceof BuilderError && error.code === "merge.failed");
  assert.deepEqual(await treeFiles(targetDir), before);
});

test("S20.2 rejects a tampered source artifact whose files no longer match its record", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  await writeFile(join(artifactDir, "work/index.html"), "<html>tampered</html>");
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error instanceof BuilderError && error.code === "merge.failed");
  assert.deepEqual(await treeFiles(targetDir), before);
});

test("S20.2 and S20.4 rejects a protected-path collision, naming it, without touching the destination", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: ["work"] }), (error) => error instanceof BuilderError && error.code === "merge.collision" && error.path === "work/index.html");
  assert.deepEqual(await treeFiles(targetDir), before);
});

test("S20.2 and S20.4 rejects on injected capacity failure without touching the destination", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  process.env.SZD_PORTFOLIO_FAIL_AT = "capacity";
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error.code === "merge.failed");
  delete process.env.SZD_PORTFOLIO_FAIL_AT;
  assert.deepEqual(await treeFiles(targetDir), before);
});

test("S20.4 rejects on injected write failure without touching the destination", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  process.env.SZD_PORTFOLIO_FAIL_AT = "write";
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error.code === "merge.failed");
  delete process.env.SZD_PORTFOLIO_FAIL_AT;
  assert.deepEqual(await treeFiles(targetDir), before);
});

test("S20.4 a protected subtree mutated after its first fingerprint returns merge.target_changed without touching the destination", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  process.env.SZD_PORTFOLIO_MERGE_DELAY_MS = "80";
  const merging = mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: ["keep"] });
  await delay(20);
  await writeFile(join(targetDir, "keep", "CNAME"), "changed.example");
  await assert.rejects(merging, (error) => error instanceof BuilderError && error.code === "merge.target_changed");
  delete process.env.SZD_PORTFOLIO_MERGE_DELAY_MS;
  const after = await treeFiles(targetDir);
  assert.deepEqual(after.filter(([path]) => path !== "keep/CNAME"), before.filter(([path]) => path !== "keep/CNAME"));
});

test("S20.4 an injected clean promotion failure leaves the destination byte-for-byte unchanged", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const before = await treeFiles(targetDir);
  process.env.SZD_PORTFOLIO_FAIL_AT = "promotion";
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error.code === "merge.failed");
  delete process.env.SZD_PORTFOLIO_FAIL_AT;
  assert.deepEqual(await treeFiles(targetDir), before);
  await assert.rejects(readFile(`${targetDir}.recovery.json`));
});

test("S20.3 requires both leases and acquires them in normalized-path order", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const [first, second] = [resolve(artifactDir), resolve(targetDir)].sort();
  await writeFile(`${first}.lease.json`, "held");
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error instanceof BuilderError && error.code === "lease.unavailable" && error.path === `${first}.lease.json`);
  await assert.rejects(readFile(`${second}.lease.json`));
  await rm(`${first}.lease.json`);
  const result = await mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] });
  assert.match(result.artifactDigest, /^sha256:/);
});

test("S20.3 reversed concurrent merges of the same tree pair complete without deadlock", async (t) => {
  const first = await mergeFixture(); const second = await mergeFixture();
  t.after(() => Promise.all([rm(first.dir, { recursive: true, force: true }), rm(second.dir, { recursive: true, force: true })]));
  const treeX = first.artifactDir; const treeY = second.artifactDir;
  const results = await Promise.race([
    Promise.allSettled([
      mergePortfolioArtifact({ artifactDir: treeX, targetDir: treeY, protectedPaths: [] }),
      mergePortfolioArtifact({ artifactDir: treeY, targetDir: treeX, protectedPaths: [] }),
    ]),
    delay(5000).then(() => { throw new Error("reversed concurrent merges deadlocked"); }),
  ]);
  assert.equal(results.length, 2);
  for (const outcome of results) {
    if (outcome.status === "rejected") assert.ok(outcome.reason instanceof BuilderError, "a rejection must be the contracted typed error, not a hang or crash");
  }
});

test("S20.5 an interrupted promotion writes a recovery record naming the target, staging, previous tree, and phase; a later merge refuses it without deleting it", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  process.env.SZD_PORTFOLIO_FAIL_AT = "promotion-interrupted";
  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error instanceof BuilderError && error.code === "merge.failed");
  delete process.env.SZD_PORTFOLIO_FAIL_AT;

  const recoveryPath = `${resolve(targetDir)}.recovery.json`;
  const recovery = JSON.parse(await readFile(recoveryPath, "utf8"));
  assert.equal(validateRecoveryRecordV1(recovery).ok, true);
  assert.equal(recovery.operation, "merge");
  assert.equal(recovery.targetPath, resolve(targetDir));
  assert.ok(recovery.stagingPath.startsWith(`${resolve(targetDir)}.staging-`));
  assert.ok(recovery.previousPath.startsWith(`${resolve(targetDir)}.previous-`));
  assert.equal(recovery.phase, "promotion-started");

  await assert.rejects(mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: [] }), (error) => error instanceof BuilderError && error.code === "recovery.required");
  assert.equal(await readFile(recoveryPath, "utf8"), JSON.stringify(recovery));
  await assert.doesNotReject(readFile(join(recovery.previousPath, "keep/CNAME")));
});

test("S20.6 a successful merge returns the exact source artifact digest and leaves the source artifact unmodified", async (t) => {
  const { dir, artifactDir, targetDir } = await mergeFixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const sourceBefore = await treeFiles(artifactDir);
  const sourceRecord = JSON.parse(await readFile(join(artifactDir, ".szd-portfolio-artifact.json"), "utf8"));
  const result = await mergePortfolioArtifact({ artifactDir, targetDir, protectedPaths: ["keep"] });
  assert.equal(result.artifactDigest, sourceRecord.artifactDigest);
  assert.deepEqual(await treeFiles(artifactDir), sourceBefore);
  assert.equal(await readFile(join(targetDir, "keep/CNAME"), "utf8"), "example.com");
  assert.match(await readFile(join(targetDir, "work/index.html"), "utf8"), /szd-portfolio-overview/);
  const promoted = JSON.parse(await readFile(join(targetDir, ".szd-portfolio-artifact.json"), "utf8"));
  assert.equal(promoted.artifactDigest, sourceRecord.artifactDigest);
  await assert.rejects(readFile(`${resolve(targetDir)}.lease.json`));
  await assert.rejects(readFile(`${resolve(artifactDir)}.lease.json`));
});
