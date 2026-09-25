// Pure math for the map's scroll-to-zoom / drag-to-pan interaction. Kept
// separate from DistrictMap.jsx so the coordinate math (easy to get subtly
// wrong — zoom-to-cursor especially) is testable/readable on its own.
//
// The map's own geometry never changes: zoom/pan is just an SVG
// translate+scale applied to a <g> wrapping the district/county paths,
// inside the same fixed viewBox the map has always used. That's what
// keeps zoom "lossless" — it's the same vector paths at a bigger size,
// not a raster image being stretched.

export const MIN_SCALE = 1;
export const MAX_SCALE = 30;

export function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Keep the transformed content covering the viewBox at all times — pan
 * can't drag a content edge past the viewport edge into empty space.
 */
export function clampPan(x, y, scale, viewWidth, viewHeight) {
  const minX = viewWidth - viewWidth * scale;
  const minY = viewHeight - viewHeight * scale;
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  };
}

/**
 * Next {scale, x, y} for a wheel event, keeping the same content point
 * stationary under the cursor (the standard "zoom to cursor" formula) —
 * `vbx`/`vby` are the cursor position and `t` the current transform, all
 * already in viewBox units.
 */
export function zoomAt(t, vbx, vby, deltaY, viewWidth, viewHeight) {
  const factor = Math.pow(1.0015, -deltaY);
  const newScale = clampScale(t.scale * factor);
  if (newScale === t.scale) return t;
  const contentX = (vbx - t.x) / t.scale;
  const contentY = (vby - t.y) / t.scale;
  const { x, y } = clampPan(vbx - contentX * newScale, vby - contentY * newScale, newScale, viewWidth, viewHeight);
  return { scale: newScale, x, y };
}
