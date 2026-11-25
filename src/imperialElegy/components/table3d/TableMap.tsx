/**
 * The 3D table, as a board region.
 *
 * It is the same board as `IEMap` — same `G`, same `selected`, same legal
 * targets, same click contract (`onSelect`) — with a camera instead of a
 * viewBox.  The component owns the camera, the pointers and the HTML overlay;
 * `scene.ts` owns three.js.  Nothing here knows a rule.
 *
 * Interaction parity with the SVG map is deliberate:
 *   - click a marker selects its space (nearest marker wins, targets tie-break);
 *   - the arrows walk the legal targets, Enter selects the focused one;
 *   - the map's own controls still zoom, reset, focus the selection and fit the
 *     targets;
 *   - a `MapFrameRequest` (whole map / theatre / capital / atlas sheet) frames
 *     the camera exactly as it re-frames the viewBox.
 *
 * WebGL is not guaranteed: a browser without it calls `onUnavailable` and the
 * host draws the sheet instead, so a match is never blocked by the renderer.
 */
import React from "react";
import background from "../../data/map-background.json";
import {SPACES, SPACE_IDS, spaceLabel} from "../../constant/spaces";
import type {BoardRect} from "../map-geometry";
import {THEATRES, theatreById, theatreOf} from "../map-geometry";
import {StackPopover} from "../StackPopover";
import {stackSummary} from "../stackSummary";
import {POWER_KEYS, bi} from "../boardHelpers";
import {Icon} from "../Icon";
import {useCoarsePointer} from "../useCoarsePointer";
import {ieT} from "../i18n";
import type {ImperialElegyState, Power, SpaceId, Unit} from "../../types";
import type {MapFrameRequest, MapTarget} from "../map";
import {
  type BoardBox,
  type TableArt,
  type TableCamera,
  type Vec2,
  type Viewport,
  MIN_DISTANCE,
  OVERHEAD_PITCH,
  boundsOf,
  cameraPosition,
  defaultCamera,
  frameBox,
  orbitCamera,
  panCamera,
  projectPoint,
  tweenCamera,
  zoomCamera,
} from "./camera";
import {TableScene} from "./scene";

export interface TableMapProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  onSelect: (id: SpaceId) => void;
  targets: readonly MapTarget[];
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  focusedTarget?: SpaceId | null;
  onFocusTarget?: (id: SpaceId | null) => void;
  frame?: MapFrameRequest | null;
  focus?: {x: number; y: number; nonce: number} | null;
  homeCapital?: SpaceId | null;
  /** An atlas sheet's crop, when one is selected. */
  section?: BoardRect | null;
  art: TableArt;
  /** The renderer could not start; the host falls back to the sheet. */
  onUnavailable: () => void;
}

const PAPER: BoardBox = {
  x: background.paper?.[0] ?? 0,
  y: background.paper?.[1] ?? 0,
  width: (background.paper?.[2] ?? 7706) - (background.paper?.[0] ?? 0),
  height: (background.paper?.[3] ?? 5462) - (background.paper?.[1] ?? 0),
};

const DRAG_THRESHOLD = 6;

/** The board box of a theatre id, or the whole sheet. */
const theatreBox = (id: string | undefined): BoardBox => {
  const theatre = id === undefined ? undefined : theatreById(id);
  return theatre ? theatre.box : PAPER;
};

export const TableMap = ({
  G, selected, onSelect, targets, locale, t, focusedTarget = null, onFocusTarget,
  frame = null, focus = null, homeCapital = null, section = null, art, onUnavailable,
}: TableMapProps) => {
  const holder = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const sceneRef = React.useRef<TableScene | null>(null);
  const cameraRef = React.useRef<TableCamera>(defaultCamera({x: PAPER.x + PAPER.width / 2, y: PAPER.y + PAPER.height / 2}));
  const viewportRef = React.useRef<Viewport>({width: 960, height: 600});
  const tweenRef = React.useRef<number | null>(null);
  const pointedRef = React.useRef<{id: number; start: Vec2; last: Vec2; dragging: boolean; button: number} | null>(null);
  const pinchRef = React.useRef<Map<number, Vec2>>(new Map());
  const pinchDistanceRef = React.useRef<number | null>(null);
  const overlayFrame = React.useRef(0);
  const framedRef = React.useRef(false);
  const coarse = useCoarsePointer();

  const [ready, setReady] = React.useState(false);
  const [stats, setStats] = React.useState({markers: 0, tokens: 0, texture: "pending" as "pending" | "loaded"});
  const [hovered, setHovered] = React.useState<SpaceId | null>(null);
  const [hoverAt, setHoverAt] = React.useState<Vec2 | null>(null);
  const [stackOpen, setStackOpen] = React.useState<SpaceId | null>(null);
  const [, setOverlayTick] = React.useState(0);

  const units = React.useMemo(() => Object.values(G.units ?? {}) as Unit[], [G.units]);
  const stacks = React.useMemo(() => {
    const index = new Map<SpaceId, ReturnType<typeof stackSummary>>();
    for (const id of SPACE_IDS) {
      if (!G.spaces[id]) continue;
      const stack = stackSummary(units, id);
      if (stack.length > 0) index.set(id, stack);
    }
    return index;
  }, [units, G.spaces]);

  // The overlay is drawn in DOM, so it has to be laid out again whenever the
  // camera moves.  One rAF-coalesced tick per frame is enough; a pointer drag
  // fires far more often than the browser paints.
  const overlayTick = React.useCallback(() => {
    if (overlayFrame.current !== 0) return;
    overlayFrame.current = requestAnimationFrame(() => {
      overlayFrame.current = 0;
      setOverlayTick((tick) => tick + 1);
    });
  }, []);

  const applyCamera = React.useCallback((next: TableCamera) => {
    cameraRef.current = next;
    sceneRef.current?.setCamera(next);
    overlayTick();
  }, [overlayTick]);

  // --------------------------------------------------------------- lifecycle

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const holderNode = holder.current;
    if (canvas === null || holderNode === null) return;
    let scene: TableScene;
    try {
      scene = new TableScene(canvas, {
        art,
        onContextLost: () => onUnavailable(),
        onSheetLoaded: () => setStats(sceneRef.current?.stats() ?? stats),
      });
    } catch {
      onUnavailable();
      return;
    }
    sceneRef.current = scene;
    const measure = (): void => {
      const rect = holderNode.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      viewportRef.current = {width: rect.width, height: rect.height};
      scene.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      if (!framedRef.current) {
        framedRef.current = true;
        const viewerCapital = homeCapital !== null ? SPACES[homeCapital] : undefined;
        const start = viewerCapital ? theatreBox(theatreOf(viewerCapital).id) : (section ?? PAPER);
        cameraRef.current = frameBox(cameraRef.current, viewportRef.current, start);
        scene.setCamera(cameraRef.current);
        overlayTick();
      }
      setReady(true);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(holderNode);
    return () => {
      observer?.disconnect();
      sceneRef.current = null;
      scene.dispose();
      if (overlayFrame.current !== 0) cancelAnimationFrame(overlayFrame.current);
      if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    };
    // The scene is built once for the lifetime of this mount.  Art and state
    // changes are pushed through their own effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    sceneRef.current?.setArt(art);
  }, [art]);

  React.useEffect(() => {
    const scene = sceneRef.current;
    if (scene === null) return;
    scene.setState({G, selected, targets});
    setStats(scene.stats());
  }, [G, selected, targets, art, ready]);

  // ---------------------------------------------------------------- framing

  const tweenTo = React.useCallback((to: TableCamera) => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      applyCamera(to);
      return;
    }
    const from = cameraRef.current;
    const started = performance.now();
    const step = (): void => {
      const progress = Math.min(1, (performance.now() - started) / 420);
      applyCamera(tweenCamera(from, to, progress));
      tweenRef.current = progress < 1 ? requestAnimationFrame(step) : null;
      if (progress >= 1) tweenRef.current = null;
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [applyCamera]);

  React.useEffect(() => {
    if (frame === null) return;
    const capitalSpace = SPACES[frame.space ?? homeCapital ?? ""] ?? SPACES[SPACE_IDS[0]];
    const box = frame.kind === "capital" && capitalSpace
      ? theatreBox(theatreOf(capitalSpace).id)
      : frame.kind === "theatre" ? theatreBox(frame.theatre) : (section ?? PAPER);
    const pitch = frame.kind === "fit" && section === null ? OVERHEAD_PITCH : cameraRef.current.pitch;
    tweenTo(frameBox({...cameraRef.current, pitch}, viewportRef.current, box));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.nonce]);

  React.useEffect(() => {
    if (focus === null) return;
    tweenTo({
      ...cameraRef.current,
      target: {x: focus.x, y: focus.y},
      distance: Math.min(cameraRef.current.distance, 4),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // ------------------------------------------------------------------ camera

  const zoomBy = React.useCallback((factor: number) => {
    applyCamera(zoomCamera(cameraRef.current, factor));
  }, [applyCamera]);

  const resetCamera = React.useCallback(() => {
    tweenTo(frameBox({...cameraRef.current, pitch: OVERHEAD_PITCH}, viewportRef.current, section ?? PAPER));
  }, [section, tweenTo]);

  const focusSelected = React.useCallback(() => {
    const space = selected === null ? null : SPACES[selected];
    if (!space) return;
    tweenTo({
      ...cameraRef.current,
      target: {x: space.x, y: space.y},
      distance: Math.max(MIN_DISTANCE, Math.min(cameraRef.current.distance, 2.6)),
    });
  }, [selected, tweenTo]);

  const fitTargets = React.useCallback(() => {
    const points = targets.flatMap((target) => {
      const space = SPACES[target.id];
      return space ? [{x: space.x, y: space.y}] : [];
    });
    if (points.length === 0) return;
    const box = boundsOf(points);
    const pad = Math.max(box.width, box.height) * 0.25;
    tweenTo(frameBox(cameraRef.current, viewportRef.current, {
      x: box.x - pad,
      y: box.y - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    }));
  }, [targets, tweenTo]);

  // ---------------------------------------------------------------- pointers

  const localPoint = (event: React.PointerEvent): Vec2 => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 2) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pinchRef.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
    pointedRef.current = {
      id: event.pointerId,
      start: {x: event.clientX, y: event.clientY},
      last: {x: event.clientX, y: event.clientY},
      dragging: false,
      button: event.button,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const local = localPoint(event);
    if (pinchRef.current.has(event.pointerId)) {
      pinchRef.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
    }
    if (pinchRef.current.size === 2) {
      // Two fingers: the change in their span zooms.
      const [a, b] = [...pinchRef.current.values()];
      const span = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistanceRef.current !== null && span > 0) {
        applyCamera(zoomCamera(cameraRef.current, pinchDistanceRef.current / span));
      }
      pinchDistanceRef.current = span;
      if (pointedRef.current !== null) pointedRef.current.dragging = true;
      return;
    }
    const press = pointedRef.current;
    if (press === null || press.id !== event.pointerId) {
      // Hover: name the space under the pointer and remember where to draw it.
      const id = sceneRef.current?.pick(local, coarse) ?? null;
      if (id !== hovered) setHovered(id as SpaceId | null);
      setHoverAt(id === null ? null : local);
      return;
    }
    const dx = event.clientX - press.last.x;
    const dy = event.clientY - press.last.y;
    press.last = {x: event.clientX, y: event.clientY};
    if (!press.dragging &&
      Math.hypot(event.clientX - press.start.x, event.clientY - press.start.y) < DRAG_THRESHOLD) return;
    press.dragging = true;
    const pan = press.button === 2 || event.shiftKey;
    applyCamera(pan
      ? panCamera(cameraRef.current, dx, dy, viewportRef.current)
      : orbitCamera(cameraRef.current, dx, dy));
  };

  const endPress = (event: React.PointerEvent<HTMLDivElement>) => {
    pinchRef.current.delete(event.pointerId);
    if (pinchRef.current.size < 2) pinchDistanceRef.current = null;
    const press = pointedRef.current;
    pointedRef.current = null;
    if (press === null || press.id !== event.pointerId || press.dragging) return;
    const local = localPoint(event);
    const id = sceneRef.current?.pick(local, coarse) ?? null;
    if (id !== null) onSelect(id as SpaceId);
  };

  // A native, non-passive listener: React's root wheel listener is passive, so
  // `preventDefault` there is ignored and the page scrolls under the table.
  React.useEffect(() => {
    const node = holder.current;
    if (node === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      applyCamera(zoomCamera(cameraRef.current, Math.exp(event.deltaY * 0.0016)));
    };
    node.addEventListener("wheel", onWheel, {passive: false});
    return () => node.removeEventListener("wheel", onWheel);
  }, [applyCamera]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const ids = targets.map((target) => target.id);
    if (ids.length === 0) return;
    const current = focusedTarget === null ? -1 : ids.indexOf(focusedTarget);
    const move = (delta: number, absolute?: number): void => {
      const next = absolute ?? (current < 0 ? (delta > 0 ? 0 : ids.length - 1) : (current + delta + ids.length) % ids.length);
      onFocusTarget?.(ids[next]);
      const space = SPACES[ids[next]];
      if (space) {
        tweenTo({...cameraRef.current, target: {x: space.x, y: space.y}});
      }
    };
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(1);
        return;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        return;
      case "Home":
        event.preventDefault();
        move(0, 0);
        return;
      case "End":
        event.preventDefault();
        move(0, ids.length - 1);
        return;
      case "Enter":
      case " ":
        if (focusedTarget !== null) {
          event.preventDefault();
          onSelect(focusedTarget);
        }
        return;
      default:
    }
  };

  // ---------------------------------------------------------------- overlay

  const project = React.useCallback((point: Vec2): Vec2 | null => {
    const projected = projectPoint(point, cameraRef.current, viewportRef.current);
    return projected === null ? null : {x: projected.x, y: projected.y};
  }, []);

  const hoveredSpace = hovered === null ? null : SPACES[hovered];
  const hoverLabel = hoveredSpace == null ? null : spaceLabel(hoveredSpace.id, locale);
  const hoverUnits = hovered === null ? 0 : (G.spaces[hovered]?.units.length ?? 0);

  const openStacks = React.useMemo(() => {
    const badges: {id: SpaceId; at: Vec2; extra: number}[] = [];
    for (const [id, stack] of stacks) {
      if (stack.length <= 3) continue;
      const space = SPACES[id];
      if (!space) continue;
      const at = project({x: space.x, y: space.y});
      if (at === null || at.x < 0 || at.y < 0 || at.x > viewportRef.current.width || at.y > viewportRef.current.height) continue;
      badges.push({id, at, extra: stack.length - 3});
    }
    return badges.slice(0, 48);
    // `stackOpen` and the overlay tick both re-place the badges.
  }, [stacks, project, stackOpen]);

  // The stack popover is the same card the SVG map opens, anchored to the
  // space's projected point.
  const popoverProjected = stackOpen === null || !SPACES[stackOpen]
    ? null
    : project({x: SPACES[stackOpen].x, y: SPACES[stackOpen].y});

  return (
    <div
      ref={holder}
      className="ie-table-3d"
      data-art={art}
      data-testid="ie-map-3d"
      data-targets={targets.map((target) => target.id).join(",")}
      data-focused-target={focusedTarget ?? undefined}
      data-markers={stats.markers}
      data-tokens={stats.tokens}
      data-sheet-texture={stats.texture}
      role="application"
      aria-label={t.map}
      aria-describedby="ie-table-3d-legend"
      tabIndex={targets.length > 0 ? 0 : -1}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={(event) => {
        if (pointedRef.current === null) {
          setHovered(null);
          setHoverAt(null);
        }
        endPress(event);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={canvasRef} className="ie-table-3d-canvas" aria-hidden="true"/>
      {!ready && (
        <div className="ie-table-3d-note" role="status" data-testid="ie-table-3d-loading">
          {bi(locale, "Laying the table…", "正在铺开桌面…")}
        </div>
      )}

      <div className="ie-map-controls">
        <button type="button" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => zoomBy(1 / 1.3)}>+</button>
        <button type="button" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => zoomBy(1.3)}>−</button>
        <button type="button" aria-label={t.resetZoom} title={t.resetZoom} onClick={resetCamera}>⟲</button>
        {targets.length > 0 && (
          <button
            type="button"
            aria-label={t.mapTargets}
            title={t.mapTargets}
            data-testid="ie-map-fit-targets"
            onClick={fitTargets}
          >◎</button>
        )}
        {selected !== null && (
          <button
            type="button"
            aria-label={t.mapFocus}
            title={t.mapFocus}
            data-testid="ie-map-focus-selected"
            onClick={focusSelected}
          ><Icon name="crosshair" size={16}/></button>
        )}
        <button
          type="button"
          aria-label={bi(locale, "Overhead view", "俯视")}
          title={bi(locale, "Overhead view", "俯视")}
          data-testid="ie-table-3d-overhead"
          onClick={() => tweenTo({...cameraRef.current, pitch: OVERHEAD_PITCH})}
        >⌃</button>
      </div>

      {hovered !== null && hoverAt !== null && hoverLabel !== null && (
        <div
          className="ie-table-3d-hover"
          data-testid="ie-table-3d-hover"
          style={{left: hoverAt.x + 14, top: hoverAt.y + 14}}
        >
          <span className="ie-table-3d-hover-name">{hoverLabel}</span>
          <span className="ie-table-3d-hover-meta">{t.units}: {hoverUnits}</span>
        </div>
      )}

      {openStacks.map((badge) => (
        <button
          key={badge.id}
          type="button"
          className="ie-table-3d-more"
          style={{left: badge.at.x, top: badge.at.y}}
          data-testid={`ie-stack-more-${badge.id}`}
          aria-label={bi(locale,
            `Show all ${badge.extra + 3} units in this space`,
            `显示该空间的全部 ${badge.extra + 3} 个单位`)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setStackOpen(badge.id);
          }}
        >
          +{badge.extra}
        </button>
      ))}

      {stackOpen !== null && popoverProjected !== null && (
        <div
          className="ie-stack-popover-anchor"
          style={{"--ie-stack-left": `${Math.max(8, popoverProjected.x + 16)}px`,
            "--ie-stack-top": `${Math.max(8, popoverProjected.y + 16)}px`} as React.CSSProperties}
        >
          <StackPopover
            entries={stacks.get(stackOpen) ?? []}
            locale={locale}
            open
            onClose={() => setStackOpen(null)}
            testId={`ie-stack-popover-${stackOpen}`}
          />
        </div>
      )}

      <div className="ie-map-legend" id="ie-table-3d-legend">
        <span>{bi(locale, "Drag to orbit · wheel to zoom · right-drag to pan", "拖拽旋转 · 滚轮缩放 · 右键拖拽平移")}</span>
        {(POWER_KEYS as Power[]).map((power) => (
          <span key={power}><i className={`ie-map-legend-dot ie-map-legend-dot-${power.toLowerCase()}`}/>{t.seats[power]}</span>
        ))}
        <span><i className="ie-map-legend-dot ie-map-legend-dot-neutral"/>{t.neutral}</span>
      </div>

      {/* Screen-reader parity without 145 tab stops: the actionable spaces are
          real buttons, off-screen, each naming what it is. */}
      <div className="ie-table-3d-a11y">
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            tabIndex={-1}
            data-testid={`ie-space-${target.id}`}
            data-target-style={target.style}
            aria-pressed={selected === target.id}
            onClick={() => onSelect(target.id)}
          >
            {spaceLabel(target.id, locale)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TableMap;
