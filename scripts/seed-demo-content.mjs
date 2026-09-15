// One-off script to seed 3 sample Exhibitions and 3 sample Journal entries
// for design review. Reuses existing published artwork images rather than
// uploading new files. Safe to re-run: it deletes any rows it previously
// created (matched by slug) before re-inserting.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .dev.vars and migration
// 0006_exhibition_detail_pages.sql already applied.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envText = fs.readFileSync('.dev.vars', 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Media ids selected from already-published artworks (see scripts/_list-media output).
const MEDIA = {
  crows: 'a6f28062-3f54-4ce1-b621-25f65a7161ba',
  child: 'a6d57ecf-c353-4620-81e9-1113fced725b',
  untitledIV: 'f5dd6169-eeab-42d4-9b52-1c47f86f91ca',
  untitledVI: '3f0c2007-eade-4f3c-801d-b737cc52e1b9',
  untitledVIII: '3ae3d242-645e-47ba-98c1-33ffcdc81d7e',
  untitledIX: '53855a5e-da6c-4df0-9dce-8a34f924f641',
  untitledX: '0cfe231b-b34d-4b97-8f29-b5575397d0c5',
  untitledXI: '96821869-c915-44ed-aeee-8098ed1e222d',
  untitledXII: '5a61b825-6025-47af-a23c-cf388e9ea73f',
  untitledXIII: 'bd96510f-a8fd-4c91-af42-635787653bd7',
  untitledXIV: 'c3c7b6ca-ae3b-4621-abe2-db6dc0b7858a',
};

// --- cleanup: remove the empty leftover "test" stub rows, and any prior run of this script ---
await supabase.from('exhibitions').delete().eq('title', 'test');
await supabase.from('posts').delete().eq('slug', 'test');

const exhibitionSlugs = ['traces-of-the-hand', 'between-form-and-fingerprint', 'small-works'];
const postSlugs = ['working-the-clay', 'on-imperfection', 'surface-notes'];

const { data: oldEx } = await supabase.from('exhibitions').select('id').in('slug', exhibitionSlugs);
if (oldEx?.length) {
  await supabase.from('exhibition_images').delete().in('exhibition_id', oldEx.map((e) => e.id));
  await supabase.from('exhibitions').delete().in('slug', exhibitionSlugs);
}
const { data: oldPosts } = await supabase.from('posts').select('id').in('slug', postSlugs);
if (oldPosts?.length) {
  await supabase.from('post_images').delete().in('post_id', oldPosts.map((p) => p.id));
  await supabase.from('posts').delete().in('slug', postSlugs);
}

// --- exhibitions ---
const exhibitions = [
  {
    slug: 'traces-of-the-hand',
    title: 'Traces of the Hand',
    venue: 'Kiln & Clay Project Space',
    city: null,
    country: null,
    start_date: '2026-08-15',
    end_date: '2026-10-31',
    exhibition_type: 'Sample content — solo exhibition',
    intro:
      'New sculptures exploring the marks left by hand and firing, shown together for the first time this season.',
    description:
      `"Traces of the Hand" brings together a small group of recent stoneware busts, each built slowly by hand and left with the unevenness that comes from that process. Rather than smoothing every surface toward symmetry, these pieces keep the fingerprints, the subtle asymmetries, and the small decisions made along the way.\n\nThe work continues an ongoing interest in what a face can hold — not a likeness, but a character that seems to have arrived on its own terms. Firing brings its own changes too: oxides and engobes shift slightly in the kiln, so no two surfaces behave quite the same way twice.`,
    published: true,
    cover_media_id: MEDIA.crows,
    gallery: [MEDIA.child],
  },
  {
    slug: 'between-form-and-fingerprint',
    title: 'Between Form and Fingerprint: New Work in Stoneware',
    venue: 'Studio Nord Exhibition Room',
    city: null,
    country: null,
    start_date: '2026-02-01',
    end_date: '2026-02-22',
    exhibition_type: 'Sample content — group exhibition',
    intro:
      'A group presentation of stoneware sculpture, gathering several approaches to the same question: how much of the hand should remain visible in a finished piece.',
    description:
      `Between Form and Fingerprint gathers new stoneware work alongside pieces by other makers, loosely organized around a shared question: how much of the making process should stay visible once a piece is considered finished.\n\nFor this body of work, that meant resisting the instinct to resolve every surface. Some pieces are left close to how they came out of the bisque firing, with only sulfate and oxide added sparingly to pick out the forms already there. Others were built up over many sessions, with each layer of engobe left slightly uneven rather than smoothed flat.\n\nThe result is a set of faces and figures that read less like finished objects and more like a record of the decisions that produced them — a hand visible in the clay, not hidden behind it.\n\nThe show ran for three weeks and included works in various stages of surface treatment, from raw bisque to fully glazed.`,
    published: true,
    cover_media_id: MEDIA.untitledVI,
    gallery: [MEDIA.untitledVIII],
  },
  {
    slug: 'small-works',
    title: 'Small Works',
    venue: 'The Studio',
    city: null,
    country: null,
    start_date: '2026-11-14',
    end_date: '2026-11-14',
    exhibition_type: 'Sample content — studio showing',
    intro: 'A short studio showing of smaller-scale pieces, open by appointment.',
    description:
      'A handful of smaller stoneware studies, shown in the studio as they were made — informal, and closer to notes than finished statements.',
    published: true,
    cover_media_id: MEDIA.untitledIV,
    gallery: [],
  },
];

for (const ex of exhibitions) {
  const { gallery, ...row } = ex;
  const { data: inserted, error } = await supabase.from('exhibitions').insert(row).select('id').single();
  if (error) {
    console.error(`exhibition insert failed for ${ex.slug}:`, error.message);
    continue;
  }
  if (gallery.length) {
    const rows = gallery.map((media_id, i) => ({ exhibition_id: inserted.id, media_id, display_order: i }));
    const { error: imgError } = await supabase.from('exhibition_images').insert(rows);
    if (imgError) console.error(`exhibition_images insert failed for ${ex.slug}:`, imgError.message);
  }
  console.log(`exhibition created: ${ex.slug} (${inserted.id})`);
}

// --- journal posts ---
const posts = [
  {
    slug: 'working-the-clay',
    title: 'Working the Clay',
    excerpt: 'Some notes on why stoneware, and why the hand stays visible in the finished piece.',
    body:
      `I keep returning to stoneware because of what it allows to stay in the surface. It's a forgiving clay in the studio, and an honest one after firing — it holds a fingerprint, a tool mark, an uneven pass of the hand, and keeps most of it through two firings without asking to be smoothed away.\n\nI build slowly, usually starting from the shoulders and working up toward the face last. By the time I get there, the character of the piece has usually already decided itself somewhere lower down — the tilt of a shoulder, the weight settled into a torso. The face is less something I plan than something I recognize once enough of the rest exists to hold it.\n\nMost of what people notice as "style" is really just what I chose not to fix. A slightly uneven jaw, a seam left visible where two coils met, a patch where the engobe sat thinner than elsewhere. None of it is a mistake exactly — it's more that smoothing it away would take something out of the piece that I'd rather keep in.\n\nStoneware rewards that kind of restraint. It fires to something solid and quiet, without the shine that would make every one of those small decisions disappear.`,
    published: true,
    published_at: '2026-06-10T09:00:00Z',
    cover_media_id: MEDIA.untitledIX,
    gallery: [MEDIA.untitledX],
  },
  {
    slug: 'on-imperfection',
    title: 'On Imperfection',
    excerpt: 'Why the unevenness in a piece is usually the part I try hardest to protect.',
    body:
      `There's a point in almost every sculpture where it would be easy to make it neater. The clay is cooperative, the tools are sharp, and it takes very little effort to true up an edge, even out a surface, or straighten a line that came out slightly off. I've learned to be suspicious of that moment.\n\nMost of what reads as "imperfection" in a finished piece isn't a failure of technique — it's a record of a decision, made at a particular moment, with the clay in a particular state. A shoulder that sits a little asymmetrically because that's how the coils stacked that day. A texture that's rougher on one side because my hand was moving faster there. These aren't things I'm failing to fix. They're the parts of the process that are still visible once the process is over.\n\nI think about this most with faces, where the temptation toward symmetry is strongest. A face built too evenly starts to feel general — a type, rather than a specific presence. The slight unevenness is often what gives it a character that feels like it belongs to one particular sculpture and not to sculpture in general.\n\nFiring adds its own layer of unevenness on top of whatever I've left in the clay. Oxides pool differently depending on how the piece sat in the kiln. Engobes can shift a shade lighter or darker than expected. I've stopped trying to fully predict this, and mostly try to leave the piece in a state where those shifts will feel like they belong rather than like an accident layered on top.\n\nNone of this is an argument against skill or care — if anything it takes more attention to leave the right things unresolved than to smooth everything toward a safe average. But the goal isn't a flawless surface. It's a surface that still shows the hands that made it, unevenness included.`,
    published: true,
    published_at: '2026-07-22T09:00:00Z',
    cover_media_id: MEDIA.untitledXI,
    gallery: [MEDIA.untitledXII, MEDIA.untitledXIII],
  },
  {
    slug: 'surface-notes',
    title: 'Surface Notes',
    excerpt: 'A short, image-led look at how color and texture get built up in the final stages.',
    body:
      `Color comes late in the process, and mostly stays restrained. I apply engobes before the bisque firing, usually my own mixed clay rather than a commercial glaze, so the color sits closer to the surface than on top of it. After bisque, I go back in sparingly with sulfate and oxide — enough to pick out the forms that are already there, not to add new ones.\n\nThe images below are close details from a few recent pieces, mostly unedited from how they came out of the kiln. I find these close-up views tell you more about the surface decisions than a full view of the finished sculpture usually does.`,
    published: true,
    published_at: '2026-08-30T09:00:00Z',
    cover_media_id: MEDIA.untitledXIV,
    gallery: [],
  },
];

for (const post of posts) {
  const { gallery, ...row } = post;
  const { data: inserted, error } = await supabase.from('posts').insert(row).select('id').single();
  if (error) {
    console.error(`post insert failed for ${post.slug}:`, error.message);
    continue;
  }
  if (gallery.length) {
    const rows = gallery.map((media_id, i) => ({ post_id: inserted.id, media_id, display_order: i }));
    const { error: imgError } = await supabase.from('post_images').insert(rows);
    if (imgError) console.error(`post_images insert failed for ${post.slug}:`, imgError.message);
  }
  console.log(`post created: ${post.slug} (${inserted.id})`);
}

console.log('\nDone.');
