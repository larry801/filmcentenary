import React from "react";
import i18n from "../../constant/i18n";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LayersIcon from "@mui/icons-material/Layers";
import {
    Controller,
    landCount,
    navalCount,
    VQGame,
    CONTROLLER_COLORS,
    controllerName,
} from "../constant/general";
import {LAND_LINKS, SEA_ZONES, SPACE_BY_ID, SPACES, seaZoneName, spaceName} from "../mapData";
import {TUTORIAL_FORTRESSES, TUTORIAL_KEYS, tutorialSpaceAllowed} from "../tutorial";
import land from "../data/land-background.json";
import {WORLD_MAP_LOCATIONS} from "../data/world-map";
import {
    BOARD_BANNERS,
    BOARD_OCEAN_LABELS,
    BOARD_REGIONS,
    BOARD_SEA_POINTS,
    BOARD_SPLIT_GRADIENTS,
    BOARD_TRIANGLE_COLORS,
    BOARD_WIND_ARROWS,
    BOARD_WORLD_POINTS,
    BOARD_WORLD_ROUTES,
    BOARD_WORLD_STRIP,
    boardGradientId,
    boardGradientIndex,
    boardMarkerColors,
    boardSpacePoint,
    cachedBoardWarpPath,
    boardWorldPoint,
} from "../data/board-layout";
import {
    centerView,
    clampView,
    INITIAL_VIEW,
    isMapDrag,
    MAP_HEIGHT,
    MAP_WIDTH,
    MapLabelPlacement,
    MapView,
    nearestMapTarget,
    nodeHitRadius,
    placeMapLabels,
    zoomView,
} from "./map-geometry";

/**
 * The "printed board" map view: a pure-SVG redraw of VQ.png.
 *
 * Unlike the geographic view there is no Europe/world switch here.  The
 * printed board puts Europe in the main field and the triangular colony
 * spaces in an L-shaped strip down the left edge and along the bottom, all on
 * one surface.  Marker shapes, home-colour washes, thick brown connections,
 * power name plates and the aged parchment/watercolour background follow the
 * reference photo; control rings, unit badges and selection state carry the
 * live game information.
 */

export interface VQBoardMapProps {
    G: VQGame;
    selected?: string;
    origin?: string | null;
    onSelect: (id: string) => void;
    highlights?: ReadonlySet<string>;
    dimUnavailable?: boolean;
    homeSpace?: string;
    /** Switch back to the geographic projection. */
    onSwitchStyle: () => void;
}

type BoardLocale = "en" | "zh_CN";

const LABEL_ALL_SCALE = 1.4;
const MAP_LABEL_FONT_SIZE = 9.5;
const FORTRESS_RADIUS = 8.5;
const TRIANGLE_LABEL_FONT_SIZE = 5.4;

/** Eight-pointed fortress outline, as printed on the board (two crossed squares). */
const octagramPoints = (cx: number, cy: number, radius: number = FORTRESS_RADIUS): string => {
    const a = radius / Math.SQRT2;
    const d = radius - a;
    const vertices: ReadonlyArray<readonly [number, number]> = [
        [0, -radius], [d, -a], [a, -a], [a, -d],
        [radius, 0], [a, d], [a, a], [d, a],
        [0, radius], [-d, a], [-a, a], [-a, d],
        [-radius, 0], [-a, -d], [-a, -a], [-d, -a],
    ];
    return vertices.map(([dx, dy]) => `${cx + dx},${cy + dy}`).join(" ");
};

const spaceSummary = (G: VQGame, id: string): string => {
    const e = i18n.chain.vq.map;
    const def = SPACE_BY_ID[id];
    const st = G.spaces[id];
    if (def === undefined || st === undefined) return "";
    const vqLocale: BoardLocale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
    const excluded = G.scenario === "tutorial" && !tutorialSpaceAllowed(id);
    const landN = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0);
    const navalN = Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    return `${spaceName(id, vqLocale)} · ${e.control}${i18n.chain.vq.punct.colon}${controllerName(st.control, vqLocale)} · ${st.religion === "protestant" ? e.protestant : e.catholic} · ${e.army} ${landN} / ${e.navy} ${navalN} / ${e.leaders} ${st.leaders.length}${G.espionage?.jesuits.includes(id) ? ` · ${e.jesuits}` : ""}${excluded ? ` · ${e.noEntry}` : ""}${st.unrest ? ` · ${e.unrest}` : ""}${st.siege ? ` · ${e.siege}` : ""}`;
};

const seaSummary = (G: VQGame, id: string): string => {
    const zone = SEA_ZONES.find((candidate) => candidate.id === id);
    if (zone === undefined) return "";
    const vqLocale: BoardLocale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
    const count = Object.values(G.seaZones[zone.id].naval).reduce((sum, stack) => sum + navalCount(stack), 0);
    return `${seaZoneName(zone.id, vqLocale)} · ${i18n.chain.vq.map.navy} ${count}`;
};

const labelPriority = (G: VQGame, id: string, selected?: string, origin?: string | null,
                       highlights?: ReadonlySet<string>): number => {
    const st = G.spaces[id];
    if (st === undefined) return 0;
    const total = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0) +
        Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    const kind = G.scenario === "tutorial" && TUTORIAL_KEYS.includes(id) ? "key" : SPACE_BY_ID[id].kind;
    let priority = total > 0 ? 450 : 120;
    if (kind === "key") priority = Math.max(priority, 600);
    if (origin === id) priority = Math.max(priority, 750);
    if (highlights?.has(id) === true) priority = Math.max(priority, 900);
    if (selected === id) priority = Math.max(priority, 1000);
    return priority;
};

const shouldShowLabel = (G: VQGame, id: string, scale: number, selected?: string, origin?: string | null,
                         highlights?: ReadonlySet<string>): boolean => {
    const st = G.spaces[id];
    if (st === undefined || SPACE_BY_ID[id] === undefined) return false;
    const excluded = G.scenario === "tutorial" && !tutorialSpaceAllowed(id);
    const total = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0) +
        Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    const kind = G.scenario === "tutorial" && TUTORIAL_KEYS.includes(id) ? "key" : SPACE_BY_ID[id].kind;
    return selected === id || highlights?.has(id) === true || origin === id || scale >= LABEL_ALL_SCALE ||
        (!excluded && (total > 0 || kind === "key"));
};

type SpaceShapeProps = Pick<VQBoardMapProps, "G" | "selected" | "origin" | "onSelect" | "highlights" | "dimUnavailable"> & {
    id: string;
    label?: MapLabelPlacement;
    onHover: (id: string | undefined) => void;
};

function BoardSpaceShape({id, G, selected, origin, onSelect, highlights, dimUnavailable = true, onHover, label}: SpaceShapeProps) {
    const def = SPACE_BY_ID[id];
    const vqLocale: BoardLocale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
    const excluded = G.scenario === "tutorial" && !tutorialSpaceAllowed(id);
    const highlighted = highlights?.has(id) === true;
    const dimmed = highlights !== undefined && dimUnavailable && !highlighted;
    const st = G.spaces[id];
    const {x, y} = boardSpacePoint(id);
    const colors = boardMarkerColors(def);
    const gradient = boardGradientIndex(colors);
    const fill = gradient >= 0 ? `url(#${boardGradientId(gradient)})` : colors[0];
    const stroke = st.religion === "protestant" ? "#fffdf6" : "#2b2118";
    const controlColor = CONTROLLER_COLORS[st.control] ?? "#9e9e9e";
    const isSelected = selected === id;
    const landN = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0);
    const navalN = Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    const total = landN + navalN;
    const kind = G.scenario === "tutorial"
        ? TUTORIAL_KEYS.includes(id) ? "key" : TUTORIAL_FORTRESSES.includes(id) ? "fortress" : "open"
        : def.kind === "open" && st.fortress ? "fortress" : def.kind;
    const baseTitle = spaceSummary(G, id);
    const title = highlighted ? `${baseTitle} · ${i18n.chain.vq.legend.legal}` : baseTitle;
    const className = `vq-map-node vq-board-node${dimmed ? " vq-dim" : ""}${highlighted ? " vq-legal-target" : ""}`;
    const common = {fill, stroke, strokeWidth: 1.8};
    const marker = () => {
        if (kind === "key") return <rect x={x - 7} y={y - 7} width={14} height={14} {...common}/>;
        if (kind === "fortress") return <polygon data-marker="fortress" points={octagramPoints(x, y)} {...common}/>;
        return <circle cx={x} cy={y} r={7.2} {...common}/>;
    };
    return <g className={className} role="button" tabIndex={0} aria-label={title} aria-pressed={isSelected}
               onKeyDown={(event) => {
                   if (event.key === "Enter" || event.key === " ") {event.preventDefault(); onSelect(id);}
               }} onFocus={() => onHover(id)} onBlur={() => onHover(undefined)}
               onPointerEnter={(event) => {if (event.pointerType === "mouse") onHover(id);}}
               onPointerLeave={(event) => {if (event.pointerType === "mouse") onHover(undefined);}}
               style={{cursor: "pointer"}} opacity={dimmed ? 0.35 : excluded ? 0.3 : 1}>
        <title>{title}</title>
        <circle className="vq-hit" cx={x} cy={y} r={13} fill="transparent"/>
        {/* The board prints home colours; the ring carries the live controller. */}
        <circle cx={x} cy={y} r={11.4} fill="none" stroke={controlColor} strokeWidth={2.1} opacity={0.9}/>
        {highlighted && <circle className="vq-legal-ring" cx={x} cy={y} r={14} fill="none"/>}
        {origin === id && <circle cx={x} cy={y} r={16} fill="none" stroke="#2d6b71" strokeWidth={2} strokeDasharray="3 2"/>}
        {isSelected && <circle cx={x} cy={y} r={12.5} fill="#f2d59188" stroke="#805012" strokeWidth={2}/>}
        {st.unrest && <circle cx={x} cy={y} r={9.8} fill="none" stroke="#b6362a" strokeWidth={1.6} strokeDasharray="2 2"/>}
        {st.siege && <circle cx={x} cy={y} r={10.5} fill="none" stroke="#c47b16" strokeWidth={1.8}/>}
        {marker()}
        {G.espionage?.jesuits.includes(id) && <text x={x - 13} y={y - 7} fontSize={12} fill="#582b70" fontWeight={700} pointerEvents="none">J</text>}
        {excluded && <text x={x} y={y + 3} textAnchor="middle" fontSize={11} fill="#9c3028">×</text>}
        {total > 0 && <g pointerEvents="none">
            <rect x={x + 6} y={y - 16} width={total > 9 ? 20 : 14} height={12} rx={3} fill="#faf5e7" stroke="#b39a6a" strokeWidth={0.5}/>
            <text x={x + 9} y={y - 7} fontSize={9} fill="#30291e" fontWeight={700}>{total}</text>
        </g>}
        {label !== undefined && <g pointerEvents="none">
            {label.leader !== undefined && <line className="vq-label-leader" {...label.leader}/>}
            <text x={label.x} y={label.y} textAnchor={label.textAnchor} dominantBaseline="central"
                  fontSize={MAP_LABEL_FONT_SIZE} fill="#30291e" fontWeight={isSelected ? 700 : 500}
                  paintOrder="stroke" stroke="#f4eddd" strokeWidth={3} strokeLinejoin="round">{spaceName(id, vqLocale)}</text>
        </g>}
    </g>;
}

type TriangleShapeProps = {
    location: typeof WORLD_MAP_LOCATIONS[number];
    G: VQGame;
    vqLocale: BoardLocale;
    label?: MapLabelPlacement;
};

/** One printed settlement triangle, with its live colony/control colour. */
function BoardTriangle({location, G, vqLocale, label}: TriangleShapeProps) {
    const {x, y} = boardWorldPoint(location.id);
    const gameId = location.gameId ??
        (G.worldControls[location.id] !== undefined || G.worldColonies[location.id] !== undefined ? location.id : undefined);
    const colonyOwner = gameId === undefined ? undefined : G.worldColonies[gameId];
    const controlOwner = gameId === undefined ? undefined : G.worldControls[gameId];
    const owner = colonyOwner ?? controlOwner ?? location.home;
    const active = colonyOwner !== undefined;
    const name = vqLocale === "en" ? location.nameEn : location.nameZh;
    const ownerText = owner === undefined ? i18n.chain.vq.worldUi.vacant : controllerName(owner, vqLocale);
    const title = `${name} · ${ownerText}${active ? ` · ${i18n.chain.vq.worldUi.colony}` : ""}`;
    const fill = owner === undefined ? BOARD_TRIANGLE_COLORS.neutral
        : owner === "spain" ? BOARD_TRIANGLE_COLORS.spain
            : owner === "portugal" ? BOARD_TRIANGLE_COLORS.portugal
                : CONTROLLER_COLORS[owner] ?? BOARD_TRIANGLE_COLORS.neutral;
    const size = active ? 6.4 : 5.6;
    return <g className={`vq-board-triangle${active ? " vq-board-colony" : ""}`} role="img" aria-label={title}
              style={{cursor: "help"}} onClick={(event) => event.stopPropagation()}>
        <title>{title}</title>
        <polygon points={`${x},${y - size} ${x + size},${y + size * 0.8} ${x - size},${y + size * 0.8}`}
                 fill={fill} stroke={active ? "#fffdf6" : "#4b3d2b"} strokeWidth={active ? 1.3 : 0.8}/>
        {label !== undefined && <g pointerEvents="none">
            {label.leader !== undefined && <line className="vq-board-triangle-leader" {...label.leader}/>}
            <text x={label.x} y={label.y} textAnchor={label.textAnchor} dominantBaseline="central"
                  fontSize={TRIANGLE_LABEL_FONT_SIZE} fill="#203c4a" fontWeight={active ? 700 : 500}
                  paintOrder="stroke" stroke="#e4f0f4" strokeWidth={1.6} strokeLinejoin="round">{name}</text>
        </g>}
    </g>;
}

/** Small black compass rose printed in the top corners of VQ.png. */
const Compass = ({cx, cy}: {cx: number; cy: number}) => <g transform={`translate(${cx} ${cy})`}
                                                              fill="#3b3126" opacity={0.72} pointerEvents="none">
    <circle r={2.1}/>
    {[0, 90, 180, 270].map((angle) => <polygon key={angle} points="0,-3 1.2,-13 -1.2,-13"
                                                transform={`rotate(${angle})`}/>)}
    <circle r={9.5} fill="none" stroke="#3b3126" strokeWidth={0.7}/>
</g>;

function BoardLegend() {
    const l = i18n.chain.vq.legend;
    return <details className="vq-map-legend vq-board-legend">
        <summary>{l.title}</summary>
        <div className="vq-legend-items">
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-key" aria-hidden="true"/>{l.key}</span>
            <span className="vq-legend-item">
                <span className="vq-legend-swatch vq-legend-swatch-fortress" aria-hidden="true">
                    <svg viewBox="-10 -10 20 20">
                        <polygon data-marker="fortress" points={octagramPoints(0, 0, 9)} fill="#e3c06d" stroke="#392d20" strokeWidth={1.4}/>
                    </svg>
                </span>{l.fortress}
            </span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-open" aria-hidden="true"/>{l.open}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-colonies" aria-hidden="true">▲</span>{i18n.chain.vq.map.boardColonies}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-jesuits" aria-hidden="true">J</span>{l.jesuits}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-unrest" aria-hidden="true"/>{l.unrest}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-siege" aria-hidden="true"/>{l.siege}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-closed" aria-hidden="true">×</span>{l.closed}</span>
        </div>
    </details>;
}

export const VQBoardMap = ({
    G, selected, origin, onSelect, highlights, dimUnavailable = true, homeSpace, onSwitchStyle,
}: VQBoardMapProps) => {
    i18n.use();
    const vqLocale: BoardLocale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
    const [view, setView] = React.useState<MapView>(INITIAL_VIEW);
    const [hovered, setHovered] = React.useState<string>();
    const landPath = React.useMemo(() => cachedBoardWarpPath(land.path), []);
    const worldLocations = WORLD_MAP_LOCATIONS.filter((location) => {
        if (!location.gameOnly) return true;
        if (location.gameId === undefined) return false;
        return G.worldColonies[location.gameId] !== undefined || G.worldControls[location.gameId] !== undefined;
    });
    const labelPlacements = React.useMemo(() => {
        const obstacles = SEA_ZONES.map((zone) => {
            const {x, y} = BOARD_SEA_POINTS[zone.id];
            return {x: x - 44, y: y - 12.5, width: 88, height: 25};
        });
        return placeMapLabels(SPACES.map((space) => {
            const {x, y} = boardSpacePoint(space.id);
            return {
                id: space.id,
                x,
                y,
                text: spaceName(space.id, vqLocale),
                priority: labelPriority(G, space.id, selected, origin, highlights),
                visible: shouldShowLabel(G, space.id, view.scale, selected, origin, highlights),
            };
        }), {fontSize: MAP_LABEL_FONT_SIZE, obstacles});
    }, [G, selected, origin, highlights, view.scale, vqLocale]);
    const triangleLabels = React.useMemo(() => placeMapLabels(worldLocations.map((location) => {
        const {x, y} = boardWorldPoint(location.id);
        const gameId = location.gameId;
        const active = gameId !== undefined && G.worldColonies[gameId] !== undefined;
        return {
            id: location.id,
            x,
            y,
            text: vqLocale === "en" ? location.nameEn : location.nameZh,
            priority: active ? 720 : 420,
            visible: true,
        };
    }), {fontSize: TRIANGLE_LABEL_FONT_SIZE, candidateDistances: [8, 12, 17, 23, 30]}),
    [G, vqLocale]);
    const pointers = React.useRef(new Map<number, {x: number; y: number}>());
    const start = React.useRef<[number, number]>([0, 0]);
    const dragged = React.useRef(false);
    const coarsePointer = React.useRef(false);
    const svgRef = React.useRef<SVGSVGElement>(null);
    const coordinates = (event: {clientX: number; clientY: number}) => {
        const matrix = svgRef.current?.getScreenCTM();
        return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : {x: 0, y: 0};
    };
    const selectNearest = (event: React.MouseEvent<SVGSVGElement>) => {
        if (dragged.current) return;
        const point = coordinates(event);
        const x = (point.x - view.x) / view.scale;
        const y = (point.y - view.y) / view.scale;
        const spaces = SPACES.map((space) => {
            const point = boardSpacePoint(space.id);
            return {id: space.id, x: point.x, y: point.y};
        });
        const zones = SEA_ZONES.map((zone) => {
            const point = BOARD_SEA_POINTS[zone.id];
            return {id: zone.id, x: point.x, y: point.y};
        });
        const rect = svgRef.current?.getBoundingClientRect();
        const pixelsPerUnit = rect !== undefined && rect.width > 0
            ? Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT) * view.scale : 0;
        const id = nearestMapTarget(x, y, spaces, zones, nodeHitRadius(pixelsPerUnit, coarsePointer.current));
        if (id !== undefined) onSelect(id);
    };
    const release = (event: React.PointerEvent<SVGSVGElement>) => {
        pointers.current.delete(event.pointerId);
        const target = event.target as Element;
        if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    };
    const readout = hovered === undefined ? undefined : G.spaces[hovered] !== undefined ? spaceSummary(G, hovered) : seaSummary(G, hovered);
    return <div className="vq-map vq-board-map">
        <div className="vq-board-surface">
            <svg ref={svgRef} viewBox="0 0 1000 620" role="group" aria-label={i18n.chain.vq.map.boardAriaLabel}
                 onClick={selectNearest}
                 onPointerDown={(event) => {
                     if (event.button !== 0) return;
                     coarsePointer.current = event.pointerType === "touch" || event.pointerType === "pen";
                     if (!pointers.current.size) {dragged.current = false; start.current = [event.clientX, event.clientY];}
                     pointers.current.set(event.pointerId, coordinates(event));
                     if (pointers.current.size > 1) dragged.current = true;
                     (event.target as Element).setPointerCapture(event.pointerId);
                 }}
                 onPointerMove={(event) => {
                     const previous = pointers.current.get(event.pointerId);
                     if (!previous) return;
                     const next = coordinates(event);
                     if (isMapDrag(Math.hypot(event.clientX - start.current[0], event.clientY - start.current[1]))) dragged.current = true;
                     const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
                     if (other) {
                         const before = Math.hypot(previous.x - other.x, previous.y - other.y);
                         const after = Math.hypot(next.x - other.x, next.y - other.y);
                         if (before > 0) setView((current) => {
                             const zoomed = zoomView(current, after / before, [(previous.x + other.x) / 2, (previous.y + other.y) / 2]);
                             return clampView({...zoomed, x: zoomed.x + (next.x - previous.x) / 2, y: zoomed.y + (next.y - previous.y) / 2});
                         });
                     } else if (dragged.current) {
                         setView((current) => clampView({...current, x: current.x + next.x - previous.x, y: current.y + next.y - previous.y}));
                     }
                     pointers.current.set(event.pointerId, next);
                 }}
                 onPointerUp={release} onPointerCancel={(event) => {dragged.current = true; release(event);}}
                 onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
                 onClickCapture={(event) => {if (event.detail !== 0 && dragged.current) {event.preventDefault(); event.stopPropagation();}}}>
                <defs>
                    <linearGradient id="vq-board-sea" x1="0" y1="0" x2="0.25" y2="1">
                        <stop offset="0%" stopColor="#a3ccdf"/>
                        <stop offset="48%" stopColor="#82b3d2"/>
                        <stop offset="100%" stopColor="#5f93bd"/>
                    </linearGradient>
                    <linearGradient id="vq-board-land" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f0e2bb"/>
                        <stop offset="52%" stopColor="#e3cf9f"/>
                        <stop offset="100%" stopColor="#cbb079"/>
                    </linearGradient>
                    {/* Aged-paper speckle: a light tiled pattern instead of an
                        expensive full-surface turbulence filter. */}
                    <pattern id="vq-board-speckle" width="38" height="38" patternUnits="userSpaceOnUse">
                        <circle cx="5" cy="8" r="0.9" fill="#5d4726" opacity="0.16"/>
                        <circle cx="24" cy="15" r="0.6" fill="#5d4726" opacity="0.13"/>
                        <circle cx="33" cy="30" r="1.1" fill="#fffaf0" opacity="0.3"/>
                        <circle cx="12" cy="28" r="0.5" fill="#5d4726" opacity="0.12"/>
                        <circle cx="19" cy="34" r="0.7" fill="#fffaf0" opacity="0.22"/>
                        <path d="M2,21L8,20" stroke="#5d4726" strokeWidth="0.4" opacity="0.1"/>
                        <path d="M26,4L32,5" stroke="#fffaf0" strokeWidth="0.4" opacity="0.2"/>
                    </pattern>
                    <radialGradient id="vq-board-stain">
                        <stop offset="0%" stopColor="#7c5a2c" stopOpacity="0.16"/>
                        <stop offset="100%" stopColor="#7c5a2c" stopOpacity="0"/>
                    </radialGradient>
                    <radialGradient id="vq-board-surf">
                        <stop offset="0%" stopColor="#f4fbfd" stopOpacity="0.38"/>
                        <stop offset="100%" stopColor="#f4fbfd" stopOpacity="0"/>
                    </radialGradient>
                    {BOARD_REGIONS.map((region, index) => <radialGradient
                        key={`${region.id}-grad`} id={`vq-board-region-${index}`}>
                        <stop offset="0%" stopColor={region.color} stopOpacity={0.46}/>
                        <stop offset="60%" stopColor={region.color} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={region.color} stopOpacity={0}/>
                    </radialGradient>)}
                    {BOARD_SPLIT_GRADIENTS.map(([top, bottom], index) => <linearGradient
                        key={boardGradientId(index)} id={boardGradientId(index)} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="50%" stopColor={top}/>
                        <stop offset="50%" stopColor={bottom}/>
                    </linearGradient>)}
                </defs>
                {/* Watercolour sea */}
                <rect width={1000} height={620} fill="url(#vq-board-sea)"/>
                <g pointerEvents="none">
                    <ellipse cx={180} cy={300} rx={190} ry={110} fill="url(#vq-board-surf)"/>
                    <ellipse cx={760} cy={430} rx={240} ry={120} fill="url(#vq-board-surf)"/>
                    <ellipse cx={470} cy={90} rx={200} ry={70} fill="url(#vq-board-stain)"/>
                    <ellipse cx={880} cy={520} rx={190} ry={90} fill="url(#vq-board-stain)"/>
                    <ellipse cx={110} cy={560} rx={130} ry={80} fill="url(#vq-board-stain)"/>
                </g>
                <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                    {/* Pale coastal shoal, then parchment land */}
                    <path d={landPath} fill="none" stroke="#e7eede" strokeWidth={9} opacity={0.55} fillRule="evenodd"/>
                    <path d={landPath} fill="url(#vq-board-land)" stroke="#8a7952" strokeWidth={1.3} fillRule="evenodd"/>
                    {/* Soft hill shading, as on the printed board */}
                    <g pointerEvents="none" opacity={0.13} fill="#6b4c26">
                        <ellipse cx={525} cy={295} rx={62} ry={20} transform="rotate(-18 525 295)"/>
                        <ellipse cx={330} cy={420} rx={48} ry={14} transform="rotate(-12 330 420)"/>
                        <ellipse cx={700} cy={215} rx={70} ry={17} transform="rotate(12 700 215)"/>
                        <ellipse cx={615} cy={495} rx={90} ry={20} transform="rotate(-8 615 495)"/>
                    </g>
                    {BOARD_REGIONS.map((region, index) => <ellipse key={region.id} cx={region.cx} cy={region.cy}
                                                                  rx={region.rx} ry={region.ry}
                                                                  fill={`url(#vq-board-region-${index})`}
                                                                  pointerEvents="none"/>)}
                    <path d={landPath} fill="none" stroke="#7d6c48" strokeWidth={0.7} fillRule="evenodd"
                          pointerEvents="none" opacity={0.75}/>
                    {/* Paper grain over sea, land and power washes */}
                    <rect x={-400} y={-400} width={1800} height={1420} fill="url(#vq-board-speckle)" pointerEvents="none"/>

                    {/* ---------------- printed World Map L-strip ---------------- */}
                    <g pointerEvents="none">
                        <rect x={BOARD_WORLD_STRIP.left.x0} y={BOARD_WORLD_STRIP.left.y0}
                              width={BOARD_WORLD_STRIP.left.x1 - BOARD_WORLD_STRIP.left.x0}
                              height={BOARD_WORLD_STRIP.left.y1 - BOARD_WORLD_STRIP.left.y0}
                              fill="#4f8ab4" opacity={0.12}/>
                        <rect x={BOARD_WORLD_STRIP.bottom.x0} y={BOARD_WORLD_STRIP.bottom.y0}
                              width={BOARD_WORLD_STRIP.bottom.x1 - BOARD_WORLD_STRIP.bottom.x0}
                              height={BOARD_WORLD_STRIP.bottom.y1 - BOARD_WORLD_STRIP.bottom.y0}
                              fill="#4f8ab4" opacity={0.12}/>
                        {BOARD_WORLD_ROUTES.map((route, index) => <ellipse key={index} cx={route.cx} cy={route.cy}
                                                                           rx={route.rx} ry={route.ry}
                                                                           fill="none" stroke="#eef6f8"
                                                                           strokeWidth={1.4} strokeDasharray="3 5"
                                                                           opacity={0.7}/>)}
                        {BOARD_WIND_ARROWS.map((arrow, index) => <g key={index}
                                                                    transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotate})`}>
                            <path d="M-7,0 L4,0" stroke="#eef6f8" strokeWidth={1.3} opacity={0.75}/>
                            <polygon points="7,0 1,-3 1,3" fill="#eef6f8" opacity={0.85}/>
                        </g>)}
                        <path d={BOARD_WORLD_STRIP.boundary} fill="none" stroke="#3b3125" strokeWidth={3}
                              strokeDasharray="1 7" strokeLinecap="round" opacity={0.65}/>
                        <path d={BOARD_WORLD_STRIP.innerBoundary} fill="none" stroke="#2f6fb0" strokeWidth={1.4}
                              strokeDasharray="6 5" opacity={0.55}/>
                        {BOARD_OCEAN_LABELS.map((plate) => <g key={plate.key} transform={`translate(${plate.x} ${plate.y})`}>
                            <polygon points="-6,0 0,-4.5 6,0 0,4.5" fill="#2f5f6e" stroke="#e9f1e8" strokeWidth={0.8}/>
                            <text x={9} y={1.4} fontSize={4.6} fill="#1f4655" fontFamily="Georgia, serif"
                                  letterSpacing={0.6}>{i18n.chain.vq.map.boardOceanLabels[plate.key]}</text>
                        </g>)}
                    </g>

                    {/* ---------------- Europe: links, sea zones, cities ---------------- */}
                    {LAND_LINKS.map(([a, b, pass], i) => {
                        const aPoint = boardSpacePoint(a);
                        const bPoint = boardSpacePoint(b);
                        return <line key={i} x1={aPoint.x} y1={aPoint.y} x2={bPoint.x} y2={bPoint.y}
                                     stroke={pass ? "#8b6a45" : "#6f5a3a"} strokeWidth={pass ? 2.6 : 2.1}
                                     strokeDasharray={pass ? "6 4" : undefined} opacity={0.8} pointerEvents="none"/>;
                    })}
                    {SEA_ZONES.map((zone) => {
                        const {x, y} = BOARD_SEA_POINTS[zone.id];
                        const count = Object.values(G.seaZones[zone.id].naval).reduce((sum, stack) => sum + navalCount(stack), 0);
                        const highlighted = highlights?.has(zone.id) === true;
                        const dimmed = highlights !== undefined && dimUnavailable && !highlighted;
                        const label = seaSummary(G, zone.id) +
                            (highlighted ? ` · ${i18n.chain.vq.legend.legal}` : "");
                        return <g key={zone.id} className={`vq-map-node${dimmed ? " vq-dim" : ""}${highlighted ? " vq-legal-target" : ""}`}
                                  role="button" tabIndex={0} aria-label={label} aria-pressed={selected === zone.id}
                                  opacity={dimmed ? 0.35 : undefined}
                                  onFocus={() => setHovered(zone.id)} onBlur={() => setHovered(undefined)}
                                  onPointerEnter={(event) => {if (event.pointerType === "mouse") setHovered(zone.id);}}
                                  onPointerLeave={(event) => {if (event.pointerType === "mouse") setHovered(undefined);}}
                                  style={{cursor: "pointer"}} onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {event.preventDefault(); onSelect(zone.id);}
                                  }}>
                            {highlights !== undefined && <title>{label}</title>}
                            <rect className="vq-hit" x={x - 44} y={y - 12} width={88} height={25} rx={5}
                                  fill={selected === zone.id ? "#faf3df" : "#c8dcd680"}
                                  stroke={origin === zone.id ? "#2d6b71" : selected === zone.id ? "#805012" : "transparent"}
                                  strokeDasharray={origin === zone.id ? "3 2" : undefined}/>
                            <text x={x} y={y} fontSize={9.5} fill="#2e5d5b" fontFamily="Georgia, serif" fontStyle="italic"
                                  textAnchor="middle" paintOrder="stroke" stroke="#cfe2e9" strokeWidth={2}>{seaZoneName(zone.id, vqLocale)}</text>
                            {count > 0 && <text x={x} y={y + 10} fontSize={8} textAnchor="middle" fill="#244c49">⚓ {count}</text>}
                            {highlighted && <rect className="vq-legal-ring" x={x - 46} y={y - 14} width={92} height={29} rx={7} fill="none"/>}
                        </g>;
                    })}
                    {SPACES.map((space) => <BoardSpaceShape key={space.id} id={space.id} G={G} selected={selected}
                                                           origin={origin} onSelect={onSelect} highlights={highlights}
                                                           dimUnavailable={dimUnavailable} onHover={setHovered}
                                                           label={labelPlacements[space.id]}/>)}

                    {/* ---------------- colony triangles ---------------- */}
                    {worldLocations.map((location) => <BoardTriangle key={location.id} location={location} G={G}
                                                                     vqLocale={vqLocale}
                                                                     label={triangleLabels[location.id]}/>)}

                    {/* ---------------- printed chrome ---------------- */}
                    <g pointerEvents="none">
                        <Compass cx={24} cy={56}/>
                        <Compass cx={976} cy={56}/>
                        <text x={510} y={20} textAnchor="middle" fontFamily="Georgia, serif" fontSize={19}
                              fontStyle="italic" fill="#4a3a22" opacity={0.72} letterSpacing={1.5}>Virgin Queen</text>
                        <text x={510} y={31} textAnchor="middle" fontFamily="Georgia, serif" fontSize={7.5}
                              fill="#6a5334" opacity={0.7} letterSpacing={3}>1559 – 1598</text>
                        {BOARD_BANNERS.map((banner) => {
                            const rotate = banner.rotate ?? 0;
                            const cx = banner.x + banner.width / 2;
                            const cy = banner.y + banner.height / 2;
                            return <g key={banner.label} transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}
                                      opacity={0.85}>
                                <rect x={banner.x} y={banner.y} width={banner.width} height={banner.height} rx={2}
                                      fill="#f5ecd6" stroke={banner.color} strokeWidth={1.6}/>
                                <rect x={banner.x + 1.5} y={banner.y + 1.5} width={15} height={banner.height - 3}
                                      fill={banner.color} opacity={0.8}/>
                                <text x={cx + 6} y={cy} textAnchor="middle" dominantBaseline="central"
                                      fontFamily="Georgia, serif" fontSize={9} letterSpacing={1.6} fill={banner.color}>{banner.label}</text>
                            </g>;
                        })}
                    </g>
                </g>
            </svg>
        </div>
        <BoardLegend/>
        <div className="vq-map-controls">
            <IconButton size="small" aria-label={i18n.chain.vq.map.zoomIn} disabled={view.scale >= 4}
                        onClick={() => setView((current) => zoomView(current, 1.35, [500, 310]))}><AddIcon fontSize="small"/></IconButton>
            <span style={{minWidth: 36, textAlign: "center", fontSize: 11}} aria-live="polite">{Math.round(view.scale * 100)}%</span>
            <IconButton size="small" aria-label={i18n.chain.vq.map.zoomOut} disabled={view.scale <= 1}
                        onClick={() => setView((current) => zoomView(current, 1 / 1.35, [500, 310]))}><RemoveIcon fontSize="small"/></IconButton>
            {homeSpace !== undefined && <IconButton size="small"
                aria-label={`${i18n.chain.vq.map.centerHome} · ${spaceName(homeSpace, vqLocale)}`}
                title={`${i18n.chain.vq.map.centerHome} · ${spaceName(homeSpace, vqLocale)}`}
                onClick={() => setView((current) => {
                    const point = boardSpacePoint(homeSpace);
                    return centerView([point.x, point.y], Math.max(current.scale, 2));
                })}><MyLocationIcon fontSize="small"/></IconButton>}
            <IconButton size="small" aria-label={i18n.chain.vq.map.reset} onClick={() => setView(INITIAL_VIEW)}><RestartAltIcon fontSize="small"/></IconButton>
            <IconButton size="small" aria-label={i18n.chain.vq.map.switchToGeographicMap}
                        title={i18n.chain.vq.map.switchToGeographicMap} onClick={onSwitchStyle}>
                <LayersIcon fontSize="small"/>
            </IconButton>
        </div>
        {readout !== undefined && readout !== "" && <div className="vq-map-readout" aria-hidden="true">{readout}</div>}
        <div className="vq-map-caption"><span>{i18n.chain.vq.map.boardCaption}</span><span className="vq-map-help">{i18n.chain.vq.map.boardHelp}</span></div>
    </div>;
};
