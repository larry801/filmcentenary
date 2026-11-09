import React from "react";
import i18n from "../../constant/i18n";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import {Controller, landCount, navalCount, Religion, VQGame, CONTROLLER_COLORS, controllerName} from "../constant/general";
import {LAND_LINKS, SEA_ZONES, SPACE_BY_ID, SPACES, seaZoneName, spaceName} from "../mapData";
import {TUTORIAL_FORTRESSES, TUTORIAL_KEYS, tutorialSpaceAllowed} from "../tutorial";
import land from "../data/land-background.json";
import {centerView, clampView, INITIAL_VIEW, isMapDrag, MAP_HEIGHT, MAP_WIDTH, MapView, nearestMapTarget, nodeHitRadius, project, zoomView} from "./map-geometry";

export interface VQMapProps {
    G: VQGame;
    selected?: string;
    origin?: string | null;
    onSelect: (id: string) => void;
    /** Space / sea-zone ids that are legal targets for the current action. */
    highlights?: ReadonlySet<string>;
    /** Dim every node outside `highlights`; defaults to true when highlights are provided. */
    dimUnavailable?: boolean;
    /** Space the "centre on my capital" control jumps to; the control is hidden without one. */
    homeSpace?: string;
}

/** One-line description of a space, shared by its tooltip, aria-label and the hover read-out. */
export const spaceSummary = (G: VQGame, id: string): string => {
    const e = i18n.chain.vq.map;
    const def = SPACE_BY_ID[id];
    const st = G.spaces[id];
    if (def === undefined || st === undefined) return "";
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const excluded = G.scenario === "tutorial" && !tutorialSpaceAllowed(id);
    const landN = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0);
    const navalN = Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    return `${spaceName(id, vqLocale)} · ${e.control}${i18n.chain.vq.punct.colon}${controllerName(st.control, vqLocale)} · ${st.religion === "protestant" ? e.protestant : e.catholic} · ${e.army} ${landN} / ${e.navy} ${navalN} / ${e.leaders} ${st.leaders.length}${G.espionage?.jesuits.includes(id) ? ` · ${e.jesuits}` : ""}${excluded ? ` · ${e.noEntry}` : ""}${st.unrest ? ` · ${e.unrest}` : ""}${st.siege ? ` · ${e.siege}` : ""}`;
};

const seaSummary = (G: VQGame, id: string): string => {
    const zone = SEA_ZONES.find((candidate) => candidate.id === id);
    if (zone === undefined) return "";
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const count = Object.values(G.seaZones[zone.id].naval).reduce((sum, stack) => sum + navalCount(stack), 0);
    return `${seaZoneName(zone.id, vqLocale)} · ${i18n.chain.vq.map.navy} ${count}`;
};

/** Zoom level from which every city name is drawn, not just occupied or key spaces. */
export const LABEL_ALL_SCALE = 1.4;

function SpaceShape({id, G, selected, origin, onSelect, scale, highlights, dimUnavailable = true, onHover}: VQMapProps & {id: string; scale: number; onHover: (id: string | undefined) => void}) {
    const def = SPACE_BY_ID[id];
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const excluded = G.scenario === "tutorial" && !tutorialSpaceAllowed(id);
    const highlighted = highlights?.has(id) === true;
    const dimmed = highlights !== undefined && dimUnavailable && !highlighted;
    const st = G.spaces[id];
    const [x, y] = project(def.lon, def.lat);
    const color = CONTROLLER_COLORS[st.control] ?? "#9e9e9e";
    const stroke = st.religion === "protestant" ? "#fffdf6" : "#392d20";
    const isSelected = selected === id;
    const landN = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0);
    const navalN = Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    const total = landN + navalN;
    const kind = G.scenario === "tutorial" ? TUTORIAL_KEYS.includes(id) ? "key" : TUTORIAL_FORTRESSES.includes(id) ? "fortress" : "open" :
        def.kind === "open" && st.fortress ? "fortress" : def.kind;
    const baseTitle = spaceSummary(G, id);
    const title = highlighted ? `${baseTitle} · ${i18n.chain.vq.legend.legal}` : baseTitle;
    const className = `vq-map-node${dimmed ? " vq-dim" : ""}${highlighted ? " vq-legal-target" : ""}`;
    const showLabel = isSelected || highlighted || origin === id || scale >= LABEL_ALL_SCALE ||
        (!excluded && (total > 0 || kind === "key"));
    return <g className={className} role="button" tabIndex={0} aria-label={title} aria-pressed={isSelected}
              onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {event.preventDefault(); onSelect(id);}
              }} onFocus={() => onHover(id)} onBlur={() => onHover(undefined)}
              onPointerEnter={(event) => {if (event.pointerType === "mouse") onHover(id);}}
              onPointerLeave={(event) => {if (event.pointerType === "mouse") onHover(undefined);}}
              style={{cursor: "pointer"}} opacity={dimmed ? 0.35 : excluded ? 0.3 : 1}>
        <title>{title}</title>
        <circle className="vq-hit" cx={x} cy={y} r={12} fill="transparent"/>
        {highlighted && <circle className="vq-legal-ring" cx={x} cy={y} r={13} fill="none"/>}
        {origin === id && <circle cx={x} cy={y} r={15} fill="none" stroke="#2d6b71" strokeWidth={2} strokeDasharray="3 2"/>}
        {isSelected && <circle cx={x} cy={y} r={12} fill="#f2d59188" stroke="#805012" strokeWidth={2}/>}
        {st.unrest && <circle cx={x} cy={y} r={9.5} fill="none" stroke="#b6362a" strokeWidth={1.6} strokeDasharray="2 2"/>}
        {st.siege && <circle cx={x} cy={y} r={11} fill="none" stroke="#c47b16" strokeWidth={1.8}/>}
        {kind === "key" ? <rect x={x - 5.5} y={y - 5.5} width={11} height={11} fill={color} stroke={stroke} strokeWidth={1.4}/> :
            kind === "fortress" ? <polygon points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`} fill={color} stroke={stroke} strokeWidth={1.4}/> :
                <circle cx={x} cy={y} r={4.5} fill={color} stroke={stroke} strokeWidth={1.4}/>}
        {G.espionage?.jesuits.includes(id) && <text x={x - 12} y={y - 6} fontSize={12} fill="#582b70" fontWeight={700} pointerEvents="none">J</text>}
        {excluded && <text x={x} y={y + 3} textAnchor="middle" fontSize={11} fill="#9c3028">×</text>}
        {total > 0 && <g pointerEvents="none">
            <rect x={x + 5} y={y - 15} width={total > 9 ? 20 : 14} height={12} rx={3} fill="#faf5e7" stroke="#b39a6a" strokeWidth={0.5}/>
            <text x={x + 8} y={y - 6} fontSize={9} fill="#30291e" fontWeight={700}>{total}</text>
        </g>}
        {showLabel &&
            <text x={x} y={y + 18} textAnchor="middle" fontSize={isSelected ? 12 : 9} fill="#30291e" fontWeight={isSelected ? 700 : 500}
                  paintOrder="stroke" stroke="#f4eddd" strokeWidth={3} strokeLinejoin="round" pointerEvents="none">{spaceName(id, vqLocale)}</text>}
    </g>;
}

function MapLegend() {
    const l = i18n.chain.vq.legend;
    return <details className="vq-map-legend">
        <summary>{l.title}</summary>
        <div className="vq-legend-items">
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-key" aria-hidden="true"/>{l.key}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-fortress" aria-hidden="true"/>{l.fortress}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-open" aria-hidden="true"/>{l.open}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-jesuits" aria-hidden="true">J</span>{l.jesuits}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-unrest" aria-hidden="true"/>{l.unrest}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-siege" aria-hidden="true"/>{l.siege}</span>
            <span className="vq-legend-item"><span className="vq-legend-swatch vq-legend-swatch-closed" aria-hidden="true">×</span>{l.closed}</span>
        </div>
    </details>;
}

export const VQMap = ({G, selected, origin, onSelect, highlights, dimUnavailable = true, homeSpace}: VQMapProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const [view, setView] = React.useState<MapView>(INITIAL_VIEW);
    const [hovered, setHovered] = React.useState<string>();
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
            const [markerX, markerY] = project(space.lon, space.lat);
            return {id: space.id, x: markerX, y: markerY};
        });
        const zones = SEA_ZONES.map((zone) => {
            const [markerX, markerY] = project(zone.label[0], zone.label[1]);
            return {id: zone.id, x: markerX, y: markerY};
        });
        // CSS pixels per map unit at the current zoom: the SVG keeps its aspect
        // ratio, so the smaller axis decides the rendered scale.
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
    const home = homeSpace !== undefined ? SPACE_BY_ID[homeSpace] : undefined;
    const readout = hovered === undefined ? undefined : G.spaces[hovered] !== undefined ? spaceSummary(G, hovered) : seaSummary(G, hovered);
    return <div className="vq-map">
        <svg ref={svgRef} viewBox="0 0 1000 620" role="group" aria-label={i18n.chain.vq.map.ariaLabel}
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
            <rect width={1000} height={620} fill="#b8d0cb"/>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                <path d={land.path} fill="#e7dab9" stroke="#8a967b" strokeWidth={0.9} fillRule="evenodd"/>
                {[0, 10, 20, 30].map((lon) => <line key={lon} x1={project(lon, 59)[0]} y1={0} x2={project(lon, 30)[0]} y2={620} stroke="#597f7920" strokeDasharray="2 6"/>)}
                {[35, 45, 55].map((lat) => <line key={lat} x1={0} y1={project(-13, lat)[1]} x2={1000} y2={project(37, lat)[1]} stroke="#597f7920" strokeDasharray="2 6"/>)}
                <text x={480} y={110} fontFamily="Georgia, serif" fontSize={28} letterSpacing={12} fill="#8c754333" pointerEvents="none">EUROPA</text>
                {LAND_LINKS.map(([a, b, pass], i) => {
                    const [ax, ay] = project(SPACE_BY_ID[a].lon, SPACE_BY_ID[a].lat);
                    const [bx, by] = project(SPACE_BY_ID[b].lon, SPACE_BY_ID[b].lat);
                    return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={pass ? "#85644b" : "#8b7954"} strokeWidth={pass ? 1.4 : 0.8}
                                 strokeDasharray={pass ? "3 2" : undefined} opacity={0.65} pointerEvents="none"/>;
                })}
                {SEA_ZONES.map((zone) => {
                    const [x, y] = project(zone.label[0], zone.label[1]);
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
                        <rect className="vq-hit" x={x - 44} y={y - 12} width={88} height={25} rx={5} fill={selected === zone.id ? "#faf3df" : "#c8dcd680"}
                              stroke={origin === zone.id ? "#2d6b71" : selected === zone.id ? "#805012" : "transparent"}
                              strokeDasharray={origin === zone.id ? "3 2" : undefined}/>
                        <text x={x} y={y} fontSize={9} fill="#2e5d5b" fontFamily="Georgia, serif" fontStyle="italic" textAnchor="middle">{seaZoneName(zone.id, vqLocale)}</text>
                        {count > 0 && <text x={x} y={y + 10} fontSize={8} textAnchor="middle" fill="#244c49">⚓ {count}</text>}
                        {highlighted && <rect className="vq-legal-ring" x={x - 46} y={y - 14} width={92} height={29} rx={7} fill="none"/>}
                    </g>;
                })}
                {SPACES.map((space) => <SpaceShape key={space.id} id={space.id} G={G} selected={selected} origin={origin} onSelect={onSelect} scale={view.scale} highlights={highlights} dimUnavailable={dimUnavailable} onHover={setHovered}/>)}
            </g>
        </svg>
        <MapLegend/>
        <div className="vq-map-controls">
            <IconButton size="small" aria-label={i18n.chain.vq.map.zoomIn} disabled={view.scale >= 4} onClick={() => setView((current) => zoomView(current, 1.35, [500, 310]))}><AddIcon fontSize="small"/></IconButton>
            <span style={{minWidth: 36, textAlign: "center", fontSize: 11}} aria-live="polite">{Math.round(view.scale * 100)}%</span>
            <IconButton size="small" aria-label={i18n.chain.vq.map.zoomOut} disabled={view.scale <= 1} onClick={() => setView((current) => zoomView(current, 1 / 1.35, [500, 310]))}><RemoveIcon fontSize="small"/></IconButton>
            {home !== undefined && <IconButton size="small" aria-label={`${i18n.chain.vq.map.centerHome} · ${spaceName(home.id, vqLocale)}`} title={`${i18n.chain.vq.map.centerHome} · ${spaceName(home.id, vqLocale)}`}
                onClick={() => setView((current) => centerView(project(home.lon, home.lat), Math.max(current.scale, 2)))}><MyLocationIcon fontSize="small"/></IconButton>}
            <IconButton size="small" aria-label={i18n.chain.vq.map.reset} onClick={() => setView(INITIAL_VIEW)}><RestartAltIcon fontSize="small"/></IconButton>
        </div>
        {readout !== undefined && readout !== "" && <div className="vq-map-readout" aria-hidden="true">{readout}</div>}
        <div className="vq-map-caption"><span>{i18n.chain.vq.map.legend}</span><span className="vq-map-help">{i18n.chain.vq.map.help}</span></div>
    </div>;
};

export const religionLabel = (r: Religion): string => r === "protestant" ? i18n.chain.vq.map.protestant : i18n.chain.vq.map.catholic;
