import React from "react";

const linkProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

/** @typedef {(string | number)[]} IssuePath */

function issue(code, path, message) {
  return { code, path, message };
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pushUnknownFields(value, allowed, path, issues) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(issue("view.unknown_field", [...path, key], "Unknown field."));
    }
  }
}

function validateRequiredString(value, path, issues) {
  if (!isNonEmptyString(value)) {
    issues.push(issue("view.required_string", path, "A non-empty string is required."));
    return false;
  }
  return true;
}

function validateStringArray(value, path, issues) {
  if (!Array.isArray(value)) {
    issues.push(issue("view.expected_array", path, "An array is required."));
    return false;
  }
  value.forEach((item, index) => validateRequiredString(item, [...path, index], issues));
  return true;
}

function validateLink(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(issue("view.expected_object", path, "A link object is required."));
    return;
  }
  const allowed = new Set(["label", "href", "accessibleLabel", "target"]);
  validateRequiredString(value.label, [...path, "label"], issues);
  if (value.href !== undefined) {
    if (!isNonEmptyString(value.href)) {
      issues.push(issue("view.invalid_link", [...path, "href"], "A link href must be non-empty."));
    } else if (!value.href.startsWith("#")) {
      try {
        const url = new URL(value.href);
        if (!linkProtocols.has(url.protocol)) {
          issues.push(issue("view.invalid_link", [...path, "href"], "Unsupported link protocol."));
        }
      } catch {
        issues.push(issue("view.invalid_link", [...path, "href"], "A link href must be explicit."));
      }
    }
  }
  if (value.accessibleLabel !== undefined) {
    validateRequiredString(value.accessibleLabel, [...path, "accessibleLabel"], issues);
  }
  if (value.target !== undefined && value.target !== "same-context" && value.target !== "new-context") {
    issues.push(issue("view.invalid_link_target", [...path, "target"], "Unsupported link target."));
  }
  if (value.target === "new-context" && !isNonEmptyString(value.href)) {
    issues.push(issue("view.invalid_link_target", [...path, "target"], "A new context requires an href."));
  }
  pushUnknownFields(value, allowed, path, issues);
}

function validatePeriod(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(issue("view.expected_object", path, "A period object is required."));
    return;
  }
  const allowed = new Set(["start", "end", "ongoing"]);
  validateRequiredString(value.start, [...path, "start"], issues);
  if (typeof value.ongoing !== "boolean") {
    issues.push(issue("view.expected_boolean", [...path, "ongoing"], "A boolean is required."));
  }
  if (value.end !== undefined) {
    validateRequiredString(value.end, [...path, "end"], issues);
  }
  if (value.ongoing === true && value.end !== undefined) {
    issues.push(issue("view.inconsistent_period", [...path, "end"], "An ongoing period cannot have an end."));
  }
  if (value.ongoing === false && value.end === undefined) {
    issues.push(issue("view.inconsistent_period", [...path, "end"], "A completed period requires an end."));
  }
  pushUnknownFields(value, allowed, path, issues);
}

function validateUniqueId(value, path, seen, issues) {
  if (!isNonEmptyString(value)) {
    validateRequiredString(value, path, issues);
    return;
  }
  if (seen.has(value)) {
    issues.push(issue("view.duplicate_id", path, "Stable ids must be unique."));
    return;
  }
  seen.add(value);
}

/**
 * Validates the version-one Portfolio rendering model without accepting
 * consumer-owned raw shapes or unknown properties.
 *
 * @param {unknown} input
 * @returns {{ readonly ok: true, readonly value: unknown } | { readonly ok: false, readonly issues: readonly { readonly code: string, readonly path: readonly (string | number)[], readonly message: string }[] }}
 */
export function validatePortfolioViewModelV1(input) {
  const issues = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue("view.expected_object", [], "A Portfolio model object is required.")] };
  }

  const allowed = new Set(["version", "header", "statistics", "categories", "technologies", "recentProjects"]);
  if (input.version !== 1) {
    issues.push(issue("view.unsupported_version", ["version"], "Portfolio version 1 is required."));
  }

  if (!isRecord(input.header)) {
    issues.push(issue("view.expected_object", ["header"], "A header object is required."));
  } else {
    validateRequiredString(input.header.title, ["header", "title"], issues);
    if (input.header.summary !== undefined) {
      validateRequiredString(input.header.summary, ["header", "summary"], issues);
    }
    pushUnknownFields(input.header, new Set(["title", "summary"]), ["header"], issues);
  }

  const categoryIds = new Set();
  if (!Array.isArray(input.statistics)) {
    issues.push(issue("view.expected_array", ["statistics"], "An array is required."));
  } else {
    const ids = new Set();
    input.statistics.forEach((statistic, index) => {
      const path = ["statistics", index];
      if (!isRecord(statistic)) {
        issues.push(issue("view.expected_object", path, "A statistic object is required."));
        return;
      }
      validateUniqueId(statistic.id, [...path, "id"], ids, issues);
      validateRequiredString(statistic.label, [...path, "label"], issues);
      validateRequiredString(statistic.value, [...path, "value"], issues);
      pushUnknownFields(statistic, new Set(["id", "label", "value"]), path, issues);
    });
  }

  if (!Array.isArray(input.categories)) {
    issues.push(issue("view.expected_array", ["categories"], "An array is required."));
  } else {
    input.categories.forEach((category, index) => {
      const path = ["categories", index];
      if (!isRecord(category)) {
        issues.push(issue("view.expected_object", path, "A category object is required."));
        return;
      }
      validateUniqueId(category.id, [...path, "id"], categoryIds, issues);
      validateRequiredString(category.label, [...path, "label"], issues);
      if (category.count !== undefined && !Number.isFinite(category.count)) {
        issues.push(issue("view.non_finite_number", [...path, "count"], "A count must be finite."));
      }
      pushUnknownFields(category, new Set(["id", "label", "count"]), path, issues);
    });
  }

  if (!Array.isArray(input.technologies)) {
    issues.push(issue("view.expected_array", ["technologies"], "An array is required."));
  } else {
    const ids = new Set();
    input.technologies.forEach((technology, index) => {
      const path = ["technologies", index];
      if (!isRecord(technology)) {
        issues.push(issue("view.expected_object", path, "A technology object is required."));
        return;
      }
      validateUniqueId(technology.id, [...path, "id"], ids, issues);
      validateRequiredString(technology.label, [...path, "label"], issues);
      if (technology.iconKey !== undefined) {
        validateRequiredString(technology.iconKey, [...path, "iconKey"], issues);
      }
      if (technology.link !== undefined) {
        validateLink(technology.link, [...path, "link"], issues);
      }
      pushUnknownFields(technology, new Set(["id", "label", "iconKey", "link"]), path, issues);
    });
  }

  if (!Array.isArray(input.recentProjects)) {
    issues.push(issue("view.expected_array", ["recentProjects"], "An array is required."));
  } else {
    const ids = new Set();
    input.recentProjects.forEach((project, index) => {
      const path = ["recentProjects", index];
      if (!isRecord(project)) {
        issues.push(issue("view.expected_object", path, "A project object is required."));
        return;
      }
      validateUniqueId(project.id, [...path, "id"], ids, issues);
      validateRequiredString(project.title, [...path, "title"], issues);
      validateRequiredString(project.summary, [...path, "summary"], issues);
      if (validateStringArray(project.categoryIds, [...path, "categoryIds"], issues)) {
        project.categoryIds.forEach((categoryId, categoryIndex) => {
          if (isNonEmptyString(categoryId) && !categoryIds.has(categoryId)) {
            issues.push(issue("view.unknown_category", [...path, "categoryIds", categoryIndex], "Project category must be declared."));
          }
        });
      }
      validateStringArray(project.tags, [...path, "tags"], issues);
      validateStringArray(project.technologies, [...path, "technologies"], issues);
      validateLinks(project.links, [...path, "links"], issues);
      if (project.period !== undefined) {
        validatePeriod(project.period, [...path, "period"], issues);
      }
      pushUnknownFields(project, new Set(["id", "title", "summary", "categoryIds", "tags", "technologies", "period", "links"]), path, issues);
    });
  }

  pushUnknownFields(input, allowed, [], issues);
  return issues.length === 0 ? { ok: true, value: input } : { ok: false, issues };
}

export class ValidationError extends Error {
  constructor(code, message, options) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ValidationError";
    this.code = code;
    this.modelKind = options.modelKind;
    this.issues = options.issues;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function selectLinkDestination(link) {
  return link.href === undefined ? undefined : link.href;
}

export function flattenPortfolioTechnologies(model) {
  return model.recentProjects.flatMap((project) => [...project.technologies]);
}

function validationResult(input, kind, validate) {
  const issues = [];
  if (!isRecord(input)) return { ok: false, issues: [issue("view.expected_object", [], `A ${kind} model object is required.`)] };
  validate(input, issues);
  return issues.length === 0 ? { ok: true, value: input } : { ok: false, issues };
}
function validateText(value, path, issues) {
  if (!isRecord(value) || !["text", "rich-text-slot"].includes(value.kind)) { issues.push(issue("view.invalid_text", path, "A text value is required.")); return; }
  if (value.kind === "text") validateRequiredString(value.value, [...path, "value"], issues);
  else validateRequiredString(value.slotId, [...path, "slotId"], issues);
  pushUnknownFields(value, value.kind === "text" ? new Set(["kind", "value"]) : new Set(["kind", "slotId"]), path, issues);
}
function validateLinks(value, path, issues) { if (!Array.isArray(value)) issues.push(issue("view.expected_array", path, "An array is required.")); else value.forEach((link, i) => validateLink(link, [...path, i], issues)); }
function validateIdArray(value, path, kindLabel, issues, validateItem) {
  if (!Array.isArray(value)) { issues.push(issue("view.expected_array", path, "An array is required.")); return; }
  const ids = new Set();
  value.forEach((item, index) => {
    const itemPath = [...path, index];
    if (!isRecord(item)) { issues.push(issue("view.expected_object", itemPath, `A ${kindLabel} is required.`)); return; }
    validateUniqueId(item.id, [...itemPath, "id"], ids, issues);
    validateItem(item, itemPath, issues);
  });
}

export function validateSiteChromeViewModelV1(input) {
  return validationResult(input, "site chrome", (value, issues) => {
    if (value.version !== 1) issues.push(issue("view.unsupported_version", ["version"], "Version 1 is required."));
    if (!isRecord(value.identity)) issues.push(issue("view.expected_object", ["identity"], "An identity is required.")); else { validateRequiredString(value.identity.name, ["identity", "name"], issues); if (value.identity.subtitle !== undefined) validateRequiredString(value.identity.subtitle, ["identity", "subtitle"], issues); if (value.identity.iconKey !== undefined) validateRequiredString(value.identity.iconKey, ["identity", "iconKey"], issues); pushUnknownFields(value.identity, new Set(["name", "subtitle", "iconKey"]), ["identity"], issues); }
    for (const field of ["primaryNavigation", "secondaryNavigation"]) { const seen = new Set(); if (!Array.isArray(value[field])) issues.push(issue("view.expected_array", [field], "An array is required.")); else value[field].forEach((item, i) => { const path = [field, i]; if (!isRecord(item)) return issues.push(issue("view.expected_object", path, "A navigation item is required.")); validateUniqueId(item.id, [...path, "id"], seen, issues); if (item.kind === "link") validateLink(item.link, [...path, "link"], issues); else if (item.kind === "text") validateRequiredString(item.label, [...path, "label"], issues); else if (item.kind === "group") { validateRequiredString(item.label, [...path, "label"], issues); validateLinks(item.items, [...path, "items"], issues); } else issues.push(issue("view.invalid_navigation", [...path, "kind"], "A supported navigation kind is required.")); }); }
    if (value.footer !== undefined) { if (!isRecord(value.footer)) issues.push(issue("view.expected_object", ["footer"], "A footer is required.")); else { validateRequiredString(value.footer.text, ["footer", "text"], issues); validateLinks(value.footer.links, ["footer", "links"], issues); pushUnknownFields(value.footer, new Set(["text", "links"]), ["footer"], issues); } }
    pushUnknownFields(value, new Set(["version", "identity", "primaryNavigation", "secondaryNavigation", "footer"]), [], issues);
  });
}

export function validateCVViewModelV1(input) {
  return validationResult(input, "CV", (value, issues) => {
    if (value.version !== 1) issues.push(issue("view.unsupported_version", ["version"], "Version 1 is required."));
    if (!isRecord(value.header)) {
      issues.push(issue("view.expected_object", ["header"], "A header is required."));
    } else {
      validateRequiredString(value.header.name, ["header", "name"], issues);
      if (value.header.headline !== undefined) validateRequiredString(value.header.headline, ["header", "headline"], issues);
      validateLinks(value.header.contact, ["header", "contact"], issues);
      pushUnknownFields(value.header, new Set(["name", "headline", "contact"]), ["header"], issues);
    }
    const ids = new Set();
    if (!Array.isArray(value.sections)) {
      issues.push(issue("view.expected_array", ["sections"], "An array is required."));
    } else {
      value.sections.forEach((section, i) => {
        const path = ["sections", i];
        if (!isRecord(section)) { issues.push(issue("view.expected_object", path, "A section is required.")); return; }
        validateUniqueId(section.id, [...path, "id"], ids, issues);
        validateRequiredString(section.heading, [...path, "heading"], issues);
        if (section.kind === "summary") {
          validateText(section.body, [...path, "body"], issues);
          pushUnknownFields(section, new Set(["kind", "id", "heading", "body"]), path, issues);
        } else if (section.kind === "roles") {
          validateIdArray(section.roles, [...path, "roles"], "role", issues, (role, rp, issues) => {
            validateRequiredString(role.title, [...rp, "title"], issues);
            validateRequiredString(role.organization, [...rp, "organization"], issues);
            validatePeriod(role.period, [...rp, "period"], issues);
            if (role.summary !== undefined) validateText(role.summary, [...rp, "summary"], issues);
            if (!Array.isArray(role.achievements)) issues.push(issue("view.expected_array", [...rp, "achievements"], "An array is required.")); else role.achievements.forEach((item, k) => validateText(item, [...rp, "achievements", k], issues));
            validateStringArray(role.technologies, [...rp, "technologies"], issues);
            pushUnknownFields(role, new Set(["id", "title", "organization", "period", "summary", "achievements", "technologies"]), rp, issues);
          });
          pushUnknownFields(section, new Set(["kind", "id", "heading", "roles"]), path, issues);
        } else if (section.kind === "projects") {
          validateIdArray(section.projects, [...path, "projects"], "project", issues, (project, pp, issues) => {
            validateRequiredString(project.name, [...pp, "name"], issues);
            if (project.summary !== undefined) validateText(project.summary, [...pp, "summary"], issues);
            validateStringArray(project.technologies, [...pp, "technologies"], issues);
            if (project.link !== undefined) validateLink(project.link, [...pp, "link"], issues);
            pushUnknownFields(project, new Set(["id", "name", "summary", "technologies", "link"]), pp, issues);
          });
          pushUnknownFields(section, new Set(["kind", "id", "heading", "projects"]), path, issues);
        } else if (section.kind === "education") {
          validateIdArray(section.items, [...path, "items"], "education item", issues, (item, ep, issues) => {
            validateRequiredString(item.institution, [...ep, "institution"], issues);
            validateRequiredString(item.qualification, [...ep, "qualification"], issues);
            if (item.period !== undefined) validateRequiredString(item.period, [...ep, "period"], issues);
            pushUnknownFields(item, new Set(["id", "institution", "qualification", "period"]), ep, issues);
          });
          pushUnknownFields(section, new Set(["kind", "id", "heading", "items"]), path, issues);
        } else if (section.kind === "achievements") {
          if (!Array.isArray(section.items)) issues.push(issue("view.expected_array", [...path, "items"], "An array is required.")); else section.items.forEach((item, j) => validateText(item, [...path, "items", j], issues));
          pushUnknownFields(section, new Set(["kind", "id", "heading", "items"]), path, issues);
        } else {
          issues.push(issue("view.invalid_section", [...path, "kind"], "A supported section is required."));
        }
      });
    }
    pushUnknownFields(value, new Set(["version", "header", "sections"]), [], issues);
  });
}
export function validateVersionDisplayViewModelV1(input) { return validationResult(input, "version display", (value, issues) => { if (value.version !== 1) issues.push(issue("view.unsupported_version", ["version"], "Version 1 is required.")); validateRequiredString(value.text, ["text"], issues); if (value.prefix !== undefined) validateRequiredString(value.prefix, ["prefix"], issues); if (value.link !== undefined) validateLink(value.link, ["link"], issues); pushUnknownFields(value, new Set(["version", "text", "prefix", "link"]), [], issues); }); }

function renderLink(link, content, key) {
  const href = selectLinkDestination(link);
  if (href === undefined) {
    return React.createElement("span", { className: "szd-portfolio-link", key }, content);
  }
  const newContext = link.target === "new-context";
  return React.createElement("a", {
    className: "szd-portfolio-link",
    key,
    href,
    "aria-label": link.accessibleLabel,
    target: newContext ? "_blank" : undefined,
    rel: newContext ? "noopener noreferrer" : undefined,
  }, content);
}

function checked(model, kind, validator) { const result = validator(model); if (!result.ok) throw new ValidationError("view.validation_failed", `${kind} view model is invalid.`, { modelKind: kind, issues: result.issues }); }
function navigationItem(item, key) { if (item.kind === "link") return renderLink(item.link, item.link.label, key); if (item.kind === "text") return React.createElement("span", { className: "szd-portfolio-navigation-text", key }, item.label); return React.createElement("span", { className: "szd-portfolio-navigation-group", key }, [React.createElement("span", { key: "label" }, item.label), ...item.items.map((link, i) => renderLink(link, link.label, `${key}-${i}`))]); }
export function SiteChrome({ model, renderIcon }) { checked(model, "site-chrome", validateSiteChromeViewModelV1); return React.createElement("header", { className: "szd-portfolio-site-chrome" }, [React.createElement("div", { className: "szd-portfolio-identity", key: "identity" }, [model.identity.iconKey === undefined || renderIcon === undefined ? null : React.createElement("span", { className: "szd-portfolio-icon", "aria-hidden": "true", key: "icon" }, renderIcon(model.identity.iconKey)), React.createElement("span", { className: "szd-portfolio-identity-name", key: "name" }, model.identity.name), model.identity.subtitle && React.createElement("span", { className: "szd-portfolio-identity-subtitle", key: "subtitle" }, model.identity.subtitle)]), React.createElement("nav", { className: "szd-portfolio-primary-navigation", "aria-label": "Primary navigation", key: "primary" }, model.primaryNavigation.map((item) => navigationItem(item, item.id))), React.createElement("nav", { className: "szd-portfolio-secondary-navigation", "aria-label": "Secondary navigation", key: "secondary" }, model.secondaryNavigation.map((item) => navigationItem(item, item.id))), model.footer && React.createElement("footer", { className: "szd-portfolio-footer", key: "footer" }, [React.createElement("span", { key: "text" }, model.footer.text), ...model.footer.links.map((link, i) => renderLink(link, link.label, `footer-${i}`))])]); }
function renderCVText(text, slots, key) { return text.kind === "text" ? text.value : slots.get(text.slotId) ?? null; }
function renderCVPeriod(period, key) { return React.createElement("p", { className: "szd-portfolio-cv-period", key }, period.ongoing ? `${period.start} – Present` : `${period.start} – ${period.end}`); }
function renderCVAchievements(items, slots, keyPrefix) { return items.length === 0 ? null : React.createElement("ul", { className: "szd-portfolio-cv-achievements", key: `${keyPrefix}-achievements` }, items.map((item, index) => React.createElement("li", { key: index }, renderCVText(item, slots, `${keyPrefix}-achievement-${index}`)))); }
function renderCVTechnologies(technologies, keyPrefix) { return technologies.length === 0 ? null : React.createElement("ul", { className: "szd-portfolio-cv-technologies", key: `${keyPrefix}-technologies` }, technologies.map((technology) => React.createElement("li", { key: technology }, technology))); }
function renderCVSectionContent(section, slots) {
  if (section.kind === "summary") return React.createElement("p", { key: "body" }, renderCVText(section.body, slots, "body"));
  if (section.kind === "roles") return section.roles.map((role) => React.createElement("article", { className: "szd-portfolio-cv-role", key: role.id }, [
    React.createElement("h3", { key: "title" }, role.title),
    React.createElement("p", { className: "szd-portfolio-cv-organization", key: "organization" }, role.organization),
    renderCVPeriod(role.period, "period"),
    role.summary && React.createElement("p", { key: "summary" }, renderCVText(role.summary, slots, "summary")),
    renderCVAchievements(role.achievements, slots, role.id),
    renderCVTechnologies(role.technologies, role.id),
  ]));
  if (section.kind === "projects") return section.projects.map((project) => React.createElement("article", { className: "szd-portfolio-cv-project", key: project.id }, [
    React.createElement("h3", { key: "name" }, project.link === undefined ? project.name : renderLink(project.link, project.name, "link")),
    project.summary && React.createElement("p", { key: "summary" }, renderCVText(project.summary, slots, "summary")),
    renderCVTechnologies(project.technologies, project.id),
  ]));
  if (section.kind === "education") return section.items.map((item) => React.createElement("article", { className: "szd-portfolio-cv-education", key: item.id }, [
    React.createElement("h3", { key: "institution" }, item.institution),
    React.createElement("p", { key: "qualification" }, item.qualification),
    item.period && React.createElement("p", { className: "szd-portfolio-cv-period", key: "period" }, item.period),
  ]));
  return renderCVAchievements(section.items, slots, section.id);
}
export function CV({ model, richTextSlots = [] }) {
  checked(model, "cv", validateCVViewModelV1);
  const slots = new Map(richTextSlots.map((slot) => [slot.id, slot.content]));
  return React.createElement("main", { className: "szd-portfolio-cv" }, [
    React.createElement("header", { className: "szd-portfolio-cv-header", key: "header" }, [
      React.createElement("h1", { key: "name" }, model.header.name),
      model.header.headline && React.createElement("p", { key: "headline" }, model.header.headline),
      model.header.contact.length === 0 ? null : React.createElement("div", { className: "szd-portfolio-cv-contact", key: "contact" }, model.header.contact.map((link, index) => renderLink(link, link.label, `contact-${index}`))),
    ]),
    ...model.sections.map((section) => React.createElement("section", { className: "szd-portfolio-cv-section", key: section.id }, [
      React.createElement("h2", { key: "heading" }, section.heading),
      renderCVSectionContent(section, slots),
    ])),
  ]);
}
export function VersionDisplay({ model }) { checked(model, "version-display", validateVersionDisplayViewModelV1); const text = model.prefix === undefined ? model.text : `${model.prefix} ${model.text}`; return React.createElement("span", { className: "szd-portfolio-version" }, model.link === undefined ? text : renderLink(model.link, text, "version")); }

export function Portfolio({ model, renderIcon }) {
  checked(model, "portfolio", validatePortfolioViewModelV1);

  const children = [
    React.createElement("header", { className: "szd-portfolio-header", key: "header" }, [
      React.createElement("h1", { className: "szd-portfolio-title", key: "title" }, model.header.title),
      model.header.summary === undefined ? null : React.createElement("p", { className: "szd-portfolio-summary", key: "summary" }, model.header.summary),
    ]),
  ];

  if (model.statistics.length > 0) {
    children.push(React.createElement("dl", { className: "szd-portfolio-statistics", key: "statistics" }, model.statistics.map((statistic) =>
      React.createElement("div", { className: "szd-portfolio-statistic", key: statistic.id }, [
        React.createElement("dt", { className: "szd-portfolio-statistic-label", key: "label" }, statistic.label),
        React.createElement("dd", { className: "szd-portfolio-statistic-value", key: "value" }, statistic.value),
      ]),
    )));
  }

  if (model.categories.length > 0) {
    children.push(React.createElement("ul", { className: "szd-portfolio-categories", key: "categories" }, model.categories.map((category) =>
      React.createElement("li", { className: "szd-portfolio-category", key: category.id }, category.count === undefined ? category.label : `${category.label} (${category.count})`),
    )));
  }

  if (model.technologies.length > 0) {
    children.push(React.createElement("ul", { className: "szd-portfolio-technologies", key: "technologies" }, model.technologies.map((technology) => {
      const label = React.createElement(React.Fragment, null, [
        technology.iconKey === undefined || renderIcon === undefined ? null : React.createElement("span", { className: "szd-portfolio-icon", "aria-hidden": "true", key: "icon" }, renderIcon(technology.iconKey)),
        React.createElement("span", { className: "szd-portfolio-technology-label", key: "label" }, technology.label),
      ]);
      return React.createElement("li", { className: "szd-portfolio-technology", key: technology.id }, technology.link === undefined
        ? React.createElement("span", { className: "szd-portfolio-link" }, label)
        : renderLink(technology.link, label, technology.id));
    })));
  }

  if (model.recentProjects.length > 0) {
    children.push(React.createElement("section", { className: "szd-portfolio-projects", key: "projects", "aria-label": "Recent projects" }, model.recentProjects.map((project) =>
      React.createElement("article", { className: "szd-portfolio-project", key: project.id }, [
        React.createElement("h2", { className: "szd-portfolio-project-title", key: "title" }, project.title),
        React.createElement("p", { className: "szd-portfolio-project-summary", key: "summary" }, project.summary),
        React.createElement("ul", { className: "szd-portfolio-project-technologies", key: "technologies" }, project.technologies.map((technology) => React.createElement("li", { className: "szd-portfolio-project-technology", key: technology }, technology))),
        project.links.length === 0 ? null : React.createElement("div", { className: "szd-portfolio-project-links", key: "links" }, project.links.map((link, index) => renderLink(link, link.label, `${project.id}-link-${index}`))),
      ]),
    )));
  }

  return React.createElement("main", { className: "szd-portfolio-overview" }, children);
}
