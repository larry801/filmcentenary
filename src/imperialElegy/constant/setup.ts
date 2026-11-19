import {Power, PowerState, SpaceId} from "../types";
import {SCENARIOS} from "./scenarios";
import {CAMPAIGN_SCENARIO} from "./scenarios/campaign";
import type {ScenarioDef, ScenarioFortSetup, ScenarioPowerStart, ScenarioUnitSetup} from "./scenarios/types";

/**
 * Campaign setup constants.
 *
 * The scenario data lives in `constant/scenarios/` — one module per printed
 * scenario (`IE_playbook.pdf` pp. 3-10).  This file keeps the campaign's
 * historical export names (`CAMPAIGN_SETUP`, `SetupUnit`, `SetupFort`,
 * `START_BUILD_BOX`, `MINOR_POWER_HOMES`) so the rest of the engine, the board
 * and the existing test suites keep reading the campaign exactly as before,
 * while `constant/scenarios/index.ts#SCENARIOS` is the single source of truth
 * for every scenario.
 */

export type SetupUnit = ScenarioUnitSetup;
export type SetupFort = ScenarioFortSetup;
export type CampaignSetup = ScenarioDef;

/**
 * The campaign setup (playbook p. 3), kept as a value export because the tests,
 * the board and several engine modules compare against it.
 */
export const CAMPAIGN_SETUP: ScenarioDef = CAMPAIGN_SCENARIO;

/** Every printed scenario, keyed by id. */
export {SCENARIOS};

/** Minor powers with an army in the End Phase Build Box at campaign start. */
export const START_BUILD_BOX: string[] = [...CAMPAIGN_SCENARIO.buildBox];

/**
 * The printed home space of every minor power (rules 12.5.3 / 20.3).
 *
 * This is map data, not scenario data: a minor's home is the space that shares
 * its name, in every scenario.
 */
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

/**
 * An empty power display marker for a scenario.
 *
 * The campaign's values are used when the scenario does not print a track, so
 * a caller can always build a state; scenario data that does print a value
 * overrides it.  The characteristic markers (government, unified, tsrr, …) keep
 * their printed per-power defaults.
 */
export const createEmptyPowerState = (power: Power, scenario: ScenarioDef = CAMPAIGN_SCENARIO): PowerState => {
  const campaign = CAMPAIGN_SCENARIO.powers[power];
  const setup: ScenarioPowerStart = {...campaign, ...scenario.powers[power]};
  // The campaign prints every track, so its marker is a complete fallback for
  // the tracks a later scenario may leave out.
  const campaignManpower = campaign.manpower ?? 0;
  const campaignTerritorial = campaign.territorialKeys ?? 0;
  const campaignColonial = campaign.colonialKeys ?? 0;
  return {
    stability: setup.stability,
    // Manpower is printed on every scenario display, but a track total may be
    // omitted when the print derives it from the keys (the alternate GW
    // setups say "set manpower from the keys"); fall back to the campaign
    // marker so the state always starts from a legal value and
    // `recomputeTracks` corrects it at the first end phase.
    manpower: setup.manpower ?? campaignManpower,
    secondaryManpower: setup.secondaryManpower,
    industry: setup.industry,
    territorialKeys: setup.territorialKeys ?? campaignTerritorial,
    colonialKeys: setup.colonialKeys ?? campaignColonial,
    arabKeys: setup.arabKeys,
    cityOfLight: power === "FR" ? (setup.cityOfLight ?? 0) : undefined,
    citizenship: [...(setup.citizenship ?? [])],
    rights: [],
    government: power === "FR" ? (setup.government ?? "secondEmpire") : undefined,
    // A scenario may print an already unified Germany (1880) or a completed
    // TSRR (the GW setups); everything else starts at the campaign default.
    unified: power === "GE" ? (setup.unified ?? false) : undefined,
    tsrr: power === "RU" ? (setup.tsrr ?? false) : undefined,
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
    alliance: setup.alliance ?? "neutral",
    mpit: setup.mpit ? {...setup.mpit} : {te: 0, ta: 0, neutral: 1},
    reserves: [],
    cpChain: [],
    industryCard: null,
    autoIndustry: setup.autoIndustry === true,
    flags: {powerProjection: setup.powerProjection ?? scenario.powerProjection[power]},
    warBudget: 0,
    gwBudget: 0,
    gwCard: null,
    gwHandLimit: 1,
    cardMarkers: setup.cardMarkers ?? 0,
  };
};
