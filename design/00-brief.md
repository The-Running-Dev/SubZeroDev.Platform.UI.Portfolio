# Portfolio Builder brief

## Problem

The current Portfolio site is assembled by overlaying a small consumer checkout
onto a Docusaurus template. Its effective CV, Portfolio, Projects, navigation,
and visual behavior are therefore coupled to the template runtime, generated
consumer data, and a deployment image whose contents are not recorded in the
consumer repository. `SubZeroDev.Platform.UI.LandingPage` already supplies an
auditable Node/Vite build, preview, merge, package, documentation, and delivery
process, but its README/changelog site model does not render the Portfolio.

Create `subzerodev-platform-ui-portfolio` by transferring that delivery process
onto a Portfolio-specific React/Vite builder. The builder reproduces the
effective Portfolio presentation from a recorded clean overlay baseline while
leaving Portfolio data, copy, branding, links, route composition, hosting, and
deployment choices outside the package.

## Required outcome

The package provides:

- a root React surface of strict, versioned Portfolio view models, validators,
  pure renderers, deterministic selectors, and namespaced styles;
- separate Node/Vite builder, browser, and Data.Json entrypoints;
- `build`, `dev`, `preview`, `check`, and `merge` commands; package
  documentation; a composite action; and a reusable Pages workflow adapted from
  the clean LandingPage baseline;
- an explicit Portfolio site configuration that declares routes, metadata,
  source timing, consumer raw validation, projection, package validation,
  styles, navigation, and branding capabilities;
- build-time and browser-time source resolution that validates before rendering,
  preserves explicit fallback provenance, and collects failures in declaration
  order; and
- provenance recording for the LandingPage baseline, Portfolio baseline, and
  effective template-overlay inputs used to derive the implementation.

## Ownership boundary

Consumers own every product value and raw type, source identifier and source
map, cache/refresh policy, copy, visual branding, assets, icon selection, route
composition, links, host, credentials, and deployment decision. A consumer
configuration declares every route beyond `/` and supplies every cross-route
destination.

The package owns the builder's control flow, the public Portfolio view models,
validation of those models, projection timing and failure reporting, reusable
presentation, safe defaults, the package DOM/CSS/export surface, and the
auditable delivery mechanics. A consumer raw validator earns `TRaw`; its
projection returns a package candidate; the package validator earns the view
model. A cast cannot replace either validation boundary.

## In scope

- Porting the effective Portfolio overlay's masthead, CV, portfolio,
  viewer-only Projects, enabled supporting controls, and visual behavior to
  React/Vite without Docusaurus runtime imports
- explicit per-source `build` or `browser` timing with validated external data
- static build, development, preview, validation, merge, packed-consumer,
  documentation, action, and reusable delivery workflows
- strict model validation, explicit fallback, SSR/hydration, accessibility,
  DOM/CSS namespace, visual-parity, and dependency-isolation fixtures
- a recorded extraction provenance manifest

## Non-goals

- embedding Portfolio JSON, authored YAML, generated data, remote URLs, copy,
  branding, routes, icons, assets, credentials, or hosting defaults
- README/changelog generic-site modes, arbitrary LandingPage adapters, and
  their public compatibility promise
- Docusaurus runtime dependencies, theme swizzles, private framework APIs, or
  global Infima CSS ownership
- Projects administration, editing, bulk actions, drag/drop, authentication,
  API mutation, storage, sync, or audit history
- silently accepting invalid input, partial source sets, implicit fallback,
  inferred `/projects` or `/cv` routes, or unsafe raw HTML
- modifying `SubZeroDev.Platform.UI.LandingPage` or `Portfolio`, migrating the
  Portfolio consumer, publishing an npm version, deploying, or merging a pull
  request as part of this work

## Definition of done

The package is built from the recorded clean LandingPage and effective Portfolio
baselines, is installable as a packed tarball, and has no Docusaurus dependency
in its runtime graph. The builder validates build-time sources before rendering
and browser-time sources before hydration; every exported validator has positive
and rejection coverage; failures are ordered and visible; and no renderer
receives partial or unvalidated data. The current Portfolio route set is proven
through an explicit consumer fixture, while a root-only fixture proves no route
is inferred. React 18 and 19 SSR/hydration, accessibility, DOM/CSS namespace,
visual parity, action/workflow, and delivery checks pass. No source repository,
consumer site, hosted deployment, or npm registry state changes.
