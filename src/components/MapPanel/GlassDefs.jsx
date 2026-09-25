// The lens filter, mounted once no matter how many panels are on the page.
//
// baseFrequency sets the size of the ripples and `scale` how far the backdrop
// is pushed. The blur on the noise is what turns a grainy, sandpapery
// displacement into something that reads as liquid; without it the panel looks
// like frosted plastic. The blur after the displacement is the frost itself.
//
// Tuned values, from the design bench:
//   baseFrequency 0.009 0.015   large, lazy ripples rather than fine noise
//   scale         14            enough to bend the skyline, not a funhouse
//   frost         3.52          obscures detail, still clearly the same scene
//                               (was 3.2; +10% on 2026-09-04, Kelly's call)
let mounted = 0;

export default function GlassDefs() {
  // Cheap guard so a second panel does not emit a duplicate #mh-lens.
  if (typeof document !== 'undefined' && document.getElementById('mh-glass-defs')) {
    mounted += 1;
    if (mounted > 1) return null;
  }
  return (
    <svg id="mh-glass-defs" className="mh-glass-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="mh-lens" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.009 0.015" numOctaves="2" seed="11" result="n" />
        <feGaussianBlur in="n" stdDeviation="1.8" result="sn" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="sn"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
          result="w"
        />
        <feGaussianBlur in="w" stdDeviation="3.52" />
      </filter>
    </svg>
  );
}
