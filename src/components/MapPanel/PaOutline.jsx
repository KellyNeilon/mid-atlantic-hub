/**
 * PaOutline — placeholder geometry for the map panel.
 *
 * A simplified Pennsylvania boundary so the panel can be designed, reviewed and
 * shipped before the real map is wired in. It is NOT the real thing: the actual
 * PennDOT geometry already lives in this repo and is what DistrictMap renders.
 *
 * Swap it out with:            <MapPanel><DistrictMap /></MapPanel>
 * and delete this file. MapPanel takes the map as children and knows nothing
 * about it, so nothing else on the page changes.
 *
 * The view is zoomed to the service area with the Media office anchored, per
 * the design lock: "a narrower container zooms in rather than scaling down,
 * and the Media office is the fixed reference point at every size." Fitting the
 * whole state into a portrait panel leaves the outline small and floating in
 * dead space, which is exactly what that rule exists to prevent.
 */

// The full state, in a 1000-wide projected space. The panel shows a window
// onto it rather than the whole thing.
const PA_PATH =
  'M 0.0 63.4 L 0.0 0.5 L 33.5 23.3 L 77.6 38.2 L 134.7 0.0 L 134.7 63.4 L 288.1 63.7 L 448.3 63.7 L 626.3 63.7 L 768.6 63.7 L 918.3 63.7 L 936.6 95.5 L 969.7 157.5 L 984.9 208.9 L 972.4 256.7 L 1000.0 303.9 L 987.7 356.9 L 969.7 399.3 L 948.4 438.2 L 947.3 492.5 L 908.9 558.5 L 893.2 572.6 L 877.2 573.1 L 857.6 582.0 L 841.8 600.4 L 715.3 600.7 L 555.1 600.9 L 377.1 600.2 L 185.4 600.7 L 0.0 600.7 Z';

// x y w h — the eastern service area, Media at roughly 65% across, 60% down.
const VIEW = '592 37 450 600';

// Stand-in markers. Real ones come from the district data with the map.
const MARKERS = [
  { x: 885, y: 397, home: true, label: 'Media — 1400 N Providence Rd' },
  { x: 905, y: 361, label: 'Upper Dublin' },
  { x: 845, y: 331, label: 'North Penn' },
  { x: 930, y: 313, label: 'Bensalem' },
  { x: 790, y: 433, label: 'Coatesville' },
  { x: 870, y: 246, label: 'Bethlehem' },
  { x: 710, y: 114, label: 'Scranton' },
  { x: 660, y: 373, label: 'Harrisburg' },
  { x: 600, y: 180, label: 'Wyoming Valley' },
];

export default function PaOutline() {
  return (
    <svg className="mh-pa" viewBox={VIEW} role="img" aria-label="Pennsylvania districts">
      <g className="mh-pa-grid" aria-hidden="true">
        <path d="M 592 157 H 1042 M 592 277 H 1042 M 592 397 H 1042 M 592 517 H 1042" />
        <path d="M 682 37 V 637 M 772 37 V 637 M 862 37 V 637 M 952 37 V 637" />
      </g>
      <path className="mh-pa-outline" d={PA_PATH} />
      {MARKERS.map((m) => (
        <circle
          key={m.label}
          className={m.home ? 'mh-pa-home' : 'mh-pa-dot'}
          cx={m.x}
          cy={m.y}
          r={m.home ? 8 : 6}
        >
          <title>{m.label}</title>
        </circle>
      ))}
    </svg>
  );
}
