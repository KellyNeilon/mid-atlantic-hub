import { useEffect, useRef } from 'react';
import { clockT, SMOOTH } from './daylight';
import HeroBackground from './HeroBackground';
import HeroAtmosphere from './HeroAtmosphere';
import HeroOverlay from './HeroOverlay';
import './hero.css';

/**
 * ThemeScene — the hero's daylight background.
 *
 * Everything is driven by one animated number, `--day-t` (0 = frame 00, light;
 * 1 = frame 16, dark). Because every frame's opacity is a continuous function
 * of that number, moving it from 0 to 1 *travels* through the whole sequence
 * on the way — a real sunset, not a cut between two stills. The sequence falls
 * out of the arithmetic; nothing is scripted frame by frame.
 *
 * There is no animation loop and no animation library. `--day-t` is a
 * registered custom property, so the browser interpolates it in the style
 * engine; each frame that costs one calc() recompute per plate (17 nodes, one
 * property each) and the resulting opacity change composites on the GPU. No
 * JavaScript runs per frame.
 *
 * WHERE THE NUMBERS LIVE. This component no longer sets `--day-t` itself. The
 * page shell does, via `sceneStyle(theme)` from daylight.js, because custom
 * properties inherit down the DOM and not across it — the scene is a sibling
 * of the hero copy, the cards and the map, so anything set here would be
 * invisible to all of them. Publishing from the shell is what lets the map
 * panel's glass tint track the daylight with no wiring, and it is the fix for
 * design-lock O8. This component just renders the layers and reads what it
 * inherits.
 *
 * The CSS sun layer that used to live here has been retired. It existed
 * because the five old plates each had their sun baked in a different place,
 * so something had to carry the light across the gap. This sequence has a real
 * sun that genuinely travels — its brightest point moves from 8% to 80% across
 * the frame between 00 and 16 — and a CSS bloom on top of that reads as a
 * second sun. The photographs do the job now.
 *
 * Props
 *   theme     'light' | 'dark'   which end of the sequence to rest on
 *   clock     boolean   ignore theme, follow the real local time instead
 *   parallax  boolean   slow pointer drift on the plate stack
 *   children  content rendered above the scene
 */
export default function ThemeScene({
  theme = 'dark',
  clock = false,
  parallax = true,
  children,
}) {
  const ref = useRef(null);

  // Clock mode re-checks every 10 minutes and writes to the shell, for the
  // same inheritance reason as everything else. Nothing runs when it is off.
  useEffect(() => {
    if (!clock) return undefined;
    const host = ref.current?.closest('.mh-daylight') || ref.current?.parentElement;
    if (!host) return undefined;
    const apply = () => {
      const now = String(clockT());
      for (const k of ['--day-t', '--atmos-t', '--text-t']) {
        host.style.setProperty(k, now);
      }
    };
    apply();
    const id = setInterval(apply, 600000);
    return () => clearInterval(id);
  }, [clock]);

  // Pointer drift. Writes two custom properties on pointermove and lets CSS do
  // the transform — no React state, so this never triggers a re-render.
  // Disabled for coarse pointers and for anyone who asked for reduced motion.
  useEffect(() => {
    if (!parallax) return undefined;
    const fine = window.matchMedia('(pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return undefined;

    let frame = 0;
    const onMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = ref.current;
        if (!el) return;
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty('--px', `${(-x * 14).toFixed(2)}px`);
        el.style.setProperty('--py', `${(-y * 10).toFixed(2)}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [parallax]);

  return (
    <div
      ref={ref}
      className="mh-scene"
      data-smooth={SMOOTH ? '1' : '0'}
      data-parallax={parallax ? '1' : '0'}
    >
      <HeroBackground initialTheme={theme} />
      <HeroAtmosphere />
      <HeroOverlay />
      {children}
    </div>
  );
}
