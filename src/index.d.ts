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

export type NavigationItemV1 = { readonly kind: "link"; readonly id: string; readonly link: LinkCapabilityV1 } | { readonly kind: "text"; readonly id: string; readonly label: string } | { readonly kind: "group"; readonly id: string; readonly label: string; readonly items: readonly LinkCapabilityV1[] };
export interface SiteChromeViewModelV1 { readonly version: 1; readonly identity: { readonly name: string; readonly subtitle?: string; readonly iconKey?: string }; readonly primaryNavigation: readonly NavigationItemV1[]; readonly secondaryNavigation: readonly NavigationItemV1[]; readonly footer?: { readonly text: string; readonly links: readonly LinkCapabilityV1[] }; }
export type CVTextV1 = { readonly kind: "text"; readonly value: string } | { readonly kind: "rich-text-slot"; readonly slotId: string };
export interface CVViewModelV1 { readonly version: 1; readonly header: { readonly name: string; readonly headline?: string; readonly contact: readonly LinkCapabilityV1[] }; readonly sections: readonly ({ readonly kind: "summary"; readonly id: string; readonly heading: string; readonly body: CVTextV1 } | { readonly kind: "roles"; readonly id: string; readonly heading: string; readonly roles: readonly { readonly id: string; readonly title: string; readonly organization: string; readonly period: { readonly start: string; readonly end?: string; readonly ongoing: boolean }; readonly summary?: CVTextV1; readonly achievements: readonly CVTextV1[]; readonly technologies: readonly string[] }[] } | { readonly kind: "projects"; readonly id: string; readonly heading: string; readonly projects: readonly { readonly id: string; readonly name: string; readonly summary?: CVTextV1; readonly technologies: readonly string[]; readonly link?: LinkCapabilityV1 }[] } | { readonly kind: "education"; readonly id: string; readonly heading: string; readonly items: readonly { readonly id: string; readonly institution: string; readonly qualification: string; readonly period?: string }[] } | { readonly kind: "achievements"; readonly id: string; readonly heading: string; readonly items: readonly CVTextV1[] })[]; }
export interface VersionDisplayViewModelV1 { readonly version: 1; readonly text: string; readonly prefix?: string; readonly link?: LinkCapabilityV1; }
export interface SiteChromeProps { readonly model: SiteChromeViewModelV1; readonly renderIcon?: IconRenderer; }
export interface RichTextSlot { readonly id: string; readonly content: ReactNode; }
export interface CVProps { readonly model: CVViewModelV1; readonly richTextSlots?: readonly RichTextSlot[]; }
export interface VersionDisplayProps { readonly model: VersionDisplayViewModelV1; }

export type ValidationErrorCode = "view.validation_failed";

export interface ValidationErrorOptions {
  readonly modelKind: "site-chrome" | "cv" | "portfolio" | "version-display";
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
export function SiteChrome(props: SiteChromeProps): ReactElement;
export function CV(props: CVProps): ReactElement;
export function VersionDisplay(props: VersionDisplayProps): ReactElement;
export function validatePortfolioViewModelV1(input: unknown): ValidationResult<PortfolioViewModelV1>;
export function validateSiteChromeViewModelV1(input: unknown): ValidationResult<SiteChromeViewModelV1>;
export function validateCVViewModelV1(input: unknown): ValidationResult<CVViewModelV1>;
export function validateVersionDisplayViewModelV1(input: unknown): ValidationResult<VersionDisplayViewModelV1>;
export function selectLinkDestination(link: LinkCapabilityV1): string | undefined;
export function flattenPortfolioTechnologies(model: PortfolioViewModelV1): readonly string[];
