#!/usr/bin/env node
import { buildPortfolioSite } from "./builder.js";
const [command, ...args] = process.argv.slice(2);
const values = {}; for (let i = 0; i < args.length; i += 2) { if (!args[i]?.startsWith("--") || !args[i + 1]) { process.stderr.write("usage: subzerodev-platform-ui-portfolio build --root <path> --config <path> --out-dir <path>\n"); process.exitCode = 1; break; } values[args[i].slice(2)] = args[i + 1]; }
if (process.exitCode !== 1 && command !== "build") { process.stderr.write("usage: subzerodev-platform-ui-portfolio build --root <path> --config <path> --out-dir <path>\n"); process.exitCode = 1; }
else if (process.exitCode !== 1) { try { const result = await buildPortfolioSite({ rootDir: values.root, configPath: values.config, outDir: values["out-dir"] }); process.stdout.write(`build ${result.record.artifactDigest}\n`); } catch (error) { process.stderr.write(`${error.code ?? "build.failed"}: ${error.message}\n`); process.exitCode = 1; } }
