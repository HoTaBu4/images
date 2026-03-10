#!/usr/bin/env node
/**
 * Generate images for each game code using random backgrounds (no text overlay).
 *
 * Usage:
 *   node generate-images.js [--limit N] [--overwrite]
 *
 * - Reads codes from all-game-codes.json.
 * - Picks a random image from imgs/ per code.
 * - Writes <code>.webp into generatedImages/.
 * - Skips existing outputs unless --overwrite is provided.
 */

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const ROOT = __dirname;
const CODE_FILE = path.join(ROOT, "all-game-codes.json");
const BACKGROUND_DIR = path.join(ROOT, "imgs");
const OUTPUT_DIR = path.join(ROOT, "generatedImages");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function loadCodes() {
  const raw = await fs.readFile(CODE_FILE, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("all-game-codes.json must be an array of strings");
  }
  return data;
}

async function listBackgrounds() {
  const entries = await fs.readdir(BACKGROUND_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(BACKGROUND_DIR, entry.name));
}

async function renderCode(code, backgrounds, overwrite) {
  const destination = path.join(OUTPUT_DIR, `${code}.webp`);
  if (!overwrite) {
    try {
      await fs.access(destination);
      return false; // already exists
    } catch {
      /* missing is fine */
    }
  }

  const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await sharp(background)
    .toFormat("webp", { quality: 95 })
    .toFile(destination);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  let limit = Number.POSITIVE_INFINITY;
  let overwrite = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" && i + 1 < args.length) {
      limit = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--overwrite") {
      overwrite = true;
    }
  }

  const codes = await loadCodes();
  const backgrounds = await listBackgrounds();
  if (backgrounds.length === 0) {
    throw new Error("No background images found in imgs/");
  }

  let created = 0;
  for (const code of codes) {
    if (created >= limit) break;
    const made = await renderCode(code, backgrounds, overwrite);
    if (made) created += 1;
  }

  console.log(`Generated ${created} image(s) in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
