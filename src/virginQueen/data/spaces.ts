import {Controller, SeaZoneID, SpaceDef, SpaceKind} from "../constant/general";
import {SPACE_NAME_ZH} from "../constant/names";
import {
    LAND_LINKS,
    SEA_ZONE_BY_ID,
    SPACES,
    SPACE_BY_ID,
} from "../constant/spaces";

/**
 * Official map catalogue for the Campaign and Tournament scenarios.
 *
 * The physical map is not included in either supplied PDF.  This module keeps
 * the 92-space reconstruction as the base and adds every city/fortress that
 * the Scenario Book places units in but the reconstruction was missing.
 * Connections added here are explicitly marked `approximate: true`; they are
 * geographic reconstructions, not scans of the printed map.
 */

export interface OfficialSpaceDef extends SpaceDef {
    /** True when the connection/position is a reconstruction, not printed data. */
    approximate?: boolean;
    source?: "reconstruction" | "scenario-book";
    /** Name used by the Scenario Book when it differs from the runtime id. */
    officialName?: string;
}

export interface OfficialLandLink {
    a: string;
    b: string;
    pass: boolean;
    approximate: boolean;
    source: "reconstruction" | "scenario-book";
}

const extra = (
    id: string,
    name: string,
    lon: number,
    lat: number,
    home: Controller,
    kind: SpaceKind,
    opts: Partial<OfficialSpaceDef> = {},
): OfficialSpaceDef => ({
    id,
    name,
    nameZh: SPACE_NAME_ZH[id],
    lon,
    lat,
    home,
    kind,
    approximate: true,
    source: "scenario-book",
    ...opts,
});

/**
 * Spaces referenced by the Scenario Book but absent from the 92-space map.
 * Positions are real lon/lat; distances are only used by the schematic client.
 */
export const ADDITIONAL_SPACES: OfficialSpaceDef[] = [
    // Referenced by English College at Douai. Geography and links remain approximate.
    extra("lille", "Lille", 3.06, 50.63, "spain", "open", {area: "netherlands"}),
    extra("dunkirk", "Dunkirk", 2.38, 51.03, "spain", "fortress", {area: "netherlands", ports: ["englishChannel"]}),
    // Ottoman Balkans / Aegean
    extra("salonika", "Salonika", 22.94, 40.64, "ottoman", "key", {
        officialName: "Salonika",
        ports: ["aegean"],
    }),
    extra("scutari", "Scutari", 19.51, 42.07, "ottoman", "fortress", {
        officialName: "Scutari",
    }),

    // Spanish Mediterranean / North Africa
    extra("oran", "Oran", -0.64, 35.70, "spain", "fortress", {
        ports: ["barbaryCoast"],
    }),
    extra("cartagena", "Cartagena", -0.98, 37.60, "spain", "fortress", {
        ports: ["gulfOfLyon"],
    }),
    extra("genoa", "Genoa", 8.93, 44.41, "spain", "key", {
        ports: ["gulfOfLyon", "tyrrhenian"],
    }),
    extra("malta", "Malta", 14.51, 35.90, "spain", "key", {
        ports: ["tyrrhenian", "ionian"],
    }),
    extra("zara", "Zara", 15.23, 44.12, "venice", "fortress", {
        ports: ["adriatic"],
    }),
    extra("corfu", "Corfu", 19.92, 39.62, "venice", "fortress", {
        ports: ["ionian", "adriatic"],
    }),
    extra("cyprus", "Cyprus", 33.38, 35.15, "venice", "fortress", {
        officialName: "Cyprus",
        ports: ["easternMediterranean"],
    }),

    // Italian peninsula
    extra("ravenna", "Ravenna", 12.20, 44.42, "papacy", "open", {
        officialName: "Ravenna",
        ports: ["adriatic"],
    }),

    // Netherlands
    extra("alkmaar", "Alkmaar", 4.75, 52.63, "spain", "fortress", {
        area: "netherlands",
        ports: ["northSea"],
    }),
    extra("haarlem", "Haarlem", 4.65, 52.38, "spain", "fortress", {
        area: "netherlands",
    }),
    extra("arnhem", "Arnhem", 5.90, 51.98, "spain", "fortress", {
        area: "netherlands",
    }),
    extra("sHertogenbosch", "'s-Hertogenbosch", 5.30, 51.70, "spain", "fortress", {
        area: "netherlands",
        officialName: "'s-Hertogenbosch",
    }),
    extra("maastricht", "Maastricht", 5.69, 50.85, "spain", "fortress", {
        area: "netherlands",
    }),

    // France
    extra("calais", "Calais", 1.86, 50.95, "france", "key", {
        area: "france",
        ports: ["englishChannel"],
    }),
    // Catholic League (20.10) requires Reims. It is printed as an unfortified
    // French home space; the League places a fortress there when it forms.
    extra("reims", "Reims", 4.03, 49.26, "france", "open", {
        area: "france",
    }),
    extra("amboise", "Amboise", 0.98, 47.41, "france", "open", {
        area: "france",
    }),
    extra("rennes", "Rennes", -1.68, 48.11, "france", "fortress", {
        area: "france",
    }),
    extra("poitiers", "Poitiers", 0.34, 46.58, "france", "open", {
        area: "france",
    }),
    extra("limoges", "Limoges", 1.26, 45.83, "france", "open", {
        area: "france",
    }),
    extra("montpellier", "Montpellier", 3.88, 43.61, "france", "open", {
        area: "france",
        ports: ["gulfOfLyon"],
    }),
    extra("avignon", "Avignon", 4.81, 43.95, "france", "fortress", {
        area: "france",
    }),
    extra("cognac", "Cognac", -0.33, 45.70, "france", "open", {
        area: "france",
    }),
    extra("bayonne", "Bayonne", -1.47, 43.49, "france", "fortress", {
        area: "france",
        ports: ["bayOfBiscay"],
    }),

    // British Isles
    extra("berwick", "Berwick", -2.00, 55.77, "england", "fortress", {
        area: "england",
        ports: ["northSea"],
    }),
    extra("carlisle", "Carlisle", -2.93, 54.89, "england", "fortress", {area: "england"}),
    extra("kinsale", "Kinsale", -8.52, 51.70, "ireland", "fortress", {
        ports: ["atlanticOcean"],
    }),

    // Scotland
    extra("perth", "Perth", -3.44, 56.40, "scotland", "open", {
        area: "scotland",
    }),

    // Hungary / HRE frontier
    extra("szigetvar", "Szigetvar", 17.80, 46.05, "hre", "fortress", {
        officialName: "Szigetvar",
    }),
];

/** Links added for the new spaces. All are approximate reconstructions. */
const ADDITIONAL_LINKS: [string, string, boolean?][] = [
    ["lille", "dunkirk"],
    ["lille", "brussels"],
    ["lille", "calais"],
    ["dunkirk", "calais"],
    // Ottoman
    ["salonika", "athens"],
    ["salonika", "edirne"],
    ["salonika", "belgrade"],
    ["scutari", "ragusa"],
    ["scutari", "sarajevo"],
    ["scutari", "sofia"],

    // Mediterranean / North Africa
    ["oran", "algiers"],
    ["oran", "tunis"],
    ["cartagena", "valencia"],
    ["cartagena", "granada"],
    ["genoa", "milan"],
    ["genoa", "turin"],
    ["genoa", "florence"],
    ["ravenna", "venice"],
    ["ravenna", "ancona"],
    ["ravenna", "florence"],

    // Netherlands
    ["alkmaar", "amsterdam"],
    ["alkmaar", "haarlem"],
    ["haarlem", "amsterdam"],
    ["haarlem", "rotterdam"],
    ["arnhem", "utrecht"],
    ["arnhem", "maastricht"],
    ["arnhem", "sHertogenbosch"],
    ["sHertogenbosch", "brielle"],
    ["sHertogenbosch", "antwerp"],
    ["sHertogenbosch", "maastricht"],
    ["maastricht", "brussels"],
    ["maastricht", "cologne"],

    // France
    ["calais", "amiens"],
    ["calais", "rouen"],
    ["reims", "paris"],
    ["reims", "amiens"],
    ["reims", "dijon"],
    ["reims", "metz"],
    ["amboise", "orleans"],
    ["amboise", "nantes"],
    ["rennes", "nantes"],
    ["rennes", "brest"],
    ["poitiers", "orleans"],
    ["poitiers", "nantes"],
    ["poitiers", "limoges"],
    ["poitiers", "cognac"],
    ["limoges", "clermont"],
    ["limoges", "cognac"],
    ["montpellier", "toulouse"],
    ["montpellier", "avignon"],
    ["montpellier", "nimes"],
    ["avignon", "marseille"],
    ["avignon", "lyon"],
    ["cognac", "bordeaux"],
    ["cognac", "laRochelle"],
    ["bayonne", "bearn"],
    ["bayonne", "toulouse"],

    // British Isles
    ["berwick", "edinburgh"],
    ["berwick", "york"],
    ["carlisle", "york"],
    ["carlisle", "berwick"],
    ["kinsale", "cork"],

    // Scotland
    ["perth", "edinburgh"],
    ["perth", "stirling"],
    ["perth", "aberdeen"],

    // Hungary
    ["szigetvar", "buda"],
    ["szigetvar", "pressburg"],
    ["szigetvar", "zagreb"],
];

/** The runtime space `nicosia` is replaced by the official `cyprus` space. */
const REPLACED_SPACE_IDS = new Set(["nicosia"]);

export const OFFICIAL_SPACES: OfficialSpaceDef[] = [
    ...SPACES.filter((s) => !REPLACED_SPACE_IDS.has(s.id)).map((s) => {
        // Initial units/control/religion belong to the runtime reconstruction, not
        // to the official scenario catalogue.  Scenario setup supplies those.
        const {initial, initialNaval, control, religion, ...geography} = s;
        void initial;
        void initialNaval;
        void control;
        void religion;
        return {
            ...geography,
            ...(geography.home === "england" ? {area: "england" as const} : {}),
            officialName:
                s.id === "seville"
                    ? "Seville/Cadiz"
                    : s.id === "tripoli"
                      ? "Djerba/Tripoli"
                      : undefined,
            source: "reconstruction" as const,
        };
    }),
    ...ADDITIONAL_SPACES,
];

export const OFFICIAL_SPACE_BY_ID: Record<string, OfficialSpaceDef> = Object.fromEntries(
    OFFICIAL_SPACES.map((s) => [s.id, s]),
);

const rawOfficialLandLinks: OfficialLandLink[] = [
    ...LAND_LINKS.filter(([a, b]) => !REPLACED_SPACE_IDS.has(a) && !REPLACED_SPACE_IDS.has(b)).map(
        ([a, b, pass]) => ({
            a,
            b,
            pass: pass === true,
            approximate: false,
            source: "reconstruction" as const,
        }),
    ),
    ...ADDITIONAL_LINKS.map(([a, b, pass]) => ({
        a,
        b,
        pass: pass === true,
        approximate: true,
        source: "scenario-book" as const,
    })),
];

/**
 * Deduplicate undirected links.  The runtime reconstruction contains one
 * duplicate pair (`geneva`/`turin`); merging keeps the better connection and
 * makes the official catalogue safe to iterate.
 */
const officialLinkMap = new Map<string, OfficialLandLink>();
for (const link of rawOfficialLandLinks) {
    const key = [link.a, link.b].sort().join("|");
    const existing = officialLinkMap.get(key);
    if (existing === undefined) {
        officialLinkMap.set(key, link);
    } else {
        existing.pass = existing.pass || link.pass;
        existing.approximate = existing.approximate && link.approximate;
        existing.source = existing.approximate ? "scenario-book" : "reconstruction";
    }
}

export const OFFICIAL_LAND_LINKS: OfficialLandLink[] = [...officialLinkMap.values()];

export const OFFICIAL_LAND_NEIGHBORS: Record<string, {id: string; pass: boolean; approximate: boolean}[]> =
    Object.fromEntries(OFFICIAL_SPACES.map((s) => [s.id, []]));

for (const link of OFFICIAL_LAND_LINKS) {
    OFFICIAL_LAND_NEIGHBORS[link.a].push({
        id: link.b,
        pass: link.pass,
        approximate: link.approximate,
    });
    OFFICIAL_LAND_NEIGHBORS[link.b].push({
        id: link.a,
        pass: link.pass,
        approximate: link.approximate,
    });
}

/** All ports added by the official catalogue, keyed by sea zone. */
export const OFFICIAL_SEA_PORTS: Record<SeaZoneID, string[]> = Object.fromEntries(
    Object.keys(SEA_ZONE_BY_ID).map((id) => [id, [] as string[]]),
) as Record<SeaZoneID, string[]>;

for (const s of OFFICIAL_SPACES) {
    for (const z of s.ports ?? []) {
        OFFICIAL_SEA_PORTS[z].push(s.id);
    }
}

export const OFFICIAL_KEY_SPACES: string[] = OFFICIAL_SPACES.filter((s) => s.kind === "key").map(
    (s) => s.id,
);

export const OFFICIAL_CAPITAL_SPACES = {
    ottoman: ["istanbul"],
    spain: ["madrid", "milan"],
    england: ["london"],
    france: ["paris"],
    hre: ["vienna"],
    protestant: ["laRochelle", "amsterdam"],
} as const;

/** Spaces that exist in the reconstruction but are replaced in the official set. */
export const DEPRECATED_SPACE_IDS = [...REPLACED_SPACE_IDS];

export const officialSpace = (id: string): OfficialSpaceDef | undefined =>
    OFFICIAL_SPACE_BY_ID[id];

export const officialSpaceOrThrow = (id: string): OfficialSpaceDef => {
    const s = OFFICIAL_SPACE_BY_ID[id];
    if (s === undefined) {
        throw new Error(`unknown official Virgin Queen space: ${id}`);
    }
    return s;
};

/** Sanity check used by tests: every port id must be a known sea zone. */
export const isOfficialPortSpace = (id: string): boolean =>
    (OFFICIAL_SPACE_BY_ID[id]?.ports ?? []).length > 0;

export const officialSpaceCountByKind = (): Record<SpaceKind, number> => {
    const out: Record<SpaceKind, number> = {key: 0, fortress: 0, open: 0};
    for (const s of OFFICIAL_SPACES) {
        out[s.kind] += 1;
    }
    return out;
};
