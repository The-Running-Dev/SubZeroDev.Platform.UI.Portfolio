import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = new URL("..", import.meta.url).pathname;
const cliPath = join(root, "src/cli.js");
const builderUrl = pathToFileURL(join(root, "src/builder.js")).href;
const model = { version: 1, header: { title: "Built" }, statistics: [], categories: [], technologies: [], recentProjects: [] };

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-cli-"));
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
const source = defineSource({ id: "portfolio", timing: "build", provider: { resolve: async () => ({ value: ${JSON.stringify(model)}, metadata: [] }) }, validateRaw: (value) => ({ ok: true, value }), project: (value) => value, viewModel: { validate: (value) => value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] } } });
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: "/work", metadata: { title: "Route" }, presentation: { kind: "portfolio", modelSourceId: "portfolio" }, requiredSourceIds: ["portfolio"] }], sources: [source], styles: [], navigation: [], publicAssets: [] });`;
  await writeFile(join(dir, "site.mjs"), config);
  return dir;
}

test("S11.1 CLI build --root <path> --config <path> --out-dir <path> produces an artifact", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "build", "--root", dir, "--config", "site.mjs", "--out-dir", "out"]);
  assert.match(stdout, /^build sha256:/);
  assert.match(await readFile(join(dir, "out/work/index.html"), "utf8"), /szd-portfolio-overview/);
});

test("S11.1 CLI rejects a build missing --out-dir without mutating output", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "build", "--root", dir, "--config", "site.mjs"]),
    (error) => error.code === 1 && /config\.invalid: Every build path is required/.test(error.stderr),
  );
  await assert.rejects(readFile(join(dir, "out")));
});

test("S11.1 CLI rejects an unparseable flag pair with usage before touching output", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "build", "--root"]),
    (error) => error.code === 1 && /^usage: /.test(error.stderr),
  );
  await assert.rejects(readFile(join(dir, "out")));
});

test("S11.1 CLI rejects an unknown command with usage", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "serve"]),
    (error) => error.code === 1 && /^usage: /.test(error.stderr),
  );
});
