#!/usr/bin/env python3
"""Derive the 3D tabletop map textures from the published map scan.

The board scan is 7706 x 5462 (15.7 MB).  A WebGL table cannot hand that to a
phone GPU: the decoded texture alone would be ~168 MB.  This script publishes
two power-of-two-ish derivatives under `public/imperial-elegy/maps/` and records
their checksums so `--check` can prove the committed files match the scan.

    python3 scripts/generate-ie-table-textures.py            # write
    python3 scripts/generate-ie-table-textures.py --check    # verify only

Generation needs Pillow; verification does not (it only re-hashes the files).
The derivatives are NOT part of the VASSAL module manifest: they are derived
from `maps/world.jpg`, which the manifest already covers.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "imperial-elegy" / "maps" / "world.jpg"
OUT_DIR = SOURCE.parent
MANIFEST = ROOT / "src" / "imperialElegy" / "data" / "generated" / "table-textures.json"

# width, jpeg quality, published name.  The phone tier is a quarter of the
# desktop one in each dimension, so it decodes to 1/16 of the memory.
TIERS = [
    (4096, 82, "world-table.jpg"),
    (1024, 80, "world-table-small.jpg"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generate() -> list[dict]:
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - generation-only dependency
        sys.exit("Pillow is required to generate the textures: pip install pillow")

    with Image.open(SOURCE) as image:
        image = image.convert("RGB")
        entries = []
        for width, quality, name in TIERS:
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.LANCZOS)
            target = OUT_DIR / name
            resized.save(target, "JPEG", quality=quality, optimize=True, progressive=True)
            entries.append({
                "published": f"maps/{name}",
                "width": width,
                "height": height,
                "bytes": target.stat().st_size,
                "checksum": sha256(target),
                "source": "maps/world.jpg",
                "generator": "scripts/generate-ie-table-textures.py",
            })
    return entries


def check() -> int:
    if not MANIFEST.exists():
        print(f"missing {MANIFEST.relative_to(ROOT)}; run the generator", file=sys.stderr)
        return 1
    entries = json.loads(MANIFEST.read_text())["textures"]
    failures = 0
    for entry in entries:
        path = ROOT / "public" / "imperial-elegy" / entry["published"]
        if not path.exists():
            print(f"missing {path.relative_to(ROOT)}", file=sys.stderr)
            failures += 1
            continue
        actual = sha256(path)
        if actual != entry["checksum"]:
            print(f"checksum mismatch: {path.relative_to(ROOT)}", file=sys.stderr)
            failures += 1
    if failures:
        return 1
    print(f"table textures ok ({len(entries)} files)")
    return 0


def main() -> int:
    if "--check" in sys.argv:
        return check()
    entries = generate()
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({"textures": entries}, indent=2) + "\n")
    for entry in entries:
        print(f"{entry['published']}: {entry['width']}x{entry['height']} "
              f"{entry['bytes'] / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
