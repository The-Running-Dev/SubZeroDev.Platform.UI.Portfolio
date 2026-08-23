import assert from "node:assert/strict";
import test from "node:test";

import { defineSource, portfolioViewModelV1Contract, resolveSource } from "../src/index.js";
import { createDataJsonProvider, DataJsonAdapterError } from "../src/data-json.js";

const model = { version: 1, header: { title: "Data.Json" }, statistics: [], categories: [], technologies: [], recentProjects: [] };
const meta = (overrides = {}) => ({ id: "portfolio", provider: "file", location: "portfolio.json", bytes: 42, digest: "sha256-abc", cached: false, attempts: 1, validated: true, ...overrides });

function loaderFrom({ loadById, invalidate } = {}) {
  const calls = { loadById: [], invalidate: [] };
  return {
    calls,
    loadById: async (id) => { calls.loadById.push(id); return typeof loadById === "function" ? loadById(id) : loadById; },
    ...(invalidate === undefined ? {} : { invalidate: (id) => { calls.invalidate.push(id); return invalidate(id); } }),
  };
}

test("S16.1 createDataJsonProvider requires an explicit loader, id, and safe public descriptor", () => {
  const loader = loaderFrom({ loadById: () => ({ ok: true, reason: "json.ok", data: model, meta: meta() }) });
  assert.throws(() => createDataJsonProvider({ loader, publicDescriptor: [] }), TypeError);
  assert.throws(() => createDataJsonProvider({ id: "portfolio", publicDescriptor: [] }), TypeError);
  assert.throws(() => createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: "not-an-array" }), TypeError);
  const provider = createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [{ name: "id", value: "portfolio" }] });
  assert.equal(provider.kind, "data-json");
  assert.deepEqual(provider.publicDescriptor, [{ name: "id", value: "portfolio" }]);
});

test("S16.1 resolve loads the declared id and adapts a successful result", async () => {
  const loader = loaderFrom({ loadById: (id) => ({ ok: true, reason: "json.ok", data: model, meta: meta({ id }) }) });
  const provider = createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [] });
  const result = await provider.resolve({ cancelled: false });
  assert.deepEqual(loader.calls.loadById, ["portfolio"]);
  assert.equal(result.value, model);
  assert.deepEqual(result.metadata.find((entry) => entry.name === "id"), { name: "id", value: "portfolio" });
});

test("S16.2 a Data.Json value crosses consumer validation, projection, and package validation exactly once", async () => {
  const order = [];
  const loader = loaderFrom({ loadById: () => { order.push("provider"); return { ok: true, reason: "json.ok", data: { raw: true }, meta: meta() }; } });
  const source = defineSource({
    id: "portfolio",
    timing: "build",
    provider: createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [] }),
    validateRaw: (raw) => { order.push("validateRaw"); return { ok: true, value: raw }; },
    project: (raw) => { order.push("project"); void raw; return model; },
    viewModel: portfolioViewModelV1Contract,
  });
  const resolution = await resolveSource(source, { cancelled: false });
  order.push("view");
  assert.equal(resolution.status, "ready");
  assert.deepEqual(order, ["provider", "validateRaw", "project", "view"]);
  assert.equal(loader.calls.loadById.length, 1);
});

test("S16.3 an unresolved id produces data_json.source_unresolved", async () => {
  const loader = loaderFrom({ loadById: () => ({ ok: false, reason: "json.unresolved", message: "no such source", data: null, meta: meta() }) });
  const provider = createDataJsonProvider({ id: "missing", loader, publicDescriptor: [] });
  await assert.rejects(() => provider.resolve({ cancelled: false }), (error) => error instanceof DataJsonAdapterError && error.code === "data_json.source_unresolved" && error.sourceId === "missing");
});

test("S16.3 a transport failure or thrown loader produces data_json.load_failed", async () => {
  const failing = loaderFrom({ loadById: () => ({ ok: false, reason: "json.transport", message: "network down", data: null, meta: meta() }) });
  const provider = createDataJsonProvider({ id: "portfolio", loader: failing, publicDescriptor: [] });
  await assert.rejects(() => provider.resolve({ cancelled: false }), (error) => error instanceof DataJsonAdapterError && error.code === "data_json.load_failed");

  const throwing = loaderFrom({ loadById: () => { throw new Error("boom"); } });
  const throwingProvider = createDataJsonProvider({ id: "portfolio", loader: throwing, publicDescriptor: [] });
  await assert.rejects(() => throwingProvider.resolve({ cancelled: false }), (error) => error instanceof DataJsonAdapterError && error.code === "data_json.load_failed" && error.cause instanceof Error);
});

test("S16.3 and S16.4 refresh invalidates then reloads only the declared id through the supplied loader", async () => {
  const loader = loaderFrom({
    loadById: (id) => ({ ok: true, reason: "json.ok", data: model, meta: meta({ id }) }),
    invalidate: () => {},
  });
  const provider = createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [] });
  const result = await provider.refresh({ cancelled: false });
  assert.deepEqual(loader.calls.invalidate, ["portfolio"]);
  assert.deepEqual(loader.calls.loadById, ["portfolio"]);
  assert.equal(result.value, model);
});

test("S16.3 refresh without an invalidation capability produces data_json.refresh_unavailable", async () => {
  const loader = loaderFrom({ loadById: () => ({ ok: true, reason: "json.ok", data: model, meta: meta() }) });
  const provider = createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [] });
  await assert.rejects(() => provider.refresh({ cancelled: false }), (error) => error instanceof DataJsonAdapterError && error.code === "data_json.refresh_unavailable");
  assert.deepEqual(loader.calls.loadById, []);
});

test("S16.3 invalid metadata produces data_json.metadata_invalid without copying private metadata or payloads", async () => {
  const loader = loaderFrom({ loadById: () => ({ ok: true, reason: "json.ok", data: model, meta: { ...meta(), bytes: "not-a-number" } }) });
  const provider = createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [] });
  await assert.rejects(() => provider.resolve({ cancelled: false }), (error) => {
    assert.equal(error.code, "data_json.metadata_invalid");
    assert.doesNotMatch(JSON.stringify(error), /not-a-number/);
    return true;
  });
});

test("S16.5 the Data.Json entrypoint imports independently of the rest of the package", async () => {
  const dataJson = await import("../src/data-json.js");
  assert.equal(typeof dataJson.createDataJsonProvider, "function");
  assert.equal(typeof dataJson.DataJsonAdapterError, "function");
});
