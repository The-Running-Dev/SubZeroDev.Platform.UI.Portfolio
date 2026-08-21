import type { ValidationIssue, ValidationResult, PortfolioViewModelV1, DefinedSource, SourceDefinitionInput } from "./index.js";
export interface BuilderPaths { readonly rootDir: string; readonly configPath: string; readonly outDir: string; }
export interface PortfolioSiteConfigV1 { readonly version: 1; readonly routes: readonly any[]; readonly sources: readonly DefinedSource[]; readonly metadata: { readonly title: string; readonly description?: string; readonly language?: string }; readonly styles: readonly any[]; readonly navigation: readonly any[]; readonly publicAssets: readonly any[]; }
export class BuilderError extends Error { readonly code: string; readonly issues: readonly ValidationIssue[]; }
export function defineSource<TRaw, TView = PortfolioViewModelV1>(input: SourceDefinitionInput<TRaw, TView>): DefinedSource<TView>;
export function definePortfolioSite(config: PortfolioSiteConfigV1): PortfolioSiteConfigV1;
export function validatePortfolioSiteConfigV1(input: unknown): ValidationResult<PortfolioSiteConfigV1>;
export function loadPortfolioConfig(rootDir: string, configPath: string): Promise<PortfolioSiteConfigV1>;
export function buildPortfolioSite(paths: BuilderPaths): Promise<{ readonly artifactPath: string; readonly record: any }>;
export function validateProvenanceManifestV1(input: unknown): ValidationResult<any>;
export function validateArtifactRecordV1(input: unknown): ValidationResult<any>;
export function validateRecoveryRecordV1(input: unknown): ValidationResult<any>;
