// Shared choose/preview/replace/remove wiring for admin image uploads —
// used by New Artwork, Edit Artwork (primary image), and Edit Artwork (hero
// image override). Nothing is uploaded to Storage until the caller actually
// invokes uploadImage() (normally from the form's own submit handler), so
// picking a file and then abandoning the form never creates an orphaned
// upload.

export type PickerState = { kind: 'unchanged' } | { kind: 'file'; file: File } | { kind: 'removed' };

export interface ImagePickerRefs {
  fileInput: HTMLInputElement;
  preview: HTMLImageElement;
  placeholder: HTMLElement;
  removeButton: HTMLButtonElement;
  status: HTMLElement;
}

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function initImagePicker(refs: ImagePickerRefs, initialUrl: string | null, onChange?: () => void) {
  let state: PickerState = { kind: 'unchanged' };
  let objectUrl: string | null = null;

  function render(url: string | null) {
    if (url) {
      refs.preview.src = url;
      refs.preview.hidden = false;
      refs.placeholder.hidden = true;
      refs.removeButton.hidden = false;
    } else {
      refs.preview.hidden = true;
      refs.preview.removeAttribute('src');
      refs.placeholder.hidden = false;
      refs.removeButton.hidden = true;
    }
  }

  render(initialUrl);

  refs.fileInput.addEventListener('change', () => {
    const file = refs.fileInput.files?.[0];
    if (!file) return;
    refs.status.textContent = '';

    if (!ALLOWED_TYPES.includes(file.type)) {
      refs.status.textContent = 'Please choose a JPG, PNG, or WebP image.';
      refs.fileInput.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      refs.status.textContent = 'That file is larger than 20MB — please choose a smaller image.';
      refs.fileInput.value = '';
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    state = { kind: 'file', file };
    render(objectUrl);
    onChange?.();
  });

  refs.removeButton.addEventListener('click', () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    refs.fileInput.value = '';
    state = { kind: 'removed' };
    render(null);
    onChange?.();
  });

  return {
    getState: (): PickerState => state,
    // Effective "will there be an image" after this picker's pending
    // change is applied — used to preview which image the homepage would
    // actually use without waiting for a save round trip.
    hasImage: () => state.kind === 'file' || (state.kind === 'unchanged' && !!initialUrl),
  };
}

// Click-to-set focal point for the homepage hero — the admin clicks the
// most important area of whichever image is currently effective (normally
// the sculpture's head), and that point is stored as X/Y percentages and
// applied verbatim as CSS object-position on the homepage. No coordinates,
// URLs, or CSS to enter by hand, and no automatic face/subject detection —
// the admin's click is the only source of the value.
export interface FocalPickerRefs {
  wrap: HTMLElement;
  image: HTMLImageElement;
  marker: HTMLElement;
  noImageMessage: HTMLElement;
  heroPreview?: HTMLImageElement;
  // A second live preview, for a page that already has its own image
  // preview elsewhere (e.g. the Contact Page Image picker's own small
  // preview) — kept in sync the same way heroPreview is, without that
  // other preview needing to know the focal point exists.
  extraPreviews?: HTMLImageElement[];
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function initFocalPicker(refs: FocalPickerRefs, initial: { x: number; y: number }) {
  let x = clampPercent(initial.x);
  let y = clampPercent(initial.y);

  function render() {
    refs.marker.style.left = `${x}%`;
    refs.marker.style.top = `${y}%`;
    if (refs.heroPreview) {
      refs.heroPreview.style.objectPosition = `${x}% ${y}%`;
    }
    for (const preview of refs.extraPreviews ?? []) {
      preview.style.objectPosition = `${x}% ${y}%`;
    }
  }

  refs.image.addEventListener('click', (event) => {
    const rect = refs.image.getBoundingClientRect();
    x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
    render();
  });

  render();

  return {
    getPosition: () => ({ x, y }),
    // Lets a "Reset focal point" button put the marker (and preview) back
    // at a given point — normally the column's own database default —
    // without touching which image is staged.
    setPosition(newX: number, newY: number) {
      x = clampPercent(newX);
      y = clampPercent(newY);
      render();
    },
    // Called whenever the effective hero image changes (a new file staged,
    // an existing one removed) — keeps the focal picker and the hero
    // preview pointed at whichever image would actually be used.
    setImageSrc(url: string | null) {
      if (url) {
        refs.image.src = url;
        refs.wrap.hidden = false;
        refs.noImageMessage.hidden = true;
        if (refs.heroPreview) refs.heroPreview.src = url;
      } else {
        refs.wrap.hidden = true;
        refs.noImageMessage.hidden = false;
        if (refs.heroPreview) refs.heroPreview.removeAttribute('src');
      }
    },
  };
}

export async function uploadImage(file: File, bucket: string, altText: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);
  if (altText) formData.append('alt_text', altText);
  const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
  const result = (await res.json().catch(() => ({}))) as { media?: { id: string }; error?: string };
  if (!res.ok || !result.media) {
    throw new Error(result.error ?? 'Image upload failed.');
  }
  return result.media.id;
}
