"""Generate the compact world-map inset from Natural Earth ne_110m_land GeoJSON.

Usage: python3 scripts/generate-vq-world.py /path/to/ne_110m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/
"""
import hashlib
import json
import pathlib
import sys

raw = pathlib.Path(sys.argv[1]).read_bytes()
extent = [-180, 80, 180, -60]
width, height = 360, 170


def project(lon, lat):
    return (
        4 + (lon - extent[0]) / (extent[2] - extent[0]) * (width - 8),
        4 + (extent[1] - lat) / (extent[1] - extent[3]) * (height - 8),
    )


paths = []
for feature in json.loads(raw)['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        for ring in polygon:
            points = []
            previous = None
            for lon, lat in ring:
                point = tuple(round(value, 2) for value in project(lon, max(extent[3], min(extent[1], lat))))
                if point != previous:
                    points.append(point)
                    previous = point
            if len(points) >= 3:
                paths.append('M' + 'L'.join(f'{x},{y}' for x, y in points) + 'Z')

target = pathlib.Path(__file__).resolve().parents[1] / 'src/virginQueen/data/world-background.json'
target.write_text(json.dumps({
    'source': 'Natural Earth 1:110m land, public domain',
    'sha256': hashlib.sha256(raw).hexdigest(),
    'extent': extent,
    'width': width,
    'height': height,
    'path': ''.join(paths),
}, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes')
