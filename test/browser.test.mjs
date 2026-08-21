import assert from "node:assert/strict";
import test from "node:test";

import {
  defineSource,
  portfolioViewModelV1Contract,
  resolveSources,
  validateBrowserBootstrapV1,
} from "../src/index.js";
import { BrowserError, hydratePortfolioRoute } from "../src/browser.js";

const model = { version: 1, header: { title: "Browser" }, statistics: [], categories: [], technologies: [], recentProjects: [] };
const source = (id, value, delay = 0) => defineSource({
  id,
  timing: "browser",
  provider: { kind: "fixture", publicDescriptor: [], resolve: async () => { if (delay) await new Promise((resolve) => setTimeout(resolve, delay)); return { value, metadata: [] }; } },
  validateRaw: (raw) => raw === "bad" ? { ok: false, issues: [{ code: "raw.invalid", path: [], message: "invalid" }] } : { ok: true, value: raw },
  project: (raw) => raw,
  viewModel: portfolioViewModelV1Contract,
});

test("S12.1 validates a closed, redacted browser bootstrap", () => {
  const bootstrap = { version: 1, routePath: "/work", mode: "browser-gated", modelVersions: [{ sourceId: "built", kind: "portfolio", version: 1 }, { sourceId: "fresh", kind: "portfolio", version: 1 }], buildModels: [{ sourceId: "built", value: model }], browserSourceIds: ["fresh"] };
  assert.equal(validateBrowserBootstrapV1(bootstrap).ok, true);
  assert.equal(validateBrowserBootstrapV1({ ...bootstrap, privatePayload: "secret" }).ok, false);
  assert.equal(validateBrowserBootstrapV1({ ...bootstrap, buildModels: [{ sourceId: "built", value: { ...model, rejected: "secret" } }] }).ok, false);
});

test("S12.3 resolves concurrently but returns declaration order without partial composition", async () => {
  const settled = await resolveSources([source("first", model, 20), source("second", model, 1)], { cancelled: false, onCancel: () => () => {} });
  assert.deepEqual(settled.map((entry) => entry.sourceId), ["first", "second"]);
  const failed = await resolveSources([source("first", model), source("second", "bad")], { cancelled: false, onCancel: () => () => {} });
  assert.equal(failed[0].status, "ready");
  assert.equal(failed[1].status, "error");
  assert.ok(failed[1].error instanceof Error);
});

test("S12.4 redacts rejected browser payloads and exposes typed errors", async () => {
  const [failed] = await resolveSources([source("unsafe", "bad")], { cancelled: false, onCancel: () => () => {} });
  assert.equal(failed.status, "error");
  assert.equal(failed.error.code, "consumer.validation_failed");
  assert.doesNotMatch(JSON.stringify(failed.error), /bad|unsafe payload/i);
  const error = new BrowserError("browser.sources_failed", "Browser sources failed", { routePath: "/work", causes: [failed.error] });
  assert.equal(error.code, "browser.sources_failed");
});

test("S12.2 hydratePortfolioRoute validates the bootstrap and matching sources before any settlement", () => {
  const bootstrap = { version: 1, routePath: "/work", mode: "browser-gated", modelVersions: [{ sourceId: "built", kind: "portfolio", version: 1 }, { sourceId: "fresh", kind: "portfolio", version: 1 }], buildModels: [{ sourceId: "built", value: model }], browserSourceIds: ["fresh"] };
  assert.throws(() => hydratePortfolioRoute({ bootstrap, sources: [], container: undefined, unresolved: null, compose: () => null, renderError: () => null }), (error) => error instanceof BrowserError && error.code === "bootstrap.invalid");
  assert.throws(() => hydratePortfolioRoute({ bootstrap: { ...bootstrap, mode: "not-a-mode" }, sources: [source("fresh", model)], container: undefined, unresolved: null, compose: () => null, renderError: () => null }), (error) => error instanceof BrowserError && error.code === "bootstrap.invalid");
  const mismatched = source("other", model);
  assert.throws(() => hydratePortfolioRoute({ bootstrap, sources: [mismatched], container: undefined, unresolved: null, compose: () => null, renderError: () => null }), (error) => error instanceof BrowserError && error.code === "bootstrap.invalid");
});

test("S12.6 imports the browser entrypoint with browser globals unavailable", async () => {
  const names = ["window", "document", "location", "localStorage"];
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`${name} read`); } });
    const browser = await import(`../src/browser.js?poisoned=${Date.now()}`);
    assert.equal(typeof browser.hydratePortfolioRoute, "function");
  } finally {
    for (const name of names) {
      const descriptor = descriptors.get(name);
      if (descriptor === undefined) delete globalThis[name]; else Object.defineProperty(globalThis, name, descriptor);
    }
  }
});
