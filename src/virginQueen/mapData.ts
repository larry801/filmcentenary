import {Power, SeaZoneDef, SeaZoneID, SpaceDef, VQLocale, localizedName} from "./constant/general";
import {
    DUTCH_KEYS,
    SEA_ZONES as RECONSTRUCTION_SEA_ZONES,
    SEA_ZONE_BY_ID as RECONSTRUCTION_SEA_ZONE_BY_ID,
} from "./constant/spaces";
import {mapProject, relaxMapPoints} from "./components/map-geometry";
import {
    OFFICIAL_CAPITAL_SPACES,
    OFFICIAL_KEY_SPACES,
    OFFICIAL_LAND_LINKS,
    OFFICIAL_SEA_PORTS,
    OFFICIAL_SPACE_BY_ID,
    OFFICIAL_SPACES,
} from "./data/spaces";

/**
 * Runtime map used by the game itself.
 *
 * The official catalogue in `data/spaces.ts` keeps the playable reconstruction
 * as a base and adds the cities/fortresses that the Scenario Book places units
 * in.  The runtime therefore consumes the merged official catalogue, while the
 * raw reconstruction in `constant/spaces.ts` remains as source data for the
 * data layer.
 */

export const SPACES: SpaceDef[] = OFFICIAL_SPACES;

export const SPACE_BY_ID: Record<string, SpaceDef> = OFFICIAL_SPACE_BY_ID;

/**
 * Display positions used by the interactive map.
 *
 * The anchors above remain true longitude/latitude coordinates.  `SPACE_POINTS`
 * is a de-cluttered cartographic layout: densely packed areas (the Low
 * Countries, Rhineland and northern Italy) are gently expanded so neighbouring
 * city markers and labels do not sit on top of each other.  The map draws a
 * faint leader from the real coordinate to any marker that was moved.
 *
 * Keeping this as a separate display layer means rules code continues to use
 * the real projection and geographic adjacency without any layout concerns.
 */
export const SPACE_POINTS: Record<string, {x: number; y: number}> = relaxMapPoints(
    SPACES.map((space) => {
        const [x, y] = mapProject(space.lon, space.lat);
        return {id: space.id, x, y};
    }),
);

export const spacePoint = (id: string): {x: number; y: number} => SPACE_POINTS[id];

export const LAND_LINKS: [string, string, boolean?][] = OFFICIAL_LAND_LINKS.map((link) => [
    link.a,
    link.b,
    link.pass,
]);

export const LAND_NEIGHBORS: Record<string, {id: string; pass: boolean}[]> = Object.fromEntries(
    SPACES.map((s) => [s.id, [] as {id: string; pass: boolean}[]]),
);

for (const [a, b, pass] of LAND_LINKS) {
    LAND_NEIGHBORS[a].push({id: b, pass: pass === true});
    LAND_NEIGHBORS[b].push({id: a, pass: pass === true});
}

/** The 13 sea zones are unchanged by the official scenario catalogue. */
export const SEA_ZONES: SeaZoneDef[] = RECONSTRUCTION_SEA_ZONES;

export const SEA_ZONE_BY_ID: Record<string, SeaZoneDef> = RECONSTRUCTION_SEA_ZONE_BY_ID;

/** Ports of each sea zone, including the spaces added by the Scenario Book. */
export const SEA_PORTS: Record<SeaZoneID, string[]> = OFFICIAL_SEA_PORTS;

for (const zone of SEA_ZONES) {
    zone.ports = SEA_PORTS[zone.id];
}

export const KEY_SPACES: string[] = OFFICIAL_KEY_SPACES;

export const CAPITAL_SPACES: Record<Power, string[]> = OFFICIAL_CAPITAL_SPACES as unknown as Record<
    Power,
    string[]
>;

export {DUTCH_KEYS};

/** Localized display name for a land space id. */
export const spaceName = (id: string, locale: VQLocale = "zh_CN"): string => {
    const def = SPACE_BY_ID[id];
    return def === undefined ? id : localizedName(def, locale);
};

/** Localized display name for a sea zone id. */
export const seaZoneName = (id: string, locale: VQLocale = "zh_CN"): string => {
    const def = SEA_ZONE_BY_ID[id];
    return def === undefined ? id : localizedName(def, locale);
};

/** Localized display name for a place id that may be either land or sea. */
export const mapName = (id: string, locale: VQLocale = "zh_CN"): string =>
    SPACE_BY_ID[id] !== undefined ? spaceName(id, locale) : seaZoneName(id, locale);

/** Rule 16.7: Antwerp and Rotterdam are inland ports linked to Flushing/Brielle. */
export const INLAND_PORT_LINKS: Record<string, string> = {
    antwerp: "flushing",
    rotterdam: "brielle",
};

export const inlandPortLink = (id: string): string | undefined => INLAND_PORT_LINKS[id];

export const isInlandPort = (id: string): boolean => INLAND_PORT_LINKS[id] !== undefined;
