import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const root = new URL("..", import.meta.url).pathname;

test("S10.1 and S10.6 packed root installs, SSR-renders, and Vite-bundles with React 18 and 19", async (t) => {
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
    assert.equal(consumerManifest.exports["./builder"], undefined);
    assert.equal(consumerManifest.exports["./browser"], undefined);
    assert.equal(consumerManifest.exports["./data-json"], undefined);
  }
});
