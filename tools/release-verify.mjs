// Runs the release verification gates named in design/30-slices.md S21.4 and
// assembles the release record S21.6 requires: every gate's outcome, whether
// `git diff --check` passes, whether the source evidence repositories named
// by src/builder/provenance.json are unchanged, and an explicit statement
// that no publish, tag, deploy, consumer migration, or default-branch merge
// occurred (true by construction - this script invokes none of them).
//
// Two categories in S21.4 (import-graph, tree-shaking) have no fixture in
// this repository yet; they report DidNotRun with a reason rather than being
// silently omitted (AGENTS.md, "no silent caps").

import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

// `node --test` over these suites emits a line per assertion, which crosses
// execFile's 1 MB default and would reject a passing gate with ENOBUFS.
const MAX_GATE_OUTPUT_BYTES = 64 * 1024 * 1024;

// Failure detail is bounded so one runaway gate cannot dominate the record,
// but a truncated detail always says so rather than ending mid-line as if it
// were the whole output (AGENTS.md, "no silent caps").
const DETAIL_LIMIT = 4000;

export const GATE_DEFINITIONS = [
  { id: "typecheck", command: ["npm", ["run", "typecheck"]] },
  { id: "unit", command: ["node", ["--test", "test/builder.test.mjs", "test/browser.test.mjs"]] },
  { id: "validator", command: ["node", ["--test", "test/portfolio.test.mjs", "test/projects.test.mjs", "test/data-json.test.mjs"]] },
  { id: "ssr-hydration", command: ["node", ["--test", "test/browser.test.mjs", "test/portfolio.test.mjs"]] },
  { id: "interaction", command: ["node", ["--test", "test/projects.test.mjs"]] },
  { id: "accessibility", command: ["node", ["--test", "test/portfolio.test.mjs", "test/projects.test.mjs"]] },
  { id: "css-dom-namespace", command: ["node", ["--test", "test/portfolio.test.mjs", "test/projects.test.mjs", "test/browser.test.mjs", "test/builder.test.mjs"]] },
  { id: "import-graph", command: null, reason: "no import-graph fixture exists in this repository yet (design/90-decisions.md Open)" },
  { id: "tree-shaking", command: null, reason: "no tree-shaking/bundle-analysis fixture exists in this repository yet (design/90-decisions.md Open)" },
  { id: "artifact-fault-injection", command: ["node", ["--test", "test/builder.test.mjs", "test/cli.test.mjs"]] },
  { id: "action-workflow", command: ["node", ["--test", "test/delivery.test.mjs"]] },
  { id: "react-major", command: ["node", ["--test", "test/packed.test.mjs"]] },
  { id: "data-json", command: ["node", ["--test", "test/data-json.test.mjs", "test/packed.test.mjs"]] },
  { id: "packed-tarball", command: ["node", ["--test", "test/packed.test.mjs"]] },
];

/** Runs one gate definition and returns a GateResultV1-shaped object. */
export async function runGate(definition, { exec = execFile, cwd } = {}) {
  const { id, command, reason } = definition;
  if (!command) return { id, status: "not-run", detail: reason };
  const [file, args] = command;
  try {
    await exec(file, args, { cwd, maxBuffer: MAX_GATE_OUTPUT_BYTES });
    return { id, status: "passed" };
  } catch (error) {
    const raw = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n");
    const detail = raw.length > DETAIL_LIMIT
      ? `${raw.slice(0, DETAIL_LIMIT)}\n[truncated: ${raw.length - DETAIL_LIMIT} further characters of gate output not recorded]`
      : raw;
    return { id, status: "failed", detail };
  }
}

/**
 * Runs every gate in order. A gate that throws unexpectedly still yields a
 * result for every other gate. Gates declaring a byte-identical command share
 * one execution - several categories deliberately point at the same fixture
 * file, and re-running it cannot produce a different answer.
 */
export async function runAllGates(definitions = GATE_DEFINITIONS, options = {}) {
  const results = [];
  const byCommand = new Map();
  for (const definition of definitions) {
    const key = definition.command ? JSON.stringify(definition.command) : null;
    if (key !== null && byCommand.has(key)) {
      results.push({ ...byCommand.get(key), id: definition.id });
      continue;
    }
    const result = await runGate(definition, options);
    if (key !== null) byCommand.set(key, result);
    results.push(result);
  }
  return results;
}

/** Pure assembly of the release record from already-computed gate results and evidence checks. Exported for testing without spawning anything. */
export function buildReleaseRecord({ gates, gitDiffCheckPassed, gitDiffCheckEvaluated = true, gitDiffCheckDetail, sourceEvidence, noExternalStateChanged = true }) {
  const notRun = gates.filter((g) => g.status === "not-run");
  return {
    version: 1,
    gates,
    gatesThatDidNotRun: notRun.map((g) => ({ id: g.id, reason: g.detail ?? "no reason given" })),
    gitDiffCheckPassed,
    gitDiffCheckEvaluated,
    ...(gitDiffCheckDetail === undefined ? {} : { gitDiffCheckDetail }),
    sourceEvidence,
    noExternalStateChanged,
  };
}

/**
 * `git diff --check` exits 1 for whitespace errors and 128 for a fatal
 * condition (no repository, no work tree), and fails to spawn entirely when
 * git is absent. Only the first of those is a real "did not pass" - reporting
 * the others as `false` would state a check result never obtained
 * (AGENTS.md, "Verification").
 */
export async function checkGitWhitespace(cwd, { exec = execFile } = {}) {
  try {
    await exec("git", ["diff", "--check"], { cwd, maxBuffer: MAX_GATE_OUTPUT_BYTES });
    return { passed: true, evaluated: true };
  } catch (error) {
    if (error.code === 1) {
      return { passed: false, evaluated: true, detail: (error.stdout || "").slice(0, DETAIL_LIMIT) || "git diff --check reported whitespace errors" };
    }
    return { passed: false, evaluated: false, detail: `not evaluated: ${error.message}` };
  }
}

/**
 * Confirms a provenance role's recorded commit is still part of its evidence
 * repository's history - reachable as HEAD or an ancestor of it - so a
 * rewritten or force-pushed baseline is caught rather than assumed. The
 * evidence repo's *current* working-tree state is irrelevant to whether the
 * already-recorded baseline changed, so this does not re-derive `clean`.
 */
export async function checkSourceEvidenceRole(role, roleName, { exec = execFile } = {}, localPath) {
  if (!localPath) {
    return { role: roleName, status: "not-evaluated", detail: `no local checkout path supplied for ${role.repository}` };
  }
  try {
    const { stdout: headStdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: localPath });
    const head = headStdout.trim();
    const commitReachable = head === role.commit
      ? true
      : await exec("git", ["merge-base", "--is-ancestor", role.commit, "HEAD"], { cwd: localPath }).then(() => true, () => false);
    return {
      role: roleName,
      status: commitReachable ? "unchanged" : "changed",
      detail: `HEAD=${head} recordedCommit=${role.commit}${commitReachable ? "" : " (not found in this repository's history)"}`,
    };
  } catch (error) {
    return { role: roleName, status: "not-evaluated", detail: error.message };
  }
}

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

/** A local checkout laid out as this repository's own sibling directory, named after the evidence repository - this maintainer's dev-machine convention, not a consumer default. */
function siblingCheckoutPath(repositoryUrl) {
  const name = repositoryUrl.replace(/\.git$/, "").split("/").pop();
  const candidate = join(dirname(packageRoot.replace(/[\\/]$/, "")), name);
  return candidate;
}

export async function evaluateSourceEvidence() {
  let provenance;
  try {
    provenance = JSON.parse(await readFile(join(packageRoot, "src/builder/provenance.json"), "utf8"));
  } catch (error) {
    return [{ role: "provenance", status: "not-evaluated", detail: `could not read provenance manifest: ${error.message}` }];
  }
  const roles = Object.entries(provenance).filter(([, value]) => value && typeof value === "object" && "commit" in value && "repository" in value);
  const results = [];
  for (const [roleName, role] of roles) {
    const localPath = siblingCheckoutPath(role.repository);
    // `.git` - a directory in a normal clone, a file in a worktree or
    // submodule - is what makes the checkout answerable by `git rev-parse`.
    // An evidence repository need not be an npm package.
    const exists = await stat(join(localPath, ".git")).then(() => true, () => false);
    results.push(await checkSourceEvidenceRole(role, roleName, {}, exists ? localPath : undefined));
  }
  return results;
}

async function main() {
  // Every gate command names its fixtures relative to the package root, so
  // the run must not inherit whatever directory the process was launched
  // from - a wrong cwd would report twelve gate failures that never happened.
  const gates = await runAllGates(GATE_DEFINITIONS, { cwd: packageRoot });
  const gitDiffCheck = await checkGitWhitespace(packageRoot);
  const record = buildReleaseRecord({
    gates,
    gitDiffCheckPassed: gitDiffCheck.passed,
    gitDiffCheckEvaluated: gitDiffCheck.evaluated,
    gitDiffCheckDetail: gitDiffCheck.detail,
    sourceEvidence: await evaluateSourceEvidence(),
  });
  await mkdir(new URL("../release/", import.meta.url), { recursive: true });
  await writeFile(new URL("../release/verification-report.json", import.meta.url), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`release verification: ${gates.filter((g) => g.status === "passed").length}/${gates.length} passed, ${record.gatesThatDidNotRun.length} did not run\n`);
  process.exitCode = gates.some((g) => g.status === "failed") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
