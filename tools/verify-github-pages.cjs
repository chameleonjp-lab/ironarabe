#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const RUNTIME_FILES = Object.freeze([
  "index.html",
  "js/language-options.js",
  "js/translations.js",
  "js/i18n.js",
  "js/sound-effects.js",
  "js/stage-pack.js", "js/guest-plays.js"
]);
const PUBLIC_FILES = Object.freeze([...RUNTIME_FILES, "release.json"]);
const RELEASE_CONTRACT = Object.freeze({
  schema_version: 1,
  builder: "ironarabe-github-pages",
  game_slug: "ironarabe",
  client_version: "ironarabe-web-1.4.1-stagepack001-v2",
  ui_release: "ironarabe-web-1.6.2-x-share",
  challenge_id: "ironarabe-official-001",
  board_version: 2,
  shuffle_seed: "ironarabe-official-001-v1"
});

function assertSha(sha) {
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("Build SHA must be a full, lowercase 40-character Git commit ID.");
  }
  return sha;
}

function integrity(bytes) {
  return "sha256-" + crypto.createHash("sha256").update(bytes).digest("base64");
}

function validateHtml(html) {
  const constants = {
    GAME_SLUG: RELEASE_CONTRACT.game_slug,
    CLIENT_VERSION: RELEASE_CONTRACT.client_version,
    CHALLENGE_ID: RELEASE_CONTRACT.challenge_id,
    SHUFFLE_SEED: RELEASE_CONTRACT.shuffle_seed
  };
  for (const [name, expected] of Object.entries(constants)) {
    const value = html.match(new RegExp("\\b" + name + "\\s*=\\s*(['\"])(.*?)\\1"));
    if (!value || value[2] !== expected) throw new Error(`index.html ${name} changed the ranking contract.`);
  }
  if (!/\bBOARD_VERSION\s*=\s*2\b/.test(html)) throw new Error("index.html BOARD_VERSION must remain 2.");

  const scripts = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const source = match[1].match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!source) {
      if (/\bsrc\b/i.test(match[1])) throw new Error("Unsupported script src attribute in index.html.");
      new Function(match[2]);
      continue;
    }
    const file = (source[1] ?? source[2] ?? source[3]).replace(/^\.\//, "");
    if (!RUNTIME_FILES.slice(1).includes(file)) throw new Error(`Script is outside the Pages allowlist: ${file}`);
    scripts.push(file);
  }
  if (JSON.stringify(scripts) !== JSON.stringify(RUNTIME_FILES.slice(1))) {
    throw new Error("index.html must load each allowlisted runtime script once, in dependency order.");
  }
  // Additional local resources require an explicit addition to the public allowlist.
  for (const match of html.matchAll(/<(link|img|iframe|audio|video|source|object|embed)\b([^>]*)>/gi)) {
    if (match[1].toLowerCase() === "link" && /\brel\s*=\s*(?:"canonical"|'canonical'|canonical(?:\s|$))/i.test(match[2])) continue;
    const attribute = match[2].match(/\b(?:src|href|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!attribute) continue;
    const resource = attribute[1] ?? attribute[2] ?? attribute[3];
    if (!resource.startsWith("data:")) throw new Error(`Unsupported resource outside the Pages allowlist: ${resource}`);
  }
}

function validateRelease(release, expectedSha) {
  if (!release || typeof release !== "object" || Array.isArray(release)) throw new Error("release.json must be an object.");
  for (const [name, expected] of Object.entries(RELEASE_CONTRACT)) {
    if (release[name] !== expected) throw new Error(`release.json ${name} mismatch.`);
  }
  assertSha(release.build_sha);
  if (typeof release.source_tree_verified !== "boolean") throw new Error("release.json source_tree_verified must declare whether commit bytes were checked.");
  if (release.source_sha !== release.build_sha) throw new Error("release.json source_sha and build_sha must identify the same commit.");
  if (expectedSha !== undefined && release.build_sha !== assertSha(expectedSha)) throw new Error(`Build SHA mismatch: expected ${expectedSha}, received ${release.build_sha}.`);
  const hashes = release.integrity;
  if (!hashes || typeof hashes !== "object" || Array.isArray(hashes) || JSON.stringify(Object.keys(hashes).sort()) !== JSON.stringify([...RUNTIME_FILES].sort())) {
    throw new Error("release.json integrity must cover exactly the runtime allowlist.");
  }
  for (const file of RUNTIME_FILES) {
    if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(hashes[file])) throw new Error(`Invalid SHA-256 integrity for ${file}.`);
  }
  return release;
}

function verifyContents(release, contents, expectedSha) {
  validateRelease(release, expectedSha);
  for (const file of RUNTIME_FILES) {
    if (!Buffer.isBuffer(contents[file])) throw new Error(`Missing public runtime file: ${file}`);
    if (integrity(contents[file]) !== release.integrity[file]) throw new Error(`Integrity hash mismatch: ${file}`);
    if (file.endsWith(".js")) new Function(contents[file].toString("utf8"));
  }
  validateHtml(contents["index.html"].toString("utf8"));
  return release;
}

function listPublicFiles(directory, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Public artifact must not contain a symlink: ${relative}`);
    if (entry.isDirectory()) {
      if (relative !== "js") throw new Error(`Unexpected directory outside the Pages allowlist: ${relative}`);
      files.push(...listPublicFiles(path.join(directory, entry.name), relative + "/"));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Public artifact must contain regular files only: ${relative}`);
    }
  }
  return files.sort();
}

function verifyArtifact({ directory = "_site", expectedSha } = {}) {
  const artifact = path.resolve(directory);
  const stats = fs.lstatSync(artifact);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("Pages artifact must be a regular directory.");
  if (JSON.stringify(listPublicFiles(artifact)) !== JSON.stringify([...PUBLIC_FILES].sort())) {
    throw new Error("Public artifact has missing or unexpected files outside the Pages allowlist.");
  }
  const release = JSON.parse(fs.readFileSync(path.join(artifact, "release.json"), "utf8"));
  const contents = Object.fromEntries(RUNTIME_FILES.map((file) => [file, fs.readFileSync(path.join(artifact, file))]));
  return verifyContents(release, contents, expectedSha);
}

function publicationUrl(baseUrl) {
  const url = new URL(baseUrl);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new Error("Public verification requires HTTPS (HTTP is allowed for loopback tests).");
  if (url.username || url.password || url.search || url.hash) throw new Error("Public base URL must not contain credentials, query parameters or a fragment.");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

async function verifyPublication({ baseUrl, expectedSha, expectedRelease, attempts = 12, intervalMs = 10000 }) {
  assertSha(expectedSha);
  if (expectedRelease) validateRelease(expectedRelease, expectedSha);
  const base = publicationUrl(baseUrl);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30) throw new Error("Verification attempts must be between 1 and 30.");
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 30000) throw new Error("Verification interval must be between 1 and 30000 ms.");
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const cacheKey = `${expectedSha}-${Date.now()}-${attempt}`;
      const read = async (file) => {
        const url = new URL(file, base);
        url.searchParams.set("pages_verify", cacheKey);
        const response = await fetch(url, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Public ${file}: HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      };
      const release = JSON.parse((await read("release.json")).toString("utf8"));
      validateRelease(release, expectedSha);
      if (expectedRelease && (release.source_tree_verified !== expectedRelease.source_tree_verified || RUNTIME_FILES.some((file) => release.integrity[file] !== expectedRelease.integrity[file]))) {
        throw new Error("Public integrity hashes do not match the expected artifact rebuilt from the commit.");
      }
      const results = await Promise.allSettled(RUNTIME_FILES.map(read));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      const contents = Object.fromEntries(RUNTIME_FILES.map((file, index) => [file, results[index].value]));
      return verifyContents(release, contents, expectedSha);
    } catch (error) {
      if (attempt === attempts) throw new Error(`Public release verification failed after ${attempts} attempt(s): ${error.message}`);
      fs.writeSync(2, `Public release attempt ${attempt}/${attempts}: ${error.message}\n`);
      await delay(intervalMs);
    }
  }
}

async function main(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!["--dir", "--url", "--sha", "--expected-release", "--attempts", "--interval-ms"].includes(flag) || !args[index + 1]) throw new Error(`Unknown or incomplete option: ${flag}`);
    options[flag.slice(2)] = args[++index];
  }
  if (options.dir && options.url) throw new Error("Choose either --dir or --url.");
  if (options["expected-release"] && !options.url) throw new Error("--expected-release requires --url.");
  const expectedRelease = options["expected-release"] ? JSON.parse(fs.readFileSync(options["expected-release"], "utf8")) : undefined;
  const release = options.url
    ? await verifyPublication({ baseUrl: options.url, expectedSha: options.sha, expectedRelease, attempts: options.attempts === undefined ? 12 : Number(options.attempts), intervalMs: options["interval-ms"] === undefined ? 10000 : Number(options["interval-ms"]) })
    : verifyArtifact({ directory: options.dir || "_site", expectedSha: options.sha });
  fs.writeSync(1, `OK: GitHub Pages ${options.url ? "public release" : "artifact"} verified (${release.build_sha}).\n`);
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  fs.writeSync(2, `NG: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { RUNTIME_FILES, PUBLIC_FILES, RELEASE_CONTRACT, assertSha, integrity, validateHtml, validateRelease, verifyContents, listPublicFiles, verifyArtifact, verifyPublication };
