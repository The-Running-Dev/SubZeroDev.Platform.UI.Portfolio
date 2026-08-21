import type { ValidationIssue, ValidationResult, PortfolioViewModelV1 } from "./index.js";
export interface BuilderPaths { readonly rootDir: string; readonly configPath: string; readonly outDir: string; }
export interface SourceDefinitionInput<TRaw> { readonly id: string; readonly timing: "build" | "browser"; readonly provider: { readonly resolve: (signal: unknown) => Promise<{ readonly value: unknown; readonly metadata?: readonly unknown[] }> }; readonly validateRaw: (input: unknown) => ValidationResult<TRaw>; readonly project: (raw: TRaw) => unknown; readonly viewModel: { readonly validate: (input: unknown) => ValidationResult<PortfolioViewModelV1> }; readonly fallback?: unknown; }
export interface DefinedSource { readonly id: string; readonly timing: "build" | "browser"; }
export interface PortfolioSiteConfigV1 { readonly version: 1; readonly routes: readonly any[]; readonly sources: readonly DefinedSource[]; readonly metadata: { readonly title: string; readonly description?: string; readonly language?: string }; readonly styles: readonly any[]; readonly navigation: readonly any[]; readonly publicAssets: readonly any[]; }
export class BuilderError extends Error { readonly code: string; readonly issues: readonly ValidationIssue[]; }
export function defineSource<TRaw>(input: SourceDefinitionInput<TRaw>): DefinedSource;
export function definePortfolioSite(config: PortfolioSiteConfigV1): PortfolioSiteConfigV1;
export function validatePortfolioSiteConfigV1(input: unknown): ValidationResult<PortfolioSiteConfigV1>;
export function loadPortfolioConfig(rootDir: string, configPath: string): Promise<PortfolioSiteConfigV1>;
export function buildPortfolioSite(paths: BuilderPaths): Promise<{ readonly artifactPath: string; readonly record: any }>;
export function validateProvenanceManifestV1(input: unknown): ValidationResult<any>;
export function validateArtifactRecordV1(input: unknown): ValidationResult<any>;
export function validateRecoveryRecordV1(input: unknown): ValidationResult<any>;
