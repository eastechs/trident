const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const lock = JSON.parse(read("package-lock.json"));
const audit = JSON.parse(read("resources/licenses/audit.json"));
const output = path.join(root, "src/renderer/public/legal");
const notices = [
  "Trident — third-party software notices",
  "",
  "This inventory covers installed production dependencies, copied components,",
  "and the Electron runtime. Each component retains its own license.",
  "Optional dependencies for other operating systems are not installed or bundled.",
];
const inventory = [];

function licenseFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...licenseFiles(absolute));
    else if (/^(licen[cs]e|copying|notice)/i.test(entry.name))
      files.push(absolute);
  }
  return files.sort();
}

function append(name, version, license, files, source) {
  notices.push("", "=".repeat(72), `${name} ${version}`, `License: ${license}`);
  if (source) notices.push(`Source: ${source}`);
  for (const file of files) {
    notices.push(
      "",
      `--- ${path.relative(root, file)} ---`,
      fs.readFileSync(file, "utf8").trim(),
    );
  }
  inventory.push({ name, version, license, source });
}

for (const [relative, metadata] of Object.entries(lock.packages).sort()) {
  if (!relative || metadata.dev) continue;
  const directory = path.join(root, relative);
  if (!fs.existsSync(path.join(directory, "package.json"))) {
    if (metadata.optional) continue;
    throw new Error(`Missing dependency ${relative}; run npm ci first.`);
  }
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  if (pkg.version !== metadata.version)
    throw new Error(`Lockfile mismatch: ${relative}`);
  const override = audit.packages[`${pkg.name}@${pkg.version}`];
  const license = override?.license ?? pkg.license;
  if (typeof license !== "string" || !audit.reviewedLicenses.includes(license))
    throw new Error(`Unaudited license: ${pkg.name}@${pkg.version}`);
  const files = licenseFiles(directory);
  if (override?.file)
    files.push(path.join(root, "resources/licenses", override.file));
  if (
    !files.some((file) => /^(licen[cs]e|copying)/i.test(path.basename(file)))
  ) {
    throw new Error(`Missing license text: ${pkg.name}@${pkg.version}`);
  }
  append(
    pkg.name,
    pkg.version,
    license,
    files,
    override?.source ?? pkg.homepage,
  );
}

for (const component of audit.copied) {
  append(
    component.name,
    component.version,
    component.license,
    component.files.map((file) => path.join(root, "resources/licenses", file)),
    component.source,
  );
}

const electron = JSON.parse(read("node_modules/electron/package.json"));
// Electron 44 downloads its runtime on first use, rather than during npm ci.
require("electron");
const electronDir = path.join(root, "node_modules/electron/dist");
const runtimeNotices = [
  path.join(electronDir, "LICENSE"),
  path.join(electronDir, "LICENSES.chromium.html"),
];
for (const file of runtimeNotices) {
  if (!fs.existsSync(file))
    throw new Error(`Missing Electron runtime notice: ${file}`);
}
append(
  "Electron",
  electron.version,
  "MIT and bundled Chromium licenses",
  [runtimeNotices[0]],
  "https://github.com/electron/electron",
);
notices.push(
  "",
  "Chromium and its bundled libraries: see LICENSES.chromium.html alongside this file.",
);

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "LICENSE.txt"), read("LICENSE"));
fs.writeFileSync(path.join(output, "CREDITS.txt"), read("CREDITS.md"));
fs.writeFileSync(
  path.join(output, "THIRD-PARTY-NOTICES.txt"),
  `${notices.join("\n")}\n`,
);
fs.writeFileSync(
  path.join(output, "inventory.json"),
  `${JSON.stringify(inventory, null, 2)}\n`,
);
fs.copyFileSync(runtimeNotices[1], path.join(output, "LICENSES.chromium.html"));
console.log(`Generated legal notices for ${inventory.length} components.`);
