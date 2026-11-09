// Shared by the geographic background and every game marker. Coordinates are
// equirectangular; the background generator uses this same extent and padding.
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;
export const MAP_EXTENT = [-13, 30, 37, 59] as const;
export const project = (lon: number, lat: number): [number, number] => [
    20 + (lon - MAP_EXTENT[0]) / (MAP_EXTENT[2] - MAP_EXTENT[0]) * 960,
    20 + (MAP_EXTENT[3] - lat) / (MAP_EXTENT[3] - MAP_EXTENT[1]) * 580,
];

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
