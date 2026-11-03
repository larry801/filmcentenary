import {
    Controller,
    LandStack,
    NavalStack,
    Power,
    Religion,
    ReligionArea,
} from "../constant/general";

/**
 * Round 1 data model: official scenario/setup data kept separate from the
 * runtime rules in ../constant and ../util.  Nothing in this folder is wired
 * into setupGame yet; round 2 will consume it.
 */

export type ScenarioID = "campaign" | "tournament";

export type ControlMarker = "scm" | "hcm";

export interface ScenarioSpaceSetup {
    /** Political control marker on the space. */
    control?: Controller;
    /** Square (key) or hex (non-key) control marker. */
    controlMarker?: ControlMarker;
    religion?: Religion;
    /** Land units by owner. Keys may be major, minor or independent. */
    units?: Partial<Record<Controller, Partial<LandStack>>>;
    /** Naval units in the port by owner. */
    naval?: Partial<Record<Controller, Partial<NavalStack>>>;
    leaders?: string[];
    unrest?: boolean;
    fortress?: boolean;
    /** Free-form note from the scenario book (Walloon, Morisco, etc.). */
    notes?: string;
}

export interface PowerCardSetup {
    /** Square control markers printed/placed on the power card. */
    scmOnCard?: number;
    suezAttempts?: number;
    mercenariesForHire?: number;
    treasures?: number;
    worldMapFortresses?: number;
    jesuits?: number;
    treasureFleetEscorts?: number;
    seaCaptains?: string[];
    sharedSeaCaptains?: string[];
    leadersOffMap?: string[];
    bonusVpNotes?: string[];
    ruler?: string;
    /** Valois marriage the French player must arrange, if any. */
    valoisMarriage?: string;
    outOfGame?: string[];
    /** Protestant only: the Dutch and Huguenot power cards. */
    components?: {
        dutch: PowerCardSetup;
        huguenot: PowerCardSetup;
    };
}

export interface RoyalSetup {
    id: string;
    nameEn: string;
    nameZh?: string;
    /** Home country, or "any" for royals such as Louise of Lorraine. */
    country: Power | "any";
    /** Turn the royal enters the game. */
    turn: number;
    eligibility: number;
    bonus?: string;
    status?: "captured" | "dead" | "unused" | "available";
    notes?: string;
}

export interface PatronageSetup {
    artists: string[];
    scientists: string[];
    vpMarkers: number;
    artistVpMarkers: number;
    scientistVpMarkers: number;
    scienceBonuses: string[];
    /** Scenario-specific patronage awards that are not available. */
    unavailableVpAwards?: string[];
}

export interface ScenarioSetup {
    id: ScenarioID;
    nameZh: string;
    nameEn: string;
    startTurn: number;
    endTurn: number;
    startYear: number;
    endYear: number;
    vpStart: Record<Power, number>;
    protestantSpaces: number;
    /** Undirected war pairs. */
    wars: [Power, Power][];
    /** Undirected major/minor alliances. */
    alliances: [Power, "ireland" | "papacy" | "portugal" | "scotland" | "venice"][];
    influence: Partial<Record<Power, Partial<Record<"ireland" | "papacy" | "portugal" | "scotland" | "venice", number>>>>;
    spaces: Record<string, ScenarioSpaceSetup>;
    /** Off-map world-map markers (Florida, Philippines, ...). */
    worldSpaces?: Record<string, ScenarioSpaceSetup>;
    powerCard: Record<Power, PowerCardSetup>;
    royals: RoyalSetup[];
    royalStatus?: Record<string, RoyalSetup["status"]>;
    patronage: PatronageSetup;
    cardsInPlay: number[];
    cardsRemoved: number[];
    cardsOnBoard: number[];
    /** Official setup order, before the Action Phase. */
    phaseOrder: ScenarioPhase[];
    notes?: string[];
}

export type ScenarioPhase = "cardDraw" | "diplomacy" | "spring" | "action";

export interface OfficialLeader {
    id: string;
    nameEn: string;
    nameZh?: string;
    power: Power;
    kind: "army" | "naval" | "both";
    /** Turn from the Leader Entry Table, when the leader enters later. */
    entryTurn?: number;
    source: "scenario-book" | "leader-entry-table";
    notes?: string;
}

export interface Patron {
    id: string;
    nameEn: string;
    nameZh?: string;
    kind: "artist" | "scientist";
    /** Home power or "italy" for the shared Italian pool. */
    region: Power | "italy";
    /** Printed VP value, when known. The scenario book only gives totals. */
    vp: number | null;
}

export interface SeaCaptain {
    id: string;
    nameEn: string;
    nameZh?: string;
    turn: number;
    power: Power | "france/protestant";
    bonus: string;
    notes?: string;
}

export interface ScienceBonus {
    id: string;
    nameEn: string;
    nameZh: string;
    description: string;
    eligible: Power[] | "any" | "any-except-spain";
}

export interface WorldSettlement {
    id: string;
    nameEn: string;
    nameZh: string;
    region: string;
    kind: "settlement" | "colony" | "fortress";
    /** Initial owner, if the scenario places a marker there. */
    home?: Controller;
    notes?: string;
}

export interface WorldSeaZone {
    id: string;
    nameEn: string;
    nameZh: string;
    adjacent: string[];
}

/** Structured card effects. Anything not safely structured is "manual". */
export type CardEffect =
    | {kind: "manual"; handler: string; summary?: string}
    | {
          kind: "conversion";
          side: Religion;
          areas: ReligionArea[];
          dice: number;
          autoSix?: boolean;
          chooseArea?: boolean;
          fivesAsSix?: boolean;
          threesAsFour?: boolean;
          unrestOnOnes?: boolean;
      }
    | {kind: "units"; unit: keyof LandStack; count: number; placement?: string}
    | {kind: "draw"; count: number; when?: "now" | "nextTurn"}
    | {kind: "treasure"; count: number; recurring?: boolean}
    | {kind: "vp"; power?: Power; amount: number; condition?: string}
    | {kind: "unrest"; areas?: ReligionArea[]; count: number}
    | {
          kind: "combat";
          dice: number;
          altDice?: number;
          hitOn?: number;
          phase?: "field" | "naval" | "assault" | "assassination" | "any";
          condition?: string;
          autoIntercept?: boolean;
      };

export interface OfficialCardDef {
    /** Official card number 1..112, derived from the PDF reading order. */
    number: number;
    /** Stable data id, e.g. vq-001. */
    id: string;
    nameZh: string;
    nameEn: string;
    /** Command points, from the card table in 中文規則.pdf. */
    cp: number | null;
    cpSource: "pdf-text-layer" | "missing";
    /**
     * First turn the card may enter the deck (the "輪" column in 中文規則.pdf).
     * "variable" is printed as 變動 and depends on an event.
     */
    availableFromTurn: number | "variable" | null;
    turnSource: "pdf-text-layer" | "missing";
    kind: "event" | "response" | "combat" | "mandatory" | "home";
    power?: Power;
    timing: string | null;
    textZh: string;
    removeOnEvent: boolean;
    removeAfterUse: boolean;
    removeCondition?: string;
    effect: CardEffect;
    source: "中文卡表.pdf";
    notes?: string;
}

export interface CardCpCoverage {
    total: number;
    known: number;
    missing: number;
    missingNumbers: number[];
}
