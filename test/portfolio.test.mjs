import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  Portfolio,
  SiteChrome,
  CV,
  VersionDisplay,
  ValidationError,
  flattenPortfolioTechnologies,
  selectLinkDestination,
  validatePortfolioViewModelV1,
  validateSiteChromeViewModelV1,
  validateCVViewModelV1,
  validateVersionDisplayViewModelV1,
} from "../src/index.js";

const minimal = () => ({
  version: 1,
  header: { title: "Selected work" },
  statistics: [],
  categories: [],
  technologies: [],
  recentProjects: [],
});

const complete = () => ({
  version: 1,
  header: { title: "<Portfolio>", summary: "Safe text" },
  statistics: [{ id: "years", label: "Years", value: "10" }],
  categories: [{ id: "web", label: "Web", count: 1 }],
  technologies: [
    { id: "react", label: "React", link: { label: "React", href: "https://react.dev", target: "new-context" } },
    { id: "css", label: "CSS", link: { label: "CSS" } },
  ],
  recentProjects: [{
    id: "portfolio", title: "Portfolio", summary: "<script>alert(1)</script>",
    categoryIds: ["web"], tags: ["featured"], technologies: ["React", "CSS"], links: [{ label: "Source" }],
    period: { start: "2024-01", ongoing: true },
  }],
});

test("S10.1 validates minimal and complete Portfolio models", () => {
  for (const model of [minimal(), complete()]) {
    const result = validatePortfolioViewModelV1(model);
    assert.equal(result.ok, true);
  }
});

test("S10.2 rejects every Portfolio validation branch in deterministic order", () => {
  const cases = [
    ["empty", { ...minimal(), header: { title: "" } }, ["header", "title"]],
    ["duplicate", { ...complete(), categories: [{ id: "web", label: "Web" }, { id: "web", label: "Again" }] }, ["categories", 1, "id"]],
    ["inconsistent", { ...complete(), recentProjects: [{ ...complete().recentProjects[0], period: { start: "2024-01", end: "2024-02", ongoing: true } }] }, ["recentProjects", 0, "period", "end"]],
    ["non-finite", { ...complete(), categories: [{ id: "web", label: "Web", count: Number.NaN }] }, ["categories", 0, "count"]],
    ["unsupported version", { ...minimal(), version: 2 }, ["version"]],
    ["unknown field", { ...minimal(), unexpected: true }, ["unexpected"]],
    ["non-plain object", new Date(), []],
  ];

  for (const [name, input, path] of cases) {
    const result = validatePortfolioViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }

  const ordered = validatePortfolioViewModelV1({
    ...minimal(),
    header: { title: "" },
    unexpected: true,
  });
  assert.equal(ordered.ok, false);
  assert.deepEqual(ordered.issues.map((issue) => issue.path), [["header", "title"], ["unexpected"]]);
});

test("S10.2 exposes a typed validation error with stable code and issues", () => {
  const result = validatePortfolioViewModelV1({});
  assert.equal(result.ok, false);
  const error = new ValidationError("view.validation_failed", "Portfolio view model is invalid", {
    modelKind: "portfolio",
    issues: result.issues,
  });
  assert.equal(error.code, "view.validation_failed");
  assert.equal(error.modelKind, "portfolio");
  assert.deepEqual(error.issues, result.issues);
});

test("S10.3 selectors are deterministic, immutable, and capability-local", () => {
  const model = complete();
  const before = structuredClone(model);
  assert.deepEqual(flattenPortfolioTechnologies(model), ["React", "CSS"]);
  assert.deepEqual(flattenPortfolioTechnologies(model), ["React", "CSS"]);
  assert.deepEqual(model, before);
  assert.equal(selectLinkDestination({ label: "Inert" }), undefined);
  assert.equal(selectLinkDestination({ label: "React", href: "https://react.dev" }), "https://react.dev");
});

test("S10.4 renders strings as text and never invents a route", () => {
  const markup = renderToStaticMarkup(React.createElement(Portfolio, { model: complete() }));
  assert.match(markup, /class="szd-portfolio-overview"/);
  assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /href="\/(projects|cv|docs)|href="[^\"]*(demo|repository|admin)/);
  assert.match(markup, /href="https:\/\/react.dev"/);
  assert.match(markup, /rel="noopener noreferrer"/);
});

test("S10.4 rejects an invalid direct renderer boundary with the typed error", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(Portfolio, { model: { ...minimal(), header: { title: "" } } })),
    (error) => error instanceof ValidationError && error.code === "view.validation_failed",
  );
});

test("S10.5 owns only namespaced DOM and CSS names and imports no CSS from JavaScript", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../src/index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /\.css["']/);
  for (const name of css.matchAll(/\.(szd-[a-z0-9-]+)/g)) {
    assert.match(name[1], /^szd-portfolio-/);
  }
  for (const name of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    assert.match(name[1], /^--szd-portfolio-/);
  }
  for (const name of css.matchAll(/\[([^\]]+)\]/g)) {
    assert.match(name[1], /^data-szd-portfolio-/);
  }
  const markup = renderToStaticMarkup(React.createElement(Portfolio, { model: complete() }));
  for (const attribute of markup.matchAll(/\s(data-[a-z0-9-]+)=/g)) {
    assert.match(attribute[1], /^data-szd-portfolio-/);
  }
  for (const classAttribute of markup.matchAll(/\sclass="([^"]+)"/g)) {
    for (const className of classAttribute[1].split(" ")) {
      assert.match(className, /^szd-portfolio-/);
    }
  }
  assert.doesNotMatch(source, /subzerodev-data-json|vite|docusaurus/i);
});

test("S10.6 imports and server-renders with browser and optional-integration globals poisoned", async () => {
  const names = ["window", "document", "location", "localStorage"];
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          throw new Error(`${name} must not be read by the root entrypoint`);
        },
      });
    }
    const root = await import(`../src/index.js?poisoned=${Date.now()}`);
    const markup = renderToStaticMarkup(React.createElement(root.Portfolio, { model: minimal() }));
    assert.match(markup, /szd-portfolio-overview/);
  } finally {
    for (const name of names) {
      const descriptor = descriptors.get(name);
      if (descriptor === undefined) {
        delete globalThis[name];
      } else {
        Object.defineProperty(globalThis, name, descriptor);
      }
    }
  }
});

test("S13.1-S13.5 validate and safely render non-Projects presentation models", () => {
  const chrome = { version: 1, identity: { name: "<Name>", iconKey: "star" }, primaryNavigation: [{ kind: "link", id: "home", link: { label: "Home" } }], secondaryNavigation: [], footer: { text: "Footer", links: [] } };
  const cv = {
    version: 1,
    header: { name: "Name", contact: [{ label: "Email address" }] },
    sections: [
      { kind: "summary", id: "summary", heading: "Summary", body: { kind: "text", value: "<script>" } },
      { kind: "roles", id: "roles", heading: "Roles", roles: [{ id: "role", title: "Engineer", organization: "Org", period: { start: "2020", ongoing: true }, achievements: [{ kind: "text", value: "Shipped the launch" }], technologies: ["TypeScript"] }] },
      { kind: "projects", id: "projects", heading: "Projects", projects: [{ id: "project", name: "Side project", technologies: ["React"] }] },
      { kind: "education", id: "education", heading: "Education", items: [{ id: "degree", institution: "University", qualification: "BSc Computing" }] },
      { kind: "achievements", id: "achievements", heading: "Achievements", items: [{ kind: "text", value: "Community award" }] },
    ],
  };
  const version = { version: 1, text: "v1", prefix: "Version", link: { label: "Release" } };
  for (const [validator, value] of [[validateSiteChromeViewModelV1, chrome], [validateCVViewModelV1, cv], [validateVersionDisplayViewModelV1, version]]) assert.equal(validator(value).ok, true);
  assert.equal(validateSiteChromeViewModelV1({ ...chrome, unexpected: true }).ok, false);
  assert.equal(validateCVViewModelV1({ ...cv, sections: [...cv.sections, { ...cv.sections[0], id: "summary" }] }).ok, false);
  assert.equal(validateCVViewModelV1({ ...cv, sections: [{ ...cv.sections[1], roles: [{ ...cv.sections[1].roles[0], period: { start: "2020", end: "2021", ongoing: true } }] }] }).ok, false);
  assert.equal(validateCVViewModelV1({ ...cv, sections: [{ kind: "projects", id: "projects", heading: "Projects" }] }).ok, false);
  assert.equal(validateCVViewModelV1({ ...cv, sections: [{ kind: "education", id: "education", heading: "Education", items: [{}] }] }).ok, false);
  assert.equal(validateCVViewModelV1({ ...cv, sections: [{ kind: "achievements", id: "achievements", heading: "Achievements" }] }).ok, false);
  assert.equal(validateVersionDisplayViewModelV1({ ...version, link: { label: "bad", href: "javascript:alert(1)" } }).ok, false);
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(SiteChrome, { model: chrome, renderIcon: () => React.createElement("svg", null) }), React.createElement(CV, { model: cv, richTextSlots: [{ id: "slot", content: React.createElement("strong", null, "trusted") }] }), React.createElement(VersionDisplay, { model: version })));
  assert.match(markup, /&lt;script&gt;/); assert.doesNotMatch(markup, /href="\/(?:projects|cv|docs)/); assert.doesNotMatch(markup, /id="/);
  assert.match(markup, /aria-hidden="true"/);
  // S13.1-style regression: every validated CV section kind must actually render its content, not just its heading.
  for (const expected of ["Shipped the launch", "TypeScript", "Side project", "React", "University", "BSc Computing", "Community award", "Email address"]) {
    assert.match(markup, new RegExp(expected));
  }
});

test("S13.1 validateSiteChromeViewModelV1 rejects every recorded rejection branch", () => {
  const base = () => ({
    version: 1,
    identity: { name: "Name", subtitle: "Subtitle", iconKey: "star" },
    primaryNavigation: [{ kind: "link", id: "home", link: { label: "Home" } }],
    secondaryNavigation: [{ kind: "text", id: "note", label: "Note" }, { kind: "group", id: "group", label: "Group", items: [{ label: "Item" }] }],
    footer: { text: "Footer", links: [{ label: "Link" }] },
  });
  assert.equal(validateSiteChromeViewModelV1(base()).ok, true);
  const cases = [
    ["unsupported version", { ...base(), version: 2 }, ["version"]],
    ["identity not an object", { ...base(), identity: null }, ["identity"]],
    ["identity name missing", { ...base(), identity: { ...base().identity, name: "" } }, ["identity", "name"]],
    ["identity subtitle invalid", { ...base(), identity: { ...base().identity, subtitle: "" } }, ["identity", "subtitle"]],
    ["identity iconKey invalid", { ...base(), identity: { ...base().identity, iconKey: "" } }, ["identity", "iconKey"]],
    ["identity unknown field", { ...base(), identity: { ...base().identity, unexpected: true } }, ["identity", "unexpected"]],
    ["primaryNavigation not an array", { ...base(), primaryNavigation: "nope" }, ["primaryNavigation"]],
    ["navigation item not an object", { ...base(), primaryNavigation: [null] }, ["primaryNavigation", 0]],
    ["navigation item duplicate id", { ...base(), primaryNavigation: [...base().primaryNavigation, { ...base().primaryNavigation[0] }] }, ["primaryNavigation", 1, "id"]],
    ["navigation link item has an invalid link", { ...base(), primaryNavigation: [{ kind: "link", id: "home", link: {} }] }, ["primaryNavigation", 0, "link", "label"]],
    ["navigation text item has an invalid label", { ...base(), secondaryNavigation: [{ kind: "text", id: "note", label: "" }] }, ["secondaryNavigation", 0, "label"]],
    ["navigation group item has an invalid label", { ...base(), secondaryNavigation: [{ kind: "group", id: "group", label: "", items: [] }] }, ["secondaryNavigation", 0, "label"]],
    ["navigation group item has invalid items", { ...base(), secondaryNavigation: [{ kind: "group", id: "group", label: "Group", items: "nope" }] }, ["secondaryNavigation", 0, "items"]],
    ["navigation item has an unsupported kind", { ...base(), secondaryNavigation: [{ kind: "bogus", id: "note" }] }, ["secondaryNavigation", 0, "kind"]],
    ["footer not an object", { ...base(), footer: "nope" }, ["footer"]],
    ["footer text missing", { ...base(), footer: { text: "", links: [] } }, ["footer", "text"]],
    ["footer links invalid", { ...base(), footer: { text: "Footer", links: "nope" } }, ["footer", "links"]],
    ["footer unknown field", { ...base(), footer: { text: "Footer", links: [], unexpected: true } }, ["footer", "unexpected"]],
    ["top-level unknown field", { ...base(), unexpected: true }, ["unexpected"]],
    ["non-plain object", new Date(), []],
  ];
  for (const [name, input, path] of cases) {
    const result = validateSiteChromeViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }
});

test("S13.1 validateCVViewModelV1 rejects every recorded rejection branch", () => {
  const base = () => ({
    version: 1,
    header: { name: "Name", headline: "Headline", contact: [{ label: "Email" }] },
    sections: [
      { kind: "roles", id: "roles", heading: "Roles", roles: [{ id: "role", title: "Engineer", organization: "Org", period: { start: "2020", ongoing: true }, achievements: [], technologies: [] }] },
      { kind: "projects", id: "projects", heading: "Projects", projects: [{ id: "project", name: "Project", technologies: [] }] },
      { kind: "education", id: "education", heading: "Education", items: [{ id: "degree", institution: "University", qualification: "BSc" }] },
      { kind: "achievements", id: "achievements", heading: "Achievements", items: [{ kind: "text", value: "Award" }] },
    ],
  });
  assert.equal(validateCVViewModelV1(base()).ok, true);
  const cases = [
    ["unsupported version", { ...base(), version: 2 }, ["version"]],
    ["header not an object", { ...base(), header: null }, ["header"]],
    ["sections not an array", { ...base(), sections: "nope" }, ["sections"]],
    ["section not an object", { ...base(), sections: [null] }, ["sections", 0]],
    ["roles not an array", { ...base(), sections: [{ ...base().sections[0], roles: "nope" }] }, ["sections", 0, "roles"]],
    ["role not an object", { ...base(), sections: [{ ...base().sections[0], roles: [null] }] }, ["sections", 0, "roles", 0]],
    ["role achievements not an array", { ...base(), sections: [{ ...base().sections[0], roles: [{ ...base().sections[0].roles[0], achievements: "nope" }] }] }, ["sections", 0, "roles", 0, "achievements"]],
    ["projects not an array", { ...base(), sections: [{ ...base().sections[1], projects: "nope" }] }, ["sections", 0, "projects"]],
    ["project not an object", { ...base(), sections: [{ ...base().sections[1], projects: [null] }] }, ["sections", 0, "projects", 0]],
    ["education items not an array", { ...base(), sections: [{ ...base().sections[2], items: "nope" }] }, ["sections", 0, "items"]],
    ["education item not an object", { ...base(), sections: [{ ...base().sections[2], items: [null] }] }, ["sections", 0, "items", 0]],
    ["achievements items not an array", { ...base(), sections: [{ ...base().sections[3], items: "nope" }] }, ["sections", 0, "items"]],
    ["unsupported section kind", { ...base(), sections: [{ kind: "bogus", id: "x", heading: "X" }] }, ["sections", 0, "kind"]],
    ["non-plain object", new Date(), []],
  ];
  for (const [name, input, path] of cases) {
    const result = validateCVViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }
});

test("S13.1 validateVersionDisplayViewModelV1 rejects every recorded rejection branch", () => {
  const base = () => ({ version: 1, text: "v1.0.0", prefix: "Version", link: { label: "Release", href: "https://example.com/release" } });
  assert.equal(validateVersionDisplayViewModelV1(base()).ok, true);
  const cases = [
    ["unsupported version", { ...base(), version: 2 }, ["version"]],
    ["text missing", { ...base(), text: "" }, ["text"]],
    ["prefix invalid", { ...base(), prefix: "" }, ["prefix"]],
    ["link invalid", { ...base(), link: { label: "Release", href: "javascript:alert(1)" } }, ["link", "href"]],
    ["unknown field", { ...base(), unexpected: true }, ["unexpected"]],
    ["non-plain object", new Date(), []],
  ];
  for (const [name, input, path] of cases) {
    const result = validateVersionDisplayViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }
});
