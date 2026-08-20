# Decisions

### 2026-08-20 — Preserve the populated design chain during AgentKit installation

Context: the repository already held complete brief, design, contract, slice,
and decision documents at the paths where AgentKit supplies empty seeds.

Chosen: retain the existing content of all five repository documents, add only
the required installation decisions to this log, and treat the seed's
scaffolding role as already fulfilled.

Rejected: **replace the documents with the kit seeds** — it destroys the
authoritative project design. **merge seed placeholders into the documents** —
it duplicates structure without adding project information.

Reversibility: expensive. Lost design reasoning cannot be reconstructed from
empty scaffolding.

### 2026-08-20 — AGENTS.md remains the project contract and receives kit operations

Context: `AGENTS.md` already held the Portfolio-specific ownership, public
surface, safety, and release rules, while the kit commands depend on operational
rules that were absent.

Chosen: preserve the project-specific contract verbatim, add the missing kit
operational sections, keep the target wording where subjects overlap, and use
`CLAUDE.md` only as the kit's pointer to `AGENTS.md`.

Rejected: **leave AGENTS.md unchanged** — installed commands would lack their
operating contract. **replace it with the kit copy** — it discards rules written
against this package. **make CLAUDE.md the content owner** — it reverses the
existing direction without a project reason.

Reversibility: moderate. The merge is textual, but every agent session depends
on the resulting contract.

### 2026-08-20 — Enable both AgentKit session-measurement hooks

Context: PowerShell 7 is available and no target settings file or existing hook
occupies either supported event.

Chosen: create `.claude/settings.json` with only the approved `SessionEnd` and
`UserPromptSubmit` hooks for `tools/Measure-Session.ps1`.

Rejected: **install the tool without hooks** — measurement and prompt-size
warnings would require manual invocation and would usually be missed.

Reversibility: cheap. Removing the two hook keys disables the behavior.

### 2026-08-20 — Skip Codex profiles without repository evidence

Context: the first-install tree had no `.codex/` directory or profile reference,
and AgentKit treats profiles as opt-in.

Chosen: do not install `codex/PROFILES.md`.

Rejected: **install profiles by default** — it adds configuration for a usage
mode the repository has not declared.

Reversibility: cheap. A later install can add the file when the repository
declares Codex profile use.

### 2026-08-19 — The package owns view models, not consumer product models

Context: the embedded views need stable inputs, while the LandingPage identity
and this task keep product JSON, copy, and branding consumer-owned. Copying the
current CV/Portfolio/Projects TypeScript types would also canonize known drift
against their validators.

Chosen: consumers validate their raw types and project them into strict,
versioned package view models. The package validates that projection and owns
only the semantics required to render it.

Rejected: **copy the authored YAML schemas into the package** — it turns one
consumer's content organization into the shared product contract. **Accept any
object and let renderers probe fields** — it reproduces unchecked casts and
runtime crashes. **Make the view props wholly generic** — React markup still
needs a stable semantic structure, so it hides rather than removes the model.

Reversibility: expensive. Model ownership determines every adapter and export.

### 2026-08-19 — Validation has two mandatory boundaries

Context: Data.Json resolves `unknown` and has no validator parameter in the
React hook. Existing hooks validate afterward but cast results into models that
do not match the schemas. A consumer type and a package view contract answer
different questions.

Chosen: the required consumer validator earns `TRaw`; projection returns
`unknown`; the package validator earns the view model. Both complete before
render. Every exported validator has positive and branch-complete negative
tests.

Rejected: **package validation only** — it forces the package view model to
become the consumer's source model. **consumer validation only** — a projection
bug can still create an invalid render input. **optional validators/casts** — a
generic type would become a promise no runtime check earned.

Reversibility: expensive. Removing either boundary weakens the public safety
contract.

### 2026-08-19 — Pure renderers are the root package surface

Context: every current top-level view mixes rendering with at least one of
generated data, feature flags, remote hooks, Docusaurus APIs, browser state, or
admin code. Those dependencies prevent reuse and make failure semantics differ
by component.

Chosen: root renderers receive validated view models and explicit capabilities.
They do no I/O and are SSR-safe. Optional behavior lives in separate entrypoints.

Rejected: **copy current facades and configure them** — importing them still
pulls the consumer application into the library. **publish only hooks and leave
views in Docusaurus** — it extracts loading but not the reusable rendering the
task exists to own.

Reversibility: expensive. This is the dependency direction of the repository.

### 2026-08-19 — Data.Json integration is optional and loader-neutral

Context: the template constructs a singleton loader from generated
`sourcesPublic`, falls back to an empty map on configuration failure, hard-codes
three feature/source mappings, and exposes no construction port. Portfolio and
Projects already bypass its generic DataProvider for direct hooks.

Chosen: `./data-json` requires explicit source declarations and uses the
consumer's provider. It never imports a generated map, constructs a singleton,
or assumes source ids. Refresh requires an explicit invalidator capability.

Rejected: **move `getJsonLoader` into the package** — source maps, ports, and
cache policy are consumer-owned. **make Data.Json a root peer** — pure renderer
consumers would pay for an integration they do not use. **silently substitute an
empty map** — a configuration defect would look like unrelated unresolved data.

Reversibility: moderate. The optional adapter can grow, but moving ownership
back to a singleton would be breaking.

### 2026-08-19 — Resolution exposes tagged states and explicit fallback

Context: the current DataProvider can pass fallback data and an error together,
and callers interpret the pair differently. The loader's empty-map fallback is
silent except for console output. VersionDisplay invents a separate hard-coded
error value.

Chosen: use `idle`, `loading`, `ready`, `fallback`, and `error` states. Only
explicit, validated fallback yields `fallback`, and the primary error remains
attached. Default loading/error/empty UI is `null` because copy is consumer-owned.

Rejected: **retain the render-prop tuple** — invalid combinations remain
representable. **always prefer fallback data** — failure becomes invisible.
**always fail even with declared fallback** — it removes a useful explicit
policy the consumer can own.

Reversibility: expensive once consumers branch on stable states and codes.

### 2026-08-19 — Viewer-only Projects is extracted; administration is not

Context: the current Projects and ProjectsManager files combine browsing with
authentication, admin detection, API mutation, editing, bulk delete, storage,
keyboard shortcuts, drag/drop, and admin CSS. Even `ProjectsDisplay` delegates
to that mixed facade.

Chosen: extract only viewing, deterministic processing, filtering, search,
sorting, and optional URL state. No admin prop or type exists in the package.

Rejected: **keep `isAdmin` but omit implementation** — it reserves an
unsupported public seam. **extract admin into another optional entrypoint** —
administration, authentication, API, and storage are explicit non-goals.
**treat current ProjectsDisplay as pure** — its only child imports the mixed
manager graph.

Reversibility: cheap to remain excluded; adding administration later would
require a new brief and contract.

### 2026-08-19 — Cross-route navigation is an explicit consumer capability

Context: Portfolio and CV generate `/projects?filter=...`, and default navbar
data names `/demos/*`. `Docusaurus-Template/AGENTS.md` says only `/` is
guaranteed for downstream consumers and broken links fail builds.

Chosen: core renders inert content unless the caller supplies an href/link
factory. Docusaurus wrappers also require that capability. In-page fragment
navigation remains allowed and instance-scoped.

Rejected: **default to `/projects` for compatibility** — it breaks consumers
without that route. **default to `/`** — safe as a destination but semantically
false for a technology filter. **hide the item entirely** — non-link content is
still useful and preserves information.

Reversibility: expensive in the unsafe direction; adding an inferred route
later would violate P11.

### 2026-08-19 — Giscus, browser behavior, and Docusaurus use separate exports

Context: Giscus brings `@giscus/react`; theme and projects controllers use DOM
state; Docusaurus wrappers need framework APIs. The existing Giscus directory
has shadowed competing implementations and ThemeSwitcher imports a private
Docusaurus path.

Chosen: publish `./giscus`, `./browser`, and `./docusaurus` separately. Root has
no imports from them. Docusaurus uses public APIs only.

Rejected: **one root barrel exporting everything** — ordinary imports may pull
optional peers into resolution/bundles. **leave wrappers only in the template**
— repeated Docusaurus mechanics would remain duplicated, though consumer data
imports still correctly remain in the template. **use private Docusaurus
exports** — patch releases may move them without public compatibility promises.

Reversibility: moderate. New optional exports can be added, but merging them
into root is breaking for dependency isolation.

### 2026-08-19 — FontAwesome is a consumer icon adapter, not a core type

Context: Badges conflates serialized icon strings with `IconDefinition`, and
NavBar dynamically imports complete solid/brand registries. Raw JSON cannot
contain React library objects.

Chosen: models carry stable consumer icon keys and renderers accept an icon
resolver returning React content. Docusaurus/template wrappers may resolve
FontAwesome names.

Rejected: **make FontAwesome a required peer** — it dictates consumer branding
and enlarges the root graph. **ship a fixed internal registry** — the list and
tree-shaking become package policy. **drop icons** — it loses a supported visual
capability unnecessarily.

Reversibility: moderate. An optional icon adapter can be published later.

### 2026-08-19 — Safe text is the default; legacy HTML is an explicit renderer

Context: CV currently injects `about.body`, `quote`, role summaries, and
achievements with `dangerouslySetInnerHTML`, including data that may arrive over
HTTP. Ordinary string types carry no trust/sanitization evidence.

Chosen: core renders strings as text. A consumer can supply a rich-text renderer
through an explicit prop; the legacy template wrapper may opt into its existing
trusted behavior during migration.

Rejected: **continue raw injection** — remote content becomes an implicit HTML
execution surface. **sanitize inside core** — it adds a policy/dependency and
changes supported markup without a product requirement. **remove rich text
entirely** — an explicit seam preserves the capability and its ownership.

Reversibility: moderate. A package-owned rich-text policy could be added only as
a separately contracted mode.

### 2026-08-19 — Core DOM and CSS are fully namespaced and semver-governed

Context: current CSS uses generic `.container`, `.stats`, `.projectCard`,
`.active`, shared Portfolio/Projects names, inline styles, and Infima tokens.
GitHubLinks CSS is dead. LandingPage already treats owned DOM/CSS as public API.

Chosen: all owned classes/tokens/keyframes use `szd-portfolio-`; core CSS has no
global selectors or Infima requirement. Complete generated DOM and CSS manifests
govern additions as well as removals.

Rejected: **preserve old class names in core** — collision risk becomes the new
package contract. **CSS Modules with opaque hashes** — consumers lose a stable
theming API. **tokens only, DOM private** — consumers and accessibility tests
still depend on the emitted structure.

Reversibility: expensive after publication.

### 2026-08-19 — Legacy Docusaurus parity is opt-in and temporary

Context: compatibility-preserving migration is required, but preserving old
classes in core would freeze accidental global structure. Existing consumers
need time to move without a single large template rewrite.

Chosen: Docusaurus wrappers may append documented legacy classes and consumers
may import `legacy-docusaurus.css`. Old template modules become re-export shims
for at least one template release after migration begins.

Rejected: **instant cutover to new DOM** — creates a high-risk visual migration.
**permanent legacy aliases in core** — every accidental selector becomes an
eternal package obligation. **copy old CSS unchanged** — it retains global
collisions and admin leakage.

Reversibility: moderate before consumer migration; expensive after consumers
adopt the compatibility surface, so removal requires a breaking template
release.

### 2026-08-19 — CSS is imported explicitly and JavaScript stays side-effect-free

Context: embedded components import CSS implicitly, which is convenient inside
one Docusaurus build but removes ordering/control from library consumers and
complicates server rendering.

Chosen: publish explicit `styles.css` and `legacy-docusaurus.css` exports.
JavaScript does not auto-import either. CSS exports alone are marked as side
effects.

Rejected: **auto-import core CSS from each component** — duplicate/order
behavior depends on bundler traversal. **CSS-in-JS** — introduces runtime style
ownership and a new dependency. **unstyled-only components** — gives up the
reusable rendering contract being extracted.

Reversibility: moderate; auto-importing later would add a surprising side
effect.

### 2026-08-19 — Time and locale dependencies are explicit

Context: VersionDisplay uses today's date, CV treats the current year as
“Present”, and Projects computes recency/relative text from `new Date()` and
implicit locale behavior. Snapshot and SSR results can drift by day and locale.

Chosen: version has no clock fallback. Date-sensitive selectors accept a clock;
labels and relative-time formatting are caller values/functions. Browser
controllers sample their default clock once.

Rejected: **document nondeterminism** — it remains a hydration/test hazard.
**force UTC English formatting in core** — locale and copy are consumer-owned.

Reversibility: moderate. Convenience formatters can be added as explicit
utilities later.

### 2026-08-19 — First release has a small, fixed export map

Context: the component tree contains many barrels exposing internal helpers
“for external use if needed,” duplicate implementations, and dead CSS. Each
subpath is a compatibility obligation.

Chosen: publish root, browser, data-json, docusaurus, giscus, styles, and legacy
styles only. Per-component internal paths are blocked by package exports.

Rejected: **one subpath per current component directory** — it preserves file
layout rather than a deliberate API. **root only** — optional peers cannot be
isolated cleanly. **export every tested helper** — tests do not define consumer
need.

Reversibility: cheap to add a justified export; removing one is breaking.

### 2026-08-20 — Reframe the package as a Portfolio-specific static builder

Context: the original design targeted a reusable React view library with no
deployment surface. The approved implementation direction instead transfers the
clean LandingPage delivery process into this repository, replaces its generic
README/changelog model with Portfolio rendering, and ports the effective
Portfolio overlay from Docusaurus to React/Vite.

Chosen: retain external ownership of Portfolio content, copy, routes, branding,
credentials, hosting, and deployment choice; add an auditable builder and
delivery surface; and use a pure React root with Node/Vite, browser, and
Data.Json integrations outside that graph. The clean LandingPage `origin/main`
commit after UI12 and a recorded effective Portfolio overlay are the required
implementation evidence.

Rejected: **keep the view-library-only brief** — it cannot own the requested
build and delivery process. **copy Portfolio content into the package** — it
would make current consumer data and branding a package default. **retain
LandingPage's generic README/changelog modes** — it expands the public contract
instead of replacing it with the requested Portfolio model. **retain
Docusaurus at runtime** — it would couple the new builder to the framework the
port is meant to remove.

Reversibility: expensive. The product identity determines exports, dependencies,
documentation, test fixtures, and the repository's delivery responsibility.

## Open

None.
