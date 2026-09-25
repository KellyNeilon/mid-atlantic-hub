// daylight.js — the hero's day cycle.
//
// A 17-frame sun transition, shot as one sequence, used exactly as supplied.
// One animated number, `--day-t`, runs 0 (light / frame 00) to 1 (dark /
// frame 16) and the stack cross-dissolves through every frame on the way.
//
// This replaces four earlier rounds that tried to fade between separately
// generated photographs. The reason those failed is now measurable and gone:
//
//                              worst neighbouring pair (SSIM)
//   five generated plates                 0.201
//   two plates, one derived               0.935   (only 2 frames)
//   this sequence                         0.941   (17 frames)
//
// A cross-fade can hide a change of light. It cannot hide the scene moving.
// These frames do not move, so nothing has to be hidden — no blur, no
// softening, no derived plates. `--plate-soften` is gone.

// ---------------------------------------------------------------------------
// The stops.
//
// `t`   position in the sequence. NOT the frame number over 16 — each frame's
//       share of the total CIE Lab distance the scene travels. The sequence is
//       heavily back-loaded: frames 00–09 are 59% of the frames but carry only
//       31% of the visible change, and the single step 15→16 carries 17% of it.
//       Spaced evenly, the transition would crawl through a morning where
//       nothing appears to happen and then rush the actual sunset. Spaced this
//       way, every millisecond carries the same amount of visible change.
//
// `lum` mean luminance, measured at full resolution. Drives the legibility
//       scrim, so it deepens exactly as much as the photograph brightens.
//       Re-run scripts/build-hero-plates.py and paste its output to update.
// ---------------------------------------------------------------------------
export const STOPS = [
  { i:  0, t: 0.0000, file: 'PA_Day_00', lum: 112.95 },  // light theme rests here
  { i:  1, t: 0.0327, file: 'PA_Day_01', lum: 114.22 },
  { i:  2, t: 0.0652, file: 'PA_Day_02', lum: 115.35 },
  { i:  3, t: 0.0969, file: 'PA_Day_03', lum: 116.26 },
  { i:  4, t: 0.1294, file: 'PA_Day_04', lum: 116.96 },
  { i:  5, t: 0.1607, file: 'PA_Day_05', lum: 117.28 },  // brightest frame
  { i:  6, t: 0.1915, file: 'PA_Day_06', lum: 117.24 },
  { i:  7, t: 0.2254, file: 'PA_Day_07', lum: 116.71 },
  { i:  8, t: 0.2621, file: 'PA_Day_08', lum: 115.56 },
  { i:  9, t: 0.3058, file: 'PA_Day_09', lum: 113.69 },
  { i: 10, t: 0.3567, file: 'PA_Day_10', lum: 110.96 },
  { i: 11, t: 0.4180, file: 'PA_Day_11', lum: 107.25 },
  { i: 12, t: 0.4922, file: 'PA_Day_12', lum: 102.44 },
  { i: 13, t: 0.5845, file: 'PA_Day_13', lum:  96.16 },
  { i: 14, t: 0.6957, file: 'PA_Day_14', lum:  88.51 },
  { i: 15, t: 0.8329, file: 'PA_Day_15', lum:  79.09 },
  { i: 16, t: 1.0000, file: 'PA_Day_16', lum:  67.76 },  // dark theme rests here
];

// Two states. Everything between is passed through, never parked on — unless
// clock mode is switched on below, which parks on whichever frame matches the
// real hour.
export const THEME_T = { light: 0.0, dark: 1.0 };

export const IMG_BASE = '/assets/hero';
export const WIDTHS = [1280, 1717];

export function srcSet(file, ext) {
  return WIDTHS.map((w) => `${IMG_BASE}/${file}-${w}.${ext} ${w}w`).join(', ');
}

// `@property --day-t` in hero.css is what lets the browser interpolate the
// number in the style engine instead of us running an animation loop. Where it
// is unsupported the number snaps at the midpoint, so hero.css falls back to a
// plain two-plate cross-fade. Same proxy the rest of the file uses.
export const SMOOTH =
  typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function';

// ---------------------------------------------------------------------------
// Opacity: a stack, not a set of tents.
//
// Frame 00 sits at the bottom at opacity 1 forever. Every frame above it fades
// in over the one below as `--day-t` crosses its leg, and STAYS at 1 once it
// has. So at any moment exactly one pair is dissolving and everything else is
// fully on or fully off:
//
//   opacity(i) = clamp(0, (day-t - t[i-1]) / (t[i] - t[i-1]), 1)
//
// The composite is a·frame[i] + (1−a)·frame[i−1] — arithmetically identical to
// the tent-shaped weights this used to use, but with three properties the
// tents did not have:
//
//   * The background can never show through. With tents the whole stack was
//     transparent except for the two active plates, so any frame that had not
//     finished decoding punched a hole to the navy underneath. Here an
//     undecoded frame simply leaves the previous one showing — it degrades to
//     a coarser transition instead of a black flash. That is what makes it
//     safe to defer 16 of the 17 downloads (see HeroBackground).
//   * No sum-to-one constraint to maintain, so there is no grey dip and no
//     blow-out to guard against, and no smootherstep needed to round off the
//     corner at each stop. With 17 frames each leg spans about 2.3 dE — far
//     too small a difference for a corner in the opacity curve to be visible.
//   * The compositor can occlusion-cull everything under the topmost opaque
//     frame, so a 17-layer stack costs about what a 2-layer stack costs at
//     rest. (The plates are encoded without an alpha channel so the browser
//     knows they are opaque.)
// ---------------------------------------------------------------------------
function ramp(i) {
  if (i === 0) return '1';
  const span = STOPS[i].t - STOPS[i - 1].t;
  return `clamp(0, calc((var(--day-t) - ${STOPS[i - 1].t}) * ${(1 / span).toFixed(4)}), 1)`;
}

export function sceneVars() {
  const vars = {};
  STOPS.forEach((s, i) => {
    vars[`--o-${s.i}`] = ramp(i);
  });

  // Live luminance of what is actually on screen. Only the dissolving pair
  // contributes, so this is the same lerp the compositor is doing:
  //   lum = lum[i-1] + (lum[i] - lum[i-1]) * opacity(i), accumulated.
  const first = STOPS[0].lum;
  const terms = STOPS.slice(1)
    .map((s, k) => `var(--o-${s.i}) * ${(s.lum - STOPS[k].lum).toFixed(2)}`)
    .join(' + ');
  vars['--scene-lum'] = `calc(${first} + ${terms})`;

  const lo = Math.min(...STOPS.map((s) => s.lum));
  const hi = Math.max(...STOPS.map((s) => s.lum));
  vars['--scene-bright'] =
    `clamp(0, calc((var(--scene-lum) - ${lo}) * ${(1 / (hi - lo)).toFixed(5)}), 1)`;

  return vars;
}

export function themeToT(theme) {
  return THEME_T[theme] ?? THEME_T.dark;
}

/**
 * The complete style object for the daylight scene: every frame's opacity, the
 * live luminance, and the four clocks.
 *
 * This belongs on the PAGE SHELL, not on the scene element — apply it to
 * `.hub2-shell` (with the `mh-daylight` class, which carries the transition).
 * Custom properties inherit down the DOM and not across it, and the scene is a
 * *sibling* of the hero copy, the cards and the map, so anything set on the
 * scene alone is invisible to all of them. That was design-lock O8: the type
 * clock and the glass tokens were published somewhere nothing could read.
 *
 * Put it on the shell and every one of them inherits `--day-t` for free —
 * which is also what makes the map panel's glass tint track the daylight with
 * no wiring at all.
 */
export function sceneStyle(theme, clock = false) {
  const t = String(clock ? clockT() : themeToT(theme));
  return {
    ...sceneVars(),
    '--day-t': t,
    '--atmos-t': t,
    '--text-t': t,
  };
}

// Which frame a given t rests on — used to decide what to fetch first.
export function nearestStop(t) {
  return STOPS.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
}

// ---------------------------------------------------------------------------
// Optional clock mode: <ThemeScene clock /> ignores the theme and follows the
// real local time, so the hub looks like the hour it actually is. This is the
// only mode that parks on the middle frames, and the reason the full 17 are
// worth shipping rather than trimming to the ~11 a theme toggle would need.
// Anchors are (hour, t) pairs, linearly interpolated.
// ---------------------------------------------------------------------------
const CLOCK = [[6, 0.0], [9, 0.19], [12, 0.30], [15, 0.42], [18, 0.70], [20.5, 1.0]];
export function clockT(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h <= CLOCK[0][0] || h >= CLOCK[CLOCK.length - 1][0]) return 1.0;
  for (let i = 0; i < CLOCK.length - 1; i++) {
    const [h0, t0] = CLOCK[i];
    const [h1, t1] = CLOCK[i + 1];
    if (h < h1) return t0 + ((h - h0) / (h1 - h0)) * (t1 - t0);
  }
  return 1.0;
}
