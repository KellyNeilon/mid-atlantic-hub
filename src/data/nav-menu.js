// Bottom pinned nav bar — six items, order and destinations locked in
// claude/homepage-design-lock.md. Sections navigate in the same tab (cards
// and ticker items open in a new tab instead — see InfoCard/TickerItem).
// "Home" has no href: it's already the page you're on. "Tools" has no
// destination yet (design-lock item O2) — give it an `href` once the
// Tools hub page exists and it stops rendering as "soon".
export const NAV_MENU = [
  { id: 'home', label: 'Home' },
  {
    id: 'who-we-are',
    label: 'Who We Are',
    href: 'https://wearelegence.sharepoint.com/sites/Mid-Atlantic-Marketing/SitePages/Who-we-are.aspx',
  },
  {
    id: 'whats-happening',
    label: "What's Happening",
    href: "https://wearelegence.sharepoint.com/sites/Mid-Atlantic-Marketing/SitePages/What's-happening.aspx",
  },
  { id: 'training', label: 'Training', href: 'https://www.dayforce.com' },
  { id: 'tools', label: 'Tools', soon: true },
  {
    id: 'knowledge-hub',
    label: 'Knowledge Hub',
    href: 'https://black-beach-08680560f.7.azurestaticapps.net',
  },
];
