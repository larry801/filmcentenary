import {AllianceBox, GoalId, Power, PowerOrMinor, SpaceId, UnitKind} from "../../types";
import type {ScenarioId} from "./ids";

/**
 * One unit of a scenario's printed setup.
 *
 * Same shape as the campaign setup that already existed, plus the two markers
 * the later scenarios print (`eliteColonialEf` for the GW tutorial's German
 * East Africa force and `arab` for Ottoman Arab armies).
 */
export interface ScenarioUnitSetup {
  owner: PowerOrMinor;
  kind: UnitKind;
  space: SpaceId | null;
  /** null = reserve armies holding box. */
  steps: 1 | 2;
  special?: "indian" | "arab" | "eliteColonialEf";
}

export interface ScenarioFortSetup {
  space: SpaceId;
  power: PowerOrMinor;
  level: 1 | 2 | 3;
  /** 33.2.3: the Indian fort never degrades. */
  indian?: boolean;
}

/** A printed `power` value start on one of a power's tracks. */
export interface ScenarioPowerStart {
  stability: number;
  /** Printed manpower marker; omitted means "derive from the key tracks". */
  manpower?: number;
  /** UK colonial / OT Arab manpower. */
  secondaryManpower?: number;
  industry: number;
  /** Printed territorial key total (used when the board cannot derive it). */
  territorialKeys?: number;
  /** Printed colonial key total (used when the board cannot derive it). */
  colonialKeys?: number;
  /** Printed Arab key total. */
  arabKeys?: number;
  cityOfLight?: number;
  citizenship?: string[];
  government?: "secondEmpire" | "thirdRepublic";
  unified?: boolean;
  tsrr?: boolean;
  autoIndustry?: boolean;
  alliance?: AllianceBox;
  /** Alliance Track boxes of the Major Power Influence Track chits. */
  mpit?: {te: number; ta: number; neutral: number};
  powerProjection?: number;
  cardMarkers?: number;
  /** National Goals kept from the opening `draw 3, keep 1` (1870/1880 print one). */
  startingGoals?: number;
}

/**
 * Italy's printed status in a scenario.  Before the campaign's unification
 * Italy is the four minor powers; the 1870/1880 and alternate-GW setups print an
 * already unified Kingdom of Italy with its own units and control markers.
 */
export interface ScenarioItalySetup {
  /** True when the scenario starts with the Kingdom of Italy on the map. */
  unified: boolean;
  /** 22.3.1-style extra counters granted by the scenario's own setup. */
  reinforcements?: {armies: number; squadrons: number; dreadnoughts?: number};
  /** Alliance Track box of Italy's own chit. */
  alliance?: AllianceBox;
  /** Printed influence of Italy's own MPIT column. */
  mpit?: {te: number; ta: number; neutral: number};
}

/** A truce printed on a scenario's display setup ("1 turn FR Truce"). */
export interface ScenarioTruce {
  a: Power;
  b: Power;
  turns: number;
}

/**
 * Scenario-specific rules that are not setup data.
 *
 * Everything here is transcribed from the playbook scenario pages; the engine
 * reads it through `engine/scenario.ts` so no rule is hard-coded per scenario.
 */
export interface ScenarioSpecialRules {
  /**
   * `IE_playbook.pdf` p. 3: "Do not count VPs at the end of the tutorial
   * scenario."  When false the final score is stability only (no NGs).
   */
  countVp: boolean;
  /**
   * Decisive end-of-turn NG draws, as campaign turn numbers.  The campaign
   * prints turns 1, 3 and 5 (2.4 / 20.11); the 1870 scenario uses 3 and 5 and
   * the 1880 scenario 4 and 6 ("instead of turns 3 and 5").
   */
  ngDrawTurns: number[];
  /** How many NGs a power draws before the first prep phase (0 = none). */
  startingGoalDraw?: Partial<Record<Power, number>>;
  /**
   * Overrides for the 20.11 end-phase draw size.  The 1870/1880 scenarios print
   * "The GE player only draws 2 NGs ... during the end phase of turns N and M",
   * which is the same reduced draw as the opening one.
   */
  ngDrawCount?: Partial<Record<Power, number>>;
  /**
   * 33.1 Blood and Iron! is a campaign rule: GE may search its NG deck for
   * Unification! in the turn-1 end phase.  Only printed for the campaign.
   */
  bloodAndIron?: boolean;
  /** Per-scenario extra cards dealt in every prep phase. */
  extraPrepCards?: Partial<Record<Power, number>>;
  /** 1870: FR may concede the Franco-Prussian War before the first prep phase. */
  francoPrussianWar?: boolean;
  /** 1880: five random action cards plus the Berlin Conference on top of the deck. */
  berlinConference?: boolean;
  /**
   * Scenario 4 (p. 7) is a modifier, but a scenario can also print its own
   * "no GW" reading; `noGw` is the runtime setupData flag and this records
   * whether the scenario supports it (all pre-GW scenarios do).
   */
  allowsNoGw?: boolean;
  /** Playbook p. 7-10: the Great War tutorial starts at GW turn 0's maneuver step. */
  gwTutorial?: GwTutorialSetup;
  /** Playbook pp. 8-10: alternate-history GW setups use the common procedure. */
  altGw?: AltenateGwSetup;
  /** Printed GW-specific special rules (tutorial p. 7). */
  gwSpecial?: {
    /** "If AU does not launch a land battle against Serbia on GW turn 0 they lose one stability." */
    auSerbiaBattleOrStability?: boolean;
    /** "The UK cannot amphibiously assault GE home spaces containing a GE naval unit(s)." */
    ukNoAmphibiousGermanPorts?: boolean;
    /** "OT will join the Triple Alliance during the winter step of GW turn 0." */
    ottomanJoinsTaInWinter?: boolean;
  };
}

/** Playbook p. 7: the Great War tutorial's printed starting position. */
export interface GwTutorialSetup {
  /** GW turn the scenario opens with. */
  turn: number;
  /** Printed wartime initiative order, with the bonus slot spelled out. */
  order: (Power | "bonus")[];
  /** The power that takes the bonus impulse on GW turn 1. */
  bonusFor?: Power[];
  te: Power[];
  ta: Power[];
  neutrals: Power[];
  /** Permanent events in effect at the start. */
  permanentEvents: {machineGuns?: boolean; hydraulicRecoil?: boolean};
  /** Canals in effect at the start. */
  canals: {suez?: boolean; kiel?: boolean};
  /** UK "I Want You" bonus armies from the National Will Step. */
  ukBonusArmies?: number;
}

/**
 * Playbook pp. 8-10: the alternate-history GW setups.
 *
 * The printed procedure is: (1) take control of the listed spaces, (2) spend
 * build points on stability/industry, (3) take control of uncontrolled keys in
 * turn order, (4) set manpower, (5) place the listed units.  `Control` lists the
 * explicit spaces; the numbered "control N uncontrolled keys" instructions are
 * kept as choices the players make during the setup phase.
 */
export interface AltenateGwSetup {
  /** Printed alliances ("Alliances: TA: UK, AU, and RU. TE: GE, FR, and OT."). */
  te: Power[];
  ta: Power[];
  neutrals: Power[];
  /** Common: each power's printed list of explicit control. */
  control: Partial<Record<Power | "Italy", SpaceId[]>>;
  /** "Control all home spaces" shorthand. */
  allHomeSpaces?: Partial<Record<Power | "Italy", boolean>>;
  /** Number of uncontrolled keys each power may take, split by region. */
  uncontrolledKeys: Partial<Record<Power | "Italy", {africa: number; asia: number}>>;
  /** Build points per power (each raises stability or industry by one). */
  buildPoints: Partial<Record<Power | "Italy", number>>;
  /** Printed unit inventories placed during the setup step. */
  units: Partial<Record<Power | "Italy", {kind: UnitKind; count: number}[]>>;
  /** Powers that start the scenario at war. */
  startingWars?: {attacker: Power; defender: Power | string; minorTarget?: {minor: string; ally: Power | null}}[];
  /** "Trans-Siberian RR: Complete". */
  tsrrComplete?: Power[];
  /** Independent Poland's printed markers (scenario 2). */
  independentPoland?: boolean;
  /** Minor power / Italian control the setup writes outside the player lists. */
  minorControl?: {space: SpaceId; control: PowerOrMinor}[];
  /** Printed extra alliances with minor powers ("Alliance with Papal States"). */
  minorAlliances?: {power: Power; minor: string}[];
}

/** One complete printed scenario. */
export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  nameZh: string;
  /** Campaign turn the scenario starts on (1-based, shared with the campaign). */
  firstTurn: number;
  /** Campaign turn the scenario ends on. */
  lastTurn: number;
  wtt: number;
  powers: Record<Power, ScenarioPowerStart>;
  units: ScenarioUnitSetup[];
  forts: ScenarioFortSetup[];
  diplomacy: {power: Power; space: SpaceId}[];
  influence: {power: Power; space: SpaceId}[];
  pacification: {space: SpaceId; value: number}[];
  /**
   * Printed "Ally marker" entries: a minor power already allied to a player at
   * the scenario's start (rules 4.8 / 12.5.3).  The 1870 setup prints GE's
   * allies as Bavaria and Saxony and RU's as Romania; the 1880 setup prints
   * RU's as Romania, Serbia and Bulgaria.
   */
  allyMarkers?: {power: Power; minor: string; space: SpaceId}[];
  controlOverrides: {space: SpaceId; control: PowerOrMinor | null}[];
  powerProjection: Record<Power, number>;
  removedCards: string[];
  /** 20.3 End Phase Build Box roster. */
  buildBox: string[];
  truces?: ScenarioTruce[];
  /** Scenario plainly marks the Suez Canal complete. */
  suezComplete?: boolean;
  kielComplete?: boolean;
  italy?: ScenarioItalySetup;
  /** Minor powers that start with an IMP (independent minor power) marker. */
  independentMinors?: string[];
  /**
   * The spaces that carry the printed IMP marker.  The campaign prints it on
   * Egypt, Great Sand Sea and Sinai; the 1870 setup prints the markers without
   * handing those spaces to Egypt, so the marker and the control are separate
   * facts and both are transcribed.
   */
  independentMinorMarkers?: {minor: string; space: SpaceId}[];
  /**
   * Printed National Goal deck edits: a scenario may add a goal to a power's
   * deck and let that power drop one of two.
   */
  goalDeck?: {power: Power; add?: GoalId; removeOneOf?: GoalId[]}[];
  special: ScenarioSpecialRules;
  notes: string[];
}

/** `CAMPAIGN_SETUP` compatibility alias: the campaign is a scenario like any other. */
export type CampaignSetup = ScenarioDef;
