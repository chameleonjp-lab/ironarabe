#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const files = {
  index: path.join(root, "index.html"),
  manifest: path.join(root, "release", "ironarabe-game-registration.json"),
  readme: path.join(root, "README.md"),
  release: path.join(root, "RELEASE_READINESS_v1.md")
};

const errors = [];
function requireTrue(condition, message) {
  if (!condition) errors.push(message);
}
function count(text, value) {
  return text.split(value).length - 1;
}
function read(file, label) {
  if (!fs.existsSync(file)) {
    errors.push(`missing ${label}: ${path.relative(root, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

const index = read(files.index, "index.html");
const manifestText = read(files.manifest, "registration manifest");
const readme = read(files.readme, "README.md");
const release = read(files.release, "RELEASE_READINESS_v1.md");

let manifest = null;
try {
  manifest = JSON.parse(manifestText);
} catch (error) {
  errors.push(`registration manifest is not valid JSON: ${error.message}`);
}

if (manifest) {
  const expected = {
    schema_version: 1,
    game_slug: "ironarabe",
    title: "イロナラベ",
    game_url: "https://chameleonjp.codeberg.page/ironarabe/",
    is_active: false,
    release_date: null,
    top_ranking_type: "best",
    score_order: "asc",
    score_unit: "秒",
    score_scale: 100,
    score_decimals: 2,
    score_label: "クリアタイム",
    first_score_label: "初回タイム",
    best_score_label: "ベストタイム",
    display_order: 32
  };

  for (const [key, value] of Object.entries(expected)) {
    requireTrue(manifest[key] === value, `manifest.${key} must be ${JSON.stringify(value)}`);
  }

  requireTrue(typeof manifest.description === "string" && manifest.description.length > 0, "manifest.description is required");
  requireTrue(typeof manifest.share_text === "string" && manifest.share_text.length > 0, "manifest.share_text is required");
  requireTrue(count(manifest.share_text || "", expected.game_url) === 1, "share_text must contain the game URL exactly once");
  requireTrue(!/sb_publishable_|service_role|secret key/i.test(manifestText), "manifest must not contain credentials");

  requireTrue(index.includes("const GAME_SLUG='ironarabe'"), "index GAME_SLUG mismatch");
  requireTrue(index.includes("const GAME_URL='https://chameleonjp.codeberg.page/ironarabe/'"), "index GAME_URL mismatch");
  requireTrue(index.includes("const SCORE_SCALE=100, SCORE_DECIMALS=2"), "index score scale or decimals mismatch");
  requireTrue(index.includes("/rest/v1/rpc/submit_score"), "shared submit_score RPC path missing");
  requireTrue(index.includes("p_display_name"), "p_display_name missing");
  requireTrue(index.includes("p_game_slug"), "p_game_slug missing");
  requireTrue(index.includes("p_score"), "p_score missing");
  requireTrue(index.includes("p_client_version"), "p_client_version missing");
  requireTrue(!/Authorization\s*[:=]/.test(index), "Authorization header must not be used");

  requireTrue(release.includes("is_active: false"), "release document must state inactive preregistration");
  requireTrue(release.includes("release/ironarabe-game-registration.json"), "release document must point to the manifest");
  requireTrue(release.includes("score_scale = 100"), "activation SQL must guard score_scale");
  requireTrue(release.includes("score_decimals = 2"), "activation SQL must guard score_decimals");
  requireTrue(release.includes("score_order = 'asc'"), "activation SQL must guard score_order");
  requireTrue(!/sb_publishable_|service_role key value/i.test(release), "release document must not contain credentials");
}

requireTrue(readme.includes("RELEASE_READINESS_v1.md"), "README must link to release readiness document");
requireTrue(readme.includes("release/ironarabe-game-registration.json"), "README must link to registration manifest");

if (errors.length) {
  console.error(`NG: ${errors.length} release contract issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: ironarabe release contract verified");
