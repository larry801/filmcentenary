"""Generate the offline VQ background from Natural Earth ne_50m_land GeoJSON.

Usage: python3 scripts/generate-vq-land.py /path/to/ne_50m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/
"""
import hashlib
import json
import pathlib
import sys

raw = pathlib.Path(sys.argv[1]).read_bytes()
extent = [-13, 30, 37, 59]

def clip(ring):
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

paths = []
for feature in json.loads(raw)['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        if not clip(polygon[0]):
            continue
        for ring in polygon:
            points = clip(ring)
            if len(points) < 3:
                continue
            coordinates = [(20 + (lon + 13) / 50 * 960, 20 + (59 - lat) / 29 * 580) for lon, lat in points]
            paths.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in coordinates) + 'Z')

target = pathlib.Path(__file__).resolve().parents[1] / 'src/virginQueen/data/land-background.json'
target.write_text(json.dumps({'source': 'Natural Earth 1:50m land, public domain',
    'sha256': hashlib.sha256(raw).hexdigest(), 'extent': extent, 'path': ''.join(paths)}, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes')
