import { createHash, randomUUID } from "node:crypto";
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Portfolio, validatePortfolioViewModelV1 } from "./index.js";

const definitions = new WeakMap();
const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, "builder", "provenance.json");
const artifactName = ".szd-portfolio-artifact.json";

export class BuilderError extends Error {
  constructor(code, message, options = {}) { super(message, options.cause === undefined ? undefined : { cause: options.cause }); this.name = "BuilderError"; this.code = code; this.routePath = options.routePath; this.sourceId = options.sourceId; this.path = options.path; this.issues = options.issues ?? []; this.causes = options.causes ?? []; this.gates = options.gates ?? []; if (options.cause !== undefined) this.cause = options.cause; }
}

function canonical(value) { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function digest(value) { return `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex")}`; }
function issue(code, path) { return { code, path, message: code }; }
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function contained(root, value) { const absolute = isAbsolute(value) ? resolve(value) : resolve(root, value); return (absolute === resolve(root) || relative(resolve(root), absolute) && !relative(resolve(root), absolute).startsWith("..")) ? absolute : undefined; }
function outputFile(route) { return route === "/" ? "index.html" : `${route.replace(/^\//, "")}/index.html`; }
function declaredSource(source) { return definitions.get(source); }

export function defineSource(input) {
  if (!record(input) || typeof input.id !== "string" || !input.id || !["build", "browser"].includes(input.timing) || !input.provider || typeof input.provider.resolve !== "function" || typeof input.validateRaw !== "function" || typeof input.project !== "function" || !input.viewModel || typeof input.viewModel.validate !== "function") throw new BuilderError("config.invalid", "Invalid source declaration");
  const source = Object.freeze({ id: input.id, timing: input.timing }); definitions.set(source, input); return source;
}

export function definePortfolioSite(config) { const result = validatePortfolioSiteConfigV1(config); if (!result.ok) throw new BuilderError("config.invalid", "Invalid site configuration", { issues: result.issues }); return config; }
export function validatePortfolioSiteConfigV1(input) {
  const issues = [];
  if (!record(input)) return { ok: false, issues: [issue("config.expected_object", [])] };
  const allowed = new Set(["version", "routes", "sources", "metadata", "styles", "navigation", "publicAssets", "deployment"]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) issues.push(issue("config.unknown_field", [key]));
  if (input.version !== 1) issues.push(issue("config.unsupported_version", ["version"]));
  if (!Array.isArray(input.routes) || input.routes.length === 0) issues.push(issue("config.routes_required", ["routes"]));
  if (!Array.isArray(input.sources)) issues.push(issue("config.sources_required", ["sources"]));
  if (!record(input.metadata) || typeof input.metadata.title !== "string" || !input.metadata.title) issues.push(issue("config.metadata_invalid", ["metadata"]));
  for (const key of ["styles", "navigation", "publicAssets"]) if (!Array.isArray(input[key])) issues.push(issue("config.array_required", [key]));
  const ids = new Set(); for (const [i, source] of (input.sources ?? []).entries()) { const def = declaredSource(source); if (!def) issues.push(issue("config.source_invalid", ["sources", i])); else if (ids.has(source.id)) issues.push(issue("config.duplicate_source", ["sources", i, "id"])); else ids.add(source.id); }
  const paths = new Set(); for (const [i, route] of (input.routes ?? []).entries()) { if (!record(route) || typeof route.path !== "string" || !route.path.startsWith("/") || route.path.includes("..")) { issues.push(issue("config.route_invalid", ["routes", i])); continue; } if (paths.has(route.path)) issues.push(issue("config.duplicate_route", ["routes", i, "path"])); paths.add(route.path); if (!Array.isArray(route.requiredSourceIds) || !record(route.presentation) || route.presentation.kind !== "portfolio") issues.push(issue("config.route_invalid", ["routes", i])); else for (const id of route.requiredSourceIds) if (!ids.has(id)) issues.push(issue("config.missing_source", ["routes", i, "requiredSourceIds"])); }
  return issues.length ? { ok: false, issues } : { ok: true, value: input };
}

export async function loadPortfolioConfig(rootDir, configPath) {
  const root = resolve(rootDir); const path = contained(root, configPath); if (!path) throw new BuilderError("config.load_failed", "Configuration escapes root");
  let module; try { module = await import(`${pathToFileURL(path).href}?build=${Date.now()}`); } catch (cause) { throw new BuilderError("config.load_failed", "Configuration could not load", { cause, path }); }
  const config = module.default ?? module.config; return definePortfolioSite(config);
}

export function validateProvenanceManifestV1(input) {
  if (!record(input) || input.version !== 1 || !record(input.deliveryMechanics) || !record(input.consumerOverlay) || input.consumerOverlay.clean !== true || !record(input.effectiveTemplateOverlay)) return { ok: false, issues: [issue("provenance.invalid", [])] };
  const actual = digest({ ...input, manifestDigest: "" }); return input.manifestDigest === actual ? { ok: true, value: input } : { ok: false, issues: [issue("provenance.digest_invalid", ["manifestDigest"])] };
}
async function provenance() { const input = JSON.parse(await readFile(manifestPath, "utf8")); const result = validateProvenanceManifestV1(input); if (!result.ok) throw new BuilderError("provenance.invalid", "Bundled provenance manifest is invalid", { issues: result.issues }); return result.value; }
async function resolveBuildSource(source) { const def = declaredSource(source); try { const result = await def.provider.resolve({ cancelled: false, onCancel: () => () => {} }); const raw = def.validateRaw(result.value); if (!raw?.ok) throw new BuilderError("source_set.failed", "Consumer validation failed", { sourceId: source.id, issues: raw?.issues }); let candidate; try { candidate = def.project(raw.value); } catch (cause) { throw new BuilderError("source_set.failed", "Projection failed", { sourceId: source.id, cause }); } const view = def.viewModel.validate(candidate); if (!view?.ok) throw new BuilderError("source_set.failed", "View validation failed", { sourceId: source.id, issues: view?.issues }); return { sourceId: source.id, status: "ready", value: view.value }; } catch (error) { if (error instanceof BuilderError) throw error; if (def.fallback !== undefined) { const fallback = def.viewModel.validate(def.fallback); if (fallback?.ok) return { sourceId: source.id, status: "fallback", value: fallback.value, fallbackError: error }; throw new BuilderError("source_set.failed", "Fallback invalid", { sourceId: source.id, issues: fallback?.issues }); } throw new BuilderError("source_set.failed", "Provider resolution failed", { sourceId: source.id, cause: error }); } }
async function write(path, data) { if (process.env.SZD_PORTFOLIO_FAIL_AT === "write") throw new Error("injected write failure"); await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); }
async function fileDigests(root) { const entries = []; async function walk(dir) { for (const entry of await (await import("node:fs/promises")).readdir(dir, { withFileTypes: true })) { const absolute = join(dir, entry.name); if (entry.isDirectory()) await walk(absolute); else entries.push({ path: relative(root, absolute).replaceAll("\\", "/"), digest: digest(await readFile(absolute)) }); } } await walk(root); return entries.sort((a, b) => a.path.localeCompare(b.path)); }
export async function buildPortfolioSite(paths) {
  if (!paths?.rootDir || !paths?.configPath || !paths?.outDir) throw new BuilderError("config.invalid", "Every build path is required");
  const config = await loadPortfolioConfig(paths.rootDir, paths.configPath); const manifest = await provenance(); const root = resolve(paths.rootDir); const out = contained(root, paths.outDir); if (!out) throw new BuilderError("config.invalid", "Output escapes root"); const lease = `${out}.lease.json`; const recovery = `${out}.recovery.json`;
  try { await access(recovery); throw new BuilderError("recovery.required", "Recovery is required", { path: recovery }); } catch (error) { if (error instanceof BuilderError) throw error; }
  try { await access(lease); throw new BuilderError("lease.unavailable", "Writer lease unavailable", { path: lease }); } catch (error) { if (error instanceof BuilderError) throw error; }
  await writeFile(lease, canonical({ version: 1, operation: "build", normalizedTargetPath: out, ownerId: randomUUID() })); const staging = `${out}.staging-${randomUUID()}`; const previous = `${out}.previous-${randomUUID()}`;
  try {
    const resolved = new Map(); for (const source of config.sources) if (source.timing === "build") resolved.set(source.id, await resolveBuildSource(source));
    for (const route of config.routes) for (const id of route.requiredSourceIds) if (!resolved.has(id)) throw new BuilderError("route.invalid", "Route requires a non-build source", { routePath: route.path, sourceId: id });
    for (const route of config.routes) { const sourceId = route.presentation.modelSourceId; const model = resolved.get(sourceId)?.value; if (!model) throw new BuilderError("route.invalid", "Portfolio source missing", { routePath: route.path, sourceId }); const html = `<!doctype html><html lang="${config.metadata.language ?? "en"}"><head><meta charset="utf-8"><title>${route.metadata?.title ?? config.metadata.title}</title></head><body>${renderToStaticMarkup(React.createElement(Portfolio, { model }))}<script type="application/json" id="szd-portfolio-bootstrap">${JSON.stringify({ version: 1, routePath: route.path, mode: "build-only", modelVersions: [{ sourceId, version: 1 }], buildModels: [{ sourceId, value: model }], browserSourceIds: [] }).replaceAll("<", "\\u003c")}</script><script type="module" src="/assets/szd-portfolio-bootstrap.js"></script></body></html>`; await write(join(staging, outputFile(route.path)), html); }
    await write(join(staging, "assets/szd-portfolio-bootstrap.js"), "export {};\n");
    for (const style of config.styles) if (style.kind === "consumer-stylesheet") { const source = contained(root, style.sourcePath); const destination = join(staging, style.outputPath); if (!source) throw new BuilderError("asset.invalid", "Style escapes root"); await mkdir(dirname(destination), { recursive: true }); await cp(source, destination); }
    for (const asset of config.publicAssets) { const source = contained(root, asset.sourcePath); const destination = join(staging, asset.outputPath); if (!source) throw new BuilderError("asset.invalid", "Asset escapes root"); await mkdir(dirname(destination), { recursive: true }); await cp(source, destination); }
    const files = await fileDigests(staging); const record = { version: 1, artifactDigest: "", packageVersion: "0.0.0-development", provenanceManifestDigest: manifest.manifestDigest, configurationDigest: digest({ version: config.version, routes: config.routes.map((r) => r.path) }), routes: config.routes.map((r) => r.path), sources: config.sources.map((s) => ({ id: s.id, timing: s.timing, modelVersion: 1, status: resolved.get(s.id)?.status })), files }; record.artifactDigest = digest({ ...record, artifactDigest: "" }); await write(join(staging, artifactName), canonical(record));
    if (process.env.SZD_PORTFOLIO_FAIL_AT === "promotion") throw new Error("injected promotion failure"); let hadPrevious = false; try { await rename(out, previous); hadPrevious = true; } catch {} await rename(staging, out); if (hadPrevious) await rm(previous, { recursive: true, force: true }); return { artifactPath: out, record };
  } catch (cause) { const ambiguous = await stat(previous).then(() => true).catch(() => false); if (ambiguous) await writeFile(recovery, canonical({ version: 1, operation: "build", targetPath: out, stagingPath: staging, previousPath: previous, phase: "promotion-started" })); throw cause instanceof BuilderError ? cause : new BuilderError("promotion.failed", "Build failed", { cause });
  } finally { await rm(lease, { force: true }); await rm(staging, { recursive: true, force: true }); }
}

export function validateArtifactRecordV1(input) { return record(input) && input.version === 1 && typeof input.artifactDigest === "string" && Array.isArray(input.files) ? { ok: true, value: input } : { ok: false, issues: [issue("artifact.invalid", [])] }; }
export function validateRecoveryRecordV1(input) { return record(input) && input.version === 1 && input.operation === "build" ? { ok: true, value: input } : { ok: false, issues: [issue("recovery.invalid", [])] }; }
