#!/usr/bin/env node
import { buildPortfolioSite, checkPortfolioSite } from "./builder.js";

const usage = "usage: subzerodev-platform-ui-portfolio build --root <path> --config <path> --out-dir <path>\n"
  + "       subzerodev-platform-ui-portfolio check --root <path> --config <path>\n";

function fail(message) { process.stderr.write(message); process.exitCode = 1; }

const [command, ...args] = process.argv.slice(2);
const values = {};
let parseFailed = false;
for (let i = 0; i < args.length; i += 2) {
  if (!args[i]?.startsWith("--") || !args[i + 1]) { parseFailed = true; break; }
  values[args[i].slice(2)] = args[i + 1];
}

if (parseFailed) {
  fail(usage);
} else if (command === "build") {
  try {
    const result = await buildPortfolioSite({ rootDir: values.root, configPath: values.config, outDir: values["out-dir"] });
    process.stdout.write(`build ${result.record.artifactDigest}\n`);
  } catch (error) {
    fail(`${error.code ?? "build.failed"}: ${error.message}\n`);
  }
} else if (command === "check") {
  try {
    const result = await checkPortfolioSite({ rootDir: values.root, configPath: values.config });
    process.stdout.write(`check ${result.record.artifactDigest}\n`);
  } catch (error) {
    let message = `${error.code ?? "check.failed"}: ${error.message}\n`;
    for (const gate of error.gates ?? []) message += `  ${gate.id}: ${gate.status}${gate.detail ? ` (${gate.detail})` : ""}\n`;
    fail(message);
  }
} else {
  fail(usage);
}
