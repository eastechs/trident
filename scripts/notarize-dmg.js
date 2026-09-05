const { execFileSync } = require("node:child_process");
const path = require("node:path");
const configureUpdateMetadata = require("./update-metadata.js");
const {
  buildBlockMap,
} = require("app-builder-lib/out/targets/blockmap/blockmap");

const notarized = new Set();

// Runs before electron-builder's artifactCreated event schedules uploads.
// The DMG's blockmap event precedes the DMG event; notarize at that first
// opportunity, then rebuild its blockmap and mutate the shared updateInfo
// object that the DMG target will use for latest-mac.yml.
module.exports = async function notarizeDmg(event) {
  configureUpdateMetadata({
    electronPlatformName: event.packager.platform.nodeName,
    packager: event.packager,
  });
  const isBlockmap = event.file?.endsWith(".dmg.blockmap");
  if (!isBlockmap && !event.file?.endsWith(".dmg")) return;
  const dmg = isBlockmap
    ? event.file.slice(0, -".blockmap".length)
    : event.file;
  if (notarized.has(dmg)) return;

  if (process.platform !== "darwin") {
    throw new Error("[notarize-dmg] DMG artifacts require macOS notarization");
  }
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  const missing = [
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`[notarize-dmg] missing env vars: ${missing.join(", ")}`);
  }

  const name = path.basename(dmg);
  console.log(`[notarize-dmg] submitting ${name} to notary service...`);
  execFileSync(
    "xcrun",
    [
      "notarytool",
      "submit",
      dmg,
      "--apple-id",
      APPLE_ID,
      "--team-id",
      APPLE_TEAM_ID,
      "--password",
      APPLE_APP_SPECIFIC_PASSWORD,
      "--wait",
    ],
    { stdio: "inherit" },
  );
  execFileSync("xcrun", ["stapler", "staple", dmg], { stdio: "inherit" });
  execFileSync("xcrun", ["stapler", "validate", dmg], { stdio: "inherit" });

  if (isBlockmap) {
    const updated = await buildBlockMap(dmg, "gzip", event.file);
    Object.assign(event.updateInfo, updated);
  }
  notarized.add(dmg);
};
