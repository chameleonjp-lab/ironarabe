#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { RUNTIME_FILES, PUBLIC_FILES, RELEASE_CONTRACT, assertSha, integrity, validateHtml, listPublicFiles, verifyArtifact } = require("./verify-github-pages.cjs");

function git(source, args, encoding = "utf8") {
  return execFileSync("git", ["-C", source, ...args], { encoding, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 });
}

function readRuntime(source, file) {
  let current = source;
  const segments = file.split("/");
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    let stats;
    try { stats = fs.lstatSync(current); }
    catch (error) {
      if (error.code === "ENOENT") throw new Error(`Missing runtime file: ${file}`);
      throw error;
    }
    if (stats.isSymbolicLink() || (index === segments.length - 1 ? !stats.isFile() : !stats.isDirectory())) {
      throw new Error(`Runtime path must be a regular file without symlinks: ${file}`);
    }
  }
  return fs.readFileSync(current);
}

function assertOutputSafe(source, output) {
  if (source === output || source.startsWith(output + path.sep)) throw new Error("Output must not overwrite the source tree or one of its ancestors.");
  const relative = path.relative(source, output);
  if (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative) && relative !== "_site") {
    throw new Error("Only the _site directory may be used as output inside the source tree.");
  }
  for (let current = output; ; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("Output path must not contain symlinks.");
    if (current === path.dirname(current)) break;
  }
  if (!fs.existsSync(output)) return;
  if (!fs.lstatSync(output).isDirectory()) throw new Error("Output must be a directory.");
  if (fs.readdirSync(output).length === 0) return;
  let previous;
  try {
    const releasePath = path.join(output, "release.json");
    if (!fs.lstatSync(releasePath).isFile() || fs.lstatSync(releasePath).isSymbolicLink()) throw new Error("Invalid release marker");
    previous = JSON.parse(fs.readFileSync(releasePath, "utf8"));
  } catch { throw new Error("Refusing to replace an existing directory that is not a managed Pages artifact."); }
  if (previous.builder !== RELEASE_CONTRACT.builder || listPublicFiles(output).some((file) => !PUBLIC_FILES.includes(file))) {
    throw new Error("Refusing to replace an unmanaged directory or unexpected output files.");
  }
}

function preparePages({ source = process.cwd(), output, sha, requireClean = false } = {}) {
  source = path.resolve(source);
  if (!fs.lstatSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink()) throw new Error("Source must be a regular directory.");
  output = path.resolve(output || path.join(source, "_site"));
  sha = assertSha(sha || process.env.GITHUB_SHA || git(source, ["rev-parse", "HEAD"]).trim());
  const contents = Object.fromEntries(RUNTIME_FILES.map((file) => [file, readRuntime(source, file)]));
  validateHtml(contents["index.html"].toString("utf8"));
  for (const file of RUNTIME_FILES.slice(1)) new Function(contents[file].toString("utf8"));

  if (requireClean) {
    if (path.resolve(git(source, ["rev-parse", "--show-toplevel"]).trim()) !== source || git(source, ["rev-parse", "HEAD"]).trim() !== sha) {
      throw new Error("Production source must be checked out at the exact requested build commit SHA.");
    }
    for (const file of RUNTIME_FILES) {
      let committed;
      try { committed = git(source, ["show", `${sha}:${file}`], null); }
      catch { throw new Error(`Runtime file is not part of build commit ${sha}: ${file}`); }
      if (!contents[file].equals(committed)) throw new Error(`Runtime content does not match build commit ${sha}: ${file}`);
    }
  }

  assertOutputSafe(source, output);
  const release = {
    ...RELEASE_CONTRACT,
    build_sha: sha,
    source_sha: sha,
    source_tree_verified: requireClean,
    integrity: Object.fromEntries(RUNTIME_FILES.map((file) => [file, integrity(contents[file])]))
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(output), ".ironarabe-pages-"));
  try {
    for (const file of RUNTIME_FILES) {
      fs.mkdirSync(path.dirname(path.join(staging, file)), { recursive: true });
      fs.writeFileSync(path.join(staging, file), contents[file]);
    }
    fs.writeFileSync(path.join(staging, "release.json"), JSON.stringify(release, null, 2) + "\n");
    verifyArtifact({ directory: staging, expectedSha: sha });
    fs.rmSync(output, { recursive: true, force: true });
    fs.renameSync(staging, output);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return { directory: output, release };
}

function main(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--require-clean") { options.requireClean = true; continue; }
    if (!["--source", "--output", "--sha"].includes(flag) || !args[index + 1]) throw new Error(`Unknown or incomplete option: ${flag}`);
    options[flag.slice(2)] = args[++index];
  }
  const result = preparePages(options);
  fs.writeSync(1, `OK: GitHub Pages artifact prepared at ${result.directory} (${result.release.build_sha}).\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    fs.writeSync(2, `NG: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { preparePages };
