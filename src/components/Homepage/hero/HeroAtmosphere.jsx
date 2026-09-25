/**
 * Depth gradient, top and bottom.
 *
 * This layer used to also carry a colour wash blended from each plate's
 * characteristic tint. That existed because the old set was five separately
 * graded stills and the wash helped disguise the seam between them. The
 * sequence grades itself — every frame is the real colour of that moment —
 * so tinting on top of it now only means fighting the photograph. Removed.
 *
 * What is left is structural, not decorative: it darkens the top and bottom
 * edges so the ticker and the pinned bottom bar have something to sit on. Its
 * strength still tracks --scene-bright, so it eases off as the sun goes down
 * and the photograph stops needing help.
 */
export default function HeroAtmosphere() {
  return (
    <div className="mh-atmos" aria-hidden="true">
      <div className="mh-atmos-density" />
    </div>
  );
}
