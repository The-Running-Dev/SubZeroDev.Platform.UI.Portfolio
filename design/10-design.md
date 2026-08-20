# Portfolio Builder architecture

This design replaces the earlier view-library architecture after the brief's
approved reset to a Portfolio-specific static builder. The reusable view-model,
validation, route-safety, SSR, and dependency-isolation decisions remain; the
old Docusaurus compatibility surface and generic component inventory do not.

The implementation evidence has three roles: the clean LandingPage delivery
baseline supplies process mechanics, the Portfolio repository supplies
consumer-owned overlay values, and the effective template-overlay build
supplies the presentation being ported. Evidence is never imported as an
unversioned dependency or treated as authority for consumer data ownership.

## Data model

Exact declarations become canonical in the implementation. The fields below
state the semantic information the architecture requires while no declaration
yet exists.

### Portfolio site configuration

One executable, consumer-owned configuration describes one site invocation. It
is loaded as code because validators, projections, render capabilities, and
icon/link adapters are functions; it is not fetched as JSON and never names a
module to execute from remote data.

| Field | Semantic type | Ownership and lifecycle |
| --- | --- | --- |
| configuration version | positive integer | Package-owned compatibility discriminator; validated at load and held in memory |
| routes | ordered, non-empty route declarations | Consumer-owned; order is retained for deterministic diagnostics and artifact records |
| sources | ordered source declarations | Consumer-owned identifiers and policies; package-owned validation and orchestration |
| metadata | explicit site and route metadata | Consumer-owned copy and URLs; absence stays absent |
| presentation | enabled renderer and control declarations | Consumer-owned feature choice using package-owned view contracts |
| styles | ordered style and token capabilities | Consumer-owned branding values and assets; package-owned namespace and cascade rules |
| navigation | explicit link and route capabilities | Consumer-owned destinations; the package derives no cross-route URL |
| public assets | declared asset capabilities | Consumer-owned bytes and identities; validated and contained before use |
| deployment values | optional base path, canonical address, and documentation destination | Consumer-owned and invocation-scoped; no host or deployment decision is defaulted |

Exactly one configuration exists per command invocation. It has no persisted
identity of its own. A canonical digest of its serializable declarations and
the package contract version identifies the configuration in a built artifact;
functions, secrets, headers, and raw source payloads are excluded from that
digest record.

The configuration admits only Portfolio-specific capabilities. It does not
accept arbitrary bundler plugins in version one. A plugin is executable build
policy and could redirect output, widen filesystem access, or mutate the public
DOM outside the package contract; any future plugin seam therefore needs its
own contract and decision.

### Route declaration

A route is the addressable unit of a built site. Its normalized path is its
identity, uniqueness key, navigation target, and output-document location.

| Field | Semantic type | Derivation and persistence |
| --- | --- | --- |
| path | normalized absolute site path | Consumer-declared; validated for uniqueness and containment; persisted as one static document |
| metadata | title, description, and optional explicit social metadata | Consumer-declared; emitted only when present |
| presentation | one package-owned route renderer with validated options | Consumer-declared capability; retained in the client bundle when hydration is enabled |
| required sources | ordered source-identity list | Consumer-declared; resolved to declarations before rendering |
| hydration policy | build-only or browser-gated | Derived from source timing and renderer needs; cannot weaken source validation |

Only declared routes are emitted. The root route is the only path the package
may require; the current Portfolio route set is a consumer fixture, not a
package default. No inherited template page, demo route, documentation route,
Portfolio route, Projects route, or CV route exists unless that fixture
declares it.

### Source declaration

A source declaration is identified by a consumer-owned id unique within the
configuration.

| Field | Semantic type | Ownership and lifecycle |
| --- | --- | --- |
| id | non-empty stable string | Consumer-owned identity; safe diagnostic context, never a URL inference |
| timing | build or browser | Consumer-owned resolution choice; immutable for one invocation |
| resolver input | provider-owned source capability | Consumer-owned map, URL, cache, and refresh policy; credentials never enter public output |
| raw validator | unknown to consumer validation result | Consumer-owned; earns the raw type without throwing |
| projection | validated raw value to unknown candidate | Consumer-owned; package catches a thrown projection |
| view validator | unknown to package validation result | Package-owned; earns the renderer's versioned view model |
| fallback | absent or an explicit view-model candidate | Consumer-owned policy; package-validated and never implicit |

Declarations persist only as consumer source. During a build they become
in-memory resolution records. Browser declarations are compiled into the
browser entry as code; only a public, credential-free provider description may
be serialized into a document.

### Portfolio view models

Package-owned view models are strict, versioned objects. Their identities are
their model family plus version, not the source that produced them. Unknown
fields and unsupported versions fail. Their values live in memory during
resolution and rendering; validated build-time models may be serialized into a
document bootstrap record so the client hydrates the exact server value.

Version one has these presentation families:

- site chrome: masthead identity, desktop and mobile navigation, footer, and
  explicit link capabilities;
- CV: header, section ordering, roles, achievements, projects, education,
  timeline presentation, and safe rich-content slots;
- portfolio overview: header, statistics, categories, technologies, recent
  projects, and consumer-supplied cross-view links;
- viewer-only Projects: categories, project cards, search/filter/sort inputs,
  statistics, and controlled query state;
- version display: explicit version text, prefix, optional destination, and
  presentation state, with no clock-derived fallback;
- text-size control: declared choices, stable choice ids, labels, scale tokens,
  and the declared default; and
- reader-mode control: controlled enabled state, accessible labels, and a
  package-namespaced presentation variant.

The default Portfolio theme is a declared style capability rather than a theme
switcher model. Disabled baseline features—Badges, Giscus, GitHub information
and link panels, theme switching, administration, authentication, editor
controls, and template documentation/demo surfaces—are outside version one.
Adding one is a brief, contract, and decision change rather than an inventory
discovery during implementation.

Consumer copy, icons, assets, raw HTML, URLs, and feature policy are not derived
view-model defaults. Ordinary strings render as text. A rich-content capability
is explicit and owns its own trust boundary.

### Resolution record

Each declaration produces one tagged in-memory record:

    idle -> loading -> ready
                    -> fallback
                    -> error

Ready carries data that passed raw validation, projection, and package
validation. Fallback carries package-validated fallback data plus the primary
error. Error carries no renderable data. Records include the source identity,
ordered validation issues, provider metadata safe for diagnostics, and the
original cause when available. They never include credentials, request
headers, or raw rejected payloads.

For a route, a resolved-source set is identified by the ordered identities in
that route declaration. It exists only when every required declaration has
settled. Composition receives the complete set or does not run.

### Render plan and browser bootstrap

After configuration and build-time resolution, the builder derives an
in-memory render plan. It pairs each route with normalized metadata, its
complete validated build-time model set, a browser-source gate when required,
style order, public assets, and the one presentation composer that owns its
document.

A build-only route is server-rendered from its complete model and embeds the
same validated value for hydration. A browser-gated route server-renders a
deterministic unresolved boundary for the composition that needs browser data.
The browser resolves and validates the whole required set before hydration,
hydrates that same unresolved boundary, and publishes the already-settled
result immediately after the hydration commit. The data renderer therefore
never sees a partial set, and the first hydrated tree matches the static HTML.

### Presentation preferences

Reader mode and text size are browser-owned state over pure controlled
renderers. Each preference has a declared default and a stable choice id. The
browser integration may persist the chosen id through a caller-supplied storage
port and applies only package-prefixed attributes and tokens. Invalid or absent
saved values recover to the declared default after hydration. No package code
patches history methods, polls the DOM, or owns Docusaurus/Infima classes.

### Extraction provenance manifest

The package persists a tracked, immutable manifest for the evidence used to
derive the port. Its identity is the digest of its canonical contents. It
records three baseline roles:

- delivery mechanics: repository identity, immutable commit, relevant file
  inventory, and content digests from the clean LandingPage baseline;
- consumer overlay: repository identity, immutable commit, clean-tree proof,
  and the inventory and digests of Portfolio-owned inputs; and
- effective template overlay: immutable container-image digest, template tree
  inventory and digests, the ordered overlay/exclusion rules, and the digest of
  the resulting clean effective tree.

Mutable tags such as latest may be recorded as observations but never as
baseline identity. The manifest contains no consumer credentials or embedded
product data. Visual, DOM, accessibility, route, and interaction fixtures point
to the manifest identity so a later baseline refresh cannot silently rewrite
what “parity” meant.

### Built artifact

The built output tree is package-owned persisted state. It contains one static
document per declared route, bundled browser assets, explicitly declared public
assets and styles, and an artifact record. The artifact record derives its
identity from package version, provenance-manifest identity, configuration
digest, normalized route order, and emitted file digests. It records source ids,
timing, model versions, and fallback status, but not raw values or secret
provider configuration.

Build staging state and a single-writer lease are temporary persisted state
adjacent to the target. They are removed after success or an ordinary failure.
An interrupted promotion may leave a named staging or recovery tree; the next
writer detects and reports it rather than guessing which tree is authoritative.

## Module boundaries

The runtime graph is deliberately layered:

    contracts and validation
            |
            +--> versioned view models --> deterministic selectors
            |                                  |
            +--------------------------------> pure React presentation --> namespaced styles
            |
            +--> resolution kernel <---------- source declarations
                        |                              |
                        +--> browser integration      +--> Data.Json integration
                        |
    configuration declaration ------------------------+
            |
            v
    Node configuration loader --> route planner --> document compiler --> artifact writer
                 |                    ^                    ^                 ^
                 +--> provenance -----+                    |                 |
                 +--> source orchestration ---------------+-----------------+

    static server --> built artifact
    merge engine  --> built artifact + caller deployment tree
    command surface --> loader, planner, compiler, writer, server, merge
    delivery assets --> command surface

| Module family | Owns | Depends on | Exposes |
| --- | --- | --- | --- |
| contracts and validation | validation results, issue paths, stable error categories, tagged resolution states | nothing in-package | framework-neutral contracts |
| versioned view models | strict rendering semantics and package validators | contracts | models and validators accepted by presentation |
| deterministic selectors | sorting, filtering, joins, eligibility, and time-dependent projection through explicit clocks | view models | pure functions |
| pure React presentation | site chrome, Portfolio routes, supporting controls, DOM and accessibility structure | view models, selectors, React | data-prop renderers and controlled components |
| namespaced styles | package classes, tokens, states, responsive and reader/text-size variants | public presentation contract | explicit style asset; no JavaScript side effect |
| resolution kernel | validation order, projection, fallback, aggregation, and cancellation-independent outcomes | contracts, view models | provider-neutral single- and multi-source operations |
| browser integration | pre-hydration source gate, hydration transition, URL/search state, storage and DOM ports | root public modules, resolution kernel | SSR-safe browser controllers |
| Data.Json integration | provider translation for build and browser source capabilities | resolution kernel and Data.Json public APIs | explicit adapter functions; no global loader or inferred ids |
| configuration declaration | eager structural validation of executable site configuration | contracts and public model types | one Portfolio-specific definition seam |
| Node configuration loader | contained module loading and configuration classification | configuration declaration | one validated configuration per invocation |
| provenance verifier | immutable baseline identities, canonical manifest validation, evidence capture, and fixture linkage | Node filesystem plus maintainer-only repository/registry inspection ports | verified manifest or ordered capture failures |
| source orchestrator | build-time provider execution and ordered aggregation | resolution kernel, configured provider adapters | complete validated source sets |
| route planner | path normalization, uniqueness, route/source joins, style and asset plans | validated configuration, source orchestrator, provenance | deterministic render plans |
| document compiler | the single Portfolio document writer, SSR shell, hydration bootstrap, and Vite compilation | route plans, pure presentation | a staged output tree |
| artifact writer | containment, writer lease, staging, manifesting, promotion, and recovery detection | document compiler output | one committed built artifact |
| static server | read-only path resolution, containment, content types, and route-index serving | built artifact | preview service |
| merge engine | collision analysis, protected-subtree proof, staged deployment-tree composition | built artifact and caller target | committed merged tree or no target change |
| command surface | command arguments and the single choice of operational path | Node module families | build, dev, preview, check, and merge behavior |
| delivery assets | composite action, reusable Pages workflow, and package documentation | published command surface | reusable mechanics without trigger, host, or deploy decision defaults |

The graph is acyclic. Optional integration modules depend inward on the root
contracts; the root never imports Node, Vite, Data.Json, browser, workflow, or
consumer modules. Delivery assets invoke a published command and are not
runtime dependencies. Docusaurus is evidence only and appears nowhere in the
package graph.

There is one document compiler for all declared Portfolio routes. Route kind,
source timing, and whether a data boundary is initially resolved may vary, but
none creates a private HTML writer. There is likewise one operational-path
decision in the command surface; individual commands do not rediscover the
configuration or implement competing build semantics.

## Control flow

### Build or check, triggered by a command invocation

1. Acquire the target's single-writer lease and refuse unresolved recovery
   state from an interrupted earlier writer.
2. Load the executable consumer configuration, validate its version and closed
   capability set, normalize deployment values, and validate every route,
   source, style, asset, and cross-reference before writing.
3. Validate the tracked extraction manifest's schema, canonical digest, and
   fixture bindings. Ordinary consumer builds do not contact evidence
   repositories or registries. External inspection occurs only when a
   maintainer creates or deliberately refreshes the manifest; that capture
   refuses a dirty baseline, mutable-only image identity, or mismatched
   inventory.
4. Resolve all build-timed sources. Independent I/O may run concurrently, but
   results and failures are collected in declaration order. Each value crosses
   raw validation, projection, and package validation. Composition does not run
   unless every required build source is ready or explicit fallback.
5. Derive the complete route plans. Reject duplicate or escaping paths,
   undeclared navigation destinations, missing assets, source timing conflicts,
   and route/source cycles before compilation.
6. Render every route through the single document compiler. Build-only routes
   receive their complete validated models; browser-gated boundaries receive
   the deterministic unresolved shell. Compile browser assets and copy public
   assets into a fresh staging tree.
7. Run artifact checks over the staged tree and create its artifact record.
   Check additionally runs the configured package verification gates but does
   not publish, deploy, or mutate a consumer repository.
8. For build, promote the verified staging tree as one committed artifact,
   retaining the prior artifact until promotion can succeed. Release the lease.

The builder never falls through from a failed declared input to stale output.
An existing successful artifact may remain available after a failed build, but
the command exits non-zero and does not describe that artifact as current.

### Browser bootstrap, triggered by loading a built route

1. Parse and validate the inert bootstrap record without executing data from
   it. Verify the route and model versions match the compiled client.
2. For a build-only route, hydrate using the exact serialized validated models
   used for SSR.
3. For a browser-gated route, resolve all required browser sources through the
   explicit provider. Independent requests may overlap; raw validation,
   projection, and package validation complete for every source, with failures
   ordered by declaration.
4. Hydrate the server's unresolved boundary only after the set has settled.
   Immediately after hydration commits, publish exactly one ready, explicit
   fallback, or error result to the resource boundary.
5. Controlled browser features may then restore validated text-size,
   reader-mode, search, and URL preferences through injected ports. Refresh
   creates a new generation; only the newest generation may publish.

No product renderer is invoked while a required browser source is unresolved,
and a failing auxiliary source cannot expose a partial route. The package does
not retry or change consumer cache policy. A caller-requested refresh uses an
explicit provider capability.

### Develop, preview, merge, and deliver

Dev loads and validates through the same path as build, verifies provenance,
and resolves build-timed sources before starting. It holds one configuration
generation at a time. File changes are coalesced; a new generation starts only
after the current one settles, and the last observed change wins. Documents are
generated by the same compiler as production. A failed regeneration remains
visible as a development error and never substitutes a partly updated model.

Preview runs a current staged build first, commits it through the ordinary
artifact writer, and then serves that exact tree through the shared static
server. It has no independent route or content-type behavior.

Merge acquires a read-stability lease on the built artifact and a writer lease
on the destination in normalized-path order, validates both, fingerprints every
protected subtree, analyzes all collisions, and composes a full sibling staging
tree. It verifies protected fingerprints and the resulting artifact before
promotion. The caller target changes only when the staged merge is complete;
promotion uses the same recovery protocol as a build.

The composite action invokes one named command with an exact package version.
The reusable workflow checks out the caller, optionally obtains a separately
built documentation artifact, invokes build and merge, uploads the resulting
tree, and deploys it. The workflow declares the permissions required by its
deploy job but owns no trigger, domain, environment policy, concurrency policy,
credentials, or decision to deploy; those remain with the caller.

## Failure modes

Every failure is detected at the boundary that can still prevent invalid data
or a partial tree from becoming authoritative. Errors identify the declarer,
route, source, or target and preserve safe causes; they never include raw
payloads, credentials, or headers.

| Dependency or boundary | Detection | System behavior and user-visible result | State left behind |
| --- | --- | --- | --- |
| configuration module | load throws, version/capability validation fails, or a remote document attempts to name executable code | command exits with ordered declaration errors; no server starts | prior committed artifact unchanged; temporary lease removed |
| provenance manifest | tracked schema, canonical digest, or fixture binding is missing or mismatched | build/check/dev refuses and names the baseline role | prior artifact unchanged; no external evidence is queried and no baseline is rewritten automatically |
| provenance capture | evidence checkout is dirty/unavailable, or an image has only a mutable identity | maintainer capture refuses to create or refresh the manifest | existing manifest remains unchanged |
| route and navigation declarations | invalid/duplicate/escaping path, undeclared cross-route destination, or route/source cycle | planning fails before compilation | prior artifact unchanged |
| source provider | id unresolved, transport/read failure, forbidden private browser capability, or invalid provider metadata | build fails; browser boundary publishes error after matching-shell hydration | build leaves prior artifact; browser leaves the static shell plus caller error UI |
| consumer raw validator | rejects or throws | projection is skipped; error identifies source and validation issues | no raw value is persisted |
| projection | throws | package validation and renderer are skipped | no candidate is persisted |
| package view validator | rejects primary or fallback candidate | renderer is skipped; invalid fallback is an error, not empty content | no invalid model enters bootstrap or artifact |
| multi-source route | one or more declarations fail | every declaration settles, failures are reported in declaration order, composition does not run | no partial composed model exists |
| declared style or asset | missing, unreadable, escaping, colliding, or disallowed format | staging fails before promotion; UI is not published unstyled | prior artifact unchanged; removable staging may remain after interruption |
| SSR or bundler | render, bundle, or package-internal compilation step fails | route compilation stops and build exits non-zero | prior artifact unchanged; staging retained only when needed for diagnosis/recovery |
| artifact verification | manifest, DOM/CSS namespace, route, hydration, accessibility, or file-digest check fails | staging is rejected | prior artifact unchanged |
| promotion | rename/swap fails | rollback is attempted; command reports the authoritative and recovery trees explicitly | prior artifact restored when possible; otherwise named recovery state blocks future writers |
| browser bootstrap | bootstrap parse/version fails | hydration is refused and caller error UI replaces the unresolved boundary without invoking product renderers | static document remains; no preference or model is persisted by the package |
| browser preference storage/DOM port | unavailable, throws, or contains an unknown value | controlled feature uses the declared default and reports optional diagnostics | invalid preference is ignored; product data is unaffected |
| development regeneration | a changed config or source fails | current generation is not published; development overlay reports the failure | last complete in-memory generation remains until a valid one replaces it |
| static server request | malformed encoding, missing file, traversal, or escaping symlink | response is a generic not-found result | no state change |
| merge source or destination | missing artifact record, protected collision, changed fingerprint, insufficient space, or write failure | staged merge is rejected; destination is not promoted | original destination remains; named staging/recovery may remain after interruption |
| package registry or action download | exact version unavailable or integrity fails | action/workflow job fails before invoking commands | no deployment artifact from this run |
| GitHub Pages | upload or deploy fails | workflow reports failure; package makes no retry or rollback claim | previously deployed Pages state is external and unchanged unless GitHub reports otherwise |

An explicit fallback is the only data-level recovery. It is validated, retains
the triggering error, and is visible to caller UI and artifact diagnostics.
There is no implicit empty model, bundled product default, stale-source reuse,
or automatic retry.

## Concurrency and ordering

One operation lease per authoritative tree forbids build/build,
build/preview, build/merge, and merge/merge races. A merge holds the source
artifact stable and the destination writable, acquiring both in normalized-path
order so two merges cannot deadlock. Leases are acquired before staging and
released on every ordinary exit. Recovery state from an interrupted promotion
blocks a new writer until the named trees can be adjudicated; the package never
deletes an ambiguous tree automatically.

Within one build:

- configuration, provenance, containment, and cross-reference validation
  complete before source I/O;
- independent source reads may overlap, but each declaration owns one result
  slot and all diagnostics are emitted in declaration order;
- build-source resolution completes before any route composition;
- route plans are fixed before compilation, and route documents are committed
  to staging in declaration order even if bundler internals parallelize work;
- all styles and public assets are read, contained, and collision-checked before
  the authoritative artifact changes;
- the artifact record is written after file generation and before promotion;
  its file list and digests are sorted by normalized output path; and
- promotion is the only point at which the authoritative tree changes.

Within one browser route, required requests may overlap. A generation token
orders refreshes: completion order never selects the winner, and an older
generation cannot publish after a newer one begins. Hydration happens once.
Preference restoration follows the hydration commit and cannot change the
server-matching first tree.

Development rebuilds are serialized and coalesced. Static-server reads may
overlap because the committed artifact is immutable for that server instance.
The delivery workflow intentionally declares no trigger or concurrency group;
the consuming repository owns whether deployments queue, cancel, or overlap.

## Alternatives considered

### Portfolio-specific executable configuration versus generic or remote modes

Chosen: one executable, eagerly validated Portfolio configuration with a closed
capability set. It can carry validators and projections without turning remote
data into executable module names.

Rejected: retaining LandingPage's README/changelog generic modes, because the
brief replaces rather than extends that product contract. Rejected: a JSON or
YAML site model naming adapters, because fetched data would select executable
code and validators could not remain first-class capabilities. Rejected:
unrestricted Vite plugins, because they can bypass output, DOM, and filesystem
invariants the builder owns.

### Explicit static documents versus an inferred client router

Chosen: one static document for every explicitly declared route, all written by
one compiler. This makes route existence, metadata, broken-link validation,
base paths, and output containment build-time facts.

Rejected: a single-page catch-all router, because it makes undeclared routes
runtime policy and weakens static-route and no-inference proofs. Rejected:
copying every route inherited from the Docusaurus image, because incidental
template pages are not Portfolio product requirements.

### Dual source timing with a hydration gate versus progressive composition

Chosen: each source declares build or browser; build sources settle before SSR,
and browser sources settle before matching-shell hydration then publish as one
complete set after the hydration commit.

Rejected: build-only resolution, because it cannot represent consumer-owned
browser freshness and cache policy. Rejected: browser-only resolution, because
it gives up auditable static content and build failure for stable inputs.
Rejected: progressive per-source rendering, because it exposes partial source
sets and makes completion order visible to users.

### Staged promotion versus clear-and-write output

Chosen: build and merge create complete sibling staging trees, verify them, and
promote under a single-writer lease with explicit recovery state.

Rejected: clearing and writing the target in place, the LandingPage baseline's
current behavior, because a later read or bundler failure destroys the last
known-good artifact. Rejected: detection-only merge, because discovering a
protected collision after copying still leaves a partially changed deployment
tree. The cost of staging is additional disk space and copy time; the benefit is
that failure does not silently make a partial tree authoritative.

### Immutable provenance versus comments naming mutable baselines

Chosen: a canonical manifest records commits, image digests, file inventories,
overlay rules, and resulting digests, and every parity fixture names the
manifest identity.

Rejected: recording only repository names, branches, or latest tags, because
the same implementation instruction could later resolve to different bytes.
Rejected: copying baseline source into the package without provenance, because
the origin and exclusions would be unauditable.

### Controlled accessibility preferences versus copied global behavior

Chosen: reader mode and text size join the pure presentation surface as
controlled components; browser adapters own storage and DOM application through
ports and package-prefixed tokens.

Rejected: copying the current global Infima selectors, history monkey-patching,
DOM polling, and hard-coded storage keys, because those are Docusaurus-specific
mechanics rather than Portfolio presentation. Rejected: dropping the controls,
because both are enabled in the effective Portfolio baseline and the brief
includes enabled supporting controls.

### Transfer delivery mechanics versus depend on the baseline product

Chosen: port the proven build, preview, merge, action, workflow, documentation,
and verification mechanics, then own their Portfolio-specific evolution here.

Rejected: invoke the LandingPage package as a nested builder, because its
generic site modes and public compatibility promise would become runtime
dependencies of a product that explicitly excludes them. Rejected: copy the
files without behavior and provenance tests, because future fixes would have no
way to distinguish intentional divergence from drift.

## Open questions

None. Exact baseline commits, image digests, inventories, and peer-version
ranges are discoverable implementation/release inputs governed by the manifest
and contract; they are not product-policy choices. The public declarations and
error taxonomy belong to the contract phase rather than this architecture.
