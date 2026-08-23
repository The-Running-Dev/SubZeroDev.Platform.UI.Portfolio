import type { JsonLoader } from "subzerodev-data-json";
import type { SourceProviderCapability } from "./index.js";

export type DataJsonAdapterErrorCode =
  | "data_json.source_unresolved"
  | "data_json.load_failed"
  | "data_json.refresh_unavailable"
  | "data_json.metadata_invalid";

export interface DataJsonAdapterErrorOptions {
  readonly sourceId: string;
  readonly cause?: unknown;
}

export class DataJsonAdapterError extends Error {
  readonly code: DataJsonAdapterErrorCode;
  readonly sourceId: string;
  readonly cause?: unknown;
  constructor(code: DataJsonAdapterErrorCode, message: string, options: DataJsonAdapterErrorOptions);
}

export interface DataJsonSourceOptions {
  readonly id: string;
  readonly loader: JsonLoader;
  readonly publicDescriptor: readonly {
    readonly name: string;
    readonly value: string;
  }[];
}

export function createDataJsonProvider(options: DataJsonSourceOptions): SourceProviderCapability;
