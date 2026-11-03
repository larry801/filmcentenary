import type {CardEffect as OfficialCardEffect} from "../data/types";

/**
 * Virgin Queen: Wars of Religion ~ 1559-1598
 *
 * Core types for the six-power, card-driven game. The rulebook supplied with the
 * project ("vq_rules_final_lo-res.pdf") contains the rules but not the scenario
 * book, the map, or the 112-card deck, so the map and deck in this module are a
 * curated reconstruction (see VIRGIN_QUEEN.md).
 */

export const POWERS = [
    "ottoman",
    "spain",
    "england",
    "france",
    "hre",
    "protestant",
] as const;

export type Power = typeof POWERS[number];

export type ScenarioID = "campaign" | "tournament" | "tutorial";

export const POWER_INDEX: Record<Power, number> = {
    ottoman: 0,
    spain: 1,
    england: 2,
    france: 3,
    hre: 4,
    protestant: 5,
};

export const powerAt = (playerID: string | null | undefined): Power => {
    const idx = Number(playerID);
    return POWERS[Number.isFinite(idx) && idx >= 0 && idx < POWERS.length ? idx : 0];
};

export const isPower = (value: string): value is Power =>
    (POWERS as readonly string[]).includes(value);

export const POWER_NAMES: Record<Power, { en: string; zh: string; short: string }> = {
    ottoman: {en: "Ottoman Empire", zh: "奥斯曼帝国", short: "Ottoman"},
    spain: {en: "Spain", zh: "西班牙", short: "Spain"},
    england: {en: "England", zh: "英格兰", short: "England"},
    france: {en: "France", zh: "法国", short: "France"},
    hre: {en: "Holy Roman Empire", zh: "神圣罗马帝国", short: "Holy Roman"},
    protestant: {en: "Protestants", zh: "新教联盟", short: "Protestant"},
};

export const POWER_COLORS: Record<Power, string> = {
    ottoman: "#1b5e20",
    spain: "#e0b42a",
    england: "#c62828",
    france: "#1a3f8f",
    hre: "#2b2b2b",
    protestant: "#ef7d1a",
};

export type MinorPower = "ireland" | "papacy" | "portugal" | "scotland" | "venice";
export type Independent = "independent";

export const MINOR_POWERS: MinorPower[] = [
    "scotland",
    "ireland",
    "portugal",
    "papacy",
    "venice",
];

export type Controller = Power | MinorPower | Independent;

export const MINOR_NAMES: Record<MinorPower | Independent, { en: string; zh: string }> = {
    scotland: {en: "Scotland", zh: "苏格兰"},
    ireland: {en: "Ireland", zh: "爱尔兰"},
    portugal: {en: "Portugal", zh: "葡萄牙"},
    papacy: {en: "Papacy", zh: "教宗国"},
    venice: {en: "Venice", zh: "威尼斯"},
    independent: {en: "Independent", zh: "独立"},
};

export const CONTROLLER_COLORS: Record<Controller, string> = {
    ...POWER_COLORS,
    scotland: "#4fc3f7",
    ireland: "#66bb6a",
    portugal: "#6d1b1b",
    papacy: "#8e24aa",
    venice: "#ec407a",
    independent: "#9e9e9e",
};

export const controllerName = (c: Controller): string =>
    isPower(c) ? POWER_NAMES[c].en : MINOR_NAMES[c].en;

export const controllerNameZh = (c: Controller): string =>
    isPower(c) ? POWER_NAMES[c].zh : MINOR_NAMES[c].zh;

export type Religion = "catholic" | "protestant";
export type HreReligiousPreference = Religion | "balanced";
export const HRE_RELIGIOUS_PREFERENCE_NAMES: Record<HreReligiousPreference, string> = {
    catholic: "天主教",
    protestant: "新教",
    balanced: "平衡",
};
export type ReligionArea = "england" | "scotland" | "netherlands" | "france";

export const RELIGION_AREAS: ReligionArea[] = [
    "england",
    "scotland",
    "netherlands",
    "france",
];

export const AREA_NAMES: Record<ReligionArea, { en: string; zh: string }> = {
    england: {en: "England", zh: "英格兰"},
    scotland: {en: "Scotland", zh: "苏格兰"},
    netherlands: {en: "Netherlands", zh: "尼德兰"},
    france: {en: "France", zh: "法国"},
};

export interface LandStack {
    regular: number;
    merc: number;
    cav: number;
}

export interface NavalStack {
    galley: number;
    galleon: number;
    racebuilt: number;
    corsair: number;
}

export const emptyLand = (): LandStack => ({regular: 0, merc: 0, cav: 0});

export const emptyNaval = (): NavalStack => ({
    galley: 0,
    galleon: 0,
    racebuilt: 0,
    corsair: 0,
});

export const landCount = (s: LandStack | undefined): number =>
    s === undefined ? 0 : s.regular + s.merc + s.cav;

export const navalCount = (s: NavalStack | undefined): number =>
    s === undefined ? 0 : s.galley + s.galleon + s.racebuilt + s.corsair;

export type LeaderKind = "army" | "naval";

export interface LeaderDef {
    id: string;
    name: string;
    power: Power;
    kind: LeaderKind;
    /** Battle rating: adds dice and modifies intercept/avoid rolls. */
    battle: number;
    /** Command rating (army leaders only). */
    command?: number;
    /** Extra piracy dice (naval leaders such as Dragut). */
    piracy?: number;
    /** Starting location: a space id, a sea zone id, or "pool". */
    start?: string;
}

export interface LeaderState {
    id: string;
    /** Space id, sea zone id, "pool" or "captured". */
    location: string;
    capturedBy?: Power;
    returnTurn?: number;
}

export interface Ruler {
    /** Stable ruler id, used for ruler-dependent rules such as the Home card exception. */
    id: string;
    name: string;
    /** Number of cards that may be kept between turns. */
    admin: number;
    /** Extra cards dealt each turn. */
    cardBonus: number;
}

export interface PowerInfo {
    power: Power;
    ruler: Ruler;
    /** Cards dealt (before ruler bonus) for 0,1,2,... controlled keys. */
    drawByKeys: number[];
    /** Base VP for 0,1,2,... controlled keys (Protestant uses its own rule). */
    vpByKeys: number[];
    /** Keys (not in unrest) needed for an immediate military victory. */
    autoWinKeys: number;
    homeCards: string[];
}

export const POWER_INFO: Record<Power, PowerInfo> = {
    ottoman: {
        power: "ottoman",
        ruler: {id: "suleiman", name: "Suleiman the Magnificent", admin: 2, cardBonus: 1},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        vpByKeys: [0, 1, 2, 4, 6, 9, 12, 16, 20],
        autoWinKeys: 7,
        homeCards: ["vq-001", "vq-002"],
    },
    spain: {
        power: "spain",
        ruler: {id: "philipII", name: "Philip II", admin: 1, cardBonus: 0},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        vpByKeys: [0, 1, 2, 4, 6, 9, 12, 16, 20],
        autoWinKeys: 8,
        homeCards: ["vq-003", "vq-099"],
    },
    england: {
        power: "england",
        ruler: {id: "elizabethI", name: "Elizabeth I", admin: 2, cardBonus: 1},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        vpByKeys: [0, 1, 2, 4, 6, 9, 12, 16, 20],
        autoWinKeys: 5,
        homeCards: ["vq-036", "vq-081"],
    },
    france: {
        power: "france",
        ruler: {id: "henryIII", name: "Henry III", admin: 1, cardBonus: 0},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        vpByKeys: [0, 1, 2, 4, 6, 9, 12, 16, 20],
        autoWinKeys: 5,
        homeCards: ["vq-033", "vq-080"],
    },
    hre: {
        power: "hre",
        ruler: {id: "ferdinandI", name: "Ferdinand I", admin: 2, cardBonus: 0},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        vpByKeys: [0, 1, 2, 4, 6, 9, 12, 16, 20],
        autoWinKeys: 5,
        homeCards: ["vq-034", "vq-035"],
    },
    protestant: {
        power: "protestant",
        ruler: {id: "reformedChurches", name: "Council of the Reformed Churches", admin: 2, cardBonus: 0},
        drawByKeys: [4, 4, 5, 5, 6, 6, 7, 7, 7],
        vpByKeys: [0, 1, 2, 4, 6, 9, 12, 16, 20],
        autoWinKeys: 5,
        homeCards: ["vq-032", "vq-111"],
    },
};

/** Display names for the ruler ids stored on each power state. */
export const RULER_NAMES: Record<string, string> = {
    suleiman: "Suleiman the Magnificent",
    selimII: "Selim II",
    muradIII: "Murad III",
    philipII: "Philip II",
    elizabethI: "Elizabeth I",
    henryIII: "Henry III",
    ferdinandI: "Ferdinand I",
    reformedChurches: "Council of the Reformed Churches",
};

export type SeaZoneID =
    | "atlanticOcean"
    | "irishSea"
    | "englishChannel"
    | "northSea"
    | "bayOfBiscay"
    | "gulfOfLyon"
    | "tyrrhenian"
    | "ionian"
    | "adriatic"
    | "aegean"
    | "easternMediterranean"
    | "barbaryCoast"
    | "northAfricanCoast";

export type SeaZoneKind = "atlantic" | "mediterranean";

export interface SeaZoneDef {
    id: SeaZoneID;
    name: string;
    kind: SeaZoneKind;
    /** Label position (lon, lat) used by the schematic map. */
    label: [number, number];
    adjacent: SeaZoneID[];
    ports: string[];
}

export type SpaceKind = "key" | "fortress" | "open";

export interface SpaceDef {
    id: string;
    name: string;
    /** Geographic coordinates used to place the space on the schematic map. */
    lon: number;
    lat: number;
    /** Historical home power of the space. */
    home: Controller;
    kind: SpaceKind;
    capitalOf?: Power;
    area?: ReligionArea;
    ports?: SeaZoneID[];
    /** Initial political control, when it differs from the home power. */
    control?: Controller;
    /** Initial religious influence (defaults to Catholic). */
    religion?: Religion;
    initial?: Partial<Record<Controller, Partial<LandStack>>>;
    initialNaval?: Partial<Record<Controller, Partial<NavalStack>>>;
}

export type CardKind = "event" | "home" | "command";

export type EventEffect =
    | {kind: "conversion"; side: Religion; area: ReligionArea; dice: number; autoSix?: boolean; unrest?: number}
    | {kind: "unrestSpanish"; count: number}
    | {kind: "unrestArea"; area: ReligionArea; count: number}
    | {kind: "draw"; count: number}
    | {kind: "treasure"; count: number}
    | {kind: "vp"; power?: Power; relative?: boolean; amount: number; condition?: "unmarriedElizabeth" | "atWarEngland" | "controlsDutchKeys"}
    | {kind: "mercs"; count: number}
    | {kind: "dowCost"; amount: number}
    | {kind: "suez"}
    | {kind: "armada"}
    | {kind: "discard"; count: number}
    | {kind: "influence"; count: number};

export interface CardDef {
    id: string;
    name: string;
    /** Command point value. */
    cp: number;
    kind: CardKind;
    /** Official Home cards for this power; availability is checked each turn. */
    power?: Power;
    text?: string;
    effect?: EventEffect | EventEffect[];
    /** Metadata preserved from the official 112-card table. */
    officialNumber?: number;
    officialKind?: "event" | "response" | "combat" | "mandatory" | "home";
    /** Full typed effect from the official card table. */
    officialEffect?: OfficialCardEffect;
    removeOnEvent?: boolean;
    removeAfterUse?: boolean;
}

export interface CardWindow {
    kind: "response" | "combat";
    phase?: "field" | "naval" | "assault";
    location?: string;
    attacker?: Power;
    affectedPower?: Power;
}

export interface SpaceState {
    control: Controller;
    religion: Religion;
    /** Land units, keyed by their owner (major, minor or independent). */
    land: Partial<Record<Controller, LandStack>>;
    /** Naval units in the port. */
    naval: Partial<Record<Controller, NavalStack>>;
    leaders: string[];
    unrest: boolean;
    /** A fortress marker is present. Keys are fortified by definition. */
    fortress: boolean;
    siege?: {
        by: Power;
        /** Impulse number in which the siege began. */
        sinceImpulse: number;
    };
}

export interface SeaState {
    naval: Partial<Record<Controller, NavalStack>>;
    leaders: string[];
}

export interface PowerState {
    power: Power;
    /** Current ruler id (the Ottoman changes from Suleiman to Selim II). */
    ruler: string;
    cards: string[];
    treasures: number[];
    /** Command points left in the current impulse. */
    cp: number;
    cardPlayed: boolean;
    treasurePlayed: boolean;
    /** Accumulated bonus VP (patronage, piracy, marriages, events). */
    bonusVp: number;
    /** Persistent -1/+1 card markers (foreign wars, Suez, etc.). */
    cardModifier: number;
    wars: Power[];
    warsMinors: MinorPower[];
    allies: Power[];
    /** Minor powers allied through the scenario setup. */
    alliedMinors: MinorPower[];
    influence: Partial<Record<MinorPower, number>>;
    patrons: string[];
    /** Sea captains currently available to this power. */
    seaCaptains: string[];
    /** Science bonuses this power has acquired. */
    scienceBonuses: string[];
    /** Persistent patronage roll modifier (for example, Isabella Eugenia). */
    patronageModifier: number;
    /** Square control markers printed on the power card. */
    scmOnCard: number;
    /** True when the power has passed and no one has acted since. */
    passed: boolean;
    /**
     * Home cards placed face down on the power card during Spring Deployment
     * because they were not chosen. Their identities are secret until the next
     * Card Draw; used Home cards go to the public homeSetAside list instead.
     */
    homeCardSetAside: string[];
    /** True once this power has resolved its Spring Home card choice. */
    homeCardChoiceDone: boolean;
}

export interface VQGame {
    espionage?: import("../espionageTypes").EspionageState;
    pendingEspionage?: import("../espionageTypes").PendingEspionage;
    playerPowers?: Record<string, Power[]>;
    activatedMajors?: Partial<Record<Power, {ally: Power; baseline: number}>>;
    majorInfluence?: Partial<Record<Power, Partial<Record<Power, number>>>>;
    pendingActivation?: {power: Power; ally: Power; aggressor?: Power};
    majorDiplomacyResolved?: Power[];
    tutorialHreAlly?: Power;
    tutorialEffects?: {
        nextDraw: Partial<Record<Power, number>>;
        skip: Power[];
        piracyVp: number;
        cyprusTarget?: string;
        cyprusAwarded?: boolean;
        haremImpulse?: number;
        dragutWindow?: boolean;
        moriscoSpace?: string;
        stormImpulse?: number;
        movedAfterStorm?: string[];
    };
    pendingCardEvent?: {
        kind: "grandVizier";
        cardId: string;
        responding: "ottoman";
        step: "effect" | "recruit";
        remaining: number;
    } | {
        kind: "cancelEvent";
        cardId: string;
        power: Power;
        responding: "ottoman";
        target?: string;
    };
    pendingTutorialEvent?: {
        cardId: string;
        power: Power;
        responding: Power;
        step: string;
        remaining: number;
        space?: string;
        targetPower?: Power;
        tracks: string[];
        roadFormation?: {units: Partial<Record<Controller, LandStack>>; leaders: string[]};
    };
    pendingPiracy?: {power: Power; target: Power; zone: SeaZoneID; step: "losses" | "rewards"; remaining: number; rewards: Record<string, number>};
    piracyUsed?: Partial<Record<Power, SeaZoneID[]>>;
    pendingAction?: {power: Power; move: "moveLand" | "moveNaval" | "navalTransport" | "assault" | "piracy"; args: {from?: string; to?: string; space?: string; zone?: string; target?: Power; units?: Partial<LandStack>; leaders?: string[]; unitPower?: Controller; zones?: string[]}};
    resumeAction?: boolean;
    pendingIntercept?: {power: Power; defender: Power; from: string; to: string; phase: "field" | "naval"; attackers: Controller[]; attempted: string[]; succeeded: boolean; transported?: boolean};
    interceptedThisImpulse?: {impulse: number; spaces: string[]};
    pendingBattle?: {
        phase: "field" | "naval" | "assault";
        location: string;
        from: string;
        attacker: Power;
        attackers: Controller[];
        defenders: Controller[];
        defender: Power;
        responding: Power;
        step: "defend" | "attackerCards" | "defenderCards" | "attackerAfterRoll" | "defenderAfterRoll" | "attackerLosses" | "defenderLosses" | "retreat";
        treachery?: boolean;
        intercepted?: boolean;
        transported?: boolean;
        cards: Partial<Record<Power, string[]>>;
        rolls?: {attacker: number[]; defender: number[]};
        hitCounts?: {attacker: number; defender: number};
        losses?: {attacker: number; defender: number};
        loser?: Power;
    };
    /** Scenario selected when the match was created. */
    scenario: ScenarioID;
    /** First official turn of the scenario (1 for Campaign, 3 for Tournament). */
    startTurn: number;
    /** Last official turn of the scenario (7 for Campaign, 6 for Tournament). */
    endTurn: number;
    /** 1-based game turn (the rulebook's seven turns compress 1559-1598). */
    year: number;
    dealtYear: number;
    turnsCompleted: number;
    phaseTurns: number;
    consecutivePasses: number;
    /** Monotonic action-turn counter; kept across winter for siege and informant timing. */
    impulse: number;
    activePower: Power;
    spaces: Record<string, SpaceState>;
    seaZones: Record<SeaZoneID, SeaState>;
    powers: Record<Power, PowerState>;
    leaders: Record<string, LeaderState>;
    deck: string[];
    /** Official cards which enter the deck in later scenario turns. */
    futureDeck: string[];
    discard: string[];
    removed: string[];
    /** Home cards set aside after being played this year. */
    homeSetAside: string[];
    /** England-Spain declaration-of-war cost, reduced by events. */
    doWCostEnglandSpain: number;
    suezAttempts: number;
    suezDone: boolean;
    mercenariesForHire: number;
    /** Betrothals announced during the current Diplomacy Phase. */
    betrothals: { male: string; female: string }[];
    /** Marriage proposal awaiting the target power's response. */
    pendingBetrothal: { male: string; female: string; proposer: Power; target: Power } | null;
    /** Royal marriages resolved this year (used for "Virgin Queen" VP). */
    marriages: number;
    log: string[];
    vpHistory: Record<string, Partial<Record<Power, number>>>;
    hreReligiousPreference?: HreReligiousPreference;
    hreReligiousPreferenceChosen: boolean;
    hreReligiousPreferenceRevealed: boolean;
    /** Catholic League formed (rule 20.10); the check is skipped afterwards. */
    catholicLeagueFormed?: boolean;
    /** Year whose Diplomacy Segment bars deals between Spain and France/Protestant. */
    catholicLeagueNoDealsUntil?: number;
    /** The spaces Spain took when the League formed (Reims first). */
    catholicLeagueSpaces?: string[];
    /** Spain still has to choose the League's two additional French spaces. */
    pendingCatholicLeague?: {remaining: number};
    /** Set at the end of the Action Phase so endIf can score the winter. */
    checkVictory: boolean;
    /** Key counts at setup, so starting positions do not trigger military victory. */
    militaryVictoryBaseline: Record<Power, number>;
    lastAction: string;
    lastRolls: string;
    royals: RoyalDef[];
    /** Patrons available under this scenario's patronage chart. */
    patronsAvailable: string[];
    /** VP award markers still available to claim from the patronage chart. */
    vpAwardsAvailable: string[];
    /** Artists and scientists sponsored this year, resolved in the Winter Phase. */
    pendingPatronage: {power: Power; patronId: string; cp: number}[];
    /** Starting diplomatic influence markers, restored at Winter reset. */
    minorInfluenceDefaults: Record<Power, Partial<Record<MinorPower, number>>>;
    /** Minor powers whose diplomacy has already been resolved this turn. */
    minorDiplomacyResolved: MinorPower[];
    /** Powers permanently barred from influencing a minor after declaring war on it. */
    minorInfluenceBlocked: Record<Power, MinorPower[]>;
    /** Informants on major-power cards; neutralized informants return in winter. */
    informants: {owner: Power; target: Power; neutralized: boolean; plantedImpulse: number}[];
    /** Powers that have used their once-per-turn assassination action. */
    assassinationUsed: Power[];
    /** Sea captains currently on the World Map, with an optional colony aboard. */
    worldCaptains: Record<string, {power: Power; location: string; damaged: boolean; colony: boolean; movedImpulse?: number}>;
    /** Settlements already occupied by a permanent colony. */
    worldColonies: Partial<Record<string, Power>>;
    /** Starting or event-granted world-space control markers. */
    worldControls: Partial<Record<string, Power>>;
    /** Ottoman/Persian and HRE/Polish off-map conflicts. */
    foreignWars: Partial<Record<Power, ForeignWarState>>;
    /** Context gates response and combat cards at their printed timing. */
    cardWindow?: CardWindow;
    /** Sea captains available under this scenario's power cards. */
    seaCaptainsAvailable: string[];
    /** Science bonuses available under this scenario's patronage chart. */
    scienceBonusesAvailable: string[];
    /** Official Protestant Spaces track at setup, and the map count then. */
    protestantSpacesStart: number;
    protestantSpacesMapAtStart: number;
    /** Filled in by playerView: public counts, hidden deck contents. */
    deckCount?: number;
    futureDeckCount?: number;
    discardCount?: number;
    handCounts?: Partial<Record<Power, number>>;
    /** Public count of each power's face-down Home cards (identities hidden). */
    homeCardSetAsideCounts?: Partial<Record<Power, number>>;
    springDone: Power[];
    patronizedThisTurn: string[];
    cardDrawDone: Power[];
}

export interface ForeignWarState {
    power: "ottoman" | "hre";
    cardId: string;
    enemy: "Persia" | "Poland";
    enemyUnits: number;
    /** Major-power units and an optional army leader sent off-map. */
    units: LandStack;
    leaderId?: string;
    winnerVp: boolean;
    status: "setup" | "active";
}

export interface RoyalDef {
    id: string;
    name: string;
    nameZh?: string;
    power: Power;
    gender: "male" | "female";
    /** Family tag: Valois or Hapsburg royals may not intermarry. */
    family?: "valois" | "hapsburg";
    /** Age is not printed in the Scenario Book; it is left undefined. */
    age?: number;
    /** Turn the royal enters the game. */
    turn?: number;
    /** Current eligibility rating (campaign/tournament may lower it). */
    eligibility?: number;
    /** Scenario status: captured/dead/unused royals cannot be betrothed. */
    status?: "captured" | "dead" | "unused" | "available";
    alive: boolean;
    married: boolean;
}

export const ROYALS: RoyalDef[] = [
    {id: "elizabeth", name: "Elizabeth I", power: "england", gender: "female", age: 26, alive: true, married: false},
    {id: "philip", name: "Philip II", power: "spain", gender: "male", family: "hapsburg", age: 32, alive: true, married: false},
    {id: "maryScots", name: "Mary Queen of Scots", power: "france", gender: "female", age: 17, alive: true, married: false},
    {id: "henryIII", name: "Henry III", power: "france", gender: "male", family: "valois", age: 28, alive: true, married: false},
    {id: "rudolf", name: "Rudolf II", power: "hre", gender: "male", family: "hapsburg", age: 17, alive: true, married: false},
];

export type VictoryReason =
    | "military"
    | "protestantReligious"
    | "catholicReligious"
    | "catholicRebellion"
    | "standard"
    | "domination"
    | "timeLimit";

export const VICTORY_TEXT: Record<VictoryReason, string> = {
    military: "军事胜利：控制足够多的关键城市",
    protestantReligious: "新教宗教胜利：新教影响超过半数宗教地区",
    catholicReligious: "天主教宗教胜利：新教影响被压缩到极限",
    catholicRebellion: "天主教叛乱胜利：火药阴谋成功，西班牙获胜",
    standard: "标准胜利：达到 25 分",
    domination: "支配胜利：领先所有对手至少 5 分",
    timeLimit: "时限胜利：第 7 回合结束时分数最高",
};
