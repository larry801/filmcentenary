import React from "react";
import {ConnectionDef, ImperialElegyState, Power, SpaceId} from "../types";
import {CONNECTIONS, SPACES, SPACE_IDS, connectionsOf, isNavalBox} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {ieT} from "./i18n";
import background from "../data/map-background.json";
import {CONNECTION_STYLE, connectionDash, connectionWidth, trimSegment} from "./connectionStyle";
import {flashpointHulls} from "./flashpoints";
import {Anchor} from "./Anchor";
import {
  DRAG_THRESHOLD_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  MapView,
  centreOn,
  clampView,
  hitRadiusUnits,
  nearestCandidate,
  placeLabels,
  toBoardPoint,
  unitsPerPixel,
  viewForPoints,
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

const Star = ({r}: {r: number}) => {
  const points = Array.from({length: 10}, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
  }).join(" ");
  return <polygon points={points}/>;
};

const Triangle = ({r}: {r: number}) => (
  <polygon points={`0,${-r} ${r * 0.9},${r * 0.7} ${-r * 0.9},${r * 0.7}`}/>
);

export interface IEMapProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  onSelect: (id: SpaceId) => void;
  legalTargets?: SpaceId[];
  moveTargets?: SpaceId[];
  battleTargets?: SpaceId[];
  locale: "en" | "zh_CN";
  board?: "world" | "greatWar";
  /** Board point to bring into view when it changes (used by the space search). */
  focus?: {x: number; y: number; k?: number; nonce: number} | null;
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
  ({G, selected, onSelect, legalTargets = [], moveTargets = [], battleTargets = [], locale, board = "world", focus = null}: IEMapProps) => {
    const t = ieT();
    const [view, setView] = React.useState<MapView>({k: MIN_ZOOM, x: 0, y: 0});
    const [size, setSize] = React.useState({width: 960, height: 600});
    const [dragging, setDragging] = React.useState(false);
    const svgRef = React.useRef<SVGSVGElement | null>(null);
    const pointers = React.useRef(new Map<number, {x: number; y: number}>());
    const press = React.useRef<{x: number; y: number; view: MapView; moved: boolean} | null>(null);
    const coarse = React.useRef(false);

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

    React.useEffect(() => {
      if (!focus) return;
      setView(centreOn({x: focus.x, y: focus.y}, focus.k ?? 3.2, BOARD));
    }, [focus]);

    const label = React.useCallback(
      (id: SpaceId) => (locale === "zh_CN" ? SPACES[id].nameZh : SPACES[id].name),
      [locale],
    );

    const highlight = React.useMemo(
      () => new Set([...legalTargets, ...moveTargets, ...battleTargets]),
      [legalTargets, moveTargets, battleTargets],
    );

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

    const unitsPerPx = unitsPerPixel(size, BOARD, view.k);
    const labelSize = LABEL_PX * unitsPerPx;

    // Printed regional shading.  The board hatches its flashpoint theatres
    // (Central Europe, the Balkans, Italy, Africa, the Great Game, China–Japan)
    // and colours them by the alliance that contests them; the hull of each
    // region's member spaces gives the same shape from game data.
    const flashpoints = React.useMemo(() => flashpointHulls(80), []);

    const labels = React.useMemo(() => {
      // Names are noise when every one of the 145 shows at once, so they are
      // revealed in layers: occupied spaces and capitals first, then the rest as
      // the player zooms in.
      const showAll = view.k >= 2.2;
      const requests = SPACE_IDS.flatMap((id) => {
        const space = SPACES[id];
        const state = G.spaces[id];
        if (!space || !state) return [];
        const isSelected = selected === id;
        const isHighlighted = highlight.has(id);
        const wanted =
          isSelected || isHighlighted || showAll ||
          space.type === "capital" || space.type === "subcapital" ||
          state.units.length > 0;
        if (!wanted) return [];
        return [{
          id,
          x: space.x,
          y: space.y + markerRadius(id) + labelSize * 1.6,
          text: label(id),
          priority:
            isSelected ? 1000 :
              isHighlighted ? 900 :
                state.units.length > 0 ? 600 :
                  space.type === "capital" || space.type === "subcapital" ? 400 : 100,
        }];
      });
      const always = new Set<string>([...highlight, ...(selected ? [selected] : [])]);
      // Treat each printed marker as an obstacle: a name placed across a
      // neighbour's counter is unreadable even when it does not touch another
      // name, which is what makes the dense Low Countries legible.
      const obstacles = SPACE_IDS.flatMap((id) => {
        const space = SPACES[id];
        if (!space || !G.spaces[id]) return [];
        const r = markerRadius(id) * 0.85;
        return [{id, x: space.x - r, y: space.y - r, width: r * 2, height: r * 2}];
      });
      // Cap the number of names by zoom: every label at fit zoom is a wall of
      // text, while at 3x the board reads like the printed map.
      const limit = Math.round(14 * Math.pow(view.k, 1.6));
      return new Set(placeLabels(requests, labelSize, {always, limit, obstacles}));
    }, [G.spaces, selected, highlight, label, labelSize, view.k]);

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
        const trimmed = trimSegment(a, b, markerRadius(c.a) + unitsPerPx, markerRadius(c.b) + unitsPerPx);
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
      const land = CONNECTIONS
        .filter((c) => c.type !== "sea")
        .map((c) => draw(c, `${c.a}-${c.b}`, 1));
      // Sea routes are lighter and masked to water in the renderer: a route
      // that crossed a continent would read as a land frontier.
      const sea = CONNECTIONS
        .filter((c) => c.type === "sea")
        .map((c) => {
          const line = draw(c, `sea-${c.a}-${c.b}`, 1);
          return line === null ? null : React.cloneElement(line, {opacity: 0.55});
        });
      const focused: React.ReactNode[] = [];
      if (selected) {
        for (const c of connectionsOf(selected)) {
          const other = c.a === selected ? c.b : c.a;
          const line = draw({...c, a: selected, b: other}, `focus-${other}`, 1.9);
          if (line !== null) focused.push(React.cloneElement(line, {opacity: 1}));
        }
      }
      return {land, sea, focused};
    }, [selected, unitsPerPx]);

    return (
      <div className="ie-map-wrap">
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
                [...highlight].map((id) => ({x: SPACES[id].x, y: SPACES[id].y})),
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
          data-testid="ie-map"
          role="application"
          aria-label={t.map}
        >
          <defs>
            <linearGradient id="ie-sea" gradientUnits="userSpaceOnUse"
              x1={PAPER.x} y1={PAPER.y} x2={PAPER.x + PAPER.width * 0.3} y2={PAPER.y + PAPER.height}>
              <stop offset="0%" stopColor="#b9d2d8"/>
              <stop offset="55%" stopColor="#9dc0cb"/>
              <stop offset="100%" stopColor="#7fa9b8"/>
            </linearGradient>
            {/* Flashpoint hatching, as printed: a warm diagonal wash over the
                contested theatres.  Pattern units are board units, so the
                stripes keep the printed density as the player zooms. */}
            <pattern id="ie-hachure" width="96" height="96" patternUnits="userSpaceOnUse"
              patternTransform="rotate(34)">
              <rect width="96" height="96" fill="#c98f78" opacity="0.2"/>
              <line x1="0" y1="0" x2="0" y2="96" stroke="#9c4a34" strokeWidth="12" opacity="0.62"/>
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
            {board === "greatWar" ? (
              // The Great War board is a separate printed map; it has no space
              // markers, and it is only fetched when the tab is opened.
              <image href="/imperial-elegy/maps/greatWar.jpg" x={PAPER.x} y={PAPER.y}
                width={PAPER.width} height={PAPER.height} preserveAspectRatio="xMidYMid slice"/>
            ) : (
              <>
                {/* Paper and sea, then the traced coastline of each printed panel. */}
                <rect {...toRect(background.paper)} fill="#efe6d2"/>
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
                    <path d={region.d} fill="none" stroke="#a4937a" strokeWidth={unitsPerPx * 1.1}
                      fillRule="evenodd" pointerEvents="none"/>
                  </g>
                ))}
                {/* Printed continent names, as on the board: they orient the
                    eye far faster than the coastlines alone at fit zoom. */}
                <g pointerEvents="none" fill="#a5926f" opacity={0.55}
                  fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" letterSpacing="0.35em">
                  {CONTINENTS.map((continent) => (
                    <text key={continent.name} x={continent.x} y={continent.y}
                      textAnchor="middle" fontSize={continent.size} transform={`rotate(${continent.rotate} ${continent.x} ${continent.y})`}>
                      {continent.name}
                    </text>
                  ))}
                </g>
                <rect {...toRect(background.paper)} fill="none" stroke="#8c7a5e" strokeWidth={unitsPerPx * 1.6}/>
              </>
            )}

            {board === "world" && (
              <>
                <g mask="url(#ie-water)">{connectionLayer.sea}</g>
                {connectionLayer.land}
                {connectionLayer.focused}
              </>
            )}

            {board === "world" && SPACE_IDS.map((id) => {
              const space = SPACES[id];
              const state = G.spaces[id];
              if (!state) return null;
              const r = markerRadius(id);
              const fill = colorFor(state.control);
              const isHighlighted = highlight.has(id);
              const isSelected = selected === id;
              const stroke = isHighlighted ? "#f4d574" : isSelected ? "#fff4cf" : darkFor(state.control);
              const strokeWidth = (isHighlighted || isSelected ? 16 : 8) * Math.max(0.5, unitsPerPx * 0.6);
              const units = state.units.length;
              return (
                <g key={id} transform={`translate(${space.x} ${space.y})`}
                  data-testid={`ie-space-${id}`} className="ie-space-hit"
                >
                  {isHighlighted && (
                    <circle r={r + unitsPerPx * 10} fill="none" stroke="#f4d574"
                      strokeWidth={unitsPerPx * 3} opacity={0.95}/>
                  )}
                  {space.type === "capital" || space.type === "subcapital" ? (
                    <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}><Star r={r}/></g>
                  ) : space.type === "navalBase" ? (
                    <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}><Triangle r={r}/></g>
                  ) : isNavalBox(id) ? (
                    <rect x={-r * 1.5} y={-r * 0.8} width={r * 3} height={r * 1.6} rx={14}
                      fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.95}/>
                  ) : space.type === "territory" ? (
                    <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
                  ) : (
                    <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={14}
                      fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
                  )}
                  {/* A port prints an anchor on the board; it is the cue for
                      "a fleet can reach this space" without drawing a red line
                      across the sea for every one of the 120 routes. */}
                  {space.ports && space.ports.length > 0 && (
                    <g transform={`translate(${-r * 1.25} ${-r * 0.9})`} opacity={0.85}>
                      <Anchor size={unitsPerPx * 8}/>
                    </g>
                  )}
                  {state.fort && <text y={r + unitsPerPx * 22} textAnchor="middle" fontSize={unitsPerPx * 14} fill="#4a3a22">▲{state.fort.level}</text>}
                  {state.trench && <text x={-r} y={-r - unitsPerPx * 6} fontSize={unitsPerPx * 13} fill="#8a6a2a">▦</text>}
                  {units > 0 && (
                    <g>
                      <circle cx={r * 0.95} cy={-r * 0.95} r={unitsPerPx * 9} fill="#1b1611"
                        stroke="#e8d8b5" strokeWidth={unitsPerPx * 1.4}/>
                      <text x={r * 0.95} y={-r * 0.95 + unitsPerPx * 4} textAnchor="middle"
                        fontSize={unitsPerPx * 11} fill="#f4e8ce">{units}</text>
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
                  <text key={id} x={space.x} y={space.y + markerRadius(id) + labelSize * 1.6}
                    textAnchor="middle" fontSize={labelSize}
                    fill={isSelected ? "#7a2418" : "#2a2218"}
                    fontWeight={isSelected || isHighlighted ? 700 : 600}
                    paintOrder="stroke" stroke={isSelected ? "#ffe9a8" : "#f6eed8"}
                    strokeWidth={unitsPerPx * 2.4}>
                    {label(id)}
                  </text>
                );
              })}
            </g>
          </g>
        </svg>
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
    prev.legalTargets === next.legalTargets &&
    prev.moveTargets === next.moveTargets &&
    prev.battleTargets === next.battleTargets &&
    prev.locale === next.locale &&
    prev.board === next.board &&
    prev.focus === next.focus,
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
