// Re-processes the imported photos: downscales + re-encodes each original
// to a reasonable web size, then overwrites the same Storage object so every
// existing media/artwork reference keeps working. Fixes the ~4-8MB originals
// that were causing a 29s LCP.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = '/Users/oskarferno/Desktop/JTP Skulptur';
const EXCLUDE_NAMES = new Set(['sk_logo.png', 'sk_logo.jpg', 'cara-logo-512.jpeg']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

const env = {};
readFileSync('/Users/oskarferno/Desktop/jtp-skulptur/.dev.vars', 'utf8')
  .split('\n')
  .forEach((l) => {
    const i = l.indexOf('=');
    if (i > 0) env[l.slice(0, i)] = l.slice(i + 1);
  });

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir).sort()) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (IMAGE_EXT.has(extname(entry).toLowerCase()) && !EXCLUDE_NAMES.has(entry.toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(SOURCE_DIR).sort();

const { data: artworks } = await supabase
  .from('artworks')
  .select('slug, primary_image_id, media:primary_image_id (id, storage_path, bucket)');

let done = 0;
let failed = 0;

for (const artwork of artworks ?? []) {
  const n = Number(artwork.slug.replace('draft-', ''));
  const filePath = files[n - 1];
  if (!filePath || !artwork.media) {
    console.error(`skip ${artwork.slug}: no matching file or media row`);
    failed++;
    continue;
  }

  const original = readFileSync(filePath);
  const resized = await sharp(original)
    .rotate() // respect EXIF orientation
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const meta = await sharp(resized).metadata();

  const { error: uploadError } = await supabase.storage
    .from(artwork.media.bucket)
    .upload(artwork.media.storage_path, resized, { contentType: 'image/webp', upsert: true });

  if (uploadError) {
    console.error(`${artwork.slug}: upload failed —`, uploadError.message);
    failed++;
    continue;
  }

  const { error: updateError } = await supabase
    .from('media')
    .update({ width: meta.width, height: meta.height, mime_type: 'image/webp' })
    .eq('id', artwork.media.id);

  if (updateError) {
    console.error(`${artwork.slug}: db update failed —`, updateError.message);
    failed++;
    continue;
  }

  const beforeKB = Math.round(original.byteLength / 1024);
  const afterKB = Math.round(resized.byteLength / 1024);
  console.log(`${artwork.slug}: ${beforeKB}KB -> ${afterKB}KB (${meta.width}x${meta.height})`);
  done++;
}

console.log(`\nDone. Optimized ${done}, failed ${failed}, total ${artworks?.length ?? 0}.`);
