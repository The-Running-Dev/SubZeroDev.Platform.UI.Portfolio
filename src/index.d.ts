import type { ReactElement, ReactNode } from "react";

export type IssuePath = readonly (string | number)[];

export interface ValidationIssue {
  readonly code: string;
  readonly path: IssuePath;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export type Validator<T> = (input: unknown) => ValidationResult<T>;

export interface LinkCapabilityV1 {
  readonly label: string;
  readonly href?: string;
  readonly accessibleLabel?: string;
  readonly target?: "same-context" | "new-context";
}

export interface ProjectCardViewModelV1 {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly categoryIds: readonly string[];
  readonly tags: readonly string[];
  readonly technologies: readonly string[];
  readonly period?: {
    readonly start: string;
    readonly end?: string;
    readonly ongoing: boolean;
  };
  readonly links: readonly LinkCapabilityV1[];
}

export interface PortfolioViewModelV1 {
  readonly version: 1;
  readonly header: { readonly title: string; readonly summary?: string };
  readonly statistics: readonly {
    readonly id: string;
    readonly label: string;
    readonly value: string;
  }[];
  readonly categories: readonly {
    readonly id: string;
    readonly label: string;
    readonly count?: number;
  }[];
  readonly technologies: readonly {
    readonly id: string;
    readonly label: string;
    readonly iconKey?: string;
    readonly link?: LinkCapabilityV1;
  }[];
  readonly recentProjects: readonly ProjectCardViewModelV1[];
}

export interface IconRenderer {
  (iconKey: string): ReactNode;
}

export interface PortfolioProps {
  readonly model: PortfolioViewModelV1;
  readonly renderIcon?: IconRenderer;
}

export type ValidationErrorCode = "view.validation_failed";

export interface ValidationErrorOptions {
  readonly modelKind: "portfolio";
  readonly issues: readonly ValidationIssue[];
  readonly cause?: unknown;
}

export class ValidationError extends Error {
  readonly code: ValidationErrorCode;
  readonly modelKind: ValidationErrorOptions["modelKind"];
  readonly issues: readonly ValidationIssue[];
  readonly cause?: unknown;
  constructor(code: ValidationErrorCode, message: string, options: ValidationErrorOptions);
}

export function Portfolio(props: PortfolioProps): ReactElement;
export function validatePortfolioViewModelV1(input: unknown): ValidationResult<PortfolioViewModelV1>;
export function selectLinkDestination(link: LinkCapabilityV1): string | undefined;
export function flattenPortfolioTechnologies(model: PortfolioViewModelV1): readonly string[];
