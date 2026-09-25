/*
  Homepage ticker.

  The ticker reads /data/ticker.json at runtime — a static file in public/, so
  it is NOT bundled and changing it does not require a rebuild of the app.

  Two ways that file gets updated, and the second replaces the first without a
  code change:

    NOW      edit public/data/ticker.json in GitHub's web editor. Commit, and
             Azure redeploys in about 90 seconds. No Azure work needed to make
             the ticker real.

    NEXT     a Logic App writes the same JSON every 15 minutes from the Outlook
             events calendar plus the MS Ticker SharePoint list, and the fetch
             below points at that URL instead. Adding or deleting a row in the
             list is then live within 15 minutes with no deploy at all.
             Setup and the workflow definition: docs/ticker-setup.md

  Ordering is from the design lock: the events feed loads first, then every
  list row carrying a check mark is appended. `kind` is what carries that —
  "event" sorts ahead of "news", and within each the feed's own order holds.

  FALLBACK is not decoration. The ticker sits at the very top of the page, so
  an empty one is the first thing anybody notices. If the fetch fails — bad
  deploy, Logic App down, someone commits malformed JSON — these show instead.
  Keep them true and boring.
*/

export const TICKER_FEED = '/data/ticker.json';

export const TICKER_ITEMS = [
  { kind: 'news', label: 'Project Map is live', href: 'https://black-beach-08680560f.7.azurestaticapps.net' },
  { kind: 'news', label: 'BD Directory added to the Hub', href: 'https://black-beach-08680560f.7.azurestaticapps.net?tool=bd' },
  { kind: 'news', label: '513 organisations now tracked in the Brain database', href: null },
  { kind: 'news', label: 'Marketing Hub homepage — under construction', href: null },
];

const ORDER = { event: 0, news: 1 };

/** Newest feed, or the baked fallback. Never throws, never returns empty. */
export async function loadTicker(signal) {
  try {
    const res = await fetch(TICKER_FEED, { signal, cache: 'no-cache' });
    if (!res.ok) return TICKER_ITEMS;
    const data = await res.json();
    const items = (Array.isArray(data) ? data : data.items) || [];
    const clean = items
      .filter((i) => i && typeof i.label === 'string' && i.label.trim())
      .map((i) => ({
        kind: i.kind === 'event' ? 'event' : 'news',
        label: i.label.trim(),
        // Only http(s). The feed is written by a Logic App from a SharePoint
        // list anyone on the team can edit, so a javascript: URL typed into a
        // Link column would otherwise become a click target on the homepage.
        href: typeof i.href === 'string' && /^https?:\/\//i.test(i.href) ? i.href : null,
      }));
    if (!clean.length) return TICKER_ITEMS;
    return clean.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  } catch {
    return TICKER_ITEMS;
  }
}
