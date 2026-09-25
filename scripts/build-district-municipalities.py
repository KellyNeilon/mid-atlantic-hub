#!/usr/bin/env python3
"""
Build src/data/districtMunicipalities.json: for every district in
bakedDistricts.json, the list of PA municipalities (townships/boroughs/
cities/towns) whose boundary meaningfully overlaps that district's
geometry.

Source: PennDOT's live Municipal Boundaries service (same lineage as the
school district boundary layer this app's district geometry comes from —
see PA-District-Intelligence-System.md's "GIS Sources" section):

    https://gis.penndot.pa.gov/gis/rest/services/opendata/municipalboundaries/MapServer/0

That service caps queries at 2000 records and PA has 2567 municipalities,
so pulling it requires two paginated requests. This sandbox can't reach
gis.penndot.pa.gov directly (network is locked to package registries +
GitHub), so the two pages have to be fetched on a machine with normal
internet access and handed to this script — they are NOT checked into the
repo (raw, ~38MB combined; only this script's small derived JSON output
is committed). To (re)fetch them, e.g. from PowerShell:

    Invoke-WebRequest -Uri "https://gis.penndot.pa.gov/gis/rest/services/opendata/municipalboundaries/MapServer/0/query?where=1%3D1&outFields=MUNICIPAL_NAME,CLASS_OF_MUNIC,COUNTY_NAME,GEOID&returnGeometry=true&resultOffset=0&resultRecordCount=2000&f=geojson" -OutFile "pa-municipalities-part1.geojson"
    Invoke-WebRequest -Uri "https://gis.penndot.pa.gov/gis/rest/services/opendata/municipalboundaries/MapServer/0/query?where=1%3D1&outFields=MUNICIPAL_NAME,CLASS_OF_MUNIC,COUNTY_NAME,GEOID&returnGeometry=true&resultOffset=2000&resultRecordCount=2000&f=geojson" -OutFile "pa-municipalities-part2.geojson"

Run:

    python3 scripts/build-district-municipalities.py path/to/part1.geojson path/to/part2.geojson [...more parts]

Requires: shapely (pip install shapely --break-system-packages)
"""
import json
import os
import re
import sys

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
DISTRICTS_PATH = os.path.join(HERE, '..', 'src', 'data', 'bakedDistricts.json')
OUT_PATH = os.path.join(HERE, '..', 'src', 'data', 'districtMunicipalities.json')

CLASS_LABELS = {'1TWP': 'Township', '2TWP': 'Township', 'BORO': 'Borough', 'CITY': 'City', 'TOWN': 'Town'}

# A muni/district pair only counts as "in" a district once the overlap
# covers at least this fraction of whichever of the two is smaller. Below
# this, it's boundary-precision noise between two independently-sourced
# PennDOT layers (verified: e.g. Parkland SD picking up a 5.5%-overlap
# sliver of Allentown City, which it plainly doesn't serve). Real partial
# splits of a municipality between two adjacent districts — which does
# happen — land well above this (e.g. Hector Township splits ~42/58
# between Northern Potter SD and Galeton Area SD).
MIN_OVERLAP_FRAC = 0.15


def fix_mc_casing(name):
    """str.title() turns MCKEAN into Mckean; fix the PA Mc-prefix names."""
    return re.sub(r'\bMc([a-z])', lambda m: 'Mc' + m.group(1).upper(), name)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    with open(DISTRICTS_PATH) as f:
        districts = json.load(f)

    features = []
    for path in sys.argv[1:]:
        with open(path) as f:
            features.extend(json.load(f)['features'])

    munis = []
    for feat in features:
        if feat.get('geometry') is None:
            continue
        props = feat['properties']
        geom = shape(feat['geometry'])
        if not geom.is_valid:
            geom = geom.buffer(0)
        munis.append({
            'name': fix_mc_casing(props['MUNICIPAL_NAME'].title()),
            'type': CLASS_LABELS.get(props['CLASS_OF_MUNIC'], props['CLASS_OF_MUNIC']),
            'geom': geom,
            'area': geom.area,
        })

    tree = STRtree([m['geom'] for m in munis])

    output = {}
    for d in districts:
        polys = []
        for ring in d['rings']:
            p = Polygon(ring)
            if not p.is_valid:
                p = p.buffer(0)
            polys.append(p)
        dgeom = unary_union(polys)

        matched = {}  # (name, type) -> total intersection area (muni may straddle 2 counties = 2 features)
        for i in tree.query(dgeom):
            m = munis[i]
            if not dgeom.intersects(m['geom']):
                continue
            inter = dgeom.intersection(m['geom'])
            if inter.is_empty:
                continue
            frac = inter.area / min(m['area'], dgeom.area)
            if frac >= MIN_OVERLAP_FRAC:
                key = (m['name'], m['type'])
                matched[key] = matched.get(key, 0.0) + inter.area

        ordered = sorted(matched.items(), key=lambda kv: -kv[1])
        output[d['name']] = [{'name': k[0], 'type': k[1]} for k, _ in ordered]

    with open(OUT_PATH, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    counts = [len(v) for v in output.values()]
    print(f'Wrote {len(output)} districts to {OUT_PATH}')
    print(f'Municipalities per district: min={min(counts)} avg={sum(counts)/len(counts):.1f} max={max(counts)}')
    zero = [d for d, v in output.items() if not v]
    if zero:
        print(f'WARNING: {len(zero)} districts matched zero municipalities: {zero}')


if __name__ == '__main__':
    main()
