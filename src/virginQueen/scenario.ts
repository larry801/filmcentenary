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
import {OFFICIAL_CARDS} from "./data/cards";
import {validateSetupData} from "./configuration";

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

export const scenarioFromSetupData = (setupData?: ScenarioSetupData): ScenarioID => {
    const error = validateSetupData(setupData, setupData?.scenario === "tutorial" ? 2 : 6);
    if (error) throw new Error(error);
    return setupData?.scenario ?? "campaign";
};

const cloneScenario = (id: ScenarioID): ScenarioSetup =>
    JSON.parse(JSON.stringify(SCENARIOS[id])) as ScenarioSetup;

const removeCardsByName = (setup: ScenarioSetup, names: string[]): void => {
    const numbers = OFFICIAL_CARDS.filter((card) => names.includes(card.nameEn)).map((card) => card.number);
    setup.cardsInPlay = setup.cardsInPlay.filter((number) => !numbers.includes(number)).sort((first, second) => first - second);
    setup.cardsRemoved = [...new Set([...setup.cardsRemoved, ...numbers])].sort((first, second) => first - second);
};

/**
 * Scenario Book p. 12: 2- and 3-player modifications.  Both configurations
 * print the same card, royal, patronage, sea-captain and artist/scientist
 * removals; they differ only in the seating and the Ottoman influence column
 * (handled in `setupGame`).  The UI exposes 3 players for the Campaign only.
 */
const reducedMajorSetup = (id: ScenarioID): ScenarioSetup => {
    const setup = cloneScenario(id);
    const removed = ["Grand Vizier", "Ottoman Tribute", "Holy Roman Intercession", "Patron of Arts & Sciences", "War with Poland", "War in Persia"];
    const removedNumbers = OFFICIAL_CARDS.filter((card) => removed.includes(card.nameEn)).map((card) => card.number);
    setup.cardsInPlay = [...new Set([...setup.cardsInPlay, 4, 37])].filter((number) => !removedNumbers.includes(number)).sort((first, second) => first - second);
    setup.cardsRemoved = setup.cardsRemoved.filter((number) => number !== 4 && number !== 37);
    setup.cardsRemoved = [...new Set([...setup.cardsRemoved, ...removedNumbers])].sort((first, second) => first - second);
    setup.royals = setup.royals.filter((royal) => royal.nameEn !== "Rudolf II");
    const removedPatrons = ["sinan", "seydiAliReis", "taqiAlDin", "baki", "mercator", "arcimboldo", "brahe", "spranger", "kepler"];
    setup.patronage.artists = setup.patronage.artists.filter((patron) => !removedPatrons.includes(patron));
    setup.patronage.scientists = setup.patronage.scientists.filter((patron) => !removedPatrons.includes(patron));
    const removedAwards = ["suleimaniyeMosque", "elegyForSuleiman", "vertumnus", "lawsPlanetaryMotion", "mirrorOfCountries"];
    setup.patronage.vpAwards = setup.patronage.vpAwards.filter((award) => !removedAwards.includes(award));
    setup.patronage.scienceBonuses = setup.patronage.scienceBonuses.filter((bonus) => bonus !== "excavation");
    for (const power of POWERS) {
        setup.powerCard[power].seaCaptains = setup.powerCard[power].seaCaptains?.filter((captain) => !["muratReis", "henszlein"].includes(captain));
    }
    return setup;
};

/** Scenario Book p. 12: 5-player modifications (Ottoman seated, HRE inactive). */
const fivePlayerSetup = (id: ScenarioID): ScenarioSetup => {
    const setup = cloneScenario(id);
    removeCardsByName(setup, ["Holy Roman Intercession", "Patron of Arts & Sciences", "War with Poland", "The Sublime Porte"]);
    setup.cardsInPlay = [...new Set([...setup.cardsInPlay, 4])].sort((first, second) => first - second);
    setup.cardsRemoved = setup.cardsRemoved.filter((number) => number !== 4);
    setup.royals = setup.royals.filter((royal) => royal.nameEn !== "Rudolf II");
    const removedPatrons = ["mercator", "arcimboldo", "brahe", "spranger", "kepler"];
    setup.patronage.artists = setup.patronage.artists.filter((patron) => !removedPatrons.includes(patron));
    setup.patronage.scientists = setup.patronage.scientists.filter((patron) => !removedPatrons.includes(patron));
    const removedAwards = ["vertumnus", "lawsPlanetaryMotion"];
    setup.patronage.vpAwards = setup.patronage.vpAwards.filter((award) => !removedAwards.includes(award));
    for (const power of POWERS) {
        setup.powerCard[power].seaCaptains = setup.powerCard[power].seaCaptains?.filter((captain) => captain !== "henszlein");
    }
    return setup;
};

export const scenarioSetup = (id: ScenarioID, numPlayers = 6): ScenarioSetup => {
    if (id === "tutorial") return SCENARIOS[id];
    if (numPlayers === 2 || numPlayers === 3) return reducedMajorSetup(id);
    if (numPlayers === 5) return fivePlayerSetup(id);
    return SCENARIOS[id];
};

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
