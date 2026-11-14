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

/** Physical regular-counter limits (points) for each major power. */
export const OTTOMAN_CAVALRY_LIMIT = 39;

/** Physical naval counters per major power (two-sided galleys/galleons). */
export const NAVAL_LIMITS: Record<Power, number> = {
    ottoman: 9,
    spain: 7,
    england: 6,
    france: 4,
    hre: 1,
    protestant: 4,
};

export const REGULAR_LIMITS: Record<Power, number> = {
    ottoman: 39,
    spain: 42,
    england: 25,
    france: 32,
    hre: 29,
    protestant: 48,
};

/** Per-power mercenary force-pool limits (counter mix). Ottomans cannot recruit mercs. */
export const MERC_LIMITS: Record<Power, number> = {
    ottoman: 0, spain: 15, england: 10, france: 15, hre: 20, protestant: 15,
};

/** Per-power per-ship-type naval force-pool limits (counter mix). */
export const GALLEY_LIMITS: Record<Power, number> = {
    ottoman: 20, spain: 10, england: 0, france: 5, hre: 0, protestant: 0,
};

export const GALLEON_LIMITS: Record<Power, number> = {
    ottoman: 0, spain: 10, england: 10, france: 5, hre: 0, protestant: 5,
};

export const CORSAIR_LIMITS: Record<Power, number> = {
    ottoman: 10, spain: 0, england: 0, france: 0, hre: 0, protestant: 0,
};

/** Minor-power force-pool caps (Rule 24.3 — proxies until printed counters are digitised). */
export const MINOR_REGULAR_LIMITS: Record<string, number> = {
    scotland: 12,
    ireland: 12,
    portugal: 12,
    papacy: 12,
    venice: 12,
};

export const MINOR_NAVAL_LIMITS: Record<string, number> = {
    scotland: 2,
    ireland: 2,
    portugal: 4,
    papacy: 4,
    venice: 6,
};

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

export type VQLocale = "en" | "zh_CN";

/** Picks the active locale's display name from a bilingual data entry. */
export const localizedName = (
    entry: {name: string; nameZh?: string},
    locale: VQLocale = "zh_CN",
): string => locale === "en" ? entry.name : (entry.nameZh ?? entry.name);

export const powerName = (p: Power, locale: VQLocale = "zh_CN"): string => {
    // Panels occasionally receive a stale or unexpected controller during a
    // pending event; echo the raw value instead of crashing the whole board.
    const entry = POWER_NAMES[p];
    if (entry === undefined) return String(p);
    return entry[locale === "en" ? "en" : "zh"];
};

/** Compact power label for dense rows: the English short form, or the Chinese name. */
export const powerShortName = (p: Power, locale: VQLocale = "zh_CN"): string => {
    const entry = POWER_NAMES[p];
    if (entry === undefined) return String(p);
    return locale === "en" ? entry.short : entry.zh;
};

export const minorName = (m: MinorPower | Independent, locale: VQLocale = "zh_CN"): string => {
    const entry = MINOR_NAMES[m];
    if (entry === undefined) return String(m);
    return entry[locale === "en" ? "en" : "zh"];
};

export const controllerName = (c: Controller, locale: VQLocale = "zh_CN"): string =>
    isPower(c) ? powerName(c, locale) : minorName(c as MinorPower | Independent, locale);

export type Religion = "catholic" | "protestant";
export type HreReligiousPreference = Religion | "balanced";
export const HRE_RELIGIOUS_PREFERENCE_NAMES: Record<HreReligiousPreference, { en: string; zh: string }> = {
    catholic: {en: "Catholic", zh: "天主教"},
    protestant: {en: "Protestant", zh: "新教"},
    balanced: {en: "Balanced", zh: "平衡"},
};
export const hreReligiousPreferenceName = (
    pref: HreReligiousPreference,
    locale: VQLocale = "zh_CN",
): string => {
    const entry = HRE_RELIGIOUS_PREFERENCE_NAMES[pref];
    if (entry === undefined) return String(pref);
    return entry[locale === "en" ? "en" : "zh"];
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

export const areaName = (area: ReligionArea, locale: VQLocale = "zh_CN"): string => {
    const entry = AREA_NAMES[area];
    if (entry === undefined) return String(area);
    return entry[locale === "en" ? "en" : "zh"];
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

/**
 * A winter attrition loss whose unit type has not been confirmed by the owner
 * yet. The automatic losses have already been applied; choosing another unit
 * type restores the automatically removed units to `space` and takes the
 * chosen type instead. If the choice is skipped the automatic result stands.
 * The Morisco regulars removed by the Winter Phase are recorded as a
 * confirmation-only choice, because they leave play with card #28 and cannot
 * be exchanged for other unit types in the surviving stack.
 */
export interface WinterLossChoice {
    power: Power;
    /** Space holding the surviving stack the losses came from. */
    space: string;
    /** Number of units lost to winter attrition. */
    amount: number;
    /** Unit types removed by the automatic mercenary/cavalry/regular rule. */
    removed: LandStack;
    /**
     * The removal is already final: the owner may only confirm it with
     * `kind: "auto"`. Used for the Morisco regulars removed at Winter, which
     * cannot be swapped for mercenaries or cavalry even when the stack at
     * `space` has survivors of those types.
     */
    confirmOnly?: boolean;
}

/**
 * A winter naval loss whose ship-type composition has not been confirmed by
 * the owner yet. Rule 20.4 eliminates a squadron that has no port to return
 * to, so the automatic result is already applied in full; the Card Draw
 * choice only records which ship types the owner declares lost (and keeps the
 * automatic order when skipped). A no-port squadron is never partially saved.
 */
export interface WinterNavalLossChoice {
    power: Power;
    /** Sea zone the eliminated squadron started the Winter Phase in. */
    zone: string;
    /** Number of ships eliminated by the automatic no-port rule. */
    amount: number;
    /** Ship types removed by the automatic elimination. */
    removed: NavalStack;
}

/**
 * #18 City State Rebels: the target fortress controller allocates each hit to
 * one of its land or naval units. The dice are already rolled and `remaining`
 * counts the hits still to allocate; the automatic
 * mercenary/regular/cavalry then corsair/galley/galleon/race-built order is
 * used for any hit the controller leaves to the auto fallback.
 */
export interface CityRebelsLossChoice {
    /** Power that played the event; captures army leaders when the target empties. */
    power: Power;
    /** Controller of the target fortress and choosing the losses. */
    controller: Controller;
    /** Fortress whose garrison is taking the losses. */
    space: string;
    /** Hits still to allocate, at most the five dice rolled. */
    remaining: number;
    /** The five dice, kept for the final log line. */
    values: number[];
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
    /** Chinese display name; falls back to `name` when absent. */
    nameZh?: string;
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
    /**
     * Space id, sea zone id, "pool" (power card / Turn Track, enters once
     * `returnTurn` is reached), "offMap" (out of play until a specific rule
     * brings him in) or "captured".
     */
    location: string;
    capturedBy?: Power;
    returnTurn?: number;
    /** Naval leader temporarily loaned to an ally (rule 9.2). */
    loanedTo?: Power;
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
        // Printed Ottoman power card, keys 0-9 (Auto Win at 10).
        vpByKeys: [0, 1, 3, 5, 7, 9, 11, 13, 15, 17],
        // Printed Ottoman power card: the Auto Win box is the tenth key.
        autoWinKeys: 10,
        homeCards: ["vq-001", "vq-002"],
    },
    spain: {
        power: "spain",
        ruler: {id: "philipII", name: "Philip II", admin: 1, cardBonus: 0},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        // Printed Spanish power card, keys 0-13 (Auto Win at 14).
        vpByKeys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        // Printed Spanish power card: the Auto Win box is the fourteenth key.
        autoWinKeys: 14,
        homeCards: ["vq-003", "vq-099"],
    },
    england: {
        power: "england",
        ruler: {id: "elizabethI", name: "Elizabeth I", admin: 2, cardBonus: 1},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        // Printed English power card, keys 0-6 (Auto Win at 7).
        vpByKeys: [0, 0, 2, 4, 6, 8, 10],
        // Printed English power card: the Auto Win box is the seventh key.
        autoWinKeys: 7,
        homeCards: ["vq-036", "vq-081"],
    },
    france: {
        power: "france",
        ruler: {id: "henryIII", name: "Henry III", admin: 1, cardBonus: 0},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        // Printed French power card, keys 0-9 (Auto Win at 10).
        vpByKeys: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        // Printed French power card: the Auto Win box is the tenth key.
        autoWinKeys: 10,
        homeCards: ["vq-033", "vq-080"],
    },
    hre: {
        power: "hre",
        ruler: {id: "ferdinandI", name: "Ferdinand I", admin: 2, cardBonus: 0},
        drawByKeys: [3, 3, 4, 4, 5, 5, 6, 6, 7],
        // Printed Holy Roman power card, keys 0-7 (Auto Win at 8).
        vpByKeys: [0, 2, 4, 6, 8, 10, 12, 14],
        // Printed Holy Roman power card: the Auto Win box is the eighth key.
        autoWinKeys: 8,
        homeCards: ["vq-034", "vq-035"],
    },
    protestant: {
        power: "protestant",
        ruler: {id: "reformedChurches", name: "Council of the Reformed Churches", admin: 2, cardBonus: 0},
        drawByKeys: [4, 4, 5, 5, 6, 6, 7, 7, 7],
        // The Protestant power card uses 3 VP per Dutch key and 2 VP per key
        // outside the Netherlands; baseVp handles that rule directly.
        vpByKeys: [0, 2, 4, 6, 8, 10],
        // Printed Protestant power card: five keys outside the Netherlands.
        autoWinKeys: 5,
        homeCards: ["vq-032", "vq-111"],
    },
};

/** Display names for the ruler ids stored on each power state. */
export const RULER_NAMES: Record<string, { en: string; zh: string }> = {
    suleiman: {en: "Suleiman the Magnificent", zh: "苏莱曼一世"},
    selimII: {en: "Selim II", zh: "塞利姆二世"},
    muradIII: {en: "Murad III", zh: "穆拉德三世"},
    philipII: {en: "Philip II", zh: "腓力二世"},
    elizabethI: {en: "Elizabeth I", zh: "伊丽莎白一世"},
    henryIII: {en: "Henry III", zh: "亨利三世"},
    ferdinandI: {en: "Ferdinand I", zh: "斐迪南一世"},
    reformedChurches: {en: "Council of the Reformed Churches", zh: "改革派教会会议"},
};
export const rulerName = (id: string, locale: VQLocale = "zh_CN"): string => {
    const entry = RULER_NAMES[id];
    if (entry === undefined) return id;
    return locale === "en" ? entry.en : entry.zh;
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
    /** Chinese display name; falls back to `name` when absent. */
    nameZh?: string;
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
    /** Chinese display name; falls back to `name` when absent. */
    nameZh?: string;
    /** Geographic coordinates used to place the space on the schematic map. */
    lon: number;
    lat: number;
    /** Historical home power of the space. */
    home: Controller;
    /**
     * All home powers for split-home spaces (Rule 2.5).  `home` remains the
     * initial (bottom) home for back-compat reads; `homes` is authoritative
     * for construction, return, LOC and #18 eligibility.
     */
    homes?: Controller[];
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

/** All home powers for a space (split-home aware). */
export const spaceHomes = (def: SpaceDef): Controller[] => def.homes ?? [def.home];

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
    /** English effect text for official cards whose `text` is the Chinese OCR. */
    textEn?: string;
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

export interface SiegeState {
    /** Legacy single-besieger field; kept for back-compat reads. New writes populate `besiegers`. */
    by: Power;
    /** All allied besiegers (Rules: two allied powers may besiege at once). */
    besiegers?: Power[];
    /** Controllers whose stacks are physically inside the fortification. When absent, derived from control/allies. */
    inside?: Controller[];
    /** Impulse number in which the siege began. */
    sinceImpulse: number;
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
    siege?: SiegeState;
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
    actionsThisImpulse?: string[];
    cardActionCount?: number;
    /** Accumulated bonus VP (patronage, piracy, marriages, events). */
    bonusVp: number;
    /** Persistent -1/+1 card markers (foreign wars, Suez, etc.). */
    cardModifier: number;
    /** Temporary marriage +1/-1 card markers, removed after the next Card Draw. */
    marriageCardModifier?: number;
    /**
     * #36 "Jilted by Elizabeth" compensation CP.  Rule 23.3 restricts the
     * grant to Diplomatic Influence and/or mercenary recruitment, so it is
     * kept out of the general `cp` pool and consumed first by those actions.
     */
    jiltedCp?: number;
    rulerAdmin?: number;
    rulerCardBonus?: number;
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

/** A setup log line that can be translated when the log is rendered. */
export interface SetupLogCode {
    /** Index in `VQGame.log`. */
    at: number;
    key: "scenario" | "vpStart" | "protestantSpaces" | "spacesPlaced" | "scenarioNote" | "unknownPatrons";
    params: Record<string, string | number>;
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
    dragutFought?: boolean;
    pendingAbjuration?: {offers: {power: Power; space: string}[]};
    lockedCards?: Partial<Record<Power, string[]>>;
    elizabethExcommunicated?: boolean;
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
        responding: Power;
        responseCard?: string;
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
    pendingTribute?: {target: Power; choices: string[]};
    pendingMutiny?: {space: string; owner: Power};
    pendingPolishElection?: {bids: Partial<Record<Power, string>>; remaining: Power[]};
    pendingPiracy?: {power: Power; target: Power; zone: SeaZoneID; step: "losses" | "rewards"; remaining: number; rewards: Record<string, number>};
    piracyUsed?: Partial<Record<Power, SeaZoneID[]>>;
    pendingAction?: {power: Power; responder?: Power; /** Every eligible responder; `responder` is the first. */ responders?: Power[]; move: "moveLand" | "moveNaval" | "navalTransport" | "assault" | "piracy" | "impulse"; args: {from?: string; to?: string; fleets?: {from: string; to: string}[]; space?: string; zone?: string; target?: Power; units?: Partial<LandStack>; leaders?: string[]; unitPower?: Controller; zones?: string[]}};
    resumeAction?: boolean;
    pendingNavalOrder?: {attacker: Power; location: string; enemies: Power[]};
    /** All fleets have moved simultaneously; resolve each destination before another action. */
    pendingNavalMoves?: {power: Power; arrivals: {from: string; to: string; destinationHadEnemy: boolean}[]};
    pendingWithdraw?: {active: Power; /** Owner of the incoming stack; may be an ally of `active`. */ unitPower?: Controller; defender: Power; space: string; origin: string};
    pendingReliefSplit?: {space: string; from: string; power: Power; keepLimit: number; pUnits: number};
    /** `unitPower` owns the moving stack; it may be an ally of `power` (rule 13.4 + 9.1). */
    pendingContinue?: {power: Power; unitPower?: Controller; origin: string; space: string; units: LandStack; leaders: string[]};
    pendingIntercept?: {power: Power; defender: Power; from: string; to: string; phase: "field" | "naval"; attackers: Controller[]; attempted: string[]; succeeded: boolean; transported?: boolean};
    /** #14 response window: a home-port interception attempt waits for the defender before its roll. */
    pendingBeacon?: {power: Power; defender: Power; from: string; moveFrom: string; to: string; destinationHadEnemy: boolean};
    /**
     * Rule 13.2 order choice: the intercepting power announces which of its
     * adjacent stacks attempts next.  Only opened when that power has more
     * than one eligible stack; impulse order still decides between powers.
     */
    pendingInterceptionOrder?: {power: Power; defender: Power; moveFrom: string; to: string; destinationHadEnemy: boolean};
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
    betrothals: { male: string; female: string; louiseAttached?: boolean }[];
    /** Marriage proposal awaiting the target power's response. */
    pendingBetrothal: { male: string; female: string; proposer: Power; target: Power; louiseAttached?: boolean } | null;
    /**
     * #95 Louise of Lorraine was played this Diplomacy Phase.  She is attached
     * to the playing power, which is also her royal power for the wedding roll.
     * `available` becomes false once an attached marriage is agreed; the whole
     * marker is cleared when the Diplomacy Phase (or winter) ends.
     */
    louiseAttachment?: { power: Power; available: boolean };
    /** Royal marriages resolved this year (used for "Virgin Queen" VP). */
    marriages: number;
    /** Virgin Queen bonus VP already awarded (maximum 5 per game). */
    virginQueenVpAwarded?: number;
    log: string[];
    /**
     * Turn/phase markers pointing into {@link log}.  Recorded when a phase
     * begins so the log panel can group entries without changing the plain
     * string log that the moves and tests consume.
     */
    logMarks?: {at: number; turn: number; phase: string; year?: number}[];
    /**
     * Localizable setup messages, keyed by their index in {@link log}.  The
     * board translates these when it renders the log so an English client sees
     * English setup notes even when the match was created by a server running
     * the default locale.
     */
    logI18n?: SetupLogCode[];
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
    /** HRE winter replacement choice (20.6), made during the next Diplomacy Phase. */
    pendingHreReplacement?: {canRegular: boolean; canMercs: boolean; canMarker: boolean};
    /** Morisco Revolt unit (rule 20.1 / card #28), if in play. */
    morisco?: {space: string; units: number};
    peaceMadeThisPhase?: [Power, Power][];
    /** Per-phase diplomacy gift counts. Key is "giver->receiver". */
    diplomacyGifts?: Record<string, {cards: number; treasures: number; mercenaries: number}>;
    lostBattleImpulse?: {impulse: number; owners: Controller[]};
    rebellionAreasThisImpulse?: {impulse: number; areas: string[]};
    /** Most recent fortress capture; gates Sack! (#44) and Spanish Fury (#46). */
    lastCapture?: {space: string; attacker: Power; impulse: number};
    spanishTreasureRow?: number[];
    /** Impulse in which a naval transport was already made (16.3). */
    navalTransportImpulse?: number;
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
    worldCaptains: Record<string, {power: Power; location: string; damaged: boolean; colony: boolean; movedImpulse?: number; route?: string[]; navigationBonus?: number; navigationPenalty?: number; companion?: string; treasureValues?: number[]}>;
    /** Settlements already occupied by a permanent colony. */
    worldColonies: Partial<Record<string, Power>>;
    /** Colony Table results from the current Card Draw (rule 8.4). */
    colonyRolls?: {settlement: string; power: Power; total: number; result: "eliminated" | "none" | "treasure" | "treasureVp"}[];
    /** Starting or event-granted world-space control markers. */
    worldControls: Partial<Record<string, Power>>;
    /** Spanish patrols by ocean zone. */
    worldPatrols?: Partial<Record<string, number>>;
    /** World Map fortresses by settlement. */
    worldFortresses?: Partial<Record<string, Power>>;
    /** Piracy actions and targeted zones this turn. */
    piracyActions?: Partial<Record<Power, number>>;
    piracyZones?: Partial<Record<string, Power[]>>;
    worldFortressesBuilt?: number;
    /** Spanish Armada: strength 2/4/6/8 and current port or sea zone. */
    armada?: {strength: 2 | 4 | 6 | 8; location: string; land?: LandStack};
    /** Armada Turn Track return year after elimination. */
    armadaReturn?: number;
    /** Spain has conquered the Philippines and uses the fifth treasure box. */
    philippinesSpanish?: boolean;
    pragueCulturalCenter?: string;
    hreCapital?: string;
    protestantCapital?: string;
    unionOfArras?: boolean;
    dutchSpanishHome?: boolean;
    gregorianNext?: Power;
    /** #101 response window opened after the named power finished its turn. */
    gregorianResponse?: {after: Power; responder: Power};
    hawkinsBonus?: boolean;
    patronReturn?: Record<string, number>;
    pendingCardDraws?: {power: Power; turn: number; amount: number}[];
    skipImpulse?: Power[];
    /** Action-phase impulses each power has taken this turn (year). */
    actionTurnsThisTurn?: Partial<Record<Power, number>>;
    stormImpulse?: number;
    stormMoved?: string[];
    haremImpulse?: number;
    /**
     * Impulse in which each power declined its #16 impulse-start window.  The
     * card is offered at most once per holder per Ottoman impulse, so only a
     * holder that actually declined is suppressed for the rest of that
     * impulse; a card transferred to another power can still be offered to the
     * new holder.
     */
    haremDeclinedImpulse?: Partial<Record<Power, number>>;
    dragutFought?: boolean;
    pendingAbjuration?: {offers: {power: Power; space: string}[]};
    lockedCards?: Partial<Record<Power, string[]>>;
    elizabethExcommunicated?: boolean;
    cyprusTarget?: string;
    cyprusAwarded?: boolean;
    /** Naval counters lost this year; they return to the pool at Spring. */
    navalLost?: Partial<Record<Power, NavalStack>>;
    /**
     * Naval leaders returning from the pool whose home port has not been
     * chosen yet. The leader stays in the pool until the owning player picks
     * one of `ports` during Spring Deployment; if the turn is ended first, the
     * first still-legal port is used automatically.
     */
    navalLeaderArrivals?: {leader: string; power: Power; ports: string[]}[];
    /**
     * Tournament scenario: William of Orange has arrived on the Turn Track but
     * the Protestant player has not yet chosen whether to place him in the
     * capital (La Rochelle) or hold him in the pool so he can lead a rebellion.
     * Rule: Scenario Book p. 9 "Leaders Held Off-Map" footnote.
     */
    orangeArrivalPending?: boolean;
    /**
     * #18 City State Rebels losses awaiting the target controller's allocation.
     * Each hit is assigned to one land or naval unit by `chooseCityRebelsLoss`;
     * the automatic order resolves any hits left to the fallback. Because the
     * choice is only opened while more units than hits remain, it can never
     * change whether the fortress is emptied, only which units are removed.
     */
    pendingCityRebels?: CityRebelsLossChoice;
    /**
     * After Irish Rebellion places rebels in Ulster, the allied power may
     * move them one space as per section 24.2 step 6.
     */
    pendingRebelMove?: {power: Power; space: string; minor: MinorPower};
    /**
     * Winter attrition losses awaiting the owner's choice of unit type. The
     * automatic result is already on the board; the Card Draw choice stage may
     * swap it, and ending the turn keeps the automatic composition. A stack
     * eliminated outright for want of winter quarters is recorded too, so its
     * owner can confirm the removed composition.
     */
    winterLossChoices?: WinterLossChoice[];
    /**
     * Winter naval losses awaiting the owner's confirmation. Rule 20.4
     * eliminates the whole squadron when no port can receive it; the automatic
     * elimination is already on the board, and the Card Draw choice stage lets
     * the owner record the lost ship types or keep the automatic composition.
     */
    winterNavalLossChoices?: WinterNavalLossChoice[];
    spanishRoadAvailable?: boolean;
    /** Beacon Fires: next interception by this power succeeds and gains +2 dice. */
    navalDiceBonus?: {power: Power; amount: number};
    /** Naval units loaned to an ally for one turn (rule 9.2). */
    loanedNaval?: {lender: Power; borrower: Power; kind: "galley" | "galleon" | "racebuilt"; fromPort: string; toPort: string; leader?: string}[];
    /** Portugal has entered play and its three-treasure row. */
    portugalEntered?: boolean;
    portugueseTreasures?: number[];
    /** Galleons assigned to the Treasure Fleet escorts box. */
    treasureFleetEscorts?: number;
    /** Number of completed circumnavigations (first 2 VP, later 1 VP). */
    circumnavigations?: number;
    /** +2 Wedding Festivities marker placed on a French marriage. */
    marriageFestivities?: Power;
    /** Year in which Protestant rebellions in France are blocked by #33. */
    protestantRebellionBlockedTurn?: number;
    /** Sea captains on the Turn Track, returning to the pool in a future year. */
    seaCaptainReturn?: Record<string, {power: Power; turn: number}>;
    /** Ottoman/Persian and HRE/Polish off-map conflicts. */
    foreignWars: Partial<Record<Power, ForeignWarState>>;
    /**
     * A Foreign War card has just been played and the affected power still has
     * to choose its 3-8 land units.  The affected power acts even when another
     * power played the event, so this is a separate interaction window.
     */
    pendingForeignWar?: {power: "ottoman" | "hre"};
    /** Context gates response and combat cards at their printed timing. */
    cardWindow?: CardWindow;
    /** Sea captains available under this scenario's power cards. */
    seaCaptainsAvailable: string[];
    /** Science bonuses available under this scenario's patronage chart. */
    scienceBonusesAvailable: string[];
    /** Official Protestant Spaces track at setup, and the map count then. */
    protestantSpacesStart: number;
    protestantSpacesMapAtStart: number;
    /**
     * Protestant spaces that the printed track counts but the reduced map does
     * not draw, split by religious struggle area.  `Initial` is the printed
     * surplus at setup; `Converted` records how many of those spaces Catholic
     * conversions have removed.
     */
    protestantOffMapInitial?: Record<ReligionArea, number>;
    protestantOffMapConverted?: Record<ReligionArea, number>;
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
    status?: "captured" | "dead" | "unused" | "available" | "aged";
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

export const VICTORY_TEXT: Record<VictoryReason, { en: string; zh: string }> = {
    military: {en: "Military victory: control enough key cities", zh: "军事胜利：控制足够多的关键城市"},
    protestantReligious: {en: "Protestant religious victory: Protestant influence over 50 spaces", zh: "新教宗教胜利：新教影响超过 50 个地区"},
    catholicReligious: {en: "Catholic religious victory: Protestant spaces reduced to 9 or fewer", zh: "天主教宗教胜利：新教地区降至 9 个或以下"},
    catholicRebellion: {en: "Catholic rebellion victory: the Gunpowder Plot succeeds and Spain wins", zh: "天主教叛乱胜利：火药阴谋成功，西班牙获胜"},
    standard: {en: "Standard victory: reach 25 VP", zh: "标准胜利：达到 25 分"},
    domination: {en: "Domination victory: from Turn 4, under 25 VP and at least 5 VP ahead of every opponent", zh: "支配胜利：第 4 回合起，VP 低于 25 且领先所有对手至少 5 分"},
    timeLimit: {en: "Time-limit victory: highest score at the end of turn 7", zh: "时限胜利：第 7 回合结束时分数最高"},
};
export const victoryText = (reason: VictoryReason, locale: VQLocale = "zh_CN"): string => {
    const entry = VICTORY_TEXT[reason];
    return locale === "en" ? entry.en : entry.zh;
};
export const royalName = (royal: RoyalDef, locale: VQLocale = "zh_CN"): string =>
    locale === "en" ? royal.name : (royal.nameZh ?? royal.name);
