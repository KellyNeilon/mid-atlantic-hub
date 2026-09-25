// Ported 1:1 from the original pa-district-map.html prototype's geometry
// helpers (the `pj`, `pa`, and `cen` functions).
//
// The baked district/county data stores raw [lon, lat] coordinate pairs.
// PA is small enough, and far enough from the equator, that a full map
// projection (Mercator, Albers, etc.) is overkill — a simple equirectangular
// projection with a latitude-correction cosine looks correct at this scale
// and is much cheaper to compute for ~500 districts' worth of rings.

// Reference longitude and latitude-correction cosine tuned for Pennsylvania
// (centered roughly on 40.9°N). Longitude spans get multiplied by this
// cosine so a degree of longitude and a degree of latitude cover visually
// similar screen distance at PA's latitude.
export const REF_LON = -77.7;
export const LAT_COS = Math.cos((40.9 * Math.PI) / 180);

/**
 * Project an array of rings (each ring: an array of [lon, lat] pairs) into
 * local [x, y] coordinates. Y is flipped because SVG's y-axis points down
 * while latitude increases northward.
 */
export function projectRings(rings, l0 = REF_LON, cl = LAT_COS) {
  return rings.map((ring) => ring.map((p) => [(p[0] - l0) * cl, -p[1]]));
}

/**
 * Build an SVG path "d" string from a single projected ring.
 */
export function ringToPath(ring) {
  let d = 'M';
  for (let i = 0; i < ring.length; i++) {
    d += (i ? 'L' : '') + ring[i][0].toFixed(2) + ' ' + ring[i][1].toFixed(2);
  }
  return d + 'Z';
}

/**
 * Polygon centroid via the shoelace formula. Used to place RFP markers at
 * a district's visual center (added back in the interactions step).
 */
export function ringCentroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const c = p[0] * q[1] - q[0] * p[1];
    a += c;
    x += (p[0] + q[0]) * c;
    y += (p[1] + q[1]) * c;
  }
  a *= 0.5;
  return Math.abs(a) < 1e-9 ? ring[0] : [x / (6 * a), y / (6 * a)];
}
