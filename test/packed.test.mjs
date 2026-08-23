import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const root = new URL("..", import.meta.url).pathname;

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

test("S16.1 and S16.5 the data-json entry resolves a declared id through a consumer-supplied loader, and Data.Json stays absent from the root install", async (t) => {
  const { stdout } = await execFile("npm", ["pack", "--json"], { cwd: root });
  const [{ filename }] = JSON.parse(stdout);
  const tarball = join(root, filename);
  t.after(async () => rm(tarball, { force: true }));

  const consumer = await mkdtemp(join(tmpdir(), "szd-portfolio-data-json-"));
  t.after(async () => rm(consumer, { recursive: true, force: true }));
  await writeFile(join(consumer, "package.json"), JSON.stringify({ type: "module" }));
  await execFile("npm", ["install", "--no-package-lock", "--legacy-peer-deps", tarball, "react@19.2.8", "react-dom@19.2.8", "subzerodev-data-json@0.2.0"], { cwd: consumer });
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
