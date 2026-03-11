#!/usr/bin/env node
/**
 * Generate images for each game code using random backgrounds (no text overlay).
 *
 * Usage:
 *   node generate-images.js [--limit N] [--overwrite]
 *
 * - Reads codes from all-game-codes.json.
 * - Picks a random image from imgs/ per code, unless a matching filename exists.
 * - Writes <code>.webp into generatedImages/webp/ and <code>.jpg into generatedImages/jpg/.
 * - Skips existing outputs unless --overwrite is provided.
 */

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const ROOT = __dirname;
const CODE_FILE = path.join(ROOT, "all-game-codes.json");
const BACKGROUND_DIR = path.join(ROOT, "imgs");
const OUTPUT_WEBP_DIR = path.join(ROOT, "generatedImages", "webp");
const OUTPUT_JPG_DIR = path.join(ROOT, "generatedImages", "jpg");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const OUTPUT_FORMATS = [
  { ext: "webp", dir: OUTPUT_WEBP_DIR, options: { quality: 95 } },
  { ext: "jpg", dir: OUTPUT_JPG_DIR, options: { quality: 92, mozjpeg: true } },
];

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
  const files = entries.filter(
    (entry) => entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())
  );

  const list = files.map((entry) => path.join(BACKGROUND_DIR, entry.name));
  const byBasename = new Map(
    files.map((entry) => [
      path.parse(entry.name).name, // filename without extension
      path.join(BACKGROUND_DIR, entry.name),
    ])
  );

  return { list, byBasename };
}

async function renderCode(code, backgrounds, nameMap, overwrite) {
  const background = nameMap.get(code) ?? backgrounds[Math.floor(Math.random() * backgrounds.length)];
  const madeDirs = new Set();
  const tasks = [];
  let createdAny = false;

  for (const { ext, dir, options } of OUTPUT_FORMATS) {
    if (!madeDirs.has(dir)) {
      await fs.mkdir(dir, { recursive: true });
      madeDirs.add(dir);
    }

    const destination = path.join(dir, `${code}.${ext}`);
    let shouldWrite = overwrite;
    if (!overwrite) {
      try {
        await fs.access(destination);
        shouldWrite = false;
      } catch {
        shouldWrite = true;
      }
    }

    if (shouldWrite) {
      createdAny = true;
      tasks.push(
        sharp(background)
          .toFormat(ext, options)
          .toFile(destination)
      );
    }
  }

  await Promise.all(tasks);
  return createdAny;
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
  const { list: backgrounds, byBasename } = await listBackgrounds();
  if (backgrounds.length === 0) {
    throw new Error("No background images found in imgs/");
  }

  const targetTotal = Math.min(limit, codes.length);
  let created = 0;
  let processed = 0;

  const printProgress = () => {
    const pct = Math.floor((processed / targetTotal) * 100);
    process.stdout.write(
      `\rProgress: ${processed}/${targetTotal} (${pct}%) | created: ${created}`
    );
  };

  for (const code of codes) {
    if (processed >= targetTotal) break;
    const made = await renderCode(code, backgrounds, byBasename, overwrite);
    processed += 1;
    if (made) created += 1;
    if (processed === targetTotal || processed % 50 === 0) {
      printProgress();
    }
  }

  printProgress();
  process.stdout.write("\n");
  console.log(`Generated ${created} image(s) in generatedImages/webp and generatedImages/jpg`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
