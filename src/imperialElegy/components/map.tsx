import React from "react";
import {ConnectionDef, ImperialElegyState, Power, SpaceDef, SpaceId, Unit} from "../types";
import {CONNECTIONS, SPACES, SPACE_IDS, connectionsOf, isNavalBox} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {ieT} from "./i18n";
import background from "../data/map-background.json";
import {CONNECTION_STYLE, connectionDash, connectionWidth, trimSegment} from "./connectionStyle";
import {flashpointHulls} from "./flashpoints";
import {Anchor} from "./Anchor";
import {BOARD_FONT, capitalStar, Flag, largeFlagName, PrintedNameplate, smallFlagName} from "./printedStyle";
import {UnitToken} from "./UnitToken";
import {StackPopover} from "./StackPopover";
import {type StackEntry, stackSummary} from "./stackSummary";
import {bi} from "./boardHelpers";
import {
  DRAG_THRESHOLD_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  MapView,
  centreOn,
  clampView,
  MarkerPoint,
  Theatre,
  hitRadiusUnits,
  markerTier,
  nearestCandidate,
  placeLabels,
  shrinkMarkers,
  theatreById,
  theatreOf,
  toBoardPoint,
  unitsPerPixel,
  viewForPoints,
  viewForTheatre,
  zoomAt,
} from "./map-geometry";

/**
 * The printed paper, not the photographed table: the SVG's viewBox is exactly
 * this rectangle, so the board fills the panel instead of floating in a dark
 * letterbox.  Space coordinates are unchanged (they are in the same space).
 */
const PAPER = {
  x: background.paper[0],
  y: background.paper[1],
  width: background.paper[2] - background.paper[0],
  height: background.paper[3] - background.paper[1],
};
const BOARD = PAPER;

/** Printed space-marker size, in board units (taken from the printed counters). */
const markerRadius = (id: SpaceId): number => (isNavalBox(id) ? 104 : SPACES[id].type === "territory" ? 62 : 74);

/** How many counters a space paints before the "+N" marker takes over. */
const TOKEN_VISIBLE = 3;

/** Label text size, in *screen* pixels at any zoom (scaled back to board units). */
const LABEL_PX = 12;

const colorFor = (control: string | null): string => {
  if (control === null) return "#8b8b8b";
  if (POWER_DEFS[control as Power]) return POWER_DEFS[control as Power].color;
  return "#7b5aa6";
};

const darkFor = (control: string | null): string => {
  if (control === null) return "#4a4a4a";
  if (POWER_DEFS[control as Power]) return POWER_DEFS[control as Power].dark;
  return "#4f396e";
};

/**
 * A legal target's ring: shape and colour carry the meaning (the printed key's
 * move / attack / rail / choice vocabulary), so a colour-blind player reads
 * the difference from the dash pattern and the tick marks alone.
 */
const TARGET_RING: Record<MapTargetStyle, {
  stroke: string;
  dash: string | null;
  ticks: "crosshair" | "rail" | "pip" | null;
  double: boolean;
}> = {
  move: {stroke: "#3f9d8f", dash: "2.4 1.6", ticks: null, double: false},
  attack: {stroke: "#d0452f", dash: null, ticks: "crosshair", double: false},
  rail: {stroke: "#3f9d8f", dash: null, ticks: "rail", double: false},
  choice: {stroke: "#e0b83a", dash: null, ticks: "pip", double: true},
  pending: {stroke: "#e0b83a", dash: null, ticks: null, double: true},
};

/** One ring around a target.  `u` converts screen pixels to board units. */
const TargetRing = ({
  ring, r, u, focused, pending,
}: {ring: typeof TARGET_RING[MapTargetStyle]; r: number; u: number; focused: boolean; pending: boolean}) => {
  const radius = r + u * (focused ? 14 : 10);
  const width = u * (focused ? 4 : 3);
  return (
    <g className={`ie-target-ring ie-target-${pending ? "pending" : ring.ticks ?? "plain"}`} pointerEvents="none">
      <circle r={radius} fill="none" stroke={ring.stroke} strokeWidth={width}
        strokeDasharray={ring.dash === null ? undefined : `${Number(ring.dash.split(" ")[0]) * u * 4} ${Number(ring.dash.split(" ")[1]) * u * 4}`}/>
      {ring.double && <circle r={radius + width * 2} fill="none" stroke={ring.stroke} strokeWidth={width * 0.6}/>}
      {ring.ticks === "crosshair" && [0, 90, 180, 270].map((angle) => (
        <line key={angle} x1={Math.cos((angle * Math.PI) / 180) * radius} y1={Math.sin((angle * Math.PI) / 180) * radius}
          x2={Math.cos((angle * Math.PI) / 180) * (radius + width * 4)} y2={Math.sin((angle * Math.PI) / 180) * (radius + width * 4)}
          stroke={ring.stroke} strokeWidth={width}/>
      ))}
      {ring.ticks === "rail" && [0, 90, 180, 270].map((angle) => (
        <line key={angle} x1={Math.cos((angle * Math.PI) / 180) * radius} y1={Math.sin((angle * Math.PI) / 180) * radius}
          x2={Math.cos((angle * Math.PI) / 180) * (radius + width * 3)} y2={Math.sin((angle * Math.PI) / 180) * (radius + width * 3)}
          stroke={ring.stroke} strokeWidth={width * 1.6}/>
      ))}
      {ring.ticks === "pip" && <circle cx={radius} cy={0} r={width * 2} fill={ring.stroke}/>}
      {focused && <circle r={radius + width * 5} fill="none" stroke="#fff4cf" strokeWidth={width * 0.8}/>}
    </g>
  );
};

/** The counter outline, shared by the printed edge and its coloured face. */
const MarkerShape = ({type, r}: {type: SpaceDef["type"]; r: number}) => {
  switch (type) {
    case "capital":
    case "subcapital":
      return <polygon points={capitalStar(r)}/>;
    case "navalBase":
      return <polygon points={`0,${-r} ${r * 0.92},${r * 0.74} ${-r * 0.92},${r * 0.74}`}/>;
    case "territory":
      return <circle r={r}/>;
    default:
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.21}/>;
  }
};

/**
 * A naval box as it is printed: a cream plate with a blue title band and an
 * anchor, not a coloured game counter.  The interactive hit target stays at
 * the box's centre, so the plate can grow without changing the map geometry.
 */
const NavalPlateMarker = ({r, label}: {r: number; label: string}) => {
  const width = r * 3;
  const height = r * 1.6;
  const header = r * 0.52;
  const fontSize = Math.min(r * 0.28, (width - 22) / Math.max(6, label.length * 0.92));
  return (
    <g data-testid="ie-naval-plate">
      <rect x={-width / 2 + 4} y={-height / 2 + 4} width={width} height={height} rx={6}
        fill="rgba(44,36,26,.24)"/>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={5}
        fill="#f8f1df" stroke="#4a3e2c" strokeWidth={3}/>
      <rect x={-width / 2 + 6} y={-height / 2 + 6} width={width - 12} height={header}
        fill="#3d6d8a" stroke="#4a3e2c" strokeWidth={2}/>
      <text x={0} y={-height / 2 + header * 0.7} textAnchor="middle" fontFamily={BOARD_FONT}
        fontSize={fontSize} fontWeight={700} fill="#252019">{label}</text>
      <g transform={`translate(0 ${header * 0.1})`}>
        <Anchor size={r * 0.46} color="#3d6d8a"/>
      </g>
    </g>
  );
};

/**
 * What clicking a space would do, as the map draws it:
 * `move` a dashed teal ring, `attack` a red ring with crosshair ticks,
 * `rail` a teal ring with a rail tick (Great War rail but not march),
 * `choice` a gold double ring with a pip (the target of an extra option),
 * `pending` a gold double ring (a decision waits on that space).
 */
export type MapTargetStyle = "move" | "attack" | "rail" | "choice" | "pending";

/** One legal target: its space and the ring the map draws for it. */
export interface MapTarget {
  id: SpaceId;
  style: MapTargetStyle;
}

/**
 * A framing request from the map's own controls (the theatre chips, "fit", or
 * the player's capital).  `nonce` makes a repeat press re-apply the same
 * framing after the player has panned away.
 */
export interface MapFrameRequest {
  kind: "theatre" | "capital" | "fit";
  /** Required for `theatre`. */
  theatre?: string;
  /** Required for `capital`. */
  space?: SpaceId;
  nonce: number;
}

export interface IEMapProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  onSelect: (id: SpaceId) => void;
  /** Every legal target with the ring that explains it. */
  targets?: MapTarget[];
  locale: "en" | "zh_CN";
  /** Board point to bring into view when it changes (used by the space search). */
  focus?: {x: number; y: number; k?: number; nonce: number} | null;
  /** The legal target the turn panel is pointing at (a Great War battle row). */
  emphasis?: SpaceId | null;
  /** Called when the map's own keyboard focus moves to another legal target. */
  onFocusTarget?: (id: SpaceId) => void;
  /** A framing request from the map's controls (chips, fit, capital). */
  frame?: MapFrameRequest | null;
  /** The seat whose capital the map opens on. */
  homeCapital?: SpaceId | null;
}

/**
 * The printed board, drawn as vectors.
 *
 * The terrain comes from `data/map-background.json` — the printed coastlines
 * traced once into SVG paths, so the map is sharp at any zoom and weighs tens
 * of KB instead of the 15 MB scan.  Markers, connections and names are drawn
 * live from game state.
 *
 * Interaction is screen-pixel based: the clickable area of a space is at least
 * ~14 CSS px across at any zoom, and the nearest marker to the pointer wins, so
 * a click in dense Europe selects what the player aimed at rather than whatever
 * happens to be painted on top.
 */
export const IEMap = React.memo(
  ({G, selected, onSelect, targets = [], locale, focus = null, emphasis = null, onFocusTarget = undefined,
    frame = null, homeCapital = null}: IEMapProps) => {
    const t = ieT();
    const [view, setView] = React.useState<MapView>({k: MIN_ZOOM, x: 0, y: 0});
    /** The size the map was last framed for; null until the first measurement. */
    const framedFor = React.useRef<number | null>(null);
    const [size, setSize] = React.useState({width: 960, height: 600});
    const [dragging, setDragging] = React.useState(false);
    const svgRef = React.useRef<SVGSVGElement | null>(null);
    const pointers = React.useRef(new Map<number, {x: number; y: number}>());
    const press = React.useRef<{x: number; y: number; view: MapView; moved: boolean} | null>(null);
    const coarse = React.useRef(false);

    // Stack tokens and their popover.  `hovered` marks the space whose stack
    // the pointer (or keyboard focus) is on, `stackOpen` pins the popover open
    // after a click on the "+N" marker, and `popoverAt` is a board point in
    // screen pixels to anchor the card near that space.
    const [hovered, setHovered] = React.useState<SpaceId | null>(null);
    const [stackOpen, setStackOpen] = React.useState(false);
    const [popoverAt, setPopoverAt] = React.useState<{left: number; top: number} | null>(null);
    const pointerInside = React.useRef(false);

    const unitIndex = React.useMemo(() => {
      const index = new Map<SpaceId, StackEntry[]>();
      const all = Object.values(G.units ?? {}) as Unit[];
      for (const id of SPACE_IDS) {
        const stack = stackSummary(all, id);
        if (stack.length > 0) index.set(id, stack);
      }
      return index;
    }, [G.units]);

    const stackTotal = React.useCallback(
      (id: SpaceId) => (unitIndex.get(id) ?? []).reduce((sum, entry) => sum + entry.count, 0),
      [unitIndex],
    );
    const hoverStack = hovered !== null && stackTotal(hovered) > TOKEN_VISIBLE ? hovered : null;
    const stackPopoverFor = hoverStack ?? (stackOpen ? hovered ?? selected : null);

    /** Screen point of a board point, reproducing the SVG's letterboxed fit. */
    const screenPoint = React.useCallback((x: number, y: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const fit = Math.min(rect.width / BOARD.width, rect.height / BOARD.height);
      const offsetX = (rect.width - BOARD.width * fit) / 2;
      const offsetY = (rect.height - BOARD.height * fit) / 2;
      return {
        left: offsetX + (x * view.k + view.x - BOARD.x) * fit,
        top: offsetY + (y * view.k + view.y - BOARD.y) * fit,
      };
    }, [view]);

    const closeStack = React.useCallback(() => setStackOpen(false), []);

    const openStackAt = React.useCallback((id: SpaceId) => {
      const space = SPACES[id];
      const point = space ? screenPoint(space.x, space.y) : null;
      setHovered(id);
      setStackOpen(true);
      if (point) setPopoverAt({left: point.left + 16, top: point.top + 16});
    }, [screenPoint]);

    /** Apply a framing request against a measured viewport. */
    const applyFrame = React.useCallback((request: MapFrameRequest, viewport: {width: number; height: number}) => {
      if (request.kind === "fit") return setView({k: MIN_ZOOM, x: 0, y: 0});
      if (request.kind === "capital") {
        const pioneer = request.space ?? homeCapital;
        if (!pioneer) return setView({k: MIN_ZOOM, x: 0, y: 0});
        const space = SPACES[pioneer];
        // A capital is framed by its theatre, not by a fixed zoom: the view has
        // to hold its neighbours (where the fighting starts) and little else.
        if (space) setView(viewForTheatre(theatreOf(space), BOARD, viewport));
        return;
      }
      const theatre: Theatre | undefined = request.theatre ? theatreById(request.theatre) : undefined;
      setView(theatre ? viewForTheatre(theatre, BOARD, viewport) : {k: MIN_ZOOM, x: 0, y: 0});
    }, [homeCapital]);

    // Track the element's rendered size: hit radii and label density depend on
    // how many pixels a board unit actually occupies.
    React.useEffect(() => {
      const node = svgRef.current;
      if (!node || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver((entries) => {
        const box = entries[0]?.contentRect;
        if (box && box.width > 0 && box.height > 0) setSize({width: box.width, height: box.height});
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    // Markers whose printed radius would overlap a neighbour are shrunk to just
    // under half the gap: South Africa and Rhodesia are 138 board units apart,
    // which is 8 screen pixels at fit zoom on a phone, so their counters used
    // to merge into one blob and a tap could not say which was meant.
    const markerRadii = React.useMemo(() => {
      const points: MarkerPoint[] = SPACE_IDS.flatMap((id) => {
        const space = SPACES[id];
        if (!space || !G.spaces[id]) return [];
        return [{id, x: space.x, y: space.y, radius: markerRadius(id)}];
      });
      return shrinkMarkers(points);
    }, [G.spaces]);

    const radiusOf = React.useCallback(
      (id: SpaceId) => markerRadii.get(id) ?? markerRadius(id),
      [markerRadii],
    );

    // The first frame waits for a real measurement: the panel's size is unknown
    // during the first render, and framing against the 960x600 default would
    // centre the capital off screen.
    React.useEffect(() => {
      if (size.width <= 0 || size.height <= 0) return;
      const signature = size.width * 10000 + size.height;
      if (framedFor.current === signature) return;
      framedFor.current = signature;
      applyFrame({kind: "capital", space: homeCapital ?? undefined, nonce: 0}, size);
    }, [size, homeCapital, applyFrame]);

    // Explicit requests (a chip, the "fit" button) re-apply at the same size.
    React.useEffect(() => {
      if (!frame) return;
      applyFrame(frame, size);
    }, [frame, size, applyFrame]);

    React.useEffect(() => {
      if (!focus) return;
      setView(centreOn({x: focus.x, y: focus.y}, focus.k ?? 3.2, BOARD));
    }, [focus]);

    const label = React.useCallback(
      (id: SpaceId) => (locale === "zh_CN" ? SPACES[id].nameZh : SPACES[id].name),
      [locale],
    );

    const styleOf = React.useMemo(() => {
      const map = new Map<SpaceId, NonNullable<MapTargetStyle>>();
      for (const target of targets) map.set(target.id, target.style);
      return map;
    }, [targets]);
    const highlight = styleOf;

    // Zoom with the wheel.  React attaches wheel listeners passively at the
    // root, so `preventDefault` there is ignored (the page scrolls instead);
    // owning the listener lets the map keep the gesture.
    React.useEffect(() => {
      const node = svgRef.current;
      if (!node) return;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = node.getBoundingClientRect();
        setView((current) => {
          const anchor = toBoardPoint({x: event.clientX, y: event.clientY}, rect, BOARD, current);
          return zoomAt(current, event.deltaY < 0 ? 1.2 : 1 / 1.2, anchor, BOARD);
        });
      };
      node.addEventListener("wheel", onWheel, {passive: false});
      return () => node.removeEventListener("wheel", onWheel);
    }, []);

    const zoom = (factor: number, anchor = {x: PAPER.x + BOARD.width / 2, y: PAPER.y + BOARD.height / 2}) =>
      setView((current) => zoomAt(current, factor, anchor, BOARD));

    const onPointerDown = (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      coarse.current = event.pointerType === "touch" || event.pointerType === "pen";
      pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (pointers.current.size === 1) {
        press.current = {x: event.clientX, y: event.clientY, view, moved: false};
        setDragging(true);
      } else {
        // A second finger starts a pinch, never a click.
        if (press.current) press.current.moved = true;
      }
    };

    const onPointerMove = (event: React.PointerEvent) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const current = {x: event.clientX, y: event.clientY};

      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId);
      if (other) {
        // Pinch: scale about the midpoint of the two fingers.
        const [, second] = other;
        const before = Math.hypot(previous.x - second.x, previous.y - second.y);
        const after = Math.hypot(current.x - second.x, current.y - second.y);
        if (before > 0 && after > 0) {
          const mid = toBoardPoint(
            {x: (previous.x + second.x) / 2, y: (previous.y + second.y) / 2},
            rect, BOARD, view,
          );
          setView((v) => zoomAt(v, after / before, mid, BOARD));
        }
        pointers.current.set(event.pointerId, current);
        return;
      }

      const started = press.current;
      if (!started) return;
      const travel = Math.abs(current.x - started.x) + Math.abs(current.y - started.y);
      if (!started.moved && travel < DRAG_THRESHOLD_PX) return;
      started.moved = true;
      const fit = Math.min(rect.width / BOARD.width, rect.height / BOARD.height);
      setView(clampView({
        k: started.view.k,
        x: started.view.x + (current.x - started.x) / fit,
        y: started.view.y + (current.y - started.y) / fit,
      }, BOARD));
      pointers.current.set(event.pointerId, current);
    };

    const endPress = (event: React.PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        setDragging(false);
        // Keep the press record until the click fires so a pointerup after a
        // drag does not turn into a selection.
        const started = press.current;
        if (started) setTimeout(() => { if (press.current === started) press.current = null; }, 0);
      }
    };

    const onClick = (event: React.MouseEvent) => {
      const started = press.current;
      if (started?.moved) return;
      press.current = null;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = toBoardPoint({x: event.clientX, y: event.clientY}, rect, BOARD, view);
      const radius = hitRadiusUnits(size, BOARD, view.k, coarse.current);
      const candidates = SPACE_IDS.filter((id) => G.spaces[id]).map((id) => ({
        id,
        x: SPACES[id].x,
        y: SPACES[id].y,
        // A legal target wins a tie against a neighbour the player cannot use.
        weight: highlight.has(id) ? radius * 0.25 : 0,
      }));
      const hit = nearestCandidate(point, candidates, radius);
      if (hit) onSelect(hit.id as SpaceId);
    };

    // Keyboard: the legal targets form one roving group.  Focus moves with
    // the arrow keys and Enter activates the focused target exactly as a
    // click would (same `onSelect`), so the map is usable without a pointer.
    const targetIds = React.useMemo(() => targets.map((target) => target.id), [targets]);
    const [kbFocus, setKbFocus] = React.useState<SpaceId | null>(null);
    const focusedTarget = emphasis ?? (kbFocus !== null && styleOf.has(kbFocus) ? kbFocus : null);
    const moveKb = (delta: number, absolute?: number) => {
      if (targetIds.length === 0) return;
      const index = focusedTarget === null ? -1 : targetIds.indexOf(focusedTarget);
      const nextIndex = absolute !== undefined
        ? absolute
        : index < 0 ? (delta > 0 ? 0 : targetIds.length - 1) : (index + delta + targetIds.length) % targetIds.length;
      const next = targetIds[nextIndex];
      if (next === undefined) return;
      setKbFocus(next);
      onFocusTarget?.(next);
      const space = SPACES[next];
      if (space) setView((current) => centreOn({x: space.x, y: space.y}, current.k, BOARD));
      window.setTimeout(() => svgRef.current?.focus(), 0);
    };
    const onMapKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (targetIds.length === 0) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          moveKb(1);
          return;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          moveKb(-1);
          return;
        case "Home":
          event.preventDefault();
          moveKb(0, 0);
          return;
        case "End":
          event.preventDefault();
          moveKb(0, targetIds.length - 1);
          return;
        case "Enter":
        case " ":
          if (focusedTarget !== null) {
            event.preventDefault();
            onSelect(focusedTarget);
          }
          return;
        default:
          return;
      }
    };

    const unitsPerPx = unitsPerPixel(size, BOARD, view.k);
    const labelSize = LABEL_PX * unitsPerPx;
    // The board's detail level, taken from a typical land marker.  It must be
    // decided in *screen pixels*: the same zoom is comfortable on a desktop and
    // four pixels wide on a phone, where a shape outline, a unit token and a
    // port anchor are all indistinguishable noise.
    const detail = markerTier(74 / unitsPerPx);
    const showNetwork = detail === "full";

    // Printed regional shading.  The board hatches its flashpoint theatres
    // (Central Europe, the Balkans, Italy, Africa, the Great Game, China–Japan)
    // and colours them by the alliance that contests them; the hull of each
    // region's member spaces gives the same shape from game data.
    const flashpoints = React.useMemo(() => flashpointHulls(80), []);

    const labels = React.useMemo(() => {
      // Names are noise when every one of the 145 shows at once, so they are
      // revealed in layers: occupied spaces and capitals first, then the rest as
      // the player zooms in.
      const showAll = detail === "full";
      const showOccupied = detail !== "dot";
      const requests = SPACE_IDS.flatMap((id) => {
        const space = SPACES[id];
        const state = G.spaces[id];
        if (!space || !state) return [];
        const isSelected = selected === id;
        const isHighlighted = highlight.has(id);
        const wanted =
          isSelected || isHighlighted || showAll ||
          (showOccupied && (space.type === "capital" || space.type === "subcapital" || state.units.length > 0));
        if (!wanted) return [];
        return [{
          id,
          x: space.x,
          y: space.y + radiusOf(id) + labelSize * 1.6,
          text: label(id),
          priority:
            isSelected ? 1000 :
              isHighlighted ? 900 :
                state.units.length > 0 ? 600 :
                  space.type === "capital" || space.type === "subcapital" ? 400 : 100,
        }];
      });
      const always = new Set<string>([...highlight.keys(), ...(selected ? [selected] : [])]);
      // Treat each printed marker as an obstacle: a name placed across a
      // neighbour's counter is unreadable even when it does not touch another
      // name, which is what makes the dense Low Countries legible.
      const obstacles = SPACE_IDS.flatMap((id) => {
        const space = SPACES[id];
        if (!space || !G.spaces[id]) return [];
        const r = radiusOf(id) * 0.85;
        return [{id, x: space.x - r, y: space.y - r, width: r * 2, height: r * 2}];
      });
      // Cap the number of names by zoom: every label at fit zoom is a wall of
      // text, while at 3x the board reads like the printed map.
      const limit = Math.round(14 * Math.pow(view.k, 1.6));
      return new Set(placeLabels(requests, labelSize, {always, limit, obstacles}));
    }, [G.spaces, selected, highlight, label, labelSize, view.k, detail]);

    // The whole printed network is drawn, not only the selected space's links:
    // reading the frontiers is how a player plans a move, and the sea routes
    // (dashed, red) are the only cue for which neighbours are reachable by
    // fleet.  The selected space's own links are then redrawn on top, brighter,
    // so they stand out from the 340-line background.
    const connectionLayer = React.useMemo(() => {
      const draw = (c: ConnectionDef, key: string, emphasis: number) => {
        const a = SPACES[c.a];
        const b = SPACES[c.b];
        if (!a || !b) return null;
        // Stop at the marker edge, like the printed board: a line that runs
        // under a counter reads as a smudge on the counter.
        const trimmed = trimSegment(a, b, radiusOf(c.a) + unitsPerPx, radiusOf(c.b) + unitsPerPx);
        if (!trimmed) return null;
        const style = CONNECTION_STYLE[c.type];
        return (
          <line key={key} x1={trimmed.x1} y1={trimmed.y1} x2={trimmed.x2} y2={trimmed.y2}
            stroke={style.stroke} strokeWidth={connectionWidth(style, unitsPerPx) * emphasis}
            strokeDasharray={connectionDash(style, unitsPerPx)}
            strokeLinecap="butt" strokeDashoffset={0} opacity={emphasis > 1 ? 1 : 0.88} pointerEvents="none"/>
        );
      };
      // Every printed frontier is drawn, the way the board prints it: the land
      // network solid or dashed by terrain, and the sea routes in red.  The
      // selected space's own links are repeated on top, brighter, so the move a
      // player is considering stands out from the 300-line background.
      // 340 frontier lines on a phone are a grey smudge, so the printed network
      // only appears once the board is large enough to read it; the selected
      // space's own links are drawn at every level.
      const land = showNetwork ? CONNECTIONS
        .filter((c) => c.type !== "sea")
        .map((c) => draw(c, `${c.a}-${c.b}`, 1)) : [];
      // Sea routes are lighter and masked to water in the renderer: a route
      // that crossed a continent would read as a land frontier.
      const sea = showNetwork ? CONNECTIONS
        .filter((c) => c.type === "sea")
        .map((c) => {
          const line = draw(c, `sea-${c.a}-${c.b}`, 1);
          return line === null ? null : React.cloneElement(line, {opacity: 0.55});
        }) : [];
      const focused: React.ReactNode[] = [];
      if (selected) {
        for (const c of connectionsOf(selected)) {
          const other = c.a === selected ? c.b : c.a;
          const line = draw({...c, a: selected, b: other}, `focus-${other}`, 1.9);
          if (line !== null) focused.push(React.cloneElement(line, {opacity: 1}));
        }
      }
      return {land, sea, focused};
    }, [selected, unitsPerPx, showNetwork, radiusOf]);

    return (
      <div className="ie-map-wrap"
        onPointerEnter={() => { pointerInside.current = true; }}
        onPointerLeave={() => {
          // Leaving the board closes a hover-opened stack; Escape closes a
          // pinned one (the popover owns that listener).
          pointerInside.current = false;
          setHovered(null);
          setStackOpen(false);
        }}>
        <div className="ie-map-controls">
          <button aria-label={t.zoomIn} title={t.zoomIn} onClick={() => zoom(1.3)}>+</button>
          <button aria-label={t.zoomOut} title={t.zoomOut} onClick={() => zoom(1 / 1.3)}>−</button>
          <button aria-label={t.resetZoom} title={t.resetZoom}
            onClick={() => setView({k: MIN_ZOOM, x: 0, y: 0})}>⟲</button>
          {highlight.size > 0 && (
            <button
              aria-label={t.mapTargets}
              title={t.mapTargets}
              data-testid="ie-map-fit-targets"
              onClick={() => setView(viewForPoints(
                [...highlight.keys()].map((id) => ({x: SPACES[id].x, y: SPACES[id].y})),
                BOARD, size,
              ))}
            >◎</button>
          )}
          {selected && (
            <button
              aria-label={t.mapFocus}
              title={t.mapFocus}
              data-testid="ie-map-focus-selected"
              onClick={() => setView(centreOn({x: SPACES[selected].x, y: SPACES[selected].y}, Math.max(view.k, 2.6), BOARD))}
            >⌖</button>
          )}
        </div>
        <svg
          ref={svgRef}
          className={`ie-map ${dragging ? "dragging" : ""}`}
          viewBox={`${PAPER.x} ${PAPER.y} ${PAPER.width} ${PAPER.height}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onPointerLeave={endPress}
          onClick={onClick}
          onKeyDown={onMapKeyDown}
          // The legal targets are the only focus stop; Tab reaches the map
          // once, and the arrows then walk the rings.
          tabIndex={targetIds.length > 0 ? 0 : -1}
          aria-describedby="ie-map-legend"
          data-testid="ie-map"
          data-k={view.k.toFixed(2)}
          data-detail={detail}
          data-targets={targetIds.join(",")}
          data-focused-target={focusedTarget ?? undefined}
          role="application"
          aria-label={t.map}
        >
          <defs>
            <linearGradient id="ie-sea" gradientUnits="userSpaceOnUse"
              x1={PAPER.x} y1={PAPER.y} x2={PAPER.x + PAPER.width * 0.3} y2={PAPER.y + PAPER.height}>
              <stop offset="0%" stopColor="#bcd2cf"/>
              <stop offset="52%" stopColor="#a2c0c0"/>
              <stop offset="100%" stopColor="#87adb4"/>
            </linearGradient>
            {/* Flashpoint hatching, as printed: a warm diagonal wash over the
                contested theatres.  Pattern units are board units, so the
                stripes keep the printed density as the player zooms. */}
            <pattern id="ie-hachure" width="104" height="104" patternUnits="userSpaceOnUse"
              patternTransform="rotate(34)">
              <rect width="104" height="104" fill="#c98f78" opacity="0.18"/>
              <line x1="0" y1="0" x2="0" y2="104" stroke="#9c4a34" strokeWidth="11" opacity="0.57"/>
            </pattern>
            {/* A light printed graticule, as on the sheet: it gives the land
                some texture at zoom without competing with the counters. */}
            <pattern id="ie-grid" width="590" height="500" patternUnits="userSpaceOnUse">
              <path d="M590,0 H0 V500" fill="none" stroke="#3c7170" strokeWidth="1.8" opacity="0.13"/>
            </pattern>
            <clipPath id="ie-clip-main">
              <rect {...toRect(background.regions.find((r) => r.id === "main")?.box)}/>
            </clipPath>
            {/* Regional shading is clipped to the traced land, so a theatre
                hull never washes over the sea between its member spaces. */}
            <clipPath id="ie-clip-land">
              <path d={background.regions.find((r) => r.id === "main")?.d ?? ""}/>
            </clipPath>
            {/* Sea routes are printed over water only.  Masking them with the
                traced land silhouette keeps a long route from cutting across a
                continent, which is how the printed board reads. */}
            <mask id="ie-water" maskUnits="userSpaceOnUse"
              x={PAPER.x} y={PAPER.y} width={PAPER.width} height={PAPER.height}>
              <rect {...toRect(background.paper)} fill="white"/>
              {background.regions.map((region) => (
                <path key={region.id} d={region.d} fill="black"/>
              ))}
            </mask>
            {background.regions.filter((r) => r.id !== "main").map((region) => (
              <clipPath key={region.id} id={`ie-clip-${region.id}`}>
                <rect {...toRect(region.box)}/>
              </clipPath>
            ))}
          </defs>

          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {/* One board: the Great War is fought on the same printed map
                (its sideboard is a reference chart), so the old separate JPG
                tab is gone. */}
            {(
              <>
                {/* Paper and sea, then the traced coastline of each printed panel. */}
                <rect {...toRect(background.paper)} fill="#efe6d2"/>
                <rect {...toRect(background.paper)} fill="url(#ie-grid)"/>
                {background.regions.map((region) => (
                  <g key={region.id} clipPath={`url(#ie-clip-${region.id})`}>
                    <rect {...toRect(region.box)} fill="url(#ie-sea)"/>
                    <path d={region.d} fill="#ebdfc6" fillRule="evenodd"/>
                    {/* Flashpoint theatres: the board shades them, and the
                        shading is what tells a player which regions are worth
                        contesting. */}
                    {region.id === "main" && (
                      <g pointerEvents="none" clipPath="url(#ie-clip-land)">
                        {flashpoints.map((point) => (
                          <path key={point.id} d={point.d} fill="url(#ie-hachure)"/>
                        ))}
                      </g>
                    )}
                    <path d={region.d} fill="none" stroke="#9f8e73" strokeWidth={unitsPerPx * 1.1}
                      fillRule="evenodd" pointerEvents="none"/>
                  </g>
                ))}
                {/* Printed continent names, as on the board: they orient the
                    eye far faster than the coastlines alone at fit zoom. */}
                <g pointerEvents="none" fill="#a5926f" opacity={0.64}
                  fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" letterSpacing="0.35em">
                  {CONTINENTS.map((continent) => (
                    <text key={continent.name} x={continent.x} y={continent.y}
                      textAnchor="middle" fontSize={continent.size} transform={`rotate(${continent.rotate} ${continent.x} ${continent.y})`}>
                      {continent.name}
                    </text>
                  ))}
                </g>
                <rect {...toRect(background.paper)} fill="none" stroke="#b9a786" strokeWidth={unitsPerPx * 2.2}/>
              </>
            )}

            {(
              <>
                <g mask="url(#ie-water)">{connectionLayer.sea}</g>
                {connectionLayer.land}
                {connectionLayer.focused}
              </>
            )}

            {SPACE_IDS.map((id) => {
              const space = SPACES[id];
              const state = G.spaces[id];
              if (!state) return null;
              const r = radiusOf(id);
              const fill = colorFor(state.control);
              const targetStyle = styleOf.get(id);
              const isHighlighted = targetStyle !== undefined;
              const isSelected = selected === id;
              const ring = targetStyle === undefined ? null : TARGET_RING[targetStyle];
              const stroke = ring !== null ? ring.stroke : isSelected ? "#fff4cf" : darkFor(state.control);
              const strokeWidth = (isHighlighted || isSelected ? 16 : 8) * Math.max(0.5, unitsPerPx * 0.6);
              const units = state.units.length;
              // Naval boxes are wide: the counters fan from the corner of the
              // printed box, the others from the lower-left corner of the
              // marker, clear of the space's name underneath it.
              const tokenEntries = unitIndex.get(id) ?? [];
              // Tokens are drawn in board units, so their on-screen size grows
              // with the zoom.  At 34 px they covered their neighbours' names at
              // the fit zoom; 24 px keeps a readable counter and still leaves
              // the map's labels and the welfare of the space name visible.
              const tokenPx = isNavalBox(id) ? 30 : space.type === "territory" ? 24 : 26;
              const tokenStack = tokenEntries.length === 0 ? null : {
                visible: tokenEntries.slice(0, TOKEN_VISIBLE),
                extra: Math.max(0, tokenEntries.length - TOKEN_VISIBLE),
              };
              const origin = isNavalBox(id)
                ? {x: -r * 0.55, y: 0}
                : {x: -r * 0.72, y: r * 0.72};
              const minority = largeFlagName(space, state.control);
              const small = smallFlagName(space, state.control);
              // The sheet prints a small control strip on a major power's own
              // counter; on the interactive board the larger flag is the cue a
              // player actually reads, so fall back to it when no minority flag
              // is printed.
              const large = minority ?? small;
              const flagPx = r * unitsPerPx;
              const showFlags = detail !== "dot" && flagPx >= 8 && !isNavalBox(id);
              const showLarge = showFlags && large !== null;
              return (
                <g key={id} transform={`translate(${space.x} ${space.y})`}
                  data-testid={`ie-space-${id}`} className="ie-space-hit"
                >
                  {ring !== null && <TargetRing ring={ring} r={r} u={unitsPerPx}
                    focused={focusedTarget === id} pending={targetStyle === "pending"}/>}
                  {detail === "dot" ? (
                    // A marker a few pixels across is a coloured dot: a printed
                    // outline at that size is invisible and only dirties the
                    // board, so the control colour carries the information.
                    <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
                  ) : isNavalBox(id) ? (
                    <NavalPlateMarker r={r} label={label(id)}/>
                  ) : (
                    <>
                      {/* The printed counter is a paper edge under a coloured
                          face.  Drawing the same outline twice is cheaper than
                          a second stroke and keeps the star/triangle/circle
                          geometry exact at every zoom. */}
                      <g fill="#f8f1df" stroke={darkFor(state.control)}
                        strokeWidth={strokeWidth * 1.15} strokeLinejoin="round">
                        <MarkerShape type={space.type} r={r + 5}/>
                      </g>
                      <g fill={fill} stroke={darkFor(state.control)}
                        strokeWidth={strokeWidth * 0.42} strokeLinejoin="round">
                        <MarkerShape type={space.type} r={r}/>
                      </g>
                    </>
                  )}
                  {showLarge && large !== null && (
                    <Flag name={large} x={-r * 0.45} y={-r * 0.3} w={r * 1.08} h={r * 0.68} rotate={-7}/>
                  )}
                  {showFlags && small !== null && !(large === small && showLarge) && (
                    <Flag name={small} x={r * 0.28} y={r * 0.35} w={r * 0.56} h={r * 0.34} rotate={-6}/>
                  )}

                  {/* A port prints an anchor on the board; it is the cue for
                      "a fleet can reach this space" without drawing a red line
                      across the sea for every one of the 120 routes. */}
                  {detail === "full" && space.ports && space.ports.length > 0 && (
                    <g transform={`translate(${-r * 1.25} ${-r * 0.9})`} opacity={0.85}>
                      <Anchor size={unitsPerPx * 8}/>
                    </g>
                  )}
                  {detail === "full" && state.fort && <text y={r + unitsPerPx * 22} textAnchor="middle" fontSize={unitsPerPx * 14} fill="#4a3a22">▲{state.fort.level}</text>}
                  {detail === "full" && state.trench && <text x={-r} y={-r - unitsPerPx * 6} fontSize={unitsPerPx * 13} fill="#8a6a2a">▦</text>}
                  {(detail === "full" || isSelected || isHighlighted) && tokenStack && (
                    // Counter layer: the top of the stack as printed tokens, a
                    // "+N" marker for the rest, and a hover ring on the whole
                    // group.  A click here is the space's own click (the SVG's
                    // `onClick` hit test), so the tokens need no handler of
                    // their own.
                    <g className="ie-map-tokens" data-testid={`ie-tokens-${id}`}
                      data-count={units}
                      data-extra={tokenStack.extra}
                      onPointerEnter={() => { if (!pointerInside.current) setHovered(id); }}
                      onPointerLeave={() => { if (!stackOpen) setHovered(null); }}
                      onFocus={() => setHovered(id)}
                      onBlur={() => { if (!stackOpen) setHovered(null); }}>
                      {hovered === id && (
                        <circle className="ie-map-hover-ring" r={r + unitsPerPx * 8} fill="none"
                          strokeWidth={unitsPerPx * 2.4} pointerEvents="none"/>
                      )}
                      {tokenStack.visible.map((entry, slot) => {
                        const box = unitsPerPx * tokenPx;
                        const step = box * 0.9;
                        return (
                          <g key={`${entry.power}-${entry.kind}-${entry.reduced ? "r" : "f"}`}
                            transform={`translate(${origin.x - slot * step} ${origin.y - slot * step})`}>
                            <UnitToken kind={entry.kind} power={entry.power} reduced={entry.reduced}
                              size={box} locale={locale} decorative
                              testId={`ie-token-${id}-${slot}`}/>
                            {entry.count > 1 && (
                              <text className="ie-token-count" x={box * 0.82} y={box * 0.94}
                                textAnchor="end" fontSize={unitsPerPx * 11} paintOrder="stroke">
                                {entry.count}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      {tokenStack.extra > 0 && (
                        <g role="button" tabIndex={0}
                          className="ie-token-more"
                          aria-label={bi(locale,
                            `Show all ${units} units in this space`,
                            `显示该空间的全部 ${units} 个单位`)}
                          data-testid={`ie-stack-more-${id}`}
                          onClick={(event) => { event.stopPropagation(); openStackAt(id); }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            openStackAt(id);
                          }}>
                          <circle cx={r * 0.95} cy={r * 0.95} r={unitsPerPx * 11}
                            strokeWidth={unitsPerPx * 1.6}/>
                          <text x={r * 0.95} y={r * 0.95 + unitsPerPx * 4.5} textAnchor="middle"
                            fontSize={unitsPerPx * 12} pointerEvents="none">+{tokenStack.extra}</text>
                        </g>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Names sit above every marker: the placement pass already picked
                non-overlapping ones, and keeping them in one layer stops a
                neighbouring counter from covering a name. */}
            <g pointerEvents="none">
              {SPACE_IDS.map((id) => {
                if (!labels.has(id)) return null;
                const space = SPACES[id];
                if (!space) return null;
                const isSelected = selected === id;
                const isHighlighted = highlight.has(id);
                return (
                  <g key={id} data-testid="ie-printed-nameplate"
                    transform={`translate(${space.x} ${space.y + radiusOf(id) + labelSize * 1.45})`}>
                    <PrintedNameplate name={label(id)} y={0} fontSize={labelSize}
                      maxWidth={Math.max(labelSize * 9, 150)} selected={isSelected || isHighlighted}/>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
        {stackPopoverFor !== null && (
          // Card position lives in two CSS custom properties, set from the
          // measured screen point of the space; the stylesheet turns them into
          // `left`/`top` and clamps the card inside the map.
          <div className="ie-stack-popover-anchor" ref={(node) => {
            if (!node) return;
            node.style.setProperty("--ie-stack-left", String(Math.max(8, popoverAt?.left ?? 12)));
            node.style.setProperty("--ie-stack-top", String(Math.max(8, popoverAt?.top ?? 12)));
          }}>
            <StackPopover
              entries={unitIndex.get(stackPopoverFor) ?? []}
              locale={locale}
              open
              onClose={closeStack}
              testId={`ie-stack-popover-${stackPopoverFor}`}
            />
          </div>
        )}
        <div className="ie-map-legend">
          <span>{locale === "zh_CN" ? "滚轮缩放 · 拖动平移 · 点击空间" : "wheel to zoom · drag to pan · click a space"}</span>
          {(["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]).map((p) => (
            <span key={p}><i className={`ie-map-legend-dot ie-map-legend-dot-${p.toLowerCase()}`}/>{t.seats[p]}</span>
          ))}
          <span><i className="ie-map-legend-dot ie-map-legend-dot-neutral"/>{t.neutral}</span>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.G.spaces === next.G.spaces &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect &&
    prev.targets === next.targets &&
    prev.locale === next.locale &&
    prev.focus === next.focus &&
    prev.emphasis === next.emphasis,
);

/** `box` as SVG rect props (x, y, width, height). */
function toRect(box: number[] | undefined) {
  const [x0, y0, x1, y1] = box ?? [PAPER.x, PAPER.y, PAPER.x + PAPER.width, PAPER.y + PAPER.height];
  return {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
}

/**
 * The continents the board names in large letters, and where their names sit.
 * These are printed decoration: they orient the eye at fit zoom, when no space
 * labels are legible yet.
 */
const CONTINENTS = [
  {name: "EUROPE", x: 2450, y: 2450, size: 210, rotate: -6},
  {name: "RUSSIA", x: 4700, y: 900, size: 250, rotate: 0},
  {name: "ASIA", x: 6300, y: 2350, size: 260, rotate: 0},
  {name: "AFRICA", x: 3450, y: 4380, size: 240, rotate: 0},
  {name: "TURKEY", x: 4250, y: 3300, size: 190, rotate: -4},
  {name: "PERSIA", x: 5250, y: 1750, size: 130, rotate: -10},
  {name: "NORTH AMERICA", x: 800, y: 2300, size: 90, rotate: 0},
] as const;
