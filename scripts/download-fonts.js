const { createHash } = require("crypto");
const fs = require("fs");
const path = require("path");

const fontsDir = path.join("public", "fonts");
const sumsPath = path.join(fontsDir, "SHA256SUMS");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(sumsPath)) {
  fail(`Missing ${sumsPath}. Required JK-82 fonts must be committed.`);
}

const required = fs
  .readFileSync(sumsPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (!match) fail(`Invalid SHA256SUMS line: ${line}`);
    return { sha256: match[1].toLowerCase(), file: match[2] };
  });

if (required.length === 0) {
  fail("SHA256SUMS does not list any fonts");
}

for (const { sha256, file } of required) {
  const dest = path.join(fontsDir, file);
  if (!fs.existsSync(dest)) {
    fail(`Missing required font ${dest}`);
  }
  const actual = createHash("sha256").update(fs.readFileSync(dest)).digest("hex");
  if (actual !== sha256) {
    fail(`Checksum mismatch for ${dest}`);
  }
}

console.log(`Verified ${required.length} committed JK-82 fonts`);
