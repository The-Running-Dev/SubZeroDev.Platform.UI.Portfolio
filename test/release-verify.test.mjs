import assert from "node:assert/strict";
import test from "node:test";
import { GATE_DEFINITIONS, buildReleaseRecord, checkSourceEvidenceRole, runAllGates, runGate } from "../tools/release-verify.mjs";

test("S21.4 every named gate category from design/30-slices.md S21.4 has a definition", () => {
  const ids = new Set(GATE_DEFINITIONS.map((g) => g.id));
  for (const expected of ["typecheck", "unit", "validator", "ssr-hydration", "interaction", "accessibility", "css-dom-namespace", "import-graph", "tree-shaking", "artifact-fault-injection", "action-workflow", "react-major", "data-json", "packed-tarball"]) {
    assert.ok(ids.has(expected), `expected a gate definition for ${expected}`);
  }
  assert.equal(GATE_DEFINITIONS.length, 14);
});

test("S21.4 a gate with a command that succeeds reports passed with no detail", async () => {
  const exec = async () => ({ stdout: "", stderr: "" });
  const result = await runGate({ id: "example", command: ["true", []] }, { exec });
  assert.deepEqual(result, { id: "example", status: "passed" });
});

test("S21.4 a gate whose command throws reports failed with pasted output as detail, not a one-word label", async () => {
  const exec = async () => { const e = new Error("exit 1"); e.stdout = "1 test failed\n  at line 12"; e.stderr = ""; throw e; };
  const result = await runGate({ id: "example", command: ["false", []] }, { exec });
  assert.equal(result.status, "failed");
  assert.ok(result.detail.length >= 15, "detail must be long enough to plausibly be pasted output");
  assert.ok(result.detail.includes("1 test failed"));
});

test("S21.4 a gate with no command reports not-run and carries its reason as detail", async () => {
  const result = await runGate({ id: "import-graph", command: null, reason: "no fixture yet" });
  assert.deepEqual(result, { id: "import-graph", status: "not-run", detail: "no fixture yet" });
});

test("S21.4 runAllGates returns one result per definition, in order, even when some fail", async () => {
  const definitions = [
    { id: "a", command: ["true", []] },
    { id: "b", command: null, reason: "no fixture" },
    { id: "c", command: ["false", []] },
  ];
  const exec = async (file) => { if (file === "false") throw Object.assign(new Error("boom"), { stdout: "boom output that is long enough" }); return { stdout: "", stderr: "" }; };
  const results = await runAllGates(definitions, { exec });
  assert.deepEqual(results.map((r) => r.id), ["a", "b", "c"]);
  assert.deepEqual(results.map((r) => r.status), ["passed", "not-run", "failed"]);
});

test("S21.6 buildReleaseRecord lists every DidNotRun gate with its reason", () => {
  const gates = [
    { id: "typecheck", status: "passed" },
    { id: "import-graph", status: "not-run", detail: "no fixture yet" },
    { id: "tree-shaking", status: "not-run", detail: "no fixture yet either" },
  ];
  const record = buildReleaseRecord({ gates, gitDiffCheckPassed: true, sourceEvidence: [] });
  assert.deepEqual(record.gatesThatDidNotRun, [
    { id: "import-graph", reason: "no fixture yet" },
    { id: "tree-shaking", reason: "no fixture yet either" },
  ]);
});

test("S21.6 buildReleaseRecord asserts no external state changed by construction, never inferred from a gate result", () => {
  const record = buildReleaseRecord({ gates: [], gitDiffCheckPassed: true, sourceEvidence: [] });
  assert.equal(record.noExternalStateChanged, true);
});

test("S21.6 buildReleaseRecord carries the git diff --check outcome verbatim, not inferred from gate status", () => {
  const failing = buildReleaseRecord({ gates: [{ id: "typecheck", status: "passed" }], gitDiffCheckPassed: false, sourceEvidence: [] });
  assert.equal(failing.gitDiffCheckPassed, false);
});

test("S21.6 checkSourceEvidenceRole reports not-evaluated when no local checkout path is supplied", async () => {
  const role = { repository: "https://example.test/repo.git", commit: "abc123", clean: true };
  const result = await checkSourceEvidenceRole(role, "deliveryMechanics", {}, undefined);
  assert.equal(result.status, "not-evaluated");
  assert.equal(result.role, "deliveryMechanics");
});

test("S21.6 checkSourceEvidenceRole reports unchanged when HEAD equals the recorded commit exactly", async () => {
  const role = { repository: "https://example.test/repo.git", commit: "abc123" };
  const exec = async (file, args) => {
    if (args[0] === "rev-parse") return { stdout: "abc123\n" };
    throw new Error("unexpected call");
  };
  const result = await checkSourceEvidenceRole(role, "deliveryMechanics", { exec }, "/some/local/path");
  assert.equal(result.status, "unchanged");
});

test("S21.6 checkSourceEvidenceRole reports unchanged when the recorded commit is an ancestor of a later HEAD", async () => {
  const role = { repository: "https://example.test/repo.git", commit: "abc123" };
  const exec = async (file, args) => {
    if (args[0] === "rev-parse") return { stdout: "def456\n" };
    if (args[0] === "merge-base") return { stdout: "" };
    throw new Error("unexpected call");
  };
  const result = await checkSourceEvidenceRole(role, "deliveryMechanics", { exec }, "/some/local/path");
  assert.equal(result.status, "unchanged");
});

test("S21.6 checkSourceEvidenceRole reports changed when the recorded commit is not reachable from HEAD (rewritten or force-pushed history)", async () => {
  const role = { repository: "https://example.test/repo.git", commit: "abc123" };
  const exec = async (file, args) => {
    if (args[0] === "rev-parse") return { stdout: "def456\n" };
    if (args[0] === "merge-base") throw new Error("not an ancestor");
    throw new Error("unexpected call");
  };
  const result = await checkSourceEvidenceRole(role, "deliveryMechanics", { exec }, "/some/local/path");
  assert.equal(result.status, "changed");
});
