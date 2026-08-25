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
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

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
    await exec(file, args, { cwd });
    return { id, status: "passed" };
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n").slice(0, 4000);
    return { id, status: "failed", detail };
  }
}

/** Runs every gate in order. A gate that throws unexpectedly still yields a result for every other gate. */
export async function runAllGates(definitions = GATE_DEFINITIONS, options = {}) {
  const results = [];
  for (const definition of definitions) results.push(await runGate(definition, options));
  return results;
}

/** Pure assembly of the release record from already-computed gate results and evidence checks. Exported for testing without spawning anything. */
export function buildReleaseRecord({ gates, gitDiffCheckPassed, sourceEvidence, noExternalStateChanged = true }) {
  const notRun = gates.filter((g) => g.status === "not-run");
  return {
    version: 1,
    gates,
    gatesThatDidNotRun: notRun.map((g) => ({ id: g.id, reason: g.detail ?? "no reason given" })),
    gitDiffCheckPassed,
    sourceEvidence,
    noExternalStateChanged,
  };
}

/** Compares a provenance role's recorded {repository, commit, clean} against the actual local checkout named by localPath, when reachable. */
export async function checkSourceEvidenceRole(role, roleName, { exec = execFile } = {}, localPath) {
  if (!localPath) {
    return { role: roleName, status: "not-evaluated", detail: `no local checkout path supplied for ${role.repository}` };
  }
  try {
    const { stdout: headStdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: localPath });
    const head = headStdout.trim();
    const { stdout: statusStdout } = await exec("git", ["status", "--porcelain"], { cwd: localPath });
    const clean = statusStdout.trim().length === 0;
    const commitReachable = head === role.commit
      ? true
      : await exec("git", ["merge-base", "--is-ancestor", role.commit, "HEAD"], { cwd: localPath }).then(() => true, () => false);
    return {
      role: roleName,
      status: commitReachable && clean === role.clean ? "unchanged" : "changed",
      detail: `HEAD=${head} recordedCommit=${role.commit} recordedClean=${role.clean} actualClean=${clean}`,
    };
  } catch (error) {
    return { role: roleName, status: "not-evaluated", detail: error.message };
  }
}

async function main() {
  const gates = await runAllGates();
  const record = buildReleaseRecord({
    gates,
    gitDiffCheckPassed: await execFile("git", ["diff", "--check"]).then(() => true, () => false),
    sourceEvidence: [{ role: "deliveryMechanics", status: "not-evaluated", detail: "run checkSourceEvidenceRole against a known local checkout to confirm" }],
  });
  await writeFile(new URL("../release/verification-report.json", import.meta.url), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`release verification: ${gates.filter((g) => g.status === "passed").length}/${gates.length} passed, ${record.gatesThatDidNotRun.length} did not run\n`);
  process.exitCode = gates.some((g) => g.status === "failed") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
