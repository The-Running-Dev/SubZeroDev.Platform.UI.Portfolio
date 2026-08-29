import { createHash, randomUUID } from "node:crypto";
import { access, cp, mkdir, readdir, readFile, realpath, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CV, Portfolio, Projects } from "./index.js";
import { defineSource, isDefinedSource, resolveSource, sourceDefinition } from "./resolution.js";

const presentationRenderers = { portfolio: Portfolio, cv: CV, projects: Projects };
const presentationSlotKinds = { chromeSourceId: "site-chrome", versionSourceId: "version-display", textSizeSourceId: "text-size", readerModeSourceId: "reader-mode" };
const defaultProjectsQuery = Object.freeze({ search: "", categoryIds: [], tags: [], sortChoiceId: "" });
const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, "builder", "provenance.json");
const stylesheetPath = join(here, "styles.css");
const artifactName = ".szd-portfolio-artifact.json";
const bootstrapScriptOutput = "assets/szd-portfolio-bootstrap.js";
const coreStylesheetOutput = "assets/szd-portfolio-core.css";

export class BuilderError extends Error {
  constructor(code, message, options = {}) { super(message, options.cause === undefined ? undefined : { cause: options.cause }); this.name = "BuilderError"; this.code = code; this.routePath = options.routePath; this.sourceId = options.sourceId; this.path = options.path; this.issues = options.issues ?? []; this.causes = options.causes ?? []; this.gates = options.gates ?? []; if (options.cause !== undefined) this.cause = options.cause; }
}

function canonical(value) { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function digest(value) { return `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex")}`; }
function issue(code, path) { return { code, path, message: code }; }
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function exactKeys(value, keys) { const actual = Object.keys(value).sort(); const expected = [...keys].sort(); return actual.length === expected.length && actual.every((key, index) => key === expected[index]); }
function immutableDigest(value) { return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value) && !/^sha256:0{64}$/.test(value); }
function immutableCommit(value) { return typeof value === "string" && /^[0-9a-f]{40}$/.test(value) && !/^0{40}$/.test(value); }
function relativeManifestPath(value) { return typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes(".."); }
function fileDigestList(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  let previous;
  for (const entry of value) {
    if (!record(entry) || !exactKeys(entry, ["path", "digest"]) || !relativeManifestPath(entry.path) || !immutableDigest(entry.digest) || (previous !== undefined && previous >= entry.path)) return false;
    previous = entry.path;
  }
  return true;
}
function repositoryBaseline(value, consumer = false) {
  const keys = consumer ? ["repository", "commit", "clean", "files"] : ["repository", "commit", "files"];
  return record(value) && exactKeys(value, keys) && typeof value.repository === "string" && value.repository.length > 0 && immutableCommit(value.commit) && (!consumer || value.clean === true) && fileDigestList(value.files);
}
function templateOverlayBaseline(value) {
  if (!record(value) || !exactKeys(value, ["imageDigest", "observedTags", "templateFiles", "overlayRules", "effectiveFiles", "effectiveTreeDigest"]) || !immutableDigest(value.imageDigest) || !immutableDigest(value.effectiveTreeDigest) || !Array.isArray(value.observedTags) || !value.observedTags.every((tag) => typeof tag === "string" && tag.length > 0) || !fileDigestList(value.templateFiles) || !fileDigestList(value.effectiveFiles) || !Array.isArray(value.overlayRules) || value.overlayRules.length === 0) return false;
  return value.overlayRules.every((rule, index) => record(rule) && exactKeys(rule, ["order", "operation", "path"]) && rule.order === index + 1 && ["include", "exclude", "replace"].includes(rule.operation) && typeof rule.path === "string" && rule.path.length > 0);
}
function contained(root, value) { const absolute = isAbsolute(value) ? resolve(value) : resolve(root, value); return (absolute === resolve(root) || relative(resolve(root), absolute) && !relative(resolve(root), absolute).startsWith("..")) ? absolute : undefined; }
function outputFile(route) { return route === "/" ? "index.html" : `${route.replace(/^\//, "")}/index.html`; }
export { defineSource };

export function definePortfolioSite(config) { const result = validatePortfolioSiteConfigV1(config); if (!result.ok) throw new BuilderError("config.invalid", "Invalid site configuration", { issues: result.issues }); return config; }

function isNonEmptyString(value) { return typeof value === "string" && value.length > 0; }
function isStringArray(value) { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
// Sources are flat, standalone declarations (id, timing, provider, validator, projection, view model) with no
// reference to any other source or route. Routes reference sources one-directionally via requiredSourceIds.
// The v1 schema therefore has no field through which a route/source cycle could be constructed; the graph is
// acyclic by construction, and S15.2's cycle clause is satisfied vacuously rather than by runtime detection.
function normalizedRoutePath(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.includes("..") || path.includes("//")) return undefined;
  if (path !== "/" && path.endsWith("/")) return undefined;
  return path;
}
function servedRoutePath(basePath, path) { return basePath === undefined ? path : path === "/" ? basePath : `${basePath}${path}`; }

export function validatePortfolioSiteConfigV1(input) {
  const issues = [];
  if (!record(input)) return { ok: false, issues: [issue("config.expected_object", [])] };
  const allowed = new Set(["version", "routes", "sources", "metadata", "styles", "navigation", "publicAssets", "deployment"]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) issues.push(issue("config.unknown_field", [key]));
  if (input.version !== 1) issues.push(issue("config.unsupported_version", ["version"]));
  if (!Array.isArray(input.routes) || input.routes.length === 0) issues.push(issue("config.routes_required", ["routes"]));
  if (!Array.isArray(input.sources)) issues.push(issue("config.sources_required", ["sources"]));
  if (!record(input.metadata) || typeof input.metadata.title !== "string" || !input.metadata.title) {
    issues.push(issue("config.metadata_invalid", ["metadata"]));
  } else {
    const metadataAllowed = new Set(["title", "description", "language"]);
    for (const key of Object.keys(input.metadata)) if (!metadataAllowed.has(key)) issues.push(issue("config.metadata_invalid", ["metadata", key]));
    if (input.metadata.description !== undefined && typeof input.metadata.description !== "string") issues.push(issue("config.metadata_invalid", ["metadata", "description"]));
    if (input.metadata.language !== undefined && !isNonEmptyString(input.metadata.language)) issues.push(issue("config.metadata_invalid", ["metadata", "language"]));
  }
  for (const key of ["styles", "navigation", "publicAssets"]) if (!Array.isArray(input[key])) issues.push(issue("config.array_required", [key]));

  let basePath;
  if (input.deployment !== undefined) {
    const deploymentAllowed = new Set(["basePath", "canonicalUrl", "documentationDestination"]);
    if (!record(input.deployment)) {
      issues.push(issue("config.deployment_invalid", ["deployment"]));
    } else {
      for (const key of Object.keys(input.deployment)) if (!deploymentAllowed.has(key)) issues.push(issue("config.deployment_invalid", ["deployment", key]));
      if (input.deployment.basePath !== undefined) {
        const value = input.deployment.basePath;
        if (typeof value !== "string" || value === "" || value === "/" || !value.startsWith("/") || value.endsWith("/") || value.includes("..") || value.includes("//")) issues.push(issue("config.deployment_invalid", ["deployment", "basePath"]));
        else basePath = value;
      }
      if (input.deployment.canonicalUrl !== undefined && !isNonEmptyString(input.deployment.canonicalUrl)) issues.push(issue("config.deployment_invalid", ["deployment", "canonicalUrl"]));
      if (input.deployment.documentationDestination !== undefined && (!isNonEmptyString(input.deployment.documentationDestination) || input.deployment.documentationDestination.includes(".."))) issues.push(issue("config.deployment_invalid", ["deployment", "documentationDestination"]));
    }
  }

  const ids = new Set();
  for (const [i, source] of (input.sources ?? []).entries()) { if (!isDefinedSource(source)) issues.push(issue("config.source_invalid", ["sources", i])); else if (ids.has(source.id)) issues.push(issue("config.duplicate_source", ["sources", i, "id"])); else ids.add(source.id); }
  function findSource(id) { return (input.sources ?? []).find((source) => isDefinedSource(source) && source.id === id); }

  const outputs = new Map();
  function claimOutput(path, at) { if (outputs.has(path)) issues.push(issue("config.output_collision", at)); else outputs.set(path, at); }
  claimOutput(bootstrapScriptOutput, []);
  claimOutput(artifactName, []);

  const servedPaths = new Set();
  for (const [i, route] of (input.routes ?? []).entries()) {
    if (!record(route)) { issues.push(issue("config.route_invalid", ["routes", i])); continue; }
    const normalizedPath = normalizedRoutePath(route.path);
    if (normalizedPath === undefined) { issues.push(issue("config.route_invalid", ["routes", i, "path"])); continue; }
    const served = servedRoutePath(basePath, normalizedPath);
    if (servedPaths.has(served)) issues.push(issue("config.duplicate_route", ["routes", i, "path"]));
    servedPaths.add(served);
    claimOutput(outputFile(normalizedPath), ["routes", i, "path"]);

    if (!record(route.metadata) || !isNonEmptyString(route.metadata.title)) {
      issues.push(issue("config.route_metadata_invalid", ["routes", i, "metadata"]));
    } else {
      const routeMetadataAllowed = new Set(["title", "description", "canonicalUrl", "socialImage"]);
      for (const key of Object.keys(route.metadata)) if (!routeMetadataAllowed.has(key)) issues.push(issue("config.route_metadata_invalid", ["routes", i, "metadata", key]));
      for (const key of ["description", "canonicalUrl", "socialImage"]) if (route.metadata[key] !== undefined && typeof route.metadata[key] !== "string") issues.push(issue("config.route_metadata_invalid", ["routes", i, "metadata", key]));
    }

    if (!isStringArray(route.requiredSourceIds)) { issues.push(issue("config.route_invalid", ["routes", i, "requiredSourceIds"])); continue; }
    const requiredIds = new Set();
    for (const [j, id] of route.requiredSourceIds.entries()) {
      if (requiredIds.has(id)) issues.push(issue("config.duplicate_required_source", ["routes", i, "requiredSourceIds", j]));
      requiredIds.add(id);
      if (!ids.has(id)) issues.push(issue("config.missing_source", ["routes", i, "requiredSourceIds", j]));
    }

    if (!record(route.presentation) || !Object.hasOwn(presentationRenderers, route.presentation.kind)) { issues.push(issue("config.route_invalid", ["routes", i, "presentation"])); continue; }
    const presentation = route.presentation;
    const modelSourceId = presentation.modelSourceId;
    const modelSource = findSource(modelSourceId);
    if (typeof modelSourceId !== "string" || !requiredIds.has(modelSourceId) || !modelSource || sourceDefinition(modelSource).viewModel.kind !== presentation.kind) {
      issues.push(issue("config.presentation_source_invalid", ["routes", i, "presentation", "modelSourceId"]));
    }
    for (const [slot, expectedKind] of Object.entries(presentationSlotKinds)) {
      const slotSourceId = presentation[slot];
      if (slotSourceId === undefined) continue;
      const slotSource = findSource(slotSourceId);
      if (typeof slotSourceId !== "string" || !requiredIds.has(slotSourceId) || !slotSource || sourceDefinition(slotSource).viewModel.kind !== expectedKind) {
        issues.push(issue("config.presentation_source_invalid", ["routes", i, "presentation", slot]));
      }
    }
  }

  let coreStyleDeclared = false;
  if (Array.isArray(input.styles)) {
    for (const [i, style] of input.styles.entries()) {
      if (!record(style)) { issues.push(issue("config.style_invalid", ["styles", i])); continue; }
      if (style.kind === "portfolio-core") {
        if (coreStyleDeclared) issues.push(issue("config.duplicate_style", ["styles", i]));
        if (!exactKeys(style, ["kind"])) issues.push(issue("config.style_invalid", ["styles", i]));
        coreStyleDeclared = true;
        claimOutput(coreStylesheetOutput, ["styles", i]);
      } else if (style.kind === "consumer-stylesheet") {
        if (!exactKeys(style, ["kind", "sourcePath", "outputPath"]) || !isNonEmptyString(style.sourcePath) || style.sourcePath.includes("..") || !style.sourcePath.endsWith(".css") || !isNonEmptyString(style.outputPath) || style.outputPath.includes("..") || style.outputPath.startsWith("/") || !style.outputPath.endsWith(".css")) {
          issues.push(issue("config.style_invalid", ["styles", i]));
        } else {
          claimOutput(style.outputPath, ["styles", i]);
        }
      } else {
        issues.push(issue("config.style_invalid", ["styles", i, "kind"]));
      }
    }
  }

  if (Array.isArray(input.navigation)) {
    for (const [i, item] of input.navigation.entries()) {
      const expectedKeys = item?.destination === undefined ? ["id"] : ["id", "destination"];
      if (!record(item) || !isNonEmptyString(item.id) || !exactKeys(item, expectedKeys)) { issues.push(issue("config.navigation_invalid", ["navigation", i])); continue; }
      if (item.destination !== undefined && (typeof item.destination !== "string" || !servedPaths.has(item.destination))) issues.push(issue("config.navigation_invalid", ["navigation", i, "destination"]));
    }
  }

  if (Array.isArray(input.publicAssets)) {
    for (const [i, asset] of input.publicAssets.entries()) {
      if (!record(asset) || !exactKeys(asset, ["sourcePath", "outputPath"]) || !isNonEmptyString(asset.sourcePath) || asset.sourcePath.includes("..") || !isNonEmptyString(asset.outputPath) || asset.outputPath.includes("..") || asset.outputPath.startsWith("/")) {
        issues.push(issue("config.asset_invalid", ["publicAssets", i]));
      } else {
        claimOutput(asset.outputPath, ["publicAssets", i]);
      }
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: input };
}

export async function loadPortfolioConfig(rootDir, configPath) {
  const root = resolve(rootDir); const path = contained(root, configPath); if (!path) throw new BuilderError("config.load_failed", "Configuration escapes root");
  let module; try { module = await import(`${pathToFileURL(path).href}?build=${Date.now()}`); } catch (cause) { throw new BuilderError("config.load_failed", "Configuration could not load", { cause, path }); }
  const config = module.default ?? module.config; return definePortfolioSite(config);
}

export function validateProvenanceManifestV1(input) {
  if (!record(input) || !exactKeys(input, ["version", "manifestDigest", "deliveryMechanics", "consumerOverlay", "effectiveTemplateOverlay"])) return { ok: false, issues: [issue("provenance.expected_object", [])] };
  const issues = [];
  if (input.version !== 1) issues.push(issue("provenance.version_invalid", ["version"]));
  if (!repositoryBaseline(input.deliveryMechanics)) issues.push(issue("provenance.delivery_invalid", ["deliveryMechanics"]));
  if (!repositoryBaseline(input.consumerOverlay, true)) issues.push(issue("provenance.consumer_invalid", ["consumerOverlay"]));
  if (!templateOverlayBaseline(input.effectiveTemplateOverlay)) issues.push(issue("provenance.template_invalid", ["effectiveTemplateOverlay"]));
  if (!immutableDigest(input.manifestDigest) || input.manifestDigest !== digest({ ...input, manifestDigest: "" })) issues.push(issue("provenance.digest_invalid", ["manifestDigest"]));
  return issues.length === 0 ? { ok: true, value: input } : { ok: false, issues };
}
async function provenance() { const input = JSON.parse(await readFile(manifestPath, "utf8")); const result = validateProvenanceManifestV1(input); if (!result.ok) throw new BuilderError("provenance.invalid", "Bundled provenance manifest is invalid", { issues: result.issues }); return result.value; }
async function resolveBuildSource(source) { const resolved = await resolveSource(source, { cancelled: false, onCancel: () => () => {} }); if (resolved.status === "error") throw new BuilderError("source_set.failed", "Source resolution failed", { sourceId: source.id, issues: resolved.error.issues, cause: resolved.error }); return resolved.status === "ready" ? { sourceId: source.id, status: "ready", value: resolved.data } : { sourceId: source.id, status: "fallback", value: resolved.data, fallbackError: resolved.error }; }
async function write(path, data) { if (process.env.SZD_PORTFOLIO_FAIL_AT === "write") throw new Error("injected write failure"); await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); }
async function fileDigests(root) { const entries = []; async function walk(dir) { for (const entry of await (await import("node:fs/promises")).readdir(dir, { withFileTypes: true })) { const absolute = join(dir, entry.name); if (entry.isDirectory()) await walk(absolute); else entries.push({ path: relative(root, absolute).replaceAll("\\", "/"), digest: digest(await readFile(absolute)) }); } } await walk(root); return entries.sort((a, b) => a.path.localeCompare(b.path)); }
async function regularContainedFile(root, relativePath) { const absolute = contained(root, relativePath); if (!absolute) return false; try { return (await stat(absolute)).isFile(); } catch { return false; } }
async function verifyDeclaredFiles(root, config) {
  for (const style of config.styles) if (style.kind === "consumer-stylesheet" && !(await regularContainedFile(root, style.sourcePath))) throw new BuilderError("asset.invalid", "Declared style source is missing or not a regular contained file", { path: style.sourcePath });
  for (const asset of config.publicAssets) if (!(await regularContainedFile(root, asset.sourcePath))) throw new BuilderError("asset.invalid", "Declared public asset source is missing or not a regular contained file", { path: asset.sourcePath });
}
function styleHref(style) { return `/${style.kind === "portfolio-core" ? coreStylesheetOutput : style.outputPath}`; }

async function resolveBuildSources(config) { const resolved = new Map(); for (const source of config.sources) if (source.timing === "build") resolved.set(source.id, await resolveBuildSource(source)); return resolved; }

async function compileRoutes(config, resolved, target) {
  const styleLinks = config.styles.map((style) => `<link rel="stylesheet" href="${styleHref(style)}">`).join("");
  const sourcesById = new Map(config.sources.map((source) => [source.id, source]));
  for (const route of config.routes) {
    const required = route.requiredSourceIds.map((id) => sourcesById.get(id));
    if (required.some((source) => source === undefined)) throw new BuilderError("route.invalid", "Route source is missing", { routePath: route.path });
    const browserSources = required.filter((source) => source.timing === "browser");
    const buildSources = required.filter((source) => source.timing === "build");
    const mode = browserSources.length === 0 ? "build-only" : "browser-gated";
    const modelVersions = required.map((source) => ({ sourceId: source.id, kind: sourceDefinition(source).viewModel.kind, version: 1 }));
    const buildModels = buildSources.map((source) => {
      const result = resolved.get(source.id);
      if (!result) throw new BuilderError("route.invalid", "Build source is missing", { routePath: route.path, sourceId: source.id });
      return result.fallbackError === undefined ? { sourceId: source.id, value: result.value } : { sourceId: source.id, value: result.value, fallbackError: { code: result.fallbackError.code, message: result.fallbackError.message, sourceId: result.fallbackError.sourceId, issues: result.fallbackError.issues } };
    });
    const bootstrap = { version: 1, routePath: route.path, mode, modelVersions, buildModels, browserSourceIds: browserSources.map((source) => source.id) };
    let body;
    if (mode === "browser-gated") body = renderToStaticMarkup(React.createElement("div", { className: "szd-portfolio-unresolved", "data-szd-portfolio-state": "unresolved" }));
    else {
      const sourceId = route.presentation.modelSourceId; const model = resolved.get(sourceId)?.value;
      if (!model) throw new BuilderError("route.invalid", "Presentation source missing", { routePath: route.path, sourceId });
      const Renderer = presentationRenderers[route.presentation.kind]; if (!Renderer) throw new BuilderError("route.invalid", "Unsupported presentation kind", { routePath: route.path });
      const extraProps = route.presentation.kind === "projects" ? { query: defaultProjectsQuery } : {};
      body = renderToStaticMarkup(React.createElement(Renderer, { model, ...extraProps }));
    }
    const html = `<!doctype html><html lang="${config.metadata.language ?? "en"}"><head><meta charset="utf-8"><title>${route.metadata?.title ?? config.metadata.title}</title>${styleLinks}</head><body>${body}<script type="application/json" id="szd-portfolio-bootstrap">${JSON.stringify(bootstrap).replaceAll("<", "\\u003c")}</script><script type="module" src="/${bootstrapScriptOutput}"></script></body></html>`;
    await write(join(target, outputFile(route.path)), html);
  }
  await write(join(target, bootstrapScriptOutput), "export {};\n");
}

async function copyAssets(root, config, target) {
  if (config.styles.some((style) => style.kind === "portfolio-core")) { const destination = join(target, coreStylesheetOutput); await mkdir(dirname(destination), { recursive: true }); await cp(stylesheetPath, destination); }
  for (const style of config.styles) if (style.kind === "consumer-stylesheet") { const source = contained(root, style.sourcePath); const destination = join(target, style.outputPath); if (!source) throw new BuilderError("asset.invalid", "Style escapes root"); await mkdir(dirname(destination), { recursive: true }); await cp(source, destination); }
  for (const asset of config.publicAssets) { const source = contained(root, asset.sourcePath); const destination = join(target, asset.outputPath); if (!source) throw new BuilderError("asset.invalid", "Asset escapes root"); await mkdir(dirname(destination), { recursive: true }); await cp(source, destination); }
}

function buildArtifactRecord(config, manifest, resolved, files) {
  const built = { version: 1, artifactDigest: "", packageVersion: "0.0.0-development", provenanceManifestDigest: manifest.manifestDigest, configurationDigest: digest({ version: config.version, routes: config.routes.map((r) => r.path) }), routes: config.routes.map((r) => r.path), sources: config.sources.map((s) => ({ id: s.id, timing: s.timing, modelVersion: 1, status: resolved.get(s.id)?.status })), files };
  built.artifactDigest = digest({ ...built, artifactDigest: "" });
  return built;
}

export async function buildPortfolioSite(paths) {
  if (!paths?.rootDir || !paths?.configPath || !paths?.outDir) throw new BuilderError("config.invalid", "Every build path is required");
  const config = await loadPortfolioConfig(paths.rootDir, paths.configPath); const manifest = await provenance(); const root = resolve(paths.rootDir); const out = contained(root, paths.outDir); if (!out) throw new BuilderError("config.invalid", "Output escapes root");
  await verifyDeclaredFiles(root, config);
  const lease = `${out}.lease.json`; const recovery = `${out}.recovery.json`;
  try { await access(recovery); throw new BuilderError("recovery.required", "Recovery is required", { path: recovery }); } catch (error) { if (error instanceof BuilderError) throw error; }
  try { await access(lease); throw new BuilderError("lease.unavailable", "Writer lease unavailable", { path: lease }); } catch (error) { if (error instanceof BuilderError) throw error; }
  await writeFile(lease, canonical({ version: 1, operation: "build", normalizedTargetPath: out, ownerId: randomUUID() })); const staging = `${out}.staging-${randomUUID()}`; const previous = `${out}.previous-${randomUUID()}`;
  try {
    const resolved = await resolveBuildSources(config);
    await compileRoutes(config, resolved, staging);
    await copyAssets(root, config, staging);
    const files = await fileDigests(staging); const record = buildArtifactRecord(config, manifest, resolved, files); await write(join(staging, artifactName), canonical(record));
    if (process.env.SZD_PORTFOLIO_FAIL_AT === "promotion") throw new Error("injected promotion failure"); let hadPrevious = false; try { await rename(out, previous); hadPrevious = true; } catch {} await rename(staging, out); if (hadPrevious) await rm(previous, { recursive: true, force: true }); return { artifactPath: out, record };
  } catch (cause) { const ambiguous = await stat(previous).then(() => true).catch(() => false); if (ambiguous) await writeFile(recovery, canonical({ version: 1, operation: "build", targetPath: out, stagingPath: staging, previousPath: previous, phase: "promotion-started" })); throw cause instanceof BuilderError ? cause : new BuilderError("promotion.failed", "Build failed", { cause });
  } finally { await rm(lease, { force: true }); await rm(staging, { recursive: true, force: true }); }
}

const checkGateIds = ["config", "provenance", "source_set", "route", "compile", "artifact"];
function gateDetail(cause) { return cause instanceof Error ? cause.message : String(cause); }

export async function checkPortfolioSite(paths) {
  if (!paths?.rootDir || !paths?.configPath) throw new BuilderError("config.invalid", "Every check path is required");
  const root = resolve(paths.rootDir);
  const target = join(tmpdir(), `szd-portfolio-check-${randomUUID()}`);
  const gates = new Map(checkGateIds.map((id) => [id, { id, status: "not-run" }]));
  const orderedGates = () => checkGateIds.map((id) => gates.get(id));
  async function gate(id, run) {
    try { const value = await run(); gates.set(id, { id, status: "passed" }); return value; }
    catch (cause) { gates.set(id, { id, status: "failed", detail: gateDetail(cause) }); throw new BuilderError("check.failed", "One or more check gates failed", { gates: orderedGates(), cause }); }
  }
  try {
    const config = await gate("config", () => loadPortfolioConfig(paths.rootDir, paths.configPath));
    const manifest = await gate("provenance", () => provenance());
    const resolved = await gate("source_set", () => resolveBuildSources(config));
    await gate("route", () => verifyDeclaredFiles(root, config));
    await gate("compile", async () => { await compileRoutes(config, resolved, target); await copyAssets(root, config, target); });
    const record = await gate("artifact", async () => {
      const files = await fileDigests(target);
      const candidate = buildArtifactRecord(config, manifest, resolved, files);
      const verified = validateArtifactRecordV1(candidate);
      if (!verified.ok || candidate.artifactDigest !== digest({ ...candidate, artifactDigest: "" })) throw new BuilderError("artifact.invalid", "Artifact record failed verification", { issues: verified.ok ? [] : verified.issues });
      return candidate;
    });
    return { record, gates: orderedGates() };
  } finally { await rm(target, { recursive: true, force: true }); }
}

const devStagingPrefix = "szd-portfolio-dev-";
const staticContentTypes = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"], [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".ico", "image/x-icon"], [".txt", "text/plain; charset=utf-8"]]);
function staticContentType(path) { return staticContentTypes.get(extname(path).toLowerCase()) ?? "application/octet-stream"; }
function staticRequestPath(url) {
  let decoded; try { decoded = decodeURIComponent((url ?? "/").split("?")[0].split("#")[0]); } catch { return undefined; }
  if (decoded.includes("\0") || !decoded.startsWith("/")) return undefined;
  const trimmed = decoded === "/" ? "/" : decoded.replace(/\/+$/, "") || "/";
  return extname(trimmed) ? trimmed.slice(1) : outputFile(trimmed);
}
async function respondNotFound(res) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Not found"); }
async function respondFromRoot(root, url, res) {
  const relativePath = root ? staticRequestPath(url) : undefined;
  let realRoot; if (relativePath) { try { realRoot = await realpath(root); } catch { realRoot = undefined; } }
  const absolute = realRoot ? contained(realRoot, relativePath) : undefined;
  let real; if (absolute) { try { real = await realpath(absolute); } catch { real = undefined; } }
  if (real && !contained(realRoot, relative(realRoot, real))) real = undefined;
  let data;
  if (real) { try { if (!(await stat(real)).isFile()) real = undefined; else data = await readFile(real); } catch { real = undefined; } }
  if (!real) return respondNotFound(res);
  res.writeHead(200, { "content-type": staticContentType(real) });
  res.end(data);
}

export async function startPortfolioDevServer(paths, address) {
  if (!paths?.rootDir || !paths?.configPath || !paths?.outDir) throw new BuilderError("config.invalid", "Every dev path is required");
  if (!address?.host || typeof address?.port !== "number") throw new BuilderError("config.invalid", "Every dev address value is required");
  const root = resolve(paths.rootDir);
  if (!contained(root, paths.outDir)) throw new BuilderError("config.invalid", "Output escapes root");

  const initialConfig = await loadPortfolioConfig(paths.rootDir, paths.configPath);
  const manifest = await provenance();
  const initialResolved = await resolveBuildSources(initialConfig);

  let currentDir, previousDir, lastError, closed = false, generationInFlight = false, pending = false;
  let activeGeneration = Promise.resolve();
  const watchers = new Map();
  const stagingDirs = new Set();

  function reportError(error) { process.stderr.write(`dev: generation failed: ${error.code ?? "generation.failed"}: ${error.message}\n`); }

  function declaredFilePaths(config) {
    const set = new Set();
    const configAbsolute = contained(root, paths.configPath);
    if (configAbsolute) set.add(configAbsolute);
    for (const style of config.styles) if (style.kind === "consumer-stylesheet") { const p = contained(root, style.sourcePath); if (p) set.add(p); }
    for (const asset of config.publicAssets) { const p = contained(root, asset.sourcePath); if (p) set.add(p); }
    return set;
  }

  function updateWatches(config) {
    const desired = declaredFilePaths(config);
    for (const [watchedPath, watcher] of watchers) if (!desired.has(watchedPath)) { watcher.close(); watchers.delete(watchedPath); }
    for (const watchedPath of desired) {
      if (watchers.has(watchedPath)) continue;
      try { const watcher = watch(watchedPath, () => { if (!closed) scheduleGeneration(); }); watcher.on("error", () => {}); watchers.set(watchedPath, watcher); } catch {}
    }
  }

  async function stageFrom(config, resolved) {
    const target = join(tmpdir(), `${devStagingPrefix}${randomUUID()}`);
    stagingDirs.add(target);
    await verifyDeclaredFiles(root, config);
    await compileRoutes(config, resolved, target);
    await copyAssets(root, config, target);
    const files = await fileDigests(target);
    const built = buildArtifactRecord(config, manifest, resolved, files);
    await write(join(target, artifactName), canonical(built));
    return { target, record: built };
  }

  async function publish(staged) {
    const toRemove = previousDir;
    previousDir = currentDir; currentDir = staged.target; lastError = undefined;
    if (toRemove) { await rm(toRemove, { recursive: true, force: true }); stagingDirs.delete(toRemove); }
  }

  async function runGeneration() {
    let config;
    try { config = await loadPortfolioConfig(paths.rootDir, paths.configPath); }
    catch (cause) { lastError = cause instanceof BuilderError ? cause : new BuilderError("config.load_failed", "Configuration could not load", { cause }); reportError(lastError); return; }
    if (closed) return;
    updateWatches(config);
    let staged;
    try { const resolved = await resolveBuildSources(config); staged = await stageFrom(config, resolved); }
    catch (cause) { lastError = cause instanceof BuilderError ? cause : new BuilderError("compile.failed", "Development generation failed", { cause }); reportError(lastError); return; }
    if (closed) { await rm(staged.target, { recursive: true, force: true }); stagingDirs.delete(staged.target); return; }
    await publish(staged);
  }

  function scheduleGeneration() {
    if (closed) return;
    if (generationInFlight) { pending = true; return; }
    generationInFlight = true;
    activeGeneration = runGeneration().finally(() => { generationInFlight = false; if (pending) { pending = false; scheduleGeneration(); } });
  }

  const server = createServer((req, res) => { respondFromRoot(currentDir, req.url, res).catch(() => { try { res.writeHead(500); res.end(); } catch {} }); });
  await new Promise((resolveBind, rejectBind) => {
    const onError = (cause) => { server.removeListener("listening", onListening); rejectBind(new BuilderError("server.bind_failed", "Dev server failed to bind", { cause })); };
    const onListening = () => { server.removeListener("error", onError); resolveBind(); };
    server.once("error", onError); server.once("listening", onListening);
    server.listen(address.port, address.host);
  });

  updateWatches(initialConfig);
  generationInFlight = true;
  activeGeneration = (async () => {
    try { await publish(await stageFrom(initialConfig, initialResolved)); }
    catch (cause) { lastError = cause instanceof BuilderError ? cause : new BuilderError("compile.failed", "Development generation failed", { cause }); reportError(lastError); }
  })().finally(() => { generationInFlight = false; if (pending) { pending = false; scheduleGeneration(); } });
  await activeGeneration;

  async function close() {
    if (closed) return;
    closed = true;
    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
    const stopped = new Promise((resolveClose) => server.close(() => resolveClose()));
    server.closeAllConnections();
    await stopped;
    await activeGeneration.catch(() => {});
    for (const dir of stagingDirs) await rm(dir, { recursive: true, force: true });
    stagingDirs.clear(); currentDir = undefined; previousDir = undefined;
  }

  const bound = server.address();
  return { address: { host: address.host, port: bound && typeof bound === "object" ? bound.port : address.port }, close };
}

export async function previewPortfolioSite(paths, address) {
  if (!paths?.rootDir || !paths?.configPath || !paths?.outDir) throw new BuilderError("config.invalid", "Every preview path is required");
  if (!address?.host || typeof address?.port !== "number") throw new BuilderError("config.invalid", "Every preview address value is required");
  const built = await buildPortfolioSite(paths);

  const server = createServer((req, res) => { respondFromRoot(built.artifactPath, req.url, res).catch(() => { try { res.writeHead(500); res.end(); } catch {} }); });
  await new Promise((resolveBind, rejectBind) => {
    const onError = (cause) => { server.removeListener("listening", onListening); server.close(() => {}); rejectBind(new BuilderError("server.bind_failed", "Preview server failed to bind", { cause })); };
    const onListening = () => { server.removeListener("error", onError); resolveBind(); };
    server.once("error", onError); server.once("listening", onListening);
    server.listen(address.port, address.host);
  });

  async function close() {
    const stopped = new Promise((resolveClose) => server.close(() => resolveClose()));
    server.closeAllConnections();
    await stopped;
  }

  const bound = server.address();
  return { address: { host: address.host, port: bound && typeof bound === "object" ? bound.port : address.port }, close };
}

export function validateArtifactRecordV1(input) { return record(input) && input.version === 1 && typeof input.artifactDigest === "string" && Array.isArray(input.files) ? { ok: true, value: input } : { ok: false, issues: [issue("artifact.invalid", [])] }; }
export function validateRecoveryRecordV1(input) { return record(input) && input.version === 1 && (input.operation === "build" || input.operation === "merge") ? { ok: true, value: input } : { ok: false, issues: [issue("recovery.invalid", [])] }; }

function normalizedProtectedSubtree(value) {
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value) || value.includes("\\")) return undefined;
  const parts = value.split("/").filter((part) => part.length > 0 && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) return undefined;
  return parts.join("/");
}
function normalizedProtectedPaths(values) {
  if (!Array.isArray(values)) throw new BuilderError("config.invalid", "Protected paths must be an array");
  const set = new Set();
  for (const value of values) {
    const normalized = normalizedProtectedSubtree(value);
    if (normalized === undefined) throw new BuilderError("config.invalid", "Protected path is invalid", { path: String(value) });
    set.add(normalized);
  }
  return [...set];
}
function underProtected(relativePath, protectedPaths) { return protectedPaths.some((path) => relativePath === path || relativePath.startsWith(`${path}/`)); }

async function directorySize(rootDir) {
  let total = 0;
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else { try { total += (await stat(absolute)).size; } catch {} }
    }
  }
  await walk(rootDir);
  return total;
}

async function protectedFingerprint(root, relativePath) {
  const absolute = contained(root, relativePath);
  if (!absolute) throw new BuilderError("merge.failed", "Protected path escapes destination", { path: relativePath });
  let info;
  try { info = await stat(absolute); } catch { return undefined; }
  if (info.isFile()) return digest(await readFile(absolute));
  if (info.isDirectory()) return digest(await fileDigests(absolute));
  return undefined;
}

async function acquireTreeLease(path, operation) {
  const leasePath = `${path}.lease.json`;
  try { await access(leasePath); throw new BuilderError("lease.unavailable", "Lease unavailable", { path: leasePath }); } catch (error) { if (error instanceof BuilderError) throw error; }
  await writeFile(leasePath, canonical({ version: 1, operation, normalizedTargetPath: path, ownerId: randomUUID() }));
  return leasePath;
}

export async function mergePortfolioArtifact(options) {
  if (!options?.artifactDir || !options?.targetDir) throw new BuilderError("config.invalid", "Every merge path is required");
  const sourceRoot = resolve(options.artifactDir);
  const targetRoot = resolve(options.targetDir);
  const protectedPaths = normalizedProtectedPaths(options.protectedPaths ?? []);

  const targetRecovery = `${targetRoot}.recovery.json`;
  try { await access(targetRecovery); throw new BuilderError("recovery.required", "Recovery is required", { path: targetRecovery }); } catch (error) { if (error instanceof BuilderError) throw error; }

  const orderedPaths = [...new Set([sourceRoot, targetRoot])].sort();
  const acquiredLeases = [];
  try {
    for (const path of orderedPaths) acquiredLeases.push(await acquireTreeLease(path, path === sourceRoot ? "merge-read" : "merge-write"));
  } catch (error) {
    for (const leasePath of acquiredLeases) await rm(leasePath, { force: true });
    throw error;
  }

  const staging = `${targetRoot}.staging-${randomUUID()}`;
  const previous = `${targetRoot}.previous-${randomUUID()}`;
  try {
    const artifactRecordPath = join(sourceRoot, artifactName);
    let rawRecord;
    try { rawRecord = JSON.parse(await readFile(artifactRecordPath, "utf8")); } catch (cause) { throw new BuilderError("merge.failed", "Source artifact record could not be read", { path: artifactRecordPath, cause }); }
    const verifiedRecord = validateArtifactRecordV1(rawRecord);
    if (!verifiedRecord.ok) throw new BuilderError("merge.failed", "Source artifact record is invalid", { path: artifactRecordPath, issues: verifiedRecord.issues });
    const sourceRecord = verifiedRecord.value;
    const actualFiles = (await fileDigests(sourceRoot)).filter((file) => file.path !== artifactName);
    if (sourceRecord.artifactDigest !== digest({ ...sourceRecord, artifactDigest: "" }) || digest(actualFiles) !== digest(sourceRecord.files)) {
      throw new BuilderError("merge.failed", "Source artifact does not match its record", { path: sourceRoot });
    }

    let targetExists = true;
    try { await stat(targetRoot); } catch { targetExists = false; }

    const mergedPaths = [...sourceRecord.files.map((file) => file.path), artifactName];
    for (const path of mergedPaths) if (!contained(targetRoot, path)) throw new BuilderError("merge.failed", "Merged path escapes the destination", { path });
    const collisions = mergedPaths.filter((path) => underProtected(path, protectedPaths));
    if (collisions.length > 0) throw new BuilderError("merge.collision", "Artifact collides with a protected path", { path: collisions[0], issues: collisions.map((path) => issue("merge.collision", [path])) });

    const initialFingerprints = new Map();
    for (const protectedPath of protectedPaths) initialFingerprints.set(protectedPath, await protectedFingerprint(targetRoot, protectedPath));

    if (process.env.SZD_PORTFOLIO_FAIL_AT === "capacity") throw new BuilderError("merge.failed", "Insufficient capacity for merge", { path: targetRoot });
    const sourceBytes = await directorySize(sourceRoot);
    const targetBytes = targetExists ? await directorySize(targetRoot) : 0;
    try {
      const stats = await statfs(dirname(targetRoot));
      if (stats.bavail * stats.bsize < sourceBytes + targetBytes) throw new BuilderError("merge.failed", "Insufficient capacity for merge", { path: targetRoot });
    } catch (cause) { if (cause instanceof BuilderError) throw cause; }

    if (targetExists) await cp(targetRoot, staging, { recursive: true }); else await mkdir(staging, { recursive: true });
    if (process.env.SZD_PORTFOLIO_FAIL_AT === "write") throw new Error("injected write failure");
    for (const file of sourceRecord.files) { await mkdir(dirname(join(staging, file.path)), { recursive: true }); await cp(join(sourceRoot, file.path), join(staging, file.path)); }
    await cp(artifactRecordPath, join(staging, artifactName));

    if (process.env.SZD_PORTFOLIO_MERGE_DELAY_MS) await new Promise((resolveDelay) => setTimeout(resolveDelay, Number(process.env.SZD_PORTFOLIO_MERGE_DELAY_MS)));

    for (const protectedPath of protectedPaths) {
      const current = await protectedFingerprint(targetRoot, protectedPath);
      if (current !== initialFingerprints.get(protectedPath)) throw new BuilderError("merge.target_changed", "A protected fingerprint changed during merge", { path: protectedPath });
    }
    const stagedFiles = (await fileDigests(staging)).filter((file) => file.path !== artifactName);
    for (const file of sourceRecord.files) {
      const staged = stagedFiles.find((entry) => entry.path === file.path);
      if (!staged || staged.digest !== file.digest) throw new BuilderError("merge.failed", "Staged artifact content does not match its record", { path: file.path });
    }

    if (process.env.SZD_PORTFOLIO_FAIL_AT === "promotion") throw new Error("injected promotion failure");
    let hadPrevious = false;
    try { await rename(targetRoot, previous); hadPrevious = true; } catch {}
    if (process.env.SZD_PORTFOLIO_FAIL_AT === "promotion-interrupted") throw new Error("injected interrupted-promotion failure");
    await rename(staging, targetRoot);
    if (hadPrevious) await rm(previous, { recursive: true, force: true });
    return { targetDir: targetRoot, artifactDigest: sourceRecord.artifactDigest };
  } catch (cause) {
    const ambiguous = await stat(previous).then(() => true).catch(() => false);
    if (ambiguous) await writeFile(targetRecovery, canonical({ version: 1, operation: "merge", targetPath: targetRoot, stagingPath: staging, previousPath: previous, phase: "promotion-started" }));
    throw cause instanceof BuilderError ? cause : new BuilderError("merge.failed", "Merge failed", { cause });
  } finally {
    for (const leasePath of acquiredLeases) await rm(leasePath, { force: true });
    await rm(staging, { recursive: true, force: true });
  }
}
