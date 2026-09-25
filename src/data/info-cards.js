/*
  info-cards.js — the eight cards in the homepage slider, in loop order.

  ADDING OR CHANGING CARD ART
  ---------------------------
  Drop a file into  public/assets/cards/  named after the card's `id`:

      public/assets/cards/presentation-generator.svg
      public/assets/cards/learning-center.svg
      public/assets/cards/social.png            <- set art: 'social.png' below

  That is the whole workflow. SVG is assumed, so an .svg named after the id
  needs no code change at all — commit the file and it appears. Any other
  format just needs its filename in the card's `art` field, which is what the
  current placeholder PNGs use.

  THE EIGHT IN THE FOLDER RIGHT NOW are placeholders, renamed from Artboard
  1-8 in card order. Replacing one is a straight overwrite — same filename,
  new artwork. Switching a card to SVG means deleting its `art` line, since
  `<id>.svg` is the default.

  Nothing is imported or bundled: these are static files served straight out
  of /public, so adding one never touches the build. A card whose art file is
  missing falls back to a generated two-stop gradient (see cardFallback), so
  the slider always looks finished — an empty folder is a valid state, not a
  row of broken images.

  ART SPEC, to match the locked design
  ------------------------------------
    aspect      3:2 landscape (cards render it at 100% width, cover)
    safe area   keep anything that must read inside the middle 80%
    style       one oversized line glyph bleeding off the top-right corner,
                over a flat two-stop gradient. No photography.
    colour      the glyph in white at 85–100%; let the gradient carry the hue
    weight      2.5–3px strokes at 300×200, round caps and joins
    file        SVG preferred, with width/height stripped and a viewBox kept
                so it scales; under ~15 KB

  CHANGING THE CARDS THEMSELVES
  -----------------------------
  Edit this array. Order here is loop order in the slider. `href` null renders
  the card as visibly not-yet-linked rather than as a dead button.

  Four fields per card:
    title    the headline. Set in caps by the CSS, so write it in title case.
    subhead  ONE line. Keep it under ~42 characters — that is what fits on a
             150px card without wrapping to three lines. Say what the tool
             does for the person, not what it is.
    cta      the button label, 2-3 words, and a VERB. Eight cards all saying
             "Learn more" tells the reader nothing and wastes the strongest
             piece of type on the card; "Build a deck" tells them exactly what
             happens when they click. Set in caps by the CSS too.
    href     null until the destination exists.
*/

export const CARD_ART_DIR = '/assets/cards';

export const INFO_CARDS = [
  {
    id: 'presentation-generator',
    title: 'Presentation Generator',
    subhead: 'Turn project data into a branded deck.',
    cta: 'Build a deck',
    art: 'presentation-generator.png',
    href: null,
  },
  {
    id: 'monthly-weekly-updater',
    title: 'Monthly / Weekly Updater',
    subhead: "Post your team's update in minutes.",
    cta: 'Post an update',
    art: 'monthly-weekly-updater.png',
    href: null,
  },
  {
    id: 'learning-center',
    title: 'Learning Center',
    subhead: 'Courses, certifications, training paths.',
    cta: 'Start learning',
    art: 'learning-center.png',
    href: null,
  },
  {
    id: 'mentorship-program',
    title: 'Mentorship Program',
    subhead: 'Find a mentor, or become one.',
    cta: 'Get matched',
    art: 'mentorship-program.png',
    href: null,
  },
  {
    id: 'company-benefits',
    title: 'Company Benefits',
    subhead: 'Health, retirement, time off and perks.',
    cta: 'See benefits',
    art: 'company-benefits.png',
    href: null,
  },
  {
    id: 'upcoming-events',
    title: 'Upcoming Events',
    subhead: "What's on across the Mid-Atlantic.",
    cta: 'View calendar',
    art: 'upcoming-events.png',
    href: null,
  },
  {
    id: 'announcements',
    title: 'Announcements',
    subhead: 'Company and regional news, first.',
    cta: 'Read the news',
    art: 'announcements.png',
    href: null,
  },
  {
    id: 'social',
    title: 'Social',
    subhead: 'Photos, milestones and team wins.',
    cta: 'See the feed',
    art: 'social.png',
    href: null,
  },
];

/** Where a card's art lives. `art` overrides the `<id>.svg` convention. */
export function cardArt(card) {
  return `${CARD_ART_DIR}/${card.art || `${card.id}.svg`}`;
}

/**
 * What a card looks like before its art file exists.
 *
 * A two-stop gradient rotated around the teal accent by the card's position,
 * so the eight are visibly distinct from each other and stable across
 * reloads — reordering the array reorders the colours with the cards, which
 * is what you want when you are still deciding on order. Deliberately flat
 * and quiet: this is a placeholder that should look deliberate, not a
 * placeholder that shouts to be replaced.
 */
export function cardFallback(index) {
  const hue = (176 + index * 26) % 360;          // 176deg is the accent's hue
  return `linear-gradient(142deg,
    hsl(${hue} 44% 26%) 0%,
    hsl(${(hue + 18) % 360} 52% 15%) 100%)`;
}

export default INFO_CARDS;
