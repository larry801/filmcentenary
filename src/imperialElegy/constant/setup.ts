import {Power, PowerState, SpaceId, UnitKind} from "../types";

export interface SetupUnit {
  owner: string;
  kind: UnitKind;
  space: SpaceId | null;
  /** null = reserve armies holding box. */
  steps: 1 | 2;
  special?: "indian" | "arab";
}

export interface SetupFort {
  space: SpaceId;
  power: Power;
  level: 1 | 2 | 3;
}

export interface CampaignSetup {
  turn: number;
  wtt: number;
  powers: Record<Power, {
    stability: number;
    manpower: number;
    secondaryManpower?: number;
    industry: number;
    territorialKeys: number;
    colonialKeys: number;
    arabKeys?: number;
    reserves: number;
  }>;
  units: SetupUnit[];
  forts: SetupFort[];
  diplomacy: {power: Power; space: SpaceId}[];
  influence: {power: Power; space: SpaceId}[];
  pacification: {space: SpaceId; value: number}[];
  controlOverrides: {space: SpaceId; control: string | null}[];
  powerProjection: Record<Power, number>;
  removedCards: string[];
  notes: string[];
}

/**
 * Campaign setup, transcribed from IE_playbook.pdf pages 3-4 (Scenario 1 -
 * Campaign and Tutorial).  `setup.test.ts` asserts every quantity here against
 * the playbook and cross-checks the module's saved game.
 */
export const CAMPAIGN_SETUP: CampaignSetup = {
  turn: 1,
  wtt: 0,
  powers: {
    GE: {stability: 3, manpower: 2, industry: 1, territorialKeys: 5, colonialKeys: 0, reserves: 1},
    UK: {stability: 3, manpower: 3, secondaryManpower: 1, industry: 2, territorialKeys: 5, colonialKeys: 7, reserves: 0},
    FR: {stability: 3, manpower: 4, industry: 1, territorialKeys: 9, colonialKeys: 0, reserves: 0},
    AU: {stability: 3, manpower: 4, industry: 1, territorialKeys: 9, colonialKeys: 0, reserves: 0},
    RU: {stability: 3, manpower: 5, industry: 0, territorialKeys: 12, colonialKeys: 0, reserves: 1},
    OT: {stability: 3, manpower: 3, secondaryManpower: 1, industry: 0, territorialKeys: 8, colonialKeys: 0, arabKeys: 5, reserves: 0},
  },
  units: [
    // Germany
    {owner: "GE", kind: "army", space: "berlin", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "berlin", steps: 1},
    {owner: "GE", kind: "army", space: "prussia", steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    // United Kingdom
    {owner: "UK", kind: "army", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "scotland", steps: 2},
    {owner: "UK", kind: "squadron", space: "malta", steps: 2},
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    {owner: "UK", kind: "expeditionary", space: "south-africa", steps: 1},
    // France
    {owner: "FR", kind: "army", space: "paris", steps: 2},
    {owner: "FR", kind: "eliteCorps", space: "paris", steps: 1},
    {owner: "FR", kind: "army", space: "alsace-lorraine", steps: 2},
    {owner: "FR", kind: "army", space: "champagne", steps: 2},
    {owner: "FR", kind: "army", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "brittany", steps: 2},
    {owner: "FR", kind: "zouave", space: "algeria", steps: 1},
    // Austria-Hungary
    {owner: "AU", kind: "army", space: "vienna", steps: 2},
    {owner: "AU", kind: "army", space: "lombardy", steps: 2},
    {owner: "AU", kind: "army", space: "hungary", steps: 2},
    {owner: "AU", kind: "army", space: "bohemia", steps: 2},
    // Russia
    {owner: "RU", kind: "army", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "squadron", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "army", space: "riga", steps: 2},
    {owner: "RU", kind: "army", space: "west-ukraine", steps: 1},
    {owner: "RU", kind: "army", space: "bessarabia", steps: 2},
    {owner: "RU", kind: "army", space: "georgia", steps: 1},
    {owner: "RU", kind: "squadron", space: "sevastopol", steps: 2},
    {owner: "RU", kind: "expeditionary", space: "dagestan", steps: 1},
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    // Ottoman
    {owner: "OT", kind: "army", space: "istanbul", steps: 2},
    {owner: "OT", kind: "army", space: "macedonia", steps: 2},
    {owner: "OT", kind: "army", space: "erzurum", steps: 1},
    {owner: "OT", kind: "army", space: "syria", steps: 1, special: "arab"},
    // Minor powers
    {owner: "Belgium", kind: "minorArmy", space: "belgium", steps: 2},
    {owner: "Netherlands", kind: "minorArmy", space: "netherlands", steps: 2},
    {owner: "Hanover", kind: "minorArmy", space: "hanover", steps: 1},
    {owner: "Saxony", kind: "minorArmy", space: "saxony", steps: 1},
    {owner: "Bavaria", kind: "minorArmy", space: "bavaria", steps: 2},
    {owner: "Denmark", kind: "minorArmy", space: "schleswig-holstein", steps: 2},
    {owner: "Denmark", kind: "squadron", space: "denmark", steps: 1},
    {owner: "Sardinia-Piedmont", kind: "minorArmy", space: "piedmont", steps: 2},
    {owner: "Two Sicilies", kind: "minorArmy", space: "naples", steps: 1},
    {owner: "Greece", kind: "minorArmy", space: "greece", steps: 1},
    {owner: "Persia", kind: "minorArmy", space: "qajar-persia", steps: 2},
    {owner: "Egypt", kind: "minorArmy", space: "egypt", steps: 2},
    {owner: "REBEL:Ethiopia", kind: "rebelArmy", space: "ethiopia", steps: 2},
  ],
  forts: [
    {space: "champagne", power: "FR", level: 1},
    {space: "lombardy", power: "AU", level: 1},
    {space: "st-petersburg", power: "RU", level: 1},
    {space: "sevastopol", power: "RU", level: 1},
  ],
  diplomacy: [
    {power: "UK", space: "belgium"},
    {power: "FR", space: "piedmont"},
    {power: "RU", space: "romania"},
  ],
  influence: [{power: "FR", space: "west-africa"}],
  pacification: [
    {space: "algeria", value: 0},
    {space: "dagestan", value: 1},
  ],
  controlOverrides: [
    {space: "egypt", control: "Egypt"},
    {space: "sinai", control: "Egypt"},
    {space: "great-sand-sea", control: "Egypt"},
  ],
  powerProjection: {GE: 0, UK: 8, FR: 3, AU: 0, RU: 3, OT: 0},
  removedCards: [],
  notes: [
    "Campaign length: 7 turns (1850s-1910s).",
    "All players start in the neutral box of the Alliance Track.",
    "AU: Metternich's Legacy triggers at the end of the turn 1 diplomacy phase.",
    "UK India Stability marker starts on its stable side.",
    "FR starts as the Second Empire with 0 City of Light points.",
    "OT: 3 Turkish manpower / 1 Arab manpower; British manpower 3 / colonial manpower 1.",
    "Minor powers in the End Phase Build Box at the start: Tuscany, Serbia, Bosnia, Bulgaria, Romania.",
  ],
};

/** Minor powers with an army in the End Phase Build Box at campaign start. */
export const START_BUILD_BOX = ["Tuscany", "Serbia", "Bosnia", "Bulgaria", "Romania"];

/** Minor powers that start with an army counter available in the box. */
export const MINOR_POWER_HOMES: Record<string, SpaceId> = {
  Belgium: "belgium",
  Netherlands: "netherlands",
  Hanover: "hanover",
  Saxony: "saxony",
  Bavaria: "bavaria",
  Denmark: "denmark",
  "Sardinia-Piedmont": "piedmont",
  "Two Sicilies": "naples",
  Tuscany: "tuscany",
  // The fourth Italian minor power (12.5.3).  It owns Rome, which is also
  // Italy's capital for the 30.2 surrender rule.  It has no units in the
  // campaign setup and is not in the End Phase Build Box (20.3).
  "Papal States": "rome",
  Greece: "greece",
  Romania: "romania",
  Serbia: "serbia",
  Bosnia: "bosnia-herzegovina",
  Bulgaria: "bulgaria",
  Ethiopia: "ethiopia",
  Persia: "qajar-persia",
  Egypt: "egypt",
  Morocco: "morocco",
  Korea: "korea",
  Japan: "japan",
  "Qing China": "shanghai",
  "United States": "the-south",
  Mexico: "mexico",
};

export const createEmptyPowerState = (power: Power): PowerState => {
  const setup = CAMPAIGN_SETUP.powers[power];
  return {
    stability: setup.stability,
    manpower: setup.manpower,
    secondaryManpower: setup.secondaryManpower,
    industry: setup.industry,
    territorialKeys: setup.territorialKeys,
    colonialKeys: setup.colonialKeys,
    arabKeys: setup.arabKeys,
    cityOfLight: power === "FR" ? 0 : undefined,
    citizenship: [],
    rights: [],
    government: power === "FR" ? "secondEmpire" : undefined,
    unified: power === "GE" ? false : undefined,
    tsrr: power === "RU" ? false : undefined,
    scorchedEarth: power === "RU" ? true : undefined,
    jihad: power === "OT" ? 0 : undefined,
    indiaStable: power === "UK" ? true : undefined,
    indiaIndependent: power === "UK" ? false : undefined,
    hand: [],
    homeCards: [],
    selectedHomeCard: null,
    goals: [],
    goalDeck: [],
    vp: 0,
    alliance: "neutral",
    mpit: {te: 0, ta: 0, neutral: 1},
    reserves: [],
    cpChain: [],
    industryCard: null,
    autoIndustry: false,
    flags: {powerProjection: CAMPAIGN_SETUP.powerProjection[power]},
    warBudget: 0,
    gwBudget: 0,
    gwCard: null,
    gwHandLimit: 1,
    cardMarkers: 0,
  };
};
