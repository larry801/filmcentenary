import {WorldSeaZone, WorldSettlement} from "./types";

/**
 * Skeleton of the World Map.  The supplied PDFs do not include the physical
 * world map, so this records only the sea zones and settlements named by the
 * scenario book and card texts.  Positions and connections are deliberately
 * coarse; they are here so later rounds have stable ids to hang expeditions,
 * piracy and colonies on.
 */
export const WORLD_SEA_ZONES: WorldSeaZone[] = [
    {
        id: "northAtlantic",
        nameEn: "North Atlantic",
        nameZh: "北大西洋",
        adjacent: ["guineaCoast", "spanishMain", "antilles", "southAtlantic"],
    },
    {
        id: "guineaCoast",
        nameEn: "Guinea Coast",
        nameZh: "几内亚海岸",
        adjacent: ["northAtlantic", "southAtlantic", "spanishMain", "indianOcean"],
    },
    {
        id: "spanishMain",
        nameEn: "Spanish Main",
        nameZh: "加勒比海",
        adjacent: ["northAtlantic", "guineaCoast", "antilles", "mexicanCoast"],
    },
    {
        id: "antilles",
        nameEn: "Antilles",
        nameZh: "安的列斯群岛",
        adjacent: ["northAtlantic", "spanishMain", "mexicanCoast"],
    },
    {
        id: "mexicanCoast",
        nameEn: "Mexican Coast",
        nameZh: "墨西哥海岸",
        adjacent: ["antilles", "spanishMain", "chileanCoast", "southPacific"],
    },
    {
        id: "chileanCoast",
        nameEn: "Chilean Coast",
        nameZh: "智利海岸",
        adjacent: ["mexicanCoast", "southPacific", "southAtlantic"],
    },
    {
        id: "southPacific",
        nameEn: "South Pacific",
        nameZh: "南太平洋",
        adjacent: ["chileanCoast", "mexicanCoast", "indianOcean"],
    },
    {
        id: "indianOcean",
        nameEn: "Indian Ocean",
        nameZh: "印度洋",
        adjacent: ["southPacific", "southAtlantic", "guineaCoast"],
    },
    {
        id: "southAtlantic",
        nameEn: "South Atlantic",
        nameZh: "南大西洋",
        adjacent: ["indianOcean", "guineaCoast", "northAtlantic", "chileanCoast"],
    },
];

export const WORLD_SEA_ZONE_BY_ID: Record<string, WorldSeaZone> = Object.fromEntries(
    WORLD_SEA_ZONES.map((z) => [z.id, z]),
);

/** Hazardous passages marked with blue arrows on the World Map. */
export const WORLD_HAZARDS: ReadonlySet<string> = new Set([
    "chileanCoast|southAtlantic",
    "southAtlantic|chileanCoast",
    "chileanCoast|southPacific",
    "southPacific|chileanCoast",
    "southAtlantic|indianOcean",
    "indianOcean|southAtlantic",
]);

/** Directed trade-wind arrows; moving in the opposite direction requires a Navigation check. */
export const WORLD_TRADE_WINDS: ReadonlySet<string> = new Set([
    "northAtlantic|antilles",
    "guineaCoast|southAtlantic",
    "mexicanCoast|southPacific",
    "southPacific|indianOcean",
    "indianOcean|southAtlantic",
]);

export const WORLD_SETTLEMENTS: WorldSettlement[] = [
    {
        id: "florida",
        nameEn: "Florida",
        nameZh: "佛罗里达",
        region: "northAmerica",
        kind: "colony",
        seaZone: "northAtlantic",
        home: "spain",
        notes: "Spain places an HCM here in the Tournament scenario.",
    },
    {
        id: "philippines",
        nameEn: "Philippines",
        nameZh: "菲律宾",
        region: "asia",
        kind: "settlement",
        seaZone: "indianOcean",
        notes: "Conquest of the Philippines adds a Spanish control marker and a recurring treasure.",
    },
    // The physical World Map was not supplied with the source set. These
    // generic slots let an expedition settle the named region without
    // inventing an exact printed location.
    {id: "atlanticCoast", nameEn: "Atlantic Coast", nameZh: "大西洋沿岸", region: "atlanticCoast", kind: "colony", seaZone: "northAtlantic"},
    {id: "antillesColony", nameEn: "Antilles", nameZh: "安的列斯", region: "antilles", kind: "colony", seaZone: "antilles"},
    {id: "southAmericaColony", nameEn: "South America", nameZh: "南美洲", region: "southAmerica", kind: "colony", seaZone: "southAtlantic"},
    {id: "guineaCoastColony", nameEn: "Guinea Coast", nameZh: "几内亚海岸", region: "africa", kind: "colony", seaZone: "guineaCoast"},
    {id: "asiaColony", nameEn: "Asia", nameZh: "亚洲", region: "asia", kind: "colony", seaZone: "indianOcean"},
];

export const WORLD_SETTLEMENT_BY_ID: Record<string, WorldSettlement> = Object.fromEntries(
    WORLD_SETTLEMENTS.map((s) => [s.id, s]),
);

/** Geographic regions named on the World Map / cards. */
export const WORLD_REGIONS = [
    "northAmerica",
    "atlanticCoast",
    "spanishMain",
    "antilles",
    "mexicanCoast",
    "chileanCoast",
    "southAmerica",
    "africa",
    "asia",
] as const;

export const worldSeaZoneOrThrow = (id: string): WorldSeaZone => {
    const z = WORLD_SEA_ZONE_BY_ID[id];
    if (z === undefined) {
        throw new Error(`unknown world sea zone: ${id}`);
    }
    return z;
};
