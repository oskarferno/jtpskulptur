import type { ShippingRegion } from '../types/database';

// Single source of truth for "which country codes are valid for this
// shipping region" — used both when creating a Stripe Checkout Session
// (restricts Stripe's own hosted address form to these countries) and by
// the webhook afterward (verifies the address Stripe actually returned is
// still one of them). Keeping one copy means those two checks can never
// drift apart.

export const SHIPPING_REGIONS: readonly ShippingRegion[] = ['sweden', 'denmark', 'norway', 'finland', 'eu', 'us', 'row'];

// Denmark, Norway, and Finland have their own dedicated regions (and
// prices) rather than falling under "eu"/"row", so they're deliberately
// excluded here — each country belongs to exactly one selectable region,
// never two, or a customer could pick cheaper "eu" pricing while actually
// shipping to Denmark. Sweden is excluded from this list for the same
// reason.
const EU_COUNTRIES: string[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'EE', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
];
// A broad, representative "rest of world" list rather than a full exhaustive
// one — Stripe requires an explicit allow-list, there's no "everywhere
// except X" option. Extend this if a real order needs a country not here.
const ROW_COUNTRIES: string[] = [
  'GB', 'CH', 'IS', 'CA', 'AU', 'NZ', 'JP', 'KR', 'SG', 'BR', 'MX', 'ZA', 'AE', 'IN',
];

export function allowedCountriesFor(region: ShippingRegion): string[] {
  switch (region) {
    case 'sweden':
      return ['SE'];
    case 'denmark':
      return ['DK'];
    case 'norway':
      return ['NO'];
    case 'finland':
      return ['FI'];
    case 'eu':
      return EU_COUNTRIES;
    case 'us':
      return ['US'];
    case 'row':
      return ROW_COUNTRIES;
  }
}

// Whether an address country Stripe actually returned is consistent with
// the shipping region the customer selected (and paid the rate for) before
// ever reaching Stripe. For single-country regions this is an exact match;
// for grouped regions (eu/row) it's membership in that group.
export function countryMatchesRegion(country: string | null | undefined, region: ShippingRegion): boolean {
  if (!country) return false;
  return allowedCountriesFor(region).includes(country);
}
