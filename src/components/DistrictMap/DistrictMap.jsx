import { useEffect, useMemo, useRef, useState } from 'react';
import bakedDistricts from '../../data/bakedDistricts.json';
import countyOutlines from '../../data/countyOutlines.json';
import districtMunicipalities from '../../data/districtMunicipalities.json';
import { projectRings, ringToPath } from '../../lib/geometry';
import { loadDistrictData, matchDistrictRecord, formatMoney } from '../../lib/csv';
import { hslToHex, muteColor, spacedHues, districtInitials } from '../../lib/colors';
import { MIN_SCALE, clampPan, zoomAt } from '../../lib/zoomPan';
import './DistrictMap.css';

const VIEW_WIDTH = 1000;
const DATA_URL = '/data/district-data.csv';
const LOGO_DIR = '/assets/logos/';
// Header-strip brand mark, top-right — the real ICS/CMTA white logo
// (ICS always leads, per brand usage). If this file is ever missing, the
// <img> 404s, onError flips brandLogoOk false, and the "ICS · CMTA" text
// fallback below takes its place instead.
const BRAND_LOGO_SRC = '/assets/brand/logo-white.png';

// Every active-client district gets its own hue, spread across this arc
// of the color wheel — deliberately NOT 0..360, so client colors never
// wander into the county line's teal (~150-205°) or the map's own
// navy/blue chrome (~205-250°).
const CLIENT_HUE_START = 250;
const CLIENT_HUE_ARC = 260;
// Past clients get their own hue sequence (muted — see muteColor) rather
// than reusing the active one at the same index, so a past and an active
// client never accidentally land on the same starting hue.
const PAST_HUE_START = 258;
const PAST_HUE_ARC = 260;
const CLIENT_SAT = 0.72;
const CLIENT_LIGHT = 0.6;

// A big rural district can list 20-30 municipalities (Armstrong SD tops
// out at 30) — show the largest few by land area and fold the rest into
// a "+N more" tail rather than blowing out the readout's height.
const MAX_MUNIS_SHOWN = 6;

// Relationship status vocabulary, shared between the district's map color
// (see clientColors above) and the click card's badge. "contracted" isn't
// used by any row in district-data.csv today, but matchDistrictRecord/
// STATUS_MAP in csv.js already produce it, so it's handled here rather
// than silently falling through to "none" styling if it ever shows up.
const STATUS_LABEL = { active: 'Active client', contracted: 'Under contract', past: 'Past work', none: 'No relationship' };
const STATUS_COLOR = { active: '#3FD469', contracted: '#D8A24A', past: '#7C93AC', none: 'transparent' };

/** Drag beyond this many CSS pixels counts as a pan, not a click — keeps
 * releasing a drag over a district from also popping its card open. */
const DRAG_CLICK_THRESHOLD = 4;

/**
 * Project every district + county ring once, then fit them all into a
 * shared 0..VIEW_WIDTH SVG coordinate space with a small padding margin.
 */
function useProjectedGeometry() {
  return useMemo(() => {
    const items = bakedDistricts.map((f) => ({
      name: f.name,
      county: f.county,
      aun: f.aun,
      // f.rings is a flat array of rings (see geometry.js note) — project
      // them all as one polygon's ring set.
      polys: [projectRings(f.rings)],
    }));

    const allPoints = [];
    items.forEach((it) =>
      it.polys.forEach((rings) => rings.forEach((ring) => allPoints.push(...ring)))
    );

    const xs = allPoints.map((p) => p[0]);
    const ys = allPoints.map((p) => p[1]);
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    // y is already flipped (north = small y, south = large y — see
    // projectRings), so padding y1 more than y0 means the extra room
    // lands south of the state, not split evenly top+bottom. That south
    // margin is what keeps the readout overlay clear of real district
    // shapes: it's baked into the map's own geometry, so it shows up as
    // real, guaranteed empty space no matter how the browser window is
    // sized — unlike sizing the SVG's own box down in CSS, which turned
    // out to depend on which dimension (width vs height) ends up
    // constraining the fit, and silently did nothing in the width-bound
    // case, which is what was reported.
    const padX = (x1 - x0) * 0.03;
    const padTop = (y1 - y0) * 0.03;
    const padBottom = (y1 - y0) * 0.24;
    x0 -= padX;
    x1 += padX;
    y0 -= padTop;
    y1 += padBottom;

    const scale = VIEW_WIDTH / (x1 - x0);
    const height = (y1 - y0) * scale;
    const toSvg = (p) => [(p[0] - x0) * scale, (p[1] - y0) * scale];

    const districts = items.map((it) => ({
      name: it.name,
      county: it.county,
      aun: it.aun,
      d: it.polys
        .flatMap((rings) => rings.map((ring) => ringToPath(ring.map(toSvg))))
        .join(''),
    }));

    // countyOutlines.json is dissolved from each county's own district
    // polygons (a one-time data-prep step, not computed here) so it always
    // traces exactly along the district edges already on screen — same
    // flat-rings shape as districts, projected the same way, for
    // guaranteed alignment instead of two independently-sourced datasets.
    const counties = countyOutlines.map((c) => ({
      name: c.name,
      d: projectRings(c.rings)
        .map((ring) => ringToPath(ring.map(toSvg)))
        .join(''),
    }));

    return {
      districts,
      counties,
      viewWidth: VIEW_WIDTH,
      viewHeight: height,
      viewBox: `0 0 ${VIEW_WIDTH.toFixed(0)} ${height.toFixed(0)}`,
    };
  }, []);
}

export default function DistrictMap() {
  const { districts, counties, viewBox, viewWidth, viewHeight } = useProjectedGeometry();

  const [csvData, setCsvData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [brandLogoOk, setBrandLogoOk] = useState(true);
  const [hoveredKey, setHoveredKey] = useState(null);

  // The click card. selectedKey is the last district clicked and is
  // intentionally NOT cleared back to null on close — the card's own CSS
  // transition fades it out over ~0.22s, and clearing the content
  // immediately would blank the card mid-fade instead of letting it fade
  // out showing what was actually open. cardOpen is what the scrim/card's
  // "on" state actually follows; a fresh click re-points selectedKey and
  // reopens in one go.
  const [selectedKey, setSelectedKey] = useState(null);
  const [cardOpen, setCardOpen] = useState(false);

  function closeCard() {
    setCardOpen(false);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') closeCard();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Scroll-to-zoom + drag-to-pan. This is an SVG translate+scale on a <g>
  // wrapping the map content, inside the same fixed viewBox the map has
  // always used — same vector paths at a bigger size, not a raster image
  // being stretched, so there's no quality loss at any zoom level (see
  // the non-scaling-stroke rule in the CSS for why borders specifically
  // stay crisp too, instead of ballooning into thick blobs at high zoom).
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [transform, setTransform] = useState({ scale: MIN_SCALE, x: 0, y: 0 });
  const isZoomed = transform.scale > MIN_SCALE + 0.001;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    function onWheel(e) {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const vbx = ((e.clientX - rect.left) / rect.width) * viewWidth;
      const vby = ((e.clientY - rect.top) / rect.height) * viewHeight;
      setTransform((t) => zoomAt(t, vbx, vby, e.deltaY, viewWidth, viewHeight));
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [viewWidth, viewHeight]);

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    // Which district (if any) is directly under the pointer, captured NOW
    // — before setPointerCapture below, which retargets every subsequent
    // pointer/mouse/click event for this gesture to the <svg> itself. That
    // retargeting is why district selection can't be a plain onClick on
    // each district anymore (it used to be, and stopped firing once the
    // drag-to-pan pointer-capture code was added — the click event's
    // target became the <svg>, not the district clicked, so the
    // per-district handlers never saw it). Reading it here, pre-capture,
    // is the one point in the gesture where e.target still reflects what
    // was actually clicked.
    const distEl = e.target.closest?.('.dist');
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: transform.x,
      startY: transform.y,
      distName: distEl?.getAttribute('data-district') || null,
    };
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !svgRef.current) return;
    const screenDx = e.clientX - drag.startClientX;
    const screenDy = e.clientY - drag.startClientY;
    if (Math.hypot(screenDx, screenDy) > DRAG_CLICK_THRESHOLD) drag.moved = true;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = (screenDx / rect.width) * viewWidth;
    const dy = (screenDy / rect.height) * viewHeight;
    setTransform((t) => {
      const { x, y } = clampPan(drag.startX + dx, drag.startY + dy, t.scale, viewWidth, viewHeight);
      return { ...t, x, y };
    });
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      // Only a stationary press+release opens a card — a press that moved
      // past the drag threshold was a pan, not a click, so the district it
      // ends up over shouldn't pop open. This is also now the ONLY place
      // district selection happens (see the handlePointerDown comment for
      // why a plain onClick on the district no longer works).
      if (!drag.moved && drag.distName) handleDistrictClick(drag.distName);
    }
    dragRef.current = null;
  }

  function resetView() {
    setTransform({ scale: MIN_SCALE, x: 0, y: 0 });
  }

  useEffect(() => {
    let cancelled = false;
    loadDistrictData(DATA_URL)
      .then((data) => {
        if (!cancelled) setCsvData(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Attach each district's matched CSV record (once loaded) and its
  // municipality list (baked at build time — see
  // scripts/build-district-municipalities.py — so it's available for
  // every district, not only the ones with business data in the CSV).
  const items = useMemo(
    () =>
      districts.map((d) => ({
        ...d,
        rec: matchDistrictRecord(csvData, d.name, d.aun),
        municipalities: districtMunicipalities[d.name] || [],
      })),
    [districts, csvData]
  );

  // Every active client gets its own hue; past clients get their own
  // (different) hue sequence, muted. Sorted by name first so color
  // assignment stays stable across reloads instead of drifting with
  // whatever order the CSV happens to list rows in.
  const clientColors = useMemo(() => {
    const active = items.filter((it) => it.rec?.status === 'active').sort((a, b) => a.name.localeCompare(b.name));
    const past = items.filter((it) => it.rec?.status === 'past').sort((a, b) => a.name.localeCompare(b.name));

    const map = new Map();
    spacedHues(active.length, CLIENT_HUE_START, CLIENT_HUE_ARC).forEach((hue, i) => {
      map.set(active[i].name, hslToHex(hue, CLIENT_SAT, CLIENT_LIGHT));
    });
    spacedHues(past.length, PAST_HUE_START, PAST_HUE_ARC).forEach((hue, i) => {
      map.set(past[i].name, muteColor(hslToHex(hue, CLIENT_SAT, CLIENT_LIGHT)));
    });
    return map;
  }, [items]);

  // Keyed by name, not aun: the baked geometry's "aun" field turns out to
  // be shared by up to 16 districts (a leftover county/IU code from the
  // original extraction, not a real per-district id — confirmed only 74
  // distinct values across 500 districts). District names ARE unique
  // (checked), so that's the reliable key.
  const hovered = hoveredKey != null ? items.find((it) => it.name === hoveredKey) || null : null;
  const selected = selectedKey != null ? items.find((it) => it.name === selectedKey) || null : null;

  function handleDistrictClick(name) {
    setSelectedKey(name);
    setCardOpen(true);
  }

  // Card content derives from `selected`, not `selectedKey` directly, so it
  // naturally shows nothing until items (which need csvData) are ready.
  const cardRec = selected?.rec || null;
  const cardStatus = cardRec?.status || 'none';
  const cardWebsiteHost = cardRec?.website ? cardRec.website.replace(/^https?:\/\//, '') : '';
  // True once there's SOMETHING beyond bare geometry to show for this
  // district — no CSV row at all counts as nothing, same as a CSV row with
  // every optional field blank.
  const cardHasAnyDetail = Boolean(
    cardRec &&
      (cardRec.website ||
        cardRec.projects.length ||
        cardRec.keyStats ||
        cardRec.projectType ||
        cardRec.facilityType ||
        cardRec.sizeSqft ||
        cardRec.enrollment ||
        cardRec.constructionCostValue > 0 ||
        cardRec.teamLead)
  );

  return (
    <div id="frame" className="district-map">
      <div className="strip">
        <div className="strip-t">Pennsylvania · School Districts</div>
        {/* Placeholder brand slot — swap BRAND_LOGO_SRC above for the real
            white logo file when it's ready; the fallback wordmark below
            renders until then. */}
        <div className="brand">
          {brandLogoOk ? (
            <img
              className="brand-logo"
              src={BRAND_LOGO_SRC}
              alt="ICS / CMTA"
              onError={() => setBrandLogoOk(false)}
            />
          ) : (
            <span className="brand-fallback">ICS · CMTA</span>
          )}
        </div>
      </div>

      <div id="stage">
        <svg
          viewBox={viewBox}
          ref={svgRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            <g>
              {items.map((it) => {
                const key = it.name;
                const fill = clientColors.get(it.name);
                return (
                  <g
                    className="dist"
                    key={key}
                    data-district={key}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey((cur) => (cur === key ? null : cur))}
                  >
                    <path d={it.d} className="dist-shape" style={fill ? { fill } : undefined} />
                  </g>
                );
              })}
            </g>
            <g>
              {counties.map((c) => (
                <path key={c.name} d={c.d} className="county-line" />
              ))}
            </g>
            {/* Hovered district's highlight, redrawn in its own group at
                the very end so it paints on top of every other district
                AND the county lines — otherwise a county line crossing
                the hovered district's edge would visually cut through
                the highlight, and a same-hue neighbor could partially
                overlap it too, both just artifacts of normal SVG draw
                order (later = on top), not anything special about
                borders. Non-interactive: hover detection stays on the
                base shapes above, this is purely visual. */}
            {hovered ? (
              <g className="dist-hover-overlay" pointerEvents="none">
                <path d={hovered.d} className="dist-hover-wash" />
                <path d={hovered.d} className="dist-hover-outline" />
              </g>
            ) : null}
          </g>
        </svg>
        {isZoomed ? (
          <button type="button" className="zoom-reset" onClick={resetView}>
            Reset view · {transform.scale.toFixed(1)}x
          </button>
        ) : null}
      </div>

      <div className="readout">
        <div className="ro-l">
          <div className="ro-county">{hovered ? `${hovered.county || ''} County` : 'Hover a district'}</div>
          <div className={`ro-name${hovered ? '' : ' idle'}`}>{hovered ? hovered.name : '—'}</div>
          {hovered?.rec?.website ? (
            <a
              className="ro-site"
              href={`https://${hovered.rec.website.replace(/^https?:\/\//, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {hovered.rec.website.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
        </div>
        <div className="ro-logo">
          {hovered?.rec?.logo ? (
            <img
              key={hovered.rec.logo}
              src={LOGO_DIR + hovered.rec.logo}
              alt={`${hovered.name} logo`}
            />
          ) : null}
        </div>
        <div className="ro-r">
          <div className="ro-lbl">Municipalities{hovered ? ` (${hovered.municipalities.length})` : ''}</div>
          {hovered && hovered.municipalities.length ? (
            <div className="ro-munis">
              {hovered.municipalities.slice(0, MAX_MUNIS_SHOWN).map((m) => (
                <span className="ro-muni" key={`${m.name}-${m.type}`}>
                  {m.name} {m.type}
                </span>
              ))}
              {hovered.municipalities.length > MAX_MUNIS_SHOWN ? (
                <span className="ro-muni ro-muni-more">
                  +{hovered.municipalities.length - MAX_MUNIS_SHOWN} more
                </span>
              ) : null}
            </div>
          ) : (
            <div className="ro-munis idle">{hovered ? 'None matched' : '—'}</div>
          )}
        </div>
      </div>

      {loadError ? (
        <div className="map-data-error">Couldn&apos;t load district-data.csv: {loadError}</div>
      ) : null}

      {/* Click card. Rendered once selectedKey is ever set, and left
          mounted after that (see the state comment above) so closing it
          fades out instead of vanishing instantly. */}
      {selectedKey ? (
        <>
          <div className={`scrim${cardOpen ? ' on' : ''}`} onClick={closeCard} />
          <div
            className={`card${cardOpen ? ' on' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={selected ? `${selected.name} details` : undefined}
          >
            {selected ? (
              <>
                <div className="card-h">
                  <button type="button" className="card-x" aria-label="Close" onClick={closeCard}>
                    ×
                  </button>
                  <div className="card-logo">
                    {cardRec?.logo ? (
                      <img src={LOGO_DIR + cardRec.logo} alt={`${selected.name} logo`} />
                    ) : (
                      <span>{districtInitials(selected.name) || '—'}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="card-county">{selected.county || ''} County</div>
                    <div className="card-name">{selected.name}</div>
                    <div className="card-badges">
                      <span className="badge">
                        <span
                          className="d"
                          style={{
                            background: STATUS_COLOR[cardStatus],
                            border: cardStatus === 'none' ? '1px solid currentColor' : undefined,
                          }}
                        />
                        {STATUS_LABEL[cardStatus]}
                      </span>
                      {cardRec?.company ? <span className="badge">{cardRec.company}</span> : null}
                      {cardRec?.marketSector ? <span className="badge">{cardRec.marketSector}</span> : null}
                    </div>
                  </div>
                </div>

                {cardRec && (cardRec.projectCount > 0 || cardRec.constructionCostValue > 0) ? (
                  <div className="card-stats">
                    <div className="card-stat">
                      {/* CONSTRUCTION_COST (a single hand-entered total) is the
                          more authoritative number when present; fall back to
                          summing the individual project VALUE_n's otherwise.
                          projectCount is a real, uncapped count now — see
                          extractProjects in csv.js — so no more "3+". */}
                      <b>
                        {cardRec.constructionCostValue > 0
                          ? formatMoney(cardRec.constructionCostValue)
                          : formatMoney(cardRec.totalValue)}
                      </b>
                      <span>Contract Value</span>
                    </div>
                    <div className="card-stat">
                      <b>{cardRec.projectCount}</b>
                      <span>Projects</span>
                    </div>
                  </div>
                ) : null}

                {cardRec?.website ? (
                  <div className="card-sec">
                    <div className="card-l">Website</div>
                    <a
                      className="card-a"
                      href={`https://${cardWebsiteHost}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {cardWebsiteHost}
                    </a>
                  </div>
                ) : null}

                {selected.aun ? (
                  <div className="card-sec">
                    <div className="card-l">AUN</div>
                    <div className="card-p">{selected.aun}</div>
                  </div>
                ) : null}

                {cardRec && cardRec.projects.length ? (
                  <div className="card-sec">
                    <div className="card-l">Project History</div>
                    {cardRec.projects.map((p, i) => (
                      <div className="job" key={`${p.name}-${i}`}>
                        <div className="job-n">{p.name}</div>
                        <div className="job-m">
                          {[p.year, p.valueDisplay].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {cardRec?.projectType || cardRec?.facilityType ? (
                  <div className="card-sec">
                    <div className="card-l">Scope</div>
                    {cardRec.projectType ? <div className="card-p">{cardRec.projectType}</div> : null}
                    {cardRec.facilityType ? (
                      <div className="card-p">
                        <b>Facility:</b> {cardRec.facilityType}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {cardRec?.sizeSqft || cardRec?.enrollment ? (
                  <div className="card-sec">
                    <div className="card-l">Size</div>
                    {cardRec.sizeSqft ? <div className="card-p">{cardRec.sizeSqft}</div> : null}
                    {cardRec.enrollment ? (
                      <div className="card-p">
                        <b>Enrollment:</b> {cardRec.enrollment}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {cardRec?.keyStats ? (
                  <div className="card-sec">
                    <div className="card-l">Notes</div>
                    <div className="card-p">{cardRec.keyStats}</div>
                  </div>
                ) : null}

                {cardRec?.teamLead ? (
                  <div className="card-sec">
                    <div className="card-l">ICS/CMTA Lead</div>
                    <div className="card-p">{cardRec.teamLead}</div>
                  </div>
                ) : null}

                <div className="card-sec">
                  <div className="card-l">Municipalities{selected.municipalities.length ? ` (${selected.municipalities.length})` : ''}</div>
                  {selected.municipalities.length ? (
                    <div className="card-munis">
                      {selected.municipalities.map((m) => (
                        <span className="card-muni" key={`${m.name}-${m.type}`}>
                          {m.name} {m.type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">None matched</div>
                  )}
                </div>

                {!cardHasAnyDetail ? (
                  <div className="card-sec">
                    <div className="muted">No ICS/CMTA project history on file for this district yet.</div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
