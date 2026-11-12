/**
 * Imperial Elegy — national characteristics.
 *
 * This module is the single, typed home for the power-display rules that used
 * to be enforced ad hoc in `rules.ts`, `combat.ts` and `moves.ts`.  Every
 * helper is a *pure decision function*: it reads `G` and returns data telling
 * the caller what to apply.  Nothing here mutates game state.
 *
 * Integration rule of thumb: the `delta`/`drm` fields are amounts to add to an
 * existing calculation; once-per-game or once-per-turn consumption is returned
 * as a flag (`scorchedEarth.consumes`, `jihad.consume`, ...) for the caller to
 * apply.  `cardDrawModifier().delta` is specifically the *additional* cards
 * from national characteristics and is designed to replace the three
 * characteristic-specific lines in `rules.cardsToDraw` (India / City of Light
 * / TSRR).  Tsarist Repression is already encoded in RU's stability table, so
 * it is reported but contributes no extra delta.
 */

import {
  BattleState,
  ImperialElegyState,
  Power,
  PowerState,
  POWERS,
  RapidDeploymentGrant,
  SpaceId,
  Unit,
  UnitKind,
  WarState,
} from "../types";
import {POWER_DEFS, PowerDef} from "../constant/powers";
import {SPACES, TSRR_ROUTE, isNavalBox, neighboursOf} from "../constant/spaces";
import {
  ARAB_KEY_SPACES,
  EGYPTIAN_SPACES,
  allied,
  friendlySpace,
  hasLoc,
  hostileOwner,
  isArmyKind,
  isHomeSpace,
  isPower,
  landUnitsIn,
  ownsKey,
  unitsIn,
} from "./rules";

// ---------------------------------------------------------------------------
// Shared definitions
// ---------------------------------------------------------------------------

/** The eight nationalities AU may grant rights / full citizenship (33.4.1). */
export const AU_NATIONALITIES = [
  "Italians",
  "Czechs",
  "Hungarians",
  "Serbians",
  "Poles",
  "Romanians",
  "Slovaks",
  "Croats",
] as const;

export type AuNationality = (typeof AU_NATIONALITIES)[number];

/** The Dual Monarchy card (A Compromise Needed, 33.4). */
export const DUAL_MONARCHY_CARD = "IE-A047";

/**
 * A85 Hungarian Obstinacy: "Austria-Hungary cannot grant citizenship or rights
 * for the rest of the turn."  The card writes the single public `G.flags` slot
 * (`scope: "global"` in `cards.data.ts`), so every reader must use this helper
 * rather than a per-power `flags` bag.  Cleared by `clearTurnDurationFlags`.
 */
export const auCitizenshipBlocked = (G: ImperialElegyState): boolean =>
  G.flags.auNoCitizenship === true;

const DEFAULT_MINIMUM_DRAW = 3;

const clampStability = (value: number): number => Math.max(0, Math.min(6, value));

const isRuHomeSpace = (G: ImperialElegyState, space: SpaceId): boolean =>
  SPACES[space]?.home === "RU" || G.spaces[space]?.homeOverride === "RU";

const isOtHomeSpace = (G: ImperialElegyState, space: SpaceId): boolean =>
  SPACES[space]?.home === "OT" || G.spaces[space]?.homeOverride === "OT";

const isArabKey = (space: SpaceId): boolean =>
  ARAB_KEY_SPACES.has(space) || space === "egypt" || EGYPTIAN_SPACES.has(space);

/**
 * The army type a build in `space` implies for the Ottomans (33.6): Arab
 * armies come from Arab/Egyptian-nationality keys, Turkish armies from the
 * remaining keys.  Used by `moves.recruit` so the existing build buttons pick
 * the correct manpower pool without a new UI toggle.
 */
export const ottomanArmyTypeFor = (space: SpaceId): OttomanArmyType =>
  isArabKey(space) || spaceNationalities(space).some((n) => ["Arab", "Arabs", "Egyptian", "Egyptians"].includes(n))
    ? "arab"
    : "turkish";

const spaceNationalities = (space: SpaceId): readonly string[] =>
  SPACES[space]?.nationalities ?? [];

const unitsOf = (G: ImperialElegyState, ids: SpaceId[] | string[]): Unit[] =>
  ids.map((id) => G.units[id]).filter((u): u is Unit => u !== undefined);

const hasUnitFlag = (units: Unit[], flag: string): boolean =>
  units.some((u) => Boolean(u.flags?.[flag]));

const isStandingArmy = (u: Unit): boolean => u.kind === "army";

// ---------------------------------------------------------------------------
// 33.4 / 33.3 / 33.5 — stability loss
// ---------------------------------------------------------------------------

export type StabilityCause = "keyLoss" | "battle" | "war" | "card" | "other";

export interface StabilityLossContext {
  /** Why stability is being lost.  Scorched Earth only triggers on a key loss. */
  cause?: StabilityCause;
  /** Override `G.gw?.active` (useful for unit tests and for hypothetical losses). */
  gw?: boolean;
  /** The key/space being lost, if any. */
  space?: SpaceId;
  /** Pre-rolled d6 for AU's Unstable Situation.  Omit to leave the outcome pending. */
  dieRoll?: number;
  /** FR loses a war: Second Empire becomes Third Republic. */
  lostWar?: boolean;
}

export interface ScorchedEarthDecision {
  /** Scorched Earth is still unused and the GW is active. */
  available: boolean;
  /** This particular loss is the key loss that Scorched Earth absorbs. */
  applies: boolean;
  /** Caller must set `RU.scorchedEarth = false` when true. */
  consumes: boolean;
  keyLoss: boolean;
}

export interface UnstableSituationDecision {
  /** The roll applies: AU, actual stability loss, and not during the GW. */
  applies: boolean;
  rights: number;
  dieRoll: number | null;
  /** die roll + 1 per nationality with rights; null while awaiting a roll. */
  total: number | null;
  /** 6+ passes. */
  passes: boolean | null;
  effect: "none" | "discardCardOrMinusOneMarker" | "pending";
  reason: string | null;
}

export interface GovernmentTransition {
  from: PowerState["government"] | undefined;
  to: PowerState["government"] | undefined;
  changed: boolean;
  reason: "stability" | "lostWar" | null;
}

export interface StabilityLossResult {
  power: Power;
  /** The delta the caller asked for. */
  requestedDelta: number;
  /** The delta that should actually be applied (after prevention/clamping). */
  delta: number;
  stabilityBefore: number;
  stabilityAfter: number;
  /** True when a characteristic prevented the loss. */
  prevented: boolean;
  scorchedEarth: ScorchedEarthDecision;
  unstableSituation: UnstableSituationDecision;
  government: GovernmentTransition;
  reasons: string[];
}

/**
 * Resolve a stability change against the national characteristics.
 *
 * Handles:
 *  - RU Scorched Earth (first key lost during the GW, once);
 *  - AU Unstable Situation (roll 6+ after rights DRMs, no effect during GW);
 *  - FR Second Empire -> Third Republic at stability 1 or after losing a war,
 *    never during the GW.
 */
export const stabilityLoss = (
  G: ImperialElegyState,
  power: Power,
  requestedDelta: number,
  ctx: StabilityLossContext = {},
): StabilityLossResult => {
  const p = G.powers[power];
  const gw = ctx.gw ?? Boolean(G.gw?.active);
  const keyLoss = ctx.cause === "keyLoss";
  const reasons: string[] = [];

  let delta = requestedDelta;

  // RU Scorched Earth (33.5).
  const scorchedAvailable = power === "RU" && gw && p.scorchedEarth === true;
  const scorchedApplies = scorchedAvailable && keyLoss && delta < 0;
  if (scorchedApplies) {
    delta = 0;
    reasons.push("scorchedEarth");
  }
  const scorchedEarth: ScorchedEarthDecision = {
    available: scorchedAvailable,
    applies: scorchedApplies,
    consumes: scorchedApplies,
    keyLoss,
  };

  // Clamp exactly like changeStability so Unstable Situation sees a real drop.
  const stabilityBefore = p.stability;
  const stabilityAfter = clampStability(stabilityBefore + delta);
  const appliedDelta = stabilityAfter - stabilityBefore;
  const prevented = appliedDelta > requestedDelta;

  // AU Unstable Situation (33.4): no effect during the GW, and only when AU
  // actually loses a point of stability.
  const unstableApplies = power === "AU" && appliedDelta < 0 && !gw;
  const rights = p.rights.length;
  const dieRoll = typeof ctx.dieRoll === "number" ? ctx.dieRoll : null;
  const total = dieRoll === null ? null : dieRoll + rights;
  const passes = total === null ? null : total >= 6;
  const unstableSituation: UnstableSituationDecision = {
    applies: unstableApplies,
    rights,
    dieRoll,
    total,
    passes,
    effect: !unstableApplies
      ? "none"
      : passes === null
        ? "pending"
        : passes
          ? "none"
          : "discardCardOrMinusOneMarker",
    reason: !unstableApplies
      ? gw
        ? "no effect during the Great War"
        : appliedDelta >= 0
          ? "no actual stability loss"
          : "not Austria-Hungary"
      : null,
  };
  if (unstableApplies) reasons.push("unstableSituation");

  // FR government switch (33.3): stability reaches 1, or FR loses a war.
  // A stability *gain* never triggers the republic.
  const transitionReason: GovernmentTransition["reason"] =
    power === "FR" && p.government === "secondEmpire" && !gw
      ? ctx.lostWar
        ? "lostWar"
        : requestedDelta < 0 && stabilityAfter <= 1
          ? "stability"
          : null
      : null;
  const government: GovernmentTransition = {
    from: p.government,
    to: transitionReason === null ? p.government : "thirdRepublic",
    changed: transitionReason !== null,
    reason: transitionReason,
  };
  if (government.changed) reasons.push("frThirdRepublic");

  return {
    power,
    requestedDelta,
    delta: appliedDelta,
    stabilityBefore,
    stabilityAfter,
    prevented,
    scorchedEarth,
    unstableSituation,
    government,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 10.2 / 33.2 / 33.3 / 33.5 — card draw and card economy
// ---------------------------------------------------------------------------

export type CardDrawSourceId =
  | "tsaristRepression"
  | "indiaStable"
  | "indiaUnstable"
  | "cityOfLight"
  | "tsrr"
  | "britishBanking";

export interface CardDrawSource {
  id: CardDrawSourceId;
  delta: number;
  note: string;
}

export interface CardDrawModifier {
  power: Power;
  /**
   * Additional cards to add to the base draw (industry + stability table +
   * flashpoint bonuses).  Designed to replace the UK/FR/RU special cases in
   * `rules.cardsToDraw`.
   */
  delta: number;
  sources: CardDrawSource[];
  tsaristRepression: {
    /** RU is exactly at stability 5. */
    activeAtStability5: boolean;
    /** RU is at stability 6 (the printed stability-6 card is in the table). */
    atStability6: boolean;
    /** The one printed card, when the characteristic is active. */
    printedBonus: number;
    /** Always 0: the RU stability table already contains this card. */
    netAdditional: number;
    nonCumulative: true;
  };
  india: {
    controlled: boolean;
    stable: boolean;
    /** Cards contributed by the India marker: +1 stable/controlled, 0 otherwise. */
    delta: number;
    /** Relative to the stable marker (unstable is one fewer). */
    relativeToStable: number;
  };
  cityOfLight: {points: number; threshold: number; delta: number};
  tsrr: {completed: boolean; delta: number};
  banking: {
    saveLimit: number;
    passLimit: number;
    minimumDraw: number;
    note: string;
  };
}

/**
 * Card-draw modifiers from national characteristics.
 *
 * The three numeric sources (India stable, City of Light >= 4, completed TSRR)
 * are additive.  Tsarist Repression is surfaced for UI/audit purposes but adds
 * no delta because RU's row at stability 5 (and the non-cumulative stability 6
 * row) already contains it.
 */
export const cardDrawModifier = (G: ImperialElegyState, power: Power): CardDrawModifier => {
  const p = G.powers[power];
  const sources: CardDrawSource[] = [];
  let delta = 0;

  const controlsIndia = G.spaces.india?.control === "UK";
  const indiaStable = controlsIndia && p.indiaStable !== false;
  const indiaDelta = indiaStable ? 1 : 0;
  if (power === "UK") {
    delta += indiaDelta;
    sources.push({
      id: indiaStable ? "indiaStable" : "indiaUnstable",
      delta: indiaDelta,
      note: indiaStable
        ? "India stable and controlled: +1 card"
        : "India unstable/not controlled: no +1 card (one fewer than stable)",
    });
  }

  const cityPoints = p.cityOfLight ?? 0;
  const cityDelta = power === "FR" && cityPoints >= 4 ? 1 : 0;
  if (power === "FR") {
    delta += cityDelta;
    if (cityDelta > 0) {
      sources.push({id: "cityOfLight", delta: 1, note: `City of Light ${cityPoints} >= 4: +1 card`});
    }
  }

  const tsrrDelta = power === "RU" && p.tsrr === true ? 1 : 0;
  if (power === "RU") {
    delta += tsrrDelta;
    if (tsrrDelta > 0) sources.push({id: "tsrr", delta: 1, note: "Trans-Siberian Railroad complete: +1 card"});
  }

  const tsaristAt5 = power === "RU" && p.stability === 5;
  const tsaristAt6 = power === "RU" && p.stability === 6;
  if (tsaristAt5) {
    sources.push({
      id: "tsaristRepression",
      delta: 0,
      note: "Tsarist Repression: +1 card already encoded in the RU stability table at 5 (non-cumulative with 6)",
    });
  }

  const isUK = power === "UK";
  const banking = {
    saveLimit: isUK ? 2 : 1,
    passLimit: isUK ? 2 : 1,
    minimumDraw: DEFAULT_MINIMUM_DRAW,
    note: isUK
      ? "British Banking: pass with two cards and save two cards"
      : "Standard hand limits",
  };
  if (isUK) {
    sources.push({id: "britishBanking", delta: 0, note: banking.note});
  }

  return {
    power,
    delta,
    sources,
    tsaristRepression: {
      activeAtStability5: tsaristAt5,
      atStability6: tsaristAt6,
      printedBonus: tsaristAt5 ? 1 : 0,
      netAdditional: 0,
      nonCumulative: true,
    },
    india: {
      controlled: controlsIndia,
      stable: indiaStable,
      delta: power === "UK" ? indiaDelta : 0,
      relativeToStable: indiaStable ? 0 : -1,
    },
    cityOfLight: {points: cityPoints, threshold: 4, delta: cityDelta},
    tsrr: {completed: power === "RU" && p.tsrr === true, delta: tsrrDelta},
    banking,
  };
};

// ---------------------------------------------------------------------------
// 18.2 / 33.2 / 33.3 / 33.5 / 33.6 — land battles
// ---------------------------------------------------------------------------

export type BattleSide = "attacker" | "defender";

export interface LandBattleSource {
  id:
    | "britishFirstArmy"
    | "indianArmy"
    | "zouaves"
    | "bewegungskrieg"
    | "prussianMilitaryTradition"
    | "dreyfusAffair"
    | "endlessSpace"
    | "jihad";
  /** DRM added to this power's roll. */
  drm: number;
  side: BattleSide | null;
  origin: "national" | "event";
  note: string;
}

export interface EndlessSpaceDecision {
  /** Any battle/support space is a Russian home space. */
  halvesSupport: boolean;
  russianHomeSpaces: SpaceId[];
  note: string;
}

export interface JihadDecision {
  markers: number;
  available: boolean;
  /** Jihad gives the *opponent* -1; this power's own DRM does not change. */
  opponentDrm: number;
  /** Caller must decrement `OT.jihad` when true. */
  consume: boolean;
  qualifyingSpaces: SpaceId[];
  note: string;
}

export interface LandBattleModifier {
  power: Power;
  side: BattleSide | null;
  /** Net DRM for this power in this battle. */
  drm: number;
  sources: LandBattleSource[];
  endlessSpace: EndlessSpaceDecision;
  jihad: JihadDecision;
  /** GE wins initiative ties (Bewegungskrieg). */
  initiativeTieBreak: boolean;
  notes: string[];
}

const conflictSide = (power: Power, battle: BattleState): BattleSide | null => {
  if (battle.attacker === power) return "attacker";
  if (battle.defender === power) return "defender";
  return null;
};

const sideUnits = (G: ImperialElegyState, battle: BattleState, side: BattleSide): Unit[] =>
  unitsOf(G, side === "attacker" ? battle.mainAttack : battle.mainDefense);

const jihadQualifies = (G: ImperialElegyState, space: SpaceId): boolean =>
  isOtHomeSpace(G, space) ||
  space === "caucasus" ||
  SPACES[space]?.flashpoints?.includes("greatGame") === true;

/**
 * RU Endless Space support check, usable before support is recorded.
 * Pass the battle's from/to spaces plus the candidate supporting space.
 */
export const endlessSpaceSupport = (
  G: ImperialElegyState,
  spaces: SpaceId[],
): EndlessSpaceDecision => {
  const russianHomeSpaces = [...new Set(spaces.filter((s) => isRuHomeSpace(G, s)))];
  const halvesSupport = russianHomeSpaces.length > 0;
  return {
    halvesSupport,
    russianHomeSpaces,
    note: halvesSupport
      ? "Endless Space: supporting armies into or from a Russian home space contribute half FP"
      : "No Russian home space involved",
  };
};

/**
 * Land-battle DRMs and support decisions from national characteristics.
 *
 *  - UK 1st Army: +1 when in the main force (either side);
 *  - UK Indian armies: -1 while India is unstable;
 *  - FR Zouaves: +1 when in the main force;
 *  - FR Dreyfus Affair (A98): -1 for the rest of the turn, either side, outside
 *    the GW (`flags.frLandDrm`);
 *  - GE: no intrinsic DRM, but exposes Bewegungskrieg's initiative tie-break
 *    and the Prussian Military Tradition event flag (`flags.landDrm`, attacker,
 *    outside the GW);
 *  - RU Endless Space: support into/from a Russian home space is halved;
 *  - OT Jihad: offers the once-per-battle -1 to the opponent.
 */
export const landBattleModifier = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState,
): LandBattleModifier => {
  const p = G.powers[power];
  const side = conflictSide(power, battle);
  const sources: LandBattleSource[] = [];
  const notes: string[] = [];
  let drm = 0;

  if (side !== null) {
    const units = sideUnits(G, battle, side);

    if (power === "UK") {
      if (hasUnitFlag(units, "firstArmy")) {
        drm += 1;
        sources.push({
          id: "britishFirstArmy",
          drm: 1,
          side,
          origin: "national",
          note: "British 1st Army: innate +1 DRM in the main force",
        });
      }
      if (p.indiaStable === false && hasUnitFlag(units, "indian")) {
        drm -= 1;
        sources.push({
          id: "indianArmy",
          drm: -1,
          side,
          origin: "national",
          note: "India unstable: Indian armies in the main force suffer -1 DRM",
        });
      }
    }

    if (power === "FR" && units.some((u) => u.kind === "zouave")) {
      drm += 1;
      sources.push({
        id: "zouaves",
        drm: 1,
        side,
        origin: "national",
        note: "Zouaves: +1 land battle DRM when in the main force",
      });
    }

    // A98 Dreyfus Affair: "France receives a -1 land battle modifier for the
    // rest of the turn. ... no effect during the Great War."  It applies to
    // every French land battle this turn, attacking or defending, and is
    // cleared at the turn boundary by `clearTurnDurationFlags`.
    if (power === "FR" && !G.gw?.active) {
      const eventDrm = Number(p.flags.frLandDrm ?? 0);
      if (eventDrm !== 0) {
        drm += eventDrm;
        sources.push({
          id: "dreyfusAffair",
          drm: eventDrm,
          side,
          origin: "event",
          note: "Dreyfus Affair: -1 land battle DRM for the rest of the turn",
        });
      }
    }

    if (power === "GE") {
      sources.push({
        id: "bewegungskrieg",
        drm: 0,
        side,
        origin: "national",
        note: "Bewegungskrieg wins initiative ties; no intrinsic land-battle DRM",
      });
      const eventDrm = Number(p.flags.landDrm ?? 0);
      if (eventDrm !== 0 && side === "attacker" && !G.gw?.active) {
        drm += eventDrm;
        sources.push({
          id: "prussianMilitaryTradition",
          drm: eventDrm,
          side,
          origin: "event",
          note: "Prussian Military Tradition event: attacker-only +1 (not during the GW)",
        });
      }
    }
  }

  // RU Endless Space (33.5).  Affects support FP, not the main-force DRM.
  const supportSpaces = [
    ...battle.supportAttack.map((s) => s.space),
    ...battle.supportDefense.map((s) => s.space),
  ];
  const endlessSpace = endlessSpaceSupport(G, [battle.from, battle.to, ...supportSpaces]);
  if (endlessSpace.halvesSupport) {
    sources.push({
      id: "endlessSpace",
      drm: 0,
      side,
      origin: "national",
      note: endlessSpace.note,
    });
  }

  // OT Jihad (33.6).
  const markers = p.jihad ?? 0;
  const qualifyingSpaces = [...new Set([battle.from, battle.to].filter((s) => jihadQualifies(G, s)))];
  const jihadAvailable = power === "OT" && markers > 0 && qualifyingSpaces.length > 0;
  const jihad: JihadDecision = {
    markers,
    available: jihadAvailable,
    opponentDrm: jihadAvailable ? -1 : 0,
    consume: jihadAvailable,
    qualifyingSpaces,
    note: jihadAvailable
      ? "Jihad available: discard one marker to give the opponent -1 in this battle"
      : power === "OT"
        ? "No Jihad marker or battle is not in an OT home / Caucasus / Great Game space"
        : "Only the Ottoman player uses Jihad markers",
  };
  if (jihadAvailable) {
    sources.push({
      id: "jihad",
      drm: 0,
      side,
      origin: "national",
      note: jihad.note,
    });
  }

  if (sources.length === 0 && side !== null) {
    notes.push("No national-characteristic land-battle modifier applies");
  }

  return {
    power,
    side,
    drm,
    sources,
    endlessSpace,
    jihad,
    initiativeTieBreak: power === "GE",
    notes,
  };
};

// ---------------------------------------------------------------------------
// 7.3 / 12.2 / 33.2 / 33.5 / 33.6 — recruitment limits
// ---------------------------------------------------------------------------

export type RecruitKind = "army" | "reserveArmy" | "eliteCorps";
export type OttomanArmyType = "turkish" | "arab";

export interface BritishRecruitment {
  preGw: boolean;
  britishArmyLimit: number | null;
  currentBritishArmies: number;
  canBuildAnotherBritishArmy: boolean;
  indianArmyLimit: number;
  currentIndianArmies: number;
  /** 33.2.1: the colonial-manpower ceiling the CW army shares with the Indian Army. */
  cwArmyLimit: number;
  currentCwArmies: number;
  /** True during the Great War, the only window a CW army may be built in. */
  cwArmyAvailable: boolean;
}

/**
 * 33.2.1: "The CW army can only be built during the GW, and it must be built
 * in Australia/New Zealand or Canada."  The two printed spaces, in one place
 * so the build decision, the board control and the tests agree.
 */
export const CW_ARMY_SPACES: readonly SpaceId[] = ["australia-new-zealand", "canada"] as const;

/** True when `space` is one of the printed CW-army build spaces (33.2.1). */
export const isCwArmySpace = (space: SpaceId | null | undefined): boolean =>
  space !== null && space !== undefined && CW_ARMY_SPACES.includes(space);

export interface OttomanRecruitment {
  separateManpower: true;
  turkishManpower: number;
  arabManpower: number;
  arabKeySpaces: SpaceId[];
  turkishRule: "keysWithoutMinorityNationality";
  arabRule: "arabNationalityKeysOnly";
  localAutonomy: {
    arabKeysOnly: true;
    tunisiaTripoliRequireLandLoc: true;
  };
}

export interface RecruitmentLimits {
  power: Power;
  /** Maximum standing armies from the manpower track. */
  armyLimit: number;
  currentArmies: number;
  armyRemaining: number;
  reserveAllowed: boolean;
  reserveLimit: number;
  currentReserves: number;
  reserveRemaining: number;
  reserveFormula: PowerDef["reserveFormula"];
  british: BritishRecruitment | null;
  ottoman: OttomanRecruitment | null;
  reasons: string[];
}

const reserveLimitFor = (G: ImperialElegyState, power: Power): number => {
  const p = G.powers[power];
  const formula = POWER_DEFS[power].reserveFormula;
  if (formula === "none") return 0;
  const lower = Math.min(p.manpower, p.industry);
  return formula === "manpowerPlusOne" ? lower + 1 : lower;
};

const currentStandingArmies = (G: ImperialElegyState, power: Power): number =>
  Object.values(G.units).filter(
    (u) => u.owner === power && isStandingArmy(u) && u.space !== null && u.space !== undefined,
  ).length;

const currentBritishArmies = (G: ImperialElegyState): number =>
  Object.values(G.units).filter(
    (u) => u.owner === "UK" && isStandingArmy(u) && !u.flags?.indian && !u.flags?.cw,
  ).length;

const currentIndianArmies = (G: ImperialElegyState): number =>
  Object.values(G.units).filter((u) => u.owner === "UK" && Boolean(u.flags?.indian)).length;

/** 33.2.1: CW (Commonwealth) armies are UK armies flagged `cw`. */
const currentCwArmies = (G: ImperialElegyState): number =>
  Object.values(G.units).filter((u) => u.owner === "UK" && Boolean(u.flags?.cw)).length;

/**
 * 33.2.1: Indian and CW armies both "consume colonial manpower", so the
 * colonial track is one shared ceiling, not two independent ones.
 */
const currentColonialArmies = (G: ImperialElegyState): number =>
  currentIndianArmies(G) + currentCwArmies(G);

const currentOttomanArmies = (G: ImperialElegyState, type: OttomanArmyType): number =>
  Object.values(G.units).filter(
    (u) =>
      u.owner === "OT" &&
      isStandingArmy(u) &&
      (type === "arab" ? Boolean(u.flags?.arab) : !u.flags?.arab),
  ).length;

const currentArmiesFor = (G: ImperialElegyState, power: Power): number => {
  if (power === "UK") return currentBritishArmies(G);
  if (power === "OT") return currentOttomanArmies(G, "turkish");
  return currentStandingArmies(G, power);
};

/**
 * Recruitment ceilings from national characteristics.
 *
 * Includes UK Professional Army (no reserves, one British army before the GW),
 * RU Russian Steamroller (lower of manpower/industry, +1), the base reserve
 * rule (lower of manpower/industry), and OT separate Turkish/Arab manpower
 * with Local Autonomy build restrictions.
 */
export const recruitmentLimits = (G: ImperialElegyState, power: Power): RecruitmentLimits => {
  const p = G.powers[power];
  const reasons: string[] = [];
  const reserveAllowed = POWER_DEFS[power].reserveFormula !== "none";
  const reserveLimit = reserveLimitFor(G, power);
  const currentReserves = p.reserves.length;
  const currentArmies = currentArmiesFor(G, power);

  let british: BritishRecruitment | null = null;
  let armyLimit = p.manpower;
  if (power === "UK") {
    const preGw = G.gw === null || !G.gw.active;
    const britishLimit = preGw ? 1 : null;
    const britishArmies = currentBritishArmies(G);
    british = {
      preGw,
      britishArmyLimit: britishLimit,
      currentBritishArmies: britishArmies,
      canBuildAnotherBritishArmy: britishLimit === null || britishArmies < britishLimit,
      indianArmyLimit: indianArmyCap(G),
      currentIndianArmies: currentIndianArmies(G),
      cwArmyLimit: Math.max(0, p.secondaryManpower ?? 0),
      currentCwArmies: currentCwArmies(G),
      cwArmyAvailable: G.gw !== null && G.gw.active === true,
    };
    armyLimit = preGw ? 1 : p.manpower;
    reasons.push(
      preGw
        ? "Professional Army: no reserves and only the 1st British Army before the GW"
        : "Professional Army: no reserve armies (British army limit is now manpower)",
    );
  } else if (power === "RU") {
    reasons.push("Russian Steamroller: reserve limit is the lower of manpower or industry, +1");
  } else if (reserveAllowed) {
    reasons.push("Reserve limit is the lower of manpower or industry");
  }

  let ottoman: OttomanRecruitment | null = null;
  if (power === "OT") {
    const arabKeySpaces = [...new Set([...ARAB_KEY_SPACES, "egypt"])];
    ottoman = {
      separateManpower: true,
      turkishManpower: p.manpower,
      arabManpower: p.secondaryManpower ?? 0,
      arabKeySpaces,
      turkishRule: "keysWithoutMinorityNationality",
      arabRule: "arabNationalityKeysOnly",
      localAutonomy: {arabKeysOnly: true, tunisiaTripoliRequireLandLoc: true},
    };
    reasons.push("Ottoman Manpower: Turkish and Arab manpower are tracked separately");
    reasons.push("Local Autonomy: Arab/Egyptian keys count as Arab keys; Tunisia/Tripoli need a land LoC");
  }

  return {
    power,
    armyLimit,
    currentArmies,
    armyRemaining: Math.max(0, armyLimit - currentArmies),
    reserveAllowed,
    reserveLimit,
    currentReserves,
    reserveRemaining: Math.max(0, reserveLimit - currentReserves),
    reserveFormula: POWER_DEFS[power].reserveFormula,
    british,
    ottoman,
    reasons,
  };
};

export interface RecruitDecision {
  power: Power;
  space: SpaceId | null;
  kind: RecruitKind;
  allowed: boolean;
  reasons: string[];
}

export interface RecruitContext {
  /** OT only: whether the army is Turkish or Arab. Defaults to Turkish. */
  ottoman?: OttomanArmyType;
  /** UK only: build an Indian army (colonial manpower) rather than a British one. */
  indian?: boolean;
  /**
   * UK only, 33.2.1: build the Commonwealth army (colonial manpower, Great War
   * only, in Australia/New Zealand or Canada) rather than a British one.
   */
  cw?: boolean;
}

/**
 * Space-level recruitment legality.  This is the companion to
 * `recruitmentLimits`: limits answer "how many", this answers "where/which".
 */
export const canRecruitIn = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId | null,
  kind: RecruitKind,
  ctx: RecruitContext = {},
): RecruitDecision => {
  const reasons: string[] = [];
  const limits = recruitmentLimits(G, power);

  if (kind === "reserveArmy") {
    if (!limits.reserveAllowed) {
      return {power, space, kind, allowed: false, reasons: [`${power} may not build reserve armies`]};
    }
    if (limits.currentReserves >= limits.reserveLimit) {
      return {
        power,
        space,
        kind,
        allowed: false,
        reasons: [`Reserve limit ${limits.reserveLimit} reached`],
      };
    }
    return {power, space, kind, allowed: true, reasons: ["Reserve army available"]};
  }

  if (space === null) {
    return {power, space, kind, allowed: false, reasons: ["An army needs a space"]};
  }

  if (kind === "eliteCorps") {
    const army = Object.values(G.units).find(
      (u) =>
        u.space === space &&
        isArmyKind(u.kind) &&
        (u.owner === power || G.spaces[space].ally === power),
    );
    return {
      power,
      space,
      kind,
      allowed: Boolean(army),
      reasons: army === undefined
        ? ["An elite corps needs a friendly army to attach to"]
        : ["Elite corps can attach to a friendly army"],
    };
  }

  if (!isHomeSpace(G, space, power)) reasons.push("Not a home space");
  if (!ownsKey(G, space, power)) reasons.push("Does not own the key");
  if (reasons.length > 0) return {power, space, kind, allowed: false, reasons};

  if (kind === "army") {
    if (power === "UK") {
      // 33.2.1 Commonwealth army: colonial manpower, Great War only, and only
      // in Australia/New Zealand or Canada.
      if (ctx.cw === true) {
        if (limits.british?.cwArmyAvailable !== true) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["The CW army can only be built during the GW"],
          };
        }
        if (!isCwArmySpace(space)) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["The CW army must be built in Australia/New Zealand or Canada"],
          };
        }
        const colonial = Math.max(0, G.powers.UK.secondaryManpower ?? 0);
        if (colonial <= 0) {
          return {power, space, kind, allowed: false, reasons: ["No colonial manpower available"]};
        }
        if (currentColonialArmies(G) >= colonial) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: [`Colonial manpower limit ${colonial} reached for Indian and CW armies`],
          };
        }
        return {power, space, kind, allowed: true, reasons: ["CW army within colonial manpower"]};
      }
      // The Indian Army (33.2): Indian armies draw on colonial manpower, never
      // on British manpower, and the UK may field no more than that track.
      if (ctx.indian === true) {
        if (G.powers.UK.indiaIndependent) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["India is independent: no new Indian armies may be built"],
          };
        }
        const colonial = G.powers.UK.secondaryManpower ?? 0;
        if (colonial <= 0) {
          return {power, space, kind, allowed: false, reasons: ["No colonial manpower available"]};
        }
        const cap = indianArmyCap(G);
        // 33.2.1: Indian and CW armies share the colonial-manpower ceiling.
        if (currentColonialArmies(G) >= cap) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: [`Colonial manpower limit ${cap} reached for Indian and CW armies`],
          };
        }
        return {power, space, kind, allowed: true, reasons: ["Indian army within colonial manpower"]};
      }
      if (limits.british?.preGw && !limits.british.canBuildAnotherBritishArmy) {
        return {
          power,
          space,
          kind,
          allowed: false,
          reasons: ["Professional Army: only the 1st British Army may be built before the GW"],
        };
      }
      if (!limits.british?.preGw && limits.currentArmies >= limits.armyLimit) {
        return {
          power,
          space,
          kind,
          allowed: false,
          reasons: [`British manpower limit ${limits.armyLimit} reached`],
        };
      }
    } else if (power === "OT") {
      const type = ctx.ottoman ?? "turkish";
      if (type === "arab") {
        if (
          !isArabKey(space) &&
          !spaceNationalities(space).some((n) => ["Arab", "Arabs", "Egyptian", "Egyptians"].includes(n))
        ) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["Arab armies may only be built in Arab/Egyptian keys"],
          };
        }
        if ((G.powers.OT.secondaryManpower ?? 0) <= 0) {
          return {power, space, kind, allowed: false, reasons: ["No Arab manpower available"]};
        }
        if (currentOttomanArmies(G, "arab") >= (G.powers.OT.secondaryManpower ?? 0)) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["Arab manpower limit reached"],
          };
        }
      } else {
        if (isArabKey(space)) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["Local Autonomy: Turkish armies may not be built in Arab/Egyptian keys"],
          };
        }
        const minority = spaceNationalities(space).some((n) => !["Turkish", "Turks"].includes(n));
        if (minority) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: ["Ottoman Manpower: Turkish armies need a key without a minority nationality"],
          };
        }
        if (currentOttomanArmies(G, "turkish") >= G.powers.OT.manpower) {
          return {
            power,
            space,
            kind,
            allowed: false,
            reasons: [`Turkish manpower limit ${G.powers.OT.manpower} reached`],
          };
        }
      }
    } else if (limits.currentArmies >= limits.armyLimit) {
      return {
        power,
        space,
        kind,
        allowed: false,
        reasons: [`Manpower/army limit ${limits.armyLimit} reached`],
      };
    }
  }

  return {power, space, kind, allowed: true, reasons: ["Recruitment legal", ...limits.reasons]};
};

// ---------------------------------------------------------------------------
// 33.2 — India, the Indian Army and Rapid Deployment
// ---------------------------------------------------------------------------

/**
 * The UK armies that are Indian armies (33.2): they draw on colonial manpower,
 * auto-displace to Bengal or India and are the units the independence sequence
 * removes.
 */
export const indianArmies = (G: ImperialElegyState): Unit[] =>
  Object.values(G.units).filter((unit) => unit.owner === "UK" && Boolean(unit.flags?.indian));

/** 33.2.2: after independence the UK is limited to one Indian army. */
export const INDIAN_ARMY_INDEPENDENCE_CAP = 1;

/**
 * The Indian-army ceiling: colonial manpower, or the printed one-army cap once
 * India is independent.  Exposed separately from `recruitmentLimits` so the
 * live build path can quote the same number the display shows.
 */
export const indianArmyCap = (G: ImperialElegyState): number =>
  G.powers.UK.indiaIndependent === true
    ? INDIAN_ARMY_INDEPENDENCE_CAP
    : Math.max(0, G.powers.UK.secondaryManpower ?? 0);

/** True when `space` is India after it gained independence (33.2.2). */
export const isIndependentIndia = (G: ImperialElegyState, space: SpaceId): boolean =>
  space === "india" && G.powers.UK.indiaIndependent === true;

/** True when a space holds units hostile to `power` (a displacement may not end there). */
export const spaceHasHostileUnits = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): boolean => unitsIn(G, space).some((unit) => hostileOwner(G, power, unit.owner));

/** Identity order, so every deterministic auto-pick is stable across saves. */
const byUnitId = (a: Unit, b: Unit): number => a.id.localeCompare(b.id, "en", {numeric: true});

/**
 * 5.7 / 33.2: the space an Indian army auto-displaces to.  The printed rule
 * names Bengal or India; when neither is legal the general displacement rule
 * (closest friendly controlled space with a LoC and no enemy units) applies.
 */
export const indianArmyDestination = (
  G: ImperialElegyState,
  from: SpaceId,
  power: Power = "UK",
): SpaceId | null => {
  // Only the UK's Indian armies have the printed Bengal/India destination.
  if (power === "UK") {
    for (const candidate of ["bengal", "india"] as SpaceId[]) {
      if (candidate === from) continue;
      if (G.spaces[candidate]?.control !== "UK") continue;
      if (spaceHasHostileUnits(G, "UK", candidate)) continue;
      return candidate;
    }
  }
  // General displacement fallback: deterministic breadth-first search for the
  // closest friendly, LoC-connected space without enemy units.
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next) || isNavalBox(next)) continue;
      seen.add(next);
      if (
        friendlySpace(G, next, power) &&
        !spaceHasHostileUnits(G, power, next) &&
        hasLoc(G, power, next)
      ) {
        return next;
      }
      queue.push(next);
    }
  }
  return null;
};

export interface IndianArmyDisplacement {
  unitId: string;
  from: SpaceId;
  /** Null when no legal destination exists and the army stays on the map. */
  to: SpaceId | null;
}

/**
 * 33.2: Indian armies auto-displace to Bengal or India at the end of a turn
 * and at the conclusion of a war the UK fought in.  Armies already in Bengal
 * or India stay where they are; the rest get one destination each.
 */
export const planIndianArmyDisplacement = (G: ImperialElegyState): IndianArmyDisplacement[] =>
  indianArmies(G)
    .sort(byUnitId)
    .filter((unit) => Boolean(unit.space) && unit.space !== "india" && unit.space !== "bengal")
    .map((unit) => {
      const from = unit.space as SpaceId;
      return {unitId: unit.id, from, to: indianArmyDestination(G, from)};
    });

export interface UnitDisplacement {
  unitId: string;
  to: SpaceId;
}

export interface IndiaIndependencePlan {
  /** 33.2.2: displacement is skipped when India gains independence during the GW. */
  displace: boolean;
  /** Land units in India with a legal friendly destination. */
  landDisplacements: UnitDisplacement[];
  /** Naval units in India moving to an adjacent box. */
  navalDisplacements: UnitDisplacement[];
  /** Units with nowhere legal to go; they are eliminated. */
  eliminatedUnitIds: string[];
  /** The one Indian army the UK keeps (null when it has none). */
  keepIndianArmyId: string | null;
  /** Every other Indian army, eliminated by the printed one-army limit. */
  eliminateIndianArmyIds: string[];
  /** The Indian Fort marker in India, removed by the sequence. */
  removeFort: boolean;
}

/**
 * 33.2.2: the full printed independence sequence as a pure plan.
 *
 * "Displace all units in India (skip this step if India gains independence
 * during the GW). The UK eliminates the Indian Fort and all their Indian
 * armies, except 1, and they are now limited to 1 Indian army for the
 * remainder of the game."
 *
 * The caller (`effects.ts#applyIndiaIndependence`) applies the plan and then
 * makes India uncontrolled; nothing here mutates G.
 */
export const planIndiaIndependence = (
  G: ImperialElegyState,
  options: {gw?: boolean} = {},
): IndiaIndependencePlan => {
  const gwActive = options.gw ?? G.gw?.active === true;
  const displace = !gwActive;
  const landDisplacements: UnitDisplacement[] = [];
  const navalDisplacements: UnitDisplacement[] = [];
  const eliminatedUnitIds: string[] = [];

  if (!displace) {
    const indian = indianArmies(G).sort(byUnitId);
    return {
      displace,
      landDisplacements,
      navalDisplacements,
      eliminatedUnitIds,
      keepIndianArmyId: indian[0]?.id ?? null,
      eliminateIndianArmyIds: indian.slice(1).map((unit) => unit.id),
      removeFort: Boolean(G.spaces.india?.fort),
    };
  }

  // Naval units displace to an adjacent box (5.7).  Prefer a box without
  // enemy naval units; fall back to the printed port box, then elimination.
  const portBoxesForIndia = SPACES.india?.ports ?? [];
  const navalBox = portBoxesForIndia.find((box) => !spaceHasHostileUnits(G, "UK", box)) ?? portBoxesForIndia[0] ?? null;
  for (const unit of unitsIn(G, "india").sort(byUnitId)) {
    if (unit.naval === true) {
      if (navalBox === null) eliminatedUnitIds.push(unit.id);
      else navalDisplacements.push({unitId: unit.id, to: navalBox});
      continue;
    }
    const owner = unit.owner;
    const to = isPower(owner) ? indianArmyDestination(G, "india", owner) : null;
    if (to === null) eliminatedUnitIds.push(unit.id);
    else landDisplacements.push({unitId: unit.id, to});
  }

  const indian = indianArmies(G).sort(byUnitId);
  return {
    displace,
    landDisplacements,
    navalDisplacements,
    eliminatedUnitIds,
    keepIndianArmyId: indian[0]?.id ?? null,
    eliminateIndianArmyIds: indian.slice(1).map((unit) => unit.id),
    removeFort: Boolean(G.spaces.india?.fort),
  };
};

/** 33.2 Rapid Deployment: whether the UK still holds its free naval action. */
export const rapidDeploymentGrant = (G: ImperialElegyState): RapidDeploymentGrant | null =>
  G.powers.UK.rapidDeployment ?? null;

export const canUseRapidDeployment = (G: ImperialElegyState, power: Power): boolean => {
  if (power !== "UK") return false;
  const grant = rapidDeploymentGrant(G);
  return grant !== null && grant.spent === false;
};

// ---------------------------------------------------------------------------
// 12.13 / 33.5 / 33.6 — industrialization
// ---------------------------------------------------------------------------

export interface IndustryRollOptions {
  /** If known, whose card is being played as the industrialization card. */
  cardOwner?: Power;
  cardId?: string;
}

export interface IndustryRollDecision {
  power: Power;
  cp: number;
  /** 5 normally; 6 for Agrarian Russia and Europeanization Ottomans. */
  target: 5 | 6;
  drm: number;
  /** Minimum natural die roll: target - CP - DRM. */
  rollNeeded: number;
  guaranteed: boolean;
  impossible: boolean;
  /** False when OT attempts to use one of their own cards. */
  allowed: boolean;
  allowsOwnCard: boolean;
  autoSuccess: boolean;
  source: "agrarian" | "europeanization" | "standard";
  reasons: string[];
}

/**
 * Industrialization roll target and restrictions.
 *
 * Success is `d6 + cp + industryDrm >= target`.  RU (Agrarian) and OT
 * (Europeanization) need a 6 after DRMs; OT additionally may not use their own
 * cards as the industrialization card.
 */
export const industryRoll = (
  G: ImperialElegyState,
  power: Power,
  cp: number,
  options: IndustryRollOptions = {},
): IndustryRollDecision => {
  const p = G.powers[power];
  const target: 5 | 6 = power === "RU" || power === "OT" ? 6 : 5;
  const source: IndustryRollDecision["source"] =
    power === "RU" ? "agrarian" : power === "OT" ? "europeanization" : "standard";
  const drm = Number(p.flags.industryDrm ?? 0);
  const autoSuccess = p.autoIndustry === true;
  const reasons: string[] = [];
  if (power === "RU") reasons.push("Agrarian: needs a 6 after DRMs");
  if (power === "OT") reasons.push("Europeanization: needs a 6 after DRMs and may not use an OT card");
  const allowsOwnCard = power !== "OT";
  const allowed = !(power === "OT" && options.cardOwner === "OT");
  if (!allowed) reasons.push("Ottoman own card cannot be used for industrialization");

  const rollNeeded = target - cp - drm;
  return {
    power,
    cp,
    target,
    drm,
    rollNeeded,
    guaranteed: autoSuccess || rollNeeded <= 1,
    impossible: !autoSuccess && rollNeeded > 6,
    allowed,
    allowsOwnCard,
    autoSuccess,
    source,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.4.1 — AU rights and full citizenship
// ---------------------------------------------------------------------------

export interface CitizenshipOptions {
  /** Spend 1 stability before rolling for +2 DRM. */
  sacrificeStability?: boolean;
  /** Extra difficulty from a card or scenario, if any. */
  extraDifficulty?: number;
}

export interface CitizenshipDecision {
  power: Power;
  nationality: string;
  allowed: boolean;
  reasons: string[];
  hasRights: boolean;
  alreadyCitizen: boolean;
  existingCitizenships: number;
  baseDifficulty: 3;
  difficulty: number;
  stabilitySacrificeAvailable: boolean;
  stabilityDrm: number;
  requiresStabilityLoss: boolean;
  /** Natural die roll needed (3+ by default, +1 per existing citizen, -2 for sacrifice). */
  rollNeeded: number;
  guaranteed: boolean;
  impossible: boolean;
}

/**
 * AU Expand Citizenship eligibility (33.4.1): the nationality must be one of
 * the eight, must already have rights, must not already be a full citizen, and
 * AU must not be under a "no citizenship this turn" effect.  The roll succeeds
 * on 3+, +1 difficulty per nationality that already has citizenship; AU may
 * trade 1 stability for +2 DRM before rolling.
 */
export const canGrantCitizenship = (
  G: ImperialElegyState,
  power: Power,
  nationality: string,
  options: CitizenshipOptions = {},
): CitizenshipDecision => {
  const p = G.powers[power];
  const reasons: string[] = [];
  const known = (AU_NATIONALITIES as readonly string[]).includes(nationality);
  const hasRights = p?.rights.includes(nationality) === true;
  const alreadyCitizen = p?.citizenship.includes(nationality) === true;
  const existingCitizenships = p?.citizenship.length ?? 0;

  if (power !== "AU") reasons.push("Only Austria-Hungary grants rights and citizenship");
  if (!known) reasons.push(`${nationality} is not one of the eight AU nationalities`);
  if (!hasRights) reasons.push(`${nationality} does not have rights yet`);
  if (alreadyCitizen) reasons.push(`${nationality} already has full citizenship`);
  if (auCitizenshipBlocked(G)) reasons.push("AU cannot grant citizenship or rights this turn");

  const sacrificeAvailable = Boolean(p) && p.stability > 0;
  const wantsSacrifice = options.sacrificeStability === true;
  const stabilityDrm = wantsSacrifice && sacrificeAvailable ? 2 : 0;
  if (wantsSacrifice && !sacrificeAvailable) reasons.push("AU has no stability to spend for the +2 DRM");

  const baseDifficulty = 3 as const;
  const difficulty = baseDifficulty + existingCitizenships + (options.extraDifficulty ?? 0);
  const rollNeeded = Math.max(1, difficulty - stabilityDrm);
  const allowed = reasons.length === 0;

  return {
    power,
    nationality,
    allowed,
    reasons,
    hasRights,
    alreadyCitizen,
    existingCitizenships,
    baseDifficulty,
    difficulty,
    stabilitySacrificeAvailable: sacrificeAvailable,
    stabilityDrm,
    requiresStabilityLoss: stabilityDrm > 0,
    rollNeeded,
    guaranteed: allowed && rollNeeded <= 1,
    impossible: allowed && rollNeeded > 6,
  };
};

// ---------------------------------------------------------------------------
// 33.4 — Metternich's Legacy / A Compromise Needed
// ---------------------------------------------------------------------------

export interface MetternichDecision {
  power: "AU";
  applies: boolean;
  consumed: boolean;
  candidates: SpaceId[];
  /** First two candidates; the caller applies them (no mutation here). */
  chosen: SpaceId[];
  remaining: SpaceId[];
  reasons: string[];
}

/**
 * Turn-1 diplomacy end: AU gains alliances with two eligible minor powers.
 * Candidates must be independent European minors with no opponent's diplomacy
 * marker and no existing ally; AU's own diplomacy marker is allowed.
 */
export const metternichAllies = (G: ImperialElegyState): MetternichDecision => {
  const consumed = Boolean(G.persistent.metternich);
  const reasons: string[] = [];
  const applies =
    !consumed &&
    !G.powers.AU.eliminated &&
    G.turn === 1 &&
    G.phase === "diplomacy";
  if (consumed) reasons.push("Metternich's Legacy already resolved");
  if (G.turn !== 1) reasons.push("Only applies on turn 1");
  if (G.phase !== "diplomacy") reasons.push("Only applies at the end of the diplomacy phase");

  const candidates = Object.values(SPACES)
    .filter((def) => {
      if (!def.minorHome) return false;
      if (def.region !== "europe") return false;
      if (def.minorHome === "United States" || def.minorHome === "Qing China") return false;
      const state = G.spaces[def.id];
      if (!state) return false;
      if (state.control !== def.minorHome) return false;
      if (state.ally !== null && state.ally !== undefined) return false;
      // "no opponent's diplomacy marker" — AU's own marker is fine.
      if (state.diplomacy !== null && state.diplomacy !== undefined && state.diplomacy !== "AU") return false;
      return true;
    })
    .map((def) => def.id);

  return {
    power: "AU",
    applies,
    consumed,
    candidates,
    chosen: candidates.slice(0, 2),
    remaining: candidates.slice(2),
    reasons,
  };
};

/**
 * 33.4 Metternich's Legacy: the printed choice is two minor powers *of the AU
 * player's choice*.  The live move (`moves.ts#chooseHomeCard` / `endDiplomacy`)
 * opens a `metternich` decision when more than two candidates are eligible; the
 * deterministic first-two list here is only the fallback when the board offers
 * no choice at all (zero or exactly two candidates, or an unattended decision).
 */
export const metternichChoiceCandidates = (G: ImperialElegyState): SpaceId[] =>
  metternichAllies(G).candidates;

export interface DualMonarchyDecision {
  power: "AU";
  active: boolean;
  turn: number;
  played: boolean;
  inHand: boolean;
  /** During turn 2 prep: add the card if it was not played on turn 1. */
  shouldAddToHand: boolean;
  windowOpen: boolean;
  event: {
    card: string;
    stability: 1;
    citizenship: "Hungarians";
    persistentFlag: "dualMonarchy";
  };
  reasons: string[];
}

/**
 * A Compromise Needed (33.4): add The Dual Monarchy to AU's hand in the turn-2
 * prep phase if it was not played on turn 1.  Also exposes the card's event
 * payload (stability +1, Hungarians gain full citizenship).
 */
export const dualMonarchy = (G: ImperialElegyState): DualMonarchyDecision => {
  const p = G.powers.AU;
  const played = Boolean(G.persistent.dualMonarchyPlayed || G.persistent.dualMonarchy);
  const inHand = p.hand.includes(DUAL_MONARCHY_CARD);
  const windowOpen = G.turn === 2 && G.phase === "prep";
  const shouldAddToHand = windowOpen && !played && !inHand && !p.eliminated;
  const reasons: string[] = [];
  if (G.turn !== 2) reasons.push("The compromise window is the turn-2 prep phase");
  if (played) reasons.push("The Dual Monarchy was already played");
  if (inHand) reasons.push("The Dual Monarchy is already in hand");
  if (windowOpen) reasons.push("Turn-2 prep: add the card only if it was not played on turn 1");
  return {
    power: "AU",
    active: !p.eliminated,
    turn: G.turn,
    played,
    inHand,
    shouldAddToHand,
    windowOpen,
    event: {
      card: DUAL_MONARCHY_CARD,
      stability: 1,
      citizenship: "Hungarians",
      persistentFlag: "dualMonarchy",
    },
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 12.0 — a card that forbids passing must never softlock the impulse
// ---------------------------------------------------------------------------

/** GW #10 Exhaustion (27.3): the holder may not pass until it is played. */
export const EXHAUSTION_CARD = "IE-GW-10";

/** Cards whose printed special forbids passing while they are held. */
export const PASS_FORBIDDING_CARDS: readonly string[] = [DUAL_MONARCHY_CARD, EXHAUSTION_CARD];

export interface PassRestrictionCard {
  card: string;
  /** Rule text that makes the card unpassable. */
  rule: "A047" | "GW-10";
}

export interface PassRestriction {
  power: Power;
  /** True when the hand holds a card whose special forbids passing. */
  forced: boolean;
  /** The offending cards, in hand order. */
  cards: PassRestrictionCard[];
  /**
   * Rule 12.0 *also* caps the hand a player may pass with ("zero or one card,
   * two for the UK").  When a forced card is present that cap is the only
   * thing standing between the player and an unwinnable impulse: the card
   * cannot be passed and it must be played, so paying its CP is the legal
   * escape.  The engine requires CP to be spent first and refuses `pass`
   * until then, which turns a rules interaction into a dead table.
   */
  cpRequired: boolean;
  reasons: string[];
}

const forcedCard = (id: string): PassRestrictionCard | null => {
  if (id === DUAL_MONARCHY_CARD) return {card: id, rule: "A047"};
  if (id === EXHAUSTION_CARD) return {card: id, rule: "GW-10"};
  return null;
};

/**
 * Why a power may or may not pass right now.
 *
 * Pure decision helper: the caller (`moves.pass` / `moves.gwPass` and the UI)
 * decides what to do with it.  `forced` is the card-level prohibition printed
 * on A047 and GW-10; `cpRequired` is the matching engine requirement, so the
 * player can always leave a forced impulse by playing the card for CP.
 */
export const passRestriction = (G: ImperialElegyState, power: Power, hand?: readonly string[]): PassRestriction => {
  const cards = (hand ?? G.powers[power].hand)
    .map(forcedCard)
    .filter((c): c is PassRestrictionCard => c !== null);
  const reasons: string[] = [];
  if (cards.some((c) => c.rule === "A047")) reasons.push("The Dual Monarchy (A047) cannot be passed");
  if (cards.some((c) => c.rule === "GW-10")) reasons.push("Exhaustion (GW-10) cannot be passed");
  return {
    power,
    forced: cards.length > 0,
    cards,
    cpRequired: cards.length > 0,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.3 — French government benefits
// ---------------------------------------------------------------------------

export interface GovernmentBenefits {
  power: Power;
  government: PowerState["government"] | null;
  /** Second Empire: +1 CP added after the war/GW budget is calculated. */
  warBudgetBonus: number;
  /** Third Republic: 2 free CP at the start of the alliance resolution step. */
  allianceTrackCp: number;
  /** The Republic switch is legal (not during the GW). */
  canSwitchToRepublic: boolean;
}

/** FR government abilities, kept separate from the stability-loss decision. */
export const governmentBenefits = (G: ImperialElegyState, power: Power): GovernmentBenefits => {
  const p = G.powers[power];
  const isFR = power === "FR";
  const government = isFR ? p.government ?? null : null;
  return {
    power,
    government,
    warBudgetBonus: isFR && government === "secondEmpire" ? 1 : 0,
    allianceTrackCp: isFR && government === "thirdRepublic" ? 2 : 0,
    canSwitchToRepublic: isFR && government === "secondEmpire" && !G.gw?.active,
  };
};

// ---------------------------------------------------------------------------
// 33.1 / 33.4 — pacification action cost
// ---------------------------------------------------------------------------

export type PacificationCostSource = "continentalPower" | "continentalFocus";

export interface PacificationCostDecision {
  power: Power;
  cost: number;
  sources: PacificationCostSource[];
  reasons: string[];
}

/**
 * Printed pacification costs: AU's Continental Power is always 2 CP, and GE's
 * Continental Focus is 2 CP until Germany unifies.  Everything else is the
 * standard 1 CP.
 */
export const pacificationCost = (G: ImperialElegyState, power: Power): PacificationCostDecision => {
  const sources: PacificationCostSource[] = [];
  const reasons: string[] = [];
  if (power === "AU") {
    sources.push("continentalPower");
    reasons.push("Continental Power: pacification actions cost 2 CP");
  }
  if (power === "GE" && G.powers.GE.unified !== true) {
    sources.push("continentalFocus");
    reasons.push("Continental Focus: pacification costs 2 CP until Germany unifies");
  }
  return {power, cost: sources.length > 0 ? 2 : 1, sources, reasons};
};

export type PacificationModifierSource = "zouaves" | "eliteColonialEf";

export interface PacificationModifier {
  power: Power;
  space: SpaceId;
  drm: number;
  sources: PacificationModifierSource[];
  reasons: string[];
}

/**
 * 33.3 The Zouaves / A78 Crack Colonial Troops: an elite colonial unit in the
 * space adds +1 to its owner's pacification roll.  The Zouaves are France's
 * unique elite colonial EF; the A78 elite colonial EF is the generic one.
 * Only the pacifying power's own units count.
 */
export const pacificationModifier = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): PacificationModifier => {
  const own = landUnitsIn(G, space).filter((unit) => unit.owner === power);
  const sources: PacificationModifierSource[] = [];
  const reasons: string[] = [];
  if (own.some((unit) => unit.kind === "zouave")) {
    sources.push("zouaves");
    reasons.push("Zouaves: +1 pacification DRM");
  }
  if (own.some((unit) => unit.kind === "eliteColonialEf")) {
    sources.push("eliteColonialEf");
    reasons.push("Elite colonial EF: +1 pacification DRM");
  }
  return {power, space, drm: sources.length, sources, reasons};
};

// ---------------------------------------------------------------------------
// 33.1 — German characteristics
// ---------------------------------------------------------------------------

/** The NG card 33.1 Blood and Iron! searches for (playbook: GE Unification #8). */
export const GE_UNIFICATION_GOAL = "NG-08";

/** 33.1 German Confederation: the only minor powers GE may annex. */
export const GERMAN_CONFEDERATION_MINORS = ["Bavaria", "Saxony", "Hanover"] as const;

export interface GermanConfederationCandidate {
  minor: string;
  space: SpaceId;
}

/**
 * 33.1 German Confederation: "After GE wins a war of unification, they may take
 * control of one of their German minor allies (including one they just gained
 * through the realignment treaty option)."  A candidate is a named German
 * minor that still controls its home space and is allied to GE.
 */
export const germanConfederationCandidates = (
  G: ImperialElegyState,
): GermanConfederationCandidate[] => {
  const candidates: GermanConfederationCandidate[] = [];
  for (const minor of GERMAN_CONFEDERATION_MINORS) {
    const space = minor.toLowerCase();
    const state = G.spaces[space];
    if (!state || state.control !== minor) continue;
    if (state.ally !== "GE") continue;
    if (G.eliminatedMinors?.includes(minor) === true) continue;
    candidates.push({minor, space});
  }
  return candidates;
};

/**
 * 33.1 German Confederation: "Whenever GE takes control of a German unification
 * space it becomes a permanent home space."  A German unification space is any
 * space flashing for Germany (33.1.1).  The stamp is one-way: a permanent home
 * space stays GE's home even if the space later changes hands.  Idempotent, so
 * every control-changing settlement (annexation, treaty, conquest, GW capture)
 * can call it, and `recomputeTracks` sweeps it once per recomputation.
 * Returns the spaces newly stamped.
 */
export const applyGermanConfederationHomeOverrides = (G: ImperialElegyState): SpaceId[] => {
  const stamped: SpaceId[] = [];
  if (G.powers.GE.eliminated) return stamped;
  for (const def of Object.values(SPACES)) {
    if (def.flashpoints?.includes("germany") !== true) continue;
    // A space already printed as a GE home needs no override.
    if (def.home === "GE") continue;
    const state = G.spaces[def.id];
    if (!state) continue;
    if (state.control !== "GE") continue;
    if (state.homeOverride === "GE") continue;
    state.homeOverride = "GE";
    stamped.push(def.id);
  }
  return stamped;
};

/**
 * 33.1 Superior Staff Work: "During GE's first impulse of a war or the GW, they
 * may conduct one free deploy reserves action."  The limited-war half is
 * available during GE's first maneuver impulse and forfeited when that impulse
 * ends (GE first passes).
 */
export const superiorStaffWorkFreeDeploy = (
  G: ImperialElegyState,
  power: Power,
  war: WarState | null = G.war,
): boolean => {
  if (power !== "GE" || war === null || G.gw?.active) return false;
  if (war.status !== "maneuver") return false;
  const p = G.powers.GE;
  if (!p || p.eliminated) return false;
  if (p.flags.superiorStaffWorkUsed === true) return false;
  if (war.passed.includes("GE")) return false;
  return (
    war.attacker === "GE" ||
    war.defender === "GE" ||
    war.attackerAllies.includes("GE") ||
    war.defenderAllies.includes("GE")
  );
};

/**
 * 33.1 Superior Staff Work, Great War half.
 *
 * "During GE's first impulse of ... the GW" is GE's first maneuver impulse in
 * GW turn 0, not any later impulse of that turn.  The impulse is identified by
 * `gwImpulseKey` (`turn:slot:power`); the first key seen while GE is active is
 * latched by `markSuperiorStaffWorkGwImpulse` before this helper is consulted,
 * so the free deploy is only offered while that same impulse is current.  A GE
 * that enters the war later does not receive the grant (turn 0 only).
 */
export const gwImpulseKey = (G: ImperialElegyState): string =>
  `${G.gw?.turn ?? 0}:${G.turnIndex}:${G.activePower}`;

/**
 * Latch GE's first GW maneuver impulse.  Called by the live GW moves before
 * they consult `superiorStaffWorkGwFreeDeploy`; deterministic because the first
 * call is always made inside GE's first active impulse of GW turn 0.
 */
export const markSuperiorStaffWorkGwImpulse = (G: ImperialElegyState): void => {
  if (!G.gw?.active || G.gw.turn !== 0) return;
  if (G.activePower !== "GE") return;
  const p = G.powers.GE;
  if (!p || p.eliminated) return;
  if (typeof p.flags.superiorStaffWorkGwFirst === "string") return;
  p.flags.superiorStaffWorkGwFirst = gwImpulseKey(G);
};

export const superiorStaffWorkGwFreeDeploy = (G: ImperialElegyState): boolean => {
  if (!G.gw?.active || G.gw.turn !== 0) return false;
  if (G.activePower !== "GE") return false;
  const p = G.powers.GE;
  if (!p || p.eliminated) return false;
  if (!G.gw.belligerents.includes("GE")) return false;
  if (p.flags.superiorStaffWorkGwUsed === true) return false;
  // Only the latched first impulse of GW turn 0 grants the free action.  It may
  // be the impulse's second action: 15.2 explicitly allows a characteristic's
  // free action (such as this one) in addition to the paid action.
  return p.flags.superiorStaffWorkGwFirst === gwImpulseKey(G);
};

// ---------------------------------------------------------------------------
// 33.3 — Cultural Symbol (City of Light)
// ---------------------------------------------------------------------------

/** FR private flag: this Paris-occupied episode already cost its point. */
export const CULTURAL_SYMBOL_EPISODE = "culturalSymbolEpisode";

/** Rule 5.5 / 15.3: Paris is occupied by a power at war with France. */
export const parisEnemyOccupied = (G: ImperialElegyState): boolean => {
  const occupant = G.spaces.paris?.occupiedBy ?? null;
  if (occupant === null || occupant === undefined) return false;
  return hostileOwner(G, "FR", occupant);
};

/** Paris can only be occupied "in wartime" (15.3 only stamps the marker then). */
export const parisOccupationWartime = (G: ImperialElegyState): boolean =>
  G.war !== null || G.gw?.active === true;

export interface CulturalSymbolLoss {
  power: "FR";
  /** An enemy occupies Paris right now and the game is at war. */
  applies: boolean;
  /** The episode already cost a point (one loss per occupation). */
  alreadyLost: boolean;
  wartime: boolean;
  /** City of Light points before / after the loss. */
  points: number;
  next: number;
  lost: number;
  reasons: string[];
}

/**
 * 33.3 Cultural Symbol: "Reduce the FR player's City of Light points by 1 when
 * Paris is occupied by an enemy power in wartime.  This can happen multiple
 * times per game."  One point per occupation episode: the private
 * `culturalSymbolEpisode` marker is cleared as soon as Paris is no longer
 * enemy-occupied, so a liberation and later re-occupation cost another point.
 */
export const culturalSymbolLoss = (G: ImperialElegyState): CulturalSymbolLoss => {
  const p = G.powers.FR;
  const reasons: string[] = [];
  const points = p.cityOfLight ?? 0;
  const occupied = parisEnemyOccupied(G);
  const wartime = parisOccupationWartime(G);
  const alreadyLost = p.flags[CULTURAL_SYMBOL_EPISODE] === true;
  if (p.eliminated) reasons.push("France is eliminated");
  if (!occupied) reasons.push("Paris is not occupied by an enemy power");
  if (occupied && !wartime) reasons.push("Paris is only counted during wartime");
  if (alreadyLost) reasons.push("This occupation already reduced City of Light");
  const applies = !p.eliminated && occupied && wartime && !alreadyLost;
  const lost = applies ? Math.min(1, Math.max(0, points)) : 0;
  return {
    power: "FR",
    applies,
    alreadyLost,
    wartime,
    points,
    next: Math.max(0, points - lost),
    lost,
    reasons,
  };
};

/**
 * Apply the 33.3 Cultural Symbol loss (idempotent per occupation episode).
 * Returns the points actually lost.  Called from the live occupation seams
 * (`rules.ts#recordOccupation` for marches/redeployments, `moves.ts` after a
 * battle or battle decision resolves).
 */
export const settleCulturalSymbolLoss = (G: ImperialElegyState): number => {
  const p = G.powers.FR;
  if (!p) return 0;
  if (!parisEnemyOccupied(G)) {
    // A liberation (or the end of the occupation) closes the episode.
    delete p.flags[CULTURAL_SYMBOL_EPISODE];
    return 0;
  }
  const decision = culturalSymbolLoss(G);
  if (!decision.applies) return 0;
  p.flags[CULTURAL_SYMBOL_EPISODE] = true;
  if (decision.points <= 0) return 0;
  p.cityOfLight = decision.next;
  return decision.lost;
};

// ---------------------------------------------------------------------------
// 33.3 — FR Napoleon's Legacy
// ---------------------------------------------------------------------------

/** The revealable FR National Goal. */
export const NAPOLEONS_LEGACY_GOAL = "NG-24";

export interface NapoleonsLegacyDecision {
  power: "FR";
  /** FR holds the goal in its (private) goal hand. */
  held: boolean;
  /** The goal is public/faceup. */
  revealed: boolean;
  /** This declaration is a war of conquest by FR. */
  applies: boolean;
  /** Offer the reveal choice now (held, not yet revealed, launching a conquest). */
  offerReveal: boolean;
  /** Stability-loss reduction for the declaration. */
  discount: number;
  reasons: string[];
}

/**
 * 33.3 Napoleon's Legacy: "You may reveal this National Goal when you launch a
 * war of conquest; while revealed, reduce your stability loss for declaring
 * wars of conquest by 2 (you still increase the WTT by 1)."
 */
export const napoleonsLegacyDecision = (
  G: ImperialElegyState,
  power: Power,
  aim: string,
): NapoleonsLegacyDecision => {
  const held = G.powers.FR.goals.includes(NAPOLEONS_LEGACY_GOAL);
  const revealed = G.revealedGoals?.includes(NAPOLEONS_LEGACY_GOAL) === true;
  const applies = power === "FR" && aim === "conquest";
  const reasons: string[] = [];
  if (power !== "FR") reasons.push("Only France can reveal Napoleon's Legacy");
  if (aim !== "conquest") reasons.push("The goal is revealed only when launching a war of conquest");
  if (!held) reasons.push("France does not hold Napoleon's Legacy");
  if (revealed) reasons.push("Napoleon's Legacy is already revealed");
  return {
    power: "FR",
    held,
    revealed,
    applies,
    offerReveal: applies && held && !revealed,
    discount: applies && revealed ? 2 : 0,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.4.1 — AU Reforms / Incorporate
// ---------------------------------------------------------------------------

export interface AuRightsDecision {
  power: "AU";
  nationality: string;
  allowed: boolean;
  alreadyRights: boolean;
  alreadyCitizen: boolean;
  reasons: string[];
}

/** AU Reforms (3 CP): grant one eligible nationality its rights (33.4.1). */
export const auRightsDecision = (G: ImperialElegyState, nationality: string): AuRightsDecision => {
  const p = G.powers.AU;
  const known = (AU_NATIONALITIES as readonly string[]).includes(nationality);
  const hasRights = p.rights.includes(nationality);
  const alreadyCitizen = p.citizenship.includes(nationality);
  const reasons: string[] = [];
  if (!known) reasons.push(`${nationality} is not one of the eight AU nationalities`);
  if (hasRights) reasons.push(`${nationality} already has rights`);
  if (alreadyCitizen) reasons.push(`${nationality} already has full citizenship`);
  if (auCitizenshipBlocked(G)) reasons.push("AU cannot grant citizenship or rights this turn");
  return {
    power: "AU",
    nationality,
    allowed: reasons.length === 0,
    alreadyRights: hasRights,
    alreadyCitizen,
    reasons,
  };
};

export interface AuIncorporateDecision {
  power: "AU";
  space: SpaceId;
  allowed: boolean;
  minor: string | null;
  nationality: string | null;
  reasons: string[];
}

/**
 * AU Incorporate (3 CP, 33.4): take control of a minor power that is allied to
 * AU and has a nationality with full citizenship.  The caller applies the
 * control transfer and removes the minor's units.
 */
export const auIncorporateDecision = (G: ImperialElegyState, space: SpaceId): AuIncorporateDecision => {
  const p = G.powers.AU;
  const state = G.spaces[space];
  const reasons: string[] = [];
  const control = state?.control ?? null;
  const isMinor = control !== null && typeof control === "string" && !(POWERS as readonly string[]).includes(control);
  const minor = isMinor ? (control as string) : null;
  if (!state) reasons.push("Unknown space");
  else if (!isMinor) reasons.push("Incorporate targets an allied minor power, not a player-controlled space");
  if (state && state.ally !== "AU") reasons.push("The minor power must be allied to Austria-Hungary");
  const nationalities = spaceNationalities(space);
  const nationality = nationalities.find((n) => p.citizenship.includes(n)) ?? null;
  if (minor !== null && nationality === null) {
    reasons.push("The minor power needs a nationality with full AU citizenship");
  }
  return {
    power: "AU",
    space,
    allowed: state !== undefined && reasons.length === 0,
    minor,
    nationality,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.3 — FR Second Empire becomes the Third Republic after a lost war
// ---------------------------------------------------------------------------

export interface FrLostWarDecision {
  power: "FR";
  /** FR was a belligerent on the losing side of the settled war. */
  applies: boolean;
  side: BattleSide | null;
  victor: "attacker" | "defender" | null;
  government: PowerState["government"] | null;
  reasons: string[];
}

const warSideOf = (war: WarState, power: Power): BattleSide | null => {
  if (war.attacker === power || war.attackerAllies.includes(power)) return "attacker";
  if (war.defender === power || war.defenderAllies.includes(power)) return "defender";
  return null;
};

/**
 * FR lost a war (33.3): outside the GW the Second Empire immediately becomes the
 * Third Republic.  The caller routes the switch through `changeStability` with
 * `{lostWar: true}` so there is a single implementation of the transition.
 */
export const frLostWar = (G: ImperialElegyState, war: WarState | null): FrLostWarDecision => {
  const government = G.powers.FR.government ?? null;
  const side = war === null ? null : warSideOf(war, "FR");
  const victor = war?.victor ?? null;
  const reasons: string[] = [];
  const lost = side !== null && victor !== null && victor !== side;
  if (G.gw?.active) reasons.push("The government switch cannot happen during the Great War");
  if (government !== "secondEmpire") reasons.push("France is not the Second Empire");
  if (war === null) reasons.push("No war was settled");
  else if (side === null) reasons.push("France was not a belligerent");
  else if (victor === null) reasons.push("The war ended in a white peace");
  else if (!lost) reasons.push("France was on the winning side");
  return {
    power: "FR",
    applies: lost && !G.gw?.active && government === "secondEmpire",
    side,
    victor,
    government,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.3 — Third Republic alliance-track CP
// ---------------------------------------------------------------------------

export interface ThirdRepublicCpDecision {
  power: "FR";
  applies: boolean;
  cp: number;
  /** Turn already granted, if any. */
  grantedTurn: number | null;
  reasons: string[];
}

/**
 * The Third Republic gains 2 free CP at the beginning of the alliance
 * resolution step, once per turn (33.3).  `G.flags.frAllianceCpTurn` records the
 * grant; the alliance-track spender is `moves.placeMpit`.
 */
export const thirdRepublicCp = (G: ImperialElegyState): ThirdRepublicCpDecision => {
  const grantedTurn = typeof G.flags.frAllianceCpTurn === "number" ? G.flags.frAllianceCpTurn : null;
  const applies =
    G.powers.FR.government === "thirdRepublic" &&
    !G.powers.FR.eliminated &&
    grantedTurn !== G.turn;
  const reasons: string[] = [];
  if (G.powers.FR.government !== "thirdRepublic") reasons.push("France is not the Third Republic");
  if (grantedTurn === G.turn) reasons.push("The Third Republic bonus was already granted this turn");
  return {power: "FR", applies, cp: applies ? 2 : 0, grantedTurn, reasons};
};

// ---------------------------------------------------------------------------
// 33.5 — Trans-Siberian Railroad rail move
// ---------------------------------------------------------------------------

export interface TsrrRailDecision {
  power: Power;
  unitId: string;
  from: SpaceId | null;
  to: SpaceId;
  allowed: boolean;
  route: readonly SpaceId[];
  reasons: string[];
}

/** A stable id for the current impulse, used to gate the once-per-impulse rail. */
export const tsrrImpulseKey = (G: ImperialElegyState): string =>
  `${G.turn}:${G.phase}:${G.gw?.turn ?? "-"}:${G.activePower}`;

/** True when `power` is a belligerent on the same side as RU in the live war. */
const ruAllyAtWar = (G: ImperialElegyState, power: Power): boolean => {
  const war = G.war;
  if (!war) return false;
  const ruSide = warSideOf(war, "RU");
  if (ruSide === null) return false;
  return warSideOf(war, power) === ruSide;
};

/**
 * 33.5 rails an **existing** army counter along the railroad; the publishers
 * print no "railroad army" unit.  The RU "Special" counter on the 4.2 chart
 * (`counters.ts#RU_TSRR_MARKER_COUNTERS`) is the TSRR completion marker, and
 * this move never creates a counter.  Reserve armies are army counters too
 * (5.1.2: "Reserve armies function identically to standing armies except..."),
 * so both kinds may be the one army railed per impulse.
 */
export const TSRR_RAIL_ARMY_KINDS: readonly UnitKind[] = ["army", "reserveArmy"];

/**
 * Trans-Siberian Railroad (33.5): RU (and RU's allies during wartime) may rail
 * one army along the railroad per impulse.  The route spaces carry the printed
 * railroad connection (`constant/spaces.ts#TSRR_ROUTE`).
 *
 * This is a *movement allowance*, not a unit type: the move relocates an
 * existing army counter and its owner keeps that counter.  The allowance is
 * cleared at every impulse boundary by `moves.clearActionImpulseSpend` /
 * `clearWarImpulseSpend`, so a player who gets another impulse can rail again
 * (4.5).  In the Great War the printed rail action [27.5 + 15.2.5] is handled
 * by the GW flow (`engine/greatWarFlow.ts`), where RU may traverse the TSRR
 * connections; this free per-impulse move is only the limited-war/action
 * allowance.
 */
export const tsrrRail = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): TsrrRailDecision => {
  const unit = G.units[unitId];
  const from = unit?.space ?? null;
  const reasons: string[] = [];
  if (G.powers.RU.tsrr !== true) reasons.push("The Trans-Siberian Railroad is not complete");
  if (power !== "RU" && !(G.phase === "wartime" && ruAllyAtWar(G, power))) {
    reasons.push("Only Russia (and its allies during wartime) may use the railroad");
  }
  if (G.phase !== "action" && G.phase !== "wartime") {
    reasons.push("The TSRR army allowance applies to action-phase and wartime impulses");
  }
  if (!unit || unit.owner !== power) reasons.push("The unit is not owned by this power");
  else if (!TSRR_RAIL_ARMY_KINDS.includes(unit.kind)) reasons.push("Only one army may be railed");
  if (G.powers[power].flags.tsrrRailImpulse === tsrrImpulseKey(G)) {
    reasons.push("The railroad move was already used this impulse");
  }
  if (from === null) reasons.push("The army is not on the map");
  else if (!TSRR_ROUTE.includes(from) || !TSRR_ROUTE.includes(to)) {
    reasons.push("Both ends of the rail move must be on the Trans-Siberian Railroad");
  }
  if (from === to) reasons.push("The army must move to a different railroad space");
  const friendlyDestination =
    friendlySpace(G, to, power) ||
    (G.phase === "wartime" &&
      ruAllyAtWar(G, power) &&
      (G.spaces[to]?.control === "RU" || G.spaces[to]?.occupiedBy === "RU"));
  if (G.spaces[to] && !friendlyDestination) reasons.push("The railroad destination must be friendly");
  return {
    power,
    unitId,
    from,
    to,
    allowed: reasons.length === 0,
    route: TSRR_ROUTE,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.6 — Jihad markers in battle
// ---------------------------------------------------------------------------

export interface JihadUseDecision {
  power: "OT";
  allowed: boolean;
  markers: number;
  /** The side that suffers the -1 DRM. */
  opponent: Power | null;
  /** The battle side the opponent is on. */
  opponentSide: BattleSide | null;
  reasons: string[];
}

/**
 * OT may discard one Jihad marker in an OT home / Caucasus / Great Game battle
 * to give the opponent -1 (33.6).  The caller decrements `OT.jihad` and applies
 * the DRM to the opponent's recorded battle modifier.
 */
export const jihadUse = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState | null,
): JihadUseDecision => {
  const reasons: string[] = [];
  if (power !== "OT") reasons.push("Only the Ottoman player uses Jihad markers");
  if (battle === null) reasons.push("No battle is in progress");
  else if (battle.kind !== "land") reasons.push("Jihad markers only modify land battles");
  if (battle !== null && (battle.attacker !== power && battle.defender !== power)) {
    reasons.push("The Ottomans are not a belligerent in this battle");
  }
  if (battle !== null && battle.attackerRoll !== undefined) reasons.push("The dice have already been rolled");
  if (battle !== null && battle.jihadUsed === true) reasons.push("Jihad was already used in this battle");
  let opponent: Power | null = null;
  let opponentSide: BattleSide | null = null;
  if (battle !== null && !reasons.includes("The Ottomans are not a belligerent in this battle")) {
    opponent = battle.attacker === power ? battle.defender : battle.attacker;
    opponentSide = battle.attacker === power ? "defender" : "attacker";
  }
  const decision = battle === null ? null : landBattleModifier(G, power, battle).jihad;
  if (decision !== null && !decision.available) {
    reasons.push("No Jihad marker is available for this battle");
  }
  return {
    power: "OT",
    allowed: reasons.length === 0,
    markers: G.powers.OT.jihad ?? 0,
    opponent,
    opponentSide,
    reasons,
  };
};

// ---------------------------------------------------------------------------
// 33.5 — The Second Rome
// ---------------------------------------------------------------------------

export interface SecondRomeDecision {
  power: "RU";
  applies: boolean;
  side: BattleSide | null;
  victor: "attacker" | "defender" | null;
  istanbulHeld: boolean;
  reasons: string[];
}

/**
 * The Second Rome (33.5): if RU occupies Istanbul at the end of a war it won,
 * RU automatically takes control of the space.  The caller applies the control
 * change; the OT capital move to Ankara is returned as a flag for the caller.
 */
export const secondRome = (G: ImperialElegyState, war: WarState | null): SecondRomeDecision => {
  const state = G.spaces.istanbul;
  const istanbulHeld = state !== undefined && (state.occupiedBy === "RU" || state.control === "RU");
  const side = war === null ? null : warSideOf(war, "RU");
  const victor = war?.victor ?? null;
  const reasons: string[] = [];
  const won = side !== null && victor !== null && victor === side;
  if (war === null) reasons.push("No war was settled");
  else if (side === null) reasons.push("Russia was not a belligerent");
  else if (victor === null) reasons.push("The war ended in a white peace");
  else if (!won) reasons.push("Russia was on the losing side");
  if (!istanbulHeld) reasons.push("Russia does not occupy Istanbul");
  return {
    power: "RU",
    applies: won && istanbulHeld,
    side,
    victor,
    istanbulHeld,
    reasons,
  };
};
