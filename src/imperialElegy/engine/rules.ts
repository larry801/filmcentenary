import {Ctx} from "boardgame.io";
import {
  AllianceBox,
  CardId,
  GwSide,
  ImperialElegyState,
  KeyType,
  PendingDecision,
  Power,
  POWERS,
  PowerOrMinor,
  SpaceId,
  Unit,
} from "../types";
import {POWER_DEFS, FLASHPOINTS, StabilityEffect} from "../constant/powers";
import {auNewWayForwardGranted} from "./nationality";
import {
  applyGermanConfederationHomeOverrides,
  cardDrawModifier,
  settleCulturalSymbolLoss,
  stabilityLoss,
  StabilityCause,
} from "./characteristics";
import {
  CONNECTIONS,
  SPACES,
  connectionsOf,
  isKey,
  isNavalBox,
  neighboursOf,
  portBoxes,
  spaceLabel,
} from "../constant/spaces";
import {CAMPAIGN_SETUP, MINOR_POWER_HOMES} from "../constant/setup";
import {cardById, discardCard} from "./deck";
import {decision, openDecision} from "./pending";

export const die = (ctx: Ctx, sides: number): number => ctx.random!.Die(sides);

export const POWER_ORDER: Record<Power, number> = {GE: 0, UK: 1, FR: 2, AU: 3, RU: 4, OT: 5};

export const isPower = (value: unknown): value is Power =>
  typeof value === "string" && (POWERS as readonly string[]).includes(value);

export const unitById = (G: ImperialElegyState, id: string): Unit | undefined => G.units[id];

export const unitsIn = (G: ImperialElegyState, space: SpaceId): Unit[] =>
  (G.spaces[space]?.units ?? []).map((id) => G.units[id]).filter((u): u is Unit => u !== undefined);

export const landUnitsIn = (G: ImperialElegyState, space: SpaceId): Unit[] =>
  unitsIn(G, space).filter((u) => !u.naval);

export const navalUnitsIn = (G: ImperialElegyState, space: SpaceId): Unit[] =>
  unitsIn(G, space).filter((u) => u.naval);

export const unitsOfPower = (G: ImperialElegyState, power: PowerOrMinor): Unit[] =>
  Object.values(G.units).filter((u) => u.owner === power);

export const unitName = (kind: string): string => {
  switch (kind) {
    case "army": return "army";
    case "reserveArmy": return "reserve army";
    case "eliteCorps": return "elite corps";
    case "expeditionary": return "expeditionary force";
    case "eliteColonialEf": return "elite colonial EF";
    case "zouave": return "Zouaves";
    case "squadron": return "squadron";
    case "dreadnought": return "dreadnought";
    case "rebelArmy": return "rebel army";
    default: return kind;
  }
};

export const isArmyKind = (kind: string): boolean =>
  ["army", "reserveArmy", "minorArmy", "italianArmy", "usArmy", "rebelArmy"].includes(kind);

export const isEliteKind = (kind: string): boolean => ["eliteCorps", "zouave", "eliteColonialEf"].includes(kind);

export const isNavalKind = (kind: string): boolean => ["squadron", "dreadnought"].includes(kind);

export const controlledBy = (G: ImperialElegyState, space: SpaceId, power: Power): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.control === power) return true;
  // Minor allies count for flashpoint domination (3.3) but not for keys.
  if (state.control !== null && state.control !== undefined && !isPower(state.control)) {
    return state.ally === power;
  }
  return false;
};

/** Control for key counting, manpower and NGs. Minor allies never count. */
export const ownsKey = (G: ImperialElegyState, space: SpaceId, power: Power): boolean =>
  G.spaces[space]?.control === power;

export const isHomeSpace = (G: ImperialElegyState, space: SpaceId, power: Power): boolean => {
  const def = SPACES[space];
  if (!def) return false;
  if (G.spaces[space]?.homeOverride === power) return true;
  if (def.home === power) return true;
  if (def.minorHome !== null && def.minorHome !== undefined && def.home === power) return true;
  // A GE unification space becomes a permanent home space.
  return def.flashpoints?.includes("germany") === true && G.spaces[space]?.control === power && G.powers.GE.unified === true;
};

export const germanHomeSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES).filter((s) => s.home === "GE" || (s.flashpoints?.includes("germany") && G.powers.GE.unified)).map((s) => s.id);

export const italianKeys = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy") || s.home === "AU" && s.id === "lombardy").map((s) => s.id);

/** 22.2/22.4: the printed Italian unification spaces, in map order. */
export const italianUnificationSpaces = (): SpaceId[] =>
  Object.values(SPACES)
    .filter((s) => s.flashpoints?.includes("italy") === true)
    .map((s) => s.id);

/** 22.4: where a unified Italy's standing army and naval units redeploy. */
export interface ItalianRedeployPlan {
  /** 22.4: "one Italian standing army is placed in Rome". */
  rome: SpaceId;
  /** Up to two Italian spaces adjacent to player-controlled spaces. */
  adjacent: SpaceId[];
  /** "Naples or Piedmont if Naples is not Italian controlled." */
  naval: SpaceId | null;
}

/**
 * 22.4 Italian Military: "When Italy redeploys, one Italian standing army is
 * placed in Rome and the other two Italian standing armies are placed in spaces
 * that are adjacent to player controlled spaces (usually Piedmont and
 * Lombardy).  If there are two such spaces, place an Italian army in each
 * space.  Italian naval units are always placed in Naples or Piedmont if Naples
 * is not Italian controlled."
 *
 * The plan is pure and deterministic: the Italian unification spaces are read
 * in printed map order (Piedmont, Lombardy, Tuscany, Rome, Naples), so the
 * usual frontier spaces come out as Piedmont and Lombardy when Lombardy is
 * Italian-held, or Piedmont and Tuscany when Lombardy is still an AU home.
 */
export const italianRedeployPlan = (G: ImperialElegyState): ItalianRedeployPlan => {
  const held = (space: SpaceId): boolean => G.spaces[space]?.control === "IT";
  const adjacentToPlayer = (space: SpaceId): boolean =>
    neighboursOf(space).some((next) => {
      const def = SPACES[next];
      return def !== undefined && def.type !== "navalBox" && isPower(G.spaces[next]?.control);
    });
  const adjacent = italianUnificationSpaces()
    .filter((id) => id !== "rome" && held(id) && adjacentToPlayer(id))
    .slice(0, 2);
  const naval = held("naples") ? "naples" : held("piedmont") ? "piedmont" : null;
  return {rome: "rome", adjacent, naval};
};

/** 22.2: "Italy gains three standing armies and one naval squadron." */
export const ITALIAN_STANDING_ARMIES = 3;

/**
 * 22.2/22.3.1 + the printed GW counter mix: three standing armies plus the two
 * reserve armies the Kingdom of Italy table can grant ("Italy permanently gains
 * an additional reserve army"; the Italy row prints five army counters).
 * Redeployment (22.4 and the 20.3 rebuild) never fields more Italian army
 * counters than this, and the 22.3.1 grants never exceed the two spare counters.
 */
export const ITALIAN_ARMY_COUNTER_MAX = 5;

/** 22.2/22.3.1: the army counters beyond the three standing armies. */
export const ITALIAN_RESERVE_ARMY_MAX = ITALIAN_ARMY_COUNTER_MAX - ITALIAN_STANDING_ARMIES;

/** 22.2/22.3.1: Italy prints three squadrons and gains extra ones from the table, beyond its one starting squadron. */
export const ITALIAN_EXTRA_NAVAL_MAX = 2;

/**
 * 22.2: "All Italian minor powers cease to exist."  Unification removes their
 * units and turns their spaces into Italy's, so they are permanently eliminated
 * (the same state 33.1 records in `ImperialElegyState.eliminatedMinors`).  The
 * set lives here so the end phase (which skips their 20.3 build) and the 30.1
 * orphan sweep agree on which minors are gone for good.
 */
export const ITALIAN_MINOR_POWERS: ReadonlySet<string> = new Set([
  "Sardinia-Piedmont",
  "Two Sicilies",
  "Tuscany",
  "Papal States",
]);

/**
 * 22.2/22.3.1/4.2: how many Italian army counters may be in play.  The printed
 * row is five (three standing + two reserve); the Kingdom of Italy table's
 * 5–6 result adds one reserve counter per play, up to the printed row.
 */
export const italianArmyTarget = (G: ImperialElegyState): number =>
  Math.min(
    ITALIAN_ARMY_COUNTER_MAX,
    ITALIAN_STANDING_ARMIES + Math.max(0, Math.min(ITALIAN_RESERVE_ARMY_MAX, G.italyReinforcements?.armies ?? 0)),
  );

/**
 * 22.2/22.4: a printed Italian space that can receive a redeployed unit.  A
 * space with a player control marker stays with that player (22.2), an enemy
 * occupation blocks it, and a space already holding a foreign unit cannot host
 * Italy's redeployment.
 */
export const italianSpacePlaceable = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.control !== "IT") return false;
  if (state.occupiedBy !== null && state.occupiedBy !== undefined && state.occupiedBy !== "IT") return false;
  return state.units.every((id) => G.units[id]?.owner === "IT");
};

/**
 * 22.4: the printed order in which Italy's standing armies take the field —
 * Rome first, then the two frontier spaces next to a player-controlled space,
 * then any other Italian-held unification space as the fallback.  Both the
 * unification redeployment (`greatWarFlow#redeployItaly`) and the 20.3 rebuild
 * read this list, so they cannot drift apart.
 */
export const italianArmyDeploySpaces = (G: ImperialElegyState): SpaceId[] => {
  const plan = italianRedeployPlan(G);
  const spaces: SpaceId[] = [];
  const add = (id: SpaceId): void => {
    if (!spaces.includes(id)) spaces.push(id);
  };
  add(plan.rome);
  for (const id of plan.adjacent) add(id);
  for (const id of italianUnificationSpaces()) add(id);
  return spaces.filter((id) => italianSpacePlaceable(G, id));
};

/** 22.4: "Italian naval units are always placed in Naples or Piedmont if Naples is not Italian controlled." */
export const italianNavalDeploySpace = (G: ImperialElegyState): SpaceId | null => {
  const plan = italianRedeployPlan(G);
  for (const space of [plan.naval, "naples", "piedmont"]) {
    if (space !== null && italianSpacePlaceable(G, space)) return space;
  }
  return null;
};

/**
 * The Italian minor-power spaces still controlled by a minor power.  Used by
 * the Italian unification rules and by the Papal Influence card, which may
 * target "any Italian minor power" once its player is allied to the Papal
 * States.  A unified Italy's spaces are controlled by "IT", which is not one
 * of `MINOR_POWER_HOMES`, so they are excluded.
 */
export const italianMinorSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter((s) => s.flashpoints?.includes("italy"))
    .map((s) => s.id)
    .filter((id) => {
      const control = G.spaces[id]?.control;
      return typeof control === "string" && MINOR_POWER_HOMES[control] !== undefined;
    });

/** The Papal States' home space (Rome), which the Papal Influence card allies. */
export const PAPAL_STATES_SPACE: SpaceId = "rome";

/**
 * 33.5 The Second Rome: "If RU takes Istanbul, Ankara becomes the OT capital."
 * Every capital lookup goes through this helper so the printed switch also
 * moves the blockade (29.1) and any capital-occupation check (30.1).  The
 * other powers keep the capital printed on their display.
 */
export const capitalOf = (G: ImperialElegyState, power: Power): SpaceId =>
  power === "OT" && G.persistent.otCapital === "ankara" ? "ankara" : POWER_DEFS[power].capital;

/** 30.1: the subcapital, when the power has one (AU, RU, OT). */
export const subcapitalOf = (power: Power): SpaceId | undefined => POWER_DEFS[power].subcapital;

/**
 * 29.1 Blockade: a belligerent that cannot trace a LoC to its capital is
 * blockaded.  A capital held by an enemy cannot be traced to at all, so it is
 * an immediate blockade (this is what makes the Ankara switch matter: once RU
 * takes Istanbul, Istanbul is no longer the Ottoman capital).
 */
export const isBlockaded = (G: ImperialElegyState, power: Power): boolean => {
  const capital = capitalOf(G, power);
  const state = G.spaces[capital];
  if (!state) return false;
  // An enemy unit sitting on the capital severs the trace even while the
  // control marker still belongs to the power (occupation, 15.3).
  const occupier = state.occupiedBy;
  if (occupier !== null && occupier !== undefined && occupier !== power) {
    if (!isPower(occupier) || atWar(G, power, occupier)) return true;
  }
  if (!friendlySpace(G, capital, power)) return true;
  return !hasLoc(G, power, capital, {});
};

/**
 * The minor powers allied to `power`, one entry per minor power.  Rule 4.2.1
 * caps a player at five minor power allies, and a minor that controls several
 * spaces is still one ally, so the list is de-duplicated by the minor's name.
 */
export const minorAlliesOf = (G: ImperialElegyState, power: Power): string[] => [
  ...new Set(
    Object.values(G.spaces)
      .filter((state) => state.ally === power && state.control !== power && state.control !== null && !isPower(state.control))
      .map((state) => state.control as string),
  ),
];

export const minorAllyHome = (G: ImperialElegyState, power: Power, minor: string): SpaceId | undefined => {
  const home = MINOR_POWER_HOMES[minor];
  if (home && G.spaces[home]?.ally === power) return home;
  return Object.values(G.spaces).find((s) => s.ally === power && s.control === minor) ? home : home;
};

export const allianceOf = (box: AllianceBox): "te" | "ta" | null => {
  if (box === "teAligned" || box === "teCommitted") return "te";
  if (box === "taAligned" || box === "taCommitted") return "ta";
  return null;
};

export const isCommitted = (box: AllianceBox): boolean => box === "teCommitted" || box === "taCommitted";

export const allied = (G: ImperialElegyState, a: Power, b: Power): boolean => {
  if (a === b) return true;
  const aa = allianceOf(G.powers[a].alliance);
  const bb = allianceOf(G.powers[b].alliance);
  return aa !== null && aa === bb;
};

export const atWar = (G: ImperialElegyState, a: Power, b: Power): boolean => {
  if (a === b) return false;
  // The Great War supersedes limited wars for alliance purposes.
  if (G.gw?.active) {
    const aSide = G.gw.te.includes(a) ? "te" : G.gw.ta.includes(a) ? "ta" : null;
    const bSide = G.gw.te.includes(b) ? "te" : G.gw.ta.includes(b) ? "ta" : null;
    if (aSide !== null && bSide !== null) return aSide !== bSide;
  }
  const war = G.war;
  if (war !== null) {
    const aAtt = war.attacker === a || war.attackerAllies.includes(a);
    const aDef = war.defender === a || war.defenderAllies.includes(a);
    const bAtt = war.attacker === b || war.attackerAllies.includes(b);
    const bDef = war.defender === b || war.defenderAllies.includes(b);
    if ((aAtt && bDef) || (aDef && bAtt)) return true;
  }
  return false;
};

/** Rule 26.3: the GW side a non-player major (US / unified Italy) fights on. */
export const gwMajorSide = (G: ImperialElegyState, major: "IT" | "US"): "te" | "ta" | null => {
  if (!G.gw?.active) return null;
  const entered = major === "US" ? G.gw.usIn : G.gw.italyIn;
  if (!entered) return null;
  const raw = major === "US" ? G.flags.usSide : G.flags.italySide;
  return raw === "te" || raw === "ta" ? raw : null;
};

/** 30.1: the GW side a player power currently fights for (null when neutral). */
const gwSideOfPower = (G: ImperialElegyState, power: Power): GwSide | null =>
  !G.gw?.active ? null : G.gw.te.includes(power) ? "te" : G.gw.ta.includes(power) ? "ta" : null;

/**
 * Whether a unit owned by `owner` is an enemy of `power` for battle purposes.
 * Player units follow `atWar`.  US/Italian units that have entered the Great
 * War are enemies only of the other alliance (and never of a neutral player).
 * Every other non-player owner (minors, rebels) keeps the historic "always
 * hostile" treatment used by the combat helpers.
 */
export const hostileOwner = (G: ImperialElegyState, power: Power, owner: PowerOrMinor): boolean => {
  if (isPower(owner)) return atWar(G, power, owner);
  if (owner === "US" || owner === "IT") {
    const side = gwMajorSide(G, owner);
    if (side !== null) {
      const mine = gwSideOfPower(G, power);
      return mine !== null && mine !== side;
    }
  }
  return true;
};

/**
 * Rule 26.3: during a US/Italian impulse the controlling player moves that
 * major's units with that major's own budget.  Returns the major whose
 * impulse `power` is currently taking, if any.
 */
export const gwAllyImpulseFor = (G: ImperialElegyState, power: Power): "IT" | "US" | null => {
  if (!G.gw?.active || G.activePower !== power) return null;
  const slot = G.flags.gwAllyImpulse;
  return slot === "US" || slot === "IT" ? slot : null;
};

export const enemiesOf = (G: ImperialElegyState, power: Power): Power[] =>
  POWERS.filter((p) => p !== power && atWar(G, power, p));

export const isNeutral = (G: ImperialElegyState, power: Power): boolean =>
  G.powers[power].alliance === "neutral";

/** Friendly for movement/LoC purposes. */
export const friendlySpace = (G: ImperialElegyState, space: SpaceId, power: Power): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.control === power || state.occupiedBy === power) return true;
  if (isPower(state.control) && allied(G, state.control, power)) return true;
  if (!isPower(state.control) && state.control !== null && state.ally === power) return true;
  if (state.influence === power && state.control === null) return true;
  return false;
};

export const neutralSpace = (G: ImperialElegyState, space: SpaceId, power: Power): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.control === null) return false;
  if (isPower(state.control)) return !friendlySpace(G, space, power) && !atWar(G, power, state.control);
  return state.ally !== power;
};

/**
 * 15.3: who holds a space by occupation.  An occupied space needs no land unit,
 * so the occupation marker counts on its own; a land unit standing in the space
 * also occupies it (naval units never do).  Shared by the 30.1 capital check and
 * the Italian home-key check so both agree on what "occupied" means.
 */
export const occupyingOwners = (G: ImperialElegyState, space: SpaceId): PowerOrMinor[] => {
  const state = G.spaces[space];
  if (!state) return [];
  const out: PowerOrMinor[] = [];
  if (state.occupiedBy !== null && state.occupiedBy !== undefined) out.push(state.occupiedBy);
  for (const id of state.units) {
    const unit = G.units[id];
    if (!unit || unit.naval === true) continue;
    if (!out.includes(unit.owner)) out.push(unit.owner);
  }
  return out;
};

/** The players present in a space by land unit, in 15.3 occupation terms. */
const landOccupants = (G: ImperialElegyState, space: SpaceId): PowerOrMinor[] => {
  const state = G.spaces[space];
  if (!state) return [];
  const out = new Set<PowerOrMinor>();
  for (const id of state.units) {
    const unit = G.units[id];
    if (!unit || unit.naval === true) continue;
    if (isPower(unit.owner) || unit.owner === "US" || unit.owner === "IT") {
      out.add(unit.owner);
      continue;
    }
    // 15.4: a minor power's units move as part of its controlling player's
    // actions, so a controlled minor counts as that player's presence.  An
    // independent/uncontrolled minor (or a rebel) stands for itself.
    out.add(minorController(G, unit.owner) ?? minorUpkeepPower(G, unit.owner) ?? unit.owner);
  }
  return [...out];
};

/**
 * Whether the space's formal control marker already puts `occupant` in charge:
 * its own control, an allied player's control, or a minor power controlled by
 * the occupant.  Such a space needs no separate 15.3 occupation marker.
 */
const controlledFor = (G: ImperialElegyState, space: SpaceId, occupant: PowerOrMinor): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.control === occupant) return true;
  if (!isPower(occupant)) return false;
  if (isPower(state.control)) return allied(G, state.control, occupant);
  if (state.control !== null) return state.ally === occupant;
  return false;
};

/** One 15.3 occupation-marker update, returned for tests and callers. */
export interface OccupationChange {
  space: SpaceId;
  before: PowerOrMinor | null;
  after: PowerOrMinor | null;
  changed: boolean;
  /** True when the update removed a marker instead of writing one. */
  cleared: boolean;
}

export interface OccupationOptions {
  /** Record even outside a war (19.10's undefended landing is an occupation). */
  force?: boolean;
}

/**
 * 15.3 "Occupied vs Controlled": "In wartime, the last player to solely be in a
 * space occupies it.  Use control markers to identify which spaces are
 * occupied."  This is the one live helper every land move path funnels through.
 *
 * It only ever writes `SpaceState.occupiedBy`; the formal `control` marker is
 * never overwritten (a wartime capture leaves control with the defender until
 * the end of the war).  Naval units never occupy.  A space whose formal control
 * already belongs to the occupant (or to its alliance / a minor it controls)
 * keeps no redundant marker.
 *
 * 15.3 persistence: "An occupied space does not need to contain a land unit to
 * remain occupied."  A marker therefore survives the occupying units leaving;
 * it only ends when another player solely occupies the space (a new marker
 * replaces it) or when the space becomes control-backed for that sole occupant
 * (the stale marker is then redundant and is cleared).
 */
export const recordOccupation = (
  G: ImperialElegyState,
  space: SpaceId,
  options: OccupationOptions = {},
): OccupationChange => {
  const state = G.spaces[space];
  const before = state?.occupiedBy ?? null;
  const unchanged = (): OccupationChange => ({space, before, after: before, changed: false, cleared: false});
  if (!state || isNavalBox(space)) return unchanged();
  const wartime = options.force === true || G.war !== null || G.gw?.active === true;
  if (!wartime) return unchanged();
  const occupants = landOccupants(G, space);
  // Two or more players share the space: nobody solely occupies it, so the
  // existing marker is left for the battle/trench logic to resolve.
  if (occupants.length > 1) return unchanged();
  if (occupants.length === 1) {
    const occupant = occupants[0];
    // 15.3 speaks of the last *player* solely in the space: a lone independent
    // minor or rebel force does not give a player the occupation marker (and
    // does not end the previous player's occupation either).
    if (!isPower(occupant) && occupant !== "US" && occupant !== "IT") return unchanged();
    if (controlledFor(G, space, occupant)) {
      // The space is formally controlled by the sole occupant (or its side):
      // any occupation marker is now redundant.  Clearing it is the "until
      // another player ... controls the space" half of 15.3 — e.g. the
      // controller marching back into its own space ends the enemy's occupation.
      if (before === null) return unchanged();
      state.occupiedBy = null;
      return {space, before, after: null, changed: true, cleared: true};
    }
    if (before === occupant) return unchanged();
    state.occupiedBy = occupant;
    if (space === "paris") settleCulturalSymbolLoss(G);
    return {space, before, after: occupant, changed: true, cleared: false};
  }
  // No land unit: 15.3 keeps the occupation marker in place.
  return unchanged();
};

/**
 * An owner that can force a 30.1 surrender.  Only an enemy power — or a
 * US/unified-Italy major fighting for the other side — counts; a neutral minor
 * power or a rebel standing in the space never surrenders a player.
 */
const capitalEnemy = (G: ImperialElegyState, power: Power, owner: PowerOrMinor): boolean => {
  if (isPower(owner)) return !G.powers[owner].eliminated && atWar(G, power, owner);
  if (owner === "US" || owner === "IT") return hostileOwner(G, power, owner);
  return false;
};

/**
 * 30.1 GW Surrender: "A player immediately surrenders when their stability
 * reaches 0 or if their capital is occupied.  Exception: AU, RU, and OT players
 * have a capital and a subcapital, both must be occupied to force them to
 * surrender."
 *
 * The capital comes from `capitalOf`, so the Ottoman capital is Ankara after
 * the 33.5 Second Rome switch (where Ankara is then both capital and
 * subcapital); every other power keeps its printed capital.  Occupation is read
 * through `occupyingOwners` (15.3), i.e. the occupation marker or an enemy land
 * unit.
 */
export const capitalOccupiedByEnemy = (G: ImperialElegyState, power: Power): boolean => {
  const occupiedByEnemy = (space: SpaceId): boolean =>
    occupyingOwners(G, space).some((owner) => capitalEnemy(G, power, owner));
  const capital = capitalOf(G, power);
  if (!occupiedByEnemy(capital)) return false;
  const subcapital = subcapitalOf(power);
  if (subcapital === undefined || subcapital === capital) return true;
  return occupiedByEnemy(subcapital);
};

/**
 * 30.1: eliminate every living GW belligerent whose capital (and, for AU/RU/OT,
 * subcapital) is occupied by an enemy.  Idempotent — an already eliminated
 * power is skipped, so a second call never double-surrenders it.  Units and the
 * alliance/belligerent markers leave play through `eliminatePower`; the
 * elimination is logged with `cause: "capital"`.
 */
export const resolveCapitalSurrenders = (G: ImperialElegyState, ctx?: Ctx): Power[] => {
  const eliminated: Power[] = [];
  if (!G.gw?.active) return eliminated;
  for (const power of POWERS) {
    if (G.powers[power].eliminated || !G.gw.belligerents.includes(power)) continue;
    if (!capitalOccupiedByEnemy(G, power)) continue;
    eliminatePower(G, power, ctx, "capital");
    eliminated.push(power);
  }
  return eliminated;
};

const connectionPassable = (
  G: ImperialElegyState,
  from: SpaceId,
  to: SpaceId,
  power: Power,
  landOnly: boolean,
  respectNavalGates = false,
): boolean => {
  if (landOnly && (isNavalBox(from) || isNavalBox(to))) return false;
  const state = G.spaces[to];
  if (!state) return false;
  if (isNavalBox(to)) {
    // A LoC that follows the sea route must respect the same straits as naval
    // movement: Suez (3.4/12.3) and the Dardanelles (3.4.1).  Otherwise a
    // blockaded capital could trace through a closed canal or strait.
    if (respectNavalGates && !navalHopPassable(G, power, from, to)) return false;
    return true;
  }
  if (G.gw?.active) {
    // GW: enemy spaces need a land battle; LoC only through friendly/occupied.
    if (friendlySpace(G, to, power)) return true;
    return false;
  }
  if (G.war !== null) {
    if (friendlySpace(G, to, power)) return true;
    if (atWar(G, power, state.control as Power)) return false;
    // During a war, neutral spaces still block LoC.
    return false;
  }
  return friendlySpace(G, to, power);
};

/** Breadth-first LoC trace. */
export const hasLoc = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  options: {
    landOnly?: boolean;
    requireTwoSources?: boolean;
    capitalOnly?: boolean;
    /** 29.1/29.2: follow Suez and Dardanelles closures on sea hops. */
    respectNavalGates?: boolean;
  } = {},
): boolean => {
  if (!G.spaces[from]) return false;
  const visited = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current !== from && isSupplySource(G, power, current, options.requireTwoSources ?? true)) return true;
    for (const next of neighboursOf(current)) {
      if (visited.has(next)) continue;
      if (
        !connectionPassable(
          G,
          current,
          next,
          power,
          options.landOnly ?? false,
          options.respectNavalGates ?? false,
        )
      ) {
        continue;
      }
      visited.add(next);
      queue.push(next);
    }
  }
  return isSupplySource(G, power, from, options.requireTwoSources ?? true);
};

export const isSupplySource = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
  requireTwoSources = true,
): boolean => {
  const def = SPACES[space];
  if (!def || def.type === "navalBox") return false;
  if (!ownsKey(G, space, power) || !isHomeSpace(G, space, power)) return false;
  if (!requireTwoSources) return true;
  // A supply source needs a LoC to at least one other controlled home key.
  const visited = new Set<SpaceId>([space]);
  const queue = [space];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (visited.has(next) || isNavalBox(next)) continue;
      if (!connectionPassable(G, current, next, power, false)) continue;
      if (ownsKey(G, next, power) && isHomeSpace(G, next, power)) return true;
      visited.add(next);
      queue.push(next);
    }
  }
  return false;
};

export const brokenLoc = (G: ImperialElegyState, power: Power, space: SpaceId): boolean =>
  !isNavalBox(space) && !hasLoc(G, power, space);

// ---------------------------------------------------------------------------
// Stacking (5.5) and start-of-impulse penalties (5.5.3 / 5.6.2)
// ---------------------------------------------------------------------------

/**
 * 5.5.1 Army stacking: 3 armies on land spaces of the main map, 2 elsewhere,
 * and all Ottoman home spaces hold 2 (including those in Europe).  ECs and EFs
 * never count against this limit (5.5.2).
 */
export const landStackingLimit = (space: SpaceId): number => {
  if (SPACES[space]?.home === "OT") return 2;
  if (SPACES[space]?.region === "europe") return 3;
  return 2;
};

/** 5.5.4 Naval stacking: no limit in naval boxes, ports hold at most 4. */
export const PORT_NAVAL_LIMIT = 4;

/** Land armies in a space, counting every owner (stacking is per space). */
export const armyCountIn = (G: ImperialElegyState, space: SpaceId): number =>
  landUnitsIn(G, space).filter((u) => isArmyKind(u.kind)).length;

/** The counters in `space` that can take a step loss for this penalty. */
const penaltyCandidates = (
  G: ImperialElegyState,
  space: SpaceId,
  power: Power,
  naval: boolean,
): Unit[] =>
  unitsIn(G, space).filter(
    (unit) =>
      unit.owner === power &&
      unit.steps > 0 &&
      (naval ? unit.naval === true : isArmyKind(unit.kind)),
  );

export type ImpulsePenaltyCause = "overstack" | "brokenLoc";

/** One stack that must lose a step at the start of `power`'s impulse. */
export interface ImpulsePenalty {
  space: SpaceId;
  cause: ImpulsePenaltyCause;
  /** Units that may take the step, in deterministic order (owner chooses). */
  candidates: string[];
}

/** True when the space is over its land or port stacking limit. */
export const isOverstacked = (G: ImperialElegyState, space: SpaceId): boolean => {
  const def = SPACES[space];
  if (!def || def.type === "navalBox") return false;
  if (armyCountIn(G, space) > landStackingLimit(space)) return true;
  return navalUnitsIn(G, space).length > PORT_NAVAL_LIMIT;
};

/**
 * 5.5.3 / 5.5.4 overstacked spaces for a power: the space is over its limit
 * and the power has at least one step-bearing unit there (armies on land,
 * naval units in a port).  A retreating stack may exceed the limit until the
 * owning player's next impulse.
 */
export const overstackedSpaces = (G: ImperialElegyState, power: Power): SpaceId[] =>
  Object.keys(G.spaces).filter(
    (space) =>
      isOverstacked(G, space) &&
      penaltyCandidates(G, space, power, false).length + penaltyCandidates(G, space, power, true).length > 0,
  );

/**
 * 5.6.2 broken-LoC spaces for a power during wartime / the Great War: a space
 * where one of its armies cannot trace to a supply source.  Peacetime broken
 * LoCs displace instead (5.6.3), so no step-loss penalty is produced.
 */
export const brokenLocSpaces = (G: ImperialElegyState, power: Power): SpaceId[] => {
  if (G.war === null && !G.gw?.active) return [];
  return Object.keys(G.spaces).filter(
    (space) =>
      !isNavalBox(space) &&
      penaltyCandidates(G, space, power, false).length > 0 &&
      brokenLoc(G, power, space),
  );
};

// ---------------------------------------------------------------------------
// Movement-end stacking (5.5.3) and 28.1.5 trench exits
// ---------------------------------------------------------------------------

/** Why a movement may not end in a space (5.5.3 / 5.5.4). */
export type MovementEndReason = "armyStacking" | "portCapacity";

/**
 * 5.5.3 / 5.5.4: "stacking can be violated during movement, but units cannot
 * end their movement overstacked."  Only the destination is validated; passing
 * through an overstacked space stays legal.  A naval battle in a port is the
 * one exception handled by the caller (5.5.4 lets an attack bring up to four
 * ships, so the defender's ships are not counted against the attacker's move).
 */
export const movementEndProblem = (
  G: ImperialElegyState,
  space: SpaceId,
  arriving: readonly Unit[],
): MovementEndReason | null => {
  const def = SPACES[space];
  if (!def || def.type === "navalBox") return null;
  const newcomers = arriving.filter((unit) => unit.space !== space);
  const armies = newcomers.filter((unit) => unit.naval !== true && isArmyKind(unit.kind)).length;
  if (armies > 0 && armyCountIn(G, space) + armies > landStackingLimit(space)) return "armyStacking";
  const ships = newcomers.filter((unit) => unit.naval === true).length;
  if (ships > 0 && navalUnitsIn(G, space).length + ships > PORT_NAVAL_LIMIT) return "portCapacity";
  return null;
};

/** The subset of a Great War maneuver request this validator needs. */
export interface ManeuverDestinationRequest {
  kind: string;
  to?: SpaceId;
  unitId?: string;
  unitIds?: string[];
  allyUnitIds?: string[];
}

/**
 * Movement-end validation shared by the Great War maneuver flow (27.5) and its
 * callers: 5.5.3/5.5.4 stacking at the destination and 28.1.5's trench-exit
 * restriction.  Returns an error message or null; the flow owns the other
 * legality checks (friendly space, rail path, sea connection).
 */
export const maneuverDestinationProblem = (
  G: ImperialElegyState,
  power: Power,
  request: ManeuverDestinationRequest,
): string | null => {
  const to = request.to;
  if (typeof to !== "string" || !G.spaces[to]) return null;
  if (request.kind === "march" || request.kind === "rail") {
    const unit = request.unitId ? G.units[request.unitId] : undefined;
    if (!unit || unit.naval || !unit.space) return null;
    if (trenchExitBlocked(G, power, unit.space, to)) {
      return "A unit leaving a trench battle space must first enter a friendly or trench space (28.1.5)";
    }
    if (movementEndProblem(G, to, [unit]) !== null) {
      return "That move would end overstacked (5.5.3)";
    }
    return null;
  }
  if (request.kind === "naval" || request.kind === "jointNaval") {
    const units = [...(request.unitIds ?? []), ...(request.allyUnitIds ?? [])]
      .map((id) => G.units[id])
      .filter((unit): unit is Unit => unit !== undefined);
    if (units.length === 0) return null;
    // 19.0: ending in a space that contains enemy naval units is a contact
    // battle, not an overstacked legal parking spot.  The port capacity check
    // applies to ordinary moves only; a contact attack is capped at four
    // attacking ships by 5.5.4 (checked by the caller).
    const contact = unitsIn(G, to).some((unit) => hostileOwner(G, power, unit.owner));
    if (!contact && movementEndProblem(G, to, units) !== null) {
      return "That move would end with too many naval units in the port (5.5.4)";
    }
  }
  return null;
};

/**
 * 28.1.5: "when units leave a trench battle space the first space they enter
 * cannot be an enemy controlled (or occupied) space (unless it also contains a
 * trench battle marker)."  The caller has already resolved the move path, so
 * this checks one space hop.
 */
export const trenchExitBlocked = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  to: SpaceId,
): boolean => {
  if (!G.spaces[from]?.trench) return false;
  if (G.spaces[to]?.trench) return false;
  return spaceHostileTo(G, power, to);
};

/** A space is enemy controlled/occupied (or garrisoned) for `power`. */
export const spaceHostileTo = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  for (const owner of [state.occupiedBy, state.control]) {
    if (owner === null || owner === undefined) continue;
    if (isPower(owner)) {
      if (atWar(G, power, owner)) return true;
      continue;
    }
    const controller = isMinorPowerOwner(owner)
      ? minorController(G, owner) ?? minorUpkeepPower(G, owner)
      : null;
    if (controller !== null && atWar(G, power, controller)) return true;
  }
  return unitsIn(G, space).some((unit) => {
    if (isPower(unit.owner)) return atWar(G, power, unit.owner);
    if (isMinorPowerOwner(unit.owner)) {
      // A neutral, unaligned minor's army is not an "enemy" for 28.1.5.
      const side = minorController(G, unit.owner) ?? minorUpkeepPower(G, unit.owner);
      return side !== null && atWar(G, power, side);
    }
    // US/Italian and rebel units keep the battle-hostility rule.
    return hostileOwner(G, power, unit.owner);
  });
};

// ---------------------------------------------------------------------------
// 5.6.1 / 5.6.2 non-player (minor power) supply
// ---------------------------------------------------------------------------

/** True for a named minor power (not a player, the US, Italy or a rebel). */
export const isMinorPowerOwner = (owner: PowerOrMinor): owner is string =>
  typeof owner === "string" &&
  !isPower(owner) &&
  Object.prototype.hasOwnProperty.call(MINOR_POWER_HOMES, owner);

/**
 * The player currently controlling a minor (its allied player), or null when
 * the minor is independent.  A minor alliance keeps the minor's control of its
 * own spaces and records the controlling player in `SpaceState.ally`.
 */
export const minorController = (G: ImperialElegyState, minor: string): Power | null => {
  const home = MINOR_POWER_HOMES[minor];
  if (home && isPower(G.spaces[home]?.ally)) return G.spaces[home].ally as Power;
  for (const state of Object.values(G.spaces)) {
    if (state.control === minor && isPower(state.ally)) return state.ally;
  }
  return null;
};

/**
 * 5.6.2: whose impulse pays a broken-LoC minor army's step.  A controlled
 * minor loses the step in its controller's impulse; an independent minor that
 * is fighting on a side loses it in the first player of that side's impulse.
 */
export const minorUpkeepPower = (G: ImperialElegyState, minor: string): Power | null => {
  const controller = minorController(G, minor);
  if (controller !== null) return controller;
  const war = G.war;
  if (war === null) return null;
  if (war.attackerMinors.includes(minor)) return war.attacker;
  // Rule 15.4.2: a lone non-player defender has no player on its side, so no
  // player pays its broken-LoC step (5.6.2); `war.defender` is the non-player
  // id then, not a seat.
  if (war.defenderMinors.includes(minor)) return isPower(war.defender) ? war.defender : null;
  return null;
};

// ---------------------------------------------------------------------------
// 30.1 formerly controlled space (post-elimination march / rail)
// ---------------------------------------------------------------------------

/**
 * Whether `owner` counts as friendly to `power` for movement purposes: a
 * player power in the same alliance (or the power itself), a US/Italy major on
 * the power's Great War side, or a minor power controlled by one of those.
 */
export const ownerFriendlyTo = (G: ImperialElegyState, power: Power, owner: PowerOrMinor): boolean => {
  if (owner === power) return true;
  if (isPower(owner)) return allied(G, power, owner);
  if (owner === "US" || owner === "IT") {
    const side = gwMajorSide(G, owner);
    if (side === null || !G.gw) return false;
    const mine = G.gw.te.includes(power) ? "te" : G.gw.ta.includes(power) ? "ta" : null;
    return mine === side;
  }
  const controller = minorController(G, owner) ?? minorUpkeepPower(G, owner);
  return controller !== null && allied(G, power, controller);
};

/**
 * 30.1: "all spaces formally controlled by the eliminated power".  During the
 * Great War a captured space keeps its control marker (15.3), so a power that
 * has been eliminated (or a US/Italy major that surrendered) leaves its
 * territory behind with that formal control recorded.
 */
export const formerlyControlledOwner = (
  G: ImperialElegyState,
  space: SpaceId,
): Power | "IT" | "US" | null => {
  const control = G.spaces[space]?.control;
  if (isPower(control)) return G.powers[control]?.eliminated === true ? control : null;
  if (control === "IT") return G.gw?.italySurrendered === true ? "IT" : null;
  // The US home key ("the-south") carries the printed minor-power name.
  if (control === "US" || control === "United States") return G.gw?.usSurrendered === true ? "US" : null;
  return null;
};

export const isFormerlyControlledSpace = (G: ImperialElegyState, space: SpaceId): boolean =>
  formerlyControlledOwner(G, space) !== null;

/**
 * 30.1: "other players may freely march through their territory".  A formerly
 * controlled space is a legal march destination (or march origin) when it holds
 * no enemy land unit and no enemy occupation marker; an enemy still has to be
 * fought with a land battle, not walked through.
 */
export const formerlyControlledMarchAllowed = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): boolean => {
  if (!isFormerlyControlledSpace(G, space)) return false;
  const state = G.spaces[space];
  if (!state) return false;
  if (state.occupiedBy !== null && state.occupiedBy !== undefined) {
    if (!ownerFriendlyTo(G, power, state.occupiedBy)) return false;
  }
  return !state.units.some((id) => {
    const unit = G.units[id];
    return unit !== undefined && unit.naval !== true && !ownerFriendlyTo(G, power, unit.owner);
  });
};

/**
 * 30.1: "all spaces formally controlled by the eliminated power must be
 * occupied (including by that power's former allies) before players may rail
 * through them."  A space is occupied (15.3) by its occupation marker or by a
 * land unit standing in it; the occupier must be on the railing power's side.
 */
export const formerlyControlledRailAllowed = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): boolean => {
  if (!isFormerlyControlledSpace(G, space)) return true;
  return occupyingOwners(G, space).some((owner) => ownerFriendlyTo(G, power, owner));
};

/**
 * 5.6.1: a non-player supply source is any home key the minor itself controls;
 * it does not need to trace to a second key.
 */
export const minorSupplySource = (G: ImperialElegyState, minor: string, space: SpaceId): boolean => {
  const def = SPACES[space];
  if (!def || def.type === "navalBox") return false;
  if (G.spaces[space]?.control !== minor) return false;
  return def.minorHome === minor || MINOR_POWER_HOMES[minor] === space;
};

/** Friendly spaces for a minor's LoC trace (5.6: through friendly spaces). */
export const minorFriendlySpace = (
  G: ImperialElegyState,
  minor: string,
  space: SpaceId,
): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (isNavalBox(space)) return true;
  if (state.control === minor || state.occupiedBy === minor) return true;
  const controller = minorController(G, minor);
  if (controller !== null && friendlySpace(G, space, controller)) return true;
  // Another minor's space controlled by the same player is friendly too.
  if (
    controller !== null &&
    state.control !== null &&
    !isPower(state.control) &&
    isPower(state.ally)
  ) {
    return allied(G, state.ally, controller);
  }
  return false;
};

/**
 * 5.6.1 / 5.6.2: a minor army's LoC.  It traces through its own and its
 * controller's friendly spaces to one of its home keys (no second key needed)
 * or to a supply source of its controlling/allied player.
 */
export const minorHasLoc = (G: ImperialElegyState, minor: string, from: SpaceId): boolean => {
  if (!G.spaces[from]) return false;
  const supplier = minorController(G, minor) ?? minorUpkeepPower(G, minor);
  const isSource = (space: SpaceId): boolean => {
    if (minorSupplySource(G, minor, space)) return true;
    if (supplier !== null && isSupplySource(G, supplier, space)) return true;
    return false;
  };
  if (isSource(from)) return true;
  const visited = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (visited.has(next)) continue;
      // Land portions may only pass through the minor's/controller's friendly
      // spaces; naval boxes are never controlled and are always traceable.
      if (!minorFriendlySpace(G, minor, next)) continue;
      if (isSource(next)) return true;
      visited.add(next);
      queue.push(next);
    }
  }
  return false;
};

/** 5.6.1/5.6.2: a minor army out of supply (only while the minor is engaged). */
export const minorBrokenLoc = (G: ImperialElegyState, minor: string, space: SpaceId): boolean =>
  !isNavalBox(space) && minorUpkeepPower(G, minor) !== null && !minorHasLoc(G, minor, space);

/** The minor armies in `space` whose broken-LoC step falls on `power`. */
const minorBrokenCandidates = (
  G: ImperialElegyState,
  space: SpaceId,
  power: Power,
): Unit[] =>
  unitsIn(G, space).filter(
    (unit) =>
      unit.steps > 0 &&
      unit.naval !== true &&
      isArmyKind(unit.kind) &&
      isMinorPowerOwner(unit.owner) &&
      minorUpkeepPower(G, unit.owner) === power &&
      minorBrokenLoc(G, unit.owner, space),
  );

/**
 * The stack penalties that apply at the start of `power`'s impulse, in a
 * deterministic space order.  Each entry is one step loss for that space
 * (5.5.3 and 5.6.2 each give one step per stack; a space that is both
 * overstacked and out of supply therefore yields two entries).
 *
 * 5.6.2 clarification: "if multiple players have units in the stack, at the
 * beginning of each player's impulse their unit in that stack will lose a
 * step."  A controlled minor's armies are paid for in its controller's impulse
 * and share that one stack step; an independent minor on a war side is charged
 * to the first player on that side.
 */
export const impulsePenalties = (G: ImperialElegyState, power: Power): ImpulsePenalty[] => {
  if (G.powers[power].eliminated) return [];
  const out: ImpulsePenalty[] = [];
  for (const space of overstackedSpaces(G, power)) {
    const land = penaltyCandidates(G, space, power, false).map((u) => u.id);
    const naval = penaltyCandidates(G, space, power, true).map((u) => u.id);
    // A port can be overstacked in ships, armies or both; one step total.
    out.push({space, cause: "overstack", candidates: [...land, ...naval]});
  }
  if (G.war !== null || G.gw?.active) {
    for (const space of Object.keys(G.spaces)) {
      if (isNavalBox(space)) continue;
      const own = penaltyCandidates(G, space, power, false);
      const ownBroken = own.length > 0 && brokenLoc(G, power, space);
      const minors = minorBrokenCandidates(G, space, power);
      if (!ownBroken && minors.length === 0) continue;
      out.push({
        space,
        cause: "brokenLoc",
        candidates: [...(ownBroken ? own.map((u) => u.id) : []), ...minors.map((u) => u.id)],
      });
    }
  }
  return out;
};

/**
 * 5.6.3 / 5.7: the nearest friendly land space with a LoC that can receive a
 * displaced army.  Deterministic breadth-first search in the printed
 * connection order; naval boxes are never destinations for land units.
 */
export const displacementTargetForLoc = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
): SpaceId | null => {
  if (!G.spaces[from]) return null;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next) || isNavalBox(next)) continue;
      seen.add(next);
      if (friendlySpace(G, next, power) && hasLoc(G, power, next)) return next;
      queue.push(next);
    }
  }
  return null;
};

/**
 * The printed key type, unless a live effect has reclassified the space.
 *
 * A71 Urabi Revolt: "If the UK or France wins, all Egyptian spaces become
 * colonial home spaces."  The home-space half lives in `homeOverride`; the
 * Egypt key's counting half lives here so tracks, goals and the display all
 * agree that it is a colonial key for that player.
 */
export const effectiveKeyType = (G: ImperialElegyState, space: SpaceId): KeyType | undefined => {
  const state = G.spaces[space];
  if (state?.keyTypeOverride !== undefined) return state.keyTypeOverride;
  // A71 Urabi Revolt: "If the UK or France wins, all Egyptian spaces become
  // colonial home spaces."  A legacy save may carry the `homeOverride` written
  // before the explicit key-type field existed, so derive the same colonial
  // classification dynamically instead of silently falling back to the printed
  // territorial key.
  if (
    space === "egypt" &&
    (state?.control === "UK" || state?.control === "FR") &&
    state?.homeOverride === state?.control
  ) {
    return "colonial";
  }
  return SPACES[space]?.keyType;
};

/**
 * 33.1 Zollverein: "German Unification spaces are always considered territorial
 * keys to the GE player."  The printed German minor spaces are key spaces
 * without a printed key type; Germany counts them as territorial keys when it
 * controls them.  Every other power still sees no key there.
 */
export const isGermanUnificationSpace = (space: SpaceId): boolean =>
  SPACES[space]?.flashpoints?.includes("germany") === true;

/**
 * The key type `power` counts for `space`.  This is `effectiveKeyType` plus
 * Zollverein; a space that already prints (or overrides) a key type is never
 * counted twice.
 */
export const keyTypeForPower = (
  G: ImperialElegyState,
  space: SpaceId,
  power: Power,
): KeyType | undefined => {
  const base = effectiveKeyType(G, space);
  if (base !== undefined) return base;
  if (power === "GE" && isGermanUnificationSpace(space)) return "territorial";
  // 33.6 Local Autonomy: "Tunisia and Tripoli neither count as keys nor for
  // power projection unless OT can trace a LoC to the keys by land."  They are
  // printed key spaces without a key type, so OT's conditional type is the only
  // way that clause can ever be observed.  `recomputeTracks` applies the land
  // LoC test; every other power still sees no key there.
  if (power === "OT" && SPACES[space]?.otLandLocKeyType !== undefined) {
    return SPACES[space].otLandLocKeyType;
  }
  return undefined;
};

/** 33.6 Local Autonomy: the two spaces that need a land LoC to count as keys. */
export const OT_AUTONOMY_KEYS: ReadonlySet<SpaceId> = new Set<SpaceId>(["tripoli", "tunisia"]);

/**
 * 33.6 Local Autonomy: "Tunisia and Tripoli neither count as keys ... unless OT
 * can trace a LoC to the keys by land."  The trace must reach another
 * Ottoman-controlled key: the two spaces cannot certify each other (they are
 * the very keys whose own status is in question), which is why the standard
 * supply-source test is not enough here.  At campaign setup no land route
 * reaches an OT key outside the pair (Egypt is an independent minor), so the
 * printed track totals exclude both; gaining Egypt or another connected OT key
 * by land makes them count.
 */
export const hasOtAutonomyLandLoc = (G: ImperialElegyState, space: SpaceId): boolean => {
  if (!OT_AUTONOMY_KEYS.has(space)) return true;
  const visited = new Set<SpaceId>([space]);
  const queue: SpaceId[] = [space];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (
      current !== space &&
      !OT_AUTONOMY_KEYS.has(current) &&
      ownsKey(G, current, "OT") &&
      keyTypeForPower(G, current, "OT") !== undefined
    ) {
      return true;
    }
    for (const next of neighboursOf(current)) {
      if (visited.has(next)) continue;
      if (!connectionPassable(G, current, next, "OT", true)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return false;
};

/** Recompute keys, manpower and PP from the board. */
export const recomputeTracks = (G: ImperialElegyState): void => {
  // 33.1 German Confederation: "Whenever GE takes control of a German
  // unification space it becomes a permanent home space."  Sweeping here (the
  // single board-reading entry point) covers every treaty/conquest/GW gain, not
  // just the German Confederation annexation.
  applyGermanConfederationHomeOverrides(G);
  for (const power of POWERS) {
    G.powers[power].territorialKeys = 0;
    G.powers[power].colonialKeys = 0;
  }
  const ot = G.powers.OT;
  let otOther = 0;
  let otArab = 0;
  for (const def of Object.values(SPACES)) {
    if (def.type === "navalBox") continue;
    // 33.2.2: an independent India is never a key, whoever might place a
    // control marker there through a treaty or a legacy path.
    if (def.id === "india" && G.powers.UK.indiaIndependent === true) continue;
    const state = G.spaces[def.id];
    if (!state) continue;
    const owner = state.control;
    if (!isPower(owner)) continue;
    const keyType = keyTypeForPower(G, def.id, owner);
    if (keyType === undefined) continue;
    if (def.id === "tripoli" || def.id === "tunisia") {
      // 33.6 Local Autonomy: only the Ottomans count them as keys, and only
      // with a land LoC to another OT key.
      if (owner === "OT" && !hasOtAutonomyLandLoc(G, def.id)) continue;
    }
    if (owner === "OT") {
      if (ARAB_KEY_SPACES.has(def.id) || EGYPTIAN_SPACES.has(def.id)) otArab += 1;
      else otOther += 1;
      continue;
    }
    const p = G.powers[owner];
    if (keyType === "colonial") {
      if (owner === "UK" && def.id === "india") p.colonialKeys += 2;
      else p.colonialKeys += 1;
    } else {
      p.territorialKeys += 1;
    }
  }
  // TSRR adds +2 Russian keys.
  if (G.powers.RU.tsrr) G.powers.RU.territorialKeys += 2;
  // Pacification in a controlled space reduces that player's keys by one.
  for (const def of Object.values(SPACES)) {
    const state = G.spaces[def.id];
    if (!state || state.pacification === undefined || state.pacification === null) continue;
    if (state.pacification <= 0) continue;
    if (isPower(state.control)) {
      const keyType = keyTypeForPower(G, def.id, state.control);
      if (keyType === undefined) continue;
      const p = G.powers[state.control];
      if (keyType === "colonial") p.colonialKeys = Math.max(0, p.colonialKeys - 1);
      else p.territorialKeys = Math.max(0, p.territorialKeys - 1);
    }
  }
  ot.arabKeys = otArab;
  // OT Turkish keys are "all other keys"; keep territorialKeys as that total.
  ot.territorialKeys = otOther;
  for (const power of POWERS) {
    const p = G.powers[power];
    const def = POWER_DEFS[power];
    const keyIndex = Math.max(0, Math.min(def.keyManpower.length - 1, p.territorialKeys));
    p.manpower = def.keyManpower[keyIndex] ?? p.manpower;
    const secondary = def.secondaryKeyManpower ?? def.keyManpower;
    if (power === "UK") {
      const colonialIndex = Math.max(0, Math.min(secondary.length - 1, p.colonialKeys));
      p.secondaryManpower = secondary[colonialIndex] ?? p.secondaryManpower;
    }
    if (power === "OT") {
      const arabIndex = Math.max(0, Math.min(secondary.length - 1, p.arabKeys ?? 0));
      p.secondaryManpower = secondary[arabIndex] ?? p.secondaryManpower;
    }
  }
  // AU "A New Way Forward": +1 manpower after the base key-manpower
  // calculation, latched once by the end phase when four citizenship
  // nationalities were matched (33.4: "this is a one time bonus").
  if (auNewWayForwardGranted(G)) G.powers.AU.manpower += 1;
  // GE Imperial Germany: the one-time +1 granted at the first end phase after
  // unification stays on top of the key track.
  if (G.persistent.imperialGermany === "granted") G.powers.GE.manpower += 1;
  // A106 The Young Turks: permanent +1 Turkish manpower.
  if (G.persistent.otTwoElite === true) {
    G.powers.OT.manpower += Number(G.persistent.otManpowerBonus ?? 1);
  }
};

export const ARAB_KEY_SPACES = new Set<SpaceId>(["arabia", "mecca", "baghdad", "kuwait", "syria"]);
export const EGYPTIAN_SPACES = new Set<SpaceId>(["egypt", "great-sand-sea", "sinai"]);

/** Power projection: at most two per naval box, capped by naval units x 2. */
export const computePowerProjection = (G: ImperialElegyState, power: Power): number => {
  const byBox = new Map<SpaceId, number>();
  for (const def of Object.values(SPACES)) {
    if (!def.ports || def.ports.length === 0) continue;
    if (G.spaces[def.id]?.control !== power) continue;
    for (const box of def.ports) {
      const current = byBox.get(box) ?? 0;
      // A key/territory port + a naval base in the same box gives 2.
      const add = def.type === "navalBase" ? 2 : 1;
      byBox.set(box, Math.min(2, current + add));
    }
  }
  let total = 0;
  let european = 0;
  for (const [box, value] of byBox) {
    if (EUROPEAN_WATERS.has(box)) {
      if (european >= 3) continue;
      european += 1;
    }
    total += value;
  }
  const naval = unitsOfPower(G, power).filter((u) => u.naval).length;
  return Math.max(0, Math.min(total, naval * 2));
};

export const EUROPEAN_WATERS = new Set<SpaceId>([
  "north-atlantic",
  "baltic-sea",
  "western-mediterranean",
  "eastern-mediterranean",
  "black-sea",
]);

export const refreshPowerProjection = (G: ImperialElegyState): void => {
  for (const power of POWERS) {
    G.powers[power].flags.powerProjection = computePowerProjection(G, power);
  }
};

export const flashpointController = (G: ImperialElegyState, flashpoint: string): Power[] => {
  if (flashpoint === "powerProjection") {
    const ranked = [...POWERS].sort((a, b) => Number(G.powers[b].flags.powerProjection ?? 0) - Number(G.powers[a].flags.powerProjection ?? 0));
    const first = Number(G.powers[ranked[0]].flags.powerProjection ?? 0);
    const second = Number(G.powers[ranked[1]].flags.powerProjection ?? 0);
    const out: Power[] = [];
    if (first > 0) out.push(ranked[0]);
    // Ties for second place do not dominate.
    const tiedSecond = POWERS.filter((p) => p !== ranked[0] && Number(G.powers[p].flags.powerProjection ?? 0) === second);
    if (second > 0 && tiedSecond.length === 1) out.push(ranked[1]);
    return out;
  }
  const counts = new Map<Power, number>();
  for (const def of Object.values(SPACES)) {
    if (!def.flashpoints?.includes(flashpoint)) continue;
    const state = G.spaces[def.id];
    if (!state) continue;
    if (state.rebellion?.rebels.length) continue;
    for (const power of POWERS) {
      if (controlledBy(G, def.id, power)) counts.set(power, (counts.get(power) ?? 0) + 1);
    }
  }
  if (flashpoint === "suez" && G.persistent.suezCanal) {
    const controller = G.spaces.egypt?.control;
    if (isPower(controller)) return [controller];
  }
  const threshold = FLASHPOINTS[flashpoint]?.keys ?? 1;
  const max = Math.max(0, ...counts.values());
  if (max < threshold) return [];
  const leaders = [...counts.entries()].filter(([, n]) => n === max).map(([p]) => p);
  // Ties mean nobody dominates (3.3.2).
  return leaders.length === 1 ? leaders : [];
};

export const dominatedFlashpoints = (G: ImperialElegyState, power: Power): string[] => {
  const out: string[] = [];
  for (const key of Object.keys(FLASHPOINTS)) {
    if (key === "powerProjection" && Number(G.powers[power].flags.powerProjection ?? 0) === 0) continue;
    const controllers = flashpointController(G, key);
    if (controllers.includes(power)) out.push(key);
  }
  return out;
};

export const stabilityEffect = (G: ImperialElegyState, power: Power): StabilityEffect => {
  const p = G.powers[power];
  const table = POWER_DEFS[power].stability;
  const entry = table[Math.max(0, Math.min(table.length - 1, p.stability))];
  return {vp: 0, bm: 0, ...entry};
};

/** Card draw count (10.2). */
export const cardsToDraw = (G: ImperialElegyState, power: Power): number => {
  const p = G.powers[power];
  const def = POWER_DEFS[power];
  const industryCards = def.industryCards[Math.max(0, Math.min(def.industryCards.length - 1, p.industry))] ?? 3;
  let count = industryCards;
  const stab = stabilityEffect(G, power);
  if (stab.cards !== undefined) count = stab.cards;
  if (stab.cardDelta) count += stab.cardDelta;
  // Flashpoint bonuses: +1 or +1/2 rounded down? Printed cards give +1 or half;
  // dominating two half-flashpoints is +1.  We model each domination as a
  // half bonus and round the total up (4.1.1).
  const flashpoints = dominatedFlashpoints(G, power).length;
  count += Math.ceil(flashpoints / 2);
  // National characteristics (India, City of Light, TSRR) now live in one place.
  count += cardDrawModifier(G, power).delta;
  if (power === "GE" && p.flags.plusCards) count += Number(p.flags.plusCards);
  if (power === "UK" && p.flags.plusCards) count += Number(p.flags.plusCards);
  if (power === "FR" && p.flags.plusCards) count += Number(p.flags.plusCards);
  if (power === "AU" && p.flags.plusCards) count += Number(p.flags.plusCards);
  if (power === "RU" && p.flags.plusCards) count += Number(p.flags.plusCards);
  if (power === "OT" && p.flags.plusCards) count += Number(p.flags.plusCards);
  count += p.cardMarkers;
  return Math.max(3, count);
};

/**
 * Optional context for `changeStability`, so callers can tell the national
 * characteristics *why* stability is changing.  Backward compatible: the
 * existing `(G, power, delta, ctx)` call form keeps working.
 */
export interface StabilityChangeOptions {
  /** Why stability is changing.  RU Scorched Earth only triggers on a key loss. */
  cause?: StabilityCause;
  /** The key/space being lost, when applicable. */
  space?: SpaceId;
  /** FR lost a war: Second Empire becomes Third Republic. */
  lostWar?: boolean;
  /** Pre-rolled AU Unstable Situation die (tests / deterministic callers). */
  dieRoll?: number;
}

export const changeStability = (
  G: ImperialElegyState,
  power: Power,
  delta: number,
  ctx?: Ctx,
  options: StabilityChangeOptions = {},
): number => {
  const p = G.powers[power];
  const before = p.stability;
  const lossContext = {
    cause: options.cause,
    space: options.space,
    lostWar: options.lostWar,
    dieRoll: options.dieRoll,
  };
  let result = stabilityLoss(G, power, delta, lossContext);
  // AU Unstable Situation needs a die only when it actually applies, so roll
  // lazily rather than consuming randomness for every stability loss.
  if (result.unstableSituation.applies && result.unstableSituation.dieRoll === null) {
    result = stabilityLoss(G, power, delta, {...lossContext, dieRoll: ctx ? die(ctx, 6) : 1});
  }
  // Scorched Earth is consumed by the key loss it absorbs (33.5).
  if (result.scorchedEarth.consumes) p.scorchedEarth = false;
  p.stability = result.stabilityAfter;
  if (result.government.changed) {
    p.government = result.government.to;
    log(G, power, "frThirdRepublic", {});
  }
  if (result.unstableSituation.applies && result.unstableSituation.passes === false) {
    // 33.4 Unstable Situation: discard a random card, or take a -1 card marker
    // when there is no card to discard.  The marker is the same `cardMarkers`
    // counter that `cardsToDraw` adds to the hand size.
    const eligible = p.hand.filter((id) => id !== p.selectedHomeCard && cardById(id).kind !== "home");
    let discarded: CardId | null = null;
    if (eligible.length > 0) {
      const roll = ctx ? die(ctx, eligible.length) : 1;
      const index = Math.max(0, Math.min(eligible.length - 1, roll - 1));
      discarded = eligible[index];
      discardCard(G, power, discarded, "auUnstableDiscard");
    } else {
      p.cardMarkers -= 1;
    }
    log(G, power, "auUnstable", {
      roll: result.unstableSituation.dieRoll,
      rights: result.unstableSituation.rights,
      discarded,
      marker: discarded === null,
    });
  }
  if (G.gw?.active && p.stability <= 0) {
    eliminatePower(G, power, ctx, "stability");
  }
  return p.stability - before;
};

/**
 * 30.1: remove every unit owned by `owner` from play (map, ports and boxes).
 * Shared by `eliminatePower` (player powers) and `surrenderGwMajor` (the US and
 * unified Italy) so every GW surrender cleans up the same way.  It deletes
 * units directly — the surrender is not a combat elimination, so it must not
 * charge the US stability or fill Italy's build box (`removeUnit` does both).
 *
 * 15.3/30.1: the owner's occupation markers leave play too.  Persistence keeps
 * an occupation marker on the map after its units leave, but a power that has
 * left the game cannot keep occupying anything (its former territory is read
 * from `control`, not from `occupiedBy`).  Both callers are elimination paths,
 * so no live occupation is lost.
 * Returns the number removed.
 */
export const removeAllUnitsOf = (G: ImperialElegyState, owner: PowerOrMinor): number => {
  let removed = 0;
  for (const [id, unit] of Object.entries(G.units)) {
    if (unit.owner !== owner) continue;
    delete G.units[id];
    for (const state of Object.values(G.spaces)) {
      state.units = state.units.filter((unitId) => unitId !== id);
    }
    removed += 1;
  }
  for (const state of Object.values(G.spaces)) {
    if (state.occupiedBy === owner) state.occupiedBy = null;
  }
  return removed;
};

/**
 * 30.1: align the single bonus-impulse marker with the elimination.  The
 * eliminated power's initiative slot becomes a bonus impulse for its alliance,
 * but "only one alliance can have a bonus impulse on the wartime initiative
 * track": if the other alliance already owns the marker, both markers are
 * removed and the player initiative markers move up to fill the vacated slots.
 *
 * The track itself stays the generic `"bonus"` order entry; `bonusImpulseSide`
 * records which alliance owns it so the side is not re-derived from the new
 * (and possibly equal) alliance sizes.
 */
const syncEliminationBonusImpulse = (
  G: ImperialElegyState,
  leaving: Power | "IT" | "US",
  side: GwSide | null,
): void => {
  const gw = G.gw;
  if (!gw) return;
  const slotIndex = gw.order.indexOf(leaving);
  if (slotIndex < 0) return;
  // Removing/compacting order entries shifts every later index.  Keep the
  // maneuver cursor on the slot it was actually pointing at so the rest of the
  // turn still visits every remaining power exactly once.
  const cursorSlot = Number.isInteger(G.turnIndex) && G.turnIndex >= 0 ? gw.order[G.turnIndex] : undefined;
  const realignCursor = (): void => {
    if (cursorSlot === undefined || cursorSlot === null) return;
    G.turnIndex = gw.order.indexOf(cursorSlot);
  };
  const livingCount = (powers: readonly Power[]): number =>
    powers.filter((power) => G.powers[power] && !G.powers[power].eliminated).length;
  const counts = {te: livingCount(gw.te), ta: livingCount(gw.ta)};
  const existing = gw.order.some((slot) => slot === "bonus");
  const derivedSide: GwSide | null = counts.te === counts.ta ? null : counts.te < counts.ta ? "te" : "ta";
  const ownedSide: GwSide | null = gw.bonusImpulseSide ?? (existing ? derivedSide : null);

  if (side === null) {
    // A neutral eliminated outside the war has no alliance to give the marker to.
    gw.order = gw.order.filter((slot) => slot !== leaving);
    realignCursor();
    return;
  }
  if (existing && ownedSide !== side) {
    // The other alliance would also gain a marker: remove both and compact the
    // track so every remaining player initiative marker moves up.
    gw.order = gw.order.filter((slot) => slot !== "bonus" && slot !== leaving);
    gw.bonusImpulseSide = null;
    realignCursor();
    log(G, undefined, "gwBonusImpulseRemoved", {te: counts.te, ta: counts.ta, reason: "elimination"});
    return;
  }
  if (existing) {
    // This alliance already has its one marker; its own marker stays, and the
    // eliminated power's slot is simply vacated.
    gw.order = gw.order.filter((slot) => slot !== leaving);
    realignCursor();
    return;
  }
  gw.order = gw.order.map((slot) => (slot === leaving ? "bonus" : slot));
  gw.bonusImpulseSide = side;
  realignCursor();
  log(G, undefined, "gwBonusImpulse", {side, te: counts.te, ta: counts.ta, reason: "elimination"});
};

/**
 * 30.1: "If any of the eliminated player's allies were actively fighting in the
 * GW, replace the eliminated player's ally marker with an ally marker belonging
 * to a member of their alliance ... If there are two remaining powers in the
 * alliance and they cannot agree which receives the minor powers, use a die
 * roll to resolve it."
 *
 * The engine has no negotiation channel, so the heir is deterministic: the
 * surviving member earliest in the wartime initiative order, then printed seat
 * order.  When no alliance member survives the markers leave play.
 */
const reassignMinorAllyMarkers = (
  G: ImperialElegyState,
  leaving: Power | "IT" | "US",
  side: GwSide | null,
): void => {
  if (!G.gw || !isPower(leaving)) return;
  const roster = side === null ? [] : side === "te" ? G.gw.te : G.gw.ta;
  const survivors = roster
    .filter((power) => power !== leaving && G.powers[power] && !G.powers[power].eliminated)
    .sort((a, b) => {
      const ia = G.gw!.order.indexOf(a);
      const ib = G.gw!.order.indexOf(b);
      const orderA = ia < 0 ? Number.MAX_SAFE_INTEGER : ia;
      const orderB = ib < 0 ? Number.MAX_SAFE_INTEGER : ib;
      return orderA - orderB || POWER_ORDER[a] - POWER_ORDER[b];
    });
  const heir: Power | null = survivors[0] ?? null;
  for (const space of Object.keys(G.spaces).sort()) {
    const state = G.spaces[space];
    if (!state || state.ally !== leaving) continue;
    state.ally = heir;
    log(G, heir ?? leaving, "allyMarkerReassigned", {
      space,
      from: leaving,
      to: heir ?? "",
      side: side ?? "",
    });
  }
};

/**
 * 30.1 GW Surrender and Elimination: the marker bookkeeping every surrender
 * path shares.  Called by `eliminatePower` for a player power and by
 * `surrenderGwMajor` for the US / unified Italy:
 *
 *  - the Alliance Track chit is removed (a player's chit leaves the track;
 *    Italy's 25.3 chit goes back to neutral);
 *  - the wartime initiative slot becomes a bonus impulse for the alliance,
 *    enforcing the one-marker rule and compacting the track when both
 *    alliances would hold one;
 *  - the eliminated player's minor-power ally markers are transferred to a
 *    surviving alliance member (deterministically) or removed.
 */
export const removeGwSurrenderMarkers = (
  G: ImperialElegyState,
  leaving: Power | "IT" | "US",
  side: GwSide | null,
): void => {
  if (!G.gw) return;
  if (isPower(leaving)) {
    // 30.1: "remove ... their marker on the Alliance track".  A GW-eliminated
    // power no longer counts as being in an alliance, which also reopens an
    // 8.4 alliance slot.
    G.powers[leaving].alliance = "neutral";
    G.gw.bonusImpulses = G.gw.bonusImpulses.filter((entry) => entry !== leaving);
  } else if (leaving === "IT") {
    // 25.3 / 30.2: Italy's chit goes back to the neutral box (both the GW copy
    // and the persistent mirror) and can never be shifted again (a surrendered
    // major cannot re-enter).
    G.gw.italyAlliance = "neutral";
    G.persistent.italyAlliance = "neutral";
    G.gw.bonusImpulses = G.gw.bonusImpulses.filter((entry) => entry !== "IT");
  } else {
    // 25.2 / 30.2: the same cleanup for the US alliance chit, whose position
    // lives only in the persistent mirror (`usAllianceBox` reads it back as the
    // neutral box).  Symmetric with the Italy branch above.
    G.persistent.usAlliance = "neutral";
    G.gw.bonusImpulses = G.gw.bonusImpulses.filter((entry) => entry !== "US");
  }
  syncEliminationBonusImpulse(G, leaving, side);
  reassignMinorAllyMarkers(G, leaving, side);
};

/**
 * Remove a power from the game (30.1 GW surrender/elimination).  Its units and
 * its alliance/belligerent markers leave play.  Already-eliminated powers are
 * left untouched so a repeated check (battle advance plus the winter safety
 * net) cannot double-surrender or double-log the same power.
 */
export const eliminatePower = (
  G: ImperialElegyState,
  power: Power,
  ctx?: Ctx,
  cause?: "stability" | "capital",
): void => {
  const p = G.powers[power];
  if (p.eliminated) return;
  // 30.1: capture the alliance before the rosters lose the power.
  const side = gwSideOfPower(G, power);
  p.eliminated = true;
  removeAllUnitsOf(G, power);
  log(G, power, "powerEliminated", cause === undefined ? {} : {cause});
  if (G.gw) {
    // 30.1: capture the minors under this power before its ally markers move.
    const controlledMinors = minorsControlledBy(G, power);
    removeGwSurrenderMarkers(G, power, side);
    // 30.1: minors the surviving alliance did not inherit are disbanded by
    // 15.6/5.7 instead of leaving orphaned units on the map.
    sweepOrphanedMinorUnits(G, {leaving: power, candidates: controlledMinors});
    // 30.1 / 15.6: allied units in the eliminated power's territory displace by
    // 5.7.  Runs after the marker bookkeeping so the territory is no longer
    // friendly to the departed power's former allies while they leave it.
    displaceAlliedUnitsInTerritory(G, power, side);
    G.gw.te = G.gw.te.filter((x) => x !== power);
    G.gw.ta = G.gw.ta.filter((x) => x !== power);
    G.gw.belligerents = G.gw.belligerents.filter((x) => x !== power);
  }
};

export const changeWtt = (G: ImperialElegyState, delta: number, ctx?: Ctx, incitingCard?: string): number => {
  const before = G.wtt;
  G.wtt = Math.max(0, Math.min(5, G.wtt + delta));
  if (G.wtt >= 5 && before < 5 && !G.gw?.active) {
    // The crisis roll is handled by the caller so it can apply card text first.
    log(G, undefined, "wttMax", {incitingCard});
  }
  return G.wtt - before;
};

/**
 * 15.3 / 16.2: write a formal control marker and retire a now-stale occupation
 * marker.
 *
 * Occupation persistence (15.3) keeps `occupiedBy` after the occupying units
 * leave, until the war ends.  A direct control write — an event, treaty,
 * unification or surrender bookkeeping path — supersedes that occupation, so
 * every such write must clear the marker when the control actually changes.
 * Keeping the old marker is what allowed an event to leave a space both
 * controlled by the new owner and "occupied" by an old one.
 *
 * Passing `null` leaves a live occupation marker alone: an uncontrolled space
 * may still be occupied by an enemy until the war ends.
 */
export const setSpaceControl = (
  G: ImperialElegyState,
  space: SpaceId,
  control: PowerOrMinor | null,
  options: {clearInfluence?: boolean; clearDiplomacy?: boolean; preserveOccupation?: boolean} = {},
): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  const changed = state.control !== control;
  state.control = control;
  // A formal control write supersedes any 15.3 occupation, even when the
  // control value itself is unchanged (e.g. a treaty freeing a home space that
  // was already controlled by its owner but still carried an enemy marker).
  if (control !== null && control !== undefined && options.preserveOccupation !== true) {
    state.occupiedBy = null;
  }
  if (options.clearInfluence === true) state.influence = null;
  if (options.clearDiplomacy === true) state.diplomacy = null;
  return changed;
};

export const log = (G: ImperialElegyState, power: Power | undefined, key: string, args?: Record<string, unknown>): void => {
  G.log.push({id: G.nextLogId++, turn: G.turn, phase: G.phase, power, key, args});
};

export const powerLabel = (p: Power): string => POWER_DEFS[p].name;

export const adjacentForLandMove = (id: SpaceId): SpaceId[] => neighboursOf(id);

export const allConnections = (): typeof CONNECTIONS => CONNECTIONS;

export const canTraceNaval = (G: ImperialElegyState, power: Power, from: SpaceId, to: SpaceId): boolean => {
  if (from === to) return true;
  const visited = new Set<SpaceId>([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (visited.has(next) || !isNavalBox(next)) continue;
      const conn = connectionsOf(current).find((c) => (c.a === current ? c.b : c.a) === next);
      if (conn?.type !== "sea") continue;
      // Suez is closed until built and can be blocked by its controller.
      if (crossesSuez(current, next) && !G.persistent.suezCanal) continue;
      if (current === "eastern-mediterranean" && next === "indian-ocean" && G.persistent.suezBlockedBy !== undefined) {
        if (G.persistent.suezBlockedBy !== power) continue;
      }
      if (next === to) return true;
      visited.add(next);
      queue.push(next);
    }
  }
  return false;
};

export const crossesSuez = (a: SpaceId, b: SpaceId): boolean =>
  (a === "eastern-mediterranean" && b === "indian-ocean") || (a === "indian-ocean" && b === "eastern-mediterranean");

/**
 * 29.1 / 29.2: whether a sea hop between two naval boxes is open for this
 * power's LoC.  It applies the same Suez and Dardanelles geography as naval
 * movement, so a blockaded or colonial LoC cannot slip through a closed canal
 * or a refused strait.
 */
export const navalHopPassable = (
  G: ImperialElegyState,
  power: Power,
  a: SpaceId,
  b: SpaceId,
): boolean => {
  if (!isNavalBox(a) || !isNavalBox(b)) return true;
  if (crossesClosedSuez(G, power, a, b)) return false;
  if (isDardanellesCrossing(a, b) && !hasDardanellesPermission(G, power)) return false;
  return true;
};

/**
 * 3.4 / 12.3: one Suez hop.  The canal must be built and, once a power closes
 * it, only that power may pass.  Shared by naval movement and by every LoC
 * trace that follows a sea route (29.1 blockade, 29.2 colonial war).
 */
export const crossesClosedSuez = (
  G: ImperialElegyState,
  power: Power,
  a: SpaceId,
  b: SpaceId,
): boolean => {
  if (!crossesSuez(a, b)) return false;
  if (G.persistent.suezCanal !== true) return true;
  const blockedBy = G.persistent.suezBlockedBy;
  return typeof blockedBy === "string" && blockedBy !== power;
};

/** 3.4.1: Istanbul's controller also controls the Dardanelles. */
export const dardanellesController = (G: ImperialElegyState): Power | null => {
  const controller = G.spaces.dardanelles?.control ?? G.spaces.istanbul?.control ?? null;
  return isPower(controller) ? controller : null;
};

export const isDardanellesCrossing = (a: SpaceId, b: SpaceId): boolean =>
  (a === "black-sea" && b === "eastern-mediterranean") ||
  (a === "eastern-mediterranean" && b === "black-sea");

/**
 * 3.4.1: whether this power may pass without asking the controller.  Only the
 * controller itself passes freely; everyone else — ally, neutral or enemy — must
 * have a live grant recorded for this turn.
 */
export const hasDardanellesPermission = (G: ImperialElegyState, power: Power): boolean => {
  const controller = dardanellesController(G);
  if (controller === null || controller === power) return true;
  const grants = [
    ...(Array.isArray(G.dardanellesPassages) ? G.dardanellesPassages : []),
    ...(G.dardanellesPassage === undefined || G.dardanellesPassage === null ? [] : [G.dardanellesPassage]),
  ];
  return grants.some((granted) => {
    if (granted.requesting !== power || granted.granting !== controller) return false;
    if (granted.turn !== G.turn) return false;
    return G.gw?.active ? granted.gwTurn === G.gw.turn : granted.gwTurn === undefined;
  });
};

export const isPort = (id: SpaceId): boolean => (portBoxes(id).length > 0);

export const allPortsOf = (box: SpaceId): SpaceId[] =>
  Object.values(SPACES).filter((s) => s.ports?.includes(box)).map((s) => s.id);

/**
 * All current key spaces.  With a state argument, dynamic key overrides are
 * honoured (Egypt after a UK/FR Urabi win); without one it is the printed map.
 */
export const keySpaces = (G?: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter((s) => (G ? effectiveKeyType(G, s.id) !== undefined : isKey(s.id)))
    .map((s) => s.id);

export const expectedKeyTotals = CAMPAIGN_SETUP.powers;

// ---------------------------------------------------------------------------
// 15.6 / 30.1 allied-unit displacement out of a departed power's territory
// ---------------------------------------------------------------------------

/**
 * One 5.7 displacement caused by 15.6/30.1.  Mirrors the generic
 * `UnitDisplacementResult` in `effects.ts`; it is declared here so the
 * elimination hooks in `rules.ts` / `gwMajors.ts` / `limitedWar.ts` can use it
 * without importing the card-effect layer (`effects.ts` imports this module).
 */
export interface TerritoryDisplacementResult {
  unitId: string;
  owner: PowerOrMinor;
  from: SpaceId;
  /** Destination, or null when the unit had nowhere legal to go and was eliminated. */
  to: SpaceId | null;
  kind: "land" | "naval";
  eliminated: boolean;
}

/** The `SpaceState.control` values that make a space a major's territory. */
const territoryControlNames = (leaving: Power | "IT" | "US"): string[] =>
  leaving === "US" ? ["US", "United States"] : [leaving];

const closestLandSpace = (
  G: ImperialElegyState,
  from: SpaceId,
  accept: (space: SpaceId) => boolean,
): SpaceId | null => {
  if (!G.spaces[from]) return null;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next) || isNavalBox(next)) continue;
      seen.add(next);
      if (accept(next)) return next;
      queue.push(next);
    }
  }
  return null;
};

/**
 * 5.7: "Displaced land units are moved to the closest friendly controlled
 * space with a LoC."  A player power uses its own network; a minor (including
 * Poland) displaces to its controller's network, or, when it has none, to its
 * own controlled space with a LoC (5.6.1).  The 15.6/30.1 displacement is out
 * of the departed power's territory, so that territory is never a destination.
 */
const territoryLandTarget = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  from: SpaceId,
  territory: ReadonlySet<string>,
): SpaceId | null => {
  // A unit is displaced *out of* the departed power's territory, so no space
  // of that territory is a destination even when it is friendly/occupied.
  const outside = (space: SpaceId): boolean => !territory.has(space);
  if (owner === "US" || owner === "IT") {
    // 5.7 for a non-player major: its own spaces are friendly, and it may also
    // use an alliance member's friendly space with a LoC.
    const side = gwMajorSide(G, owner);
    if (side === null || !G.gw) return null;
    const own = owner === "US" ? ["US", "United States"] : ["IT"];
    const roster = side === "te" ? G.gw.te : G.gw.ta;
    const accept = (space: SpaceId): boolean => {
      if (!outside(space)) return false;
      if (own.includes(String(G.spaces[space]?.control))) return true;
      return roster.some(
        (power) => !G.powers[power]?.eliminated && friendlySpace(G, space, power) && hasLoc(G, power, space),
      );
    };
    return closestLandSpace(G, from, accept);
  }
  const controller = isPower(owner) ? owner : minorController(G, owner) ?? minorUpkeepPower(G, owner);
  const accept = controller !== null
    ? (space: SpaceId): boolean => outside(space) && friendlySpace(G, space, controller) && hasLoc(G, controller, space)
    : (space: SpaceId): boolean => outside(space) && minorFriendlySpace(G, owner, space) && minorHasLoc(G, owner, space);
  return closestLandSpace(G, from, accept);
};

/**
 * 5.7: "Naval units displace to an adjacent naval box."  Adjacent boxes are
 * tried in id order, preferring one without hostile units; a Suez crossing
 * still requires the canal to be open.
 */
const territoryNavalTarget = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  from: SpaceId,
): SpaceId | null => {
  const boxes = neighboursOf(from)
    .filter((next) => isNavalBox(next))
    .filter((next) => !(crossesSuez(from, next) && G.persistent.suezCanal !== true))
    .sort();
  if (boxes.length === 0) return null;
  const hostile = (box: SpaceId): boolean =>
    unitsIn(G, box).some((unit) => unit.owner !== owner && isPower(owner) && hostileOwner(G, owner, unit.owner));
  return boxes.find((box) => !hostile(box)) ?? boxes[0];
};

/**
 * 15.6: "displace any allied units in their territory.  Do not displace any
 * enemy units in occupied spaces, those units will displace at the end of the
 * war."  Only units friendly to the departed power are candidates; its own
 * units are handled by the caller (30.1 removes them).
 */
const unitAlliedToLeaving = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  leaving: Power | "IT" | "US",
  side: GwSide | null,
): boolean => {
  if (owner === leaving) return false;
  if (isPower(owner)) {
    if (side !== null && G.gw) return (side === "te" ? G.gw.te : G.gw.ta).includes(owner);
    return isPower(leaving) && allied(G, leaving, owner);
  }
  if (owner === "US" || owner === "IT") return side !== null && gwMajorSide(G, owner) === side;
  const controller = minorController(G, owner) ?? minorUpkeepPower(G, owner);
  if (controller === null) return false;
  if (side !== null && G.gw) return (side === "te" ? G.gw.te : G.gw.ta).includes(controller);
  return isPower(leaving) && allied(G, leaving, controller);
};

const moveDisplacedUnit = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  const from = unit.space;
  if (from && G.spaces[from]) G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
  if (!G.spaces[to].units.includes(unit.id)) G.spaces[to].units.push(unit.id);
  unit.space = to;
};

/**
 * 30.1: the minor powers whose units were under `power`'s control before its
 * alliance markers are reassigned.  Both the ally-marker spaces and the units
 * themselves are inspected so a minor controlled through a non-home space is
 * still found.
 */
const minorsControlledBy = (G: ImperialElegyState, power: Power): Set<string> => {
  const out = new Set<string>();
  for (const state of Object.values(G.spaces)) {
    if (state.ally !== power) continue;
    if (state.control === null || isPower(state.control)) continue;
    if (state.control === "US" || state.control === "IT") continue;
    out.add(String(state.control));
  }
  for (const unit of Object.values(G.units)) {
    if (isPower(unit.owner) || unit.owner === "US" || unit.owner === "IT") continue;
    if ((minorController(G, unit.owner) ?? minorUpkeepPower(G, unit.owner)) === power) out.add(unit.owner);
  }
  return out;
};

/**
 * 30.1 / 15.6 / 5.7: one minor-unit sweep result (also returned for tests).
 * `permanent` marks a minor that has left play for good, so its counters are
 * removed rather than displaced.
 */
export interface MinorSweepResult {
  minor: string;
  permanent: boolean;
  displaced: number;
  eliminated: number;
}

/**
 * Remove every counter owned by a permanently eliminated minor, together with
 * any elite step attached to one of its units (33.1 removes those too).  Its
 * 15.3 occupation markers leave play with it.
 */
const removeMinorUnitsPermanently = (G: ImperialElegyState, minor: string): number => {
  const removed = new Set<string>();
  for (const [id, unit] of Object.entries(G.units)) {
    if (unit.owner === minor) removed.add(id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [id, unit] of Object.entries(G.units)) {
      if (removed.has(id)) continue;
      if (unit.attachedTo !== undefined && unit.attachedTo !== null && removed.has(unit.attachedTo)) {
        removed.add(id);
        grew = true;
      }
    }
  }
  for (const id of removed) {
    const unit = G.units[id];
    if (unit?.space && G.spaces[unit.space]) {
      G.spaces[unit.space].units = G.spaces[unit.space].units.filter((unitId) => unitId !== id);
    }
    delete G.units[id];
  }
  for (const state of Object.values(G.spaces)) {
    if (state.occupiedBy === minor) state.occupiedBy = null;
  }
  return removed.size;
};

/**
 * 30.1: an eliminated commander's ally marker on a minor leaves play.  Both
 * lookup paths of `minorController` are cleared: the minor's home space (whose
 * `ally` marker survives even when the space itself was captured) and any
 * space the minor still controls.
 */
const clearEliminatedCommander = (G: ImperialElegyState, minor: string, commander: Power): void => {
  const home = MINOR_POWER_HOMES[minor];
  for (const [space, state] of Object.entries(G.spaces)) {
    if (state.ally !== commander) continue;
    if (state.control === minor || space === home) state.ally = null;
  }
};

/**
 * 30.1 / 15.6 / 5.7: sweep minor-power units that have no surviving commander.
 *
 * Two cases are caught, including minors that were not controlled by the
 * eliminated power at the instant it left:
 *
 *  - permanently eliminated minors (`G.eliminatedMinors`, or a 22.2 Italian
 *    minor after unification) lose every remaining counter — they have no home
 *    to withdraw to;
 *  - minors whose controlling player is gone (or that were handed to this
 *    sweep through `candidates` when their ally marker could not be inherited)
 *    follow 5.7 for an independent minor: a unit already standing in a friendly
 *    space with a LoC stays, a land unit withdraws to the closest such space, a
 *    naval unit displaces to an adjacent naval box, and a unit with no legal
 *    destination is eliminated.
 *
 * Deterministic (sorted minor ids, sorted unit ids) and idempotent: once a
 * minor has no units left it produces no further log entry.  The whole sweep is
 * logged once per minor under `minorUnitsDisbanded`.
 */
export const sweepOrphanedMinorUnits = (
  G: ImperialElegyState,
  options: {
    /** The power whose elimination (or the winter step) triggered the sweep. */
    leaving?: Power | "IT" | "US" | null;
    /** Minors that had a commander at elimination time but may have lost it. */
    candidates?: Iterable<string>;
  } = {},
): MinorSweepResult[] => {
  const handedOver = new Set<string>(options.candidates ?? []);
  const permanent = new Set<string>(G.eliminatedMinors ?? []);
  // 22.2: a unified Italy's minor states cease to exist; a save that predates
  // the `eliminatedMinors` write still has to sweep their remaining units.
  if (G.persistent.italyUnified === true) {
    for (const minor of ITALIAN_MINOR_POWERS) permanent.add(minor);
  }
  const candidates = new Set<string>(permanent);
  for (const minor of handedOver) candidates.add(minor);
  for (const unit of Object.values(G.units)) {
    if (isMinorPowerOwner(unit.owner)) candidates.add(unit.owner);
  }
  const results: MinorSweepResult[] = [];
  for (const minor of [...candidates].sort()) {
    if (!isMinorPowerOwner(minor)) continue;
    const units = Object.values(G.units).filter((unit) => unit.owner === minor);
    if (units.length === 0) continue;
    const isPermanent = permanent.has(minor);
    const commander = minorController(G, minor) ?? minorUpkeepPower(G, minor);
    const commanderGone = commander !== null && G.powers[commander]?.eliminated === true;
    // A minor that still has a living commander keeps its units (including the
    // heir that inherited a knocked-out player's ally marker).  Only a minor
    // that lost its commander to this elimination (`handedOver` with no heir)
    // or an already-dead commander is swept; an independent minor with no
    // commander is a legitimate power and is left alone.
    const lostCommander = commander === null && handedOver.has(minor);
    if (!isPermanent && !commanderGone && !lostCommander) continue;
    const actor = isPower(options.leaving) ? options.leaving : undefined;
    const ids = units
      .filter((unit) => unit.space !== null && unit.space !== undefined)
      .map((unit) => unit.id)
      .sort();
    if (isPermanent) {
      const eliminated = removeMinorUnitsPermanently(G, minor);
      log(G, actor, "minorUnitsDisbanded", {
        minor,
        leaving: options.leaving ?? "",
        displaced: 0,
        eliminated,
        units: ids.join(","),
        permanent: true,
      });
      results.push({minor, permanent: true, displaced: 0, eliminated});
      continue;
    }
    // The commander is gone: clear its ally marker first so 5.6.1 traces the
    // minor as an independent power instead of through the dead player.
    if (commanderGone && commander !== null) clearEliminatedCommander(G, minor, commander);
    let displaced = 0;
    let eliminated = 0;
    for (const id of ids) {
      const unit = G.units[id];
      if (!unit || !unit.space) continue;
      const from = unit.space;
      const kind: "land" | "naval" = unit.naval === true ? "naval" : "land";
      const alreadyHome = kind === "land" && minorFriendlySpace(G, minor, from) && minorHasLoc(G, minor, from);
      const to = alreadyHome
        ? from
        : kind === "naval"
          ? territoryNavalTarget(G, minor, from)
          : closestLandSpace(G, from, (space) => minorFriendlySpace(G, minor, space) && minorHasLoc(G, minor, space));
      if (to === null) {
        if (G.spaces[from]) G.spaces[from].units = G.spaces[from].units.filter((unitId) => unitId !== id);
        delete G.units[id];
        eliminated += 1;
        continue;
      }
      if (to !== from) {
        moveDisplacedUnit(G, unit, to);
        displaced += 1;
      }
    }
    log(G, actor, "minorUnitsDisbanded", {
      minor,
      leaving: options.leaving ?? commander ?? "",
      displaced,
      eliminated,
      units: ids.join(","),
      permanent: false,
      reason: commanderGone ? "commanderEliminated" : "noCommander",
    });
    results.push({minor, permanent: false, displaced, eliminated});
  }
  return results;
};

/**
 * 15.6 / 30.1: after a player ally (or Italy/US) leaves the war, every allied
 * unit standing in its formally controlled territory is displaced by 5.7:
 * land units to the closest friendly controlled space with a LoC, naval units
 * to an adjacent naval box, and a unit with no legal destination is eliminated.
 *
 * `side` is the GW side the departed power fought for; it is captured by the
 * caller *before* the surrender clears the alliance markers (for a limited-war
 * 15.6 knockout it is null and the player alliance boxes are used).  The unit
 * list is taken up front so a unit displaced into another territory space is
 * never displaced twice.
 */
export const displaceAlliedUnitsInTerritory = (
  G: ImperialElegyState,
  leaving: Power | "IT" | "US",
  side: GwSide | null = null,
): TerritoryDisplacementResult[] => {
  if (!isPower(leaving) && side === null) return [];
  const controls = territoryControlNames(leaving);
  const territory = new Set(
    Object.keys(G.spaces).filter((space) => controls.includes(String(G.spaces[space]?.control))),
  );
  const ids: string[] = [];
  for (const space of Object.keys(G.spaces).sort()) {
    if (!territory.has(space)) continue;
    for (const id of G.spaces[space].units) {
      const unit = G.units[id];
      if (!unit) continue;
      if (!unitAlliedToLeaving(G, unit.owner, leaving, side)) continue;
      ids.push(id);
    }
  }
  const displaced: TerritoryDisplacementResult[] = [];
  for (const unitId of ids) {
    const unit = G.units[unitId];
    if (!unit || !unit.space) continue;
    const from = unit.space;
    const kind: "land" | "naval" = unit.naval === true ? "naval" : "land";
    const to =
      kind === "naval"
        ? territoryNavalTarget(G, unit.owner, from)
        : territoryLandTarget(G, unit.owner, from, territory);
    const actor = isPower(unit.owner) ? unit.owner : undefined;
    if (to === null) {
      if (G.spaces[from]) G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unitId);
      delete G.units[unitId];
      log(G, actor, "unitDisplaced", {
        unit: unitId,
        owner: unit.owner,
        from,
        to: null,
        kind,
        eliminated: true,
        territory: leaving,
      });
      displaced.push({unitId, owner: unit.owner, from, to: null, kind, eliminated: true});
      continue;
    }
    moveDisplacedUnit(G, unit, to);
    log(G, actor, "unitDisplaced", {
      unit: unitId,
      owner: unit.owner,
      from,
      to,
      kind,
      eliminated: false,
      territory: leaving,
    });
    displaced.push({unitId, owner: unit.owner, from, to, kind, eliminated: false});
  }
  return displaced;
};

// ---------------------------------------------------------------------------
// 5.5.3 / 5.6.2 / 5.6.3 start-of-impulse upkeep
//
// Lives in rules.ts (not moves.ts) so both the move layer and the Great War
// flow can run it without an import cycle.  Only player-owned armies and ships
// are candidates, so a plain step decrement is sufficient and cannot bypass the
// GW non-player-major elimination bookkeeping (US/Italian units are not owned
// by the player and are never candidates here).
// ---------------------------------------------------------------------------

const moveUnitForUpkeep = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  const from = unit.space;
  if (from && G.spaces[from]) G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
  if (!G.spaces[to].units.includes(unit.id)) G.spaces[to].units.push(unit.id);
  unit.space = to;
};

/**
 * 5.6.3: in peacetime a unit with a broken LoC "immediately displaces to a
 * friendly space with a LoC".  The engine checks at the start of the owning
 * player's impulse (the earliest point the owning player is prompted), which
 * is the live fallback for "immediately".
 */
const displacePeacetimeBrokenLoc = (G: ImperialElegyState, power: Power): number => {
  if (G.war !== null || G.gw?.active) return 0;
  let moved = 0;
  for (const space of Object.keys(G.spaces)) {
    if (isNavalBox(space)) continue;
    const armies = landUnitsIn(G, space).filter(
      (unit) => unit.owner === power && isArmyKind(unit.kind) && unit.steps > 0,
    );
    if (armies.length === 0) continue;
    if (!hasLoc(G, power, space)) {
      const target = displacementTargetForLoc(G, power, space);
      if (!target) continue;
      for (const unit of armies) {
        moveUnitForUpkeep(G, unit, target);
        moved += 1;
        log(G, power, "brokenLocDisplaced", {unit: unit.id, from: space, to: target});
      }
    }
  }
  return moved;
};

const applyUpkeepDamage = (G: ImperialElegyState, unitId: string): void => {
  const unit = G.units[unitId];
  if (!unit) return;
  unit.steps -= 1;
  if (unit.steps > 0) return;
  if (unit.space && G.spaces[unit.space]) {
    G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unitId);
  }
  delete G.units[unitId];
};

/** Take one upkeep step from `penalty`; returns the unit that lost it. */
const applyUpkeepStep = (
  G: ImperialElegyState,
  power: Power,
  penalty: ImpulsePenalty,
  unitId?: string,
): string | null => {
  // Candidates are already scoped to `power` (its own units plus the minor
  // armies it pays for under 5.6.2), so the owner filter must not drop minors.
  const live = penalty.candidates.filter((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.steps > 0;
  });
  const target = unitId && live.includes(unitId) ? unitId : live[0];
  if (!target) return null;
  const kind = G.units[target].kind;
  applyUpkeepDamage(G, target);
  log(G, power, "impulseUpkeepLoss", {space: penalty.space, cause: penalty.cause, unit: target, kind});
  return target;
};

/**
 * Apply the remaining penalties in order, auto-resolving stacks with a single
 * eligible unit and opening the owning player's choice when several units can
 * take the step.  Returns true when a decision is left open.
 */
const continueImpulseUpkeep = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  power: Power,
  penalties: ImpulsePenalty[],
  startIndex: number,
): boolean => {
  let index = startIndex;
  while (index < penalties.length) {
    const penalty = penalties[index];
    const live = penalty.candidates.filter((id) => {
      const unit = G.units[id];
      return Boolean(unit) && unit!.steps > 0;
    });
    if (live.length === 0) {
      index += 1;
      continue;
    }
    if (live.length === 1) {
      applyUpkeepStep(G, power, penalty);
      index += 1;
      continue;
    }
    openDecision(G, ctx, decision(
      "impulseLoss",
      power,
      penalty.cause === "overstack"
        ? "Overstacked: choose the unit that takes the step loss"
        : "Broken LoC: choose the unit that takes the step loss",
      live.map((id) => {
        const unit = G.units[id];
        return {id, label: `${unit.kind} (${unit.steps} step${unit.steps === 1 ? "" : "s"}) · ${spaceLabel(penalty.space, "en")}`};
      }),
      {events: penalties, index, cause: penalty.cause, space: penalty.space},
    ));
    return true;
  }
  return false;
};

/**
 * Rule 5.5.3/5.6.2: at the beginning of the owning player's impulse every
 * overstacked stack (and, in wartime/GW, every stack with a broken LoC) loses
 * one step, with the owning player choosing the unit when several qualify.
 * Rule 5.6.3: peacetime broken LoCs displace instead.
 *
 * Called from every impulse-start transition.  The stamp guard makes a second
 * call for the same impulse a no-op, so the penalty never fires twice.
 */
export const beginImpulseUpkeep = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  power: Power = G.activePower,
): boolean => {
  if (G.pending !== null || G.battle !== null) return false;
  if (!G.powers[power] || G.powers[power].eliminated) return false;
  const stamp = `${G.phase}|${G.turn}|${G.turnIndex}|${G.gw?.turn ?? ""}|${G.war?.status ?? ""}|${power}`;
  if (G.flags.impulseUpkeepStamp === stamp) return false;
  G.flags.impulseUpkeepStamp = stamp;
  displacePeacetimeBrokenLoc(G, power);
  const penalties = impulsePenalties(G, power);
  if (penalties.length === 0) return false;
  return continueImpulseUpkeep(G, ctx, power, penalties, 0);
};

/** Resolve the owning player's 5.5.3/5.6.2 choice. */
export const resolveImpulseLoss = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  pending: PendingDecision,
  unitId: string,
): void => {
  const context = pending.context ?? {};
  const penalties = (context.events as ImpulsePenalty[] | undefined) ?? [];
  const index = Number(context.index ?? 0);
  const penalty = penalties[index];
  if (!penalty) return;
  const live = penalty.candidates.filter((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.steps > 0;
  });
  if (!live.includes(unitId)) {
    // Illegal choice: keep the decision open rather than picking for the player.
    continueImpulseUpkeep(G, ctx, pending.power, penalties, index);
    return;
  }
  applyUpkeepStep(G, pending.power, penalty, unitId);
  continueImpulseUpkeep(G, ctx, pending.power, penalties, index + 1);
};

// ---------------------------------------------------------------------------
// `duration: "turn"` card flags
// ---------------------------------------------------------------------------

/**
 * The card flags printed "for the rest of the turn".
 *
 * Every `duration: "turn"` effect in `cards.data.ts` is listed here, plus A41
 * Prussian Military Tradition's `landDrm`, which its dedicated handler writes
 * without a `flag` effect.  The generic `flag` effect writes to the acting
 * power's `flags` bag; a few live readers were historically pointed at
 * `G.flags` (`combatDrm`, `enemyLandDrm`, `gwCombatDrm`, `auNoCitizenship`),
 * so `clearTurnDurationFlags` covers both scopes.
 */
export type TurnDurationFlag =
  | "combatDrm"
  | "siegeGuns"
  | "flankAttack"
  | "enemyLandDrm"
  | "navalDrm"
  | "noMines"
  | "industryDrm"
  | "auNoCitizenship"
  | "frLandDrm"
  | "gwCombatDrm"
  | "noRetreat"
  | "landDrm";

export const TURN_DURATION_FLAG_DEFAULTS: Readonly<Record<TurnDurationFlag, number | boolean>> = Object.freeze({
  combatDrm: 0,
  siegeGuns: false,
  flankAttack: false,
  enemyLandDrm: 0,
  navalDrm: 0,
  noMines: false,
  industryDrm: 0,
  auNoCitizenship: false,
  frLandDrm: 0,
  gwCombatDrm: 0,
  noRetreat: false,
  // A41's dedicated handler (no `flag` effect in the card data).
  landDrm: 0,
});

/**
 * The printed defaults, mirroring every `duration: "turn"` effect in
 * `cards.data.ts` (A43 combatDrm, A58 siegeGuns, A59 flankAttack,
 * A60 enemyLandDrm, A61 navalDrm, A66 noMines, A75 industryDrm,
 * A85 auNoCitizenship, A98 frLandDrm, GW-03/GW-04 gwCombatDrm, GW-06
 * noRetreat) plus A41's `landDrm`.
 */
export const clearTurnDurationFlags = (G: ImperialElegyState): void => {
  for (const [flag, value] of Object.entries(TURN_DURATION_FLAG_DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(G.flags, flag)) G.flags[flag] = value;
    for (const power of POWERS) {
      const flags = G.powers[power]?.flags;
      if (flags && Object.prototype.hasOwnProperty.call(flags, flag)) flags[flag] = value;
    }
  }
};
