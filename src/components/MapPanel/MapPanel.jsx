import { useEffect, useRef } from 'react';
import GlassDefs from './GlassDefs';
import './MapPanel.css';

/**
 * MapPanel — the liquid-glass frame the Project Map lives in.
 *
 * Deliberately independent of the homepage. It knows nothing about the hero,
 * the theme, or what map is inside it: it renders a solid header row, a glass
 * body, a solid footer row, and puts `children` in the body. Drop it on any
 * page, give it any map, and it behaves the same.
 *
 * How the glass actually works
 * ---------------------------
 * The body carries `backdrop-filter: url(#mh-lens)` — an feTurbulence feeding
 * an feDisplacementMap, then a blur. That genuinely *bends* whatever is painted
 * behind the panel before frosting it; it is not a tint pretending to be glass.
 * Verified in Chromium 141 against a hard-edged control pattern before this was
 * designed around: the backdrop measurably warps, so it holds in Edge and
 * Chrome, which is what the intranet runs.
 *
 * Three consequences worth knowing:
 *   1. The panel must sit over something worth refracting. On the hub that is
 *      the daylight hero, so the scene's theme change reads straight through
 *      the panel with no wiring — the glass is showing the real thing, not a
 *      copy of it.
 *   2. `children` render in FRONT of the lens, so the map's outline, grid and
 *      markers stay perfectly crisp while everything behind them ripples.
 *   3. Displacement pulls from outside the element at the edges, which can
 *      show as a 1–2px artefact. The chromatic fringe covers exactly that,
 *      which is why it is a hairline inset shadow and not decoration.
 *
 * Props
 *   title     left-hand header text
 *   brand     right-hand header text
 *   address   left-hand footer text
 *   stat      middle footer text (counts, status)
 *   onZoom    (delta) => void — footer − / + ; omit to hide the controls
 *   onReset   () => void — the ⊹ button; omit to hide it
 *   tilt      false to sit flat (mobile, reduced motion, or embedding)
 *   children  the map itself
 */
export default function MapPanel({
  title = 'Pennsylvania · School Districts',
  brand = 'ICS/CMTA',
  address = '1400 N Providence Rd',
  stat,
  onZoom,
  onReset,
  tilt = true,
  children,
}) {
  const frameRef = useRef(null);

  // Pointer tilt. Writes two custom properties and lets CSS do the transform,
  // so this never triggers a React render. Off for coarse pointers, for anyone
  // who asked for reduced motion, and whenever `tilt` is false.
  useEffect(() => {
    if (!tilt) return undefined;
    const fine = window.matchMedia('(pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return undefined;

    const el = frameRef.current;
    if (!el) return undefined;
    const host = el.closest('.mh-map') || el;

    let frame = 0;
    const move = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = host.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    };
    const rest = () => {
      el.style.setProperty('--mx', '0');
      el.style.setProperty('--my', '0');
    };

    // Listen on the window, not the panel: the design calls for the glass to
    // lean toward the cursor as it crosses the hero, before it arrives.
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerleave', rest);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', rest);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tilt]);

  return (
    <section className="mh-map" data-tilt={tilt ? '1' : '0'} aria-label="Project map">
      <GlassDefs />
      <div className="mh-map-frame" ref={frameRef}>
        <header className="mh-map-head">
          <span>{title}</span>
          <b>{brand}</b>
        </header>

        <div className="mh-map-stage">
          <div className="mh-map-lens" aria-hidden="true" />
          <div className="mh-map-tint" aria-hidden="true" />
          <div className="mh-map-content">{children}</div>
          <div className="mh-map-sheen" aria-hidden="true" />
          <div className="mh-map-hem" aria-hidden="true" />
        </div>

        <footer className="mh-map-foot">
          <span>{address}</span>
          {stat ? <span>{stat}</span> : null}
          {onZoom ? (
            <span className="mh-map-zoom">
              <button type="button" onClick={() => onZoom(-1)} aria-label="Zoom out">&minus;</button>
              {onReset ? (
                <button type="button" onClick={onReset} aria-label="Reset view">&#8862;</button>
              ) : null}
              <button type="button" onClick={() => onZoom(1)} aria-label="Zoom in">+</button>
            </span>
          ) : null}
        </footer>

        <div className="mh-map-fringe" aria-hidden="true" />
      </div>
    </section>
  );
}
