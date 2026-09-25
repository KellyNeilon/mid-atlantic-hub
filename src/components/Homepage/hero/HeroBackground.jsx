import { useEffect, useState } from 'react';
import { STOPS, THEME_T, nearestStop, srcSet } from './daylight';

/**
 * The 17 frames of the sun transition, stacked bottom (frame 00, light) to
 * top (frame 16, dark). Nothing here moves, scales or zooms — only opacity
 * changes, and each opacity is a pure calc() of --day-t, so the browser
 * composites the whole thing on the GPU without touching layout or paint.
 *
 * Loading strategy. 17 plates is ~2.5 MB at the 1717 AVIF tier, which has no
 * business being on the critical path of a page whose job is to render one
 * photograph and a search bar. So exactly one plate is fetched up front — the
 * one the current theme rests on — and the other 16 are attached on the first
 * idle callback after mount.
 *
 * That is only safe because of how the stack is built (see daylight.js): each
 * frame dissolves in *over* the one below it rather than the two of them
 * sharing a tent, so a frame that has not arrived yet leaves the previous one
 * showing instead of punching a transparent hole through to the background.
 * Toggle the theme in the first second and you get a coarser sunset, not a
 * black flash. One re-render, on idle. Nothing runs per frame.
 */
export default function HeroBackground({ initialTheme }) {
  const restingT = THEME_T[initialTheme] ?? THEME_T.dark;
  const resting = nearestStop(restingT).file;
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (full) return undefined;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => setFull(true), { timeout: 2500 });
    return () => cancel(id);
  }, [full]);

  return (
    <div className="mh-plates" data-full={full ? '1' : '0'} aria-hidden="true">
      {STOPS.map((s) => {
        const now = full || s.file === resting;
        // Frame 00 is the base of the stack and 16 is the far end; those two
        // are the only ones the fallback path (no @property) ever shows.
        const endpoint = s.i === 0 || s.i === STOPS.length - 1;
        return (
          <picture key={s.i}>
            {now && <source type="image/avif" srcSet={srcSet(s.file, 'avif')} sizes="100vw" />}
            {now && <source type="image/webp" srcSet={srcSet(s.file, 'webp')} sizes="100vw" />}
            <img
              className="mh-plate"
              data-stop={s.i}
              data-endpoint={endpoint ? '1' : undefined}
              style={{ opacity: `var(--o-${s.i})` }}
              src={now ? `/assets/hero/${s.file}-1280.webp` : undefined}
              alt=""
              decoding="async"
              loading="eager"
              fetchPriority={s.file === resting ? 'high' : 'low'}
              draggable="false"
            />
          </picture>
        );
      })}
    </div>
  );
}
