#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const files = {
  index: path.join(root, "index.html"),
  manifest: path.join(root, "release", "ironarabe-game-registration.json"),
  preflight: path.join(root, "release", "supabase-preflight-v1.json"),
  readme: path.join(root, "README.md"),
  status: path.join(root, "RELEASE_STATUS_v2.md")
};

const errors = [];
function requireTrue(condition, message) { if (!condition) errors.push(message); }
function count(text, value) { return text.split(value).length - 1; }
function read(file, label) {
  if (!fs.existsSync(file)) {
    errors.push(`missing ${label}: ${path.relative(root, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}
function parseJson(text, label) {
  try { return JSON.parse(text); }
  catch (error) { errors.push(`${label} is not valid JSON: ${error.message}`); return null; }
}

const index = read(files.index, "index.html");
const manifestText = read(files.manifest, "registration manifest");
const preflightText = read(files.preflight, "Supabase preflight result");
const readme = read(files.readme, "README.md");
const status = read(files.status, "RELEASE_STATUS_v2.md");
const manifest = parseJson(manifestText, "registration manifest");
const preflight = parseJson(preflightText, "Supabase preflight result");

if (manifest) {
  const expected = {
    schema_version: 1,
    game_slug: "ironarabe",
    title: "イロナラベ",
    game_url: "https://chameleonjp.codeberg.page/ironarabe/",
    is_active: true,
    release_date: "2026-07-20",
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
  requireTrue(index.includes("CLIENT_VERSION='ironarabe-web-1.3.0-official001-v2'"), "index CLIENT_VERSION mismatch");
  requireTrue(index.includes("const SCORE_SCALE=100, SCORE_DECIMALS=2"), "index score scale or decimals mismatch");
  requireTrue(index.includes("postRpc('submit_score'"), "shared submit_score RPC missing");
  requireTrue(index.includes("postRpc('get_best_score_ranking'"), "best ranking RPC missing");
  requireTrue(index.includes("p_display_name"), "p_display_name missing");
  requireTrue(index.includes("p_game_slug"), "p_game_slug missing");
  requireTrue(index.includes("p_score"), "p_score missing");
  requireTrue(index.includes("p_client_version"), "p_client_version missing");
  requireTrue(!/Authorization\s*[:=]/.test(index), "Authorization header must not be used");

  requireTrue(status.includes("is_active: true"), "release status must state active registration");
  requireTrue(status.includes("release_date: 2026-07-20"), "release status date mismatch");
  requireTrue(status.includes("release/ironarabe-game-registration.json") || readme.includes("release/ironarabe-game-registration.json"), "registration manifest must be referenced");
  requireTrue(!/sb_publishable_|service_role key value/i.test(status), "release status must not contain credentials");
}

if (preflight) {
  requireTrue(preflight.schema_version === 1, "preflight.schema_version must be 1");
  requireTrue(preflight.game_slug === "ironarabe", "preflight.game_slug mismatch");
  requireTrue(preflight.registration_contract?.is_active === false, "preflight must preserve historical inactive registration");
  requireTrue(preflight.registration_contract?.release_date === null, "historical preflight release_date must be null");
  requireTrue(preflight.registration_contract?.score_order === "asc", "preflight score_order mismatch");
  requireTrue(preflight.registration_contract?.score_scale === 100, "preflight score_scale mismatch");
  requireTrue(preflight.registration_contract?.score_decimals === 2, "preflight score_decimals mismatch");
  requireTrue(preflight.transactional_submit_score?.passed === true, "transactional submit_score preflight must pass");
  requireTrue(preflight.transactional_submit_score?.accepted === true, "transactional submit_score must be accepted");
  requireTrue(preflight.transactional_persistence?.score_runs_count === 1, "preflight score_runs count must be 1 inside transaction");
  requireTrue(preflight.transactional_persistence?.game_scores_count === 1, "preflight game_scores count must be 1 inside transaction");
  requireTrue(preflight.transactional_read_rpcs?.passed === true, "read RPC preflight must pass");
  requireTrue(preflight.transactional_read_rpcs?.rank_direction_observed === "asc", "read RPC rank direction must be asc");
  requireTrue(preflight.rollback_cleanup?.passed === true, "rollback cleanup must pass");
  requireTrue(preflight.rollback_cleanup?.is_active_after_rollback === false, "historical rollback state must remain false");
  requireTrue(preflight.rollback_cleanup?.residual_score_runs === 0, "probe score_runs must be removed by rollback");
  requireTrue(preflight.rollback_cleanup?.residual_game_scores === 0, "probe game_scores must be removed by rollback");
  requireTrue(preflight.rollback_cleanup?.residual_players === 0, "probe players must be removed by rollback");
  requireTrue(!/iroprobe_/i.test(preflightText), "preflight result must not retain probe player names");
  requireTrue(!/sb_publishable_|service_role|secret key/i.test(preflightText), "preflight result must not contain credentials");
}

requireTrue(readme.includes("SPEC_v3.md"), "README must link to SPEC_v3.md");
requireTrue(readme.includes("REVIEW_CHECKLIST_v3.md"), "README must link to REVIEW_CHECKLIST_v3.md");
requireTrue(readme.includes("RELEASE_STATUS_v2.md"), "README must link to current release status");
requireTrue(readme.includes("release/ironarabe-game-registration.json"), "README must link to registration manifest");
requireTrue(readme.includes("release/supabase-preflight-v1.json"), "README must link to Supabase preflight result");

if (errors.length) {
  console.error(`NG: ${errors.length} release contract issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: ironarabe active release contract and historical preflight verified");
