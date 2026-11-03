import {
    Controller,
    LandStack,
    LeaderState,
    NavalStack,
    Power,
    POWERS,
    RoyalDef,
    ScenarioID,
    SpaceState,
    emptyLand,
    emptyNaval,
} from "./constant/general";
import {LEADERS} from "./constant/leaders";
import {PATRON_BY_ID} from "./data/patrons";
import {ROYAL_BY_ID} from "./data/royals";
import {SCENARIOS} from "./data/scenarios";
import {SCIENCE_BONUSES, SCIENCE_BONUS_BY_ID} from "./data/scienceBonuses";
import {SEA_CAPTAINS, SEA_CAPTAIN_BY_ID} from "./data/seaCaptains";
import {PowerCardSetup, ScenarioSetup, ScenarioSpaceSetup} from "./data/types";
import {OFFICIAL_SPACES} from "./data/spaces";

/**
 * Adapter between the official Scenario Book data (`data/`) and the runtime
 * state in `constant/general.ts`.
 *
 * The official data keeps every printed value it can prove.  A few runtime
 * concepts do not exist in the PDFs (for example royal gender, which is not
 * printed on the Royal Weddings card); those are kept here as an explicit
 * runtime-only mapping rather than being mixed into the data layer.
 */

export interface ScenarioSetupData {
    scenario?: ScenarioID;
}

export const scenarioFromSetupData = (setupData?: ScenarioSetupData): ScenarioID =>
    setupData?.scenario === "tournament" ? "tournament" : "campaign";

export const scenarioSetup = (id: ScenarioID): ScenarioSetup => SCENARIOS[id];

export const scenarioName = (id: ScenarioID): string => SCENARIOS[id].nameZh;

// --------------------------------------------------------------------------
// Spaces
// --------------------------------------------------------------------------

const normalizeLand = (raw?: Partial<LandStack>): LandStack => ({
    regular: raw?.regular ?? 0,
    merc: raw?.merc ?? 0,
    cav: raw?.cav ?? 0,
});

const normalizeNaval = (raw?: Partial<NavalStack>): NavalStack => ({
    galley: raw?.galley ?? 0,
    galleon: raw?.galleon ?? 0,
    racebuilt: raw?.racebuilt ?? 0,
    corsair: raw?.corsair ?? 0,
});

const landCount = (s: LandStack): number => s.regular + s.merc + s.cav;
const navalCount = (s: NavalStack): number => s.galley + s.galleon + s.racebuilt + s.corsair;

/**
 * Build the initial space states for a scenario.
 *
 * Spaces that the Scenario Book does not explicitly mention keep their
 * historical home power and Catholic religious influence.  Control markers,
 * units and religion that are printed in the setup are applied verbatim.
 */
export const scenarioSpaces = (setup: ScenarioSetup): Record<string, SpaceState> => {
    const spaces: Record<string, SpaceState> = {};
    for (const def of OFFICIAL_SPACES) {
        const ss: ScenarioSpaceSetup | undefined = setup.spaces[def.id];
        const land: SpaceState["land"] = {};
        const naval: SpaceState["naval"] = {};
        for (const owner of Object.keys(ss?.units ?? {}) as Controller[]) {
            const stack = normalizeLand(ss?.units?.[owner]);
            if (landCount(stack) > 0) {
                land[owner] = stack;
            }
        }
        for (const owner of Object.keys(ss?.naval ?? {}) as Controller[]) {
            const stack = normalizeNaval(ss?.naval?.[owner]);
            if (navalCount(stack) > 0) {
                naval[owner] = stack;
            }
        }
        spaces[def.id] = {
            control: ss?.control ?? def.home,
            religion: ss?.religion ?? "catholic",
            land,
            naval,
            leaders: [...(ss?.leaders ?? [])],
            unrest: ss?.unrest ?? false,
            fortress: ss?.fortress ?? def.kind !== "open",
        };
    }
    return spaces;
};

// --------------------------------------------------------------------------
// Leaders
// --------------------------------------------------------------------------

export const scenarioLeaders = (
    setup: ScenarioSetup,
    spaces: Record<string, SpaceState>,
): Record<string, LeaderState> => {
    const leaders: Record<string, LeaderState> = {};
    for (const def of LEADERS) {
        leaders[def.id] = {id: def.id, location: "pool"};
    }
    for (const space of Object.keys(spaces)) {
        for (const id of spaces[space].leaders) {
            leaders[id] = {id, location: space};
        }
    }
    for (const p of POWERS) {
        for (const id of powerCardSummary(setup, p).leadersOffMap) {
            if (leaders[id] !== undefined) {
                leaders[id] = {id, location: "pool"};
            }
        }
        for (const id of powerCardSummary(setup, p).outOfGame) {
            delete leaders[id];
        }
    }
    return leaders;
};

// --------------------------------------------------------------------------
// Power cards
// --------------------------------------------------------------------------

export interface PowerCardSummary {
    scmOnCard: number;
    seaCaptains: string[];
    sharedSeaCaptains: string[];
    treasures: number;
    mercenariesForHire: number;
    suezAttempts: number;
    leadersOffMap: string[];
    outOfGame: string[];
    notes: string[];
}

const emptySummary = (): PowerCardSummary => ({
    scmOnCard: 0,
    seaCaptains: [],
    sharedSeaCaptains: [],
    treasures: 0,
    mercenariesForHire: 0,
    suezAttempts: 0,
    leadersOffMap: [],
    outOfGame: [],
    notes: [],
});

const mergeCard = (summary: PowerCardSummary, card: PowerCardSetup | undefined): void => {
    if (card === undefined) {
        return;
    }
    summary.scmOnCard += card.scmOnCard ?? 0;
    summary.seaCaptains.push(...(card.seaCaptains ?? []));
    summary.sharedSeaCaptains.push(...(card.sharedSeaCaptains ?? []));
    summary.treasures += card.treasures ?? 0;
    summary.mercenariesForHire += card.mercenariesForHire ?? 0;
    summary.suezAttempts += card.suezAttempts ?? 0;
    summary.leadersOffMap.push(...(card.leadersOffMap ?? []));
    summary.outOfGame.push(...(card.outOfGame ?? []));
    summary.notes.push(...(card.bonusVpNotes ?? []));
};

/** Merge the Protestant Dutch/Huguenot cards into one runtime power card. */
export const powerCardSummary = (setup: ScenarioSetup, p: Power): PowerCardSummary => {
    const summary = emptySummary();
    const card = setup.powerCard[p];
    mergeCard(summary, card);
    if (card.components !== undefined) {
        for (const component of Object.values(card.components)) {
            mergeCard(summary, component);
        }
    }
    return summary;
};

export const scenarioSeaCaptains = (setup: ScenarioSetup): string[] => {
    const ids = new Set<string>();
    for (const p of POWERS) {
        const card = powerCardSummary(setup, p);
        for (const id of [...card.seaCaptains, ...card.sharedSeaCaptains]) {
            ids.add(id);
        }
    }
    return [...ids];
};

// --------------------------------------------------------------------------
// Patronage and science
// --------------------------------------------------------------------------

export interface RuntimePatron {
    id: string;
    name: string;
    nameZh?: string;
    kind: "artist" | "scientist";
    region: string;
    rating: number | null;
    artistType?: "writer" | "painter" | "architect";
}

export const patronDef = (id: string): RuntimePatron | undefined => {
    const p = PATRON_BY_ID[id];
    if (p === undefined) {
        return undefined;
    }
    return {
        id: p.id,
        name: p.nameEn,
        nameZh: p.nameZh,
        kind: p.kind,
        region: p.region,
        rating: p.rating,
        artistType: p.artistType,
    };
};

export const scenarioPatrons = (setup: ScenarioSetup): string[] => [
    ...setup.patronage.artists,
    ...setup.patronage.scientists,
];

export const patronById = (G: {patronsAvailable: string[]}, id: string): RuntimePatron | undefined =>
    G.patronsAvailable.includes(id) ? patronDef(id) : undefined;

export const scienceBonusById = (id: string) => SCIENCE_BONUS_BY_ID[id];

export const seaCaptainById = (id: string) => SEA_CAPTAIN_BY_ID[id];

export {SCIENCE_BONUSES, SEA_CAPTAINS};

// --------------------------------------------------------------------------
// Royals
// --------------------------------------------------------------------------

/**
 * Runtime ids keep the existing code (`elizabeth`, `philip`, ...) working.
 * New scenario-only royals use their official id unchanged.
 */
const RUNTIME_ROYAL_IDS: Record<string, string> = {
    elizabethI: "elizabeth",
    philipII: "philip",
    maryQueenOfScots: "maryScots",
};

/** Gender is not printed in the Scenario Book; this is a runtime mapping. */
const ROYAL_GENDER: Record<string, "male" | "female"> = {
    elizabethI: "female",
    philipII: "male",
    donCarlos: "male",
    elisabethValois: "female",
    charlesII: "male",
    williamOrange: "male",
    leicester: "male",
    annaSaxony: "female",
    arran: "male",
    margueriteValois: "female",
    henryIII: "male",
    henryIV: "male",
    charlesIX: "male",
    annaAustria: "female",
    elisabethAustria: "female",
    maryQueenOfScots: "female",
    darnley: "male",
    rudolfII: "male",
    louiseLorraine: "female",
    louiseColigny: "female",
    alencon: "male",
    isabellaClaraEugenia: "female",
};

const ROYAL_FAMILY: Record<string, "valois" | "hapsburg"> = {
    philipII: "hapsburg",
    donCarlos: "hapsburg",
    charlesII: "hapsburg",
    annaAustria: "hapsburg",
    elisabethAustria: "hapsburg",
    isabellaClaraEugenia: "hapsburg",
    elisabethValois: "valois",
    margueriteValois: "valois",
    henryIII: "valois",
    charlesIX: "valois",
    alencon: "valois",
};

export const scenarioRoyals = (setup: ScenarioSetup): RoyalDef[] => {
    return setup.royals.map((royal) => {
        const base = ROYAL_BY_ID[royal.id];
        const status = royal.status ?? setup.royalStatus?.[royal.id];
        return {
            id: RUNTIME_ROYAL_IDS[royal.id] ?? royal.id,
            name: base?.nameEn ?? royal.nameEn,
            nameZh: base?.nameZh ?? royal.nameZh,
            power: (royal.country === "any" ? "france" : royal.country) as Power,
            gender: ROYAL_GENDER[royal.id] ?? "male",
            family: ROYAL_FAMILY[royal.id],
            turn: royal.turn,
            eligibility: royal.eligibility,
            status,
            alive: status !== "dead",
            married: setup.id === "campaign" && (royal.id === "philipII" || royal.id === "elisabethValois"),
        };
    });
};

export const royalAvailable = (royal: RoyalDef): boolean =>
    royal.alive && !royal.married && (royal.status ?? "available") === "available";
