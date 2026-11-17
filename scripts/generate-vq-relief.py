"""Generate the VQ mountain-range relief layer from Natural Earth 1:10m polygons.

Usage:
  python3 scripts/generate-vq-relief.py /path/to/ne_10m_geography_regions_polys.geojson

Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_geography_regions_polys.geojson
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

The printed board draws the Alps, Pyrenees, Apennines, Carpathians and the
other major ranges as engraved hachures.  This layer supplies the range
outlines; the map applies a fine hatch pattern and a soft fill at render time.
Only genuine mountain regions are kept, plus the Massif Central plateau, which
is printed as high ground on period maps.
"""
import hashlib
import json
import math
import pathlib
import sys

raw = pathlib.Path(sys.argv[1]).read_bytes()
extent = [-13, 30, 37, 59]
SIMPLIFY_TOLERANCE = 0.5
INCLUDE_PLATEAUS = {'Massif Central'}


def project(lon, lat):
    return (20 + (lon + 13) / 50 * 960, 20 + (59 - lat) / 29 * 580)


def clip_ring(ring):
    points = ring[:-1] if ring[0] == ring[-1] else ring
    for axis, edge, direction in [(0, -13, 1), (0, 37, -1), (1, 30, 1), (1, 59, -1)]:
        output = []
        for a, b in zip(points[-1:] + points[:-1], points):
            inside_a = (a[axis] - edge) * direction >= 0
            inside_b = (b[axis] - edge) * direction >= 0
            if inside_a != inside_b:
                t = (edge - a[axis]) / (b[axis] - a[axis])
                output.append([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
            if inside_b:
                output.append(b)
        points = output
        if not points:
            break
    return points


def simplify(points, tolerance):
    if len(points) < 3:
        return points

    def distance(point, start, end):
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        if dx == 0 and dy == 0:
            return math.hypot(point[0] - start[0], point[1] - start[1])
        t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        return math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy))

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        farthest = -1.0
        index = -1
        for candidate in range(first + 1, last):
            d = distance(points[candidate], points[first], points[last])
            if d > farthest:
                farthest = d
                index = candidate
        if farthest > tolerance:
            keep[index] = True
            stack.append((first, index))
            stack.append((index, last))
    return [point for point, kept in zip(points, keep) if kept]


ranges = []
for feature in json.loads(raw)['features']:
    properties = feature['properties']
    kind = properties.get('FEATURECLA')
    name = properties.get('NAME') or ''
    if kind != 'Range/mtn' and not (kind == 'Plateau' and name in INCLUDE_PLATEAUS):
        continue
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    paths = []
    for polygon in polygons:
        for ring in polygon:
            points = clip_ring(ring)
            if len(points) < 3:
                continue
            projected = [project(lon, lat) for lon, lat in points]
            simplified = simplify(projected, SIMPLIFY_TOLERANCE)
            if len(simplified) < 3:
                continue
            paths.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in simplified) + 'Z')
    if paths:
        ranges.append({'name': name, 'path': ''.join(paths)})

target = pathlib.Path(__file__).resolve().parents[1] / 'src/virginQueen/data/relief-background.json'
target.write_text(json.dumps({
    'source': 'Natural Earth 1:10m geography_regions_polys, public domain',
    'sha256': hashlib.sha256(raw).hexdigest(),
    'extent': extent,
    'simplifyTolerance': SIMPLIFY_TOLERANCE,
    'ranges': ranges,
}, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes ({len(ranges)} relief regions)')
