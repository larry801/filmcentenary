import {Controller, SpaceDef} from "../constant/general";
import {SEA_ZONES, SPACE_BY_ID, SPACES} from "../mapData";
import {project} from "../components/map-geometry";
import {WORLD_MAP_LOCATIONS} from "./world-map";

/**
 * Vector reconstruction of the printed Virgin Queen board (VQ.png).
 *
 * The physical map is a cartogram: the Low Countries, England and northern
 * Italy are drawn far larger than their true longitude/latitude area would
 * allow, while Iberia and the Mediterranean stay compact.  The geographic
 * projection used by the other map view cannot express that, so this module
 * keeps a set of city anchors traced directly from the board photo and fits a
 * smooth displacement field over the whole map:
 *
 *   board point = affine(geographic point) + weighted local residuals
 *
 * Every playable space therefore gets a board-style position that follows the
 * printed layout, while the same warp is applied to the Natural Earth
 * coastline so land, sea, cities and links all stay together.  The result is
 * pure SVG (no image asset) and can be panned and zoomed exactly like the
 * geographic map.
 */

export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 620;

/** VQ.png is 5100 × 3300; the board SVG uses the same viewBox as the old map. */
const SOURCE_PIXEL_WIDTH = 5100;
const SOURCE_PIXEL_HEIGHT = 3300;
const PX_X = BOARD_WIDTH / SOURCE_PIXEL_WIDTH;
const PX_Y = BOARD_HEIGHT / SOURCE_PIXEL_HEIGHT;

export interface BoardPoint {x: number; y: number}

/** Convert a position measured on VQ.png into board SVG units. */
export const boardPixel = (x: number, y: number): BoardPoint => ({x: x * PX_X, y: y * PX_Y});

const clampBoardPoint = (point: BoardPoint | readonly [number, number]): BoardPoint => {
    const x = "x" in point ? point.x : point[0];
    const y = "y" in point ? point.y : point[1];
    return {
        x: Math.max(12, Math.min(BOARD_WIDTH - 12, x)),
        y: Math.max(12, Math.min(BOARD_HEIGHT - 12, y)),
    };
};

/**
 * City markers traced from the board photo, as `[space id, pixel x, pixel y]`.
 * These are the anchors of the displacement field; spaces without an anchor
 * are placed by the fitted warp.  Coordinates are approximate on purpose —
 * the printed board is a hand-drawn cartogram, not a survey.
 */
const TRACED_ANCHORS: readonly (readonly [string, number, number])[] = [
    // British Isles
    ["perth", 575, 160], ["stirling", 390, 300], ["edinburgh", 605, 310],
    ["glasgow", 480, 450], ["aberdeen", 700, 90],
    ["ulster", 377, 570], ["dublin", 427, 735], ["cork", 350, 860], ["kinsale", 387, 913],
    ["berwick", 760, 320], ["carlisle", 470, 500], ["york", 630, 480],
    ["norwich", 985, 570], ["london", 880, 740], ["dover", 990, 870],
    ["bristol", 615, 895], ["plymouth", 575, 1060], ["portsmouth", 815, 930],

    // Low Countries and the Channel coast
    ["alkmaar", 1300, 155], ["haarlem", 1270, 340], ["amsterdam", 1490, 340],
    ["rotterdam", 1250, 515], ["utrecht", 1500, 535], ["arnhem", 1720, 470],
    ["sHertogenbosch", 1730, 700], ["maastricht", 1900, 650],
    ["antwerp", 1500, 730], ["brussels", 1665, 855], ["ghent", 1270, 880],
    ["bruges", 1370, 790], ["flushing", 1200, 770], ["brielle", 1250, 660],
    ["lille", 1450, 1050], ["dunkirk", 1180, 950], ["calais", 1120, 980],

    // France
    ["paris", 1520, 1340], ["rouen", 1120, 1280], ["amiens", 1400, 1220],
    ["reims", 1750, 1220], ["brest", 950, 1580], ["rennes", 1180, 1450],
    ["nantes", 1150, 1620], ["laRochelle", 1150, 1780], ["bordeaux", 1250, 1980],
    ["bayonne", 1500, 2150], ["toulouse", 1650, 1990], ["montauban", 1550, 1900],
    ["cognac", 1450, 1800], ["poitiers", 1450, 1650], ["limoges", 1650, 1770],
    ["orleans", 1550, 1530], ["amboise", 1350, 1650], ["bourges", 1650, 1500],
    ["clermont", 1800, 1600], ["lyon", 1900, 1550], ["dijon", 1900, 1380],
    ["nimes", 2050, 1770], ["marseille", 2150, 1810], ["avignon", 2000, 1720],
    ["montpellier", 1850, 1900], ["bearn", 1450, 2050], ["metz", 2000, 1200],
    ["geneva", 2150, 1300],

    // Empire, Bohemia and Hungary
    ["cologne", 2020, 620], ["mainz", 2100, 690], ["trier", 2100, 850],
    ["frankfurt", 2180, 780], ["nuremberg", 2700, 780], ["augsburg", 2700, 1000],
    ["munich", 3150, 760], ["innsbruck", 3150, 880], ["prague", 3100, 340],
    ["vienna", 3450, 500], ["graz", 3400, 750], ["breslau", 3650, 300],
    ["pressburg", 3560, 490], ["zagreb", 3600, 900], ["szigetvar", 3750, 720],
    ["buda", 3850, 470],

    // Balkans, Greece and Anatolia
    ["belgrade", 4150, 780], ["temesvar", 4200, 650], ["sarajevo", 4000, 1350],
    ["scutari", 4000, 1400], ["sofia", 4350, 1000], ["salonika", 4400, 1400],
    ["athens", 4400, 1600], ["edirne", 4600, 1400], ["istanbul", 4650, 1220],

    // Italy and the central Mediterranean
    ["milan", 2700, 1380], ["turin", 2600, 1550], ["genoa", 2700, 1600],
    ["venice", 3200, 1200], ["padua", 3100, 1350], ["florence", 2950, 1550],
    ["ravenna", 3100, 1400], ["rome", 3250, 1650], ["ancona", 3350, 1450],
    ["naples", 3550, 1750], ["palermo", 3500, 1950], ["messina", 3850, 1950],
    ["cagliari", 3050, 2100], ["zara", 3450, 1250], ["ragusa", 3650, 1300],
    ["corfu", 4050, 1600], ["candia", 4500, 1600], ["cyprus", 4850, 1600],
    ["malta", 3500, 2350],

    // North Africa
    ["tunis", 3250, 2450], ["tripoli", 3300, 2650], ["algiers", 2950, 2550],
    ["oran", 2450, 2650],

    // Iberia
    ["madrid", 1765, 2415], ["barcelona", 1990, 2190], ["valencia", 2025, 2360],
    ["seville", 1645, 2785], ["cadiz", 1700, 2830], ["gibraltar", 1830, 2820],
    ["corunna", 1130, 2260], ["pamplona", 1660, 2250], ["granada", 1990, 2600],
    ["lisbon", 1510, 2655], ["oporto", 1300, 2400], ["cartagena", 2130, 2550],
];

interface Anchor {
    source: readonly [number, number];
    target: BoardPoint;
    rx: number;
    ry: number;
}

/** Solve a 3×3 linear system (Gaussian elimination with partial pivoting). */
const solve3 = (matrix: number[][], rhs: number[]): number[] => {
    const m = matrix.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < 3; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < 3; row += 1) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        const divisor = m[col][col];
        if (Math.abs(divisor) < 1e-12) continue;
        for (let j = col; j < 4; j += 1) m[col][j] /= divisor;
        for (let row = 0; row < 3; row += 1) {
            if (row === col) continue;
            const factor = m[row][col];
            for (let j = col; j < 4; j += 1) m[row][j] -= factor * m[col][j];
        }
    }
    return m.map((row) => row[3]);
};

const tracedTargets = new Map<string, BoardPoint>(
    TRACED_ANCHORS
        .filter(([id]) => SPACE_BY_ID[id] !== undefined)
        .map(([id, x, y]) => [id, clampBoardPoint(boardPixel(x, y))]),
);

const anchorSources = [...tracedTargets.entries()].map(([id, target]) => {
    const def = SPACE_BY_ID[id];
    return {id, source: project(def.lon, def.lat), target};
});

// Least-squares affine fit from real geography to the board's overall framing.
const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
const rhsX = [0, 0, 0];
const rhsY = [0, 0, 0];
for (const anchor of anchorSources) {
    const v = [anchor.source[0], anchor.source[1], 1];
    for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) normal[i][j] += v[i] * v[j];
        rhsX[i] += v[i] * anchor.target.x;
        rhsY[i] += v[i] * anchor.target.y;
    }
}
const affineX = solve3(normal, rhsX);
const affineY = solve3(normal, rhsY);
const affine = (p: readonly [number, number]): [number, number] => [
    affineX[0] * p[0] + affineX[1] * p[1] + affineX[2],
    affineY[0] * p[0] + affineY[1] * p[1] + affineY[2],
];

const anchors: Anchor[] = anchorSources.map(({source, target}) => {
    const base = affine(source);
    return {source, target, rx: target.x - base[0], ry: target.y - base[1]};
});

/** Radius (in geographic map units) of the local cartogram correction. */
const WARP_SIGMA = 125;

export const boardWarpPoint = (point: readonly [number, number]): [number, number] => {
    const base = affine(point);
    let weightSum = 0;
    let residualX = 0;
    let residualY = 0;
    for (const anchor of anchors) {
        const dx = point[0] - anchor.source[0];
        const dy = point[1] - anchor.source[1];
        const weight = Math.exp(-(dx * dx + dy * dy) / (2 * WARP_SIGMA * WARP_SIGMA));
        weightSum += weight;
        residualX += weight * anchor.rx;
        residualY += weight * anchor.ry;
    }
    if (weightSum < 1e-9) return base;
    return [base[0] + residualX / weightSum, base[1] + residualY / weightSum];
};

/** Apply the same cartogram warp to the preprojected Natural Earth coastline. */
export const boardWarpPath = (path: string): string =>
    path.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_match, rawX: string, rawY: string) => {
        const [x, y] = boardWarpPoint([Number(rawX), Number(rawY)]);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

/** Board-style position of every playable land space. */
export const BOARD_SPACE_POINTS: Record<string, BoardPoint> = Object.fromEntries(
    SPACES.map((space) => {
        const traced = tracedTargets.get(space.id);
        const point = traced ?? boardWarpPoint(project(space.lon, space.lat));
        return [space.id, clampBoardPoint(point)];
    }),
);

export const boardSpacePoint = (id: string): BoardPoint =>
    BOARD_SPACE_POINTS[id] ?? {x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2};

/** Sea-zone labels traced from the printed board, as raw photo pixels. */
const TRACED_SEA: Record<string, readonly [number, number]> = {
    atlanticOcean: [950, 2550],
    irishSea: [280, 520],
    englishChannel: [800, 1350],
    northSea: [2100, 220],
    bayOfBiscay: [1050, 1900],
    gulfOfLyon: [2350, 2000],
    tyrrhenian: [3050, 1900],
    ionian: [4100, 1950],
    adriatic: [3400, 1400],
    aegean: [4450, 1900],
    easternMediterranean: [4700, 2050],
    barbaryCoast: [2700, 2340],
    northAfricanCoast: [3900, 2340],
};

export const BOARD_SEA_POINTS: Record<string, BoardPoint> = Object.fromEntries(
    SEA_ZONES.map((zone) => {
        const traced = TRACED_SEA[zone.id];
        const point = traced === undefined
            ? boardWarpPoint(project(zone.label[0], zone.label[1]))
            : boardPixel(traced[0], traced[1]);
        return [zone.id, clampBoardPoint(point)];
    }),
);

export interface BoardRegion {
    id: string;
    color: string;
    points: BoardPoint[];
    /** Soft wash centre and radii in board units (no hard polygon edges). */
    cx: number;
    cy: number;
    rx: number;
    ry: number;
}

/**
 * Broad home-power washes.  The printed board tints each home area; these
 * coarse polygons are clipped to the coastline when drawn, so their exact
 * outlines only need to follow the regional colour blocks of VQ.png.
 */
const REGION_POLYGONS: readonly (readonly [string, string, readonly (readonly [number, number])[]])[] = [
    ["britishIsles", "#a9a08a", [[150, 0], [700, 0], [1150, 200], [1150, 900], [900, 1150], [150, 1150]]],
    ["northAfrica", "#c9a763", [[2400, 2250], [3300, 2150], [4200, 2200], [5100, 2300], [5100, 3300], [4200, 3300], [3300, 3250], [2400, 3300]]],
    ["iberian", "#e6c66d", [[1150, 2100], [1700, 2050], [2300, 2100], [2550, 2250], [2500, 2600], [2300, 2950], [1700, 3050], [1300, 2850], [1150, 2550]]],
    ["portugal", "#9e2b52", [[1150, 2400], [1400, 2350], [1600, 2400], [1620, 2700], [1500, 2920], [1200, 2880], [1150, 2650]]],
    ["empire", "#a89a66", [[1950, 150], [2600, 100], [3200, 120], [3900, 180], [3950, 500], [3800, 900], [3500, 1150], [2900, 1200], [2400, 1100], [2000, 900], [1900, 500]]],
    ["ottoman", "#4f9a55", [[3750, 250], [4300, 220], [4800, 260], [5100, 350], [5100, 1000], [4950, 1500], [4600, 1900], [4150, 1950], [3850, 1600], [3750, 1100]]],
    ["netherlands", "#e79a3c", [[1200, 0], [1650, 0], [1900, 100], [2070, 400], [2000, 750], [1850, 1020], [1500, 1120], [1250, 1000], [1140, 700], [1150, 300]]],
    ["france", "#4a83c4", [[900, 1100], [1300, 1040], [1700, 1050], [2050, 1100], [2280, 1400], [2250, 1750], [2000, 2050], [1650, 2150], [1300, 2100], [1000, 1850], [900, 1500]]],
    ["venice", "#e894b2", [[2850, 1050], [3200, 1020], [3550, 1080], [3520, 1350], [3300, 1500], [2950, 1480], [2820, 1300]]],
    ["papacy", "#8e4a9b", [[2950, 1420], [3300, 1400], [3600, 1450], [3650, 1750], [3450, 1920], [3050, 1900], [2900, 1700]]],
    ["england", "#cf4a3c", [[400, 240], [700, 220], [950, 260], [1120, 460], [1100, 700], [1000, 950], [850, 1080], [550, 1080], [420, 900], [380, 600]]],
    ["scotland", "#8fc0e8", [[240, 40], [500, 30], [720, 80], [700, 300], [620, 460], [450, 510], [260, 420], [220, 220]]],
    ["ireland", "#9ccaa6", [[170, 440], [330, 420], [460, 470], [490, 700], [440, 950], [300, 1010], [180, 900]]],
];

export const BOARD_REGIONS: BoardRegion[] = REGION_POLYGONS.map(([id, color, points]) => {
    const mapped = points.map(([x, y]) => boardPixel(x, y));
    const xs = mapped.map((p) => p.x);
    const ys = mapped.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        id,
        color,
        points: mapped,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        rx: (maxX - minX) / 2 + 18,
        ry: (maxY - minY) / 2 + 18,
    };
});

export interface BoardBanner {
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    rotate?: number;
}

/** Power name plates along the edges of the printed board (Latin text only). */
export const BOARD_BANNERS: BoardBanner[] = [
    {label: "ENGLAND", x: 6, y: 4, width: 104, height: 18, color: "#8f2f2a"},
    {label: "FRANCE", x: 190, y: 6, width: 130, height: 20, color: "#1f4d96"},
    {label: "HOLY ROMAN EMPIRE", x: 735, y: 6, width: 190, height: 20, color: "#4b422c"},
    {label: "SPAIN", x: 300, y: 598, width: 150, height: 18, color: "#9a7320"},
    {label: "OTTOMAN", x: 790, y: 598, width: 160, height: 18, color: "#1f6b3a"},
    {label: "PROTESTANT", x: 925, y: 210, width: 110, height: 20, color: "#a85a12", rotate: 90},
];

/* ------------------------------------------------------------------------- */
/* The printed World Map: an L-shaped strip of triangular settlements         */
/* ------------------------------------------------------------------------- */

/**
 * On VQ.png the world map is not a separate board: the Americas run down the
 * left edge and Africa / the Indian Ocean along the bottom, separated from the
 * Europe map by a heavy dotted "ocean boundary".  The board view therefore
 * draws both on one surface, with no Europe/world switch at all.
 */
export const BOARD_WORLD_STRIP = {
    left: {x0: 6, x1: 128, y0: 205, y1: 610},
    bottom: {x0: 128, x1: 994, y0: 540, y1: 592},
    /** Heavy black dotted line, as printed. */
    boundary: "M128,205 L128,540 L994,540",
    /** Thin blue sea-lane line just inside it. */
    innerBoundary: "M135,212 L135,547 L994,547",
} as const;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Triangular settlement positions.  The printed board is a schematic world
 * map rather than a projection, so the Americas are spread down the left strip
 * by latitude and the Old World along the bottom strip by longitude.
 */
export const BOARD_WORLD_POINTS: Record<string, BoardPoint> = Object.fromEntries(
    WORLD_MAP_LOCATIONS.map((location) => {
        const americas = location.lon < -30;
        const point: BoardPoint = americas
            ? {
                x: 16 + clamp01((location.lon + 105) / 50) * 100,
                y: 215 + clamp01((48 - location.lat) / 86) * 380,
            }
            : {
                x: 150 + clamp01((location.lon + 30) / 160) * 820,
                y: 545 + clamp01((20 - location.lat) / 80) * 42,
            };
        return [location.id, point];
    }),
);

export const boardWorldPoint = (id: string): BoardPoint =>
    BOARD_WORLD_POINTS[id] ?? {x: 64, y: 400};

/** White dotted sailing routes printed across the world-map oceans. */
export const BOARD_WORLD_ROUTES: readonly {cx: number; cy: number; rx: number; ry: number}[] = [
    {cx: 66, cy: 320, rx: 48, ry: 100},
    {cx: 66, cy: 490, rx: 50, ry: 105},
    {cx: 430, cy: 578, rx: 250, ry: 24},
    {cx: 800, cy: 578, rx: 185, ry: 22},
];

/** White trade-wind arrows scattered over the triangle strip. */
export const BOARD_WIND_ARROWS: readonly {x: number; y: number; rotate: number}[] = [
    {x: 108, y: 258, rotate: 25}, {x: 108, y: 400, rotate: -15}, {x: 108, y: 555, rotate: 35},
    {x: 250, y: 588, rotate: -20}, {x: 610, y: 588, rotate: 15}, {x: 930, y: 588, rotate: -30},
];

export type BoardOceanKey = "atlantic" | "southAtlantic" | "indian";

/** Diamond ocean plates printed along the world-map strip. */
export const BOARD_OCEAN_LABELS: readonly {x: number; y: number; key: BoardOceanKey}[] = [
    {x: 66, y: 232, key: "atlantic"},
    {x: 66, y: 610 - 92, key: "southAtlantic"},
    {x: 912, y: 563, key: "indian"},
];

/** Printed triangle colours: Spanish gold, Portuguese maroon, neutral gray. */
export const BOARD_TRIANGLE_COLORS: Record<string, string> = {
    spain: "#f0cf62",
    portugal: "#a5263f",
    neutral: "#d9d6cc",
};

/** Printed home colours, deliberately brighter than the UI controller palette. */
const BOARD_HOME_COLORS: Record<string, string> = {
    ottoman: "#3c9e4f",
    spain: "#f2cf5b",
    england: "#cf4a3c",
    france: "#3f7ec4",
    hre: "#35322b",
    protestant: "#ef9432",
    scotland: "#8fc0e8",
    ireland: "#9ccaa6",
    portugal: "#9e2b52",
    papacy: "#8e4a9b",
    venice: "#e894b2",
    independent: "#cfcabf",
};

export const boardHomeColor = (home: Controller | string): string =>
    BOARD_HOME_COLORS[home] ?? "#cfcabf";

/**
 * Marker fill(s).  Dutch spaces are printed orange over cream, and split-home
 * French spaces are printed half in each home colour; both are drawn with a
 * vertical two-stop gradient.
 */
export const boardMarkerColors = (def: SpaceDef): readonly string[] => {
    if (def.area === "netherlands") return ["#efa03c", "#f6e4a8"];
    if (def.homes !== undefined && def.homes.length > 1) {
        return def.homes.slice(0, 2).map((home) => boardHomeColor(home));
    }
    return [boardHomeColor(def.home)];
};

/** Unique two-colour gradients used by split-home / Dutch markers. */
export const BOARD_SPLIT_GRADIENTS: readonly (readonly [string, string])[] = (() => {
    const seen = new Map<string, readonly [string, string]>();
    for (const space of SPACES) {
        const colors = boardMarkerColors(space);
        if (colors.length === 2) seen.set(`${colors[0]}|${colors[1]}`, [colors[0], colors[1]]);
    }
    return [...seen.values()];
})();

export const boardGradientIndex = (colors: readonly string[]): number =>
    colors.length === 2
        ? BOARD_SPLIT_GRADIENTS.findIndex(([top, bottom]) => top === colors[0] && bottom === colors[1])
        : -1;

export const boardGradientId = (index: number): string => `vq-board-split-${index}`;
