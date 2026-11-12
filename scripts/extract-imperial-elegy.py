#!/usr/bin/env python3
"""Reproducible extraction of the Imperial Elegy VASSAL module.

The publisher ships the game as a VASSAL module (``.vmod``, a zip archive).
This script is the single source of truth for the image assets that the web
implementation publishes and for the module metadata (board images, zones,
card slots and the saved campaign setup) that the hand-curated TypeScript
data is validated against.

Usage:
    python3 scripts/extract-imperial-elegy.py [--vmod PATH] [--check]

``--check`` does not write anything; it verifies that every asset listed in
``public/imperial-elegy/manifest.json`` exists with the recorded checksum.

Only Python's standard library is required.  Image dimensions are read from
the PNG IHDR / JPEG SOF headers, so Pillow is not a dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VMOD = ROOT / "Imperial Elegy 1.1.0-beta.4.vmod"
PUBLIC_DIR = ROOT / "public" / "imperial-elegy"
GENERATED_DIR = ROOT / "src" / "imperialElegy" / "data" / "generated"

# Board images that the web client uses.  Player displays are keyed by power;
# the module configuration selects ``Playerboard UK.png`` for the UK (there is
# also an older ``Playerboard UK.jpg`` in the archive which is deliberately not
# published).
MAP_BOARDS = {
    "world": "Map-World f.jpg",
    "greatWar": "GW Main Map T3.jpg",
}
DISPLAY_BOARDS = {
    "GE": "Playerboard Germany.jpg",
    "UK": "Playerboard UK.png",
    "FR": "Playerboard France.jpg",
    "AU": "Playerboard Austria.jpg",
    "RU": "Playerboard Russia.jpg",
    "OT": "Playerboard Ottoman.jpg",
}
REFERENCE_BOARDS = {
    "influence-track": "Chart Mjr Pwr Influence.png",
    "italy-legend": "Chart Italy and Legend.png",
    "sequence-of-play": "Chart Seq-of-Play.png",
    "map-flashpoints": "Chart Flag and Flashpoints.png",
    "combat-crt": "Chart Combat and CRT.png",
    "colonial-great-wars": "Chart Colonial and Great Wars.png",
    "war-aims-minors": "Chart War-Aims and Minors.png",
    "crisis": "Chart Crisis b.png",
    "counter-count": "Chart Counter count.png",
}

POWER_NAMES = {
    "GE": "Germany",
    "UK": "United Kingdom",
    "FR": "France",
    "AU": "Austria-Hungary",
    "RU": "Russia",
    "OT": "Ottoman",
}

# Promotional cards are deferred by the implementation and are not published.
PROMO_CARD_IMAGES = {"Action Card P1.jpg", "Action Card P2.jpg", "Action Card P3.jpg"}

# The module has a duplicated image reference for card 81 and Wilhelm II; the
# publisher's living rules and the module's own deck placement establish that
# Wilhelm II is card 82.  These two cards have no face image in the archive and
# are rendered as text cards (see docs/imperial-elegy/CORRECTIONS.md).
TEXT_CARD_IDS = {82, 22}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def image_size(path: Path) -> tuple[int | None, int | None]:
    """Read dimensions from PNG or JPEG headers without external libraries."""
    with path.open("rb") as fh:
        head = fh.read(32)
        if head[:8] == b"\x89PNG\r\n\x1a\n":
            w, h = struct.unpack(">II", head[16:24])
            return w, h
        if head[:2] == b"\xff\xd8":
            fh.seek(2)
            while True:
                marker = fh.read(2)
                if len(marker) < 2:
                    break
                if marker[0] != 0xFF:
                    break
                code = marker[1]
                if code in (0xD8, 0xD9):
                    continue
                length_bytes = fh.read(2)
                if len(length_bytes) < 2:
                    break
                length = struct.unpack(">H", length_bytes)[0]
                if 0xC0 <= code <= 0xCF and code not in (0xC4, 0xC8, 0xCC):
                    data = fh.read(5)
                    h, w = struct.unpack(">HH", data[1:5])
                    return w, h
                fh.seek(length - 2, 1)
    return None, None


def text_of(elem: ET.Element) -> str:
    return "".join(elem.itertext())


def strip_ns(tag: str) -> str:
    """Return the local Java-ish class name of a VASSAL XML tag.

    VASSAL writes tags such as ``VASSAL.build.widget.CardSlot`` (and sometimes
    with an XML namespace), so neither an XML-namespace strip nor a plain
    ``split`` is sufficient.
    """
    tag = tag.rsplit("}", 1)[-1]
    return tag.rsplit(".", 1)[-1]


def parse_module(build_file: Path, module_dir: Path) -> dict:
    tree = ET.parse(build_file)
    root = tree.getroot()

    maps = []
    zones_by_map: dict[str, list[dict]] = {}
    boards: list[dict] = []
    for elem in root.iter():
        name = strip_ns(elem.tag)
        if name == "Map":
            map_name = elem.get("mapName") or ""
            map_record = {"name": map_name, "button": elem.get("buttonName")}
            map_boards = []
            for board in elem.iter():
                if strip_ns(board.tag) == "Board":
                    map_boards.append(
                        {
                            "image": board.get("image"),
                            "name": board.get("name"),
                            "reversible": board.get("reversible"),
                        }
                    )
            map_record["boards"] = map_boards
            maps.append(map_record)
            boards.extend(map_boards)
            zones = []
            for zone in elem.iter():
                if strip_ns(zone.tag) == "Zone":
                    zones.append(
                        {
                            "name": (zone.get("name") or "").strip(),
                            "path": zone.get("path"),
                            "locationFormat": zone.get("locationFormat"),
                        }
                    )
            zones_by_map[map_name] = zones

    card_slots = []
    for elem in root.iter():
        if strip_ns(elem.tag) != "CardSlot":
            continue
        raw = text_of(elem)
        match = re.search(r"piece;;;([^;]+);", raw)
        card_slots.append(
            {
                "entryName": elem.get("entryName"),
                "image": match.group(1) if match else None,
                "gpid": elem.get("gpid"),
            }
        )

    piece_slots = []
    for elem in root.iter():
        if strip_ns(elem.tag) != "PieceSlot":
            continue
        raw = text_of(elem)
        match = re.search(r"piece;;;([^;]+);", raw)
        piece_slots.append(
            {
                "entryName": elem.get("entryName"),
                "image": match.group(1) if match else None,
                "gpid": elem.get("gpid"),
            }
        )

    draw_piles = []
    for elem in root.iter():
        if strip_ns(elem.tag) != "DrawPile":
            continue
        draw_piles.append(
            {
                "name": elem.get("name"),
                "owningBoard": elem.get("owningBoard"),
                "x": elem.get("x"),
                "y": elem.get("y"),
                "deckOwners": elem.get("deckOwners"),
            }
        )

    module_data = {}
    moduledata_path = module_dir / "moduledata"
    if moduledata_path.exists():
        md = ET.parse(moduledata_path).getroot()
        module_data = {strip_ns(child.tag): (child.text or "") for child in md}

    scenarios = []
    for entry in root.iter():
        if strip_ns(entry.tag) == "GlobalProperty":
            scenarios.append(entry.attrib)

    used_images = sorted(
        {
            *[b["image"] for b in boards if b.get("image")],
            *[c["image"] for c in card_slots if c.get("image")],
            *[p["image"] for p in piece_slots if p.get("image")],
        }
    )

    return {
        "module": {
            "name": root.get("name"),
            "version": root.get("version"),
            "vassalVersion": root.get("VassalVersion"),
            "description": root.get("description"),
            "moduledata": module_data,
        },
        "maps": maps,
        "boards": boards,
        "zones": zones_by_map,
        "cardSlots": card_slots,
        "pieceSlots": piece_slots,
        "drawPiles": draw_piles,
        "usedImages": used_images,
    }


def decode_saved_game(path: Path) -> str:
    """Decode VASSAL's ``!VCSK`` saved-game envelope.

    A ``.vsav`` is a zip archive whose ``savedGame`` entry carries the encoded
    command stream.  VASSAL XORs the hex-encoded payload with 0xCC.  The
    result is not XML but VASSAL's own command serialization; it is parsed with
    regexes below.
    """
    with zipfile.ZipFile(path) as archive:
        raw = archive.read("savedGame").decode("latin-1").strip()
    if not raw.startswith("!VCSK"):
        raise ValueError("not a VASSAL saved game")
    payload = raw[5:]
    data = bytes(int(payload[i : i + 2], 16) ^ 0xCC for i in range(0, len(payload), 2))
    return data.decode("latin-1")


def parse_saved_pieces(text: str) -> list[dict]:
    pieces = []
    seen = set()
    for match in re.finditer(r"piece;;;([^;]*);([^;\\\t\x1b]*)", text):
        image, name = match.group(1), match.group(2)
        tail = text[match.end() : match.end() + 1600]
        loc = re.search(
            r"(?:^|\\)\t([^;\\\t\x1b]+);(-?\d+);(-?\d+);(-?\d+);(-?\d+)", tail
        )
        zone = re.search(r"OldZone;([^;\\\t\x1b]*)", tail)
        record = {
            "name": name,
            "image": image,
            "board": loc.group(1) if loc else None,
            "x": int(loc.group(2)) if loc else None,
            "y": int(loc.group(3)) if loc else None,
            "zone": (zone.group(1) if zone else None) or None,
        }
        key = (record["name"], record["image"], record["board"], record["x"], record["y"], record["zone"])
        if key in seen:
            continue
        seen.add(key)
        pieces.append(record)
    return pieces


@dataclass
class Asset:
    kind: str
    id: str
    original: str
    published: str
    checksum: str
    bytes: int
    width: int | None
    height: int | None
    source: str
    note: str | None = None


def sanitize(name: str) -> str:
    name = name.replace(" ", "-").replace("'", "").replace("&", "and")
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name)
    return re.sub(r"-+", "-", name)


def card_asset_plan(module: dict) -> list[tuple[str, str, str, str]]:
    """Return (kind, id, original image, published relative path)."""
    plan: list[tuple[str, str, str, str]] = []
    for slot in module["cardSlots"]:
        image = slot.get("image")
        if not image or image in PROMO_CARD_IMAGES:
            continue
        entry = slot.get("entryName") or ""
        action = re.fullmatch(r"Action Card (\d+)_result\.jpg", image)
        home = re.fullmatch(r"Home Card (\d+) (\w+)\.png", image)
        gw = re.fullmatch(r"Great War Card (\d+)\.png", image)
        goal = re.fullmatch(r"Card (\w+) Objective (\d+)\.png", image)
        if action:
            number = int(action.group(1))
            if number == 21:
                # Slot 21 is a duplicate of card 27; the real card 21 has no
                # face image in the archive and is rendered as a text card.
                continue
            if number == 81 and entry == "Wilhelm II":
                # The archived module points Wilhelm II at card 81's image;
                # the reconstruction is card 82 and has no face image.
                continue
            plan.append(("action", f"{number:03d}", image, f"cards/action-{number:03d}.jpg"))
        elif home:
            number = int(home.group(1))
            power = home.group(2)
            plan.append(("home", f"{power}-{number:02d}", image, f"cards/home-{power}-{number:02d}.png"))
        elif gw:
            number = int(gw.group(1))
            plan.append(("greatwar", f"{number:02d}", image, f"cards/great-war-{number:02d}.png"))
        elif goal:
            power, number = goal.group(1), int(goal.group(2))
            plan.append(("goal", f"{power}-{number:02d}", image, f"cards/goal-{power}-{number:02d}.png"))
    return plan


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vmod", type=Path, default=DEFAULT_VMOD)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.check:
        return check_manifest()

    if not args.vmod.exists():
        print(f"error: module not found: {args.vmod}", file=sys.stderr)
        return 2

    if PUBLIC_DIR.exists():
        shutil.rmtree(PUBLIC_DIR)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="ie-vmod-") as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(args.vmod) as archive:
            archive.extractall(tmp_path)

        module = parse_module(tmp_path / "buildFile.xml", tmp_path)
        module["module"]["sourceFile"] = args.vmod.name
        module["module"]["sourceSha256"] = sha256(args.vmod)
        module["module"]["sourceBytes"] = args.vmod.stat().st_size

        # Campaign saved game (authoritative module cross-check for setup).
        saved = {}
        vsav = tmp_path / "campaign-setup.vsav"
        if vsav.exists():
            saved_text = decode_saved_game(vsav)
            saved = {
                "file": "campaign-setup.vsav",
                "sha256": sha256(vsav),
                "pieces": parse_saved_pieces(saved_text),
            }

        # ------------------------------------------------------------------
        # Publish images.
        # ------------------------------------------------------------------
        assets: list[Asset] = []
        plan_seen: list[tuple[str, str, str, str]] = []
        image_dir = tmp_path / "images"

        def publish(kind: str, ident: str, original: str, published: str, source: str, note: str | None = None) -> None:
            src = image_dir / original
            if not src.exists():
                raise FileNotFoundError(f"module image missing: {original}")
            dest = PUBLIC_DIR / published
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
            width, height = image_size(dest)
            assets.append(
                Asset(
                    kind=kind,
                    id=ident,
                    original=f"images/{original}",
                    published=published,
                    checksum=sha256(dest),
                    bytes=dest.stat().st_size,
                    width=width,
                    height=height,
                    source=source,
                    note=note,
                )
            )

        for ident, image in MAP_BOARDS.items():
            publish("map", ident, image, f"maps/{ident}{Path(image).suffix.lower()}", "buildFile.xml board image")
        for power, image in DISPLAY_BOARDS.items():
            note = "module configuration selects the PNG UK display" if power == "UK" else None
            publish("display", power, image, f"displays/{power}{Path(image).suffix.lower()}", "buildFile.xml board image", note)
        for ident, image in REFERENCE_BOARDS.items():
            publish("chart", ident, image, f"charts/{ident}{Path(image).suffix.lower()}", "buildFile.xml board image")

        for kind, ident, image, published in card_asset_plan(module):
            if published in {p[3] for p in plan_seen}:
                continue
            plan_seen.append((kind, ident, image, published))
            publish(kind, ident, image, published, "buildFile.xml CardSlot")

        # Card backs (one per deck) are useful for face-down hands.
        for kind, ident, image, published in [
            ("back", "action", "Action Card Back.png", "cards/back-action.png"),
            ("back", "greatwar", "Great War Card Back.png", "cards/back-great-war.png"),
            ("back", "goal", "Card GE Objective Back.png", "cards/back-goal.png"),
            ("back", "home", "Home Card AU Back.png", "cards/back-home.png"),
        ]:
            publish(kind, ident, image, published, "buildFile.xml card art")

        # Counters: every image referenced by a PieceSlot that is not a card,
        # board or chart.  These are exactly the counters the module makes
        # available to players.
        non_counter = {
            *MAP_BOARDS.values(),
            *DISPLAY_BOARDS.values(),
            *REFERENCE_BOARDS.values(),
            *[p[2] for p in card_asset_plan(module)],
            "Action Card Back.png",
            "Great War Card Back.png",
            "Card GE Objective Back.png",
            "Home Card AU Back.png",
            "Card Deck Map.jpg",
            "Map Card Deck.jpg",
            *PROMO_CARD_IMAGES,
        }
        counter_images = sorted(
            {p["image"] for p in module["pieceSlots"] if p.get("image") and p["image"] not in non_counter}
        )
        used_counter_paths: dict[str, str] = {}
        for image in counter_images:
            published = f"counters/{sanitize(image)}"
            if published in used_counter_paths and used_counter_paths[published] != image:
                # "Card +1.png" and "Card -1.png" both sanitise to Card-1.png;
                # keep both counters uniquely addressable.
                suffix = hashlib.sha1(image.encode("utf-8")).hexdigest()[:8]
                stem = Path(published).stem
                published = f"counters/{stem}-{suffix}{Path(published).suffix}"
            used_counter_paths[published] = image
            publish("counter", sanitize(Path(image).stem), image, published, "buildFile.xml PieceSlot")

        # ------------------------------------------------------------------
        # Manifest.
        # ------------------------------------------------------------------
        manifest = {
            "game": "Imperial Elegy",
            "module": module["module"],
            "generatedAt": "reproducible; timestamps intentionally omitted",
            "generator": "scripts/extract-imperial-elegy.py",
            "notes": [
                "Card face OCR is advisory only; transcribed text lives in src/imperialElegy/constant/cards.ts.",
                "Two cards have no face image in the archive (Wilhelm II #82 and French goal #22) and are rendered as text cards.",
                "Promotional cards P1-P3 and bot charts are not published (deferred features).",
            ],
            "counts": {
                "maps": sum(a.kind == "map" for a in assets),
                "displays": sum(a.kind == "display" for a in assets),
                "charts": sum(a.kind == "chart" for a in assets),
                "actionCards": sum(a.kind == "action" for a in assets),
                "homeCards": sum(a.kind == "home" for a in assets),
                "greatWarCards": sum(a.kind == "greatwar" for a in assets),
                "goals": sum(a.kind == "goal" for a in assets),
                "backs": sum(a.kind == "back" for a in assets),
                "counters": sum(a.kind == "counter" for a in assets),
            },
            "assets": [a.__dict__ for a in assets],
        }
        (PUBLIC_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

        # ------------------------------------------------------------------
        # Generated metadata for data validation.
        # ------------------------------------------------------------------
        module_out = {
            "module": module["module"],
            "maps": module["maps"],
            "boards": module["boards"],
            "zones": module["zones"],
            "cardSlots": module["cardSlots"],
            "drawPiles": module["drawPiles"],
            "usedImages": module["usedImages"],
        }
        (GENERATED_DIR / "module.json").write_text(json.dumps(module_out, indent=2) + "\n", encoding="utf-8")
        (GENERATED_DIR / "campaign-setup.json").write_text(json.dumps(saved, indent=2) + "\n", encoding="utf-8")

        cards_by_deck: dict[str, list[dict]] = {}
        for piece in saved.get("pieces", []):
            if piece.get("board") != "Play Decks" or piece.get("y") is None:
                continue
            if piece["y"] > 600:
                continue
            x = piece["x"]
            decade = {225: "greatwar", 525: "1870s", 825: "1880s", 1125: "1890s", 1425: "1900s"}.get(x)
            if decade is None:
                continue
            cards_by_deck.setdefault(decade, []).append(piece["name"])
        (GENERATED_DIR / "deck-entry.json").write_text(
            json.dumps(cards_by_deck, indent=2) + "\n", encoding="utf-8"
        )

    print(f"published {len(assets)} assets to {PUBLIC_DIR}")
    print(f"module metadata: {GENERATED_DIR / 'module.json'}")
    print(f"campaign setup:  {GENERATED_DIR / 'campaign-setup.json'}")
    print(f"deck entries:    {GENERATED_DIR / 'deck-entry.json'}")
    return 0


def check_manifest() -> int:
    manifest_path = PUBLIC_DIR / "manifest.json"
    if not manifest_path.exists():
        print("error: manifest missing; run the extraction first", file=sys.stderr)
        return 2
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures = 0
    for asset in manifest["assets"]:
        path = PUBLIC_DIR / asset["published"]
        if not path.exists():
            print(f"missing: {asset['published']}")
            failures += 1
            continue
        digest = sha256(path)
        if digest != asset["checksum"]:
            print(f"checksum mismatch: {asset['published']}")
            failures += 1
    if failures:
        print(f"{failures} asset problem(s)")
        return 1
    print(f"verified {len(manifest['assets'])} assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
