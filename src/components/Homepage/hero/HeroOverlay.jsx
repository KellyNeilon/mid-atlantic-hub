// The two legibility scrims and the cool bloom.
//
// The scrim is the part that makes this feel finished rather than pretty: its
// strength is driven by --scene-bright, a live weighted average of the
// *measured* luminance of whichever two frames are currently on screen. So as
// the scene dissolves toward the bright late-morning frames the scrim deepens
// exactly enough to hold the white hero type, and as it falls into the sunset
// the scrim gets out of the way. Nobody hand-tunes a value per theme, and
// re-rendering the sequence updates it automatically via daylight.js.
//
// There are two of them because the hero type flips colour with the theme:
// white on dark needs a dark wash, the locked navy on light needs a white one.
// Each is scaled by --day-t so it is at full strength at its own end of the
// sequence and completely gone at the other. Both are left-anchored, so by the
// time they reach the map panel they are effectively zero and the glass sits
// over an untouched photograph.
export default function HeroOverlay() {
  return (
    <div className="mh-overlay" aria-hidden="true">
      <div className="mh-scrim-left" />
      <div className="mh-veil" />
      <div className="mh-scrim-top" />
      <div className="mh-scrim-bottom" />
      <div className="mh-glow" />
    </div>
  );
}
