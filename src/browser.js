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
