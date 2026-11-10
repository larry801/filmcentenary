// Shared by the geographic background and every game marker. Coordinates are
// equirectangular; the background generator uses this same extent and padding.
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;
export const MAP_EXTENT = [-13, 30, 37, 59] as const;
export const project = (lon: number, lat: number): [number, number] => [
    20 + (lon - MAP_EXTENT[0]) / (MAP_EXTENT[2] - MAP_EXTENT[0]) * 960,
    20 + (MAP_EXTENT[3] - lat) / (MAP_EXTENT[3] - MAP_EXTENT[1]) * 580,
];

/**
 * Board-style regional magnification.
 *
 * The printed Virgin Queen map is deliberately not a uniform-scale map.  The
 * Low Countries, Rhineland and northern Italy are drawn at a larger scale so
 * their many cities remain playable, while Iberia and the Mediterranean stay
 * comparatively compact.  We keep the real equirectangular projection above as
 * the source of truth and apply this smooth displacement only to the display
 * layer.
 *
 * A Gaussian falloff means coastlines, cities and sea-zone labels move together
 * without seams.  It is a cartogram, not a jitter: nearby places retain their
 * relative geography, but dense clusters gain room to breathe.
 */
interface MagnificationRegion {
    centre: [number, number];
    radius: [number, number];
    scale: [number, number];
}

const MAGNIFIED_REGIONS: readonly MagnificationRegion[] = [
    // Low Countries + lower Rhineland.  This is the most crowded area of the
    // real-scale map and the printed board gives it by far the most room.
    {centre: [365, 172], radius: [58, 52], scale: [2.35, 2.05]},
    // Northern Italy (Milan, Genoa, Venice, Florence, Rome).
    {centre: [489, 326], radius: [70, 68], scale: [1.65, 1.5]},
    // Britain is kept slightly larger so its ports and the Irish Sea labels do
    // not crowd the Channel.
    {centre: [192, 154], radius: [62, 74], scale: [1.18, 1.14]},
];

const gaussian = (value: number, radius: number): number =>
    Math.exp(-0.5 * (value / radius) ** 2);

export const warpMapPoint = (point: [number, number]): [number, number] => {
    let x = point[0];
    let y = point[1];
    for (const region of MAGNIFIED_REGIONS) {
        const [cx, cy] = region.centre;
        const [rx, ry] = region.radius;
        const weight = gaussian(x - cx, rx) * gaussian(y - cy, ry);
        x += (x - cx) * (region.scale[0] - 1) * weight;
        y += (y - cy) * (region.scale[1] - 1) * weight;
    }
    return [x, y];
};

/** Project a true lon/lat and apply the board's regional magnification. */
export const mapProject = (lon: number, lat: number): [number, number] =>
    warpMapPoint(project(lon, lat));

/**
 * Apply the same display warp to the preprojected Natural Earth coastline.
 * The generated background contains only absolute M/L/Z commands, so every
 * coordinate pair can be transformed with one pass and remains aligned with
 * the city and sea-zone layers.
 */
export const warpSvgPath = (path: string): string =>
    path.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_match, rawX: string, rawY: string) => {
        const [x, y] = warpMapPoint([Number(rawX), Number(rawY)]);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

export interface MapView {scale: number; x: number; y: number}
export const INITIAL_VIEW: MapView = {scale: 1, x: 0, y: 0};
export const clampView = (view: MapView): MapView => {
    const scale = Math.max(1, Math.min(4, view.scale));
    return {scale, x: Math.min(0, Math.max(MAP_WIDTH * (1 - scale), view.x)),
        y: Math.min(0, Math.max(MAP_HEIGHT * (1 - scale), view.y))};
};
export const zoomView = (view: MapView, factor: number, anchor: [number, number]): MapView => {
    const scale = Math.max(1, Math.min(4, view.scale * factor));
    const ratio = scale / view.scale;
    return clampView({scale, x: anchor[0] - (anchor[0] - view.x) * ratio,
        y: anchor[1] - (anchor[1] - view.y) * ratio});
};
export const isMapDrag = (distance: number): boolean => distance > 6;

export interface MapTarget {id: string; x: number; y: number}
export const MAP_NODE_HIT_RADIUS = 12;
export const MAP_ZONE_HIT_HALF_WIDTH = 44;
export const MAP_ZONE_HIT_HALF_HEIGHT = 12.5;
/** Smallest on-screen hit radius, in CSS pixels, for touch and for mouse input. */
export const MIN_TOUCH_HIT_PX = 22;
export const MIN_MOUSE_HIT_PX = 10;
/** Upper bound for the widened radius so a far-off tap never selects anything. */
export const MAX_NODE_HIT_RADIUS = 40;

/**
 * Hit radius in map units for the current render size.  `pixelsPerUnit` is
 * how many CSS pixels one map unit covers at the current zoom; on a phone the
 * whole map is ~390px wide, so the base 12-unit radius is only ~4px.
 */
export const nodeHitRadius = (pixelsPerUnit: number, coarse: boolean): number => {
    if (!(pixelsPerUnit > 0)) return MAP_NODE_HIT_RADIUS;
    const minimum = (coarse ? MIN_TOUCH_HIT_PX : MIN_MOUSE_HIT_PX) / pixelsPerUnit;
    return Math.min(MAX_NODE_HIT_RADIUS, Math.max(MAP_NODE_HIT_RADIUS, minimum));
};

/** View that puts `point` (map units) at the centre of the map at `scale`. */
export const centerView = (point: [number, number], scale: number): MapView =>
    clampView({scale, x: MAP_WIDTH / 2 - point[0] * scale, y: MAP_HEIGHT / 2 - point[1] * scale});

/**
 * Markers are only a few pixels apart on the full map, so their 12px hit areas
 * overlap and the topmost one swallows clicks meant for its neighbour. Pick the
 * target whose centre is closest to the pointer instead of trusting DOM order.
 *
 * A marker inside the base radius wins, then a sea-zone label the pointer is
 * on, then the nearest marker within the widened `radius` (used for touch).
 * Widening therefore never steals a tap that lands on a sea label.
 */
export const nearestMapTarget = (
    x: number,
    y: number,
    spaces: MapTarget[],
    zones: MapTarget[],
    radius: number = MAP_NODE_HIT_RADIUS,
): string | undefined => {
    let nearestSpace: {id: string; distance: number} | undefined;
    for (const space of spaces) {
        const distance = Math.hypot(x - space.x, y - space.y);
        if (distance <= Math.max(radius, MAP_NODE_HIT_RADIUS) && (nearestSpace === undefined || distance < nearestSpace.distance)) {
            nearestSpace = {id: space.id, distance};
        }
    }
    if (nearestSpace !== undefined && nearestSpace.distance <= MAP_NODE_HIT_RADIUS) {
        return nearestSpace.id;
    }
    let nearestZone: {id: string; distance: number} | undefined;
    for (const zone of zones) {
        const distance = Math.max(
            Math.abs(x - zone.x) / MAP_ZONE_HIT_HALF_WIDTH,
            Math.abs(y - zone.y) / MAP_ZONE_HIT_HALF_HEIGHT,
        );
        if (distance <= 1 && (nearestZone === undefined || distance < nearestZone.distance)) {
            nearestZone = {id: zone.id, distance};
        }
    }
    return nearestZone?.id ?? nearestSpace?.id;
};


/* ------------------------------------------------------------------------- */
/* Cartographic de-cluttering                                               */
/* ------------------------------------------------------------------------- */

export interface LayoutPoint {
    id: string;
    x: number;
    y: number;
}

export interface RelaxOptions {
    /** Preferred centre-to-centre distance for map markers, in map units. */
    minDistance?: number;
    /** Pull back toward the true geographic projection. */
    anchorStrength?: number;
    iterations?: number;
}

/**
 * Expand locally crowded places while keeping every marker close to its true
 * longitude/latitude projection.  The printed Virgin Queen board does the same
 * thing by hand: the Low Countries, northern Italy and the Rhineland get more
 * room than their geographic area would normally allow.
 *
 * This is a small, deterministic force relaxation (not a physics dependency).
 * Each pair closer than `minDistance` pushes itself apart, while a weak spring
 * pulls every marker back to its real map position.  The result is stable and
 * can safely run once when the map data module is loaded.
 */
export const relaxMapPoints = (
    points: readonly LayoutPoint[],
    options: RelaxOptions = {},
): Record<string, {x: number; y: number}> => {
    const minDistance = options.minDistance ?? 34;
    const anchorStrength = options.anchorStrength ?? 0.01;
    const iterations = options.iterations ?? 2200;
    const state = points.map((point, index) => ({
        id: point.id,
        baseX: point.x,
        baseY: point.y,
        x: point.x,
        y: point.y,
        jitter: index * 2.399963229728653,
    }));
    const count = state.length;
    const pushX = new Float64Array(count);
    const pushY = new Float64Array(count);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        pushX.fill(0);
        pushY.fill(0);
        for (let i = 0; i < count; i += 1) {
            for (let j = i + 1; j < count; j += 1) {
                const a = state[i];
                const b = state[j];
                let dx = a.x - b.x;
                let dy = a.y - b.y;
                let distance = Math.hypot(dx, dy);
                if (distance >= minDistance) continue;
                if (distance < 0.001) {
                    // Deterministic tie-break for coincident or near-coincident
                    // points.  Real coordinates are never exactly equal, but
                    // keeping the solver deterministic makes static rendering
                    // and tests reproducible.
                    dx = Math.cos(a.jitter);
                    dy = Math.sin(a.jitter);
                    distance = 1;
                }
                const nx = dx / distance;
                const ny = dy / distance;
                const push = (minDistance - distance) * 0.5;
                pushX[i] += nx * push;
                pushY[i] += ny * push;
                pushX[j] -= nx * push;
                pushY[j] -= ny * push;
            }
        }
        for (let i = 0; i < count; i += 1) {
            const point = state[i];
            point.x += pushX[i] + (point.baseX - point.x) * anchorStrength;
            point.y += pushY[i] + (point.baseY - point.y) * anchorStrength;
            // Keep callout markers inside the usable map rectangle.  A little
            // margin leaves room for labels and the marker strokes.
            point.x = Math.max(18, Math.min(MAP_WIDTH - 18, point.x));
            point.y = Math.max(18, Math.min(MAP_HEIGHT - 18, point.y));
        }
    }

    return Object.fromEntries(state.map((point) => [point.id, {x: point.x, y: point.y}]));
};

export interface MapLabelBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MapLabelInput {
    id: string;
    /** Marker centre, in map units. */
    x: number;
    y: number;
    text: string;
    /** Higher-priority labels are placed first and keep their preferred slot. */
    priority: number;
    visible: boolean;
}

export type MapLabelAnchor = "start" | "middle" | "end";

export interface MapLabelPlacement {
    /** Text centre, in map units. */
    x: number;
    y: number;
    textAnchor: MapLabelAnchor;
    box: MapLabelBox;
    /** Draw a hairline from the marker to the label when the label is moved. */
    leader?: {x1: number; y1: number; x2: number; y2: number};
}

export interface LabelLayoutOptions {
    fontSize?: number;
    /** Visual obstacles other than markers, such as sea-zone labels. */
    obstacles?: readonly MapLabelBox[];
}

/** Approximate rendered width in SVG map units.  CJK glyphs are full-width. */
export const mapTextWidth = (text: string, fontSize: number): number => {
    let width = 0;
    for (const character of Array.from(text)) {
        if (/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(character)) width += fontSize;
        else if (character === " ") width += fontSize * 0.32;
        else if (/[MW@#%&]/.test(character)) width += fontSize * 0.72;
        else if (/[ilI.,'`|]/.test(character)) width += fontSize * 0.28;
        else width += fontSize * 0.56;
    }
    return width;
};

const labelBoxAt = (
    x: number,
    y: number,
    width: number,
    height: number,
    textAnchor: MapLabelAnchor,
): MapLabelBox => ({
    x: textAnchor === "start" ? x : textAnchor === "end" ? x - width : x - width / 2,
    y: y - height / 2,
    width,
    height,
});

const overlapArea = (a: MapLabelBox, b: MapLabelBox): number => {
    const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return width > 0 && height > 0 ? width * height : 0;
};

/** Nearest point on or inside a rectangle to another point. */
const nearestPointOnBox = (box: MapLabelBox, x: number, y: number): [number, number] => [
    Math.max(box.x, Math.min(box.x + box.width, x)),
    Math.max(box.y, Math.min(box.y + box.height, y)),
];

const LABEL_DIRECTIONS: readonly [number, number, MapLabelAnchor][] = [
    [0, -1, "middle"],
    [0, 1, "middle"],
    [1, 0, "start"],
    [-1, 0, "end"],
    [0.72, -0.72, "start"],
    [-0.72, -0.72, "end"],
    [0.72, 0.72, "start"],
    [-0.72, 0.72, "end"],
];

const LABEL_DISTANCES = [14, 22, 32, 44, 58, 74] as const;

/**
 * Place city labels around their markers without stacking them on top of one
 * another.  Candidate slots circle each marker; the first collision-free slot
 * wins, and a thin leader line keeps displaced labels unambiguous.
 *
 * Label placement is intentionally an approximation.  It runs in map units and
 * does not require DOM measurement, so SSR and the browser produce the same
 * layout.  If the map becomes truly packed, low-priority labels are allowed to
 * be omitted rather than painted over a more important city.
 */
export const placeMapLabels = (
    labels: readonly MapLabelInput[],
    options: LabelLayoutOptions = {},
): Record<string, MapLabelPlacement> => {
    const fontSize = options.fontSize ?? 9.5;
    const height = fontSize + 3;
    const occupied: MapLabelBox[] = [];
    // Reserve room for the marker itself, its selection/highlight halo and the
    // small unit-count badge that sits just above/right of the marker.
    const markers = labels.map((label) => ({
        x: label.x - 10,
        y: label.y - 18,
        width: 34,
        height: 30,
    }));
    const padBox = (box: MapLabelBox, padding: number): MapLabelBox => ({
        x: box.x - padding,
        y: box.y - padding,
        width: box.width + padding * 2,
        height: box.height + padding * 2,
    });
    for (const obstacle of options.obstacles ?? []) occupied.push(obstacle);

    const result: Record<string, MapLabelPlacement> = {};
    const sorted = labels
        .filter((label) => label.visible)
        .slice()
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const label of sorted) {
        const width = mapTextWidth(label.text, fontSize);
        let best: {
            x: number;
            y: number;
            textAnchor: MapLabelAnchor;
            box: MapLabelBox;
            score: number;
            overlap: number;
        } | undefined;
        const ownMarker = markers[labels.indexOf(label)];
        for (const distance of LABEL_DISTANCES) {
            for (const [ux, uy, textAnchor] of LABEL_DIRECTIONS) {
                const x = label.x + ux * distance;
                const y = label.y + uy * distance;
                const box = labelBoxAt(x, y, width, height, textAnchor);
                const paddedBox = padBox(box, 2.5);
                let overlap = 0;
                for (const existing of occupied) overlap += overlapArea(paddedBox, existing);
                for (let index = 0; index < markers.length; index += 1) {
                    if (markers[index] === ownMarker) continue;
                    overlap += overlapArea(paddedBox, markers[index]);
                }
                // Out-of-bounds labels are never useful on a pan/zoom map.
                const outside = Math.max(0, 8 - box.x) + Math.max(0, box.x + box.width - (MAP_WIDTH - 8)) +
                    Math.max(0, 8 - box.y) + Math.max(0, box.y + box.height - (MAP_HEIGHT - 8));
                const score = overlap * 50 + outside * 80 + distance * 0.12 + (uy > 0 && Math.abs(ux) < 0.1 ? 1.5 : 0);
                if (best === undefined || score < best.score) {
                    best = {x, y, textAnchor, box, score, overlap};
                }
            }
        }
        if (best === undefined) continue;
        // Leave low-value labels out rather than accepting a serious collision.
        // Selected / legal / key targets are always drawn because the user needs
        // to be able to read the result of an action.
        if (best.overlap > 0 && label.priority < 350) continue;
        const [leaderX, leaderY] = nearestPointOnBox(best.box, label.x, label.y);
        const leaderDistance = Math.hypot(leaderX - label.x, leaderY - label.y);
        result[label.id] = {
            x: best.x,
            y: best.y,
            textAnchor: best.textAnchor,
            box: best.box,
            ...(leaderDistance > 13 ? {leader: {x1: label.x, y1: label.y, x2: leaderX, y2: leaderY}} : {}),
        };
        occupied.push(best.box);
    }
    return result;
};
