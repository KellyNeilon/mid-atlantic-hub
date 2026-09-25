import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NAV_MENU } from '../../data/nav-menu';
import { INFO_CARDS, cardArt, cardFallback } from '../../data/info-cards';
import { TICKER_ITEMS, loadTicker } from '../../data/ticker-items';
import ThemeScene from './hero/ThemeScene';
import { sceneStyle } from './hero/daylight';
import MapPanel from '../MapPanel/MapPanel';
import PaOutline from '../MapPanel/PaOutline';
import './Homepage.css';

// Marketing Hub homepage — structural pass toward the locked design in
// claude/homepage-design-lock.md (round 7b).
//   1. DONE 2026-09-02 — the Pennsylvania background is now real: the
//      17-frame sun transition (see hero/ThemeScene.jsx). The map panel is
//      still a plain glass tint pending the reactbits-style SVG filter —
//      see design-lock's "Map" section.
//   2. DONE 2026-09-03 — real theme-swapped SVG logo lockups
//      (ics-cmta_logo.svg colored / ics-cmta_logo_wht.svg white), replacing
//      the old logo-white-full.png standing in on both themes. That PNG no
//      longer exists in the repo (Kelly replaced it with these SVGs) — the
//      stale reference was a broken image in production until this fix.
const THEME_KEY = 'mh-theme';

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export default function Homepage() {
  const [theme, setTheme] = useState(readStoredTheme);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable (private browsing, locked-down profile) — theme
      // still works for this page load, it just won't be remembered.
    }
  }, [theme]);

  return (
    <div className="hub2-shell mh-daylight" style={sceneStyle(theme)}>
      {/* The 17-frame sun transition. `theme` moves it through the sequence:
          light rests on frame 00, dark on frame 16, and switching between
          them dissolves through every frame in between rather than cutting.
          Pass clock instead of theme to follow the real local time. */}
      <ThemeScene theme={theme} />

      <Ticker />

      <div className="hub2-main">
        <div className="hub2-left">
          <div className="hub2-hero">
            <img
              className="hub2-logo"
              src={
                theme === 'light'
                  ? '/assets/brand/ics-cmta_logo.svg'
                  : '/assets/brand/ics-cmta_logo_wht.svg'
              }
              alt="ICS / CMTA"
            />
            <h1 className="hub2-title">
              Welcome to the
              <br />
              <span>MID-ATLANTIC</span>
            </h1>
            <form
              className="hub2-search"
              onSubmit={(e) => {
                e.preventDefault();
                // Agent isn't built yet (design-lock item O5, blocked on
                // Entra for shipping, not for building) — this is wired
                // for real input today and will get a real answer surface
                // in that pass. For now it's honest about doing nothing.
              }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask the Marketing Hub anything…"
                aria-label="Ask the Marketing Hub"
              />
              <button type="submit" aria-label="Ask">
                →
              </button>
            </form>
            <p className="hub2-prompt-line">
              Try “what’s our biggest K-12 project this year?”
            </p>
          </div>

          <InfoSlider cards={INFO_CARDS} />
        </div>

        <div className="hub2-right">
          <MapPanel
            title="Pennsylvania · School Districts"
            brand="ICS/CMTA"
            address="1400 N Providence Rd"
            stat="124 districts"
          >
            {/* Placeholder geometry. Swap in the real <DistrictMap /> — MapPanel
                takes the map as children and knows nothing about it, so nothing
                else on this page changes when that lands. */}
            <PaOutline />
          </MapPanel>
        </div>
      </div>

      <BottomBar theme={theme} onToggleTheme={setTheme} />
    </div>
  );
}

function Ticker() {
  // Starts on the baked items so the bar is never empty on first paint, then
  // swaps to the live feed when it arrives. One fetch, one re-render — the
  // marquee itself is a CSS animation and is not touched by this.
  const [items, setItems] = useState(TICKER_ITEMS);

  useEffect(() => {
    const ctrl = new AbortController();
    loadTicker(ctrl.signal).then((next) => {
      if (!ctrl.signal.aborted) setItems(next);
    });
    return () => ctrl.abort();
  }, []);

  // Doubled so the marquee can loop seamlessly.
  return (
    <div className="hub2-ticker" aria-label="Announcements">
      <div className="hub2-ticker-track">
        {[...items, ...items].map((item, i) => (
          <TickerItem key={`${item.label}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TickerItem({ item }) {
  if (!item.href) {
    return (
      <span className="hub2-ticker-item hub2-ticker-item-static" data-kind={item.kind}>
        {item.label}
      </span>
    );
  }
  return (
    <a
      className="hub2-ticker-item"
      data-kind={item.kind}
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {item.label}
    </a>
  );
}

// The row never stops on its own. One rAF loop moves it right-to-left at a
// slow, constant drift; hovering or dragging ANY card pauses that loop in
// place (not a restart point — just a flag the loop checks each frame), and
// it picks up again from exactly that offset the instant nothing is being
// touched. The list is rendered twice back to back so the loop can wrap by
// subtracting one set's width the instant it's crossed — the second half is
// identical to the first, so the wrap is invisible.
const SLIDER_SPEED = 16;  // px/s — slow and ambient, not a marquee
const CARD_GAP = 16;      // keep in step with --mh-card-gap in Homepage.css
const SNAP_MS = 460;      // keep in step with [data-returning] in Homepage.css

function InfoSlider({ cards }) {
  const sliderRef = useRef(null);
  const trackRef = useRef(null);
  const offsetRef = useRef(0);
  const setWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const hoverCountRef = useRef(0);
  const dragCountRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const restoreRef = useRef(null);
  const flipRef = useRef(null);

  // Which card sits in which slot. A drop rewrites this, which is what makes
  // the row reshuffle — the dragged card takes the slot it was released
  // nearest and everything between shifts along to make room, rather than
  // the card springing back to where it was picked up from.
  const [order, setOrder] = useState(() => cards.map((_, i) => i));

  // One set's real rendered width (cards + gaps), measured rather than
  // hard-coded so it stays correct if the card size or gap ever changes.
  useEffect(() => {
    function measure() {
      const el = trackRef.current;
      if (!el || el.children.length < cards.length) return;
      let w = 0;
      for (let i = 0; i < cards.length; i++) {
        w += el.children[i].getBoundingClientRect().width + CARD_GAP;
      }
      setWidthRef.current = w;
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [cards.length]);

  useEffect(() => {
    function tick(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      if (!pausedRef.current && trackRef.current) {
        offsetRef.current += (SLIDER_SPEED * dt) / 1000;
        const setWidth = setWidthRef.current;
        if (setWidth > 0 && offsetRef.current >= setWidth) {
          offsetRef.current -= setWidth;
        }
        trackRef.current.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => () => clearTimeout(restoreRef.current), []);

  // The reshuffle, animated FLIP-style: handleDrop records where every slot
  // is BEFORE React reorders them, and this runs straight after the reorder,
  // when they have already jumped to their new places. Putting each one back
  // where it came from with a transition-less transform and then releasing
  // it in the same frame turns the jump into a travel. The dragged card's
  // own spring (--drag-x back to 0) runs at the same time and over the same
  // duration, so the two compose into one movement: it leaves the pointer
  // and lands in whichever slot the row just opened up for it.
  useLayoutEffect(() => {
    const before = flipRef.current;
    flipRef.current = null;
    const track = trackRef.current;
    if (!before || !track) return;

    const moves = [];
    for (const slot of track.children) {
      const was = before.get(slot);
      if (was == null) continue;
      const delta = was - slot.getBoundingClientRect().left;
      if (delta) moves.push([slot, delta]);
    }
    if (!moves.length) return;

    for (const [slot, delta] of moves) {
      slot.style.transition = 'none';
      slot.style.transform = `translate3d(${delta}px,0,0)`;
    }
    void track.offsetWidth;  // one forced reflow, then they all travel home
    for (const [slot] of moves) {
      slot.style.transition = `transform ${SNAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      slot.style.transform = '';
    }
  }, [order]);

  // Counters, not a single flag: with 16 cards front to back, the pointer
  // can leave one and enter the next inside the same frame, and a plain
  // boolean would flicker the drift back on for that instant.
  function setPaused(kind, active) {
    const ref = kind === 'hover' ? hoverCountRef : dragCountRef;
    ref.current = Math.max(0, ref.current + (active ? 1 : -1));
    pausedRef.current = hoverCountRef.current > 0 || dragCountRef.current > 0;
  }

  function handleDragStart() {
    setPaused('drag', true);
    clearTimeout(restoreRef.current);
    const slider = sliderRef.current;
    const track = trackRef.current;
    if (!slider || !track) return;
    // Hide the slots that are entirely outside the visible window before
    // lifting the clip, so the rest of the doubled list doesn't appear
    // across the map column for as long as the drag lasts. visibility,
    // not display — the row must not reflow underneath the drag.
    const box = slider.getBoundingClientRect();
    for (const slot of track.children) {
      const r = slot.getBoundingClientRect();
      slot.dataset.off = r.right < box.left || r.left > box.right ? '1' : '0';
    }
    slider.dataset.dragging = '1';
  }

  function handleDragEnd() {
    setPaused('drag', false);
    // Hold the lifted clip until the card has finished travelling to its
    // slot; restoring overflow any earlier would cut it off mid-flight.
    clearTimeout(restoreRef.current);
    restoreRef.current = setTimeout(() => {
      const slider = sliderRef.current;
      const track = trackRef.current;
      if (slider) delete slider.dataset.dragging;
      if (track) for (const slot of track.children) delete slot.dataset.off;
    }, SNAP_MS + 60);
  }

  // Released after a real drag: work out which slot the card is nearest now
  // and move it there. Everything between shuffles along by one.
  function handleDrop(slotIndex, dx) {
    const track = trackRef.current;
    if (!track || !track.firstChild) return;
    const pitch = track.firstChild.getBoundingClientRect().width + CARD_GAP;
    if (!pitch) return;
    const shift = Math.round(dx / pitch);
    if (!shift) return;
    const to = Math.min(order.length - 1, Math.max(0, slotIndex + shift));
    if (to === slotIndex) return;

    flipRef.current = new Map();
    for (const slot of track.children) {
      flipRef.current.set(slot, slot.getBoundingClientRect().left);
    }
    setOrder((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(slotIndex, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // Manual wheel control writes offsetRef directly, independent of the
  // paused flag — the drift just continues from wherever the wheel leaves
  // it rather than fighting it.
  function handleWheel(e) {
    e.preventDefault();
    const setWidth = setWidthRef.current;
    let next = offsetRef.current + e.deltaY + e.deltaX;
    if (setWidth > 0) next = ((next % setWidth) + setWidth) % setWidth;
    offsetRef.current = next;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${-next}px,0,0)`;
    }
  }

  return (
    <div className="hub2-slider" ref={sliderRef} onWheel={handleWheel}>
      <div className="hub2-slider-track" ref={trackRef}>
        {[...order, ...order].map((cardIndex, i) => {
          const card = cards[cardIndex];
          const copy = i < order.length ? 0 : 1;
          // Keyed by card, not by position, so React MOVES these nodes on a
          // reshuffle instead of rebuilding them — which is the whole reason
          // the FLIP above has stable elements to measure.
          return (
            <div className="hub2-card-slot" key={`${card.id}-${copy}`}>
              <InfoCard
                card={card}
                index={cardIndex}
                slotIndex={i % order.length}
                onHoverChange={(v) => setPaused('hover', v)}
                onDragChange={(v) => (v ? handleDragStart() : handleDragEnd())}
                onDrop={handleDrop}
              />
            </div>
          );
        })}
      </div>
      <div className="hub2-slider-feather hub2-slider-feather-left" aria-hidden="true" />
      <div className="hub2-slider-feather hub2-slider-feather-right" aria-hidden="true" />
    </div>
  );
}

function InfoCard({ card, index, slotIndex, onHoverChange, onDragChange, onDrop }) {
  // Art is whatever sits in public/assets/cards/<id>.svg. No import, no build
  // step — commit a file and it appears. If it is not there yet the generated
  // gradient stands in, so an empty folder looks deliberate rather than broken.
  //
  // The current placeholder set (public/assets/cards/*.png) are full card
  // comps — gradient + title + subhead + button already drawn into the
  // image — not the textless background the design lock specs. Rendering
  // our own <h3>/<p>/CTA on top of that doubled every line of text. Until
  // that's resolved one way or the other (crop the art down to background
  // only, or keep it as final art and drop the DOM copy for good), the DOM
  // copy only renders in the fallback-gradient case, matching what the art
  // itself already shows. Card keeps an accessible name via aria-label
  // either way, since the art's <img alt=""> is decorative.
  const [artOk, setArtOk] = useState(true);
  const elRef = useRef(null);
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, dx: 0, pointerId: null });

  // Shared by hover (spotlight/glow) and drag (translate). Writes custom
  // properties straight to the DOM node rather than React state — same
  // pattern as the hero's pointer-parallax and the map panel's tilt, and for
  // the same reason: this runs on every pointermove and must never trigger
  // a re-render.
  function updatePointerVars(e) {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    el.style.setProperty('--mx', `${mx}px`);
    el.style.setProperty('--my', `${my}px`);
    const nx = r.width ? mx / r.width : 0.5;
    const ny = r.height ? my / r.height : 0.5;
    const angle = (Math.atan2(ny - 0.5, nx - 0.5) * 180) / Math.PI;
    // 0 at the card's center, 1 at any edge or corner — how close the
    // cursor is to leaving, which is what makes the border glow track it.
    const proximity = Math.min(1, Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5)) * 2);
    el.style.setProperty('--glow-angle', `${angle}deg`);
    el.style.setProperty('--glow-p', proximity.toFixed(3));
  }

  function onEnter(e) {
    onHoverChange?.(true);
    updatePointerVars(e);
  }
  function onLeave() {
    onHoverChange?.(false);
  }
  function onMove(e) {
    updatePointerVars(e);
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.dx = dx;
    if (!dragRef.current.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragRef.current.moved = true;
    }
    const el = elRef.current;
    if (el) {
      el.style.setProperty('--drag-x', `${dx}px`);
      el.style.setProperty('--drag-y', `${dy}px`);
    }
  }
  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const el = elRef.current;
    if (!el) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Capture is an optimisation, not a requirement — it keeps the drag
      // alive if the pointer outruns the card. If the browser refuses it
      // (no live pointer with this id), the drag still works off the
      // element's own move/up events, so don't let it kill the handler.
    }
    dragRef.current = {
      dragging: true, moved: false, dx: 0,
      startX: e.clientX, startY: e.clientY, pointerId: e.pointerId,
    };
    el.dataset.dragging = '1';
    onDragChange?.(true);
  }
  function onUp() {
    const el = elRef.current;
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    const { dx, moved, pointerId } = dragRef.current;
    if (el) {
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        // already released — pointercancel can beat us here
      }
      el.dataset.dragging = '0';
      el.dataset.returning = '1';
      el.style.setProperty('--drag-x', '0px');
      el.style.setProperty('--drag-y', '0px');
      // Snap-back finishes in SNAP_MS (see .hub2-card[data-returning] in
      // Homepage.css) — drop back to the fast hover transition after that
      // so a quick re-hover right after release doesn't inherit the slow
      // spring easing.
      window.setTimeout(() => {
        if (elRef.current === el) delete el.dataset.returning;
      }, SNAP_MS);
    }
    // Reshuffle first, so the slot has already started moving when the
    // card's own spring begins — the two animate as one movement.
    if (moved) onDrop?.(slotIndex, dx);
    onDragChange?.(false);
  }
  function onClickCapture(e) {
    // A real drag, not a click — the card already snapped back on
    // pointerup; don't also fire the link underneath it.
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.moved = false;
    }
  }

  const body = (
    <>
      <div
        className="hub2-card-art"
        style={artOk ? undefined : { backgroundImage: cardFallback(index) }}
        aria-hidden="true"
      >
        {/* No loading="lazy" here: measured in production, it left every
            card image permanently unrequested (0 network requests fired,
            confirmed via devtools), even though all eight sit in the
            initial viewport. Chrome's lazy-load distance heuristic seems
            to misjudge elements positioned absolutely inside a
            horizontally-scrolling track. These are 8 small PNGs (~1MB
            total) that are always visible on load, so eager is both
            correct and cheap here. */}
        {artOk ? (
          <img src={cardArt(card)} alt="" draggable="false" onError={() => setArtOk(false)} />
        ) : null}
      </div>
      {!artOk && (
        <div className="hub2-card-copy">
          <h3>{card.title}</h3>
          <p>{card.subhead}</p>
          <span className="hub2-card-cta">
            {card.cta}
            <svg width="13" height="8" viewBox="0 0 13 8" fill="none" aria-hidden="true">
              <path
                d="M1 4h10M8 1l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      )}
      {/* Spotlight + border-glow — a mouse-tracked highlight and an
          edge-proximity glow ring, in the spirit of reactbits' Spotlight
          Card / Border Glow but hand-rolled: no dependency, just the two
          custom properties updatePointerVars already writes above.
          z-indexed above the art/copy but painted with mix-blend/mask so
          neither one actually obscures the text. */}
      <span className="hub2-card-spotlight" aria-hidden="true" />
      <span className="hub2-card-glow" aria-hidden="true" />
    </>
  );
  const dragHandlers = {
    onPointerEnter: onEnter,
    onPointerLeave: onLeave,
    onPointerMove: onMove,
    onPointerDown: onDown,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onDragStart: (e) => e.preventDefault(),
    onClickCapture,
  };
  if (!card.href) {
    return (
      <div
        ref={elRef}
        className="hub2-card hub2-card-soon"
        title="Not linked yet"
        aria-label={card.title}
        {...dragHandlers}
      >
        {body}
      </div>
    );
  }
  return (
    <a
      ref={elRef}
      className="hub2-card"
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={card.title}
      {...dragHandlers}
    >
      {body}
    </a>
  );
}

function BottomBar({ theme, onToggleTheme }) {
  return (
    <nav className="hub2-navbar" aria-label="Marketing Hub">
      {NAV_MENU.map((item, i) => (
        <NavItem key={item.id} item={item} first={i === 0} />
      ))}
      <span className="hub2-navbar-pipe" aria-hidden="true" />
      <div className="hub2-theme-toggle" role="group" aria-label="Theme">
        <button
          type="button"
          aria-pressed={theme === 'dark'}
          aria-label="Dark theme"
          className={theme === 'dark' ? 'is-active' : ''}
          onClick={() => onToggleTheme('dark')}
        >
          ☾
        </button>
        <button
          type="button"
          aria-pressed={theme === 'light'}
          aria-label="Light theme"
          className={theme === 'light' ? 'is-active' : ''}
          onClick={() => onToggleTheme('light')}
        >
          ☀
        </button>
      </div>
    </nav>
  );
}

function NavItem({ item, first }) {
  if (item.id === 'home') {
    return (
      <span className="hub2-navitem hub2-navitem-current" aria-current="page">
        {item.label}
      </span>
    );
  }
  if (item.soon || !item.href) {
    return (
      <span className="hub2-navitem hub2-navitem-soon" title="Not linked yet">
        {item.label}
      </span>
    );
  }
  return (
    <a className="hub2-navitem" href={item.href} style={first ? { marginLeft: 0 } : undefined}>
      {item.label}
    </a>
  );
}
