"""Generate the offline VQ background from Natural Earth ne_10m_land GeoJSON.

Usage: python3 scripts/generate-vq-land.py /path/to/ne_10m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_land.geojson
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

The printed board's coastline is finer than the old 1:50m reference, so the
1:10m land polygons are clipped to the map extent and lightly simplified in
projected space before they are baked into the offline asset.  The tolerance is
measured in final SVG units (1000 x 620), which keeps coastlines crisp at the
map's maximum 4x zoom without shipping tens of thousands of redundant points.
"""
import hashlib
import json
import math
import pathlib
import sys

raw = pathlib.Path(sys.argv[1]).read_bytes()
extent = [-13, 30, 37, 59]
# Keep in sync with components/map-geometry.ts.
def project(lon, lat):
    return (20 + (lon + 13) / 50 * 960, 20 + (59 - lat) / 29 * 580)

# Sub-pixel at 4x zoom (one map unit is roughly 1.4 screen pixels there).
SIMPLIFY_TOLERANCE = 0.3


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
    """Douglas-Peucker simplification for projected coordinates."""
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


paths = []
for feature in json.loads(raw)['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        if not clip_ring(polygon[0]):
            continue
        for ring in polygon:
            points = clip_ring(ring)
            if len(points) < 3:
                continue
            projected = [project(lon, lat) for lon, lat in points]
            simplified = simplify(projected, SIMPLIFY_TOLERANCE)
            if len(simplified) < 3:
                continue
            paths.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in simplified) + 'Z')

target = pathlib.Path(__file__).resolve().parents[1] / 'src/virginQueen/data/land-background.json'
target.write_text(json.dumps({'source': 'Natural Earth 1:10m land, public domain',
    'sha256': hashlib.sha256(raw).hexdigest(), 'extent': extent,
    'simplifyTolerance': SIMPLIFY_TOLERANCE, 'path': ''.join(paths)}, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes')
