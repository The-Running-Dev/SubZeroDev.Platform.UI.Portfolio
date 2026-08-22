import React from "react";
import { hydrateRoot } from "react-dom/client";
import {
  ResolutionError,
  resolveSources,
  validateBrowserBootstrapV1,
} from "./index.js";
import { sourceDefinition, toResolvedValue } from "./resolution.js";

export class BrowserError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "BrowserError";
    this.code = code;
    this.routePath = options.routePath;
    this.sourceId = options.sourceId;
    this.issues = options.issues ?? [];
    this.causes = options.causes ?? [];
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

function restoredError(serialized) {
  return new ResolutionError(serialized.code, serialized.message, { sourceId: serialized.sourceId, issues: serialized.issues });
}

function asBrowserError(error, routePath, code = "browser.sources_failed") {
  if (error instanceof BrowserError) return error;
  return new BrowserError(code, code === "browser.sources_failed" ? "Browser sources failed" : "Browser hydration failed", { routePath, cause: error });
}

function valuesFromBootstrap(bootstrap) {
  return bootstrap.buildModels.map((entry) => entry.fallbackError === undefined
    ? { sourceId: entry.sourceId, status: "ready", value: entry.value }
    : { sourceId: entry.sourceId, status: "fallback", value: entry.value, fallbackError: restoredError(entry.fallbackError) });
}

function matchingSources(bootstrap, sources) {
  if (!Array.isArray(sources) || sources.length !== bootstrap.browserSourceIds.length) return false;
  return sources.every((source, index) => {
    const definition = sourceDefinition(source);
    const version = bootstrap.modelVersions.find((entry) => entry.sourceId === source?.id);
    return source?.id === bootstrap.browserSourceIds[index] && source.timing === "browser" && definition?.viewModel?.kind === version?.kind;
  });
}

function committedEffect(callback) {
  return function CommitEffect() { React.useEffect(() => { callback(); }, [callback]); return null; };
}

export function hydratePortfolioRoute(options) {
  const bootstrapResult = validateBrowserBootstrapV1(options?.bootstrap);
  const routePath = bootstrapResult.ok ? bootstrapResult.value.routePath : undefined;
  if (!bootstrapResult.ok || !matchingSources(bootstrapResult.value ?? { browserSourceIds: [], modelVersions: [] }, options?.sources)) {
    const error = new BrowserError("bootstrap.invalid", "Browser bootstrap is invalid", { routePath, issues: bootstrapResult.issues ?? [] });
    try { hydrateRoot(options?.container, options?.renderError(error)); } catch {}
    throw error;
  }
  const bootstrap = bootstrapResult.value;
  let snapshot = { status: "loading", routePath: bootstrap.routePath };
  let root;
  let disposed = false;
  let generation = 0;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const disposedError = () => new BrowserError("generation.disposed", "Browser route is disposed", { routePath: bootstrap.routePath });
  const publish = (result) => { if (!disposed) { snapshot = result; notify(); } return result; };
  const settle = async (refresh) => {
    const signal = { cancelled: false, refresh, onCancel: () => () => {} };
    const settled = await resolveSources(options.sources, signal);
    const failures = settled.filter((entry) => entry.status === "error");
    if (failures.length) throw new BrowserError("browser.sources_failed", "Browser sources failed", { routePath: bootstrap.routePath, causes: failures.map((entry) => entry.error) });
    const values = [...valuesFromBootstrap(bootstrap), ...settled.map(toResolvedValue)];
    const ordered = bootstrap.modelVersions.map((entry) => values.find((value) => value.sourceId === entry.sourceId));
    return { status: ordered.some((entry) => entry.status === "fallback") ? "fallback" : "ready", routePath: bootstrap.routePath, sources: ordered };
  };
  const renderPublished = (result) => {
    if (!root) return publish({ status: "error", routePath: bootstrap.routePath, error: new BrowserError("browser.hydration_failed", "Browser hydration is not ready", { routePath: bootstrap.routePath }) });
    try { root.render(options.compose(result.sources)); return publish(result); }
    catch (cause) { const error = asBrowserError(cause, bootstrap.routePath, "browser.hydration_failed"); try { root.render(options.renderError(error)); } catch {} return publish({ status: "error", routePath: bootstrap.routePath, error }); }
  };
  const initialPublication = settle(false).then((result) => new Promise((resolve) => {
    if (disposed) return resolve(publish({ status: "error", routePath: bootstrap.routePath, error: disposedError() }));
    const Commit = committedEffect(() => resolve(renderPublished(result)));
    try { root = hydrateRoot(options.container, React.createElement(React.Fragment, null, options.unresolved, React.createElement(Commit))); }
    catch (cause) { const error = asBrowserError(cause, bootstrap.routePath, "browser.hydration_failed"); resolve(publish({ status: "error", routePath: bootstrap.routePath, error })); }
  })).catch((cause) => {
    const error = asBrowserError(cause, bootstrap.routePath);
    if (!disposed) { try { root = hydrateRoot(options.container, options.unresolved); root.render(options.renderError(error)); } catch {} }
    return publish({ status: "error", routePath: bootstrap.routePath, error });
  });
  const refresh = async () => {
    if (disposed) throw disposedError();
    await initialPublication;
    if (disposed) throw disposedError();
    const current = ++generation;
    snapshot = { status: "loading", routePath: bootstrap.routePath }; notify();
    let result;
    try { result = await settle(true); } catch (cause) { result = { status: "error", routePath: bootstrap.routePath, error: asBrowserError(cause, bootstrap.routePath) }; }
    if (disposed) throw disposedError();
    if (current !== generation) throw new BrowserError("generation.superseded", "Browser refresh was superseded", { routePath: bootstrap.routePath });
    return result.status === "error" ? publish(result) : renderPublished(result);
  };
  return Object.freeze({
    initialPublication,
    snapshot: () => snapshot,
    refresh,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    dispose: () => { if (disposed) return; disposed = true; listeners.clear(); try { root?.unmount(); } catch {} },
  });
}

function safeRead(storage, key) { try { return storage.read(key); } catch { return null; } }
function safeWrite(storage, key, value) { try { storage.write(key, value); } catch {} }
function safeSetAttribute(dom, name, value) { try { dom.setAttribute(name, value); } catch {} }
function safeRemoveAttribute(dom, name) { try { dom.removeAttribute(name); } catch {} }

function sameValue(a, b) { return a === b || JSON.stringify(a) === JSON.stringify(b); }

function preferenceController(initial, apply, persist) {
  let current = initial;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  let disposed = false;
  apply(current);
  return Object.freeze({
    get: () => current,
    set: (value) => {
      if (disposed) return;
      const next = persist.sanitize(value);
      if (next === undefined || sameValue(next, current)) return;
      current = next;
      apply(current);
      persist.write(current);
      notify();
    },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    dispose: () => { disposed = true; listeners.clear(); },
  });
}

export function createTextSizeController(model, key, storage, dom) {
  const attribute = "data-szd-portfolio-text-size";
  const choices = new Map(model.choices.map((choice) => [choice.id, choice.scaleToken]));
  const saved = safeRead(storage, key);
  const initial = choices.has(saved) ? saved : model.defaultChoiceId;
  return preferenceController(
    initial,
    (value) => safeSetAttribute(dom, attribute, choices.get(value)),
    {
      sanitize: (value) => (choices.has(value) ? value : undefined),
      write: (value) => safeWrite(storage, key, value),
    },
  );
}

export function createReaderModeController(model, key, storage, dom) {
  const attribute = "data-szd-portfolio-reader-mode";
  const saved = safeRead(storage, key);
  const initial = saved === "true" ? true : saved === "false" ? false : model.defaultEnabled;
  return preferenceController(
    initial,
    (value) => (value ? safeSetAttribute(dom, attribute, "true") : safeRemoveAttribute(dom, attribute)),
    {
      sanitize: (value) => (typeof value === "boolean" ? value : undefined),
      write: (value) => safeWrite(storage, key, String(value)),
    },
  );
}

function isQueryRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

function sanitizeProjectsQuery(model, fallback, query) {
  const categoryIds = new Set(model.categories.map((category) => category.id));
  const sortChoiceIds = new Set(model.sortChoices.map((choice) => choice.id));
  if (!query || typeof query !== "object") return fallback;
  return {
    search: typeof query.search === "string" ? query.search : fallback.search,
    categoryIds: Array.isArray(query.categoryIds) ? query.categoryIds.filter((id) => categoryIds.has(id)) : fallback.categoryIds,
    tags: Array.isArray(query.tags) ? [...new Set(query.tags.filter((tag) => typeof tag === "string" && tag.length > 0))] : fallback.tags,
    sortChoiceId: sortChoiceIds.has(query.sortChoiceId) ? query.sortChoiceId : fallback.sortChoiceId,
  };
}

function serializeProjectsQuery(query) {
  const params = new URLSearchParams();
  if (query.search !== "") params.set("search", query.search);
  if (query.categoryIds.length > 0) params.set("categoryIds", query.categoryIds.join(","));
  if (query.tags.length > 0) params.set("tags", query.tags.join(","));
  if (query.sortChoiceId !== "") params.set("sort", query.sortChoiceId);
  return params.toString();
}

function parseProjectsQuery(model, fallback, raw) {
  let params;
  try { params = new URLSearchParams(raw ?? ""); } catch { return fallback; }
  return sanitizeProjectsQuery(model, fallback, {
    search: params.get("search") ?? "",
    categoryIds: (params.get("categoryIds") ?? "").split(",").filter(Boolean),
    tags: (params.get("tags") ?? "").split(",").filter(Boolean),
    sortChoiceId: params.get("sort") ?? fallback.sortChoiceId,
  });
}

export function createProjectsUrlController(model, initial, port) {
  let raw = null;
  try { raw = port.read(); } catch { raw = null; }
  const startingValue = raw === null ? sanitizeProjectsQuery(model, initial, initial) : parseProjectsQuery(model, initial, raw);
  return preferenceController(
    startingValue,
    () => {},
    {
      sanitize: (value) => (isQueryRecord(value) ? sanitizeProjectsQuery(model, initial, value) : undefined),
      write: (value) => { try { port.replace(serializeProjectsQuery(value)); } catch {} },
    },
  );
}
