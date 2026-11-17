"""Generate the VQ rivers and lakes layer from Natural Earth 1:10m vectors.

Usage:
  python3 scripts/generate-vq-hydro.py /path/to/ne_10m_rivers_lake_centerlines.geojson \
      /path/to/ne_10m_lakes.geojson

Sources:
  https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_rivers_lake_centerlines.geojson
  https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_lakes.geojson
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

Only the major rivers printed on a period map are kept (scalerank <= 8), split
into two weights so the Rhine/Danube/Po stand out from tributaries.  Lines and
polygons are clipped to the same extent/projection as the land background.
"""
import hashlib
import json
import math
import pathlib
import sys

river_raw = pathlib.Path(sys.argv[1]).read_bytes()
lake_raw = pathlib.Path(sys.argv[2]).read_bytes()
extent = [-13, 30, 37, 59]
SIMPLIFY_TOLERANCE = 0.35
MAX_RIVER_RANK = 8
MAX_LAKE_RANK = 8
MAJOR_RIVER_RANK = 4


def project(lon, lat):
    return (20 + (lon + 13) / 50 * 960, 20 + (59 - lat) / 29 * 580)


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


def clip_segment(a, b):
    """Liang-Barsky segment clip against the map extent."""
    x0, y0 = a
    x1, y1 = b
    xmin, ymin, xmax, ymax = extent
    dx = x1 - x0
    dy = y1 - y0
    p = [-dx, dx, -dy, dy]
    q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0]
    u1, u2 = 0.0, 1.0
    for pi, qi in zip(p, q):
        if pi == 0:
            if qi < 0:
                return None
        else:
            r = qi / pi
            if pi < 0:
                if r > u2:
                    return None
                if r > u1:
                    u1 = r
            else:
                if r < u1:
                    return None
                if r < u2:
                    u2 = r
    if u1 > u2:
        return None
    return ((x0 + u1 * dx, y0 + u1 * dy), (x0 + u2 * dx, y0 + u2 * dy))


def clip_line(line):
    """Clip a polyline, returning one or more continuous pieces."""
    pieces = []
    current = []
    for a, b in zip(line[:-1], line[1:]):
        clipped = clip_segment(a, b)
        if clipped is None:
            if len(current) >= 2:
                pieces.append(current)
            current = []
            continue
        start, end = clipped
        if not current or math.hypot(current[-1][0] - start[0], current[-1][1] - start[1]) > 1e-9:
            if len(current) >= 2:
                pieces.append(current)
            current = [start]
        current.append(end)
    if len(current) >= 2:
        pieces.append(current)
    return pieces


def line_paths(geometry):
    if geometry['type'] == 'LineString':
        return [geometry['coordinates']]
    if geometry['type'] == 'MultiLineString':
        return geometry['coordinates']
    return []


def polygon_paths(geometry):
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        for ring in polygon:
            yield ring


def projected_path(piece, tolerance, close=False):
    projected = [project(lon, lat) for lon, lat in piece]
    simplified = simplify(projected, tolerance)
    if len(simplified) < (3 if close else 2):
        return None
    return 'M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in simplified) + ('Z' if close else '')


major = []
minor = []
for feature in json.loads(river_raw)['features']:
    properties = feature['properties']
    if properties.get('featurecla') != 'River':
        continue
    rank = properties.get('scalerank', 99)
    if rank > MAX_RIVER_RANK:
        continue
    target = major if rank <= MAJOR_RIVER_RANK else minor
    for line in line_paths(feature['geometry']):
        for piece in clip_line(line):
            path = projected_path(piece, SIMPLIFY_TOLERANCE)
            if path is not None:
                target.append(path)

lakes = []
for feature in json.loads(lake_raw)['features']:
    if feature['properties'].get('scalerank', 99) > MAX_LAKE_RANK:
        continue
    for ring in polygon_paths(feature['geometry']):
        points = ring[:-1] if ring and ring[0] == ring[-1] else ring
        if len(points) < 3:
            continue
        for piece in clip_line(points + [points[0]]):
            path = projected_path(piece, SIMPLIFY_TOLERANCE, close=True)
            if path is not None:
                lakes.append(path)

target = pathlib.Path(__file__).resolve().parents[1] / 'src/virginQueen/data/hydro-background.json'
target.write_text(json.dumps({
    'source': 'Natural Earth 1:10m rivers_lake_centerlines + lakes, public domain',
    'sha256': hashlib.sha256(river_raw + lake_raw).hexdigest(),
    'extent': extent,
    'simplifyTolerance': SIMPLIFY_TOLERANCE,
    'maxRiverRank': MAX_RIVER_RANK,
    'maxLakeRank': MAX_LAKE_RANK,
    'majorRivers': ''.join(major),
    'minorRivers': ''.join(minor),
    'lakes': ''.join(lakes),
}, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size:,} bytes '
      f'({len(major)} major, {len(minor)} minor river segments, {len(lakes)} lakes)')
