// One list drives the Tools page gallery (and, later, any other place we
// want to list the tools). Each entry is a card AND a gallery slide — same
// data, two views.
//
// `view`  — an internal route, rendered inside this app by App.jsx (e.g. the
//           project map, the BD directory).
// `href`  — an external link, opens a separate Static Web App / page in a
//           new tab.
// Set exactly one of the two. Neither set means "not built yet" — render
// that honestly (dim/disabled card, no click-through) rather than a dead
// link or a silent no-op.
//
// `art` follows the same convention as info-cards.js: a filename under
// public/assets/cards/. Missing means fall back to toolFallback()'s gradient
// tile rather than a broken image.

export const TOOLS = [
  {
    id: 'project-map',
    title: 'Project Map',
    subhead: 'Every district, every project, geographically',
    cta: 'Open the map',
    view: 'map',
    art: 'project-map.png',
  },
  {
    id: 'bd-directory',
    title: 'BD Directory',
    subhead: 'Clients, coverage and whitespace',
    cta: 'Open the directory',
    view: 'bd',
    art: 'bd-directory.png',
  },
  {
    id: 'presentation-generator',
    title: 'Presentation Generator',
    subhead: 'Branded decks that run in a browser',
    cta: 'Build a deck',
    href: null,
    art: 'presentation-generator.png',
  },
  {
    id: 'monthly-weekly-updater',
    title: 'Monthly / Weekly Updater',
    subhead: 'Post your team update in minutes',
    cta: 'Post an update',
    href: null,
    art: 'monthly-weekly-updater.png',
  },
  {
    id: 'rfp-compiler',
    title: 'RFP Compiler',
    subhead: 'Assemble a response from past work',
    cta: 'Start a response',
    view: null,
    art: 'rfp-compiler.png',
  },
  {
    id: 'experience-finder',
    title: 'Experience Finder',
    subhead: 'Find the right past project, fast',
    cta: 'Search experience',
    view: null,
    art: 'experience-finder.png',
  },
  {
    id: 'client-intel',
    title: 'Client Intel',
    subhead: 'What we know, in one place',
    cta: 'Open intel',
    view: null,
    art: 'client-intel.png',
  },
  {
    id: 'content-studio',
    title: 'Content Studio',
    subhead: 'Templates, brand assets and copy',
    cta: 'Open the studio',
    view: null,
    art: 'content-studio.png',
  },
];

export const TOOL_ART_DIR = '/assets/cards';

export function toolArt(tool) {
  return `${TOOL_ART_DIR}/${tool.art || `${tool.id}.svg`}`;
}

// A deterministic gradient tile per tool, used when the art file above is
// missing (e.g. the placeholder set hasn't been swapped in yet). Spread
// evenly around the wheel from the brand teal so the set reads as a family.
export function toolFallback(index) {
  const hue = (176 + index * 26) % 360;
  return `linear-gradient(142deg, hsl(${hue} 44% 26%) 0%, hsl(${(hue + 18) % 360} 52% 15%) 100%)`;
}

export function isLive(tool) {
  return Boolean(tool.view || tool.href);
}

export default TOOLS;
