import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// No YAML parser is a dependency of this package (design/00-brief.md, "In
// scope" lists no such dependency), so these read action.yml and
// deploy-pages.yml as text rather than parsing them.

const actionYml = await readFile(new URL("../action.yml", import.meta.url), "utf8");
const deployYml = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

function inputBlock(source, name) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trim() === `${name}:`);
  assert.ok(start >= 0, `expected an input named ${name}`);
  const indent = lines[start].match(/^\s*/)[0].length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => {
    if (line.trim() === "") return false;
    const lineIndent = line.match(/^\s*/)[0].length;
    return lineIndent <= indent;
  });
  return rest.slice(0, end === -1 ? rest.length : end).join("\n");
}

test("S21.2 action.yml requires an exact package-version with no default and never defaults it to latest", () => {
  const block = inputBlock(actionYml, "package-version");
  assert.match(block, /required:\s*true/);
  assert.doesNotMatch(block, /default:/);
  assert.doesNotMatch(actionYml, /default:\s*latest/);
});

test("S21.2 action.yml requires an exact command with no default", () => {
  const block = inputBlock(actionYml, "command");
  assert.match(block, /required:\s*true/);
  assert.doesNotMatch(block, /default:/);
});

for (const name of ["root", "config", "out-dir", "artifact-dir", "target-dir", "protect"]) {
  test(`S21.2 action.yml declares an optional ${name} input with no default`, () => {
    const block = inputBlock(actionYml, name);
    assert.match(block, /required:\s*false/);
    assert.doesNotMatch(block, /default:/);
  });
}

test("S21.2 action.yml does not interpolate any input directly into the run: text", () => {
  const runIndex = actionYml.indexOf("run: |");
  assert.ok(runIndex >= 0);
  const runText = actionYml.slice(runIndex);
  assert.doesNotMatch(runText, /\$\{\{\s*inputs\./);
});

test("S21.2 action.yml reaches every input through env: as a quoted shell variable and forwards it only when set", () => {
  for (const [name, envVar, flag] of [
    ["root", "ROOT", "--root"],
    ["config", "CONFIG", "--config"],
    ["out-dir", "OUT_DIR", "--out-dir"],
    ["artifact-dir", "ARTIFACT_DIR", "--artifact-dir"],
    ["target-dir", "TARGET_DIR", "--target-dir"],
  ]) {
    assert.ok(actionYml.includes(`${envVar}: \${{ inputs.${name} }}`), `expected ${envVar} to be bound from inputs.${name}`);
    assert.ok(actionYml.includes(`if [ -n "$${envVar}" ]; then args+=(${flag} "$${envVar}"); fi`), `expected ${name} forwarded conditionally via ${flag}`);
  }
});

test("S21.2 action.yml installs the exact requested package-version, not a floating tag", () => {
  assert.ok(actionYml.includes('npm install --global "subzerodev-platform-ui-portfolio@$PACKAGE_VERSION"'));
});

for (const name of ["package-version", "root", "config", "out-dir", "target-dir"]) {
  test(`S21.3 deploy-pages.yml declares a ${name} input`, () => {
    inputBlock(deployYml, name);
  });
}

test("S21.3 deploy-pages.yml requires package-version, root, config, out-dir, and target-dir with no default", () => {
  for (const name of ["package-version", "root", "config", "out-dir", "target-dir"]) {
    const block = inputBlock(deployYml, name);
    assert.match(block, /required:\s*true/, `${name} must be required`);
    assert.doesNotMatch(block, /default:/, `${name} must have no default`);
  }
});

test("S21.3 deploy-pages.yml declares optional protect and docs-artifact inputs with no default", () => {
  for (const name of ["protect", "docs-artifact"]) {
    const block = inputBlock(deployYml, name);
    assert.match(block, /required:\s*false/);
    assert.doesNotMatch(block, /default:/);
  }
});

test("S21.3 deploy-pages.yml has no on.push, on.schedule, or workflow_dispatch trigger - only workflow_call", () => {
  assert.match(deployYml, /^on:\s*\n\s*workflow_call:/m);
  assert.doesNotMatch(deployYml, /^\s*push:/m);
  assert.doesNotMatch(deployYml, /^\s*schedule:/m);
  assert.doesNotMatch(deployYml, /^\s*workflow_dispatch:/m);
});

test("S21.3 deploy-pages.yml declares no concurrency group", () => {
  // Anchored with \s* so a job-level concurrency block - the natural place
  // for one in a Pages workflow - is caught too, not only a top-level key.
  assert.doesNotMatch(deployYml, /^\s*concurrency:/m);
});

test("S21.3 deploy-pages.yml names no domain, CNAME, or custom-domain value", () => {
  assert.doesNotMatch(deployYml, /cname/i);
  assert.doesNotMatch(deployYml, /custom-domain/i);
});

test("S21.3 deploy-pages.yml's deploy job declares exactly the permissions its steps require", () => {
  const jobBlock = deployYml.slice(deployYml.indexOf("jobs:"));
  const permissionsBlock = inputBlock(jobBlock, "permissions");
  const granted = [...permissionsBlock.matchAll(/^\s*([a-z-]+):\s*(read|write)\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(new Set(granted), new Set(["contents", "pages", "id-token"]));
  assert.ok(deployYml.includes("actions/checkout"), "contents: read is used by checkout");
  assert.ok(deployYml.includes("upload-pages-artifact"), "pages: write is used by the Pages artifact upload");
  assert.ok(deployYml.includes("deploy-pages"), "id-token: write is used by the Pages deployment");
});

test("S21.3 deploy-pages.yml invokes the composite action via a same-repository relative path, not a pinned external reference", () => {
  const uses = [...deployYml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  const actionUses = uses.filter((u) => u === "./");
  assert.equal(actionUses.length, 2, "expected the build and merge steps both to reference the local action");
});

test("S21.3 deploy-pages.yml forwards package-version, root, config, and out-dir to the build step only, and artifact-dir/target-dir/protect to the merge step only", () => {
  const steps = deployYml.split(/^\s{6}-\s/m).slice(1);
  const buildStep = steps.find((step) => step.includes("command: build"));
  const mergeStep = steps.find((step) => step.includes("command: merge"));
  assert.ok(buildStep, "expected a build step");
  assert.ok(mergeStep, "expected a merge step");
  for (const name of ["package-version", "root", "config", "out-dir"]) {
    assert.ok(buildStep.includes(`${name}: \${{ inputs.${name} }}`), `build step should pass ${name}`);
  }
  assert.doesNotMatch(mergeStep, /root:/);
  assert.doesNotMatch(mergeStep, /config:/);
  for (const name of ["artifact-dir", "target-dir", "protect"]) {
    assert.ok(mergeStep.includes(`${name}:`), `merge step should pass ${name}`);
  }
});
