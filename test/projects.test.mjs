import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  Projects,
  ReaderModeControl,
  TextSizeControl,
  ValidationError,
  filterProjects,
  summarizeProjects,
  validateProjectsViewModelV1,
  validateReaderModeViewModelV1,
  validateTextSizeViewModelV1,
} from "../src/index.js";

const minimalProjects = () => ({ version: 1, heading: "Projects", projects: [], categories: [], sortChoices: [] });

const completeProjects = () => ({
  version: 1,
  heading: "<Projects>",
  categories: [{ id: "web", label: "Web" }, { id: "mobile", label: "Mobile" }],
  sortChoices: [{ id: "newest", label: "Newest" }, { id: "title", label: "Title" }],
  emptyLabel: "No projects found",
  projects: [
    { id: "p1", title: "Alpha", summary: "First", categoryIds: ["web"], tags: ["featured"], technologies: ["React"], links: [{ label: "Source" }], period: { start: "2023-01", end: "2023-06", ongoing: false } },
    { id: "p2", title: "Beta", summary: "Second", categoryIds: ["mobile"], tags: ["featured", "react-native"], technologies: ["React Native"], links: [], period: { start: "2024-01", ongoing: true } },
  ],
});

const textSizeModel = () => ({ version: 1, label: "Text size", choices: [{ id: "small", label: "Small", scaleToken: "sm" }, { id: "large", label: "Large", scaleToken: "lg" }], defaultChoiceId: "small" });
const readerModeModel = () => ({ version: 1, label: "Reader mode", enabledLabel: "On", disabledLabel: "Off", defaultEnabled: false });

test("S14.1 validates minimal and complete Projects, TextSize, and ReaderMode models", () => {
  for (const model of [minimalProjects(), completeProjects()]) assert.equal(validateProjectsViewModelV1(model).ok, true);
  assert.equal(validateTextSizeViewModelV1(textSizeModel()).ok, true);
  assert.equal(validateReaderModeViewModelV1(readerModeModel()).ok, true);
});

test("S14.1 validateProjectsViewModelV1 rejects every recorded rejection branch", () => {
  const cases = [
    ["unsupported version", { ...completeProjects(), version: 2 }, ["version"]],
    ["heading missing", { ...completeProjects(), heading: "" }, ["heading"]],
    ["categories not an array", { ...completeProjects(), categories: "nope" }, ["categories"]],
    ["category not an object", { ...completeProjects(), categories: [null] }, ["categories", 0]],
    ["category duplicate id", { ...completeProjects(), categories: [{ id: "web", label: "Web" }, { id: "web", label: "Again" }] }, ["categories", 1, "id"]],
    ["category unknown field", { ...completeProjects(), categories: [{ id: "web", label: "Web", unexpected: true }] }, ["categories", 0, "unexpected"]],
    ["sortChoices not an array", { ...completeProjects(), sortChoices: "nope" }, ["sortChoices"]],
    ["sortChoice not an object", { ...completeProjects(), sortChoices: [null] }, ["sortChoices", 0]],
    ["sortChoice duplicate id", { ...completeProjects(), sortChoices: [{ id: "newest", label: "Newest" }, { id: "newest", label: "Again" }] }, ["sortChoices", 1, "id"]],
    ["sortChoice unsupported id", { ...completeProjects(), sortChoices: [{ id: "bogus", label: "Bogus" }] }, ["sortChoices", 0, "id"]],
    ["sortChoice unknown field", { ...completeProjects(), sortChoices: [{ id: "newest", label: "Newest", unexpected: true }] }, ["sortChoices", 0, "unexpected"]],
    ["projects not an array", { ...completeProjects(), projects: "nope" }, ["projects"]],
    ["project not an object", { ...completeProjects(), projects: [null] }, ["projects", 0]],
    ["project duplicate id", { ...completeProjects(), projects: [completeProjects().projects[0], completeProjects().projects[0]] }, ["projects", 1, "id"]],
    ["project title missing", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], title: "" }] }, ["projects", 0, "title"]],
    ["project summary missing", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], summary: "" }] }, ["projects", 0, "summary"]],
    ["project categoryIds not an array", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], categoryIds: "nope" }] }, ["projects", 0, "categoryIds"]],
    ["project references an undeclared category", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], categoryIds: ["bogus"] }] }, ["projects", 0, "categoryIds", 0]],
    ["project tags not an array", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], tags: "nope" }] }, ["projects", 0, "tags"]],
    ["project technologies not an array", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], technologies: "nope" }] }, ["projects", 0, "technologies"]],
    ["project link invalid", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], links: [{}] }] }, ["projects", 0, "links", 0, "label"]],
    ["project inconsistent period", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], period: { start: "2023-01", end: "2023-06", ongoing: true } }] }, ["projects", 0, "period", "end"]],
    ["project unknown field", { ...completeProjects(), projects: [{ ...completeProjects().projects[0], unexpected: true }] }, ["projects", 0, "unexpected"]],
    ["emptyLabel invalid", { ...completeProjects(), emptyLabel: "" }, ["emptyLabel"]],
    ["top-level unknown field", { ...completeProjects(), unexpected: true }, ["unexpected"]],
    ["non-plain object", new Date(), []],
  ];
  for (const [name, input, path] of cases) {
    const result = validateProjectsViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }
});

test("S14.1 validateTextSizeViewModelV1 rejects every recorded rejection branch", () => {
  const cases = [
    ["unsupported version", { ...textSizeModel(), version: 2 }, ["version"]],
    ["label missing", { ...textSizeModel(), label: "" }, ["label"]],
    ["choices not an array", { ...textSizeModel(), choices: "nope" }, ["choices"]],
    ["choice not an object", { ...textSizeModel(), choices: [null] }, ["choices", 0]],
    ["choice duplicate id", { ...textSizeModel(), choices: [{ id: "small", label: "Small", scaleToken: "sm" }, { id: "small", label: "Again", scaleToken: "sm" }] }, ["choices", 1, "id"]],
    ["choice label missing", { ...textSizeModel(), choices: [{ id: "small", label: "", scaleToken: "sm" }] }, ["choices", 0, "label"]],
    ["choice scaleToken missing", { ...textSizeModel(), choices: [{ id: "small", label: "Small", scaleToken: "" }] }, ["choices", 0, "scaleToken"]],
    ["choice unknown field", { ...textSizeModel(), choices: [{ id: "small", label: "Small", scaleToken: "sm", unexpected: true }] }, ["choices", 0, "unexpected"]],
    ["defaultChoiceId missing", { ...textSizeModel(), defaultChoiceId: "" }, ["defaultChoiceId"]],
    ["top-level unknown field", { ...textSizeModel(), unexpected: true }, ["unexpected"]],
    ["non-plain object", new Date(), []],
  ];
  for (const [name, input, path] of cases) {
    const result = validateTextSizeViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }
  const unknownDefault = validateTextSizeViewModelV1({ ...textSizeModel(), defaultChoiceId: "bogus" });
  assert.equal(unknownDefault.ok, false);
  assert.deepEqual(unknownDefault.issues[0].path, ["defaultChoiceId"]);
  assert.equal(unknownDefault.issues[0].code, "view.unknown_choice");
});

test("S14.1 validateReaderModeViewModelV1 rejects every recorded rejection branch", () => {
  const cases = [
    ["unsupported version", { ...readerModeModel(), version: 2 }, ["version"]],
    ["label missing", { ...readerModeModel(), label: "" }, ["label"]],
    ["enabledLabel missing", { ...readerModeModel(), enabledLabel: "" }, ["enabledLabel"]],
    ["disabledLabel missing", { ...readerModeModel(), disabledLabel: "" }, ["disabledLabel"]],
    ["defaultEnabled not a boolean", { ...readerModeModel(), defaultEnabled: "yes" }, ["defaultEnabled"]],
    ["top-level unknown field", { ...readerModeModel(), unexpected: true }, ["unexpected"]],
    ["non-plain object", new Date(), []],
  ];
  for (const [name, input, path] of cases) {
    const result = validateReaderModeViewModelV1(input);
    assert.equal(result.ok, false, name);
    assert.deepEqual(result.issues[0].path, path, name);
  }
});

test("S14.1 exposes a typed validation error with a stable modelKind for Projects, TextSize, and ReaderMode", () => {
  for (const [kind, validator, invalid] of [["projects", validateProjectsViewModelV1, {}], ["text-size", validateTextSizeViewModelV1, {}], ["reader-mode", validateReaderModeViewModelV1, {}]]) {
    const result = validator(invalid);
    const error = new ValidationError("view.validation_failed", `${kind} view model is invalid`, { modelKind: kind, issues: result.issues });
    assert.equal(error.modelKind, kind);
    assert.deepEqual(error.issues, result.issues);
  }
});

const selectorModel = () => ({
  version: 1,
  heading: "Projects",
  categories: [{ id: "web", label: "Web" }, { id: "mobile", label: "Mobile" }],
  sortChoices: [{ id: "newest", label: "Newest" }, { id: "title", label: "Title" }],
  projects: [
    { id: "a", title: "Charlie", summary: "c", categoryIds: ["web"], tags: ["x"], technologies: ["React"], links: [], period: { start: "2022-01", end: "2022-06", ongoing: false } },
    { id: "b", title: "Alpha", summary: "b", categoryIds: ["mobile"], tags: ["y"], technologies: ["React", "Vue"], links: [], period: { start: "2024-01", ongoing: true } },
    { id: "c", title: "Bravo", summary: "a", categoryIds: ["web", "mobile"], tags: ["x", "y"], technologies: ["Vue"], links: [] },
  ],
});
const emptyQuery = () => ({ search: "", categoryIds: [], tags: [], sortChoiceId: "" });

test("S14.2 filterProjects is deterministic, pure, and matches search/category/tag facets without mutating inputs", () => {
  const model = selectorModel();
  const query = emptyQuery();
  const modelBefore = structuredClone(model);
  const queryBefore = structuredClone(query);

  assert.deepEqual(filterProjects(model, query).map((project) => project.id), ["a", "b", "c"]);
  assert.deepEqual(filterProjects(model, query).map((project) => project.id), filterProjects(model, query).map((project) => project.id));
  assert.deepEqual(filterProjects(model, { ...query, categoryIds: ["mobile"] }).map((project) => project.id), ["b", "c"]);
  assert.deepEqual(filterProjects(model, { ...query, tags: ["y"] }).map((project) => project.id), ["b", "c"]);
  assert.deepEqual(filterProjects(model, { ...query, search: "bravo" }).map((project) => project.id), ["c"]);
  assert.deepEqual(filterProjects(model, { ...query, search: "nonexistent" }).map((project) => project.id), []);

  assert.deepEqual(model, modelBefore);
  assert.deepEqual(query, queryBefore);
});

test("S14.2 filterProjects sorts by the package's known sort ids and falls back to declaration order otherwise", () => {
  const model = selectorModel();
  assert.deepEqual(filterProjects(model, { ...emptyQuery(), sortChoiceId: "newest" }).map((project) => project.id), ["b", "a", "c"]);
  assert.deepEqual(filterProjects(model, { ...emptyQuery(), sortChoiceId: "title" }).map((project) => project.id), ["b", "c", "a"]);
  assert.deepEqual(filterProjects(model, { ...emptyQuery(), sortChoiceId: "unrecognized" }).map((project) => project.id), ["a", "b", "c"]);
});

test("S14.2 summarizeProjects aggregates technology usage deterministically without a clock or locale", () => {
  const summary = summarizeProjects(selectorModel().projects);
  assert.deepEqual(summary, [{ id: "React", label: "React", value: 2 }, { id: "Vue", label: "Vue", value: 2 }]);
});

test("S14.3 Projects renders keyboard-operable, accessible, package-prefixed search/filter/sort controls and the filtered result set", () => {
  const model = completeProjects();
  const query = { search: "", categoryIds: ["mobile"], tags: [], sortChoiceId: "newest" };
  const markup = renderToStaticMarkup(React.createElement(Projects, { model, query }));
  assert.match(markup, /class="szd-portfolio-projects-view"/);
  assert.match(markup, /&lt;Projects&gt;/);
  assert.match(markup, /type="search"/);
  assert.match(markup, /<fieldset class="szd-portfolio-projects-categories">/);
  assert.match(markup, /<legend>Categories<\/legend>/);
  assert.match(markup, /data-szd-portfolio-selected="true"/);
  assert.match(markup, /<select/);
  assert.match(markup, /Beta/);
  assert.doesNotMatch(markup, /Alpha/);
  assert.doesNotMatch(markup, /id="/);
});

test("S14.3 Projects renders the declared empty label only when no result matches", () => {
  const model = completeProjects();
  const markup = renderToStaticMarkup(React.createElement(Projects, { model, query: { search: "does-not-exist", categoryIds: [], tags: [], sortChoiceId: "" } }));
  assert.match(markup, /No projects found/);
  assert.doesNotMatch(markup, /szd-portfolio-projects-results/);
});

test("S14.3 Projects rejects an invalid direct renderer boundary with the typed error", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(Projects, { model: { ...minimalProjects(), heading: "" }, query: emptyQuery() })),
    (error) => error instanceof ValidationError && error.code === "view.validation_failed" && error.modelKind === "projects",
  );
});

test("S14.3 Projects rejects a malformed query with the typed error instead of throwing a raw TypeError", () => {
  const model = completeProjects();
  const invalidQueries = [
    undefined,
    null,
    "search=react",
    { ...emptyQuery(), search: undefined },
    { ...emptyQuery(), categoryIds: undefined },
    { ...emptyQuery(), categoryIds: "web" },
    { ...emptyQuery(), tags: [1, 2] },
    { ...emptyQuery(), sortChoiceId: undefined },
  ];
  for (const query of invalidQueries) {
    assert.throws(
      () => renderToStaticMarkup(React.createElement(Projects, { model, query })),
      (error) => error instanceof ValidationError && error.code === "view.validation_failed" && error.modelKind === "projects",
      `expected a typed ValidationError for query ${JSON.stringify(query)}`,
    );
  }
});

test("S14.3 TextSizeControl exposes an accessible radiogroup with accurate checked state", () => {
  const model = textSizeModel();
  const markup = renderToStaticMarkup(React.createElement(TextSizeControl, { model, value: "large", onChange: () => {} }));
  assert.match(markup, /role="radiogroup"/);
  assert.match(markup, /aria-label="Text size"/);
  assert.match(markup, /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*data-szd-portfolio-selected="true"[^>]*>Large<\/button>/);
  assert.match(markup, /<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>Small<\/button>/);
  assert.doesNotMatch(markup, /id="/);
});

test("S14.3 ReaderModeControl exposes an accessible, controlled checkbox with accurate state", () => {
  const model = readerModeModel();
  const on = renderToStaticMarkup(React.createElement(ReaderModeControl, { model, enabled: true, onChange: () => {} }));
  assert.match(on, /checked=""/);
  assert.match(on, />On<\/span>/);
  assert.match(on, /data-szd-portfolio-selected="true"/);
  const off = renderToStaticMarkup(React.createElement(ReaderModeControl, { model, enabled: false, onChange: () => {} }));
  assert.doesNotMatch(off, /checked=""/);
  assert.match(off, />Off<\/span>/);
  assert.doesNotMatch(off, /data-szd-portfolio-selected/);
});

test("S14.5 two simultaneous instances of Projects, TextSizeControl, and ReaderModeControl have no package-owned DOM id or state collision", () => {
  const model = completeProjects();
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, [
    React.createElement(Projects, { model, query: { ...emptyQuery(), categoryIds: ["web"] }, key: "first" }),
    React.createElement(Projects, { model, query: { ...emptyQuery(), categoryIds: ["mobile"] }, key: "second" }),
    React.createElement(TextSizeControl, { model: textSizeModel(), value: "small", onChange: () => {}, key: "small-control" }),
    React.createElement(TextSizeControl, { model: textSizeModel(), value: "large", onChange: () => {}, key: "large-control" }),
    React.createElement(ReaderModeControl, { model: readerModeModel(), enabled: true, onChange: () => {}, key: "reader-a" }),
    React.createElement(ReaderModeControl, { model: readerModeModel(), enabled: false, onChange: () => {}, key: "reader-b" }),
  ]));
  assert.doesNotMatch(markup, /id="/);
  assert.doesNotMatch(markup, /\sname="/);
  assert.match(markup, /Alpha/);
  assert.match(markup, /Beta/);
});

test("S14 owns only namespaced DOM and CSS names across Projects, TextSize, and ReaderMode markup", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../src/index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  for (const name of css.matchAll(/\.(szd-[a-z0-9-]+)/g)) assert.match(name[1], /^szd-portfolio-/);
  for (const name of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) assert.match(name[1], /^--szd-portfolio-/);
  for (const name of css.matchAll(/\[([^\]=]+)[^\]]*\]/g)) assert.match(name[1], /^data-szd-portfolio-/);

  const model = completeProjects();
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, [
    React.createElement(Projects, { model, query: emptyQuery(), key: "projects" }),
    React.createElement(TextSizeControl, { model: textSizeModel(), value: "small", onChange: () => {}, key: "text-size" }),
    React.createElement(ReaderModeControl, { model: readerModeModel(), enabled: true, onChange: () => {}, key: "reader-mode" }),
  ]));
  for (const attribute of markup.matchAll(/\s(data-[a-z0-9-]+)=/g)) assert.match(attribute[1], /^data-szd-portfolio-/);
  for (const classAttribute of markup.matchAll(/\sclass="([^"]+)"/g)) {
    for (const className of classAttribute[1].split(" ")) assert.match(className, /^szd-portfolio-/);
  }
  assert.doesNotMatch(source, /\.css["']/);
});

test("S14.6 source and export graph contain no administration, authentication, storage-implementation, drag/drop, audit, Docusaurus, or Infima dependency", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /isAdmin|authenticat|drag.?drop|audit|docusaurus|infima|localStorage|sessionStorage/i);
});
