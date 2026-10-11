#!/usr/bin/env node
// Refresh the relay list the Admin ships with (the fallback for the MEV-Boost
// Relays card when bo.ava.do cannot be reached).
//
//   node scripts/sync-relays.mjs <path to an AVADO-DNP-MEV-Boost checkout>
//
// Copies <checkout>/relays.json byte for byte to relays.bundled.json and
// records which commit it came from in relays.bundled.source.
import { copyFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const checkout = process.argv[2];
if (!checkout) {
  console.error("Usage: node scripts/sync-relays.mjs <path to an AVADO-DNP-MEV-Boost checkout>");
  process.exit(1);
}
const source = join(resolve(checkout), "relays.json");
if (!existsSync(source)) {
  console.error(`No relays.json in ${resolve(checkout)}`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../src/pages/packages/apps/mevboost");
const git = (...args) => execFileSync("git", ["-C", resolve(checkout), ...args], { encoding: "utf8" }).trim();
// The source line names a commit, so the file must be exactly what that commit holds.
if (git("status", "--porcelain", "--", "relays.json")) {
  console.error("relays.json has uncommitted changes; commit them first so the source line is true.");
  process.exit(1);
}
const commit = git("rev-parse", "HEAD");

copyFileSync(source, join(target, "relays.bundled.json"));
writeFileSync(join(target, "relays.bundled.source"), `AvadoDServer/AVADO-DNP-MEV-Boost@${commit.slice(0, 7)} relays.json\n`);
console.log(`relays.bundled.json <- ${source} (${commit.slice(0, 7)})`);
