import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const root = fileURLToPath(new URL("..", import.meta.url));

test("S10.1, S10.6, and S12.6 packed entries install, SSR-render, and Vite-bundle with React 18 and 19", async (t) => {
  const { stdout } = await execFile("npm", ["pack", "--json"], { cwd: root });
  const [{ filename }] = JSON.parse(stdout);
  const tarball = join(root, filename);
  t.after(async () => rm(tarball, { force: true }));

  for (const reactVersion of ["18.3.1", "19.2.8"]) {
    const consumer = await mkdtemp(join(tmpdir(), "szd-portfolio-packed-"));
    t.after(async () => rm(consumer, { recursive: true, force: true }));
    await writeFile(join(consumer, "package.json"), JSON.stringify({ type: "module" }));
    await execFile("npm", ["install", "--no-package-lock", tarball, `react@${reactVersion}`, `react-dom@${reactVersion}`], { cwd: consumer });
    await writeFile(join(consumer, "entry.js"), [
      'import React from "react";',
      'import { renderToStaticMarkup } from "react-dom/server";',
      'import { Portfolio, validatePortfolioViewModelV1 } from "subzerodev-platform-ui-portfolio";',
      'const model = { version: 1, header: { title: "Packed" }, statistics: [], categories: [], technologies: [], recentProjects: [] };',
      'if (!validatePortfolioViewModelV1(model).ok) throw new Error("validation failed");',
      'const html = renderToStaticMarkup(React.createElement(Portfolio, { model }));',
      'if (!html.includes("szd-portfolio-overview")) throw new Error("SSR failed");',
    ].join("\n"));
    await writeFile(join(consumer, "index.html"), '<script type="module" src="/entry.js"></script>');
    await execFile("node", ["entry.js"], { cwd: consumer });
    await execFile("npm", ["install", "--no-package-lock", "vite@8.2.2"], { cwd: consumer });
    await execFile("npx", ["vite", "build", "--outDir", "dist"], { cwd: consumer });
    const assets = await readdir(join(consumer, "dist", "assets"));
    assert.equal(assets.some((asset) => asset.endsWith(".css")), false);
    const consumerManifest = JSON.parse(await readFile(join(consumer, "node_modules", "subzerodev-platform-ui-portfolio", "package.json"), "utf8"));
    assert.deepEqual(Object.keys(consumerManifest.dependencies ?? {}), []);
    assert.deepEqual(consumerManifest.exports["./builder"], {
      types: "./src/builder.d.ts",
      default: "./src/builder.js",
    });
    assert.deepEqual(consumerManifest.exports["./browser"], {
      types: "./src/browser.d.ts",
      default: "./src/browser.js",
    });
    assert.deepEqual(consumerManifest.exports["./data-json"], {
      types: "./src/data-json.d.ts",
      default: "./src/data-json.js",
    });
  }
});

test("S16.1 and S16.5 the data-json entry resolves a declared id through a peer-clean consumer install, and Data.Json stays absent from the root install", async (t) => {
  const { stdout } = await execFile("npm", ["pack", "--json"], { cwd: root });
  const [{ filename }] = JSON.parse(stdout);
  const tarball = join(root, filename);
  t.after(async () => rm(tarball, { force: true }));

  const consumer = await mkdtemp(join(tmpdir(), "szd-portfolio-data-json-"));
  t.after(async () => rm(consumer, { recursive: true, force: true }));
  await writeFile(join(consumer, "package.json"), JSON.stringify({ type: "module" }));
  await execFile("npm", ["install", "--no-package-lock", tarball, "react@18.3.1", "react-dom@18.3.1", "subzerodev-data-json@0.2.0"], { cwd: consumer });
  await writeFile(join(consumer, "entry.js"), [
    'import { createJsonLoader } from "subzerodev-data-json";',
    'import { defineSource, portfolioViewModelV1Contract, resolveSource, validatePortfolioViewModelV1 } from "subzerodev-platform-ui-portfolio";',
    'import { createDataJsonProvider } from "subzerodev-platform-ui-portfolio/data-json";',
    'const model = { version: 1, header: { title: "Data.Json packed" }, statistics: [], categories: [], technologies: [], recentProjects: [] };',
    'if (!validatePortfolioViewModelV1(model).ok) throw new Error("fixture is invalid");',
    'const loader = createJsonLoader({ version: 1, sources: { portfolio: { at: "build", inline: model } } });',
    'const provider = createDataJsonProvider({ id: "portfolio", loader, publicDescriptor: [{ name: "id", value: "portfolio" }] });',
    'const source = defineSource({ id: "portfolio", timing: "build", provider, validateRaw: validatePortfolioViewModelV1, project: (raw) => raw, viewModel: portfolioViewModelV1Contract });',
    'const resolution = await resolveSource(source, { cancelled: false, onCancel: () => () => {} });',
    'if (resolution.status !== "ready") throw new Error(`expected ready, got ${resolution.status}`);',
    'if (resolution.data.header.title !== "Data.Json packed") throw new Error("resolved value mismatch");',
  ].join("\n"));
  await execFile("node", ["entry.js"], { cwd: consumer });
  const rootManifest = JSON.parse(await readFile(join(consumer, "node_modules", "subzerodev-platform-ui-portfolio", "package.json"), "utf8"));
  assert.deepEqual(rootManifest.dependencies ?? {}, {});
});

test("S21.5 the packed tarball proves contracted files, declarations, CSS side effects, peer ranges, and absence of consumer data and Docusaurus", async (t) => {
  const { stdout } = await execFile("npm", ["pack", "--json"], { cwd: root });
  const [{ filename, files }] = JSON.parse(stdout);
  const tarball = join(root, filename);
  t.after(async () => rm(tarball, { force: true }));

  const packedPaths = files.map((f) => f.path);
  const allowedTopLevel = new Set(["package.json", "README.md"]);
  assert.ok(packedPaths.every((p) => allowedTopLevel.has(p) || p.startsWith("src/")), `unexpected packed path outside src/, package.json, or README.md: ${packedPaths.filter((p) => !allowedTopLevel.has(p) && !p.startsWith("src/"))}`);
  for (const declared of ["src/index.js", "src/index.d.ts", "src/builder.js", "src/builder.d.ts", "src/browser.js", "src/browser.d.ts", "src/data-json.js", "src/data-json.d.ts", "src/styles.css", "src/cli.js"]) {
    assert.ok(packedPaths.includes(declared), `expected ${declared} in packed tarball`);
  }
  // src/builder.js reads builder/provenance.json on every build, check, and
  // merge, so the manifest is a shipped runtime input, not a repository-only
  // fixture - omitting it would fail every consumer command with
  // `provenance.invalid`. What must not ship beside it is anything else.
  assert.ok(packedPaths.includes("src/builder/provenance.json"), "the bundled provenance manifest must ship - src/builder.js reads it on every command");
  assert.deepEqual(packedPaths.filter((p) => p.startsWith("src/builder/")), ["src/builder/provenance.json"], "src/builder/ must contain the provenance manifest and nothing else");

  const consumer = await mkdtemp(join(tmpdir(), "szd-portfolio-inspect-"));
  t.after(async () => rm(consumer, { recursive: true, force: true }));
  await writeFile(join(consumer, "package.json"), JSON.stringify({ type: "module" }));
  await execFile("npm", ["install", "--no-package-lock", tarball, "react@18.3.1", "react-dom@18.3.1"], { cwd: consumer });
  const manifest = JSON.parse(await readFile(join(consumer, "node_modules", "subzerodev-platform-ui-portfolio", "package.json"), "utf8"));

  assert.equal(manifest.peerDependencies.react, "^18.0.0 || ^19.0.0");
  assert.equal(manifest.peerDependencies["react-dom"], "^18.0.0 || ^19.0.0");
  assert.equal(manifest.peerDependencies["subzerodev-data-json"], "^0.2.0");
  assert.equal(manifest.peerDependenciesMeta["subzerodev-data-json"].optional, true);
  assert.deepEqual(manifest.sideEffects, ["./src/styles.css"]);

  const manifestText = JSON.stringify(manifest).toLowerCase();
  assert.ok(!manifestText.includes("docusaurus"), "packed manifest must declare no Docusaurus dependency");
  assert.ok(!Object.keys(manifest.dependencies ?? {}).length, "a root install must add no transitive dependency");

  const consumerFiles = await readdir(join(consumer, "node_modules", "subzerodev-platform-ui-portfolio", "src"));
  for (const forbidden of ["portfolio.json", "cv.json", "config.js", "config.ts", "site.config.js"]) {
    assert.ok(!consumerFiles.includes(forbidden), `packed tarball must not embed consumer-authored ${forbidden}`);
  }
});
