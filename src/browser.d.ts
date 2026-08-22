import type { ReactElement } from "react";
import type { DefinedSource, ProjectsQueryV1, ProjectsViewModelV1, ReaderModeViewModelV1, ResolutionError, ResolvedSourceValueV1, TextSizeViewModelV1, ValidationIssue } from "./index.js";
export type BrowserErrorCode = "bootstrap.invalid" | "browser.sources_failed" | "browser.hydration_failed" | "preference.invalid" | "preference.port_failed" | "generation.superseded" | "generation.disposed";
export class BrowserError extends Error { readonly code: BrowserErrorCode; readonly routePath?: string; readonly sourceId?: string; readonly issues: readonly ValidationIssue[]; readonly causes: readonly ResolutionError[]; }
export type BrowserRouteResult = { readonly status: "loading"; readonly routePath: string } | { readonly status: "ready" | "fallback"; readonly routePath: string; readonly sources: readonly ResolvedSourceValueV1[] } | { readonly status: "error"; readonly routePath: string; readonly error: BrowserError };
export interface HydratePortfolioRouteOptions { readonly bootstrap: unknown; readonly sources: readonly DefinedSource[]; readonly container: Element; readonly unresolved: ReactElement; readonly compose: (sources: readonly ResolvedSourceValueV1[]) => ReactElement; readonly renderError: (error: BrowserError) => ReactElement; }
export interface BrowserRouteController { readonly initialPublication: Promise<Exclude<BrowserRouteResult, { readonly status: "loading" }>>; readonly snapshot: () => BrowserRouteResult; readonly refresh: () => Promise<Exclude<BrowserRouteResult, { readonly status: "loading" }>>; readonly subscribe: (listener: () => void) => () => void; readonly dispose: () => void; }
export function hydratePortfolioRoute(options: HydratePortfolioRouteOptions): BrowserRouteController;
export interface PreferenceStoragePort { readonly read: (key: string) => string | null; readonly write: (key: string, value: string) => void; readonly remove: (key: string) => void; }
export interface PreferenceDomPort { readonly setAttribute: (name: string, value: string) => void; readonly removeAttribute: (name: string) => void; }
export interface UrlStatePort { readonly read: () => string; readonly replace: (query: string) => void; }
export interface PreferenceController<T> { readonly get: () => T; readonly set: (value: T) => void; readonly subscribe: (listener: () => void) => () => void; readonly dispose: () => void; }
export function createTextSizeController(model: TextSizeViewModelV1, key: string, storage: PreferenceStoragePort, dom: PreferenceDomPort): PreferenceController<string>;
export function createReaderModeController(model: ReaderModeViewModelV1, key: string, storage: PreferenceStoragePort, dom: PreferenceDomPort): PreferenceController<boolean>;
export function createProjectsUrlController(model: ProjectsViewModelV1, initial: ProjectsQueryV1, port: UrlStatePort): PreferenceController<ProjectsQueryV1>;
