import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, SPACE_IDS, connectionsOf, isNavalBox} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {ieT} from "./i18n";

const MIN_K = 0.9;
const MAX_K = 7;

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

const markerRadius = (id: SpaceId): number => (isNavalBox(id) ? 60 : SPACES[id].type === "territory" ? 34 : 42);

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
}

/**
 * Zoomable printed board.  Space positions are the VASSAL module's zone
 * centroids, so the markers line up with the printed spaces; connections are
 * drawn from the transcribed adjacency data, not from the coordinates.
 */
export const IEMap = React.memo(
  ({G, selected, onSelect, legalTargets = [], moveTargets = [], battleTargets = [], locale, board = "world"}: IEMapProps) => {
    const t = ieT();
    const [view, setView] = React.useState({k: 1, x: 0, y: 0});
    const drag = React.useRef<{x: number; y: number; vx: number; vy: number; moved: boolean} | null>(null);
    const [dragging, setDragging] = React.useState(false);
    const svgRef = React.useRef<SVGSVGElement | null>(null);
    const W = 7706;
    const H = 5462;

    const zoom = (factor: number, cx = W / 2, cy = H / 2) => {
      setView((v) => {
        const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
        // Keep the point under the cursor stable.
        const x = cx - ((cx - v.x) / v.k) * k;
        const y = cy - ((cy - v.y) / v.k) * k;
        return {k, x, y};
      });
    };

    const onWheel = (event: React.WheelEvent) => {
      event.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      const cx = rect ? ((event.clientX - rect.left) / rect.width) * W : W / 2;
      const cy = rect ? ((event.clientY - rect.top) / rect.height) * H : H / 2;
      zoom(event.deltaY < 0 ? 1.18 : 1 / 1.18, cx, cy);
    };

    const onPointerDown = (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      drag.current = {x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, moved: false};
      setDragging(true);
    };
    const onPointerMove = (event: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = ((event.clientX - d.x) / rect.width) * W;
      const dy = ((event.clientY - d.y) / rect.height) * H;
      if (Math.abs(event.clientX - d.x) + Math.abs(event.clientY - d.y) > 4) d.moved = true;
      setView((v) => ({...v, x: d.vx + dx, y: d.vy + dy}));
    };
    const onPointerUp = () => {
      setDragging(false);
      setTimeout(() => { drag.current = null; }, 0);
    };

    const label = (id: SpaceId) => (locale === "zh_CN" ? SPACES[id].nameZh : SPACES[id].name);

    // Recompute the highlight set only when the target arrays change.
    const highlight = React.useMemo(
      () => new Set([...legalTargets, ...moveTargets, ...battleTargets]),
      [legalTargets, moveTargets, battleTargets],
    );

    // Label visibility threshold — crossing 2.4 is the only zoom level that
    // changes which labels are shown, so we memo on the boolean rather than
    // the raw zoom level to avoid re-rendering on every wheel tick.
    const denseLabels = view.k > 2.4;

    // Recompute space markers only when the spaces, selection, highlights,
    // locale or the dense-labels threshold change — not on every G update.
    const spaceElements = React.useMemo(() => {
      if (board !== "world") return null;
      return SPACE_IDS.map((id) => {
        const space = SPACES[id];
        const state = G.spaces[id];
        if (!state) return null;
        const r = markerRadius(id);
        const fill = colorFor(state.control);
        const isHighlighted = highlight.has(id);
        const isSelected = selected === id;
        const stroke = isHighlighted ? "#f4d574" : isSelected ? "#fff4cf" : darkFor(state.control);
        const strokeWidth = isHighlighted || isSelected ? 12 : 6;
        const units = state.units.length;
        const showLabel = isSelected || denseLabels || isHighlighted;
        return (
          <g key={id} transform={`translate(${space.x} ${space.y})`}
            onClick={(event) => {
              event.stopPropagation();
              if (drag.current?.moved) return;
              onSelect(id);
            }}
            style={{cursor: "pointer"}} data-testid={`ie-space-${id}`}
          >
            {isHighlighted && <circle r={r + 16} fill="none" stroke="#f4d574" strokeWidth={8} opacity={0.9}/>}
            {space.type === "capital" || space.type === "subcapital" ? (
              <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}><Star r={r}/></g>
            ) : space.type === "navalBase" ? (
              <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}><Triangle r={r}/></g>
            ) : isNavalBox(id) ? (
              <rect x={-r * 1.4} y={-r * 0.8} width={r * 2.8} height={r * 1.6} rx={8} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.95}/>
            ) : space.type === "territory" ? (
              <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
            ) : (
              <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={10} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
            )}
            {state.fort && <text y={r + 36} textAnchor="middle" fontSize={38} fill="#f7e8bc">▲{state.fort.level}</text>}
            {state.trench && <text x={-r} y={-r - 12} fontSize={30} fill="#e8c96d">▦</text>}
            {units > 0 && (
              <g>
                <circle cx={r * 0.9} cy={-r * 0.9} r={26} fill="#1b1611" stroke="#e8d8b5" strokeWidth={4}/>
                <text x={r * 0.9} y={-r * 0.9 + 10} textAnchor="middle" fontSize={28} fill="#f4e8ce">{units}</text>
              </g>
            )}
            {showLabel && (
              <text y={r + (units > 0 ? 72 : 46)} textAnchor="middle" className={`ie-space-label ${state.control && POWER_DEFS[state.control as Power]?.id === "GE" ? "dark" : ""}`}>
                {label(id)}
              </text>
            )}
          </g>
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [G.spaces, selected, highlight, locale, board, denseLabels, onSelect]);

    // Recompute connection lines only when selection or board changes.
    const connectionLines = React.useMemo(() => {
      if (board !== "world" || !selected) return null;
      return connectionsOf(selected).map((c) => {
        const other = c.a === selected ? c.b : c.a;
        const a = SPACES[selected];
        const b = SPACES[other];
        if (!a || !b) return null;
        return <line key={`${selected}-${other}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={c.type === "sea" ? "#d24a3a" : c.type === "difficult" ? "#6b4a2a" : c.type === "severe" ? "#b23a2a" : "#3b2e20"}
          strokeWidth={8} strokeDasharray={c.type === "sea" || c.type === "severe" ? "22 18" : c.type === "difficult" ? "14 12" : undefined}
          opacity={0.8} pointerEvents="none"/>;
      });
    }, [selected, board]);

    return (
      <div className="ie-map-wrap">
        <div className="ie-map-controls">
          <button aria-label={t.zoomIn} title={t.zoomIn} onClick={() => zoom(1.3)}>+</button>
          <button aria-label={t.zoomOut} title={t.zoomOut} onClick={() => zoom(1 / 1.3)}>−</button>
          <button aria-label={t.resetZoom} title={t.resetZoom} onClick={() => setView({k: 1, x: 0, y: 0})}>⟲</button>
        </div>
        <svg
          ref={svgRef}
          className={`ie-map ${dragging ? "dragging" : ""}`}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          data-testid="ie-map"
          role="img"
          aria-label={t.map}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <image href={board === "greatWar" ? "/imperial-elegy/maps/greatWar.jpg" : "/imperial-elegy/maps/world.jpg"} x={0} y={0} width={W} height={H}/>
            {spaceElements}
            {connectionLines}
          </g>
        </svg>
        <div className="ie-map-legend">
          <span>{t.map}: {locale === "zh_CN" ? "可缩放/拖动；点击空间" : "zoom / drag; click a space"}</span>
          {(["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]).map((p) => (
            <span key={p}><i style={{display: "inline-block", width: 10, height: 10, background: POWER_DEFS[p].color, marginRight: 3, border: "1px solid #000"}}/>{t.seats[p]}</span>
          ))}
          <span><i style={{display: "inline-block", width: 10, height: 10, background: "#7b5aa6", marginRight: 3, border: "1px solid #000"}}/>{t.neutral}</span>
        </div>
      </div>
    );
  },
  // Custom comparator: skip re-render when only unrelated G fields changed.
  (prev, next) =>
    prev.G.spaces === next.G.spaces &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect &&
    prev.legalTargets === next.legalTargets &&
    prev.moveTargets === next.moveTargets &&
    prev.battleTargets === next.battleTargets &&
    prev.locale === next.locale &&
    prev.board === next.board,
);
