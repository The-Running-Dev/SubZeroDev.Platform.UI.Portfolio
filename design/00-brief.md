# Portfolio UI package brief

## Problem

`Docusaurus-Template` contains reusable JSON-driven React views for CV,
portfolio, project browsing, badges, version information, navigation, GitHub
links and information, comments, and theme selection. Those views are coupled
to generated consumer JSON, consumer feature flags, a singleton runtime loader,
Docusaurus routing/theme APIs, global Infima CSS, and—in the Projects tree—admin
and authentication code.

Create a standalone publishable React package,
`subzerodev-platform-ui-portfolio`, that owns the reusable rendering and
validation contract without taking ownership of any consumer's product data,
copy, branding, routes, source map, or hosting.

## Required outcome

The package provides:

- pure, validated data-prop renderers for CV, Portfolio, Projects display,
  Badges, VersionDisplay, NavBarLinks/GitHubLinks, GitHubInfo, and a controlled
  ThemeSwitcher;
- optional Giscus, browser, `subzerodev-data-json`, and Docusaurus entrypoints;
- package-owned versioned view models, schemas, typed validation results, typed
  data-resolution errors, deterministic selectors, and safe empty states;
- an explicit CSS entrypoint whose DOM, class, token, and selector surface is
  semver-governed;
- an opt-in legacy Docusaurus-template compatibility stylesheet and wrappers
  that preserve the current template while it migrates;
- a phased extraction path that does not change `Docusaurus-Template` until the
  package has parity fixtures and a packed-consumer test.

## Ownership boundary

Consumers own raw JSON models and their validators, every data value, product
copy, routes, link construction, icon and asset selection, feature flags,
branding overrides, source identifiers and source maps, cache policy, hosting,
and deployment.

The package owns the public view models accepted by its renderers, validation
of those models, the timing and reporting contract of optional resolution
adapters, projection and selector behavior, reusable rendering, safe defaults,
and its DOM/CSS/export surface.

An adapter therefore has two validation boundaries: the consumer validator
earns the raw consumer type; after projection, the package validator earns the
view-model type the renderer consumes. Neither boundary may be replaced by a
cast.

## In scope

- CV display, including timeline and technology presentation
- Portfolio display and its project/technology cross-view projections
- non-admin Projects browsing, searching, filtering, sorting, and URL-state
  integration as an optional browser concern
- Badges processing and display
- VersionDisplay
- NavBarLinks and GitHubLinks composition
- GitHubInfo display
- Giscus rendering as an optional integration
- controlled theme selection and optional browser stylesheet application
- DataProvider replacement, reusable hooks/selectors, schemas, public types,
  CSS, accessibility, SSR, packaging, and compatibility fixtures

## Non-goals

- product JSON content or generated data
- YAML authoring, conversion, watching, or pre-build behavior
- source-map authoring or hard-coded source ids/URLs/cache policies
- Projects administration, editing, bulk actions, drag/drop, authentication,
  API calls, storage, sync, or audit history
- Docusaurus pages, theme swizzles, site configuration, or feature policy
- deployment, hosting, GitHub Pages workflows, analytics, or publishing
- changing `Docusaurus-Template` during this design phase
- preserving accidental bugs, dead files, schema/type drift, unsafe raw HTML,
  global CSS collisions, or inferred `/projects` and `/demos/*` routes

## Definition of done

The new repository has an approved public contract and implements it in
independently consumable entrypoints. Pure consumers install no Docusaurus,
Giscus, or Data.Json dependency. All validators have positive and exhaustive
negative coverage. Root renderers are SSR-safe and deterministic. CSS and DOM
fixtures enforce their namespaces and documented structure. A packed tarball
works in React 18 and React 19 fixtures. A Docusaurus fixture demonstrates
explicit opt-in parity without inferred routes. Only then may a separate
consumer change migrate `Docusaurus-Template` one wrapper at a time.
