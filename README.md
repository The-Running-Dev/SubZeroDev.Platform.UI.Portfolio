# subzerodev-platform-ui-portfolio

Validated, SSR-safe Portfolio overview, CV, and Projects rendering for
React/Vite sites, plus an auditable static-build, preview, and GitHub Pages
delivery process. The package owns Portfolio-specific view-model validation,
deterministic data-to-view projection, reusable presentation, and delivery
mechanics. It does not own product data, copy, branding, route composition,
hosting, credentials, or the decision to deploy.

## Ownership boundary

Consumers own every product value and raw data type, source identifier and
source map, cache/refresh policy, copy, visual branding, assets, icon
selection, route composition beyond `/`, links, host, credentials, and the
decision to deploy. A consumer configuration declares every route beyond `/`
and supplies every cross-route destination the package does not invent.

The package owns the builder's control flow, the public Portfolio view
models, validation of those models, projection timing and failure reporting,
reusable presentation, safe defaults, the package DOM/CSS/export surface, and
the delivery mechanics below. A consumer raw validator earns `TRaw`; its
projection returns a package candidate; the package validator earns the view
model. A cast never substitutes for either validation boundary.

This README documents the package's own surface only. It contains no
consumer content, credentials, routes, host, or deployment default — every
example path, id, and value below is illustrative, not a shipped default.

## Quick start

```powershell
npm install --save-dev subzerodev-platform-ui-portfolio@<exact-version>
subzerodev-platform-ui-portfolio build --root . --config ./portfolio.config.js --out-dir ./dist
```

Every path argument shown above is required and has no default (see
[Commands](#commands)). The consumer supplies `portfolio.config.js` (or any
module path) exporting a `PortfolioSiteConfigV1` built with
`definePortfolioSite`.

## Explicit stylesheet

The package emits no CSS as a side effect of importing its JavaScript. A
consumer must explicitly import the namespaced stylesheet:

```js
import "subzerodev-platform-ui-portfolio/styles.css";
```

`package.json` declares this path as the package's only side-effectful file
(`sideEffects: ["./src/styles.css"]`), so bundlers may tree-shake every
other import safely. Every class begins `szd-portfolio-`,
every custom property begins `--szd-portfolio-`, every keyframe begins
`szd-portfolio-`, and every state attribute begins `data-szd-portfolio-` —
the stylesheet has no global selector and no host-framework dependency.

## Exports

### Root (`subzerodev-platform-ui-portfolio`)

Framework-neutral apart from React. Never imports Node, Vite, or Data.Json.

**Components** — `Portfolio`, `SiteChrome`, `CV`, `VersionDisplay`,
`Projects`, `TextSizeControl`, `ReaderModeControl`. Pure renderers: no fetch,
no feature-flag inspection, no source-map inspection, no storage mutation, no
`window` access, no Docusaurus dependency.

**Validators** (accept `unknown`, return `ValidationResult<T>`) —
`validatePortfolioViewModelV1`, `validateSiteChromeViewModelV1`,
`validateCVViewModelV1`, `validateVersionDisplayViewModelV1`,
`validateProjectsViewModelV1`, `validateTextSizeViewModelV1`,
`validateReaderModeViewModelV1`, `validateBrowserBootstrapV1`.

**View-model contracts** (id, validator pairing consumed by `defineSource`) —
`portfolioViewModelV1Contract`, `siteChromeViewModelV1Contract`,
`cvViewModelV1Contract`, `versionDisplayViewModelV1Contract`,
`projectsViewModelV1Contract`, `textSizeViewModelV1Contract`,
`readerModeViewModelV1Contract`.

**Deterministic selectors** (pure functions, no I/O) —
`selectLinkDestination`, `flattenPortfolioTechnologies`, `filterProjects`,
`summarizeProjects`.

**Resolution kernel** — `defineSource`, `resolveSource`, `resolveSources`.
Provider-neutral single- and multi-source resolution: validates the raw
value, projects it, validates the resulting view model, and — only when an
explicit `fallback` is supplied and no other candidate exists — validates and
returns that fallback while retaining the triggering error on the result.
Nothing is silently converted to an empty or apparently fresh result; a
`"fallback"` status always carries the `error` that triggered it. Multiple
declared sources settle independently and are reported in declaration order;
composition never runs against a partial source set.

**Errors** — `ValidationError` (`view.validation_failed`) and
`ResolutionError` (`consumer.validation_failed`,
`consumer.validator_threw`, `projection.failed`, `fallback.invalid`,
`source.failed`, `sources.failed`, `source.refresh_unavailable`). See
[Error semantics](design/20-contract.md#error-semantics) for the full code
table, retry guidance, and caller action per code.

**Types** — `IssuePath`, `ValidationIssue`, `ValidationResult`, `Validator`,
`LinkCapabilityV1`, `ProjectCardViewModelV1`, `PortfolioViewModelV1`,
`IconRenderer`, `PortfolioProps`, `NavigationItemV1`,
`SiteChromeViewModelV1`, `CVTextV1`, `CVViewModelV1`,
`VersionDisplayViewModelV1`, `ProjectsViewModelV1`, `ProjectsQueryV1`,
`TextSizeViewModelV1`, `ReaderModeViewModelV1`, `SiteChromeProps`,
`RichTextSlot`, `CVProps`, `VersionDisplayProps`, `ProjectsProps`,
`TextSizeControlProps`, `ReaderModeControlProps`, `SourceProviderResult`,
`SourceProviderCapability`, `ViewModelContract`, `DefinedSource`,
`SourceDefinitionInput`, `Resolution`, `ResolvedSourceValueV1`,
`BrowserBootstrapV1`.

### `subzerodev-platform-ui-portfolio/builder` (Node/Vite only)

Reachable only from this subpath — the root export never imports Node or
Vite.

**Configuration** — `definePortfolioSite`, `validatePortfolioSiteConfigV1`,
`loadPortfolioConfig`, `defineSource` (re-exported for build-time source
declarations).

**Commands** — `buildPortfolioSite`, `checkPortfolioSite`,
`startPortfolioDevServer`, `previewPortfolioSite`, `mergePortfolioArtifact`.
Each accepts explicit paths; see [Commands](#commands) for the CLI form of
the same operations.

**Provenance and artifact validators** — `validateProvenanceManifestV1`,
`validateArtifactRecordV1`, `validateRecoveryRecordV1`.

**Error** — `BuilderError`, carrying `code`, `issues`, and — for `check` —
the full `gates` list including entries with status `"not-run"`. See
[Error semantics](design/20-contract.md#builder-buildererror) for the
complete code table.

**Types** — `BuilderInputPaths`, `BuilderPaths`, `PortfolioSiteConfigV1`,
`GateResultV1`, `CheckResult`, `ServerAddress`, `RunningServer`,
`MergeOptions`, `MergeResult`.

### `subzerodev-platform-ui-portfolio/browser` (browser runtime only)

Reachable only from this subpath. SSR-safe: the same declared defaults
apply on the server and on the first client tree, and preference
restoration only ever happens after the hydration commit.

**Hydration** — `hydratePortfolioRoute`. Owns one browser route's bootstrap
validation, complete-set settlement, matching-shell hydration, and
post-commit publication. Hydrates the caller's declared unresolved boundary
only after the whole required source set settles, then publishes exactly one
`ready`, `fallback`, or `error` result. No caller may split or reorder that
sequence.

**Preference controllers** — `createTextSizeController`,
`createReaderModeController`, `createProjectsUrlController`. Each accepts an
explicit storage, DOM, or URL port supplied by the consumer; an unavailable
or throwing port falls back to the declared default rather than failing
hydration.

**Error** — `BrowserError` (`bootstrap.invalid`, `browser.sources_failed`,
`browser.hydration_failed`, `preference.invalid`, `preference.port_failed`,
`generation.superseded`, `generation.disposed`).

**Types** — `BrowserRouteResult`, `HydratePortfolioRouteOptions`,
`BrowserRouteController`, `PreferenceStoragePort`, `PreferenceDomPort`,
`UrlStatePort`, `PreferenceController`.

### `subzerodev-platform-ui-portfolio/data-json` (optional Data.Json integration)

Reachable only from this subpath; `subzerodev-data-json` is an optional peer
and is absent from a root-only or `/builder`-only install.

**Adapter** — `createDataJsonProvider`, translating a consumer-supplied
Data.Json loader and source id into a `SourceProviderCapability` for
`defineSource`. Metadata from Data.Json is allowlisted into safe name/value
pairs, never copied wholesale.

**Error** — `DataJsonAdapterError` (`data_json.source_unresolved`,
`data_json.load_failed`, `data_json.refresh_unavailable`,
`data_json.metadata_invalid`).

## Commands

```text
subzerodev-platform-ui-portfolio build --root <path> --config <path> --out-dir <path>
subzerodev-platform-ui-portfolio check --root <path> --config <path>
subzerodev-platform-ui-portfolio dev --root <path> --config <path> --out-dir <path> --host <host> --port <port>
subzerodev-platform-ui-portfolio preview --root <path> --config <path> --out-dir <path> --host <host> --port <port>
subzerodev-platform-ui-portfolio merge --artifact-dir <path> --target-dir <path> [--protect <relative-path>]...
```

Every shown option is required except repeatable `--protect`. No path, host,
or port has a default. Relative `--config`/`--out-dir` resolve from
`--root`; other relative paths resolve from the current process directory
only after containment checks.

- `build` writes a complete, verified artifact to `--out-dir`. It reads
  configuration, the package-owned provenance manifest, declared sources,
  styles, and assets; it writes only staging, lease/recovery state, and
  `--out-dir`.
- `check` performs the same validation and staging as `build` without
  promoting, and always reports the **full** gate list — including any gate
  that did not run — rather than stopping at the first failure.
- `dev` serves the latest complete regeneration of the same inputs `build`
  uses, coalescing and serializing rebuilds. A failed regeneration is
  visible as a development error; it never replaces the last complete
  generation with a partial one.
- `preview` runs a build, then serves that exact promoted artifact through
  the same static server `dev` uses — no independent route or content-type
  behavior.
- `merge` copies a built artifact into a target deployment tree, fingerprint-
  proving every `--protect`ed subtree before and after staging, and leaves
  the target unchanged on any collision.

No command modifies a source repository, configuration, provenance manifest,
consumer content, registry, hosted site, or deployment setting, and no
command publishes, deploys, or contacts an evidence repository.

Success writes one concise line naming the command result and artifact
digest when one exists. Failure writes ordered safe diagnostics to stderr
and exits non-zero. Help or an unknown invocation writes usage without
loading configuration.

### Recovery stop

An interrupted build, dev regeneration, or merge can leave a **recovery
record** naming ambiguous authoritative and staged trees. A later command
against the same target refuses with `recovery.required` (builder) rather
than guessing which tree is correct or deleting either one automatically.
This is a deliberate stop: adjudicate the named trees by hand, then retry.
A concurrently running writer instead reports `lease.unavailable`, which is
retryable once the other operation finishes — it is not a recovery
condition.

### Source timing and fallback

Every declared source names a `timing` of `"build"` or `"browser"`. A
`"build"` source resolves once, during `build`/`check`/`dev`, before
rendering. A `"browser"` source resolves in the browser, before the
hydration boundary the consumer supplies to `hydratePortfolioRoute`
publishes. Either way, resolution validates the raw value, projects it, then
validates the resulting package view model before any renderer sees it — no
renderer ever receives a partial or unvalidated source set, including when a
failed source is auxiliary to the visible route.

A source may declare an explicit `fallback`. A fallback candidate is
validated exactly like a primary one — an invalid fallback is a
`fallback.invalid` error, not silently ignored — and a resolution that used
it reports `status: "fallback"` together with the `error` that triggered the
fallback, so callers can distinguish "resolved as declared" from "resolved
because the declared source failed." There is no implicit empty model or
bundled product default.

## Delivery mechanics

The package ships a composite action and a reusable GitHub Pages workflow
alongside its commands. Both are consumed like any other GitHub Actions
asset — pin an exact package version and an exact commit/tag, respectively —
and neither infers a trigger, domain, concurrency policy, credential, host,
route, content, or decision to deploy. Those remain the calling repository's.
The workflow's deploy job does name the `github-pages` environment, because a
Pages deployment must run in one; it attaches no protection rule or ref
restriction to it, which is the part of an environment a caller owns.

### Composite action (`action.yml`)

```yaml
- uses: <owner>/<repo>@<exact-commit-or-tag>
  with:
    package-version: <exact-version>   # required, no default, never "latest"
    command: build                     # required: build, check, or merge
    root: .
    config: ./portfolio.config.js
    out-dir: ./dist
    # merge-only:
    # artifact-dir: ./dist
    # target-dir: ./deploy
    # protect: |
    #   docs
    #   CNAME
```

The action installs the exact `package-version` given and invokes
`subzerodev-platform-ui-portfolio <command>` with the corresponding CLI
flags, forwarding every input verbatim — it never reinterprets a value,
never invents a route, address, or credential, and never defaults
`package-version` to `latest`.

### Reusable Pages workflow (`.github/workflows/deploy-pages.yml`)

```yaml
jobs:
  deploy:
    uses: <owner>/<repo>/.github/workflows/deploy-pages.yml@<exact-commit-or-tag>
    with:
      package-version: <exact-version>   # required
      action-repository: <owner>/<repo>  # required: the repository above
      action-ref: <exact-commit-or-tag>  # required: the same ref as above
      root: .
      config: ./portfolio.config.js
      out-dir: ./dist
      target-dir: ./deploy
      docs-artifact: docs                # optional: a separately built docs artifact to merge alongside
```

The workflow checks out the caller, optionally downloads the named
`docs-artifact`, runs `build` then `merge` through the composite action
above, uploads the resulting tree as a Pages artifact, and deploys it. It
declares only the `contents: read`, `pages: write`, and `id-token: write`
permissions its deploy job's checked-in fixture proves it needs. It supplies
no `on:` trigger, no `concurrency` group, and no domain — the caller's own
workflow supplies the trigger and any policy around it, and calls this
workflow through `uses:` with `with:` values that are entirely the caller's
to set. The deploy job names the `github-pages` environment a Pages
deployment requires, and sets no protection rule or ref restriction on it.

`action-repository` and `action-ref` repeat the repository and ref from the
`uses:` line, and are required rather than defaulted. A called workflow's
steps run in the caller's context, so a relative `uses: ./` inside this
workflow would resolve against *your* checkout rather than this repository,
and a called workflow cannot read the ref it was invoked with
([actions/toolkit#1264](https://github.com/actions/toolkit/issues/1264)).
Naming them explicitly is the supported way to pin the action. Keep the two
values in step with the `uses:` line, because nothing enforces that for you
and a mismatched `action-ref` runs a different version of the action than of
the workflow. The checkout lands in `.portfolio-action` and is removed before
the Pages upload, so nothing of this repository reaches your deployed site
even when `target-dir` is the repository root. `action-repository` must be
readable by the caller's `GITHUB_TOKEN`.

## Release verification

`npm run release-verify` runs typecheck, unit, positive/branch-complete
validator, SSR/hydration, interaction, accessibility, CSS/DOM namespace,
import-graph, tree-shaking, artifact fault-injection, action/workflow,
React-major, Data.Json, and packed-tarball gates and writes a release record
to `release/verification-report.json` (gitignored — regenerated per run,
never committed). Every gate reports `passed`, `failed`, or `not-run`; a
`not-run` gate always carries its reason rather than being silently omitted.
This command never publishes, tags, deploys, migrates a consumer, or merges
a pull request — it only reports.

## Non-goals

The package does not embed Portfolio JSON, authored YAML, generated data,
remote URLs, copy, branding, routes, icons, assets, credentials, or hosting
defaults. It supplies no README/changelog generic-site mode and no
LandingPage adapter compatibility. It has no Docusaurus runtime dependency,
theme swizzle, private framework API, or global Infima CSS ownership. It
does not administer Projects (no editing, bulk actions, drag/drop,
authentication, API mutation, storage, sync, or audit history). It never
silently accepts invalid input, a partial source set, an implicit fallback,
an inferred `/projects` or `/cv` route, or unsafe raw HTML — a consumer
rich-text slot is an explicit trust boundary the consumer owns, not
something this package sanitizes. It does not verify that an external URL
exists or is trustworthy, and it does not coordinate storage keys shared by
independent applications.

## Compatibility

Before `1.0.0`, pin an exact package version. At and after `1.0.0`, export
paths and names, declarations, accepted model/record versions, validator
acceptance and issue paths, error codes, resolution states, CLI syntax and
exit semantics, artifact layout, public DOM, classes, data attributes, CSS
selectors, tokens, cascade order, and delivery inputs are semver-governed.
See [`design/20-contract.md`](design/20-contract.md) for the complete public
contract.
