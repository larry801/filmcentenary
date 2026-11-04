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

/**
 * Markers are only a few pixels apart on the full map, so their 12px hit areas
 * overlap and the topmost one swallows clicks meant for its neighbour. Pick the
 * target whose centre is closest to the pointer instead of trusting DOM order.
 */
export const nearestMapTarget = (
    x: number,
    y: number,
    spaces: MapTarget[],
    zones: MapTarget[],
): string | undefined => {
    let nearestSpace: {id: string; distance: number} | undefined;
    for (const space of spaces) {
        const distance = Math.hypot(x - space.x, y - space.y);
        if (distance <= MAP_NODE_HIT_RADIUS && (nearestSpace === undefined || distance < nearestSpace.distance)) {
            nearestSpace = {id: space.id, distance};
        }
    }
    if (nearestSpace !== undefined) {
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
    return nearestZone?.id;
};
