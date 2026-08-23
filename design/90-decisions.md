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

### 2026-08-20 — Version one is the effective enabled Portfolio surface

Context: the reset replaces a broad reusable-view inventory with the effective
Portfolio presentation. The clean consumer configuration enables the masthead,
Portfolio, CV, viewer-only Projects, version display, text sizing, and reader
mode while disabling several components the previous design intended to
publish.

Chosen: version one contains site chrome, Portfolio, CV, viewer-only Projects,
version display, controlled text sizing, controlled reader mode, and the fixed
declared Portfolio style capability. Docusaurus, Giscus, Badges, GitHub panels,
theme switching, template documentation/demo pages, and administrative surfaces
are excluded. This supersedes the 2026-08-19 Docusaurus/Giscus export, legacy
parity, and fixed export-map decisions, plus the explicit-CSS decision's legacy
stylesheet portion, only where they name the old first-release surface; their
dependency-isolation and explicit-core-style reasoning remains retained.

Rejected: **keep every old planned renderer** — it expands the reset beyond the
effective enabled site. **copy every route inherited from the template image** —
incidental template pages become product contract. **drop reader mode and text
sizing** — it fails parity with controls the current Portfolio enables.

Reversibility: moderate. A later feature can be added through a new brief and
contract, but removing a published renderer is breaking.

### 2026-08-20 — Site configuration is executable, closed, and route-explicit

Context: one configuration must declare raw validators, projections, render
capabilities, routes, styles, navigation, and branding. Validators and
projections are executable, while source data may be remote and untrusted.

Chosen: load one eagerly validated consumer module with a closed
Portfolio-specific capability set. Emit one static document per explicit route;
the package infers no route and accepts no arbitrary Vite plugin in version one.

Rejected: **a remote JSON/YAML model naming adapters** — fetched data would
select executable code. **an inferred client router** — route existence and
metadata stop being build-time facts. **unrestricted Vite plugins** — plugins
can redirect output, widen filesystem access, and bypass public DOM guarantees.

Reversibility: expensive. Configuration shape and route identity govern every
consumer and artifact.

### 2026-08-20 — Browser sources settle before matching-shell hydration

Context: the brief requires per-source build/browser timing, validation before
render or hydration, no partial source sets, and React hydration parity. A
browser value cannot be known during static rendering.

Chosen: build-timed sets settle before SSR. A browser-dependent composition
server-renders a deterministic unresolved boundary; the browser settles and
validates the complete set before hydrating that same boundary, then publishes
the settled ready, explicit-fallback, or error result immediately after the
hydration commit. Refresh generations are ordered, and only the newest may
publish.

Rejected: **progressive per-source rendering** — completion order becomes
visible and composition sees partial input. **hydrate first and validate later**
— it violates the required validation boundary. **client-only mounting** — it
abandons the hydration proof. **fetch during SSR** for browser-timed data — it
silently changes the consumer's timing policy.

Reversibility: expensive. The bootstrap and resource-state lifecycle are public
runtime behavior.

### 2026-08-20 — Provenance is an immutable three-role manifest

Context: the effective Portfolio is produced from a consumer overlay and
mutable container tags, while the builder mechanics come from another
repository. Names, branches, and latest tags cannot reproduce the bytes used for
parity.

Chosen: record delivery mechanics, consumer overlay, and effective
template-overlay roles with immutable commits or image digests, clean-tree
proof, file inventories, content digests, ordered overlay/exclusion rules, and
the resulting tree digest. The clean LandingPage delivery baseline is commit
77209c6. Parity fixtures bind to the manifest identity.

Rejected: **repository names and mutable tags only** — the same record can later
resolve to different content. **copy evidence without a manifest** — origin and
exclusions become unauditable. **embed product data in provenance** — it crosses
the consumer ownership boundary.

Reversibility: moderate. A deliberate new baseline creates a new manifest
identity; an old artifact remains attributable to the old identity.

### 2026-08-20 — Build and merge promote verified staging trees

Context: the LandingPage baseline clears output before building and detects a
protected merge change after copying. Both approaches can leave the last
known-good tree partially destroyed, and neither prevents two writers racing.

Chosen: build and merge use sibling staging trees, complete verification, a
single-writer lease, and promotion with explicit rollback/recovery state. The
authoritative target changes only at promotion; an ambiguous interrupted
promotion blocks later writers instead of being cleaned automatically.

Rejected: **clear and write in place** — a late failure destroys the prior
artifact. **copy then fingerprint** — detection occurs after mutation.
**unguarded concurrent writers** — interleaving can make an artifact no
invocation produced.

Reversibility: moderate. Removing staging is mechanically simple but weakens
the failure and concurrency guarantees; the retained cost is disk space and
copy time.

### 2026-08-20 — Reader mode and text size are controlled browser capabilities

Context: both controls are enabled in the current Portfolio, but their
Docusaurus implementations own global Infima selectors, hard-coded storage
keys, DOM polling, and history monkey-patching.

Chosen: pure controlled renderers own accessible UI and package-namespaced
states. The browser entrypoint applies declared tokens and persists stable
choice ids through caller-supplied DOM/storage ports after hydration.

Rejected: **copy the global implementations** — Docusaurus mechanics and
host-global CSS become package behavior. **remove the controls** — the port
loses enabled presentation. **put DOM/storage access in root** — SSR and
dependency isolation fail.

Reversibility: moderate. New browser adapters are additive; moving effects into
root would be breaking.

### 2026-08-21 — Command paths and local addresses are explicit

Context: the builder requires one explicit configuration per invocation and
leaves host and deployment policy with the consumer. Conventional working
directory, configuration filename, output directory, host, or port defaults
would become public behavior that varies across consumers and tools.

Chosen: every CLI path, host, and port option is required. The repeatable
protected-path option remains optional because an empty protected set is an
explicit merge policy. Relative paths follow the resolution rules in the
public contract; no working-directory discovery selects configuration or
output policy.

Rejected: **conventional path defaults** — current-directory, configuration
filename, and output-directory assumptions become semver-governed policy.
**loopback and fixed-port defaults** — they improve local brevity but silently
select a host and may collide with another service. **environment-derived
defaults** — invocation behavior depends on ambient state not named by the
caller.

Reversibility: moderate before publication and expensive afterward. Adding a
default later changes accepted invocation behavior; removing a published
default is breaking.

### 2026-08-21 — Pre-publication exports materialize incrementally

Context: the version-one contract describes the complete first published
surface, while each implementation slice must leave the package buildable and
testable without absorbing later slices. S10 needs a real packed root and core
stylesheet to verify the Portfolio surface, but it does not implement the
builder, browser, Data.Json, or remaining root declarations.

Chosen: before the first publication, the export map contains only entrypoints
materialized by completed slices. Unmaterialized declarations remain canonical
contract scaffolds rather than runtime placeholders. S10 exposes only `.` and
`./styles.css`, with the root limited to its contracted Portfolio subset.

Rejected: **materialize the complete version-one surface in S10** — it moves
later slices into the first rendering slice and defeats the accepted slice
boundaries. **publish throwing placeholders for later entrypoints** — an export
would exist without usable behavior and could be mistaken for implemented API.
**withhold all package exports until version one is complete** — it prevents
packed-consumer and dependency-isolation evidence from being established
incrementally.

Reversibility: cheap before S10 lands. Afterward, reversing requires either
invalidating its accepted package evidence or moving later-slice work into S10;
the policy creates no compatibility promise after the first publication.

### 2026-08-21 — Link destination selection is capability-local

Context: S10 requires deterministic Portfolio selectors to emit no destination
for a technology or project whose link capability has no `href`. The contract
defined that behavior but no public selector signature.

Chosen: expose `selectLinkDestination`, accepting a `LinkCapabilityV1` and
returning `string | undefined`. It returns the already-validated href unchanged
or `undefined` and does not traverse a Portfolio model, normalize a destination,
or infer a route.

Rejected: **select every destination from a complete Portfolio model** — it
couples a small eligibility rule to one renderer's traversal and produces a
larger projected result. **leave eligibility inside renderers only** — it does
not satisfy the contracted selector criterion and invites duplicate behavior.

Reversibility: cheap before publication and breaking afterward because the
function name and signature are part of the root export.

### 2026-08-21 — Builder provenance is selected by the package version

Context: S11 requires every build to validate the recorded extraction
provenance, but neither the public configuration nor the explicit command
arguments identify a manifest. Allowing implementation to invent a lookup rule
would make artifact identity depend on uncontracted process state.

Chosen: each installed builder package carries one tracked three-role manifest
and resolves it relative to its own implementation. The executing package
version selects that evidence; consumer configuration, command arguments, the
working directory, the consumer root, and environment variables cannot replace
it. Normal operations validate the bundled record offline, while deliberate
maintainer capture produces a new record for a later package build.

Rejected: **add a manifest path to consumer configuration** — it assigns the
package's implementation provenance to the consumer and lets equal package and
configuration versions select different derivation evidence. **add a required
CLI argument** — it creates the same substitution seam and expands every
provenance-validating command. **discover a path from the working directory or
consumer root** — invocation location becomes hidden policy and a packed
consumer can resolve different evidence from the same package.

Reversibility: moderate. A future consumer-selectable provenance input would
add public configuration or command surface and would require artifacts to
distinguish package evidence from caller-supplied evidence.

### 2026-08-21 — The browser entrypoint owns the route hydration transition

Context: S12 requires browser sources to settle before matching-shell hydration
and permits publication only after that hydration commits. The existing
browser-source gate scaffold exposed snapshots, refresh, subscription, and
disposal but no operation that could own or prove the settle, hydrate, and
publish ordering.

Chosen: `./browser` exposes one route-level coordinator that validates the
shared root bootstrap contract, matches its ordered browser source ids to
explicit source definitions, settles the complete set, hydrates the compiler's
unresolved boundary, combines the revalidated build models with the settled
browser models in declared composition order, and publishes one aggregate
result from the hydration commit. The coordinator also owns refresh generations
and disposal. Builder and browser remain sibling entrypoints; the bootstrap
schema and validator live in root rather than making either optional entrypoint
import the other.

Rejected: **expose only a low-level source gate** — generated client code would
own the critical ordering and could publish before commit. **put the complete
coordinator only in generated code** — the lifecycle would have no reusable or
directly testable package surface. **make browser import builder for bootstrap
validation** — Node/Vite dependencies could enter the browser graph and the
optional entrypoints would no longer depend inward independently.

Reversibility: moderate before publication and expensive afterward. The
coordinator, aggregate states, bootstrap ownership, and lifecycle errors become
semver-governed browser behavior.

### 2026-08-22 — Projects sort choices are a small, package-recognized enum

Context: `ProjectsViewModelV1.sortChoices` declares `{id, label}` pairs and
`ProjectsQueryV1.sortChoiceId` selects one, but the contract left the actual
reordering behavior for a given id undefined — the type alone cannot say what
"newest" or any other id does to project order, and S14.2 requires an exact,
deterministic result.

Chosen: `filterProjects` recognizes a closed set of two sort ids it implements
itself — `"newest"` (ongoing projects first, then by declared period end/start
descending) and `"title"` (ordinal ascending, no locale comparison, per the
existing "time and locale dependencies are explicit" decision). A consumer's
`sortChoices` entry must use one of these ids or `validateProjectsViewModelV1`
rejects it as `view.unknown_sort_choice`; an unrecognized `sortChoiceId` on a
query (e.g. from a stale saved preference) falls back to declaration order
rather than throwing, consistent with S14.4's unknown-saved-choice recovery.

Rejected: **no built-in semantics** — leaves sorting entirely to the consumer
and makes `sortChoices`/`sortChoiceId` decorative rather than functional;
asked and rejected in favor of the fixed enum. **open consumer-defined sort
ids with a comparator capability** — adds a function-typed contract field and
a new capability boundary this slice's acceptance criteria do not call for.

Reversibility: moderate. Adding more recognized sort ids later is additive;
changing "newest"'s or "title"'s ordering after a release is a compatibility
break under P16.

### 2026-08-23 — Kit sync 9911712: adopt two upstream AGENTS.md changes verbatim

Context: `/kit-sync` fast-forwarded `~/.agent-kit` from `ba2fe6e` (2026-08-21) to
`9911712` (2026-08-22), 11 commits. Diffing the kit's `AGENTS.md` at both shas
isolated exactly two upstream changes not yet present in this repository's copy
(the rest of the byte-diff was this repository's own pre-existing project
content, already reconciled at the 2026-08-20 install).

Chosen: add the `/install-code-review-agent` row to the Command routing table,
and update the PR-opening carve-out sentence to name `/install` and `/kit-sync`
(via `INSTALL.md` phase 4 step 8) and exclude `/install-all`, matching the
kit's current wording verbatim.

Rejected: **skip either change** — both reflect real upstream behavior (a new
command, and this very sync command now opening PRs), so skipping would leave
the contract silently stale rather than deliberately customized.

Reversibility: cheap. Both are additive/textual with no dependents elsewhere
in this file.

## Open

### 2026-08-23 — Data.Json 0.2.0 cannot install beside React 19

Found while reviewing S16. `subzerodev-data-json@0.2.0` declares an optional
`react` peer of `^18.3.0`, and npm enforces an optional peer whenever the
package is present in the tree. Installing it beside this package on React 19
therefore fails with `ERESOLVE`, and only `--legacy-peer-deps` or `--force`
gets past it. Reproduced against `react@19.2.8` and `react-dom@19.2.8`.

This package advertises React `^18.0.0 || ^19.0.0`, and the contract makes the
Data.Json range a release input verified against installed declarations and
packed fixtures. Both cannot hold at once, so the `./data-json` entrypoint is
in practice React 18 only until the upstream peer range widens.

The S16 packed fixture originally passed `--legacy-peer-deps`, which hid this
entirely; it is now pinned to React 18.3.1 so the install it verifies is
genuinely peer-clean. That made the fixture honest without removing the
constraint.

Needs a decision before the first release: widen the peer range in the
Data.Json repository, narrow the React range this package advertises, or state
the combination as React 18 only. The middle option changes a compatibility
promise and belongs to `/contract`.
