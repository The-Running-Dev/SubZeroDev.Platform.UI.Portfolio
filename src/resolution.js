import {
  validateCVViewModelV1,
  validatePortfolioViewModelV1,
  validateSiteChromeViewModelV1,
  validateVersionDisplayViewModelV1,
} from "./index.js";

const definitions = new WeakMap();

export class ResolutionError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ResolutionError";
    this.code = code;
    this.sourceId = options.sourceId;
    this.issues = options.issues ?? [];
    this.causes = options.causes ?? [];
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export const portfolioViewModelV1Contract = Object.freeze({ kind: "portfolio", validate: validatePortfolioViewModelV1 });
export const siteChromeViewModelV1Contract = Object.freeze({ kind: "site-chrome", validate: validateSiteChromeViewModelV1 });
export const cvViewModelV1Contract = Object.freeze({ kind: "cv", validate: validateCVViewModelV1 });
export const versionDisplayViewModelV1Contract = Object.freeze({ kind: "version-display", validate: validateVersionDisplayViewModelV1 });

const contracts = new Map([
  ["portfolio", portfolioViewModelV1Contract],
  ["site-chrome", siteChromeViewModelV1Contract],
  ["cv", cvViewModelV1Contract],
  ["version-display", versionDisplayViewModelV1Contract],
]);

function bootstrapIssue(path) { return { code: "bootstrap.invalid", path, message: "Invalid browser bootstrap." }; }
function exact(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function sourceId(value) { return typeof value === "string" && value.length > 0; }

export function validateBrowserBootstrapV1(input) {
  const issues = [];
  if (!exact(input, ["version", "routePath", "mode", "modelVersions", "buildModels", "browserSourceIds"])) return { ok: false, issues: [bootstrapIssue([])] };
  if (input.version !== 1) issues.push(bootstrapIssue(["version"]));
  if (typeof input.routePath !== "string" || !input.routePath.startsWith("/") || input.routePath.includes("..")) issues.push(bootstrapIssue(["routePath"]));
  if (!["build-only", "browser-gated"].includes(input.mode)) issues.push(bootstrapIssue(["mode"]));
  if (!Array.isArray(input.modelVersions) || !Array.isArray(input.buildModels) || !Array.isArray(input.browserSourceIds)) return { ok: false, issues: [...issues, bootstrapIssue([])] };
  const versions = new Map();
  input.modelVersions.forEach((entry, index) => {
    if (!exact(entry, ["sourceId", "kind", "version"]) || !sourceId(entry.sourceId) || !contracts.has(entry.kind) || entry.version !== 1 || versions.has(entry.sourceId)) issues.push(bootstrapIssue(["modelVersions", index]));
    else versions.set(entry.sourceId, entry);
  });
  const built = new Set();
  input.buildModels.forEach((entry, index) => {
    const version = versions.get(entry?.sourceId);
    if (!exact(entry, entry?.fallbackError === undefined ? ["sourceId", "value"] : ["sourceId", "value", "fallbackError"]) || !version || built.has(entry.sourceId)) { issues.push(bootstrapIssue(["buildModels", index])); return; }
    built.add(entry.sourceId);
    const validated = contracts.get(version.kind).validate(entry.value);
    if (!validated.ok) issues.push(bootstrapIssue(["buildModels", index, "value"]));
    if (entry.fallbackError !== undefined && (!exact(entry.fallbackError, entry.fallbackError?.sourceId === undefined ? ["code", "message", "issues"] : ["code", "message", "sourceId", "issues"]) || typeof entry.fallbackError.code !== "string" || typeof entry.fallbackError.message !== "string" || !Array.isArray(entry.fallbackError.issues))) issues.push(bootstrapIssue(["buildModels", index, "fallbackError"]));
  });
  const browser = new Set();
  input.browserSourceIds.forEach((id, index) => { if (!sourceId(id) || browser.has(id) || built.has(id) || !versions.has(id)) issues.push(bootstrapIssue(["browserSourceIds", index])); browser.add(id); });
  if (input.mode === "build-only" && browser.size > 0) issues.push(bootstrapIssue(["browserSourceIds"]));
  if (input.mode === "browser-gated" && browser.size === 0) issues.push(bootstrapIssue(["browserSourceIds"]));
  if (versions.size !== built.size + browser.size) issues.push(bootstrapIssue(["modelVersions"]));
  return issues.length === 0 ? { ok: true, value: input } : { ok: false, issues };
}

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }

function validProvider(provider) {
  return provider && typeof provider.kind === "string" && Array.isArray(provider.publicDescriptor) && provider.publicDescriptor.every((entry) => entry && typeof entry.name === "string" && typeof entry.value === "string") && typeof provider.resolve === "function";
}

export function defineSource(input) {
  if (!record(input) || typeof input.id !== "string" || input.id.length === 0 || !["build", "browser"].includes(input.timing) || !validProvider(input.provider) || typeof input.validateRaw !== "function" || typeof input.project !== "function" || !input.viewModel || typeof input.viewModel.kind !== "string" || typeof input.viewModel.validate !== "function") throw new ResolutionError("source.failed", "Invalid source declaration", { sourceId: input?.id });
  if (input.fallback !== undefined) {
    let fallbackResult;
    try { fallbackResult = input.viewModel.validate(input.fallback); } catch (cause) { throw new ResolutionError("fallback.invalid", "Fallback validation threw", { sourceId: input.id, cause }); }
    if (!fallbackResult?.ok) throw new ResolutionError("fallback.invalid", "Fallback is invalid", { sourceId: input.id, issues: fallbackResult?.issues });
  }
  const source = Object.freeze({ id: input.id, timing: input.timing });
  definitions.set(source, input);
  return source;
}

export function isDefinedSource(source) { return definitions.has(source); }
export function sourceDefinition(source) { return definitions.get(source); }

function cancelled(signal) { return signal?.cancelled === true; }
function sourceError(code, sourceId, message, options) { return new ResolutionError(code, message, { sourceId, ...options }); }

export async function resolveSource(source, signal) {
  const definition = definitions.get(source);
  if (!definition) return { status: "error", sourceId: source?.id ?? "", error: sourceError("source.failed", source?.id, "Source is not defined") };
  if (cancelled(signal)) return { status: "error", sourceId: source.id, error: sourceError("source.failed", source.id, "Source resolution was cancelled") };
  const provider = signal?.refresh === true ? definition.provider.refresh : definition.provider.resolve;
  if (typeof provider !== "function") return fallback(definition, sourceError("source.refresh_unavailable", source.id, "Source refresh is unavailable"));
  let result;
  try { result = await provider(signal); } catch (cause) { return fallback(definition, sourceError("source.failed", source.id, "Source provider failed", { cause })); }
  if (!result || !Array.isArray(result.metadata)) return fallback(definition, sourceError("source.failed", source.id, "Source provider returned an invalid result"));
  let raw;
  try { raw = definition.validateRaw(result.value); } catch (cause) { return fallback(definition, sourceError("consumer.validator_threw", source.id, "Consumer validation threw", { cause })); }
  if (!raw?.ok) return fallback(definition, sourceError("consumer.validation_failed", source.id, "Consumer validation failed", { issues: raw?.issues }));
  let candidate;
  try { candidate = definition.project(raw.value); } catch (cause) { return fallback(definition, sourceError("projection.failed", source.id, "Source projection failed", { cause })); }
  let view;
  try { view = definition.viewModel.validate(candidate); } catch (cause) { return fallback(definition, sourceError("source.failed", source.id, "View validation threw", { cause })); }
  if (!view?.ok) return fallback(definition, sourceError("source.failed", source.id, "View validation failed", { issues: view?.issues }));
  return { status: "ready", sourceId: source.id, data: view.value, metadata: result.metadata };
}

function fallback(definition, error) {
  if (definition.fallback === undefined) return { status: "error", sourceId: definition.id, error };
  let validated;
  try { validated = definition.viewModel.validate(definition.fallback); } catch (cause) { return { status: "error", sourceId: definition.id, error: sourceError("fallback.invalid", definition.id, "Fallback validation threw", { cause }) }; }
  if (!validated?.ok) return { status: "error", sourceId: definition.id, error: sourceError("fallback.invalid", definition.id, "Fallback is invalid", { issues: validated?.issues }) };
  return { status: "fallback", sourceId: definition.id, data: validated.value, error, metadata: [] };
}

export function resolveSources(sources, signal) { return Promise.all(sources.map((source) => resolveSource(source, signal))); }

export function toResolvedValue(resolution) {
  return resolution.status === "ready" ? { sourceId: resolution.sourceId, status: "ready", value: resolution.data } : { sourceId: resolution.sourceId, status: "fallback", value: resolution.data, fallbackError: resolution.error };
}
