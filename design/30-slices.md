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

## How this document is kept

The S0-S9 plan above is retained as retired planning evidence. It predates the
approved Portfolio-builder reset recorded in `design/90-decisions.md`, none of
its slices was tracked as an issue, and its ids remain unavailable. The
authoritative unimplemented work begins at S10 under `## Outstanding`.

An outstanding slice keeps its complete body here. When its issue closes, its
body is retired and `## Landed` keeps only its stable id, name, issue, criterion
range, and the commit at which the body was complete. A re-run appends new
slices under `## Outstanding`; it never rewrites a landed row or reuses an id.

## Outstanding

## S19 — Preview the exact promoted artifact

Delivers: A reviewer can build and serve the exact promoted site at an explicit
local address, with contained request handling shared by every preview.

Touches: preview command, build command, static server, artifact writer,
running-server contract

Depends on: S17

Acceptance:

- S19.1 `preview --root <path> --config <path> --out-dir <path> --host <host>
  --port <port>` requires every shown value, completes an ordinary promoted
  build, and binds only after that build succeeds.
- S19.2 The server reads only the artifact recorded for that build and maps each
  declared route and asset to the same contained path and content type used by
  the production artifact checks.
- S19.3 Malformed encoding, traversal, escaping symlinks, absent files, and
  undeclared routes return the generic not-found result without exposing a host
  path or reading outside the artifact.
- S19.4 A bind failure returns `server.bind_failed`, leaves the promoted
  artifact valid, and releases the server's ordinary resources.

Out of scope: dev watching, inferred fallback routes, remote hosting, TLS, and
deployment.

## S20 — Merge an artifact without risking protected content

Delivers: A release maintainer can combine a verified Portfolio artifact with a
caller-owned deployment tree while protected content and the previous target
remain intact on collision, concurrent change, or failure.

Touches: merge command, merge engine, artifact reader, lease and recovery
records, command surface

Depends on: S17

Acceptance:

- S20.1 `merge --artifact-dir <path> --target-dir <path>` requires both paths,
  accepts an empty protected set as explicit policy, and treats each repeated
  `--protect` value as one normalized relative subtree.
- S20.2 Merge validates the source artifact, destination containment, capacity,
  every collision, and every protected fingerprint before copying into a full
  sibling staging tree.
- S20.3 The source read lease and destination writer lease are acquired in
  normalized-path order; reversed concurrent merges complete without deadlock
  or one returns the contracted lease error.
- S20.4 Mutation of a protected subtree after its first fingerprint returns
  `merge.target_changed`, and collision, capacity, write, verification, and
  promotion failures leave the original destination byte-for-byte unchanged.
- S20.5 Interrupted promotion either restores the previous destination or
  writes a recovery record naming the target, staging, previous tree, and phase;
  a later merge refuses that state without deleting it.
- S20.6 Successful merge promotes one verified tree and returns the exact source
  artifact digest without modifying the source artifact or consumer repository.

Out of scope: choosing protected paths, deleting recovery trees, selecting a
host, publishing, and deploying.

## S21 — Ship reusable delivery mechanics with release evidence

Delivers: A package maintainer can hand consumers documented, reusable build
and Pages-delivery mechanics together with a complete statement of what was
verified, without publishing or deploying on their behalf.

Touches: package documentation, composite action, reusable Pages workflow,
command surface, packed-consumer fixtures, verification report, extraction
provenance fixtures

Depends on: S18, S19, S20

Acceptance:

- S21.1 The package readme documents every export, command, required argument,
  ownership boundary, explicit stylesheet, source timing, fallback state,
  recovery stop, and non-goal without embedding consumer content, credentials,
  routes, host, or deployment defaults.
- S21.2 The composite action accepts an exact package version plus explicit
  command, root, configuration, output, and merge inputs and forwards them
  without inventing routes, addresses, credentials, or a latest version.
- S21.3 The reusable Pages workflow has no trigger, domain, environment,
  concurrency group, credential, content, or implicit deploy decision; its
  deploy job declares only the permissions its checked-in fixture proves it
  needs.
- S21.4 Typecheck, unit, positive and branch-complete validator, SSR/hydration,
  interaction, accessibility, CSS/DOM namespace, import-graph, tree-shaking,
  artifact fault-injection, action/workflow, React-major, Data.Json, and packed
  tarball fixtures each report `passed`, `failed`, or `not-run` in the release
  verification output.
- S21.5 Tarball inspection proves the contracted files, exports, declarations,
  CSS side effects, peer ranges, Node/Vite isolation, Data.Json isolation, and
  absence of consumer data and Docusaurus runtime dependencies.
- S21.6 The release record names every gate that did not run, `git diff --check`
  passes, source evidence repositories remain unchanged, and no npm publish,
  tag, deploy, consumer migration, or default-branch merge occurs.

Out of scope: npm publication, tagging, deployment, consumer migration, source
repository modification, and default-branch merge.

## Landed

- **S10** — Render a validated Portfolio overview from the packed root. Issue #3.
  Criteria S10.1–S10.6. Landed at `e48754f5a0af7ae850efa726797fb649ccc47a54`.
- **S11** — Produce one crash-safe static Portfolio artifact. Issue #4.
  Criteria S11.1–S11.7. Landed at `ffd676d2f79cecce9188dbdf190f0f108c6d9af9`.
- **S12** — Hydrate browser-timed routes without exposing partial data. Issue #5.
  Criteria S12.1–S12.6. Landed at `2bcad9d53433ddbed9031db4df73fb6d7947da58`.
- **S13** — Render the complete non-Projects presentation surface. Issue #6.
  Criteria S13.1–S13.6. Landed at `9b0ca0a9e48360ec3459055487f25644f466358f`.
- **S14** — Browse Projects with controlled preferences. Issue #7.
  Criteria S14.1–S14.6. Landed at `3f20ed8153c6cd354cd0e6db0711938ef2c441af`.
- **S16** — Resolve declared sources through Data.Json. Issue #9.
  Criteria S16.1–S16.5. Landed at `e2fdd0f196f35a8092a156024892317db0d52097`.
- **S15** — Plan every declared route, style, and public asset. Issue #8.
  Criteria S15.1–S15.6. Landed at `326e61a`.
- **S17** — Check a site without replacing its artifact. Issue #10.
  Criteria S17.1–S17.5. Landed at `75fc20c`.
- **S18** — Regenerate a development site without partial generations. Issue #11.
  Criteria S18.1–S18.5. Landed at `864957b`.
