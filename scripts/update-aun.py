#!/usr/bin/env python3
"""
Fix the `aun` field in src/data/bakedDistricts.json and populate the AUN
column in public/data/district-data.csv with real PA Administrative Unit
Numbers (AUNs).

Why this exists: bakedDistricts.json's original `aun` field was corrupted —
only 74 distinct values across 500 districts, almost certainly a leftover
county/IU code from the original data extraction rather than each
district's true AUN. This script replaces it with the real thing.

Source: PennDOT's live school district boundary service, same lineage as
this app's district geometry —

    https://gis.penndot.pa.gov/gis/rest/services/opendata/schooldistrictboundaries/MapServer/0

That layer exposes two AUN-looking fields, AUN_NUM and AUN_SCHDIS. Verified
against Philadelphia's publicly known AUN (126515001): AUN_SCHDIS matched
exactly, AUN_NUM did not (it appears to code something else, maybe the
Intermediate Unit). AUN_SCHDIS is the field this script uses.

This sandbox can't reach gis.penndot.pa.gov directly (network is locked to
package registries + GitHub), so the query has to be run on a machine with
normal internet access. Since PA has under 2000 districts/entities, no
pagination is needed — one request gets everything. E.g. from PowerShell:

    Invoke-WebRequest -Uri "https://gis.penndot.pa.gov/gis/rest/services/opendata/schooldistrictboundaries/MapServer/0/query?where=1%3D1&outFields=SCHOOL_DISTRICT,CTY_NAME,AUN_NUM,AUN_SCHDIS,IU_NUM,IU_NAME&returnGeometry=false&f=json" -OutFile "pa-district-aun.json"

Run:

    python3 scripts/update-aun.py path/to/pa-district-aun.json

Also cross-checks each district's `county` field against the source's
CTY_NAME as a free correctness pass — prints any mismatches found rather
than silently trusting either side.
"""
import json
import os
import sys
import csv

HERE = os.path.dirname(os.path.abspath(__file__))
DISTRICTS_PATH = os.path.join(HERE, '..', 'src', 'data', 'bakedDistricts.json')
CSV_PATH = os.path.join(HERE, '..', 'public', 'data', 'district-data.csv')


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    with open(sys.argv[1]) as f:
        source = json.load(f)
    feats = source['features']
    src_by_name = {f['attributes']['SCHOOL_DISTRICT']: f['attributes'] for f in feats}

    # --- bakedDistricts.json ---
    with open(DISTRICTS_PATH) as f:
        baked = json.load(f)

    missing = [b['name'] for b in baked if b['name'] not in src_by_name]
    if missing:
        print(f'ERROR: {len(missing)} bakedDistricts.json names not found in source: {missing}')
        sys.exit(1)

    county_mismatches = []
    aun_updated = 0
    for b in baked:
        attrs = src_by_name[b['name']]
        real_aun = attrs['AUN_SCHDIS']
        if b.get('aun') != real_aun:
            b['aun'] = real_aun
            aun_updated += 1
        if attrs['CTY_NAME'].strip().upper() != b['county'].strip().upper():
            county_mismatches.append((b['name'], b['county'], attrs['CTY_NAME']))

    with open(DISTRICTS_PATH, 'w') as f:
        json.dump(baked, f, separators=(',', ':'))
    print(f'bakedDistricts.json: updated aun on {aun_updated}/{len(baked)} districts')

    if county_mismatches:
        print(f'County mismatches found ({len(county_mismatches)}) — NOT auto-fixed, review manually:')
        for m in county_mismatches:
            print(' ', m)
    else:
        print('County cross-check: no mismatches')

    # --- district-data.csv ---
    aun_by_name = {b['name']: b['aun'] for b in baked}
    with open(CSV_PATH, newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    csv_updated = 0
    csv_unmatched = []
    for r in rows:
        aun = aun_by_name.get(r['DISTRICT'])
        if aun is None:
            csv_unmatched.append(r['DISTRICT'])
            continue
        if r['AUN'] != aun:
            r['AUN'] = aun
            csv_updated += 1

    with open(CSV_PATH, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f'district-data.csv: updated AUN on {csv_updated}/{len(rows)} rows')
    if csv_unmatched:
        print(f'WARNING: {len(csv_unmatched)} CSV rows had no match in bakedDistricts.json: {csv_unmatched}')


if __name__ == '__main__':
    main()
