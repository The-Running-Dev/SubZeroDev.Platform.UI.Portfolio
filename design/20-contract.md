# Portfolio UI public contract

## How this contract is kept

Invariants have stable ids `P<n>`. They are never reused or renumbered. A
rewording that preserves meaning keeps its id. Public declarations will be
canonical in `src/`; this document owns semantics declarations cannot express.

The word **consumer** includes a Docusaurus wrapper, a standalone React app, a
test fixture, or another package. The word **core** means the root npm export
and its dependency graph.

## Package identity and compatibility

The npm name is `subzerodev-platform-ui-portfolio`.

During `0.x`, consumers pin exact versions. At `1.0.0` and later, the following
are semver-governed public API:

- export paths and exported names;
- TypeScript declarations and accepted model versions;
- validator acceptance/rejection behavior and issue paths;
- error classes, codes, and tagged resource states;
- rendered element order, roles, accessible names supplied by the package,
  package-owned ids/data attributes, and package-owned class names;
- CSS export paths, selectors, tokens, cascade ordering, and documented legacy
  compatibility behavior;
- optional-entry peer dependency expectations.

A view-model field may be optional without being defaultable. Absence is
preserved unless this contract names a safe UI default. Copy, URLs, assets,
icons, route destinations, and branding are never inferred from another field.

## Public export map

### Root: `subzerodev-platform-ui-portfolio`

The root exports only React-pure or deterministic values:

**Renderers**

- `CV`
- `Portfolio`
- `Projects`
- `Badges`
- `VersionDisplay`
- `NavBarLinks`
- `GitHubLinks`
- `GitHubInfo`
- `ThemeSwitcher`

**View-model contracts**

- the nine `*ViewModelV1` types named in `10-design.md`
- corresponding renderer prop and slot types
- corresponding `validate*ViewModelV1(unknown)` functions
- corresponding `define*ViewModelV1(model)` eager-validation helpers
- corresponding schema values, exported with `*ViewModelV1Schema` names

`define*ViewModelV1` validates eagerly and returns the same object reference.
Render boundaries validate again in development/test builds and may elide the
duplicate check in production only when branded evidence from the package
validator is present. Plain object and JavaScript callers can never bypass final
validation.

**Shared contracts**

- `Validator<T>`
- `ValidationIssue`
- `ValidationResult<T>`
- `ViewModelValidationError`
- `DataResolutionError`
- `DataResolution<T>`
- `DataSourceDeclaration<TRaw, TView>`
- `defineDataSource`

**Deterministic selectors**

- CV period parsing/sorting
- portfolio technology flattening and project-link eligibility
- project flattening, searching, category/tag/date filtering, statistics, and
  filter-option generation
- badge placeholder substitution/group filtering
- default-theme selection
- external-link classification

Exact selector names become canonical in `src/index.ts` before slice S2 closes.
No internal helper becomes public merely because a test imports it.

### Browser: `subzerodev-platform-ui-portfolio/browser`

Exports:

- `useProjectsController`
- `useUrlFilterState`
- `useSearchState`
- `useScrollTargets`
- `useStylesheetTheme`
- `StylesheetThemeInitializer`
- browser/storage/history/clock port types used by those hooks

This entrypoint may read DOM globals only inside effects, event callbacks, or
injected ports. Its initial render is SSR-safe and matches hydration.

### Data.Json: `subzerodev-platform-ui-portfolio/data-json`

Exports:

- `ValidatedJsonResource`
- `useValidatedJsonResource`
- `useValidatedJsonSources`
- `usePreloadJsonSources`
- Data.Json metadata projection types

Every API requires explicit source declarations. None imports a generated map,
constructs a global loader, reads a feature enum, or assumes the ids `cv`,
`portfolio`, or `projects`.

### Giscus: `subzerodev-platform-ui-portfolio/giscus`

Exports:

- `GiscusComments`
- `GiscusViewModelV1`, its props, schema, validator, and definition helper

The renderer accepts explicit theme/config props. Missing required repository
configuration renders `unconfigured` supplied by the caller, defaulting to
`null`. It never emits setup instructions or a fixed external destination.

### Docusaurus: `subzerodev-platform-ui-portfolio/docusaurus`

Exports only framework composition:

- `DocusaurusCV`
- `DocusaurusPortfolio`
- `DocusaurusProjects`
- `DocusaurusNavBarLinks`
- `DocusaurusGitHubLinks`
- `DocusaurusGiscusComments`
- `DocusaurusThemeSwitcher`

Each still requires data/view-model props. The wrappers may use public
Docusaurus `Link`, location, base-URL, and color-mode APIs. They do not import
`@site/data`, a consumer config module, or a feature flag. The CV/Portfolio
wrappers require an explicit project-route factory before producing cross-route
links.

### Styles

- `subzerodev-platform-ui-portfolio/styles.css`
- `subzerodev-platform-ui-portfolio/legacy-docusaurus.css`

JavaScript entrypoints do not import CSS implicitly. A consumer chooses the
sheet and its ordering. Both CSS files are marked as package side effects so
bundlers retain explicit imports; JavaScript remains side-effect-free.

No other subpath is public in version 1.

## Public model layers

### Consumer raw types

The consumer owns `TRaw` and the validator that earns it. The package neither
exports nor persists `TRaw`. This remains true even if a consumer chooses to use
the exact current template YAML shape.

`Validator<T>` accepts `unknown` and returns a discriminated result. It never
throws for invalid input; a thrown validator is reported separately as
`consumer.validator_threw`.

### Package view models

Every package model is an object carrying `version: 1`. Objects are strict:
unknown fields are rejected. Nested objects are strict unless the model
explicitly designates an opaque consumer payload; version 1 designates none.

View models carry display values and structure, not loader instructions. They
contain no source id, URL-resolution policy, cache policy, feature flag,
Docusaurus route, storage key, credential, or executable plugin/module name.

Model-specific semantics:

- **CV** owns the relationship between header, optional sections, roles,
  achievements, projects, education, and timeline display. Copy values remain
  caller values. Rich content is a renderer slot, not an HTML string contract.
- **Portfolio** owns header/stats/categories/technology/project-card display.
  Link destinations are optional values or capability results.
- **Projects** owns viewer data and filterable metadata only. It contains no
  admin, edit, sync, draft-mutation, API, auth, or storage operation.
- **Badges** separates raw icon keys from resolved React nodes. A view model
  carries an icon key; rendering receives an icon resolver.
- **Version** carries explicit version text and optional link/presentation.
  Empty version is either rejected or omitted by the consumer before defining
  the model; the package never uses the clock as a version.
- **Navigation** carries explicit links and dropdown presentation. Internal
  versus external rendering is a renderer decision; route existence is not.
- **GitHubInfo** carries displayable repository metadata/URLs. Labels are props
  or view values; no product description is synthesized.
- **Themes** carries explicit names, labels, and stylesheet references. The
  declared default must name one entry when the list is non-empty.
- **Giscus** carries only the configuration accepted by the integration; its
  repository string and enum-like fields are validated before mount.

## Data source and resolution contract

`defineDataSource` requires all of:

- a source id meaningful to the consumer's Data.Json provider;
- a consumer `Validator<TRaw>`;
- a projection `(raw: TRaw) => unknown`;
- a package view-model validator;
- optional fallback data declared separately from primary resolution.

The projection returns `unknown`, not `TView`, so a TypeScript annotation cannot
stand in for the package validator.

Resolution states are:

```text
idle     no request was enabled
loading  request pending; no renderable data
ready    primary value passed both validations
fallback primary failed; explicit fallback passed package validation
error    no renderable value
```

Only `ready` and `fallback` carry `data`. Only `fallback` and `error` carry a
`DataResolutionError`. `idle` and `loading` do not carry stale data in version
1. Metadata names the source and provider facts actually observed; package
validation is reported separately and never falsifies the loader's metadata.

For several declarations, `useValidatedJsonSources` preserves declaration
order. It waits until every enabled source settles, collects every failure in
that order, and does not run the final composition function unless all required
sources are `ready` or explicitly `fallback`.

The package does not retry. It does not invalidate manual caches implicitly.
APIs that refresh accept an explicit invalidator/loader capability, then
invalidate the named source before requesting it again. A pure renderer knows
nothing about refresh.

## Error contract

`DataResolutionError` and `ViewModelValidationError` are public classes with:

- stable `code`;
- human-readable `message` written for the declarer;
- `component`/model context when applicable;
- `sourceId` when applicable;
- ordered `issues` when applicable;
- original `cause` when one exists.

Version 1 error codes:

| Code | Meaning |
| --- | --- |
| `source.unresolved` | provider has no declaration for the explicit id |
| `source.failed` | provider could not load the declared source |
| `consumer.validation_failed` | raw value failed the required consumer validator |
| `consumer.validator_threw` | consumer validator violated its non-throwing contract |
| `projection.failed` | consumer projection threw |
| `view.validation_failed` | projected or direct view model is inadmissible |
| `fallback.invalid` | explicit fallback failed package validation |
| `sources.failed` | ordered aggregate for a multi-source declaration |
| `adapter.missing_provider` | optional adapter mounted outside its required provider |

Messages are not stable for machine branching; codes and issue paths are.
Errors do not contain raw payloads, credentials, headers, or full source-map
entries.

## Fallback and empty-state contract

- No adapter has an implicit fallback.
- Fallback must be enabled per declaration and must be package-validated before
  use.
- A fallback result retains the original failure and is distinguishable in
  rendering and telemetry.
- Failure of one auxiliary source cannot be hidden by fallback of another.
- Missing optional content inside a valid model means omission.
- An intentionally empty valid collection renders the component's documented
  empty state, default `null` unless an `empty` slot is supplied.
- Invalid data never masquerades as an empty valid collection.
- Loading, error, fallback disclosure, unconfigured, and empty UI are caller
  slots. Default loading/error/unconfigured output is `null`; the package does
  not own product copy.

## Renderer safety and defaults

Pure renderers:

- accept only validated view models or validate direct unknown input at the
  boundary;
- never fetch or inspect feature flags;
- never read `window`, `document`, history, location, localStorage, or a clock
  during render;
- never render raw HTML from an ordinary string;
- never invent external targets or cross-route hrefs;
- use index or package-generated stable keys where consumer uniqueness is not
  an invariant;
- add `rel="noopener noreferrer"` to package-rendered `_blank` anchors;
- preserve consumer-provided accessible labels and reject unusable required
  labels;
- support multiple instances without fixed-id collisions.

`CV` uses an optional `idPrefix`; absent it, an SSR-stable React-generated
prefix scopes in-page navigation. `Projects` and navigation controls are
controlled in core. Browser wrappers may add state, but the server and first
client render remain identical.

## DOM contract

Root class names are fixed for version 1:

| Renderer | Root class |
| --- | --- |
| CV | `szd-portfolio-cv` |
| Portfolio | `szd-portfolio-overview` |
| Projects | `szd-portfolio-projects` |
| Badges | `szd-portfolio-badges` |
| VersionDisplay | `szd-portfolio-version` |
| NavBarLinks/GitHubLinks | `szd-portfolio-nav-links` |
| GitHubInfo | `szd-portfolio-github-info` |
| ThemeSwitcher | `szd-portfolio-theme-switcher` |
| GiscusComments | `szd-portfolio-giscus` |

Every additional package-owned class must use the same prefix and becomes
governed when published. Component state is exposed only through documented
`data-szd-portfolio-*` attributes and ARIA state; generic classes such as
`active`, `container`, `stats`, `projectCard`, or Docusaurus/Infima classes are
not emitted by core.

The implementation must generate a DOM/class manifest from representative
fixtures. Contract tests compare the complete manifest, not a hand-selected
subset, so both removals and newly introduced unprefixed names fail.

The package does not promise whitespace, React-generated ids, or text supplied
by the consumer. It does promise semantic element hierarchy, control roles,
heading levels documented by fixtures, state attributes, and the ordering
required for keyboard and CSS behavior.

## CSS contract

- Every owned class selector begins `.szd-portfolio-`.
- Every owned custom property begins `--szd-portfolio-`.
- Core CSS declares no bare element selector and no global keyframe name.
- Keyframes begin `szd-portfolio-`.
- Component rules are scoped below their root class.
- Consumer overrides use tokens or additional consumer classes; no internal
  implementation selector is exempt from semver once published.
- Core token fallbacks are framework-neutral values.
- `legacy-docusaurus.css` may reference `--ifm-*` only beneath an explicit
  compatibility root and never changes core tokens globally.
- Core CSS does not use or define `.container`, `.hero*`, `.navbar__item`,
  `.projectCard`, `.stats`, `.active`, or other host-global selectors.
- Reader-mode CSS is excluded; consumers may layer their own print/reader
  rules over the public DOM.

The CSS namespace test parses the emitted stylesheet and rejects every
unprefixed class, token, keyframe, or global selector. Rendered-DOM tests reject
unprefixed owned classes. CSS entrypoint existence is checked from the packed
tarball.

## Accessibility contract

- Dropdowns are operable by pointer and keyboard; state is reflected through
  `aria-expanded`, and focus is not trapped.
- Search inputs have caller-provided visible labels or accessible labels.
- Icon-only controls require accessible names; decorative icons are hidden.
- Disabled link affordances render inert content, not anchors with unusable
  destinations.
- Heading levels remain hierarchical and are configurable where a renderer may
  be embedded below an existing heading.
- Color is not the only active/filter indication.
- Giscus is not mounted until its required configuration validates.
- Automated accessibility checks cover every renderer state, with manual
  keyboard checks recorded for menus and filtering.

## SSR, hydration, and determinism

Core renders under Node without DOM shims. Browser hooks defer effects and use
injected ports. Date-dependent selectors accept an explicit clock; the default
clock is sampled once at controller creation, never repeatedly across one
render. Tests use a fixed clock.

No render output depends on locale defaults. Any localized relative time or
labels come from caller formatters/strings. Unknown saved browser preferences
are handled after hydration without changing the server's declared default
selection before mount.

## Peer dependencies and isolation

Required peers:

- `react`
- `react-dom`

Implementation dependency:

- `zod` (one package-owned schema runtime)

Optional peers, marked optional in package metadata and imported only by their
subpaths:

- `subzerodev-data-json` for `./data-json`
- `@giscus/react` for `./giscus`
- public Docusaurus packages needed by `./docusaurus`

FontAwesome is not a peer or public type. An icon adapter may live in the
consumer. A root-only fixture must install and bundle without any optional peer.
Each optional entrypoint has a separate packed fixture proving both its success
with the peer and a clear module-resolution failure when imported without it.

## Compatibility and deprecation

The Docusaurus migration wrapper may append legacy class names and import
`legacy-docusaurus.css`. Those names are compatibility API only, documented in
a generated legacy manifest. Core never emits them.

No existing template file changes as part of package design or package
implementation. Consumer migration begins only after parity fixtures pass.
Old template modules become explicit re-export wrappers for at least one
template release. Removal of wrappers or legacy CSS requires an announced
breaking template release; it is not implied by an npm package minor.

## Invariants

### Ownership and dependency graph

- **P1** Core imports no generated consumer data, source map, feature config,
  Docusaurus module, Giscus module, Data.Json module, browser global, admin
  module, or authentication module. Enforced by import-graph tests.
- **P2** Consumer raw types and validators are not exported or persisted by the
  package. Package view models carry rendering semantics only. Enforced by API
  review and export snapshots.
- **P3** Optional entrypoints depend inward; core never depends on an optional
  entrypoint. Enforced by build graph tests.

### Validation and resolution

- **P4** Every exported validator accepts `unknown`, has a positive test, and
  has negative coverage for every rejection branch. Enforced by validator
  branch matrix.
- **P5** Package view models are strict and versioned; unknown fields and
  unsupported versions fail. Enforced by schemas/tests.
- **P6** A consumer validator succeeds before projection, and package validation
  succeeds before render. A cast can satisfy neither boundary. Enforced by the
  adapter control flow and call-order tests.
- **P7** Multi-source composition sees all resolved values or does not run;
  failures are reported in declaration order. Enforced by concurrency-order
  tests.
- **P8** Fallback is per-source, explicit, validated, and visible as
  `status: fallback` with the primary error. Enforced by tagged-state tests.
- **P9** Refresh never reaches a hidden global loader and never reuses a manual
  cache by accident: invalidation requires an explicit capability. Enforced by
  adapter tests.

### Rendering and routes

- **P10** Pure renderers perform no I/O and read no environment/global state
  during render. Enforced by SSR tests with poisoned globals.
- **P11** No cross-route link is emitted unless the consumer supplied that href
  or a link factory. In particular, `/projects`, `/docs`, `/demos/*`, and admin
  routes are never defaults. Enforced by route-safety fixtures.
- **P12** Ordinary strings never reach `dangerouslySetInnerHTML`; legacy rich
  text requires an explicit consumer renderer. Enforced by source and injection
  tests.
- **P13** Multiple instances emit no fixed-id collision. Enforced by duplicate
  render fixtures.
- **P14** Version fallback is deterministic and explicit; the system clock and
  hard-coded `1.0.0` are not version sources. Enforced by VersionDisplay tests.

### DOM, CSS, accessibility

- **P15** Every owned class, token, state data attribute, and keyframe uses the
  package prefix. Enforced by complete CSS/DOM namespace parsing.
- **P16** Published DOM and CSS manifests change only with the semver treatment
  required by this contract. Enforced by fixture review and release tooling.
- **P17** Core CSS has no global selectors or required Infima dependency.
  Enforced by stylesheet parsing and a non-Docusaurus fixture.
- **P18** Controlled menus, filters, search, and themes remain keyboard-usable
  and accurately expose state. Enforced by interaction/a11y tests.

### Packaging and migration

- **P19** Root-only packed consumers do not install or resolve optional peers.
  Enforced by tarball fixtures.
- **P20** Docusaurus wrappers use public framework APIs, require explicit
  consumer data/routes, and pass a build with only `/` under broken-link
  failures. Enforced by Docusaurus fixtures.
- **P21** No template migration begins before package parity, namespace, SSR,
  packed-consumer, and downstream-route fixtures pass. Enforced by slice order.

## Not guaranteed

- The package does not validate whether a consumer-owned external URL exists.
- It does not sanitize output from a consumer-supplied rich-text renderer; the
  opt-in renderer owns that trust boundary.
- It does not coordinate two applications sharing the same caller-selected
  storage key.
- It does not author or migrate consumer JSON.
- It does not promise parity with accidental current behavior listed as an
  explicit exclusion in `10-design.md`.

## Unresolved

None.
