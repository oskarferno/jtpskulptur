// Availability lives directly on `artworks` (see migration 0017) — an
// artwork IS the sellable record, there's no second product row to derive
// this from anymore. This file just centralizes the one extra rule: being
// marked "available" isn't enough on its own to be purchasable/listed in
// Shop — it also needs published=true and actual stock, both of which can
// change independently (e.g. inventory reserved to 0 mid-checkout).

export type Availability = 'available' | 'sold' | 'not_for_sale';

export interface PurchasableFields {
  published: boolean;
  availability: Availability;
  inventory: number;
}

export function isPurchasable(artwork: PurchasableFields): boolean {
  return artwork.published && artwork.availability === 'available' && artwork.inventory > 0;
}
