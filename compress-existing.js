const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const uploadsDir = path.join(__dirname, 'uploads');
const backupDir = path.join(__dirname, 'uploads-backup');
const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyRecursive(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function collectImageFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectImageFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (allowedExt.has(ext)) files.push(fullPath);
  }

  return files;
}

async function compressImageSafely(filePath) {
  const tempPath = `${filePath}.tmp`;
  const ext = path.extname(filePath).toLowerCase();
  const image = sharp(filePath).rotate().resize({
    width: 1000,
    height: 1000,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (ext === '.png') {
    await image
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(tempPath);
  } else if (ext === '.webp') {
    await image
      .webp({ quality: 75 })
      .toFile(tempPath);
  } else {
    await image
      .jpeg({ quality: 75, progressive: true })
      .toFile(tempPath);
  }

  await fs.rename(tempPath, filePath);
  console.log(`processed: ${path.relative(__dirname, filePath)}`);
}

async function main() {
  try {
    await ensureDir(uploadsDir);

    console.log('Creating backup...');
    await fs.rm(backupDir, { recursive: true, force: true });
    await copyRecursive(uploadsDir, backupDir);
    console.log(`Backup completed at: ${backupDir}`);

    const files = await collectImageFiles(uploadsDir);
    if (files.length === 0) {
      console.log('No jpg/jpeg/png/webp files found.');
      return;
    }

    console.log(`Found ${files.length} image(s). Starting compression...`);
    for (const filePath of files) {
      await compressImageSafely(filePath);
    }

    console.log('All images compressed successfully.');
  } catch (error) {
    console.error('Compression script failed:', error);
    process.exitCode = 1;
  }
}

main();
