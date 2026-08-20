# Portfolio UI architecture

This design is based on a complete read of `Docusaurus-Template/AGENTS.md`, its
entire `src/components` and `src/hooks` trees, `src/config/schemas.ts`,
`src/data/jsonLoader.ts`, every top-level `config/*.yml`, and the LandingPage
repository's governing contract set. It describes the target repository, not a
change to either evidence repository.

## Architectural position

The package is a view library, not a content system. It does not establish a
canonical CV, project, portfolio, navigation, or GitHub product schema. It
establishes versioned **view models**: the smallest structures whose semantics
the reusable renderers own.

A consumer may keep today's YAML-derived shapes, fetch a different service, or
compose several domain models. Its adapter validates those raw values with
consumer-owned validators and projects them into package view models. The
package validates the projection before rendering. This avoids both failure
modes found in the template: unchecked casts from remote JSON and package
ownership of product-specific types.

```text
consumer source map / static import / application state
                         |
                         v
             consumer Validator<T>              consumer-owned
                         |
                         v
                 consumer project(T)
                         |
------------------------- boundary --------------------------------
                         |
                         v
             package ViewModelV1 validator       package-owned
                         |
                         v
                 pure React renderer
```

## Entities and ownership

### Consumer source declaration

A generic declaration names a source, supplies `Validator<T>`, and supplies a
projection from `T` to a package view model. Its type, identifier, fallback
value, source-map entry, cache policy, and projection are consumer-owned. The
optional Data.Json adapter owns when it resolves and validates, how it collects
failures, and how it reports the result.

### Raw consumer model

The value earned by the consumer validator. It may resemble the current
`projects.yml`, `portfolioData.yml`, or `cvData.yml`, but no such resemblance is
part of the npm contract. It is never exported by this package.

### Package view model

A strict, versioned projection accepted by one renderer family. The canonical
declarations will live under `src/models/`. Version `1` rejects unknown fields.
The version belongs to the view contract, not to a consumer's JSON artifact.
Breaking a view model creates a new version and a semver-major package release;
the old version remains readable for the compatibility period stated in the
contract.

The package owns these model families:

- `CvViewModelV1`
- `PortfolioViewModelV1`
- `ProjectsViewModelV1`
- `BadgesViewModelV1`
- `VersionViewModelV1`
- `NavLinksViewModelV1`
- `GitHubInfoViewModelV1`
- `ThemeListViewModelV1`
- `GiscusViewModelV1` in the optional Giscus entrypoint

These names describe rendering semantics. They do not authorize the package to
own source URLs, copy defaults, route policy, or consumer storage.

### Resolved view state

The optional adapter returns a tagged state rather than the current tuple of
`data`, `loading`, `error`, and untyped metadata:

```text
idle -> loading -> ready
                -> fallback
                -> error
```

`fallback` contains both validated fallback data and the error that caused its
use. A caller cannot accidentally present a fallback as a fresh remote result.
Pure renderers never receive this state; a resource boundary selects what to
render.

### Renderer

A pure React component that receives a validated view model and explicit
rendering options. It performs no I/O, feature lookup, route inference, storage
access, or framework lookup. It renders safely for empty optional collections.
Rich HTML is not accepted as an ordinary string. Consumers needing legacy HTML
must opt into an explicit rich-text renderer at the wrapper boundary.

### Link policy

Navigation is a consumer capability. Core renderers accept an optional link
factory or link component. When neither is supplied, project categories,
technology tags, and other cross-view affordances render as inert content.
In-page fragment navigation generated inside one component may use fragment
links because it does not assume another route.

### CSS surface

The package owns one namespaced stylesheet and optional component stylesheets
re-exported through `./styles.css`. All owned selectors are rooted in
`.szd-portfolio-*`; all tokens begin `--szd-portfolio-*`. Default values may
fall back to Infima variables in the Docusaurus compatibility sheet, but the
core sheet does not require Infima.

`./legacy-docusaurus.css` maps old template class expectations onto the new
owned tokens for the migration window. It is opt-in and not the long-term
contract.

## Closed extraction inventory

The following inventory is closed for version 1. “Include” means owned by this
repository. “Wrapper” means included only behind the named optional entrypoint
or intentionally left in the consumer. “Exclude” means it must not be copied.

| Audited surface | Core package | Optional wrapper/adapter | Explicit exclusion |
| --- | --- | --- | --- |
| CV | Pure CV sections, timeline ordering, deterministic period formatting, technology display, view model and validator | Data.Json resource; Docusaurus project-tag link wrapper; explicit legacy rich-text renderer | generated `cvData`, feature flags, `DebugInfo`, inferred `/projects`, implicit `dangerouslySetInnerHTML` |
| Portfolio | Header, stats, categories, recent-project cards, technology cards, pure flatten/join selectors, view model and validator | Data.Json resource; consumer-supplied project join; Docusaurus link wrapper | consumer hooks, generated data, `@theme/Heading`, fixed project route, duplicate legacy project types |
| Projects display | Viewer-only processor, search/filter/sort utilities, filters, results, cards, controlled display, view model and validator | Data.Json resource; browser URL/search persistence controller | `Projects`, `ProjectsManager`, and `ProjectsDisplay` as copied facades; every admin/edit/auth/API/storage module and admin stylesheet |
| Badges | Placeholder substitution, group selection, resolved icon slot, renderer, view model and validator | Consumer icon registry; Data.Json resource | generated defaults, `IconDefinition` in raw model, inline Infima styling, current `icon`/`iconName` mismatch |
| VersionDisplay | Deterministic prop renderer and validator | Data.Json/static consumer wrapper | generated version import, current-date version invention, hard-coded `v1.0.0` error fallback |
| NavBarLinks | Pure link rendering, external classification, controlled dropdown, active-path input, view model and validator | Docusaurus `Link` and location wrapper; Data.Json/static wrapper; icon registry | generated links, `window.location` in core, demo routes, private SVG sprite assumptions |
| GitHubLinks | Thin semantic composition over NavBarLinks; compatible type aliases | Consumer data adapter | duplicate renderer/models and unused `GitHubLinks.css` |
| GiscusComments | None in root | `./giscus` prop renderer and schema; `./docusaurus` color-mode wrapper | feature flag, generated config, hard-coded setup copy, shadowed duplicate implementation |
| ThemeSwitcher | Controlled theme menu, selection helper, view model and validator | `./browser` stylesheet/storage controller; `./docusaurus` base-path wrapper | generated themes, private Docusaurus import, feature flag, extensionless `ConfigurableThemeSwitcher` |
| GitHubInfo | Pure config display, configurable labels/slots, view model and validator | Consumer `useGitHubConfig` wrapper remains consumer-owned | implicit generated config access, duplicate schema systems, product-specific headings as fixed copy |
| DataProvider | Tagged result/error/validator contracts only | `./data-json` validated resource and preload helpers | current feature enum, feature-to-source map, singleton loader, empty-id hook call, untyped metadata |
| Hooks | Pure selectors; controlled project-view state; controlled theme state | Data.Json hooks in `./data-json`; DOM/storage/history hooks in `./browser`; Docusaurus composition in `./docusaurus` | `useAuthenticatedFetch`, admin hooks, application `useAppInitialization`, duplicate static Projects hook |
| Schemas | Strict package view-model schemas and validation helpers | Consumer supplies raw validators; adapters compose both layers | copying current drifted consumer schemas as canonical product schemas |
| Types | View models, renderer props, slots, resource state, error/issue types | Data.Json and Docusaurus adapter types under their entrypoints | consumer raw types, admin/sync types, `any`-based metadata, FontAwesome types in core |
| CSS | Rewritten renderer CSS with governed namespace/tokens | legacy Docusaurus compatibility sheet | admin CSS, unused GitHubLinks CSS, unqualified `.container`, `.stats`, `.projectCard`, `.active`, and direct Infima ownership |
| Supporting components | Minimal Loading, Tooltip, and ErrorBoundary only if needed by exported DOM and covered by the same namespace | Browser measurement stays in `./browser` | DebugInfo, ConfigurationManager, Auth, Custom404, ReaderMode, TextSizeSwitcher, RelatedResources |

Nothing outside this table may enter the first public release without amending
the brief, contract, and decision record.

## Current direct and indirect JSON-consumer audit

This is the closed provenance map for the top-level YAML inputs and runtime
source map inspected in `Docusaurus-Template`. “Direct” means a module imports a
generated value or calls `useJson`; “indirect” means it receives that value
through a hook, provider, feature gate, or another component. The map records
current evidence only. None of these consumer-owned identifiers or shapes
becomes package API.

| Consumer-owned input | Direct current reader | Indirect consumers and behavior | Extraction disposition |
| --- | --- | --- | --- |
| `config/sources.public.yml` | generated source map in `src/data/jsonLoader.ts` | `JsonProvider`; `DataProvider`; root `usePortfolio`/`useProjects`; `useAppInitialization` preloads only portfolio/projects | Exclude map, URLs, ids, cache policy, singleton, and preload policy. `./data-json` accepts explicit declarations/provider capabilities. |
| source id `cv` and `config/cvData.yml` | `DataProvider` calls `useJson('cv')`; `CV/constants.ts` imports generated `cvData` as default | `CV` receives remote-or-default data after `schemaRegistry.cv`; its rendering path treats the reported error separately from fallback data | Include renderer/view validator. Consumer owns raw validator, projection, source declaration, feature gate, and explicit fallback. |
| source id `portfolio` and `config/portfolioData.yml` | root `usePortfolio` calls `useJson('portfolio')`; no active component import of generated `portfolioData` was found | `Portfolio`, `useProjectFiltering`, and `useTechnologyMapping`; the latter two also depend on projects | Include pure Portfolio and join/selectors. Exclude the active hook, source id, authored/generated raw data, and the apparently unused static path. |
| source id `projects` and `config/projects.yml` | root `useProjects` calls `useJson('projects')`; `Projects/constants.ts` also imports generated `projects` | active `Projects` and Portfolio hooks use the remote root hook; the duplicate `components/Projects/hooks/useProjects` uses only static generated data and appears production-unreferenced | Include viewer/selectors only. Exclude both consumer hooks, generated defaults, app preload/refetch policy, and admin graph. |
| `config/badges.yml` | `Badges/constants.ts` imports generated `badges` | `Badges` passes it through `DataProvider`, but Badges has no runtime source mapping, so it is treated as static default data; feature gating comes from global config | Include renderer/view validator and placeholder selector. Consumer adapter owns raw validation, icon registry, feature policy, and data. |
| `config/version.yml` | `VersionDisplay/constants.ts` imports generated `version` | `VersionDisplay` passes it through the static branch of `DataProvider` | Include deterministic renderer/view validator. Consumer owns version value/link and any explicit fallback. |
| `config/navBarLinks.yml` | `NavBarLinks.tsx` imports generated `navBarLinks` | `FeatureComponent` supplies it to the renderer and global features gate it | Include prop renderer/view validator. Consumer/Docusaurus wrapper owns data, feature policy, route capability, icons, and current location. |
| `config/gitHubLinks.yml` | `GitHubLinks.tsx` imports generated `gitHubLinks` | `FeatureComponent` gates it, then delegates to `NavBarLinks` | Keep only the semantic renderer alias and compatible props; consumer adapter owns the generated value. |
| `config/giscus.yml` | feature-gated `GiscusComments.tsx` imports generated `giscus` | Docusaurus color mode and `@giscus/react` consume it; a competing prop-driven implementation is shadowed by the directory export | Put validated prop renderer in `./giscus` and color-mode composition in `./docusaurus`; exclude generated config, feature flag, and setup copy. |
| `config/gitHub.yml` | `GitHubConfig/configLoader.ts` imports generated `gitHub`, validates/caches it | `useGitHubConfig` feeds `GitHubInfo` and helper functions | Include only pure GitHubInfo display/view validation. Keep raw GitHub config, cache, helpers, and hook consumer-owned. |
| `config/globalConfig.yml` | `useFeaturesConfig` imports generated `globalConfig` | `FeatureComponent`, DataProvider, Portfolio, Projects, Giscus, ThemeSwitcher, Nav/GitHub links, initialization hooks, and unrelated UI consume its feature flags | Exclude completely: feature policy and pre-build/site configuration are application concerns. |
| generated `themes` value (not a top-level `config/*.yml` in this checkout) | `ThemeSwitcher/themes.ts` imports `data.themes` | ThemeSwitcher and the Docusaurus root theme initializer resolve/apply/persist it | Include controlled view and selection helper; browser and Docusaurus behavior stay in optional entries; generated provenance stays consumer-owned. |

`useAuthenticatedFetch` and every Projects authentication/administration hook
consume API/auth state rather than reusable public JSON and are excluded. The
YAML authoring and YAML-to-generated-data pipeline are evidence inputs only and
remain out of scope.

## Evidence from the embedded implementation

The boundary is driven by concrete defects and couplings, not aesthetic
preference:

- `Badges` reads `iconName`, while authored data/schema use `icon`; its raw and
  resolved icon types are one type today.
- Projects runtime data is a top-level array, while one component schema expects
  `{categories: [...]}`.
- NavBar's model and schema disagree on most optional fields and the schema has
  an unused `ariaLabel` field.
- Project, Portfolio, and CV TypeScript models are narrower than the validators
  that earn them (`null`, recursive mixed technology nodes, numeric stats, and
  record-shaped achievements are examples).
- Giscus has competing `index.ts` and `index.tsx` implementations; the reusable
  prop version is shadowed by the feature-gated version.
- the active Portfolio and Projects views use direct remote hooks, while CV uses
  `DataProvider`; the template already has two resolution paths.
- `DataProvider` may return fallback data and a non-null error together, and its
  consumers disagree about which wins.
- the loader silently substitutes an empty map after missing/invalid generated
  configuration; all reads then become unresolved.
- Projects viewer files import admin components, auth, API types, storage, and
  admin CSS even when rendered with `isAdmin=false`.
- Portfolio and CV build `/projects?filter=...` when the consumer supplied no
  route, contradicting the template's own downstream rule.
- component CSS owns global names shared between Portfolio and Projects and
  assumes Infima tokens.

The package contract resolves these rather than preserving them as accidental
compatibility.

## Module boundaries

The target dependency graph is one-way:

| Module family | Owns | May depend on |
| --- | --- | --- |
| `src/contracts` | validation result, issue and error codes, resource state | nothing in-package |
| `src/models` | strict versioned view models and validators | contracts |
| `src/selectors` | deterministic projection helpers, project filtering/statistics, theme selection | models |
| `src/components` | pure React renderers and DOM contract | models, selectors |
| `src/browser` | DOM, history, storage, clock and viewport ports/hooks | root public modules |
| `src/giscus` | `@giscus/react` renderer | models/contracts, React |
| `src/data-json` | Data.Json resolution, consumer validation, projection, package validation, failure collection | root public modules, `subzerodev-data-json/react` |
| `src/docusaurus` | Link, current-location, base-path and color-mode composition | root, browser/giscus as needed, public Docusaurus APIs |
| `src/index.ts` | deliberate root facade | contracts, models, selectors, components |

The root graph must contain no import from the four optional module families.
Optional entrypoints may depend inward; core never depends outward.

## Renderer composition

### CV

`Cv` owns document structure and sorting. It accepts consumer copy through its
view model and UI labels through props. “Present” is interpreted with an
explicit `now`/clock option at selectors, defaulted once per render. Technology
links require a supplied link factory. Legacy rich text is an explicit wrapper
slot; the safe default renders text.

### Portfolio

`Portfolio` consumes one already-composed view model. Cross-dataset work—recent
projects and technology-to-project mapping—is performed by pure selectors or a
consumer projection before render. Category and tag destinations are optional.
No `@theme/Heading`, feature config, or data hook remains.

### Projects

`Projects` is a controlled viewer. Its core controller accepts data, query,
filter, date policy, and clock. Pure processing returns the displayed categories
and filter metadata. `./browser` may synchronize filter state with query params
and storage; the core component can be server-rendered without either. Admin
selection/editing callbacks do not exist in the public model.

### Navigation and GitHub links

`NavBarLinks` accepts explicit `currentPath`, `renderInternalLink`, and icon
rendering capabilities. Without them it emits ordinary safe anchors and no
active-route inference. `GitHubLinks` only gives the same view a semantic export
name; it owns no data import or CSS.

### Themes

The core ThemeSwitcher is controlled. The browser adapter resolves CSS hrefs,
applies one marked `<link>`, and persists through a caller-provided storage port.
The storage key is configurable and has a package default; the Docusaurus
wrapper resolves base URLs through public Docusaurus APIs. An unknown saved
theme selects the declared default and reports no error because saved preference
absence/staleness is recoverable UI state, not malformed declared data.

## Resolution and validation flow

For one source:

1. The caller supplies a source id, required `Validator<T>`, required projection
   into a package view model, and optional validated fallback declaration.
2. Data.Json resolves `unknown` under its own provider.
3. Transport failure becomes a stable package error with the original cause and
   source context.
4. The consumer validator runs exactly once per new payload identity. Failure
   prevents projection.
5. Projection runs. A thrown projection becomes `projection.failed`.
6. The package view-model validator runs. Failure becomes
   `view.validation_failed` with path issues.
7. Only `ready` or explicit `fallback` contains renderable data.

For multiple sources, steps 2–6 run for every declaration; failures are
collected in declaration order and composition runs only if every declaration
succeeds. The adapter neither invents retries nor changes Data.Json cache
policy. Refresh with a manual cache requires an explicit loader/invalidator port;
the package does not reach a consumer singleton.

## Failure and fallback semantics

| Boundary | Detection | Result | Default UI consequence |
| --- | --- | --- | --- |
| Missing optional content | package view validator accepts absence | `ready` | corresponding section omitted |
| Invalid declared view content | strict view validator | `error` | renderer is not called |
| Source unresolved/transport failure | Data.Json result | `error`, preserving cause/context | caller's error slot or `null` |
| Consumer raw validation failure | required consumer validator | `error` | projection and renderer do not run |
| Projection throws | adapter | `error` | renderer does not run |
| Explicit fallback validates | adapter after primary failure | `fallback` with data and original error | caller may render data and disclose stale/fallback state |
| Explicit fallback is invalid | package validator | aggregate `fallback.invalid` error | nothing rendered |
| Missing Giscus required config | Giscus validator | error or caller-provided unconfigured slot | no hard-coded setup instructions |
| Unknown saved theme | browser adapter | recover to declared default | controlled UI remains usable |
| Missing project-route factory | renderer capability check | not an error | inert tags/cards; no link |

Errors do not silently turn into empty models. Pure renderers may return `null`
for an intentionally empty optional collection, but malformed declared data
cannot reach them.

## Dependency and package layout

Public export paths:

```text
subzerodev-platform-ui-portfolio
subzerodev-platform-ui-portfolio/browser
subzerodev-platform-ui-portfolio/data-json
subzerodev-platform-ui-portfolio/docusaurus
subzerodev-platform-ui-portfolio/giscus
subzerodev-platform-ui-portfolio/styles.css
subzerodev-platform-ui-portfolio/legacy-docusaurus.css
```

Required peers are React and React DOM. Zod is an implementation dependency so
one validator implementation owns package view-model semantics. Data.Json,
Giscus, and Docusaurus packages are optional peers attached only to their export
paths. FontAwesome is not a core dependency: icon names remain consumer data and
icon resolution is a slot. `clsx`, if used, is private implementation detail.

The first release pins/declares only versions proven in packed fixtures. The
current evidence checkout uses React 19, Zod 4, Data.Json 0.2.0, Giscus React 3,
and Docusaurus 3.10; supported ranges are a release decision, not inferred from
this design alone.

## Compatibility-preserving migration

Migration is additive and wrapper-first:

1. Build the new package independently; do not edit the template.
2. Capture current template DOM and behavior fixtures for each included viewer,
   including its current explicit route choices.
3. Implement the new namespaced DOM and an opt-in legacy compatibility sheet.
4. Build consumer-owned Docusaurus wrappers that import generated data, feature
   flags, icons, routes, and copy, then project into package view models.
5. Prove the wrappers against the template fixtures and `onBrokenLinks: throw`
   with a consumer that has only `/`.
6. In a later consumer change, replace one embedded component at a time. The
   wrapper explicitly opts into `/projects` only where that consumer owns it.
7. Keep old component modules as re-exporting shims for one template release.
8. Remove shims and the legacy stylesheet only in a separately announced
   breaking template release after all consumers migrate.

Compatibility means the existing template can preserve its intended display
through explicit adapters. It does not mean the new package reproduces dead CSS,
shadowed modules, schema drift, unsafe HTML, silent fallback, admin imports, or
unsafe route assumptions.

## Concurrency and ordering

Pure rendering has no package concurrency. Resolution adapters await all source
results before composition. Failure ordering follows declaration order, never
completion order. DOM theme application removes only links carrying the
package-owned data attribute and appends the replacement before publishing the
new controlled state. No package-wide singleton coordinates loaders or storage;
two consumers are isolated by the ports and keys they supply.

## Open questions

None for the first-release boundary. Supported peer version ranges and the
duration of the legacy stylesheet are release-time choices constrained by the
contract and slices, not unresolved architecture.
