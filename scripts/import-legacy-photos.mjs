// One-time import: uploads the artist's original sculpture photos into
// Supabase Storage and creates matching unpublished draft `artworks` rows
// with empty metadata, for the admin to fill in later. Run once locally:
//   node scripts/import-legacy-photos.mjs
//
// Reads credentials from .dev.vars (gitignored, never committed).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';

const SOURCE_DIR = '/Users/oskarferno/Desktop/JTP Skulptur';
const EXCLUDE_NAMES = new Set(['sk_logo.png', 'sk_logo.jpg', 'cara-logo-512.jpeg']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

function parseDevVars(path) {
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
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

const env = parseDevVars(new URL('../.dev.vars', import.meta.url));
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .dev.vars');
  process.exit(1);
}

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const files = walk(SOURCE_DIR).sort();
console.log(`Found ${files.length} photos to import.\n`);

let imported = 0;
let failed = 0;

for (const [index, filePath] of files.entries()) {
  const ext = extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const buffer = readFileSync(filePath);

  let width;
  let height;
  try {
    const size = imageSize(buffer);
    width = size.width;
    height = size.height;
  } catch {
    width = undefined;
    height = undefined;
  }

  const storagePath = `imports/${randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('artwork-images')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error(`[${index + 1}/${files.length}] upload failed for ${filePath}:`, uploadError.message);
    failed++;
    continue;
  }

  const { data: media, error: mediaError } = await supabase
    .from('media')
    .insert({ storage_path: storagePath, bucket: 'artwork-images', width, height, mime_type: mimeType })
    .select('id')
    .single();

  if (mediaError) {
    console.error(`[${index + 1}/${files.length}] media insert failed for ${filePath}:`, mediaError.message);
    failed++;
    continue;
  }

  const n = index + 1;
  const { error: artworkError } = await supabase.from('artworks').insert({
    slug: `draft-${n}`,
    title: `Draft ${n}`,
    primary_image_id: media.id,
    display_order: n,
    published: false,
  });

  if (artworkError) {
    console.error(`[${index + 1}/${files.length}] artwork insert failed for ${filePath}:`, artworkError.message);
    failed++;
    continue;
  }

  console.log(`[${index + 1}/${files.length}] imported: ${filePath.replace(SOURCE_DIR, '')}`);
  imported++;
}

console.log(`\nDone. Imported ${imported}, failed ${failed}, total ${files.length}.`);
