// Google Analytics 4, gated on the visitor's explicit consent.
//
// Nothing here runs unless components/Analytics.astro was rendered, which
// layouts/Layout.astro only does on a production hostname — so localhost,
// workers.dev and preview deploys never contain this code at all.
//
// Consent model ("basic" Consent Mode v2): the Google tag is not even
// requested until the visitor presses Accept. Ad-related signals stay denied
// permanently — this site runs no advertising. Navigation is ordinary
// full-page loads (no client-side router), so the single `config` call below
// produces exactly one automatic page_view per page load; there is
// deliberately no manual page_view anywhere.

import { GA_MEASUREMENT_ID } from './analytics-config';

const STORAGE_KEY = 'jtp-analytics-consent';
const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

// Removed from page_location before it is sent — e.g. /shop/success carries
// a Stripe checkout session id in its query string.
const SENSITIVE_PARAMS = ['session_id', 'token', 'token_hash', 'code', 'email'];

type Choice = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let activated = false;

function readChoice(): Choice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: Choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private browsing) — the choice just won't persist.
  }
}

function sanitizedLocation(): string {
  const url = new URL(window.location.href);
  for (const param of SENSITIVE_PARAMS) url.searchParams.delete(param);
  url.hash = '';
  return url.toString();
}

function activate() {
  if (activated) return;
  activated = true;

  window.dataLayer = window.dataLayer || [];
  // gtag.js requires the literal `arguments` object in the dataLayer, not an
  // array of them — a rest-args version silently breaks the tag.
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
  window.gtag('consent', 'update', { analytics_storage: 'granted' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `${GTAG_SRC}?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_location: sanitizedLocation(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

// Withdrawing consent after the tag has loaded: remove Google's cookies and
// reload, so the tag isn't left running in memory on this page.
function deactivate() {
  const host = window.location.hostname;
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name || !(name === '_ga' || name.startsWith('_ga_'))) continue;
    for (const domain of [host, `.${host}`, '']) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
  window.location.reload();
}

// The seam for future GA4 events (view_item, add_to_cart, begin_checkout,
// purchase): import this from any client script. It is a no-op until the
// visitor has consented, so callers never need to check consent themselves.
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!activated) return;
  window.gtag('event', name, params);
}

export function initAnalytics() {
  const banner = document.getElementById('cookie-consent');
  if (!banner) return;

  const showBanner = () => {
    banner.hidden = false;
  };
  const hideBanner = () => {
    banner.hidden = true;
  };

  const stored = readChoice();
  if (stored === 'granted') activate();
  else if (stored === null) showBanner();

  banner.querySelectorAll<HTMLButtonElement>('[data-consent-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.consentChoice as Choice;
      writeChoice(choice);
      hideBanner();
      if (choice === 'granted') activate();
      else if (activated) deactivate();
    });
  });

  // Footer "Cookie settings" link (rendered only on production).
  document.querySelectorAll<HTMLElement>('[data-cookie-settings]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      showBanner();
      banner.focus();
    });
  });
}
