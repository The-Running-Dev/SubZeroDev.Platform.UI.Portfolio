# Portfolio builder public contract

## How this contract is kept

Invariants have stable ids P<n>. They are never reused or renumbered. A
rewording that preserves meaning keeps its id. P20 and P21 are retired with the
superseded Docusaurus migration surface; their ids remain unavailable.

Declarations below are pre-implementation scaffolds. The slice that creates a
declaration replaces its scaffold with a pointer to its canonical source file
in the same commit, while retaining the surrounding semantics. Until then, the
TypeScript below is canonical. **Consumer** means the repository or application
supplying one site configuration. **Root** means the "." npm export and its
dependency graph. **Artifact** means a promoted builder output carrying a valid
artifact record.

The version-one surface is the complete first-release destination, not a demand
that the first implementation slice materialise every scaffold at once. Before
the first publication, each slice exposes only the declarations and export paths
its scope and acceptance criteria require; unmaterialised declarations remain
canonical scaffolds here and are not runtime placeholders. A slice that names a
root package export, stylesheet, or packed fixture may establish the minimum
package, build, and test structure needed to verify that contracted subset. It
does not thereby acquire later slices' declarations, integrations, or behavior.

## Invariants

### Ownership and dependency graph

- **P1** Root imports no generated consumer data, source map, feature config,
  Node/Vite module, Data.Json module, browser global, Docusaurus module, admin
  module, or authentication module. Import-graph and packed-root tests enforce
  this.
- **P2** Consumer raw types, raw validators, source payloads, copy, routes,
  branding, and deployment policy are neither exported nor persisted as package
  product defaults. Export snapshots and artifact inspection enforce this.
- **P3** "./builder", "./browser", and "./data-json" depend inward on root;
  root never imports them. Build-graph tests enforce this.

### Validation and resolution

- **P4** Every exported validator accepts unknown, has positive coverage, and
  has negative coverage for every rejection branch. The validator branch
  matrix enforces this.
- **P5** Package view models and persisted records are strict and versioned;
  unknown fields and unsupported versions fail. Validators and schema fixtures
  enforce this.
- **P6** Consumer raw validation succeeds before projection, and package
  view-model validation succeeds before composition or rendering. A cast earns
  neither boundary. Call-order tests enforce this.
- **P7** Multi-source composition receives the complete required set or does
  not run; failures are emitted in declaration order regardless of completion
  order. Concurrency-order tests enforce this.
- **P8** Fallback is per-source, explicit, package-validated, and observable as
  "fallback" with the primary error retained. Tagged-state tests enforce this.
- **P9** Refresh uses only an explicit source capability. The package finds no
  global loader, invalidates no undeclared id, retries nothing automatically,
  and changes no consumer cache policy. Resolution tests enforce this.

### Rendering, routes, and browser state

- **P10** Pure renderers perform no I/O and read no environment, DOM, storage,
  location, or clock state during render. SSR tests with poisoned globals
  enforce this.
- **P11** Only declared routes are emitted, and no cross-route anchor is emitted
  without a consumer-supplied destination. "/projects", "/cv", "/docs", demo,
  repository, and admin routes are never defaults. Root-only and explicit-route
  fixtures enforce this.
- **P12** Ordinary strings never reach dangerouslySetInnerHTML. Rich content is
  rendered only through an explicit consumer capability whose trust boundary
  is outside the package. Source and injection tests enforce this.
- **P13** Multiple renderer instances produce no package-owned fixed-id
  collision. Duplicate-render fixtures enforce this.
- **P14** Version presentation is explicit and deterministic; neither the clock
  nor a hard-coded version fallback supplies product text. Selector and
  renderer tests enforce this.
- **P15** Every owned class, custom property, keyframe, and state data attribute
  uses the package prefix. Complete CSS and DOM manifest parsing enforces this.
- **P16** Published DOM, CSS, schemas, codes, exports, and persisted record
  formats change only under this document's compatibility rules. Release
  fixtures enforce this.
- **P17** Core CSS has no global selector, implicit JavaScript import, or host
  framework dependency. Stylesheet and packed fixtures enforce this.
- **P18** Navigation, filtering, text-size, and reader-mode controls remain
  keyboard-operable and expose accurate state. Interaction and accessibility
  tests enforce this.
- **P19** A root-only packed consumer installs, imports, SSR-renders, and
  bundles without Node/Vite or Data.Json dependencies. Tarball fixtures enforce
  this.

### Builder, artifact, and delivery

- **P22** Exactly one closed, versioned configuration is loaded per operation;
  all declarations and cross-references validate before source I/O or output
  mutation. Configuration-order tests enforce this.
- **P23** Every normalized route path is unique, contained by its base path,
  and mapped to one static document by the single document compiler. Planner
  fixtures enforce this.
- **P24** Build, check, and dev validate exactly the immutable three-role
  provenance manifest shipped with the executing package version. Its digest
  must match its canonical contents and fixture bindings; configuration,
  command arguments, working directory, and environment cannot substitute a
  different manifest. Normal operations never refresh evidence. Packed-manifest
  fixtures and network-poisoned tests enforce this.
- **P25** Build and merge write and verify a complete sibling staging tree
  before the authoritative target changes. Fault-injection tests enforce this
  at every write and promotion boundary.
- **P26** One lease protects each authoritative tree. Ambiguous recovery state
  blocks later writers and is never deleted automatically. Merge holds a
  read-stability lease on the source and a writer lease on the destination,
  acquiring both in normalized-path order. Race, interruption, deadlock, and
  recovery tests enforce this.
- **P27** `hydratePortfolioRoute` owns one browser route's bootstrap validation,
  complete-set settlement, matching-shell hydration, and post-commit
  publication. It hydrates the deterministic unresolved boundary only after the
  whole required source set settles, then publishes exactly one ready, fallback,
  or error result after the hydration commit. No caller or generated entry may
  split or reorder that transition. SSR and hydration sequencing tests enforce
  this.
- **P28** Only the newest browser refresh generation may publish. Completion
  order never selects a winner. Reversed-completion tests enforce this.
- **P29** Artifact identity derives only from contracted package, provenance,
  serializable configuration, route-order, and emitted-file digests. Records
  contain no raw payload, function, secret, header, or private provider
  description. Canonicalization and redaction tests enforce this.
- **P30** Preview serves the exact artifact produced by its ordinary build;
  static serving has one contained path-resolution and content-type behavior.
  Build/preview parity fixtures enforce this.
- **P31** Merge fingerprints every declared protected subtree before copying,
  rechecks it before promotion, and leaves the destination unchanged on any
  collision or failure. Concurrent-mutation fixtures enforce this.
- **P32** Dev uses the production loader, validator, resolver, planner, and
  compiler. A failed generation is visible but never partly published.
  Regeneration tests enforce this.
- **P33** Commands, the composite action, and the reusable workflow never infer
  a trigger, domain, environment, concurrency policy, credential, host, or
  decision to deploy. CLI and workflow fixtures enforce this.
- **P34** No renderer receives a partial or unvalidated source set, including
  when a failed source is auxiliary to the visible route. Route composition
  spies enforce this.

## Types

S10 materializes its shared validation and link declarations, Portfolio model,
validator, selectors, renderer, and validation error in
[`src/index.d.ts`](../src/index.d.ts) and [`src/index.js`](../src/index.js).
S13 materializes SiteChrome, CV, and VersionDisplay there in the same way, and
S14 materializes Projects, TextSize, ReaderMode, their validators,
`filterProjects`, and `summarizeProjects`. Those files are canonical for their
declarations; the remaining scaffold below imports their types where
later-slice declarations require them. String constraints are enforced by
validators; TypeScript string annotations alone do not establish them.

~~~ts
import type { ReactElement, ReactNode } from "react";
import type {
  IconRenderer,
  IssuePath,
  LinkCapabilityV1,
  PortfolioViewModelV1,
  ProjectCardViewModelV1,
  ValidationError,
  ValidationIssue,
  ValidationResult,
  Validator,
} from "../src/index.js";

export type SourceId = string;
export type RoutePath = string;
export type AssetPath = string;
export type RichTextSlotId = string;

export interface CancellationSignal {
  readonly cancelled: boolean;
  readonly onCancel: (listener: () => void) => () => void;
}

export type NavigationItemV1 =
  | { readonly kind: "link"; readonly id: string; readonly link: LinkCapabilityV1 }
  | { readonly kind: "text"; readonly id: string; readonly label: string }
  | {
      readonly kind: "group";
      readonly id: string;
      readonly label: string;
      readonly items: readonly LinkCapabilityV1[];
    };

export interface SiteChromeViewModelV1 {
  readonly version: 1;
  readonly identity: {
    readonly name: string;
    readonly subtitle?: string;
    readonly iconKey?: string;
  };
  readonly primaryNavigation: readonly NavigationItemV1[];
  readonly secondaryNavigation: readonly NavigationItemV1[];
  readonly footer?: {
    readonly text: string;
    readonly links: readonly LinkCapabilityV1[];
  };
}

export type CVTextV1 =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "rich-text-slot"; readonly slotId: RichTextSlotId };

export interface CVViewModelV1 {
  readonly version: 1;
  readonly header: {
    readonly name: string;
    readonly headline?: string;
    readonly contact: readonly LinkCapabilityV1[];
  };
  readonly sections: readonly CVSectionV1[];
}

export type CVSectionV1 =
  | { readonly kind: "summary"; readonly id: string; readonly heading: string; readonly body: CVTextV1 }
  | { readonly kind: "roles"; readonly id: string; readonly heading: string; readonly roles: readonly CVRoleV1[] }
  | { readonly kind: "projects"; readonly id: string; readonly heading: string; readonly projects: readonly CVProjectV1[] }
  | { readonly kind: "education"; readonly id: string; readonly heading: string; readonly items: readonly CVEducationV1[] }
  | { readonly kind: "achievements"; readonly id: string; readonly heading: string; readonly items: readonly CVTextV1[] };

export interface CVRoleV1 {
  readonly id: string;
  readonly title: string;
  readonly organization: string;
  readonly period: {
    readonly start: string;
    readonly end?: string;
    readonly ongoing: boolean;
  };
  readonly summary?: CVTextV1;
  readonly achievements: readonly CVTextV1[];
  readonly technologies: readonly string[];
}

export interface CVProjectV1 {
  readonly id: string;
  readonly name: string;
  readonly summary?: CVTextV1;
  readonly technologies: readonly string[];
  readonly link?: LinkCapabilityV1;
}

export interface CVEducationV1 {
  readonly id: string;
  readonly institution: string;
  readonly qualification: string;
  readonly period?: string;
}

export interface ProjectsViewModelV1 {
  readonly version: 1;
  readonly heading: string;
  readonly projects: readonly ProjectCardViewModelV1[];
  readonly categories: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly sortChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly emptyLabel?: string;
}

export interface ProjectsQueryV1 {
  readonly search: string;
  readonly categoryIds: readonly string[];
  readonly tags: readonly string[];
  readonly sortChoiceId: string;
}

export interface VersionDisplayViewModelV1 {
  readonly version: 1;
  readonly text: string;
  readonly prefix?: string;
  readonly link?: LinkCapabilityV1;
}

export interface TextSizeViewModelV1 {
  readonly version: 1;
  readonly label: string;
  readonly choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly scaleToken: string;
  }[];
  readonly defaultChoiceId: string;
}

export interface ReaderModeViewModelV1 {
  readonly version: 1;
  readonly label: string;
  readonly enabledLabel: string;
  readonly disabledLabel: string;
  readonly defaultEnabled: boolean;
}

export type PortfolioPackageViewModelV1 =
  | SiteChromeViewModelV1
  | CVViewModelV1
  | PortfolioViewModelV1
  | ProjectsViewModelV1
  | VersionDisplayViewModelV1
  | TextSizeViewModelV1
  | ReaderModeViewModelV1;

export interface RichTextSlot {
  readonly id: RichTextSlotId;
  readonly content: ReactNode;
}

export interface SiteChromeProps {
  readonly model: SiteChromeViewModelV1;
  readonly renderIcon?: IconRenderer;
}
export interface CVProps {
  readonly model: CVViewModelV1;
  readonly richTextSlots?: readonly RichTextSlot[];
}
export interface ProjectsProps {
  readonly model: ProjectsViewModelV1;
  readonly query: ProjectsQueryV1;
}
export interface VersionDisplayProps {
  readonly model: VersionDisplayViewModelV1;
}
export interface TextSizeControlProps {
  readonly model: TextSizeViewModelV1;
  readonly value: string;
  readonly onChange: (choiceId: string) => void;
}
export interface ReaderModeControlProps {
  readonly model: ReaderModeViewModelV1;
  readonly enabled: boolean;
  readonly onChange: (enabled: boolean) => void;
}

export function SiteChrome(props: SiteChromeProps): ReactElement;
export function CV(props: CVProps): ReactElement;
export function Projects(props: ProjectsProps): ReactElement;
export function VersionDisplay(props: VersionDisplayProps): ReactElement;
export function TextSizeControl(props: TextSizeControlProps): ReactElement;
export function ReaderModeControl(props: ReaderModeControlProps): ReactElement;

export function validateSiteChromeViewModelV1(input: unknown): ValidationResult<SiteChromeViewModelV1>;
export function validateCVViewModelV1(input: unknown): ValidationResult<CVViewModelV1>;
export function validateProjectsViewModelV1(input: unknown): ValidationResult<ProjectsViewModelV1>;
export function validateVersionDisplayViewModelV1(input: unknown): ValidationResult<VersionDisplayViewModelV1>;
export function validateTextSizeViewModelV1(input: unknown): ValidationResult<TextSizeViewModelV1>;
export function validateReaderModeViewModelV1(input: unknown): ValidationResult<ReaderModeViewModelV1>;

declare const viewModelContractBrand: unique symbol;

export type PortfolioViewModelKindV1 =
  | "site-chrome"
  | "cv"
  | "portfolio"
  | "projects"
  | "version-display"
  | "text-size"
  | "reader-mode";

export interface ViewModelContract<TView extends PortfolioPackageViewModelV1> {
  readonly kind: PortfolioViewModelKindV1;
  readonly validate: Validator<TView>;
  readonly [viewModelContractBrand]: TView;
}

export const siteChromeViewModelV1Contract: ViewModelContract<SiteChromeViewModelV1>;
export const cvViewModelV1Contract: ViewModelContract<CVViewModelV1>;
export const portfolioViewModelV1Contract: ViewModelContract<PortfolioViewModelV1>;
export const projectsViewModelV1Contract: ViewModelContract<ProjectsViewModelV1>;
export const versionDisplayViewModelV1Contract: ViewModelContract<VersionDisplayViewModelV1>;
export const textSizeViewModelV1Contract: ViewModelContract<TextSizeViewModelV1>;
export const readerModeViewModelV1Contract: ViewModelContract<ReaderModeViewModelV1>;

export type ResolutionErrorCode =
  | "consumer.validation_failed"
  | "consumer.validator_threw"
  | "projection.failed"
  | "fallback.invalid"
  | "source.failed"
  | "sources.failed"
  | "source.refresh_unavailable";

export interface ResolutionErrorOptions {
  readonly sourceId?: SourceId;
  readonly issues?: readonly ValidationIssue[];
  readonly causes?: readonly ResolutionError[];
  readonly cause?: unknown;
}

export class ResolutionError extends Error {
  readonly code: ResolutionErrorCode;
  readonly sourceId?: SourceId;
  readonly issues: readonly ValidationIssue[];
  readonly causes: readonly ResolutionError[];
  readonly cause?: unknown;
  constructor(
    code: ResolutionErrorCode,
    message: string,
    options?: ResolutionErrorOptions,
  );
}

export interface SourceProviderResult {
  readonly value: unknown;
  readonly metadata: readonly {
    readonly name: string;
    readonly value: string;
  }[];
}

export interface SourceProviderCapability {
  readonly kind: string;
  readonly publicDescriptor: readonly {
    readonly name: string;
    readonly value: string;
  }[];
  readonly resolve: (signal: CancellationSignal) => Promise<SourceProviderResult>;
  readonly refresh?: (signal: CancellationSignal) => Promise<SourceProviderResult>;
}

export interface SourceDefinitionInput<
  TRaw,
  TView extends PortfolioPackageViewModelV1,
> {
  readonly id: SourceId;
  readonly timing: "build" | "browser";
  readonly provider: SourceProviderCapability;
  readonly validateRaw: Validator<TRaw>;
  readonly project: (raw: TRaw) => unknown;
  readonly viewModel: ViewModelContract<TView>;
  readonly fallback?: unknown;
}

declare const definedSourceBrand: unique symbol;

export interface DefinedSource<TView extends PortfolioPackageViewModelV1> {
  readonly id: SourceId;
  readonly timing: "build" | "browser";
  readonly [definedSourceBrand]: TView;
}

export function defineSource<
  TRaw,
  TView extends PortfolioPackageViewModelV1,
>(
  input: SourceDefinitionInput<TRaw, TView>,
): DefinedSource<TView>;

export type Resolution<T> =
  | { readonly status: "idle"; readonly sourceId: SourceId }
  | { readonly status: "loading"; readonly sourceId: SourceId }
  | {
      readonly status: "ready";
      readonly sourceId: SourceId;
      readonly data: T;
      readonly metadata: SourceProviderResult["metadata"];
    }
  | {
      readonly status: "fallback";
      readonly sourceId: SourceId;
      readonly data: T;
      readonly error: ResolutionError;
      readonly metadata: SourceProviderResult["metadata"];
    }
  | {
      readonly status: "error";
      readonly sourceId: SourceId;
      readonly error: ResolutionError;
    };

export function resolveSource<TView extends PortfolioPackageViewModelV1>(
  source: DefinedSource<TView>,
  signal: CancellationSignal,
): Promise<Resolution<TView>>;

export function resolveSources(
  sources: readonly DefinedSource<PortfolioPackageViewModelV1>[],
  signal: CancellationSignal,
): Promise<readonly Resolution<PortfolioPackageViewModelV1>[]>;

export type ResolvedSourceValueV1 =
  | {
      readonly sourceId: SourceId;
      readonly status: "ready";
      readonly value: PortfolioPackageViewModelV1;
    }
  | {
      readonly sourceId: SourceId;
      readonly status: "fallback";
      readonly value: PortfolioPackageViewModelV1;
      readonly fallbackError: ResolutionError;
    };

export function parseCVPeriod(value: string): ValidationResult<{
  readonly start: string;
  readonly end?: string;
  readonly ongoing: boolean;
}>;
export function sortCVRoles(roles: readonly CVRoleV1[]): readonly CVRoleV1[];
export function filterProjects(
  model: ProjectsViewModelV1,
  query: ProjectsQueryV1,
): readonly ProjectCardViewModelV1[];
export function summarizeProjects(
  projects: readonly ProjectCardViewModelV1[],
): readonly {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}[];
~~~

Validators reject empty required labels, duplicate stable ids within one model,
unsupported versions, inconsistent ongoing periods, references to absent
categories or sort choices, non-finite counts, and unknown fields. Link
validation accepts only explicit fragment, absolute-site, "http", "https",
"mailto", and "tel" destinations. An absent href is inert content. A
"new-context" target is valid only with a non-empty href and renders with
"noopener noreferrer". `selectLinkDestination` returns the validated href
unchanged when present and `undefined` when absent; it does not normalize,
infer, or validate a destination independently of the package model boundary.

DefinedSource is opaque. Only defineSource can retain the consumer validator and
projection that earned its hidden raw type. It eagerly validates identity,
timing, provider descriptor, and fallback; primary resolution remains deferred.
The package supplies each branded view-model contract. Its validator is the
package validation boundary; a structurally similar consumer function cannot
construct that brand or substitute for it under P6.

## Site configuration

This scaffold will live in the "./builder" entrypoint. Paths are
consumer-declared and become normalized only after validation.

~~~ts
export interface PortfolioSiteConfigV1 {
  readonly version: 1;
  readonly routes: readonly RouteDeclarationV1[];
  readonly sources: readonly DefinedSource<PortfolioPackageViewModelV1>[];
  readonly metadata: SiteMetadataV1;
  readonly styles: readonly StyleCapabilityV1[];
  readonly navigation: readonly NavigationCapabilityV1[];
  readonly publicAssets: readonly PublicAssetV1[];
  readonly deployment?: DeploymentValuesV1;
}

export interface SiteMetadataV1 {
  readonly title: string;
  readonly description?: string;
  readonly language?: string;
}

export interface RouteMetadataV1 {
  readonly title: string;
  readonly description?: string;
  readonly canonicalUrl?: string;
  readonly socialImage?: string;
}

export interface RouteDeclarationV1 {
  readonly path: RoutePath;
  readonly metadata: RouteMetadataV1;
  readonly presentation: RoutePresentationV1;
  readonly requiredSourceIds: readonly SourceId[];
}

export interface RoutePresentationSourcesV1 {
  readonly modelSourceId: SourceId;
  readonly chromeSourceId?: SourceId;
  readonly versionSourceId?: SourceId;
  readonly textSizeSourceId?: SourceId;
  readonly readerModeSourceId?: SourceId;
}

export type RoutePresentationV1 =
  | ({ readonly kind: "portfolio" } & RoutePresentationSourcesV1)
  | ({ readonly kind: "cv" } & RoutePresentationSourcesV1)
  | ({ readonly kind: "projects" } & RoutePresentationSourcesV1);

export type StyleCapabilityV1 =
  | { readonly kind: "portfolio-core" }
  | {
      readonly kind: "consumer-stylesheet";
      readonly sourcePath: string;
      readonly outputPath: AssetPath;
    };

export interface NavigationCapabilityV1 {
  readonly id: string;
  readonly destination?: string;
}

export interface PublicAssetV1 {
  readonly sourcePath: string;
  readonly outputPath: AssetPath;
}

export interface DeploymentValuesV1 {
  readonly basePath?: string;
  readonly canonicalUrl?: string;
  readonly documentationDestination?: AssetPath;
}

export function definePortfolioSite(
  config: PortfolioSiteConfigV1,
): PortfolioSiteConfigV1;
export function validatePortfolioSiteConfigV1(
  input: unknown,
): ValidationResult<PortfolioSiteConfigV1>;
~~~

Routes are non-empty and declaration order is preserved. Root is not inserted;
if a consumer wants "/", it declares "/". Every presentation source reference
must occur exactly once in requiredSourceIds, name a declared source with the
required view-model family, and agree with the route's derived build-only or
browser-gated policy.

Navigation destinations are capabilities, not route declarations. An
absolute-site destination must resolve to a declared route after base-path
normalization; an absent destination stays inert. Assets and styles must be
regular contained files, have unique normalized output paths, and may not
collide with route documents, bootstrap records, bundles, or artifact records.
The core stylesheet appears exactly once when declared and is never inserted by
a JavaScript import.

definePortfolioSite validates eagerly and returns the same object reference. It
does not load sources, read the filesystem, or normalize paths against a
working directory. The Node loader performs those invocation-scoped checks.
Extraction provenance is not a consumer configuration capability; P24 assigns
manifest selection to the executing package version.

## Persisted schemas

There is no database, collection, cookie, local-storage key, or package-owned
consumer-data file. Four JSON record families are persisted.

~~~ts
export interface FileDigestV1 {
  readonly path: string;
  readonly digest: string;
}

export interface RepositoryBaselineV1 {
  readonly repository: string;
  readonly commit: string;
  readonly files: readonly FileDigestV1[];
}

export interface ConsumerBaselineV1 {
  readonly repository: string;
  readonly commit: string;
  readonly clean: true;
  readonly files: readonly FileDigestV1[];
}

export interface TemplateOverlayBaselineV1 {
  readonly imageDigest: string;
  readonly observedTags: readonly string[];
  readonly templateFiles: readonly FileDigestV1[];
  readonly overlayRules: readonly {
    readonly order: number;
    readonly operation: "include" | "exclude" | "replace";
    readonly path: string;
  }[];
  readonly effectiveFiles: readonly FileDigestV1[];
  readonly effectiveTreeDigest: string;
}

export interface ProvenanceManifestV1 {
  readonly version: 1;
  readonly manifestDigest: string;
  readonly deliveryMechanics: RepositoryBaselineV1;
  readonly consumerOverlay: ConsumerBaselineV1;
  readonly effectiveTemplateOverlay: TemplateOverlayBaselineV1;
}

export interface SerializedErrorV1 {
  readonly code: ResolutionErrorCode;
  readonly message: string;
  readonly sourceId?: SourceId;
  readonly issues: readonly ValidationIssue[];
}

export interface BrowserBootstrapV1 {
  readonly version: 1;
  readonly routePath: RoutePath;
  readonly mode: "build-only" | "browser-gated";
  readonly modelVersions: readonly {
    readonly sourceId: SourceId;
    readonly kind: PortfolioViewModelKindV1;
    readonly version: 1;
  }[];
  readonly buildModels: readonly {
    readonly sourceId: SourceId;
    readonly value: PortfolioPackageViewModelV1;
    readonly fallbackError?: SerializedErrorV1;
  }[];
  readonly browserSourceIds: readonly SourceId[];
}

export function validateBrowserBootstrapV1(
  input: unknown,
): ValidationResult<BrowserBootstrapV1>;

export interface ArtifactRecordV1 {
  readonly version: 1;
  readonly artifactDigest: string;
  readonly packageVersion: string;
  readonly provenanceManifestDigest: string;
  readonly configurationDigest: string;
  readonly routes: readonly RoutePath[];
  readonly sources: readonly {
    readonly id: SourceId;
    readonly timing: "build" | "browser";
    readonly modelVersion: 1;
    readonly status?: "ready" | "fallback";
  }[];
  readonly files: readonly FileDigestV1[];
}

export interface RecoveryRecordV1 {
  readonly version: 1;
  readonly operation: "build" | "merge";
  readonly targetPath: string;
  readonly stagingPath: string;
  readonly previousPath?: string;
  readonly phase: "staged" | "promotion-started" | "rollback-failed";
}

export interface LeaseRecordV1 {
  readonly version: 1;
  readonly operation: "build" | "preview" | "merge-read" | "merge-write";
  readonly normalizedTargetPath: string;
  readonly ownerId: string;
}
~~~

Canonical JSON uses UTF-8, lexicographically ordered object keys, schema-defined
array order, and no insignificant whitespace. Digests carry an algorithm prefix
and use the one algorithm named by the canonicalization module; changing it is
a record-version change.

`BrowserBootstrapV1` and its validator are root declarations shared by the
builder and browser entrypoints. Neither optional entrypoint imports the other.
The validator accepts `unknown`; a parsed JSON cast does not establish a valid
bootstrap.

The provenance manifest is a tracked package resource bundled with the
"./builder" implementation. The implementation resolves it from its own
installed package, never from the process working directory or a consumer root.
Refresh creates a new canonical record and identity for a later package build;
it never edits an installed artifact. Bootstrap and artifact records have no
in-place migration; an incompatible version requires a rebuild. Lease and
recovery records are temporary operational state, not migrated or guessed
through. A stale lease may be cleared only after its owner is proven absent.
The user must adjudicate the trees named by a recovery record and remove that
record deliberately.

## Public surface

### Package exports

The package name is "subzerodev-platform-ui-portfolio". The complete first
published version exports only:

- "." — root declarations, validators, selectors, resolution, and pure React
  renderers scaffolded above;
- "./builder" — configuration and Node/Vite operational API;
- "./browser" — hydration, refresh-generation, preference, URL, storage, and
  DOM ports;
- "./data-json" — explicit Data.Json provider adapters; and
- "./styles.css" — package-owned namespaced presentation.

There are no Docusaurus, Giscus, Badges, GitHub panel, theme-switcher, legacy
stylesheet, per-component, wildcard, or internal source exports. JavaScript
entrypoints do not import CSS.

Before that first publication, the export map may be a strict subset containing
only paths materialised by completed slices. An entrypoint must not be published
as a throwing placeholder for a later slice. S10 materialises "." and
"./styles.css" only; its root surface is limited to the shared validation and
link declarations required by the Portfolio model, the Portfolio model and
validator contract, Portfolio selectors, the Portfolio renderer, and their
error declarations. S12 materialises the root resolution, complete-set, and
browser-bootstrap declarations it requires plus "./browser" limited to
browser-source settlement, route hydration, refresh generations, and disposal.
S14 materialises the preference storage, DOM preference application, and
Projects URL state controllers behind that same "./browser" path.

### Builder API

This scaffold will be split across "src/builder/" modules. These functions are
the only internal module-boundary operations; helpers beneath them stay
file-private.

~~~ts
export interface BuilderInputPaths {
  readonly rootDir: string;
  readonly configPath: string;
}
export interface BuilderPaths extends BuilderInputPaths {
  readonly outDir: string;
}
export interface ServerAddress {
  readonly host: string;
  readonly port: number;
}
export interface BuildResult {
  readonly artifactPath: string;
  readonly record: ArtifactRecordV1;
}
export interface RoutePlanV1 {
  readonly routePath: RoutePath;
  readonly metadata: RouteMetadataV1;
  readonly presentation: RoutePresentationV1;
  readonly mode: "build-only" | "browser-gated";
  readonly buildSources: readonly ResolvedSourceValueV1[];
  readonly browserSourceIds: readonly SourceId[];
  readonly styleOutputPaths: readonly AssetPath[];
  readonly assetOutputPaths: readonly AssetPath[];
}
export interface RenderPlanV1 {
  readonly provenanceManifestDigest: string;
  readonly configurationDigest: string;
  readonly routes: readonly RoutePlanV1[];
}
export interface BuiltArtifact {
  readonly rootPath: string;
  readonly record: ArtifactRecordV1;
}
export interface GateResultV1 {
  readonly id: string;
  readonly status: "passed" | "failed" | "not-run";
  readonly detail?: string;
}
export interface CheckResult {
  readonly record: ArtifactRecordV1;
  readonly gates: readonly GateResultV1[];
}
export interface RunningServer {
  readonly address: ServerAddress;
  readonly close: () => Promise<void>;
}
export interface MergeOptions {
  readonly artifactDir: string;
  readonly targetDir: string;
  readonly protectedPaths: readonly string[];
}
export interface MergeResult {
  readonly targetDir: string;
  readonly artifactDigest: string;
}

export type BuilderErrorCode =
  | "config.load_failed"
  | "config.invalid"
  | "provenance.invalid"
  | "recovery.required"
  | "lease.unavailable"
  | "source_set.failed"
  | "route.invalid"
  | "asset.invalid"
  | "compile.failed"
  | "artifact.invalid"
  | "promotion.failed"
  | "server.bind_failed"
  | "server.not_found"
  | "merge.collision"
  | "merge.target_changed"
  | "merge.failed"
  | "check.failed";

export interface BuilderErrorOptions {
  readonly routePath?: RoutePath;
  readonly sourceId?: SourceId;
  readonly path?: string;
  readonly issues?: readonly ValidationIssue[];
  readonly causes?: readonly (BuilderError | ResolutionError)[];
  readonly gates?: readonly GateResultV1[];
  readonly cause?: unknown;
}

export class BuilderError extends Error {
  readonly code: BuilderErrorCode;
  readonly routePath?: RoutePath;
  readonly sourceId?: SourceId;
  readonly path?: string;
  readonly issues: readonly ValidationIssue[];
  readonly causes: readonly (BuilderError | ResolutionError)[];
  readonly gates: readonly GateResultV1[];
  readonly cause?: unknown;
  constructor(
    code: BuilderErrorCode,
    message: string,
    options?: BuilderErrorOptions,
  );
}

export function loadPortfolioConfig(
  rootDir: string,
  configPath: string,
): Promise<PortfolioSiteConfigV1>;
export function buildPortfolioSite(paths: BuilderPaths): Promise<BuildResult>;
export function checkPortfolioSite(
  paths: BuilderInputPaths,
): Promise<CheckResult>;
export function startPortfolioDevServer(
  paths: BuilderPaths,
  address: ServerAddress,
): Promise<RunningServer>;
export function previewPortfolioSite(
  paths: BuilderPaths,
  address: ServerAddress,
): Promise<RunningServer>;
export function mergePortfolioArtifact(
  options: MergeOptions,
): Promise<MergeResult>;
export function validateProvenanceManifestV1(
  input: unknown,
): ValidationResult<ProvenanceManifestV1>;
export function validateArtifactRecordV1(
  input: unknown,
): ValidationResult<ArtifactRecordV1>;
export function validateRecoveryRecordV1(
  input: unknown,
): ValidationResult<RecoveryRecordV1>;
~~~

No path parameter has a default. This prevents working-directory discovery from
becoming configuration or deployment policy. Build and preview promote an
artifact; check uses an isolated temporary target and never replaces outDir.
Preview completes that ordinary build before binding a socket. Dev binds only
after configuration and provenance validation and initial build-source
resolution succeed. There is no provenance-manifest parameter: under P24 the
executing package version selects its bundled manifest, and consumer input
cannot override it.

### Browser API

S12 materializes `BrowserError` and `hydratePortfolioRoute` in
[`src/browser.d.ts`](../src/browser.d.ts) and [`src/browser.js`](../src/browser.js).
S14 materializes the preference/URL ports and `createTextSizeController`,
`createReaderModeController`, and `createProjectsUrlController` there in the
same way. Those files are canonical for their declarations.

~~~ts
export type BrowserErrorCode =
  | "bootstrap.invalid"
  | "browser.sources_failed"
  | "browser.hydration_failed"
  | "preference.invalid"
  | "preference.port_failed"
  | "generation.superseded"
  | "generation.disposed";

export interface BrowserErrorOptions {
  readonly routePath?: RoutePath;
  readonly sourceId?: SourceId;
  readonly issues?: readonly ValidationIssue[];
  readonly causes?: readonly ResolutionError[];
  readonly cause?: unknown;
}

export class BrowserError extends Error {
  readonly code: BrowserErrorCode;
  readonly routePath?: RoutePath;
  readonly sourceId?: SourceId;
  readonly issues: readonly ValidationIssue[];
  readonly causes: readonly ResolutionError[];
  readonly cause?: unknown;
  constructor(
    code: BrowserErrorCode,
    message: string,
    options?: BrowserErrorOptions,
  );
}

export type BrowserRouteResult =
  | { readonly status: "loading"; readonly routePath: RoutePath }
  | {
      readonly status: "ready";
      readonly routePath: RoutePath;
      readonly sources: readonly ResolvedSourceValueV1[];
    }
  | {
      readonly status: "fallback";
      readonly routePath: RoutePath;
      readonly sources: readonly ResolvedSourceValueV1[];
    }
  | {
      readonly status: "error";
      readonly routePath: RoutePath;
      readonly error: BrowserError;
    };

export type PublishedBrowserRouteResult = Exclude<
  BrowserRouteResult,
  { readonly status: "loading" }
>;

export interface HydratePortfolioRouteOptions {
  readonly bootstrap: unknown;
  readonly sources: readonly DefinedSource<PortfolioPackageViewModelV1>[];
  readonly container: Element;
  readonly unresolved: ReactElement;
  readonly compose: (
    sources: readonly ResolvedSourceValueV1[],
  ) => ReactElement;
  readonly renderError: (error: BrowserError) => ReactElement;
}

export interface BrowserRouteController {
  readonly initialPublication: Promise<PublishedBrowserRouteResult>;
  readonly snapshot: () => BrowserRouteResult;
  readonly refresh: () => Promise<PublishedBrowserRouteResult>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly dispose: () => void;
}
export interface PreferenceStoragePort {
  readonly read: (key: string) => string | null;
  readonly write: (key: string, value: string) => void;
  readonly remove: (key: string) => void;
}
export interface PreferenceDomPort {
  readonly setAttribute: (name: string, value: string) => void;
  readonly removeAttribute: (name: string) => void;
}
export interface UrlStatePort {
  readonly read: () => string;
  readonly replace: (query: string) => void;
}
export interface PreferenceController<T> {
  readonly get: () => T;
  readonly set: (value: T) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly dispose: () => void;
}

export function hydratePortfolioRoute(
  options: HydratePortfolioRouteOptions,
): BrowserRouteController;
export function createTextSizeController(
  model: TextSizeViewModelV1,
  key: string,
  storage: PreferenceStoragePort,
  dom: PreferenceDomPort,
): PreferenceController<string>;
export function createReaderModeController(
  model: ReaderModeViewModelV1,
  key: string,
  storage: PreferenceStoragePort,
  dom: PreferenceDomPort,
): PreferenceController<boolean>;
export function createProjectsUrlController(
  model: ProjectsViewModelV1,
  initial: ProjectsQueryV1,
  port: UrlStatePort,
): PreferenceController<ProjectsQueryV1>;
~~~

Importing the browser entrypoint is SSR-safe. It reads no browser global at
module evaluation, and `hydratePortfolioRoute` operates only on its explicit
container and capabilities. The bootstrap is validated before source
invocation. Its model-version list names every route source in composition
order, including the package view-model kind used to revalidate each embedded
build model. Browser source ids must match the supplied browser-timed sources
exactly and in that relative order; a missing, duplicate, build-timed, extra,
wrong-kind, or unsupported-version source is `bootstrap.invalid`.

The coordinator settles every source before calling React hydration. Its first
client tree is exactly `unresolved`, which the document compiler also used for
the server boundary. The public snapshot remains `loading` through that commit.
Only the commit effect publishes the settled aggregate and invokes `compose` or
`renderError`. `compose` receives every build- and browser-timed source as a
ready or fallback `ResolvedSourceValueV1`, in bootstrap composition order, or is
not invoked. The aggregate is `fallback` when at least one source used explicit
fallback and `ready` otherwise. Serialized build fallback diagnostics are
reconstructed as safe `ResolutionError` values; provider metadata and causes
that were not persisted are not invented. Any non-renderable browser result
becomes one `browser.sources_failed` error with ordered causes; rejected raw
values never enter it.

An invalid bootstrap is never hydrated: the coordinator replaces the boundary
with caller error UI, invokes no source or product composer, and throws
`bootstrap.invalid`. React hydration, commit, or callback failure is wrapped as
`browser.hydration_failed`. `initialPublication` resolves only after the first
ready, fallback, or error result has been published; a published source error is
a resolved result, not a rejected lifecycle promise.

Refresh publishes one aggregate loading state for the new generation, retains
no partial source set, and publishes its final aggregate only if it is still the
newest generation. A superseded refresh rejects with `generation.superseded`
and never notifies product UI. Disposal cancels publication, clears
subscriptions, unmounts the owned hydration root, and makes active or later
refresh promises reject with `generation.disposed`.

Callers supply browser-backed preference ports only after hydration. Storage
keys have no package default. Unknown saved choices recover to the declared
model default after the hydration commit and may emit optional diagnostics, but
never alter product data.

### Data.Json API

~~~ts
import type { JsonLoader } from "subzerodev-data-json";

export type DataJsonAdapterErrorCode =
  | "data_json.source_unresolved"
  | "data_json.load_failed"
  | "data_json.refresh_unavailable"
  | "data_json.metadata_invalid";

export interface DataJsonAdapterErrorOptions {
  readonly sourceId: SourceId;
  readonly cause?: unknown;
}

export class DataJsonAdapterError extends Error {
  readonly code: DataJsonAdapterErrorCode;
  readonly sourceId: SourceId;
  readonly cause?: unknown;
  constructor(
    code: DataJsonAdapterErrorCode,
    message: string,
    options: DataJsonAdapterErrorOptions,
  );
}

export interface DataJsonSourceOptions {
  readonly id: string;
  readonly loader: JsonLoader;
  readonly publicDescriptor: readonly {
    readonly name: string;
    readonly value: string;
  }[];
}
export function createDataJsonProvider(
  options: DataJsonSourceOptions,
): SourceProviderCapability;
~~~

The adapter requires an explicit loader and id. It imports no generated map,
creates no singleton, and assumes no source id. Refresh invalidates exactly the
declared id through the supplied loader before loading it again. Because
JsonLoader exposes no cancellation parameter, cancellation suppresses
publication but does not claim to abort the provider request. JsonResult
metadata is allowlisted into safe name/value pairs rather than copied
wholesale.

### Commands

The executable is "subzerodev-platform-ui-portfolio".

~~~text
subzerodev-platform-ui-portfolio build --root <path> --config <path> --out-dir <path>
subzerodev-platform-ui-portfolio check --root <path> --config <path>
subzerodev-platform-ui-portfolio dev --root <path> --config <path> --out-dir <path> --host <host> --port <port>
subzerodev-platform-ui-portfolio preview --root <path> --config <path> --out-dir <path> --host <host> --port <port>
subzerodev-platform-ui-portfolio merge --artifact-dir <path> --target-dir <path> [--protect <relative-path>]...
~~~

Every shown option is required except repeatable "--protect". No path, host, or
port has a default. Relative config and output paths resolve from explicit
"--root"; other relative paths resolve from the current process directory only
after containment checks. Success writes one concise line naming the command
result and artifact digest when one exists. Failure writes ordered safe
diagnostics to stderr and exits non-zero. Help or an unknown invocation writes
usage without loading configuration.

Build reads configuration, the package-owned manifest selected by P24, declared
assets, styles, and build sources; it writes only staging, lease/recovery state,
and "--out-dir". Check reads the same inputs, writes only temporary state, and
outputs the full gate list including "not-run". Dev reads the same inputs plus
watched declarations, writes only its staging tree, and serves the latest
complete generation. Preview performs build then serves its promoted artifact.
Merge reads the artifact and target, writes sibling staging and lease/recovery
state, and promotes only after protected-subtree revalidation.

No command modifies a source repository, configuration, provenance manifest,
consumer content, registry, hosted site, or deployment setting. No command
publishes, deploys, or contacts evidence repositories.

### Delivery assets

The composite action accepts exact package version, command, configuration,
root, output, and merge inputs and invokes the executable without reinterpreting
them. The reusable Pages workflow checks out the caller, optionally downloads a
separately built documentation artifact, runs build and merge, uploads the
result, and deploys through the caller's authorization. Neither asset supplies
a trigger, domain, environment, concurrency group, credential, route, content,
or implicit latest package version.

## Error semantics

Each module exports one typed error class with a stable code union. Errors carry
message, optional safe cause, ordered issues, and applicable source, route, or
path context. Messages are not machine contracts. No error includes a rejected
raw value, credential, request header, function source, or private provider
configuration.

### Root: ValidationError and ResolutionError

| Code | Raised when | Retryable | Caller action |
| --- | --- | --- | --- |
| "view.validation_failed" | A package model or direct renderer boundary rejects | No | Correct the projection or direct model |
| "consumer.validation_failed" | The raw validator rejects | No | Correct source data or consumer validator |
| "consumer.validator_threw" | The raw validator throws | No | Fix the validator implementation |
| "projection.failed" | Projection throws | No | Fix the projection |
| "fallback.invalid" | An explicit fallback fails package validation | No | Correct or remove the fallback |
| "source.failed" | Provider resolution fails | Provider-defined | Inspect safe cause and provider policy |
| "sources.failed" | One or more ordered declarations fail | Mixed | Inspect child errors; composition did not run |
| "source.refresh_unavailable" | Refresh is requested without an explicit capability | No | Supply one or remove refresh UI |

### Builder: BuilderError

| Code | Raised when | Retryable | Caller action |
| --- | --- | --- | --- |
| "config.load_failed" | The executable module cannot be loaded | No | Correct path or module |
| "config.invalid" | Version, capability, declaration, or cross-reference validation fails | No | Correct configuration |
| "provenance.invalid" | Schema, digest, identity, inventory, or fixture binding fails | No | Deliberately recapture provenance outside normal commands |
| "recovery.required" | A recovery record names ambiguous trees | No | Adjudicate named trees before retrying |
| "lease.unavailable" | Another operation holds a required tree lease | Yes | Wait for it to finish |
| "source_set.failed" | Build-time resolution cannot produce a complete set | Mixed | Inspect ordered child errors |
| "route.invalid" | Path, navigation, source reference, or cycle is invalid | No | Correct declarations |
| "asset.invalid" | Style or asset is missing, escaping, disallowed, or colliding | No | Correct declaration or file |
| "compile.failed" | SSR or Vite compilation fails | After correction | Correct the renderer or build defect |
| "artifact.invalid" | Staged files or record fail verification | No | Correct producer; do not promote staging |
| "promotion.failed" | Promotion or rollback cannot complete | After adjudication | Inspect authoritative and recovery paths |
| "server.bind_failed" | Explicit host/port cannot bind | Yes | Select an available address |
| "server.not_found" | A contained request has no emitted file | Yes | Request a declared route or asset |
| "merge.collision" | Artifact collides with a protected path | No | Change the explicit merge plan |
| "merge.target_changed" | A protected fingerprint changes during merge | Yes | Retry against a stable target |
| "merge.failed" | Staging, capacity, write, or promotion fails | After correction | Inspect safe cause and retained state |
| "check.failed" | One or more verification gates fail | After correction | Inspect the full gate report |

### Browser: BrowserError

| Code | Raised when | Retryable | Caller action |
| --- | --- | --- | --- |
| "bootstrap.invalid" | Parse, route identity, or model version fails | No | Refuse hydration and rebuild |
| "browser.sources_failed" | The whole browser source set settles with failure | Mixed | Render caller error UI; no product renderer ran |
| "browser.hydration_failed" | React hydration, commit, or a supplied render callback fails | After correction | Keep or restore the unresolved boundary and correct the renderer |
| "preference.invalid" | A saved choice is unknown or malformed | No | Use declared default; optionally remove it |
| "preference.port_failed" | Storage, URL, or DOM port throws | Maybe | Continue with controlled defaults |
| "generation.superseded" | A newer refresh starts before this generation can publish | No | Ignore the older completion |
| "generation.disposed" | Work completes after its gate was disposed | No | Ignore completion |

### Data.Json: DataJsonAdapterError

| Code | Raised when | Retryable | Caller action |
| --- | --- | --- | --- |
| "data_json.source_unresolved" | Explicit loader cannot resolve the id | No | Correct consumer source map or id |
| "data_json.load_failed" | Data.Json reports transport or read failure | Provider-defined | Follow consumer cache/transport policy |
| "data_json.refresh_unavailable" | Refresh is requested without invalidation | No | Supply capability or disable refresh |
| "data_json.metadata_invalid" | Metadata cannot become safe public facts | No | Correct metadata mapping |

Thrown non-package values at a declared consumer or provider boundary are
wrapped once in the owning typed error with cause; package errors already
carrying an applicable code are preserved. Cancellation settles its declaration
slot and never changes diagnostic ordering. Disposal cancellation is not
reported to product UI.

## DOM, CSS, accessibility, and determinism

Every package-owned class begins "szd-portfolio-", every custom property begins
"--szd-portfolio-", every keyframe begins "szd-portfolio-", and every state
attribute begins "data-szd-portfolio-". Root classes are
"szd-portfolio-site-chrome", "szd-portfolio-cv",
"szd-portfolio-overview", "szd-portfolio-projects",
"szd-portfolio-version", "szd-portfolio-text-size", and
"szd-portfolio-reader-mode". The complete fixture-generated DOM and CSS
manifests become canonical once implemented.

The package promises semantic hierarchy, package-supplied roles and accessible
names, heading-level inputs, keyboard order, documented state attributes, and
owned element order. It does not promise whitespace, React-generated ids, or
consumer text. Disabled destinations render inert content. Dropdowns expose
aria-expanded; icon-only controls require names; decorative icons are hidden;
color is not the only state signal; focus is never trapped.

Date-sensitive selectors receive explicit values or clocks. No render output
depends on current locale, timezone, or repeatedly sampled time. Browser
preference restoration follows the hydration commit, so server and first client
tree use the same declared defaults.

## Compatibility and dependencies

Before 1.0.0, consumers pin exact versions. At and after 1.0.0, export paths and
names, declarations, accepted model and record versions, validator acceptance
and issue paths, error codes, resolution states, CLI syntax and exit semantics,
artifact layout, public DOM, classes, data attributes, CSS selectors, tokens,
cascade order, and delivery inputs are semver-governed.

Required root peers are React and React DOM. Exact supported peer ranges, the
Node engine range, Vite range, and Data.Json range are release inputs verified
against installed declarations and packed fixtures before the first release;
they are not inferred here. Node/Vite dependencies remain reachable only from
"./builder"; Data.Json remains reachable only from "./data-json"; browser code
remains reachable only from "./browser". No Docusaurus runtime dependency
exists anywhere in the package graph.

There is no compatibility promise for the superseded view-library contract,
current Docusaurus template modules, accidental overlay routes, global Infima
selectors, or disabled Portfolio features. Consumer migration, shims,
publication, and deployment are separate work outside this contract phase.

## Not guaranteed

- The package does not verify that an external URL exists or is trustworthy.
- It does not sanitize React content supplied through a rich-text slot; the
  consumer owns that explicit trust boundary.
- It does not coordinate storage keys shared by independent applications.
- It does not author, migrate, normalize, or retain consumer product JSON.
- It does not recover an ambiguous tree automatically or claim rollback for an
  external deployment system.
- It does not promise parity with behavior explicitly excluded by the brief,
  design, or provenance manifest.

## Unresolved

None.
