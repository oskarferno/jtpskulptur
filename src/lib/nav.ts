export function initNav() {
  const toggle = document.querySelector<HTMLButtonElement>('#nav-toggle');
  const panel = document.querySelector<HTMLElement>('#mobile-menu');
  const header = document.querySelector<HTMLElement>('#site-header');
  if (!toggle || !panel || !header) return;

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

  const desktopQuery = window.matchMedia('(min-width: 75rem)');
  desktopQuery.addEventListener('change', (event) => {
    if (event.matches && isOpen()) closeMenu({ restoreFocus: false });
  });
}
