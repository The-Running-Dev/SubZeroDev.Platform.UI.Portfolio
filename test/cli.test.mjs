import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
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
const source = defineSource({ id: "portfolio", timing: "build", provider: { kind: "fixture", publicDescriptor: [], resolve: async () => ({ value: ${JSON.stringify(model)}, metadata: [] }) }, validateRaw: (value) => ({ ok: true, value }), project: (value) => value, viewModel: { kind: "portfolio", validate: (value) => value && value.version === 1 ? { ok: true, value } : { ok: false, issues: [] } } });
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

test("S17.1 and S17.5 CLI check --root <path> --config <path> reports one concise success line without an --out-dir", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "check", "--root", dir, "--config", "site.mjs"]);
  assert.match(stdout, /^check sha256:\S+\n$/);
  await assert.rejects(readFile(join(dir, "out")));
});

test("S17.2 and S17.5 CLI check reports ordered redacted gate diagnostics to stderr on failure", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "szd-portfolio-cli-check-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const config = `import { definePortfolioSite, defineSource } from ${JSON.stringify(builderUrl)};
export default definePortfolioSite({ version: 1, metadata: { title: "Fixture" }, routes: [{ path: "/work", metadata: { title: "Route" }, presentation: { kind: "portfolio", modelSourceId: "missing" }, requiredSourceIds: ["missing"] }], sources: [], styles: [], navigation: [], publicAssets: [] });`;
  await writeFile(join(dir, "site.mjs"), config);
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "check", "--root", dir, "--config", "site.mjs"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /^check\.failed: /);
      assert.match(error.stderr, /config: failed/);
      assert.match(error.stderr, /provenance: not-run/);
      assert.doesNotMatch(error.stderr, /missing/);
      return true;
    },
  );
});

test("S17.1 and S17.5 CLI check rejects an omitted --config without mutating the source repository", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "check", "--root", dir]),
    (error) => error.code === 1 && /^config\.invalid: Every check path is required/.test(error.stderr),
  );
  await assert.rejects(readFile(join(dir, "out")));
});

test("S17.5 CLI check --help prints usage without loading configuration", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "help"]),
    (error) => error.code === 1 && /^usage: /.test(error.stderr),
  );
});

test("S18.1 CLI dev --root <path> --config <path> --out-dir <path> --host <host> --port <port> binds and reports its address", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const child = spawn(process.execPath, [cliPath, "dev", "--root", dir, "--config", "site.mjs", "--out-dir", "out", "--host", "127.0.0.1", "--port", "0"]);
  t.after(() => child.kill());
  let stdout = "";
  await new Promise((resolveReady, rejectReady) => {
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); if (/^dev http:\/\//m.test(stdout)) resolveReady(); });
    child.once("error", rejectReady);
    child.once("exit", (code) => rejectReady(new Error(`dev exited early with code ${code}`)));
  });
  assert.match(stdout, /^dev http:\/\/127\.0\.0\.1:\d+\n/);
  await assert.rejects(readFile(join(dir, "out")));
});

test("S18.1 CLI dev rejects a missing --port without mutating output", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "dev", "--root", dir, "--config", "site.mjs", "--out-dir", "out", "--host", "127.0.0.1"]),
    (error) => error.code === 1 && /^config\.invalid: /.test(error.stderr),
  );
  await assert.rejects(readFile(join(dir, "out")));
});

test("S19.1 CLI preview --root <path> --config <path> --out-dir <path> --host <host> --port <port> completes an ordinary build, binds, and reports its address", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  const child = spawn(process.execPath, [cliPath, "preview", "--root", dir, "--config", "site.mjs", "--out-dir", "out", "--host", "127.0.0.1", "--port", "0"]);
  t.after(() => child.kill());
  let stdout = "";
  await new Promise((resolveReady, rejectReady) => {
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); if (/^preview http:\/\//m.test(stdout)) resolveReady(); });
    child.once("error", rejectReady);
    child.once("exit", (code) => rejectReady(new Error(`preview exited early with code ${code}`)));
  });
  assert.match(stdout, /^preview http:\/\/127\.0\.0\.1:\d+\n/);
  await assert.doesNotReject(readFile(join(dir, "out/.szd-portfolio-artifact.json")));
});

test("S19.1 CLI preview rejects a missing --port without mutating output", async (t) => {
  const dir = await fixture(); t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "preview", "--root", dir, "--config", "site.mjs", "--out-dir", "out", "--host", "127.0.0.1"]),
    (error) => error.code === 1 && /^config\.invalid: /.test(error.stderr),
  );
  await assert.rejects(readFile(join(dir, "out")));
});
