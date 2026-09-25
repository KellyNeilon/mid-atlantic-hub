#!/usr/bin/env python3
"""
Rebuild src/data/countyOutlines.json by dissolving each county's own
district polygons from src/data/bakedDistricts.json.

Why this exists: the original county-outline data (baked from the v6
prototype) was a *separately sourced* PennDOT layer from the district
boundaries, and the two never quite agreed on where a shared border sat
(commonly a half-mile to a mile off, up to ~3 miles at some points) — the
teal county line visibly drifted away from the district polygons drawn
underneath it. Deriving the county line from the same district geometry
that's already on screen guarantees pixel-perfect alignment, at the small
cost that a handful of counties whose districts genuinely straddle a real
county line will bulge slightly past the county's true legal boundary to
match what's actually drawn.

Run this again only if bakedDistricts.json's geometry or county
assignments change:

    python3 scripts/rebuild-county-outlines.py

Requires: shapely (pip install shapely --break-system-packages)
"""
import json
import os

from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
DISTRICTS_PATH = os.path.join(HERE, '..', 'src', 'data', 'bakedDistricts.json')
OUT_PATH = os.path.join(HERE, '..', 'src', 'data', 'countyOutlines.json')

# Closing radius (degrees) used to bridge tiny sliver gaps/holes left where
# adjacent district polygons don't share exact vertices — real geography
# never has holes this small (checked: <0.15% of county area everywhere),
# so this is pure snapping noise, not data we need to preserve.
GAP_CLOSE_EPS = 0.0015

# Douglas-Peucker tolerance (degrees) applied after closing, purely to keep
# the output file size reasonable. Max vertex deviation is bounded by this
# value (~130ft) — far below anything visible on the map, so it doesn't
# reintroduce the misalignment this script exists to fix.
SIMPLIFY_TOLERANCE = 0.0004

# Drop leftover fragments smaller than this (specks from the closing step);
# a genuine second landmass for a county (checked: only Indiana has one) is
# far larger than this and survives.
MIN_PART_AREA = 0.0005


def main():
    with open(DISTRICTS_PATH) as f:
        districts = json.load(f)

    county_names = sorted(set(d['county'] for d in districts))

    results = []
    for cname in county_names:
        polys = []
        for d in districts:
            if d['county'] != cname:
                continue
            for ring in d['rings']:
                p = Polygon(ring)
                if not p.is_valid:
                    p = p.buffer(0)
                polys.append(p)

        merged = unary_union(polys)
        closed = merged.buffer(GAP_CLOSE_EPS).buffer(-GAP_CLOSE_EPS)
        parts = list(closed.geoms) if closed.geom_type == 'MultiPolygon' else [closed]
        parts = [p for p in parts if p.area > MIN_PART_AREA]
        parts.sort(key=lambda p: -p.area)

        rings = []
        for p in parts:
            simplified = p.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
            rings.append([[round(x, 5), round(y, 5)] for x, y in simplified.exterior.coords])

        results.append({'name': cname, 'rings': rings})

    with open(OUT_PATH, 'w') as f:
        json.dump(results, f, separators=(',', ':'))

    print(f'Wrote {len(results)} counties to {OUT_PATH}')
    multi = [r['name'] for r in results if len(r['rings']) > 1]
    if multi:
        print(f'Counties with more than one ring (real disconnected pieces): {multi}')


if __name__ == '__main__':
    main()
