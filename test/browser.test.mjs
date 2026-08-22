import assert from "node:assert/strict";
import test from "node:test";

import {
  defineSource,
  portfolioViewModelV1Contract,
  resolveSources,
  validateBrowserBootstrapV1,
} from "../src/index.js";
import { BrowserError, createProjectsUrlController, createReaderModeController, createTextSizeController, hydratePortfolioRoute } from "../src/browser.js";

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

function spyStorage(initial = new Map()) {
  return {
    values: initial,
    reads: [],
    writes: [],
    read(key) { this.reads.push(key); return this.values.has(key) ? this.values.get(key) : null; },
    write(key, value) { this.writes.push([key, value]); this.values.set(key, value); },
    remove(key) { this.values.delete(key); },
  };
}
function spyDom() {
  return { attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, value); }, removeAttribute(name) { this.attributes.delete(name); } };
}
const textSizeModel = { version: 1, label: "Text size", choices: [{ id: "small", label: "Small", scaleToken: "sm" }, { id: "large", label: "Large", scaleToken: "lg" }], defaultChoiceId: "small" };
const readerModeModel = { version: 1, label: "Reader mode", enabledLabel: "On", disabledLabel: "Off", defaultEnabled: false };
const projectsModel = { version: 1, heading: "Projects", projects: [], categories: [{ id: "web", label: "Web" }], sortChoices: [{ id: "newest", label: "Newest" }] };
const defaultQuery = { search: "", categoryIds: [], tags: [], sortChoiceId: "newest" };

test("S14.4 createTextSizeController recovers unknown saved choices to the declared default and applies the DOM/storage ports", () => {
  const storage = spyStorage(new Map([["text-size", "huge"]]));
  const dom = spyDom();
  const controller = createTextSizeController(textSizeModel, "text-size", storage, dom);
  assert.equal(controller.get(), "small");
  assert.equal(dom.attributes.get("data-szd-portfolio-text-size"), "sm");

  const notifications = [];
  const unsubscribe = controller.subscribe(() => notifications.push(controller.get()));
  controller.set("bogus");
  assert.equal(controller.get(), "small");
  assert.equal(storage.writes.length, 0);
  controller.set("large");
  assert.equal(controller.get(), "large");
  assert.equal(dom.attributes.get("data-szd-portfolio-text-size"), "lg");
  assert.deepEqual(storage.writes, [["text-size", "large"]]);
  assert.deepEqual(notifications, ["large"]);

  unsubscribe();
  controller.dispose();
  controller.set("small");
  assert.equal(controller.get(), "large");
});

test("S14.4 createTextSizeController retains the default when the storage port throws", () => {
  const storage = { read: () => { throw new Error("blocked"); }, write: () => { throw new Error("blocked"); }, remove: () => {} };
  const dom = spyDom();
  const controller = createTextSizeController(textSizeModel, "text-size", storage, dom);
  assert.equal(controller.get(), "small");
  controller.set("large");
  assert.equal(controller.get(), "large", "a throwing storage write must not block the in-memory preference");
});

test("S14.4 createReaderModeController toggles a package-prefixed DOM attribute and recovers invalid saved state", () => {
  const storage = spyStorage(new Map([["reader-mode", "not-a-boolean"]]));
  const dom = spyDom();
  const controller = createReaderModeController(readerModeModel, "reader-mode", storage, dom);
  assert.equal(controller.get(), false);
  assert.equal(dom.attributes.has("data-szd-portfolio-reader-mode"), false);
  controller.set(true);
  assert.equal(controller.get(), true);
  assert.equal(dom.attributes.get("data-szd-portfolio-reader-mode"), "true");
  controller.set(false);
  assert.equal(dom.attributes.has("data-szd-portfolio-reader-mode"), false);
});

test("S14.4 createProjectsUrlController parses, sanitizes, and serializes through the URL port", () => {
  const port = { value: "search=react&categoryIds=web,unknown&sort=bogus", reads: 0, replaced: [], read() { this.reads += 1; return this.value; }, replace(query) { this.replaced.push(query); this.value = query; } };
  const controller = createProjectsUrlController(projectsModel, defaultQuery, port);
  assert.deepEqual(controller.get(), { search: "react", categoryIds: ["web"], tags: [], sortChoiceId: "newest" });

  const notifications = [];
  controller.subscribe(() => notifications.push(controller.get()));
  controller.set({ search: "next", categoryIds: ["web", "unknown"], tags: ["cli"], sortChoiceId: "unknown" });
  assert.deepEqual(controller.get(), { search: "next", categoryIds: ["web"], tags: ["cli"], sortChoiceId: "newest" });
  assert.deepEqual(notifications, [controller.get()]);
  assert.equal(port.replaced.length, 1);
  assert.match(port.replaced[0], /search=next/);
  assert.match(port.replaced[0], /categoryIds=web/);
  assert.doesNotMatch(port.replaced[0], /unknown/);
});

test("S14.4 createProjectsUrlController falls back to the declared first-render default when the URL port throws", () => {
  const port = { read: () => { throw new Error("blocked"); }, replace: () => { throw new Error("blocked"); } };
  const controller = createProjectsUrlController(projectsModel, defaultQuery, port);
  assert.deepEqual(controller.get(), defaultQuery);
  controller.set({ ...defaultQuery, search: "still works" });
  assert.equal(controller.get().search, "still works", "a throwing URL port must not block the in-memory preference");
});

test("S14.4 createProjectsUrlController rejects a non-object value instead of resetting the query", () => {
  const port = { value: "search=react&categoryIds=web", replaced: [], read() { return this.value; }, replace(query) { this.replaced.push(query); this.value = query; } };
  const controller = createProjectsUrlController(projectsModel, defaultQuery, port);
  const before = controller.get();
  assert.deepEqual(before, { search: "react", categoryIds: ["web"], tags: [], sortChoiceId: "newest" });

  const notifications = [];
  controller.subscribe(() => notifications.push(controller.get()));
  for (const invalid of [null, undefined, "nope", 42, []]) controller.set(invalid);

  assert.deepEqual(controller.get(), before, "an invalid value must not discard the visitor's filters");
  assert.deepEqual(port.replaced, [], "an invalid value must not rewrite the URL");
  assert.deepEqual(notifications, []);
});
