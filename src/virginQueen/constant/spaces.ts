import {
    Controller,
    LandStack,
    NavalStack,
    Power,
    Religion,
    SeaZoneDef,
    SeaZoneID,
    SpaceDef,
    SpaceKind,
} from "./general";

/**
 * The Europe map used by this implementation. Positions are real longitude /
 * latitude values so the client can project the spaces into a recognisable
 * schematic map; connections are curated from the period geography.
 *
 * The physical Virgin Queen map is not part of the rules PDF supplied with the
 * project. This is a playable reconstruction, not a pixel-accurate copy.
 */

const space = (
    id: string,
    name: string,
    lon: number,
    lat: number,
    home: Controller,
    kind: SpaceKind,
    extra: Partial<SpaceDef> = {},
): SpaceDef => ({id, name, lon, lat, home, kind, ...extra});

export const SPACES: SpaceDef[] = [
    // ---------------------------------------------------------------- Iberia
    space("madrid", "Madrid", -3.70, 40.42, "spain", "key", {
        capitalOf: "spain",
        initial: {spain: {regular: 3}},
    }),
    space("barcelona", "Barcelona", 2.17, 41.39, "spain", "fortress", {
        ports: ["gulfOfLyon"],
        initial: {spain: {regular: 1}},
        initialNaval: {spain: {galley: 2}},
    }),
    space("valencia", "Valencia", -0.38, 39.47, "spain", "open", {
        ports: ["gulfOfLyon"],
        initial: {spain: {regular: 1}},
    }),
    space("seville", "Seville", -5.98, 37.39, "spain", "fortress", {
        ports: ["atlanticOcean"],
        initial: {spain: {regular: 1}},
        initialNaval: {spain: {galleon: 1}},
    }),
    space("cadiz", "Cadiz", -6.29, 36.53, "spain", "open", {
        ports: ["atlanticOcean"],
        initial: {spain: {regular: 1}},
    }),
    space("gibraltar", "Gibraltar", -5.35, 36.14, "spain", "fortress", {
        ports: ["atlanticOcean", "barbaryCoast"],
        initial: {spain: {regular: 1}},
    }),
    space("corunna", "Corunna", -8.41, 43.36, "spain", "fortress", {
        ports: ["atlanticOcean"],
        initialNaval: {spain: {galleon: 1}},
    }),
    space("pamplona", "Pamplona", -1.64, 42.81, "spain", "fortress", {
        initial: {spain: {regular: 1}},
    }),
    space("granada", "Granada", -3.60, 37.18, "spain", "open", {
        initial: {spain: {regular: 1}},
    }),
    space("lisbon", "Lisbon", -9.14, 38.72, "portugal", "key", {
        ports: ["atlanticOcean"],
        initial: {portugal: {regular: 2}},
    }),
    space("oporto", "Oporto", -8.61, 41.15, "portugal", "fortress", {
        ports: ["atlanticOcean"],
        initial: {portugal: {regular: 1}},
    }),

    // ---------------------------------------------------------------- France
    space("paris", "Paris", 2.35, 48.86, "france", "key", {
        capitalOf: "france",
        initial: {france: {regular: 4}},
    }),
    space("rouen", "Rouen", 1.10, 49.44, "france", "fortress", {
        ports: ["englishChannel"],
        initial: {france: {regular: 1}},
    }),
    space("amiens", "Amiens", 2.30, 49.89, "france", "open"),
    space("orleans", "Orleans", 1.90, 47.90, "france", "fortress", {
        area: "france",
        initial: {france: {regular: 1}},
    }),
    space("dijon", "Dijon", 5.04, 47.32, "france", "fortress", {
        initial: {france: {regular: 1}},
    }),
    space("bourges", "Bourges", 2.40, 47.08, "france", "open", {
        area: "france",
    }),
    space("clermont", "Clermont", 3.09, 45.78, "france", "open", {
        area: "france",
    }),
    space("lyon", "Lyon", 4.84, 45.76, "france", "key", {
        area: "france",
        initial: {france: {regular: 2}},
    }),
    space("marseille", "Marseille", 5.37, 43.30, "france", "fortress", {
        ports: ["gulfOfLyon"],
        initial: {france: {regular: 2}},
        initialNaval: {france: {galley: 1}},
    }),
    space("toulouse", "Toulouse", 1.44, 43.60, "france", "open", {
        area: "france",
        initial: {france: {regular: 1}},
    }),
    space("bordeaux", "Bordeaux", -0.58, 44.84, "france", "fortress", {
        ports: ["bayOfBiscay"],
        initial: {france: {regular: 2}},
    }),
    space("nantes", "Nantes", -1.55, 47.22, "france", "open", {
        ports: ["bayOfBiscay"],
        initialNaval: {france: {galleon: 1}},
    }),
    space("brest", "Brest", -4.49, 48.39, "france", "fortress", {
        ports: ["atlanticOcean", "bayOfBiscay"],
        initialNaval: {france: {galleon: 1}},
    }),
    space("laRochelle", "La Rochelle", -1.15, 46.16, "protestant", "key", {
        area: "france",
        ports: ["bayOfBiscay"],
        control: "protestant",
        religion: "protestant",
        initial: {protestant: {regular: 2}},
    }),
    space("bearn", "Bearn", -0.37, 43.30, "protestant", "fortress", {
        area: "france",
        religion: "protestant",
        initial: {protestant: {regular: 1}},
    }),
    space("montauban", "Montauban", 1.35, 44.02, "protestant", "open", {
        area: "france",
    }),
    space("nimes", "Nimes", 4.36, 43.84, "protestant", "open", {
        area: "france",
    }),
    space("metz", "Metz", 6.18, 49.12, "independent", "key", {
        initial: {hre: {regular: 1}},
    }),
    space("geneva", "Geneva", 6.14, 46.20, "independent", "fortress", {
        religion: "protestant",
    }),

    // ----------------------------------------------------------- Netherlands
    space("brussels", "Brussels", 4.35, 50.85, "protestant", "key", {
        area: "netherlands",
        control: "spain",
        initial: {spain: {regular: 3}},
    }),
    space("antwerp", "Antwerp", 4.40, 51.22, "protestant", "key", {
        area: "netherlands",
        ports: ["northSea"],
        control: "spain",
        initial: {spain: {regular: 1}},
    }),
    space("amsterdam", "Amsterdam", 4.90, 52.37, "protestant", "key", {
        area: "netherlands",
        ports: ["northSea"],
        control: "spain",
        religion: "protestant",
    }),
    space("rotterdam", "Rotterdam", 4.48, 51.92, "protestant", "fortress", {
        area: "netherlands",
        ports: ["northSea"],
        control: "spain",
        religion: "protestant",
    }),
    space("flushing", "Flushing", 3.57, 51.44, "protestant", "fortress", {
        area: "netherlands",
        ports: ["northSea"],
        control: "spain",
        religion: "protestant",
    }),
    space("brielle", "Brielle", 4.20, 51.90, "protestant", "fortress", {
        area: "netherlands",
        ports: ["northSea"],
        control: "spain",
    }),
    space("ghent", "Ghent", 3.72, 51.05, "protestant", "fortress", {
        area: "netherlands",
        control: "spain",
        religion: "protestant",
    }),
    space("utrecht", "Utrecht", 5.12, 52.09, "spain", "open", {
        area: "netherlands",
    }),
    space("bruges", "Bruges", 3.22, 51.21, "spain", "fortress", {
        area: "netherlands",
        ports: ["northSea"],
    }),

    // ------------------------------------------------------------------- HRE
    space("cologne", "Cologne", 6.96, 50.94, "hre", "fortress"),
    space("mainz", "Mainz", 8.27, 50.00, "hre", "open"),
    space("trier", "Trier", 6.64, 49.75, "hre", "open"),
    space("frankfurt", "Frankfurt", 8.68, 50.11, "hre", "fortress", {
        initial: {hre: {regular: 1}},
    }),
    space("nuremberg", "Nuremberg", 11.08, 49.45, "hre", "fortress", {
        initial: {hre: {regular: 1}},
    }),
    space("munich", "Munich", 11.58, 48.14, "hre", "fortress", {
        initial: {hre: {regular: 2}},
    }),
    space("augsburg", "Augsburg", 10.90, 48.37, "hre", "open", {
        initial: {hre: {regular: 1}},
    }),
    space("innsbruck", "Innsbruck", 11.40, 47.27, "hre", "fortress"),
    space("vienna", "Vienna", 16.37, 48.21, "hre", "key", {
        capitalOf: "hre",
        initial: {hre: {regular: 4, merc: 2}},
    }),
    space("prague", "Prague", 14.42, 50.08, "hre", "key", {
        initial: {hre: {regular: 2}},
    }),
    space("pressburg", "Pressburg", 17.11, 48.15, "hre", "fortress", {
        initial: {hre: {regular: 1}},
    }),
    space("graz", "Graz", 15.44, 47.07, "hre", "fortress", {
        initial: {hre: {regular: 1}},
    }),
    space("breslau", "Breslau", 17.03, 51.11, "hre", "open"),
    space("zagreb", "Zagreb", 15.98, 45.81, "hre", "open"),

    // --------------------------------------------------------------- England
    space("london", "London", -0.13, 51.51, "england", "key", {
        capitalOf: "england",
        area: "england",
        ports: ["northSea"],
        religion: "protestant",
        initial: {england: {regular: 3}},
        initialNaval: {england: {galleon: 2}},
    }),
    space("york", "York", -1.08, 53.96, "england", "key", {
        initial: {england: {regular: 1}},
    }),
    space("bristol", "Bristol", -2.59, 51.45, "england", "fortress", {
        ports: ["atlanticOcean"],
        initial: {england: {regular: 1}},
    }),
    space("plymouth", "Plymouth", -4.14, 50.38, "england", "open", {
        ports: ["englishChannel"],
        initialNaval: {england: {galleon: 1}},
    }),
    space("portsmouth", "Portsmouth", -1.09, 50.80, "england", "fortress", {
        ports: ["englishChannel"],
        initial: {england: {regular: 1}},
        initialNaval: {england: {galleon: 1}},
    }),
    space("norwich", "Norwich", 1.30, 52.63, "england", "open", {
        area: "england",
        ports: ["northSea"],
        religion: "protestant",
        initial: {england: {regular: 1}},
    }),
    space("dover", "Dover", 1.31, 51.13, "england", "open", {
        ports: ["englishChannel"],
        initial: {england: {regular: 1}},
    }),

    // -------------------------------------------------------------- Scotland
    space("edinburgh", "Edinburgh", -3.19, 55.95, "scotland", "key", {
        area: "scotland",
        ports: ["northSea"],
        religion: "protestant",
        initial: {scotland: {regular: 2}},
    }),
    space("stirling", "Stirling", -3.94, 56.12, "scotland", "open", {
        area: "scotland",
        initial: {scotland: {regular: 1}},
    }),
    space("aberdeen", "Aberdeen", -2.10, 57.15, "scotland", "open", {
        area: "scotland",
        ports: ["northSea"],
        initial: {scotland: {regular: 1}},
    }),
    space("glasgow", "Glasgow", -4.25, 55.86, "scotland", "fortress", {
        area: "scotland",
        ports: ["atlanticOcean"],
        religion: "protestant",
    }),

    // ---------------------------------------------------------------- Ireland
    space("dublin", "Dublin", -6.26, 53.35, "ireland", "key", {
        ports: ["irishSea"],
        initial: {ireland: {regular: 1}},
    }),
    space("ulster", "Ulster", -5.93, 54.60, "ireland", "fortress", {
        ports: ["irishSea"],
        initial: {ireland: {regular: 2}},
    }),
    space("cork", "Cork", -8.47, 51.90, "ireland", "open", {
        ports: ["atlanticOcean"],
        initial: {ireland: {regular: 1}},
    }),

    // ----------------------------------------------------------------- Italy
    space("milan", "Milan", 9.19, 45.46, "spain", "key", {
        capitalOf: "spain",
        initial: {spain: {regular: 4, merc: 2}},
    }),
    space("turin", "Turin", 7.69, 45.07, "independent", "fortress", {
        initial: {spain: {regular: 1}},
    }),
    space("venice", "Venice", 12.33, 45.44, "venice", "key", {
        ports: ["adriatic"],
        initial: {venice: {regular: 2}},
        initialNaval: {venice: {galley: 2}},
    }),
    space("padua", "Padua", 11.88, 45.41, "venice", "open", {
        initial: {venice: {regular: 1}},
    }),
    space("florence", "Florence", 11.26, 43.77, "independent", "fortress", {
        initial: {independent: {regular: 2}},
    }),
    space("rome", "Rome", 12.50, 41.90, "papacy", "key", {
        ports: ["tyrrhenian"],
        initial: {papacy: {regular: 2}},
        initialNaval: {papacy: {galley: 1}},
    }),
    space("ancona", "Ancona", 13.52, 43.62, "papacy", "open", {
        ports: ["adriatic"],
        initial: {papacy: {regular: 1}},
    }),
    space("naples", "Naples", 14.25, 40.85, "spain", "key", {
        ports: ["tyrrhenian"],
        initial: {spain: {regular: 3}},
        initialNaval: {spain: {galley: 1}},
    }),
    space("palermo", "Palermo", 13.36, 38.12, "spain", "fortress", {
        ports: ["tyrrhenian"],
        initial: {spain: {regular: 1}},
    }),
    space("messina", "Messina", 15.55, 38.19, "spain", "fortress", {
        ports: ["tyrrhenian", "ionian"],
        initial: {spain: {regular: 1}},
    }),
    space("cagliari", "Cagliari", 9.11, 39.22, "spain", "fortress", {
        ports: ["tyrrhenian"],
        initial: {spain: {regular: 1}},
    }),

    // ---------------------------------------------------- Balkans and Anatolia
    space("belgrade", "Belgrade", 20.46, 44.82, "ottoman", "key", {
        initial: {ottoman: {regular: 3}},
    }),
    space("buda", "Buda", 19.04, 47.50, "ottoman", "key", {
        initial: {ottoman: {regular: 3, cav: 1}},
    }),
    space("temesvar", "Temesvar", 21.23, 45.75, "ottoman", "fortress", {
        initial: {ottoman: {regular: 2}},
    }),
    space("sarajevo", "Sarajevo", 18.41, 43.86, "ottoman", "fortress", {
        initial: {ottoman: {regular: 1}},
    }),
    space("sofia", "Sofia", 23.32, 42.70, "ottoman", "open", {
        initial: {ottoman: {regular: 2}},
    }),
    space("athens", "Athens", 23.73, 37.98, "ottoman", "open", {
        ports: ["aegean"],
        initial: {ottoman: {regular: 1}},
        initialNaval: {ottoman: {galley: 1}},
    }),
    space("edirne", "Edirne", 26.55, 41.67, "ottoman", "key", {
        initial: {ottoman: {regular: 2}},
    }),
    space("istanbul", "Istanbul", 28.97, 41.01, "ottoman", "key", {
        capitalOf: "ottoman",
        ports: ["aegean", "easternMediterranean"],
        initial: {ottoman: {regular: 4, cav: 2}},
        initialNaval: {ottoman: {galley: 2}},
    }),
    space("nicosia", "Nicosia", 33.36, 35.17, "ottoman", "key", {
        ports: ["easternMediterranean"],
        initial: {ottoman: {regular: 2}},
    }),
    space("candia", "Candia", 25.13, 35.34, "venice", "fortress", {
        ports: ["aegean", "easternMediterranean"],
        initial: {venice: {regular: 1}},
        initialNaval: {venice: {galley: 1}},
    }),
    space("ragusa", "Ragusa", 18.09, 42.65, "independent", "fortress", {
        ports: ["adriatic"],
        initial: {independent: {regular: 1}},
    }),

    // ------------------------------------------------------------ North Africa
    space("tunis", "Tunis", 10.18, 36.80, "independent", "key", {
        ports: ["barbaryCoast", "northAfricanCoast"],
        initial: {independent: {regular: 2}},
    }),
    space("algiers", "Algiers", 3.06, 36.75, "ottoman", "fortress", {
        ports: ["barbaryCoast"],
        initial: {ottoman: {regular: 2}},
    }),
    space("tripoli", "Tripoli", 13.19, 32.89, "ottoman", "fortress", {
        ports: ["northAfricanCoast"],
        initial: {ottoman: {regular: 1}},
    }),
];

/** Undirected land links. The third element marks a pass (2 CP to cross). */
export const LAND_LINKS: [string, string, boolean?][] = [
    // Iberia
    ["madrid", "barcelona"],
    ["madrid", "valencia"],
    ["madrid", "seville"],
    ["madrid", "corunna"],
    ["madrid", "pamplona"],
    ["madrid", "granada"],
    ["madrid", "lisbon"],
    ["barcelona", "valencia"],
    ["barcelona", "pamplona", true],
    ["valencia", "granada"],
    ["seville", "granada"],
    ["seville", "cadiz"],
    ["seville", "lisbon"],
    ["cadiz", "gibraltar"],
    ["corunna", "oporto"],
    ["oporto", "lisbon"],
    ["pamplona", "bearn", true],

    // France
    ["paris", "rouen"],
    ["paris", "amiens"],
    ["paris", "orleans"],
    ["paris", "dijon"],
    ["paris", "metz"],
    ["rouen", "amiens"],
    ["rouen", "nantes"],
    ["rouen", "brest"],
    ["amiens", "brussels"],
    ["amiens", "metz"],
    ["orleans", "bourges"],
    ["orleans", "nantes"],
    ["orleans", "laRochelle"],
    ["orleans", "clermont"],
    ["dijon", "bourges"],
    ["dijon", "lyon"],
    ["dijon", "metz"],
    ["dijon", "geneva"],
    ["bourges", "clermont"],
    ["clermont", "lyon"],
    ["clermont", "toulouse"],
    ["lyon", "marseille"],
    ["lyon", "geneva"],
    ["lyon", "turin", true],
    ["marseille", "toulouse"],
    ["marseille", "nimes"],
    ["marseille", "turin", true],
    ["toulouse", "bordeaux"],
    ["toulouse", "bearn"],
    ["toulouse", "nimes"],
    ["toulouse", "montauban"],
    ["bordeaux", "bearn"],
    ["bordeaux", "laRochelle"],
    ["bordeaux", "nantes"],
    ["nantes", "brest"],
    ["bearn", "montauban"],
    ["montauban", "nimes"],
    ["metz", "trier"],
    ["metz", "mainz"],
    ["geneva", "turin", true],

    // Netherlands and the Rhineland
    ["brussels", "antwerp"],
    ["brussels", "ghent"],
    ["brussels", "cologne"],
    ["antwerp", "ghent"],
    ["antwerp", "rotterdam"],
    ["antwerp", "brielle"],
    ["antwerp", "cologne"],
    ["amsterdam", "rotterdam"],
    ["amsterdam", "utrecht"],
    ["rotterdam", "utrecht"],
    ["rotterdam", "brielle"],
    ["rotterdam", "flushing"],
    ["flushing", "brielle"],
    ["flushing", "ghent"],
    ["flushing", "bruges"],
    ["ghent", "bruges"],
    ["cologne", "trier"],
    ["cologne", "mainz"],
    ["cologne", "frankfurt"],
    ["mainz", "trier"],
    ["mainz", "frankfurt"],
    ["frankfurt", "nuremberg"],

    // Holy Roman Empire
    ["nuremberg", "prague"],
    ["nuremberg", "munich"],
    ["nuremberg", "augsburg"],
    ["munich", "augsburg"],
    ["munich", "innsbruck"],
    ["augsburg", "innsbruck"],
    ["innsbruck", "milan", true],
    ["innsbruck", "venice", true],
    ["innsbruck", "graz", true],
    ["vienna", "pressburg"],
    ["vienna", "prague"],
    ["vienna", "graz"],
    ["vienna", "buda"],
    ["vienna", "breslau"],
    ["prague", "breslau"],
    ["pressburg", "buda"],
    ["pressburg", "zagreb"],
    ["graz", "zagreb"],

    // Italy
    ["milan", "turin"],
    ["milan", "venice"],
    ["milan", "florence", true],
    ["turin", "geneva"],
    ["venice", "padua"],
    ["venice", "florence"],
    ["venice", "ancona"],
    ["florence", "rome"],
    ["florence", "ancona"],
    ["rome", "naples"],
    ["rome", "ancona"],
    ["palermo", "messina"],

    // Balkans
    ["belgrade", "buda"],
    ["belgrade", "temesvar"],
    ["belgrade", "sarajevo"],
    ["belgrade", "zagreb"],
    ["buda", "temesvar"],
    ["buda", "zagreb"],
    ["temesvar", "sofia"],
    ["sarajevo", "sofia"],
    ["sarajevo", "ragusa"],
    ["sofia", "edirne"],
    ["sofia", "athens"],
    ["edirne", "istanbul"],
    ["edirne", "athens"],
    ["zagreb", "sarajevo"],

    // British Isles
    ["london", "york"],
    ["london", "bristol"],
    ["london", "portsmouth"],
    ["london", "norwich"],
    ["london", "dover"],
    ["york", "norwich"],
    ["york", "edinburgh"],
    ["bristol", "plymouth"],
    ["plymouth", "portsmouth"],
    ["portsmouth", "dover"],
    ["edinburgh", "stirling"],
    ["edinburgh", "glasgow"],
    ["edinburgh", "aberdeen"],
    ["stirling", "glasgow"],
    ["stirling", "aberdeen"],
    ["glasgow", "aberdeen"],
    ["dublin", "ulster"],
    ["dublin", "cork"],

    // North Africa
    ["tunis", "algiers"],
    ["tunis", "tripoli"],
];

export const SEA_ZONES: SeaZoneDef[] = [
    {
        id: "atlanticOcean",
        name: "Atlantic Ocean",
        kind: "atlantic",
        label: [-11, 45],
        adjacent: ["bayOfBiscay", "irishSea", "northSea"],
        ports: [],
    },
    {
        id: "irishSea",
        name: "Irish Sea",
        kind: "atlantic",
        label: [-6.2, 53.9],
        adjacent: ["atlanticOcean", "englishChannel"],
        ports: [],
    },
    {
        id: "englishChannel",
        name: "English Channel",
        kind: "atlantic",
        label: [0.4, 49.9],
        adjacent: ["irishSea", "northSea", "bayOfBiscay"],
        ports: [],
    },
    {
        id: "northSea",
        name: "North Sea",
        kind: "atlantic",
        label: [3.2, 56.3],
        adjacent: ["atlanticOcean", "englishChannel"],
        ports: [],
    },
    {
        id: "bayOfBiscay",
        name: "Bay of Biscay",
        kind: "atlantic",
        label: [-5.5, 45.2],
        adjacent: ["atlanticOcean", "englishChannel"],
        ports: [],
    },
    {
        id: "gulfOfLyon",
        name: "Gulf of Lyon",
        kind: "mediterranean",
        label: [4.5, 41.2],
        adjacent: ["tyrrhenian", "barbaryCoast"],
        ports: [],
    },
    {
        id: "tyrrhenian",
        name: "Tyrrhenian Sea",
        kind: "mediterranean",
        label: [12.2, 39.2],
        adjacent: ["gulfOfLyon", "northAfricanCoast"],
        ports: [],
    },
    {
        id: "ionian",
        name: "Ionian Sea",
        kind: "mediterranean",
        label: [17.5, 37.2],
        adjacent: ["northAfricanCoast", "adriatic", "aegean"],
        ports: [],
    },
    {
        id: "adriatic",
        name: "Adriatic Sea",
        kind: "mediterranean",
        label: [15.7, 43.1],
        adjacent: ["ionian"],
        ports: [],
    },
    {
        id: "aegean",
        name: "Aegean Sea",
        kind: "mediterranean",
        label: [25.2, 38.4],
        adjacent: ["ionian", "easternMediterranean"],
        ports: [],
    },
    {
        id: "easternMediterranean",
        name: "Eastern Mediterranean",
        kind: "mediterranean",
        label: [30.5, 34.8],
        adjacent: ["aegean", "northAfricanCoast"],
        ports: [],
    },
    {
        id: "barbaryCoast",
        name: "Barbary Coast",
        kind: "mediterranean",
        label: [5.0, 37.4],
        adjacent: ["gulfOfLyon", "northAfricanCoast"],
        ports: [],
    },
    {
        id: "northAfricanCoast",
        name: "North African Coast",
        kind: "mediterranean",
        label: [15.0, 32.8],
        adjacent: ["barbaryCoast", "tyrrhenian", "ionian", "easternMediterranean"],
        ports: [],
    },
];

export const SPACE_BY_ID: Record<string, SpaceDef> = Object.fromEntries(
    SPACES.map((s) => [s.id, s]),
);

export const SEA_ZONE_BY_ID: Record<string, SeaZoneDef> = Object.fromEntries(
    SEA_ZONES.map((s) => [s.id, s]),
);

/** Land neighbours, with the pass flag preserved. */
export const LAND_NEIGHBORS: Record<string, { id: string; pass: boolean }[]> =
    Object.fromEntries(SPACES.map((s) => [s.id, [] as { id: string; pass: boolean }[]]));

for (const [a, b, pass] of LAND_LINKS) {
    LAND_NEIGHBORS[a].push({id: b, pass: pass === true});
    LAND_NEIGHBORS[b].push({id: a, pass: pass === true});
}

/** Ports of each sea zone, derived from the spaces. */
export const SEA_PORTS: Record<SeaZoneID, string[]> = Object.fromEntries(
    SEA_ZONES.map((z) => [z.id, [] as string[]]),
) as Record<SeaZoneID, string[]>;

for (const s of SPACES) {
    for (const z of s.ports ?? []) {
        SEA_PORTS[z].push(s.id);
    }
}

for (const z of SEA_ZONES) {
    z.ports = SEA_PORTS[z.id];
}

export const KEY_SPACES: string[] = SPACES.filter((s) => s.kind === "key").map((s) => s.id);

export const CAPITAL_SPACES: Record<Power, string[]> = {
    ottoman: ["istanbul"],
    spain: ["madrid", "milan"],
    england: ["london"],
    france: ["paris"],
    hre: ["vienna"],
    protestant: ["laRochelle", "amsterdam"],
};

export const isFortified = (s: SpaceDef, state?: { fortress: boolean }): boolean =>
    s.kind !== "open" || (state?.fortress ?? false);

/** Every space that starts under the political control of each power. */
export const initialControl = (s: SpaceDef): Controller => s.control ?? s.home;

export const initialReligion = (s: SpaceDef): Religion => s.religion ?? "catholic";

export const initialLandFor = (s: SpaceDef, c: Controller): LandStack | undefined => {
    const raw = s.initial?.[c];
    if (raw === undefined) {
        return undefined;
    }
    return {regular: raw.regular ?? 0, merc: raw.merc ?? 0, cav: raw.cav ?? 0};
};

export const initialNavalFor = (s: SpaceDef, c: Controller): NavalStack | undefined => {
    const raw = s.initialNaval?.[c];
    if (raw === undefined) {
        return undefined;
    }
    return {
        galley: raw.galley ?? 0,
        galleon: raw.galleon ?? 0,
        racebuilt: raw.racebuilt ?? 0,
        corsair: raw.corsair ?? 0,
    };
};

/** Protestant keys in the Netherlands are worth 3 VP; all other keys 2 VP. */
export const DUTCH_KEYS = ["amsterdam", "antwerp", "brussels"];
