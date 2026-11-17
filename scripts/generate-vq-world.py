"""Generate the compact world-map inset from Natural Earth ne_50m_land GeoJSON.

Usage: python3 scripts/generate-vq-world.py /path/to/ne_50m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

The 1:50m source replaces the old 1:110m outline so the world-map strip keeps
recognisable coastlines and islands at its printed size.  Douglas-Peucker
simplification is applied in inset units to keep the asset small.
"""
import hashlib
import json
import math
import pathlib
import sys

raw = pathlib.Path(sys.argv[1]).read_bytes()
extent = [-180, 80, 180, -60]
width, height = 360, 170
SIMPLIFY_TOLERANCE = 0.1


def project(lon, lat):
    return (
        4 + (lon - extent[0]) / (extent[2] - extent[0]) * (width - 8),
        4 + (extent[1] - max(extent[3], min(extent[1], lat))) / (extent[1] - extent[3]) * (height - 8),
    )


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


paths = []
for feature in json.loads(raw)['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        for ring in polygon:
            points = []
            previous = None
            for lon, lat in ring:
                point = tuple(round(value, 2) for value in project(lon, lat))
                if point != previous:
                    points.append(point)
                    previous = point
            simplified = simplify(points, SIMPLIFY_TOLERANCE)
            if len(simplified) >= 3:
                paths.append('M' + 'L'.join(f'{x},{y}' for x, y in simplified) + 'Z')

target = pathlib.Path(__file__).resolve().parents[1] / 'src/virginQueen/data/world-background.json'
target.write_text(json.dumps({
    'source': 'Natural Earth 1:50m land, public domain',
    'sha256': hashlib.sha256(raw).hexdigest(),
    'extent': extent,
    'width': width,
    'height': height,
    'simplifyTolerance': SIMPLIFY_TOLERANCE,
    'path': ''.join(paths),
}, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes')
