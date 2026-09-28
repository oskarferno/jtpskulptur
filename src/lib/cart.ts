// Client-side cart. Deliberately stores only { type, id, quantity } — never
// a price. The cart page re-fetches live data to display, and checkout
// re-derives everything from the database server-side; nothing written
// here is ever trusted as a price.
//
// `type` distinguishes a sculpture (artworks — the single source of truth
// for sellable artwork, see migration 0017) from a non-artwork Shop product
// (books, prints, merchandise). Both can appear in the same cart and the
// same order; checkout resolves each line against the correct table.

const STORAGE_KEY = 'jtp-cart';
const MAX_QUANTITY_PER_ITEM = 20;

export type CartItemType = 'artwork' | 'product';

export interface CartLine {
  type: CartItemType;
  id: string;
  quantity: number;
}

function sameLine(a: { type: CartItemType; id: string }, b: { type: CartItemType; id: string }) {
  return a.type === b.type && a.id === b.id;
}

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        l &&
        (l.type === 'artwork' || l.type === 'product') &&
        typeof l.id === 'string' &&
        Number.isInteger(l.quantity) &&
        l.quantity > 0
    );
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    window.dispatchEvent(new CustomEvent('cart:changed', { detail: { count: cartCount(lines) } }));
  } catch {
    // localStorage unavailable (private browsing, etc.) — cart just won't persist.
  }
}

function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function getCart(): CartLine[] {
  return readCart();
}

export function getCartCount(): number {
  return cartCount(readCart());
}

export function addToCart(type: CartItemType, id: string, quantity = 1) {
  const lines = readCart();
  const existing = lines.find((l) => sameLine(l, { type, id }));
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY_PER_ITEM);
  } else {
    lines.push({ type, id, quantity: Math.min(Math.max(quantity, 1), MAX_QUANTITY_PER_ITEM) });
  }
  writeCart(lines);
}

export function updateQuantity(type: CartItemType, id: string, quantity: number) {
  const lines = readCart();
  const existing = lines.find((l) => sameLine(l, { type, id }));
  if (!existing) return;
  if (quantity <= 0) {
    writeCart(lines.filter((l) => !sameLine(l, { type, id })));
    return;
  }
  existing.quantity = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
  writeCart(lines);
}

export function removeFromCart(type: CartItemType, id: string) {
  writeCart(readCart().filter((l) => !sameLine(l, { type, id })));
}

export function clearCart() {
  writeCart([]);
}

const CHECKOUT_SESSION_KEY = 'jtp-checkout-session';

// A private id this browser generates once and reuses across checkout
// attempts (not the Stripe session id — this exists before any Stripe
// session does, and outlives any single attempt). Sent to
// /api/checkout/session so the backend can recognize "this is the same
// shopper retrying" and immediately release their own earlier still-pending
// reservation — e.g. after clicking Back to fix the shipping country —
// instead of making them wait for it to expire. Never used for anything
// else; nothing about it is trusted as proof of identity or payment.
export function getCheckoutClientSessionId(): string {
  try {
    let id = localStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHECKOUT_SESSION_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — a fresh id just
    // means this specific retry can't supersede a previous attempt; the
    // reservation still safely expires on its own shortly after.
    return crypto.randomUUID();
  }
}

export interface CartValidatedItem {
  type: CartItemType;
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  inventory: number;
  image: string | null;
}

export interface CartReconcileResult {
  lines: CartLine[];
  items: CartValidatedItem[];
  count: number;
}

// The single place cart contents get checked against what the backend
// actually considers purchasable right now (published, available, in
// stock). Both the header and the Cart page call this instead of trusting
// raw localStorage — that duplication (Cart page reconciling in its own
// component state while the header just summed whatever was in storage) is
// what let the two disagree: an item that went sold/unpublished/out of
// stock would vanish from the Cart page's in-memory list but stay counted
// in the header indefinitely, since nothing ever wrote the correction back
// to storage. Reconciling here writes the corrected lines back via
// writeCart() (which also fires 'cart:changed'), so a dropped line can't
// keep re-appearing on the next page load either.
export async function reconcileCart(): Promise<CartReconcileResult> {
  // If this browser has ever started a checkout, give its own reservation a
  // chance to release *before* checking what's actually purchasable below.
  // Without this, landing back here (e.g. after clicking Back on Stripe's
  // hosted page) would see the reserved item's inventory still at zero and
  // silently drop it from the cart via the exact same "no longer
  // purchasable" logic that correctly drops a genuinely sold item — the
  // customer's own in-flight reservation would look indistinguishable from
  // someone else having bought it. Cheap no-op for every visitor who has
  // never attempted checkout (the common case): no id, no request.
  let checkoutSessionId: string | null = null;
  try {
    checkoutSessionId = localStorage.getItem(CHECKOUT_SESSION_KEY);
  } catch {
    // ignore — same private-browsing case getCheckoutClientSessionId() handles
  }
  if (checkoutSessionId) {
    try {
      await fetch('/api/checkout/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSessionId: checkoutSessionId }),
      });
    } catch {
      // Non-fatal — worst case this reconcile proceeds without the release
      // having happened yet, same as before this existed.
    }
  }

  const lines = readCart();
  if (lines.length === 0) {
    return { lines: [], items: [], count: 0 };
  }

  const artworkIds = lines.filter((l) => l.type === 'artwork').map((l) => l.id).join(',');
  const productIds = lines.filter((l) => l.type === 'product').map((l) => l.id).join(',');
  const params = new URLSearchParams();
  if (artworkIds) params.set('artworkIds', artworkIds);
  if (productIds) params.set('productIds', productIds);

  let items: CartValidatedItem[];
  try {
    const res = await fetch(`/api/cart/items?${params.toString()}`);
    const data = (await res.json()) as { items: CartValidatedItem[] };
    items = data.items ?? [];
  } catch {
    // A transient network failure isn't proof the cart is invalid — fall
    // back to the persisted (unvalidated) state rather than wiping it.
    return { lines, items: [], count: cartCount(lines) };
  }

  const validLines = lines.filter((l) => items.some((i) => i.type === l.type && i.id === l.id));
  if (validLines.length !== lines.length) {
    writeCart(validLines);
  }

  return { lines: validLines, items, count: cartCount(validLines) };
}
