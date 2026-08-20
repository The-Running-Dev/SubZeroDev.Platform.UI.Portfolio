# Phased extraction plan

## How to execute this plan

Each slice is a fresh implementation session and ends with a runnable package.
Acceptance ids are stable; rewording does not change an id. Do not start the
next slice while a criterion in the current one is unmet. A public-interface
change requires `20-contract.md` and `90-decisions.md` to be amended before code.

The source repository remains unchanged through S8. S9 is a separate consumer
migration and requires separate authorization.

## Phase 0 — Documentation and API discovery

### S0 — Establish the allowed implementation APIs

**What to do**

Read the package contract set completely. Re-read the source locations listed
below and verify the exact installed/public APIs rather than relying on this
plan's recollection. Record `docs/allowed-apis.md` containing the exact supported
versions and signatures selected for the first release.

Required discovery:

- React: component, context, `useId`, effect/hydration, and React DOM server
  rendering APIs from the official versioned declarations/docs for both
  supported major fixtures.
- Zod: strict objects, discriminated unions, recursive schemas, error issue
  paths, and inferred input/output types.
- Data.Json: `Validator<T>`, `JsonResult<T>`, `JsonLoader`, `JsonProvider`,
  `useJson`, `useJsonLoaderContext`, `loadById`, `preload`, `invalidate`, and
  `dispose` from the exact release selected.
- Docusaurus: public Link, location/router, base URL, and color-mode APIs. A path
  containing `/lib/client/exports/` is specifically not allowed.
- Giscus React: exact prop types and SSR behavior.
- the chosen bundler's package exports, CSS export, declarations, side-effects,
  and optional-peer behavior.

The locally inspected Data.Json 0.2.0 declarations establish these currently
allowed facts, subject to re-verification: `useJson<T>(id)` accepts no validator;
`JsonProvider` accepts a caller-created loader; `useJsonLoaderContext` exposes
that loader; `JsonLoader` has `preload`, `invalidate`, and `dispose`; and
`Validator<T>` accepts `unknown` and returns an `ok` result.

**Documentation/evidence references**

- `design/00-brief.md`
- `design/10-design.md` §§ Architectural position, Module boundaries
- `design/20-contract.md` §§ Public export map, Peer dependencies
- `/Users/ben/Dropbox/Projects/SubZeroDev.Platform.UI.LandingPage/test/packed.test.ts`
- `/Users/ben/Dropbox/Projects/Docusaurus-Template/node_modules/subzerodev-data-json/dist/core/types.d.ts`
- `/Users/ben/Dropbox/Projects/Docusaurus-Template/node_modules/subzerodev-data-json/dist/react/*.d.ts`
- official package documentation for the exact versions selected

**Acceptance**

- **S0.1** `docs/allowed-apis.md` names exact versions, signatures, source links,
  and import paths for every implementation dependency/peer.
- **S0.2** It explicitly lists forbidden private/deprecated paths and APIs that
  do not exist, including a validator argument to Data.Json `useJson`.
- **S0.3** React 18 and 19, Docusaurus, Giscus, and Data.Json version ranges are
  decisions supported by fixtures or narrowed to exact tested versions.
- **S0.4** No application source has been copied and no consumer repository has
  changed.

**Anti-pattern guards**

- Do not invent a `useJson(id, validator)` overload.
- Do not import Docusaurus private paths.
- Do not infer peer ranges from the latest registry version.
- Do not treat current implementation comments as upstream API documentation.

## Phase 1 — Repository and contract scaffolding

### S1 — Create the publishable package skeleton

**What to implement**

Create the TypeScript/React library, deliberate export map, test harness,
declaration build, CSS exports, files allowlist, license/readme, and packed
consumer fixtures. Copy the packed-artifact verification pattern from the
LandingPage test, adapting paths rather than copying its Node/Vite architecture.
Add import-graph checks before feature code exists.

**References**

- `design/20-contract.md` §§ Package identity, Public export map, Peer dependencies
- LandingPage `package.json`, `tsconfig.json`, `test/packed.test.ts`
- `docs/allowed-apis.md` produced by S0

**Acceptance**

- **S1.1** Root, browser, data-json, docusaurus, giscus, and two CSS exports
  resolve from a packed tarball; unimplemented optional exports may expose typed
  placeholders that throw only when invoked, never during import.
- **S1.2** Root imports and bundles with only required peers installed.
- **S1.3** Import-graph tests enforce P1 and P3.
- **S1.4** `npm pack --dry-run` contains only intended runtime files,
  declarations, CSS, license, and readme.
- **S1.5** No npm publish occurs.

**Anti-pattern guards**

- No wildcard subpath exports.
- No source-directory deep imports in tests.
- No JavaScript entrypoint auto-imports CSS.
- No generated consumer content in fixtures outside explicit test data.

## Phase 2 — Contracts, models, and deterministic selectors

### S2 — Implement public validation and error contracts

**What to implement**

Implement the shared result/error types and all strict version-1 view-model
schemas. Use the current component models and authored YAML only as behavior
evidence; do not copy their drifted shapes wholesale. Separate serialized icon
keys from resolved React icons and exclude every admin/sync field.

For each model, create one minimal valid fixture, one representative complete
fixture, and a table of rejection branches. Copy the validator-result convention
from Data.Json/LandingPage (`unknown` in, discriminated result out), while using
the public error model defined here.

**References**

- `design/10-design.md` §§ Entities, Closed extraction inventory
- `design/20-contract.md` §§ Public model layers, Error contract, P4–P8
- Docusaurus source models/schemas identified in `10-design.md` evidence
- LandingPage `src/data.ts` strict versioned-validator pattern

**Acceptance**

- **S2.1** Every `*ViewModelV1` and schema/validator/helper is exported exactly
  as contracted.
- **S2.2** Unknown fields and unsupported versions reject at every model root.
- **S2.3** Every validator has positive and branch-complete negative tests.
- **S2.4** Error codes, issue order, cause preservation, and redaction are tested.
- **S2.5** Export/API snapshots contain no consumer raw, FontAwesome, admin,
  Docusaurus, Giscus, or Data.Json type.

**Anti-pattern guards**

- No `any` at public boundaries.
- No validator accepts an already asserted model instead of `unknown`.
- No source id, feature flag, cache policy, route default, plugin name, or
  credential enters a view model.
- No Zod default silently invents consumer copy or URLs.

### S3 — Implement deterministic selectors

**What to implement**

Copy the useful algorithms—not their consumer hooks—from CV period sorting,
Portfolio technology flattening, Projects processor helpers/search calculations,
Badges placeholder substitution, and theme selection. Normalize invalid date
handling explicitly. Accept a clock and caller formatter wherever output can
vary with time or locale.

**References**

- Docusaurus `src/components/CV/CVTimeline.tsx`
- `src/components/Portfolio/hooks/*`
- `src/components/Projects/hooks/useProcessor.ts`
- `src/components/Projects/utils/*`
- `src/hooks/{usePortfolio,useProjects}.ts`
- `src/components/Badges/Badges.tsx`
- `src/components/ThemeSwitcher/themes.ts`
- `design/20-contract.md` §§ SSR, hydration, and determinism; P11, P14

**Acceptance**

- **S3.1** Selectors are pure and deterministic under a fixed clock.
- **S3.2** Date/null/empty/recursive technology fixtures cover the shapes the
  current source validators accept.
- **S3.3** Link eligibility returns inert/no destination without a consumer
  capability and never creates `/projects`.
- **S3.4** Consumer arrays/objects are not mutated.
- **S3.5** Search/filter failure cases return typed validation/processing errors,
  not console output.

**Anti-pattern guards**

- No hook, DOM global, implicit locale, generated data, or feature flag in
  selectors.
- No current-date version generation.
- No fuzzy schema widening through casts.

## Phase 3 — Pure renderers and governed CSS

### S4 — Land low-coupling renderers

**What to implement**

Implement Badges, VersionDisplay, NavBarLinks/GitHubLinks, GitHubInfo, and the
controlled ThemeSwitcher first. Move current inline styles into namespaced CSS.
Use icon/link/label slots rather than framework or branding dependencies.

**References**

- current component files listed in `design/10-design.md` inventory
- `design/20-contract.md` §§ Renderer safety, DOM, CSS, Accessibility
- current Badges schema tests as the only existing positive/negative component
  validator pattern

**Acceptance**

- **S4.1** Each renderer passes minimal, complete, empty, and invalid-boundary
  fixtures.
- **S4.2** No generated data, feature config, current path, clock, or optional
  peer is imported.
- **S4.3** Dropdown/menu keyboard and accessibility tests pass.
- **S4.4** DOM and CSS manifests contain only package-prefixed owned names.
- **S4.5** GitHubLinks delegates NavBarLinks and emits no second CSS dialect.

**Anti-pattern guards**

- No hard-coded setup/product copy.
- No FontAwesome type in models.
- No external-link sprite id owned by Docusaurus.
- No fallback `v1.0.0` or current date.

### S5 — Land CV, Portfolio, and viewer-only Projects

**What to implement**

Copy the presentational structure from the current source into pure renderers,
then replace every consumer/framework edge with explicit props or selectors.
For Projects, start from the non-admin filter/results seam and copy no admin
facade. Build package CSS from the visual behavior while rewriting every class,
token, and keyframe to the governed namespace.

**References**

- Docusaurus CV `CV.tsx`, `CVTimeline.tsx`, `TechTags.tsx`
- Portfolio `Portfolio.tsx` and `components/*`
- Projects `components/*`, `hooks/useProcessor.ts`, and `utils/*`
- `design/10-design.md` renderer composition sections
- `design/20-contract.md` P10–P18

**Acceptance**

- **S5.1** CV ordinary strings are escaped; explicit rich-text slots are the
  only raw-render seam and injection tests prove the default safe.
- **S5.2** Portfolio and CV emit no cross-route anchor without an explicit
  consumer link result.
- **S5.3** Projects public exports contain no admin/edit/auth/API/storage type or
  import.
- **S5.4** Two instances of every renderer have no id collision.
- **S5.5** SSR under React 18 and 19 produces deterministic markup and hydrates
  without warnings.
- **S5.6** CSS parser and rendered-DOM namespace tests cover every selector and
  class, including additions.
- **S5.7** Accessibility checks pass for representative empty, complete, and
  interactive states.

**Anti-pattern guards**

- Do not copy `Projects`, `ProjectsManager`, or current `ProjectsDisplay` whole.
- Do not import `@theme/Heading` or `@docusaurus/Link`.
- Do not emit generic host classes or raw Infima dependencies.
- Do not retain `DebugInfo` or console logging in production render paths.

## Phase 4 — Optional runtime integrations

### S6 — Implement browser controllers

**What to implement**

Move URL query synchronization, search persistence, scrolling, stylesheet
application, and storage behind injected browser ports/effects. Preserve useful
behavior from the source hooks but make initial state explicit and hydration-safe.

**References**

- Docusaurus Projects `hooks/{useSearch,useScrollRefs,useUrlFilter}.ts`
- `src/components/ThemeSwitcher/ThemeSwitcher.tsx`
- `src/hooks/useThemeInitialization.ts`
- `design/20-contract.md` Browser export and SSR sections

**Acceptance**

- **S6.1** Import and server render succeed with poisoned/missing DOM globals.
- **S6.2** history, popstate, storage failures, unknown saved themes, and cleanup
  are tested through ports.
- **S6.3** Theme application mutates only package-marked link elements.
- **S6.4** First server/client markup matches before effects.
- **S6.5** Browser entry remains independent of Docusaurus.

**Anti-pattern guards**

- No module-level access to browser globals.
- No fixed consumer storage key without an override.
- No retry loop that hides URL/history failure.
- No feature-config dependency.

### S7 — Implement Data.Json and Giscus entrypoints

**What to implement**

Implement the validated single/multi-source state machine against only the APIs
approved in S0. Use the nearest consumer provider; accept explicit invalidation
for refresh. Implement Giscus as an explicit-prop optional renderer.

**References**

- `docs/allowed-apis.md`
- current `src/components/DataProvider/DataProvider.tsx`
- current `src/hooks/{usePortfolio,useProjects,useAppInitialization}.ts`
- current two Giscus implementations
- `design/20-contract.md` Data source, Error, Fallback, and optional export sections

**Acceptance**

- **S7.1** Call-order tests prove raw validation → projection → view validation
  → render.
- **S7.2** Multi-source failures are complete and declaration-ordered despite
  out-of-order resolution.
- **S7.3** Explicit fallback remains distinguishable and invalid fallback fails.
- **S7.4** Manual-cache refresh invalidates only through the supplied capability.
- **S7.5** Missing provider produces `adapter.missing_provider`; no ambient
  loader or empty source id is used.
- **S7.6** Giscus missing/invalid configuration does not mount the third-party
  component and renders only caller-owned slots.
- **S7.7** Root packed fixture still installs without Data.Json or Giscus.

**Anti-pattern guards**

- No generated source map or hard-coded `cv`/`portfolio`/`projects` ids.
- No package retry or cache policy.
- No untyped metadata tuple.
- No instructional Giscus copy or fixed giscus.app link.

### S8 — Implement Docusaurus wrappers and compatibility fixtures

**What to implement**

Use only public Docusaurus APIs approved in S0. Compose core components with
Link/location/base-path/color-mode capabilities. Add the scoped legacy class
manifest and compatibility stylesheet. Build two Docusaurus fixtures: one
parity fixture with explicit template routes and one downstream-safe fixture
with only `/`.

**References**

- `docs/allowed-apis.md`
- current NavBarLinks, TechTags, ProjectsLink, GiscusComments, ThemeSwitcher
- `Docusaurus-Template/AGENTS.md` § Downstream Consumers
- `design/20-contract.md` Docusaurus and compatibility sections

**Acceptance**

- **S8.1** No wrapper imports `@site/data`, feature config, consumer singleton,
  or a private Docusaurus module.
- **S8.2** Only explicit consumer link factories produce non-root routes.
- **S8.3** The `/`-only fixture builds with broken links configured to throw.
- **S8.4** Parity fixtures document intentional differences and match intended
  current behavior for every included renderer.
- **S8.5** Legacy classes are isolated to wrappers/legacy CSS and captured in a
  generated manifest.
- **S8.6** Optional-peer missing/success packed fixtures behave as contracted.

**Anti-pattern guards**

- Do not copy YAML or generated JSON into the package.
- Do not turn template feature flags into package policy.
- Do not preserve dead GitHubLinks CSS, shadowed Giscus files, unsafe HTML, or
  schema/type bugs as parity.

## Phase 5 — Release verification and consumer handoff

### S9 — Verify the package and prepare migration without changing the template

**What to implement**

Run the complete release matrix, inspect the packed artifact, and write a
consumer-owned migration guide containing explicit projections for the current
template shapes. Do not publish and do not edit the template.

**References**

- `design/00-brief.md` Definition of done
- every invariant P1–P21 in `design/20-contract.md`
- LandingPage packed-consumer pattern
- S8 fixture manifests

**Acceptance**

- **S9.1** Typecheck, unit, validator, SSR/hydration, interaction, accessibility,
  CSS namespace, DOM contract, import-graph, tree-shaking, and packed-fixture
  suites pass.
- **S9.2** React 18 and 19 fixtures pass; Docusaurus and optional-peer versions
  match `docs/allowed-apis.md`.
- **S9.3** Tarball inspection proves the files/export/dependency contract.
- **S9.4** Migration guide maps every current direct/indirect JSON consumer to a
  consumer projection/wrapper and names every intentionally rejected legacy
  behavior.
- **S9.5** `git diff --check` passes and no source consumer repository changed.
- **S9.6** The verification report lists every gate that did not run; no publish
  or deploy is implied.

**Anti-pattern guards**

- Do not report tests that were not run.
- Do not publish, tag, deploy, or change the template.
- Do not use document size or export inspection as a substitute for runtime
  fixture validation.

## Later consumer migration — separately authorized

After S9, a separate plan may migrate `Docusaurus-Template` in this order:

1. add package dependency, explicit stylesheet, and consumer projection module;
2. replace low-coupling wrappers (Version, Badges, Nav/GitHub links);
3. replace Giscus and Theme wrappers;
4. replace CV and Portfolio;
5. replace viewer-only Projects while leaving administration in the consumer;
6. convert old module paths to re-export shims;
7. validate every downstream route mode and visual fixture;
8. remove shims/legacy CSS only in an announced breaking template release.

That work is out of scope for this repository-design task and is not authorized
by this plan.
