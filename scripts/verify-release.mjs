/**
 * Release-version gate (design §14). Shared by local preflight and the
 * tag-triggered workflow so most of the release logic is testable BEFORE
 * the tag exists:
 *
 *   node scripts/verify-release.mjs              # package.json version only
 *   node scripts/verify-release.mjs v1.0.0       # tag ↔ version identity
 *
 * Rules: the version must be strict stable semver (X.Y.Z, no prerelease /
 * build suffixes — the self-updater rejects anything else), and when a tag
 * is given it must be exactly `v` + the package version.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tag = process.argv[2];
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = manifest.version;

function fail(message) {
  console.error(`verify-release: ${message}`);
  process.exit(1);
}

if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`package.json version must be strict stable semver (X.Y.Z), got "${version}"`);
}
if (manifest.name !== "dsh-skins") {
  fail(`package.json name must be dsh-skins, got "${manifest.name}"`);
}

if (tag === undefined) {
  console.log(`verify-release: package ${manifest.name}@${version} OK (no tag given)`);
  process.exit(0);
}

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  fail(`tag must be strictly vX.Y.Z, got "${tag}"`);
}
if (tag !== `v${version}`) {
  fail(`tag ${tag} does not match package version ${version}`);
}
console.log(`verify-release: tag ${tag} ↔ package ${manifest.name}@${version} OK`);
