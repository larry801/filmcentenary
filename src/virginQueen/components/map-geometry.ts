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
