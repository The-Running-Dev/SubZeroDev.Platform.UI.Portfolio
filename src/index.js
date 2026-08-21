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
      if (!Array.isArray(project.links)) {
        issues.push(issue("view.expected_array", [...path, "links"], "An array is required."));
      } else {
        project.links.forEach((link, linkIndex) => validateLink(link, [...path, "links", linkIndex], issues));
      }
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

export function Portfolio({ model, renderIcon }) {
  const validation = validatePortfolioViewModelV1(model);
  if (!validation.ok) {
    throw new ValidationError("view.validation_failed", "Portfolio view model is invalid.", {
      modelKind: "portfolio",
      issues: validation.issues,
    });
  }

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
