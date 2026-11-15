#!/usr/bin/env python3
"""Trace the printed Imperial Elegy board into a compact vector background.

The game used to render `public/imperial-elegy/maps/world.jpg` as one image: a
7706x5462 scan, ~15 MB, decoded in full before anything appears on screen.
This script extracts the board's printed *terrain* — the coastlines and the two
inset boards — as SVG paths in the same board coordinate space that
`constant/spaces.ts` already uses.  The UI then draws the map as vectors plus
live game markers: sharp at any zoom, tens of KB on the wire, painted at once.

Only terrain is baked.  The scan also prints the space counters, the adjacency
lines, the naval-box plates and the chart panels; all of those are redrawn at
runtime from game data, so this script blanks them and inpaints the ground
underneath before tracing.

Usage:
    python3 scripts/generate-ie-map.py [--preview PATH.png]

Needs numpy and Pillow (developer-only; the app has no Python dependency):
    python3 -m pip install --user numpy pillow

Method
------
1. Blank everything the runtime redraws: space counters, adjacency lines, and
   the printed chart panels.
2. Classify the rest of the paper as land (warm parchment) or water (cool tint).
3. Inpaint the blanked counters from their surroundings with a bounded
   breadth-first fill, so a counter sitting on the coast cannot gouge the
   shoreline, and a chart over the sea cannot seal a gulf.
4. Keep the large shapes, trace their boundaries, simplify, smooth and emit one
   even-odd path per board region (the main map and the two inset boards).

The output records the source checksum so `data.test.ts` can prove the
checked-in background belongs to the checked-in scan.
"""
import argparse
import hashlib
import json
import math
import pathlib
import re
import sys
from collections import deque

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:  # pragma: no cover - developer tool
    sys.exit("generate-ie-map.py needs numpy and Pillow:\n"
             "    python3 -m pip install --user numpy pillow")

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/imperial-elegy/maps/world.jpg"
SPACES_TS = ROOT / "src/imperialElegy/constant/spaces.ts"
TARGET = ROOT / "src/imperialElegy/data/map-background.json"

# Board coordinate space: identical to the printed scan and to `spaces.ts`.
BOARD = (7706, 5462)
# The scan photographs the board on a table; these are the paper's edges,
# measured off a labelled grid overlay of the scan.
PAPER = (480, 532, 7173, 4914)
# Trace resolution (board pixels).  Large enough to keep coastlines honest,
# small enough that the pure-Python tracer stays quick.
WIDTH = 3000
# Douglas-Peucker tolerance, in board units (a board unit is ~0.1 mm).
SIMPLIFY = 5.0
SMOOTH_ROUNDS = 2
# Smallest traced shape worth keeping, as a share of its region.
MIN_SHARE = 0.002

# Printed panels that are charts, not coastline.  Board coordinates.
PLATES = (
    (430, 860, 1430, 1600),      # North Atlantic Box
    (450, 4230, 1450, 4930),     # South Atlantic Box
    (2420, 560, 3150, 960),      # Baltic Sea Box
    (3300, 3590, 4020, 3950),    # Eastern Mediterranean Box
    (1320, 2930, 2070, 3290),    # Western Mediterranean Box
    (3840, 2450, 4440, 2820),    # Black Sea Box
    (5320, 1910, 5960, 2410),    # Indian Ocean Box
    (6100, 2350, 6700, 2710),    # Pacific Ocean Box
    (6440, 2670, 7020, 3110),    # South & Central Pacific Ocean Box
    (1180, 560, 2300, 940),      # End Phase Build Box
    (2000, 4380, 3950, 4850),    # The Alliance Track
    (2040, 4060, 3200, 4380),    # Wartime Initiative Order
    (5320, 4100, 7706, 5040),    # Turn / Great War / Tension / Flashpoints
    (6260, 4580, 7706, 5462),    # VP & Power Projection Track
    (5580, 4880, 7706, 5462),    # Imperial Elegy wordmark
)


def space_rows():
    """`(id, type, submap, x, y)` for every printed space, from spaces.ts."""
    text = SPACES_TS.read_text()
    pattern = (r'\{id: "([^"]+)", name: "[^"]+", nameZh: "[^"]+", type: "([^"]+)", '
               r'region: "[^"]+", submap: "([^"]+)".*?x: (\d+), y: (\d+)\}')
    return [(m[0], m[1], m[2], int(m[3]), int(m[4])) for m in re.findall(pattern, text)]


def connection_pairs():
    """`(a, b)` for every printed adjacency, from the CONNECTION_ROWS table."""
    text = SPACES_TS.read_text()
    block = text.split("const CONNECTION_ROWS")[1].split("\n];")[0]
    return re.findall(r'\["([a-z0-9-]+)", "([a-z0-9-]+)"', block)


class Board:
    """The scan, resampled once into the trace space."""

    def __init__(self):
        self.height = int(round(WIDTH * (PAPER[3] - PAPER[1]) / (PAPER[2] - PAPER[0])))
        self.size = (WIDTH, self.height)
        self.image = Image.open(SOURCE).convert("RGB").crop(PAPER).resize(self.size, Image.LANCZOS)
        self.pixels = np.asarray(self.image).astype(np.int16)
        self.sx = WIDTH / (PAPER[2] - PAPER[0])
        self.sy = self.height / (PAPER[3] - PAPER[1])

    def local(self, bx, by):
        """Board coordinates -> trace pixel coordinates."""
        return ((bx - PAPER[0]) * self.sx, (by - PAPER[1]) * self.sy)

    def warm(self):
        """Land is warm parchment: red reads clearly above green."""
        return (self.pixels[..., 0] - self.pixels[..., 1]) >= 7


def blank_overlays(board, rows, pairs):
    """Mask of pixels covered by printing the runtime redraws itself."""
    mask = Image.new("L", board.size, 0)
    draw = ImageDraw.Draw(mask)

    # Space counters, sized like the printed pieces.
    for _id, kind, submap, x, y in rows:
        if submap != "main":
            continue
        bx, by = board.local(x, y)
        radius = (104 if kind == "navalBox" else 70) * board.sx
        draw.ellipse((bx - radius, by - radius, bx + radius, by + radius), fill=255)

    # Adjacency lines.
    points = {row[0]: (row[3], row[4]) for row in rows}
    for a, b in pairs:
        if a in points and b in points:
            draw.line([board.local(*points[a]), board.local(*points[b])], fill=255, width=8)

    # Chart plates.
    for x0, y0, x1, y1 in PLATES:
        draw.rectangle((*board.local(x0, y0), *board.local(x1, y1)), fill=255)
    return np.asarray(mask) > 127


def inset_boxes(rows, pad=190):
    """Board-coordinate box of each printed inset panel, clamped to the paper."""
    boxes = {}
    for submap in ("africa", "northAmerica"):
        spaces = [(x, y) for _i, _k, sm, x, y in rows if sm == submap]
        if not spaces:
            continue
        xs = [p[0] for p in spaces]
        ys = [p[1] for p in spaces]
        boxes[submap] = (
            max(PAPER[0], min(xs) - pad),
            max(PAPER[1], min(ys) - pad),
            min(PAPER[2], max(xs) + pad),
            min(PAPER[3], max(ys) + pad),
        )
    return boxes


def classify(board, rows, blanked, region, hops):
    """Land mask for one region, with the blanked printing inpainted."""
    h, w = board.height, WIDTH
    warm = board.warm()
    label = np.zeros((h, w), np.int8)
    label[region & ~blanked & warm] = 1
    label[region & ~blanked & ~warm] = -1

    # A printed space is ground truth: land spaces are land, naval boxes water.
    seeds = Image.new("L", board.size, 0)
    sea_seeds = Image.new("L", board.size, 0)
    draw = ImageDraw.Draw(seeds)
    draw_sea = ImageDraw.Draw(sea_seeds)
    for _id, kind, submap, x, y in rows:
        if submap not in ("main", "naval"):
            continue
        bx, by = board.local(x, y)
        radius = (110 if kind == "navalBox" else 56) * board.sx
        target = draw_sea if kind == "navalBox" else draw
        target.ellipse((bx - radius, by - radius, bx + radius, by + radius), fill=255)
    label[np.asarray(seeds) > 127] = 1
    label[np.asarray(sea_seeds) > 127] = -1

    queue = deque((y, x, 0) for y, x in zip(*np.where(label != 0)))
    while queue:
        y, x, hop = queue.popleft()
        if hop >= hops:
            continue
        value = label[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and region[ny, nx] and label[ny, nx] == 0:
                label[ny, nx] = value
                queue.append((ny, nx, hop + 1))

    land = label > 0
    # The filter radius follows the trace resolution: at 3000 px it has to
    # cover the printed hatching and name plates that at 2000 px blurred away.
    median = 9
    close = max(3, round(3 * WIDTH / 2000)) | 1
    land = np.asarray(Image.fromarray((land * 255).astype(np.uint8))
                      .filter(ImageFilter.MedianFilter(median))
                      .filter(ImageFilter.MaxFilter(close))
                      .filter(ImageFilter.MinFilter(close))) > 127
    return keep_large(land, MIN_SHARE)


def keep_large(mask, share):
    """Drop shapes smaller than `share` of the mask's bounding region."""
    h, w = mask.shape
    labels = -np.ones((h, w), np.int32)
    sizes = []
    for sy in range(h):
        row = mask[sy]
        for sx in range(w):
            if not row[sx] or labels[sy, sx] >= 0:
                continue
            index = len(sizes)
            labels[sy, sx] = index
            stack = [(sy, sx)]
            size = 0
            while stack:
                y, x = stack.pop()
                size += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and labels[ny, nx] < 0:
                        labels[ny, nx] = index
                        stack.append((ny, nx))
            sizes.append(size)
    keep = [i for i, size in enumerate(sizes) if size > h * w * share]
    return np.isin(labels, keep)


def trace(mask):
    """Boundary loops of a mask, walked as lattice steps."""
    h, w = mask.shape
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = mask

    # Unit edges around every filled cell; edges shared by two cells cancel,
    # leaving exactly the outline.
    edges = {}
    for i in range(h):
        for j in range(w):
            if not pad[i + 1, j + 1]:
                continue
            a0, a1 = (i + 1, j + 1), (i + 2, j + 1)
            a2, a3 = (i + 2, j + 2), (i + 1, j + 2)
            for s, t in ((a0, a1), (a1, a2), (a2, a3), (a3, a0)):
                if (t, s) in edges:
                    del edges[(t, s)]
                else:
                    edges[(s, t)] = True
    outgoing = {}
    for s, t in edges:
        outgoing.setdefault(s, []).append(t)

    def turn(a, b):
        return math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])

    used = set()
    loops = []
    for start in list(edges):
        if start in used:
            continue
        used.add(start)
        loop = [start[0], start[1]]
        prev, cur = start
        while cur != start[0]:
            step = (cur[0] - prev[0], cur[1] - prev[1])
            options = [v for v in outgoing.get(cur, []) if (cur, v) not in used]
            if not options:
                break
            best, best_turn = None, None
            for v in options:
                t = turn(step, (v[0] - cur[0], v[1] - cur[1]))
                if best_turn is None or t < best_turn:
                    best_turn, best = t, v
            used.add((cur, best))
            prev, cur = cur, best
            loop.append(cur)
        loops.append(loop)
    return loops


def simplify(points, eps):
    """Douglas-Peucker."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    best, index = 0.0, 0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        d = math.hypot(x - x1, y - y1) if norm == 0 else abs(dy * (x - x1) - dx * (y - y1)) / norm
        if d > best:
            best, index = d, i
    if best > eps:
        return simplify(points[:index + 1], eps)[:-1] + simplify(points[index:], eps)
    return [points[0], points[-1]]


def smooth(points, rounds=SMOOTH_ROUNDS):
    """Chaikin corner cutting, so traced stair-steps read as a coastline."""
    for _ in range(rounds):
        out = []
        for i, a in enumerate(points):
            b = points[(i + 1) % len(points)]
            out.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            out.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        points = out
    return points


def polygon_area(points):
    return abs(sum(points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]
                   for i in range(len(points) - 1))) / 2


def mask_to_path(mask, board, min_share):
    """Trace a land mask into an SVG path in board coordinates."""
    height = mask.shape[0]
    sx, sy = BOARD[0] / WIDTH, BOARD[1] / height
    loops = []
    for loop in trace(mask):
        if len(loop) < 40:
            continue
        points = [(c * sx, r * sy) for r, c in loop]
        if polygon_area(points) < MIN_SHARE * BOARD[0] * BOARD[1]:
            continue
        points = simplify(points, SIMPLIFY)
        if len(points) < 4:
            continue
        loops.append(smooth(points))
    loops.sort(key=polygon_area, reverse=True)
    return " ".join("M" + "L".join(f"{x:.0f},{y:.0f}" for x, y in loop) + "Z" for loop in loops), loops


def build():
    board = Board()
    rows = space_rows()
    pairs = connection_pairs()
    blanked = blank_overlays(board, rows, pairs)
    boxes = inset_boxes(rows)

    h, w = board.height, WIDTH

    # The main map is the paper minus the two inset panels.
    region_main = np.zeros((h, w), bool)
    y0 = max(0, int(board.local(0, PAPER[1])[1]))
    y1 = min(h, int(board.local(0, PAPER[3])[1]))
    x0 = max(0, int(board.local(PAPER[0], 0)[0]))
    x1 = min(w, int(board.local(PAPER[2], 0)[0]))
    region_main[y0:y1, x0:x1] = True
    for bx0, by0, bx1, by1 in boxes.values():
        X0, Y0 = board.local(bx0, by0)
        X1, Y1 = board.local(bx1, by1)
        region_main[max(0, int(Y0)):min(h, int(Y1)), max(0, int(X0)):min(w, int(X1))] = False

    main_mask = classify(board, rows, blanked, region_main, hops=int(90 * WIDTH / 1500))
    main_path, main_loops = mask_to_path(main_mask, board, MIN_SHARE)

    regions = [{
        "id": "main",
        "box": [PAPER[0], PAPER[1], PAPER[2], PAPER[3]],
        "d": main_path,
        "loops": len(main_loops),
    }]

    # The inset panels are separate printed boards pasted over the ocean.
    for submap, (bx0, by0, bx1, by1) in boxes.items():
        X0, Y0 = board.local(bx0, by0)
        X1, Y1 = board.local(bx1, by1)
        box = (max(0, int(Y0)), min(h, int(Y1)), max(0, int(X0)), min(w, int(X1)))
        region = np.zeros((h, w), bool)
        region[box[0]:box[1], box[2]:box[3]] = True
        mask = classify(board, rows, np.zeros((h, w), bool), region, hops=int(26 * WIDTH / 1500))
        path, loops = mask_to_path(mask, board, 0.004)
        regions.append({
            "id": submap,
            "box": [bx0, by0, bx1, by1],
            "d": path,
            "loops": len(loops),
        })

    return regions, board, main_mask


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--preview", help="also write an SVG preview to this path")
    args = parser.parse_args()

    if not SOURCE.exists():
        sys.exit(f"missing board scan: {SOURCE}")
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()

    regions, board, main_mask = build()
    payload = {
        "source": "public/imperial-elegy/maps/world.jpg",
        "sha256": digest,
        "viewBox": list(BOARD),
        "paper": list(PAPER),
        "regions": regions,
    }
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    total = sum(len(region["d"]) for region in regions)
    print(f"{TARGET.relative_to(ROOT)}: {TARGET.stat().st_size:,} bytes, "
          f"{len(regions)} regions, {total:,} path characters")

    if args.preview:
        preview = pathlib.Path(args.preview).with_suffix(".svg")
        body = []
        for region in regions:
            bx0, by0, bx1, by1 = region["box"]
            body.append(f'<g clip-path="url(#clip-{region["id"]})">'
                        f'<rect x="{bx0}" y="{by0}" width="{bx1 - bx0}" height="{by1 - by0}" fill="#a9c6d2"/>'
                        f'<path d="{region["d"]}" fill="#e9ddc2" stroke="#a3927a" stroke-width="6" '
                        f'fill-rule="evenodd"/></g>')
        clips = "".join(
            f'<clipPath id="clip-{region["id"]}"><rect x="{region["box"][0]}" y="{region["box"][1]}" '
            f'width="{region["box"][2] - region["box"][0]}" height="{region["box"][3] - region["box"][1]}"/>'
            f'</clipPath>' for region in regions)
        preview.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BOARD[0]} {BOARD[1]}" '
            f'width="1928" height="1366"><defs>{clips}</defs>'
            f'<rect width="{BOARD[0]}" height="{BOARD[1]}" fill="#f2ead9"/>{"".join(body)}</svg>')
        print(f"wrote {preview}")


if __name__ == "__main__":
    main()
