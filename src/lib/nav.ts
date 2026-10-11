export function initNav() {
  const toggle = document.querySelector<HTMLButtonElement>('#nav-toggle');
  const panel = document.querySelector<HTMLElement>('#mobile-menu');
  const header = document.querySelector<HTMLElement>('#site-header');
  if (!toggle || !panel || !header) return;

  // Input modality, for the mobile menu's programmatic focus only. openMenu()
  // focuses the first link and closeMenu() focuses the toggle, which keeps
  // keyboard and screen-reader users oriented — but on iOS Safari a tap
  // doesn't focus the tapped button, so WebKit treats the script's focus()
  // as keyboard-style and matches :focus-visible, painting the site's clay
  // focus ring on "Portfolio" / the hamburger after a plain touch. Recording
  // whether the last input was a pointer or a key lets global.css hide the
  // ring for pointer use only; keyboard users still get it. Unset until the
  // first input, so nothing is ever suppressed without evidence of a pointer.
  const root = document.documentElement;
  document.addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; }, true);
  document.addEventListener('keydown', () => { root.dataset.input = 'keyboard'; }, true);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CLOSE_DELAY = reduceMotion ? 0 : 220;
  let closeTimer: number | undefined;

  const syncOffset = () => {
    panel.style.top = `${header.getBoundingClientRect().height}px`;
  };

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  const openMenu = () => {
    window.clearTimeout(closeTimer);
    syncOffset();
    panel.hidden = false;
    document.documentElement.classList.add('overflow-hidden');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    panel.querySelector<HTMLAnchorElement>('a')?.focus();
  };

  const closeMenu = (options: { restoreFocus?: boolean } = {}) => {
    const { restoreFocus = true } = options;
    panel.classList.remove('is-open');
    document.documentElement.classList.remove('overflow-hidden');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      panel.hidden = true;
    }, CLOSE_DELAY);
    if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    if (isOpen()) closeMenu();
    else openMenu();
  });

  panel.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('a')) closeMenu({ restoreFocus: false });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (isOpen()) syncOffset();
  });

  // Browser Back can restore this page from the back/forward cache exactly as
  // it was left — menu mid-close, a tapped link still focused. Settle it.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && isOpen()) closeMenu({ restoreFocus: false });
  });

  const desktopQuery = window.matchMedia('(min-width: 75rem)');
  desktopQuery.addEventListener('change', (event) => {
    if (event.matches && isOpen()) closeMenu({ restoreFocus: false });
  });
}
