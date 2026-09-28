// Shared route/label data for the header and footer navigation — a single
// source of truth so the two never drift into different link sets. Header
// and footer each render this data with their own markup/styling; only the
// routes and labels are shared, not presentation.

export interface NavLink {
  href: string;
  label: string;
}

export interface NavCounts {
  exhibitionCount: number | null;
  postCount: number | null;
  shopItemCount: number;
}

export function getPublicNavLinks({ exhibitionCount, postCount, shopItemCount }: NavCounts): NavLink[] {
  return [
    { href: '/portfolio', label: 'Portfolio' },
    ...(exhibitionCount ? [{ href: '/exhibitions', label: 'Exhibitions' }] : []),
    ...(postCount ? [{ href: '/journal', label: 'Journal' }] : []),
    ...(shopItemCount > 0 ? [{ href: '/shop', label: 'Shop' }] : []),
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];
}

export const LEGAL_LINKS: NavLink[] = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
];
