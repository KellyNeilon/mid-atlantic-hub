// Hex color mixing, ported 1:1 from the original prototype's h2r/mix
// helpers. Used to blend a district's fill between the "low presence"
// and "high presence" theme colors.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** HSL (h in degrees, s/l in 0..1) -> "#rrggbb". */
export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to255 = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/** "#rrggbb" -> [h(0..360), s(0..1), l(0..1)]. */
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

/**
 * A "past client" version of an active client's color: same hue, faded
 * toward the map's dark background instead of just dimmed, so it reads as
 * "history" rather than "same but weaker."
 */
export function muteColor(hex, satScale = 0.42, lightScale = 0.7) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s * satScale, l * lightScale);
}

/**
 * n hues evenly spaced across an arc of the color wheel (in degrees),
 * starting at `start`. Used to give each client district its own hue
 * without hand-picking one at a time — restrict `lengthDeg` to an arc
 * that excludes hues already meaningful elsewhere on the map (the county
 * line's teal, the old base/accent blues) so client colors never get
 * confused with map chrome.
 */
export function spacedHues(n, start, lengthDeg) {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => (start + (i + 0.5) * (lengthDeg / n)) % 360);
}

/** Initials fallback for a missing logo, e.g. "Abington Heights SD" -> "AH". */
export function districtInitials(name) {
  return (name || '')
    .replace(/School District|SD|Area/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}
