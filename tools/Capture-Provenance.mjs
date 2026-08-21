#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const excludedTemplateRoots = ["node_modules", ".docusaurus", "artifacts", "build"];

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function run(command, args, { input } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`));
        return;
      }
      resolveRun(Buffer.concat(stdout));
    });
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}

function parseArgs(argv) {
  const values = { observedTags: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near '${flag ?? "<end>"}'.`);
    if (flag === "--observed-tag") values.observedTags.push(value);
    else values[flag.slice(2)] = value;
  }
  for (const name of ["delivery", "consumer", "image", "template-path", "output"]) {
    if (!values[name]) throw new Error(`--${name} is required.`);
  }
  if (!/^.+@sha256:[0-9a-f]{64}$/.test(values.image)) {
    throw new Error("--image must be an immutable name@sha256:<digest> reference.");
  }
  return values;
}

async function git(repo, ...args) {
  return run("git", ["-C", repo, ...args]);
}

async function trackedSnapshot(repo) {
  const status = (await git(repo, "status", "--porcelain=v1", "--untracked-files=all")).toString("utf8");
  if (status !== "") throw new Error(`Evidence repository '${repo}' is not clean.`);

  const commit = (await git(repo, "rev-parse", "HEAD")).toString("utf8").trim();
  const repository = (await git(repo, "remote", "get-url", "origin")).toString("utf8").trim();
  const paths = (await git(repo, "ls-tree", "-r", "-z", "--name-only", "HEAD"))
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const files = [];
  for (const path of paths) {
    const bytes = await git(repo, "show", `HEAD:${path}`);
    files.push({ path, digest: digest(bytes) });
  }
  return { repository, commit, files, paths };
}

async function inventory(root) {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Template inventory contains symlink '${relative(root, absolute)}'.`);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        files.push({
          path: relative(root, absolute).split(sep).join("/"),
          digest: digest(await readFile(absolute)),
        });
      }
    }
  }
  await walk(root);
  return files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function contained(root, path) {
  const destination = resolve(root, path);
  if (destination !== root && !destination.startsWith(`${root}${sep}`)) throw new Error(`Tracked path escapes overlay root: '${path}'.`);
  return destination;
}

async function writeSnapshot(repo, paths, target) {
  for (const path of paths) {
    const destination = contained(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await git(repo, "show", `HEAD:${path}`));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deliveryPath = resolve(args.delivery);
  const consumerPath = resolve(args.consumer);
  const outputPath = resolve(args.output);
  const work = await mkdtemp(join(tmpdir(), "szd-portfolio-provenance-"));
  try {
    const [delivery, consumer] = await Promise.all([
      trackedSnapshot(deliveryPath),
      trackedSnapshot(consumerPath),
    ]);

    const templateRoot = join(work, "template");
    await mkdir(templateRoot);
    const templateTar = await run("docker", [
      "run", "--rm", "--entrypoint", "tar", args.image,
      "-C", args["template-path"],
      ...excludedTemplateRoots.map((path) => `--exclude=./${path}`),
      "-cf", "-", ".",
    ]);
    await run("tar", ["-xf", "-", "-C", templateRoot], { input: templateTar });
    const templateFiles = await inventory(templateRoot);
    if (templateFiles.length === 0) throw new Error("The pinned image produced an empty template inventory.");

    const effectiveRoot = join(work, "effective");
    await cp(templateRoot, effectiveRoot, { recursive: true });
    await writeSnapshot(consumerPath, consumer.paths, effectiveRoot);
    await rm(join(effectiveRoot, "src/pages/index.md"), { force: true });
    const effectiveFiles = await inventory(effectiveRoot);

    const imageDigest = args.image.slice(args.image.indexOf("sha256:"));
    const manifest = {
      version: 1,
      manifestDigest: "",
      deliveryMechanics: {
        repository: delivery.repository,
        commit: delivery.commit,
        files: delivery.files,
      },
      consumerOverlay: {
        repository: consumer.repository,
        commit: consumer.commit,
        clean: true,
        files: consumer.files,
      },
      effectiveTemplateOverlay: {
        imageDigest,
        observedTags: args.observedTags,
        templateFiles,
        overlayRules: [
          { order: 1, operation: "include", path: `${args["template-path"]}/** (excluding ${excludedTemplateRoots.join(", ")})` },
          { order: 2, operation: "replace", path: `${consumer.repository}@${consumer.commit}:tracked-files` },
          { order: 3, operation: "exclude", path: "src/pages/index.md" },
        ],
        effectiveFiles,
        effectiveTreeDigest: digest(Buffer.from(canonical(effectiveFiles))),
      },
    };
    manifest.manifestDigest = digest(Buffer.from(canonical(manifest)));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${canonical(manifest)}\n`);
    process.stdout.write(`${manifest.manifestDigest} ${templateFiles.length} template files ${effectiveFiles.length} effective files\n`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

await main();
