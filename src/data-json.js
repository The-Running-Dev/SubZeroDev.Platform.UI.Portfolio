export class DataJsonAdapterError extends Error {
  constructor(code, message, options) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DataJsonAdapterError";
    this.code = code;
    this.sourceId = options.sourceId;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

function safeMetadata(meta, id) {
  const valid = record(meta)
    && typeof meta.id === "string"
    && ["http", "file", "inline", "none"].includes(meta.provider)
    && typeof meta.location === "string"
    && typeof meta.bytes === "number" && Number.isFinite(meta.bytes)
    && (meta.digest === null || typeof meta.digest === "string")
    && typeof meta.cached === "boolean"
    && typeof meta.attempts === "number" && Number.isFinite(meta.attempts)
    && typeof meta.validated === "boolean";
  if (!valid) throw new DataJsonAdapterError("data_json.metadata_invalid", "Data.Json metadata cannot become safe public facts", { sourceId: id });
  return [
    { name: "id", value: meta.id },
    { name: "provider", value: meta.provider },
    { name: "location", value: meta.location },
    { name: "bytes", value: String(meta.bytes) },
    { name: "digest", value: meta.digest ?? "" },
    { name: "cached", value: String(meta.cached) },
    { name: "attempts", value: String(meta.attempts) },
    { name: "validated", value: String(meta.validated) },
  ];
}

async function load(loader, id) {
  let result;
  try { result = await loader.loadById(id); } catch (cause) { throw new DataJsonAdapterError("data_json.load_failed", "Data.Json loader threw", { sourceId: id, cause }); }
  if (!record(result) || typeof result.ok !== "boolean") throw new DataJsonAdapterError("data_json.load_failed", "Data.Json returned an invalid result", { sourceId: id });
  if (!result.ok) throw new DataJsonAdapterError(result.reason === "json.unresolved" ? "data_json.source_unresolved" : "data_json.load_failed", result.message ?? "Data.Json load failed", { sourceId: id });
  return { value: result.data, metadata: safeMetadata(result.meta, id) };
}

function validDescriptor(publicDescriptor) {
  return Array.isArray(publicDescriptor) && publicDescriptor.every((entry) => record(entry) && typeof entry.name === "string" && typeof entry.value === "string");
}

export function createDataJsonProvider(options) {
  if (!record(options)) throw new TypeError("createDataJsonProvider requires an options object");
  if (typeof options.id !== "string" || options.id.length === 0) throw new TypeError("createDataJsonProvider requires an explicit source id");
  if (!record(options.loader) || typeof options.loader.loadById !== "function") throw new TypeError("createDataJsonProvider requires an explicit loader");
  if (!validDescriptor(options.publicDescriptor)) throw new TypeError("createDataJsonProvider requires a safe public descriptor");
  const { id, loader, publicDescriptor } = options;
  return Object.freeze({
    kind: "data-json",
    publicDescriptor,
    resolve: () => load(loader, id),
    refresh: async () => {
      if (typeof loader.invalidate !== "function") throw new DataJsonAdapterError("data_json.refresh_unavailable", "Data.Json loader does not support invalidation", { sourceId: id });
      loader.invalidate(id);
      return load(loader, id);
    },
  });
}
