/**
 * Imperial Elegy — shared types.
 *
 * The implementation deliberately keeps the state JSON-serializable: it is
 * persisted by boardgame.io and travels over the wire to every client.  Unit
 * counters live in a flat record and stacks are arrays of unit ids.
 */

export type Power = "GE" | "UK" | "FR" | "AU" | "RU" | "OT";

export const POWERS: readonly Power[] = ["GE", "UK", "FR", "AU", "RU", "OT"] as const;

/** Boardgame.io seat order is fixed by the rulebook (4.3): GE, UK, FR, AU, RU, OT. */
export const SEAT_ORDER: readonly Power[] = POWERS;

export type PowerOrMinor = Power | string;

/**
 * Rule 8.5 / 13.4.1 — the MPIT column of a unified Italy.  Italy is not a
 * player power, so its three influence counters cannot live on `PowerState`;
 * they are kept here (public information, like the player MPIT).
 */
export interface ItalyMpit {
  te: number;
  ta: number;
  neutral: number;
}

export type SpaceId = string;
export type CardId = string;
export type GoalId = string;

export type GamePhase =
  | "prep"
  | "diplomacy"
  | "action"
  | "wartime"
  | "end"
  | "gwOutbreak"
  | "gwPlanning"
  | "gwManeuver"
  | "gwWinter"
  | "gameOver";

export type SpaceType = "key" | "capital" | "subcapital" | "territory" | "navalBase" | "navalBox";
export type KeyType = "territorial" | "colonial";
export type Region = "europe" | "africa" | "asia" | "northAmerica" | "pacific" | "naval";
export type Submap = "main" | "africa" | "asia" | "northAmerica" | "naval";
export type ConnectionType = "clear" | "difficult" | "severe" | "sea" | "tsrr";

export type AllianceBox =
  | "neutral"
  | "teAligned"
  | "teCommitted"
  | "taAligned"
  | "taCommitted";

/** The two Great War alliances (25.1): Triple Entente / Triple Alliance. */
export type GwSide = "te" | "ta";

/**
 * GW-10 Exhaustion: the two printed effects.  The choice is queued when the
 * card resolves and only takes effect at the end of the playing impulse.
 */
export type GwExhaustionMode = "stability" | "vp";

/**
 * GW-10 Exhaustion's queued choice.  `turn` is the GW turn whose impulse it
 * was played in, so a stale save cannot fire it in a later turn (and the
 * "neither event triggers on GW turn 0" clause can be re-checked).
 */
export interface GwExhaustionPending {
  mode: GwExhaustionMode;
  power: Power;
  turn: number;
}

export interface SpaceDef {
  id: SpaceId;
  name: string;
  nameZh: string;
  type: SpaceType;
  keyType?: KeyType;
  region: Region;
  submap: Submap;
  /** Ports list the naval boxes this space touches. */
  ports?: string[];
  /** Minor power or player power that considers the space home. */
  home?: Power | null;
  minorHome?: string | null;
  /** Initial control: a power, an independent minor power, or null. */
  control: PowerOrMinor | null;
  /** Initial influence marker, if any. */
  influence?: Power | null;
  /** Flashpoint membership. */
  flashpoints?: string[];
  /** Printed map position (zone centroid from the VASSAL module). */
  x: number;
  y: number;
  /** Polygon in module coordinates. */
  polygon?: number[][];
  /** Special spaces from rules 3.4. */
  special?: "dardanelles" | "suez" | "egypt" | "tripoli" | "istanbul" | "denmark";
  /** Nationalities printed in the space. */
  nationalities?: string[];
  /**
   * 33.6 Local Autonomy: "Tunisia and Tripoli neither count as keys nor for
   * power projection unless OT can trace a LoC to the keys by land."  The two
   * spaces print no `keyType`; this conditional territorial type only applies
   * to the Ottomans, and `recomputeTracks` still applies the land-LoC test.
   */
  otLandLocKeyType?: KeyType;
}

export interface ConnectionDef {
  a: SpaceId;
  b: SpaceId;
  type: ConnectionType;
  /** For sea connections: the naval box or port pair. */
  note?: string;
}

export type UnitKind =
  | "army"
  | "reserveArmy"
  | "eliteCorps"
  | "expeditionary"
  | "eliteColonialEf"
  | "zouave"
  | "squadron"
  | "dreadnought"
  | "rebelArmy"
  | "italianArmy"
  | "usArmy"
  | "minorArmy";

export interface Unit {
  id: string;
  kind: UnitKind;
  /** Player power, minor power name, "REBEL:<name>", "IT", or "US". */
  owner: PowerOrMinor;
  /** Steps remaining: 2 = full, 1 = reduced, EC/EF = 1. */
  steps: number;
  space?: SpaceId | null;
  /** Naval units sit in a naval box or a port. */
  naval?: boolean;
  /** Attached to an army for ECs. */
  attachedTo?: string | null;
  /** Elite units have one step only. */
  elite?: boolean;
  /** Indian / Arab / scenario-specific markers. */
  flags?: Record<string, boolean | string | number>;
}

export interface Fort {
  power: PowerOrMinor;
  level: 1 | 2 | 3;
  /** Indian fort never degrades (33.2.3). */
  indian?: boolean;
  /**
   * Rule 20.1: this phase's Militarism benefit protects the fort from the 20.2
   * degradation.  The 20.2 step consumes (and clears) the flag immediately
   * afterwards, so it never survives into another end phase.
   */
  protectedThisPhase?: boolean;
}

export interface Rebellion {
  minor: string;
  /** 0 or +1 WoI marker (rules 20.8). */
  step: 0 | 1;
  /** Rebel armies are hostile to everybody unless liberated. */
  rebels: string[];
}

export interface SpaceState {
  control: PowerOrMinor | null;
  /** Dynamic home-space changes (unification, annexation). */
  homeOverride?: Power | null;
  /**
   * Dynamic key classification.  A71 Urabi Revolt makes the Egyptian spaces
   * colonial home spaces for a UK/FR winner, so the Egypt key must count as a
   * colonial key for that player instead of the printed territorial key.
   */
  keyTypeOverride?: KeyType;
  /** Wartime occupation is distinct from control (15.3). */
  occupiedBy?: PowerOrMinor | null;
  influence?: Power | null;
  diplomacy?: Power | null;
  ally?: Power | null;
  fort?: Fort | null;
  /** Pacification value (0, 1, 2, ...). */
  pacification?: number;
  rebellion?: Rebellion | null;
  units: string[];
  /** Trench battle marker (GW). */
  trench?: { status: "attacker" | "deadlock" | "defender"; turn: number } | null;
  /**
   * GW terrain: the space contains trenches.  Rule 28.1 gives every key a
   * trench from GW turn 1; the battle *marker* above is only placed once an
   * attacker has entered the space.  Optional for older saves.
   */
  trenchLine?: boolean;
}

export interface PowerState {
  stability: number;
  manpower: number;
  /** UK colonial manpower / OT Arab manpower. */
  secondaryManpower?: number;
  industry: number;
  territorialKeys: number;
  colonialKeys: number;
  /** OT Arab keys. */
  arabKeys?: number;
  /** Markers / once-per-game flags. */
  cityOfLight?: number;
  citizenship: string[];
  rights: string[];
  /** Second Empire vs Third Republic (FR). */
  government?: "secondEmpire" | "thirdRepublic";
  /** GE unification state. */
  unified?: boolean;
  /** RU TSRR completion. */
  tsrr?: boolean;
  /** RU Scorched Earth still available. */
  scorchedEarth?: boolean;
  /** OT Jihad markers. */
  jihad?: number;
  /** UK India stability. */
  indiaStable?: boolean;
  /** UK imperial stability / India independent. */
  indiaIndependent?: boolean;
  /**
   * 33.2 Rapid Deployment: the once-per-war free naval movement action the UK
   * receives when it enters a war (including the Great War).  `scope` records
   * which war granted it and `spent` is set when the action is used or
   * declined, so the grant is never offered twice for the same war.
   */
  rapidDeployment?: RapidDeploymentGrant | null;
  /** Counters / cards. */
  hand: CardId[];
  homeCards: CardId[];
  selectedHomeCard: CardId | null;
  goals: GoalId[];
  goalDeck: GoalId[];
  /** VP scored so far (end of turn 7 / GW outbreak). */
  vp: number;
  alliance: AllianceBox;
  mpit: { te: number; ta: number; neutral: number };
  /** Reserve armies held off map. */
  reserves: string[];
  /** CP chain cards (max 2). */
  cpChain: CardId[];
  /** Industrialization card. */
  industryCard: CardId | null;
  autoIndustry: boolean;
  /** Generic persistent card flags, e.g. machineGuns. */
  flags: Record<string, number | boolean | string>;
  /** Wartime / GW bookkeeping. */
  warBudget?: number;
  gwBudget?: number;
  gwCard?: CardId | null;
  gwHandLimit?: number;
  eliminated?: boolean;
  /**
   * 29.1 blockade: the player's current *maximum* industry level.  The printed
   * display maximum is 7 for Germany and 6 for every other power
   * (`POWER_DEFS[power].industryCards.length - 1`); a blockaded player's
   * maximum drops by one at the end of every GW year (never below 3) and the
   * current industry is clamped to it.  Optional so older saves and
   * hand-written test states fall back to the printed maximum.
   */
  maxIndustry?: number;
  /** Bonus card markers (+1 / -1). */
  cardMarkers: number;
}

/**
 * 20.3 — Non-Player Power Build Step bookkeeping.
 *
 * `minors` is the End Phase Build Box roster (3.5): the minor powers that may
 * take an army step each end phase.  `italy` counts destroyed Italian units
 * waiting in the box's Italy space, which 22.4 rebuilds when Italy is unified.
 * Optional so saves and test states created before the build box existed still
 * load; `endPhase.ts#buildBoxOf` falls back to the printed campaign roster.
 */
export interface NonPlayerBuildBox {
  minors: string[];
  italy: {italianArmy: number; squadron: number; dreadnought: number};
  /**
   * Rule 22.5(1): the Polish reserve armies holding box (3.8).  The Polish 4th
   * and 5th armies are reserve-army counters that live here during peacetime
   * and may be deployed by the player controlling Poland during wartime.
   * Optional so saves and hand-written test states created before Poland was
   * modelled still load; `engine/poland.ts` creates it when Poland becomes
   * independent.
   */
  poland?: PolishReserveBox;
}

/** Rule 22.5: the two Polish reserve-army counters held off map (3.8). */
export interface PolishReserveBox {
  /** Unit ids of the reserve armies currently held in the Polish box. */
  reserveArmies: string[];
}

export interface LogEntry {
  id: number;
  turn: number;
  phase: GamePhase;
  power?: Power;
  key: string;
  args?: Record<string, unknown>;
  /** Public text is rendered from the key + args by the board. */
  text?: string;
}

/**
 * 33.2 Rapid Deployment: one free naval movement action, granted the first time
 * the UK enters a given war (a limited war or the Great War).
 */
export interface RapidDeploymentGrant {
  /** Which war the grant belongs to. */
  scope: "limited" | "gw";
  /** Turn of the grant (public bookkeeping only). */
  turn: number;
  /** True once the free action has been used or deliberately declined. */
  spent: boolean;
}

/** Rule 17.0: one free redeployment / naval movement action taken after a war. */
export interface WarFreeActionRecord {
  power: Power;
  side: "attacker" | "defender";
  action: "redeploy" | "naval";
  /**
   * Rule 17.0 / 12.15: a single free redeployment (or free naval) action moves
   * *all* the power's eligible units.  `unitIds` is therefore every unit that
   * moved during that one action; `from`/`to` describe the first move for
   * backward compatibility and `moves` carries each unit's own endpoints.
   */
  unitIds: string[];
  from: SpaceId;
  to: SpaceId;
  moves?: {unitId: string; from: SpaceId; to: SpaceId}[];
}

/**
 * Rule 8.2 / 14.2 — the declaration-driven Alliance Track shift.
 *
 * "A declaration of war causes the defending power to shift away from the
 * attacker one space on the Alliance Track.  If both powers are in the neutral
 * box, the defending power chooses which alliance box to shift into."
 *
 * The record is kept on the war so the both-neutral choice is resumable: while
 * `choice` is true the defender may answer with `moves.chooseAllianceShift`,
 * and the alliance-shift step (`startWarManeuver`) applies the deterministic
 * default if they have not.  `forced` records that the printed 8.4 exception
 * ("when a defender is forced to shift after a declaration of war, the
 * defender can shift into an alliance that already has three players") was the
 * reason a full alliance was entered.
 */
export interface DefenderDeclarationShift {
  /** The box the defender's chit started in. */
  from: AllianceBox;
  /** The box it reached, or null while the both-neutral choice is open. */
  to: AllianceBox | null;
  /** How many boxes the chit actually moved (0 at the track's extremes). */
  steps: number;
  /** True when rule 8.4's printed declaration exception allowed a fourth join. */
  forced: boolean;
  /** True while the defender still has to choose the first alliance box. */
  choice: boolean;
}

/**
 * Rule 15.6 / 16.1.6: a player ally knocked out of a limited war because its
 * capital was occupied.  The knockout is recorded the moment it happens, so a
 * later recapture cannot retroactively erase the treaty option the occupier
 * earned ("Regardless of the war's outcome, an ally knockout still occurs").
 */
export interface WarKnockoutRecord {
  /** The player ally that was knocked out (never a minor power, 15.6). */
  power: Power;
  /** The war side that occupied the capital. */
  by: "attacker" | "defender";
  /** Primary belligerent of the occupying side, for the log/treaty step. */
  occupier: Power;
  /**
   * Rule 16.1.6 — the power that actually made the knockout (the captor of
   * the capital).  It may be an ally of the side primary, and it is the power
   * that chooses the losing side's treaty option ("the loser chooses their
   * treaty option after the winner").  Optional so saves created before the
   * field existed fall back to `occupier`.
   */
  captor?: Power;
  /** The capital that was occupied (kept even after a recapture). */
  capital: SpaceId;
  /** Campaign turn in which the knockout happened. */
  turn: number;
}

export interface WarSide {
  attacker: Power;
  /**
   * The defending primary belligerent.  Rule 13.4 turns a declaration on a
   * non-player power with a player ally into a declaration on that ally, so
   * for those wars this is the ally.  Rule 15.4.2's lone non-player defender
   * has no seat at all: the non-player's control id ("Serbia", "IT") is stored
   * here and `minorTarget.ally === null` marks the war, so player-only paths
   * must check `isPower(war.defender)` / `isLoneMinorWar(war)` instead of
   * assuming a seat.  The field stays typed `Power` because the UI and several
   * helpers index player-keyed records with it; `minorTarget` is the typed
   * record of the non-player.
   */
  defender: Power;
  /** Secondary belligerents that joined. */
  attackerAllies: Power[];
  defenderAllies: Power[];
  /** Minor powers fighting on each side. */
  attackerMinors: string[];
  defenderMinors: string[];
  warAim: "liberation" | "unification" | "conquest" | null;
  objectives: SpaceId[];
  /** Negotiated treaty state. */
  status: "warAim" | "alliance" | "shift" | "initiative" | "maneuver" | "victory" | "demobilization" | "done";
  /**
   * Rule 14.0: player allies already called into this war who refused the
   * call.  Such an ally cannot be asked a second time in the same war.
   * Optional so saves created before the consent flow remain valid.
   */
  refusedAllies?: Power[];
  /**
   * Rule 17.0: powers entitled to a free redeployment + free naval movement
   * action after the war, in rule order (winning side first).  Recorded on
   * the archived war so the status document can point at it.
   */
  freeActionEntitlements?: {power: Power; side: "attacker" | "defender"; order: 1 | 2}[];
  /** Rule 17.0: free actions actually taken, recorded on the archived war. */
  freeActions?: WarFreeActionRecord[];
  /**
   * Rule 8.2 / 14.2: the defender's declaration-driven Alliance Track shift.
   * Optional so wars created before it existed (and hand-written test states)
   * remain valid; the field is absent for wars that were not declared with a
   * live `declareWar` move.
   */
  defenderShift?: DefenderDeclarationShift | null;
  /**
   * The card that caused this declaration, when one did.  Balance of Power
   * "cannot be played in response to Otto von Bismarck", so the UK's
   * declaration-response move reads this typed record instead of guessing from
   * a face-down resolution flag.
   */
  declarationCard?: CardId | null;
  /**
   * Rule 14.2.1 / the Balance of Power card: powers that draw a card when this
   * war ends (the UK for entering, plus the one invited player that joined).
   */
  postWarDraws?: Power[];
  /** CP war budgets. */
  budgets: Partial<Record<Power, number>>;
  initiative: Power[];
  /**
   * Rule 15.6: player allies knocked out of this war, in the order recorded.
   * Written the moment an enemy occupies an ally's capital, so classification
   * (`classifyVictory`) can still award the 16.1.6 treaty option after a
   * recapture.  Optional so older saves and hand-written test states remain
   * valid; classification also falls back to the live capital check.
   */
  knockedOut?: WarKnockoutRecord[];
  /** Treaties chosen by the victor. */
  treaties: string[];
  /** Who won (null if white peace). */
  victor: "attacker" | "defender" | null;
  /**
   * Rule 16.1/17.1: the primary victory classification, kept on the archived
   * war for the demobilisation blockade check.  "a player ... that won a major
   * victory can never be blockaded" (17.1), so the demobilisation step needs
   * the outcome after the interactive treaty chooser has finished.  Optional
   * so hand-written and pre-existing war states remain valid.
   */
  victoryPrimary?: "major" | "normal" | "defensive" | "negotiated" | "whitePeace";
  /** Turns remaining on the truce after the war. */
  truceTurns: number;
  /** Which sides have passed in the maneuver step. */
  passed: Power[];
  startedTurn: number;
  /**
   * Rule 13.4/13.5: set when this limited war was declared on a non-player
   * power.  The player ally (when there is one) is the defending primary
   * belligerent: "declaring war against a non-player power that has a player
   * ally is treated as declaring war against that player".  Optional so wars
   * created before it existed (and hand-written test states) remain valid.
   */
  minorTarget?: MinorWarTarget;
}

/**
 * Rule 13.4 — a limited war declared on a non-player power.
 *
 * `ally` records the player side of the declaration: rule 13.4 turns a
 * declaration on an allied non-player into a declaration on that player.
 * When no player defends (13.4.2 Seeking Aid found none, or 13.4.1 abandoned
 * the minor), `ally` is null: the non-player defends alone under 15.4.2 and
 * the war is live in its own right (it is also mirrored into
 * `ImperialElegyState.minorDeclarations` as the declaration ledger).  Such a
 * war's `WarState.defender` is the non-player's control id and its
 * `defenderMinors` lists the power.
 */
export interface MinorWarTarget {
  /** The non-player power attacked: "Italy" or a minor power name. */
  minor: string;
  /**
   * Rule 13.4: the player ally that defends.  `null` means no player defends:
   * 13.4.2 found no aid (or 13.4.1 abandoned the minor) and the non-player
   * fights alone per 15.4.2.
   */
  ally: Power | null;
}

/**
 * Rule 13.4/8.2 — the declaration ledger for a non-player power that no player
 * defends.  Since 15.4.2 the declaration also creates the live `WarState`
 * (`minorTarget.ally === null`); this record keeps the announcement itself,
 * including the printed 8.2 random Italy shift (1-3 Triple Entente, 4-6
 * Triple Alliance) recorded when it was rolled.
 */
export interface NonPlayerWarDeclaration {
  attacker: Power;
  /** The non-player power attacked. */
  minor: string;
  aim: "liberation" | "unification" | "conquest";
  objectives: SpaceId[];
  /** The turn the declaration happened. */
  turn: number;
  /** The printed 8.2 Italy shift, when the clause applied. */
  italyShift: {roll: number | null; random: boolean; side: "te" | "ta"; from: AllianceBox; to: AllianceBox} | null;
}

/**
 * A GW combat card that has been played and is now in front of a player.
 * Facedown cards are public information (rule 26.1): everyone may inspect them,
 * but they cannot be used until they are flipped faceup in a later planning
 * step (or by GW-05's event).  They never count against the GW hand limit.
 */
export interface GwCombatCardInFront {
  /** The player in front of whom the card sits (its future controller). */
  holder: Power;
  cardId: CardId;
  faceup: boolean;
}

export interface GreatWarState {
  active: boolean;
  /** GW turn 0..5. */
  turn: number;
  /** Turn order, including bonus impulses (null slot). */
  order: (Power | "bonus" | "IT" | "US" | null)[];
  /**
   * Rule 30.1: the alliance that owns the single bonus-impulse marker on the
   * wartime initiative track, if any.  The bonus slot itself stays the generic
   * `"bonus"` order entry (old code and saves keep working); this field only
   * records whose alliance the marker belongs to, so a slot earned by an
   * elimination is not silently re-derived from the current alliance sizes.
   * Absent/undefined on older saves, in which case the side is derived from the
   * living alliance sizes exactly as before.
   */
  bonusImpulseSide?: GwSide | null;
  /** Which powers are belligerent. */
  belligerents: Power[];
  /** Neutral players still outside the war. */
  neutrals: Power[];
  /** Alliances. */
  te: Power[];
  ta: Power[];
  /** US and Italy entry. */
  usIn: boolean;
  italyIn: boolean;
  /**
   * Blockade state (GW-07 Submarines needs "currently blockaded" and
   * "blockaded last turn").  `blockaded` is the set resolved at the winter that
   * opened the current GW turn; `blockadedLastTurn` is the set that was in
   * force during the previous GW turn.  Optional for older saves.
   */
  blockaded?: Power[];
  blockadedLastTurn?: Power[];
  /** Stability / manpower for non-player majors. */
  usStability: number;
  usManpower: number;
  usBudget: number;
  italyStability: number;
  italyManpower: number;
  italyBudget: number;
  /**
   * 30.2: a major that surrendered is out of the war for good (its units are
   * removed and it cannot re-enter).  Optional for older saves/test states.
   */
  usSurrendered?: boolean;
  italySurrendered?: boolean;
  /** 32.2: Italian home keys currently lost to the enemy (stability charged). */
  italyLostKeys?: SpaceId[];
  /**
   * 25.3: the Alliance Track box of a unified Italy.  Italy is not a player
   * power, but like the US chit (25.2) it keeps a position during the game.
   * Absent/undefined = the neutral box.
   */
  italyAlliance?: AllianceBox;
  /** Trench battles. */
  trenches: Record<SpaceId, "attacker" | "deadlock" | "defender">;
  /** Winter / colonial war results. */
  lastColonialWar?: { africa?: string; asia?: string } | null;
  /** Winner of the GW: "te" | "ta" | null. */
  victor: "te" | "ta" | null;
  /** Flags for one-off steps. */
  outbreakDone: boolean;
  nationalWillDone: boolean;
  /** Bonus impulses. */
  bonusImpulses: string[];
  /**
   * 29.3: the interactive winter neutral-entry sequence.  The engine keeps the
   * roll-off order, the neutral currently deciding and its free-action
   * bookkeeping here so the pending decisions are resumable and auditable.
   * Optional so older saves and test states remain valid.
   */
  neutralEntry?: GwNeutralEntryState | null;
  /**
   * 29.1/29.2: the winter-resolution bookkeeping.  It lets `resolveGwWinter`
   * apply the blockade and the colonial war exactly once and then wait for the
   * neutral-entry decisions before advancing the turn.  Cleared when the next
   * planning step begins.
   */
  winter?: GwWinterState | null;
  /**
   * GW-10 Exhaustion: "This event takes effect at the end of this impulse."
   * The chosen mode is queued here while the GW card resolves and is activated
   * when the playing impulse ends (`gwPass`/`gwEndTurn`).  Optional so older
   * saves and hand-written test states remain valid.
   */
  exhaustionPending?: GwExhaustionPending | null;
  /**
   * Bonus CP promised for the *next* planning step (29.2 colonial war and
   * 29.3 neutral gift).  `beginGwTurn` adds it to the war budget once per turn
   * (`budgetTurn` guards against the planning hook running twice).
   */
  bonusCp?: Partial<Record<Power, number>>;
  /** GW turn whose planning budgets were already set. */
  budgetTurn?: number;
  /**
   * GW combat cards played for their event and placed in front of a player
   * (rule 26.1).  Optional so saves created before the lifecycle existed and
   * hand-written test states remain valid.
   */
  combatCardsInFront?: GwCombatCardInFront[];
  /**
   * Great War discard pile.  GW combat cards played after the dice (GW-05/
   * GW-06) go here, never to the action `G.discard` pile: that pile is
   * reshuffled into the action deck.  GW-03/GW-04 never enter either pile.
   */
  discard?: CardId[];
}

/** 29.1/29.2 result of the winter step before the neutral-entry decisions. */
export interface GwWinterState {
  /** The GW turn whose winter this is. */
  turn: number;
  /** 29.1: players that cannot trace a capital LoC to an allowed naval box. */
  blockaded: Power[];
  /** 29.1: players whose maximum industry actually dropped this winter. */
  industryLost: Power[];
  /** 29.2: opposed colonial-war rolls, including losses and transfers. */
  colonialWar: {africa: GwColonialWarRollState; asia: GwColonialWarRollState};
  /** 29.2.1: stability changes caused by the colonial war. */
  colonialStability: {power: Power; delta: number; reason: string}[];
  /** 29.3: neutral players that joined the war this winter. */
  joinedNeutrals: {power: Power; side: "te" | "ta"}[];
  /** 29.2 bonus CP / 29.3 gifts owed at the next planning step. */
  bonusCp: Partial<Record<Power, number>>;
  /** 29.1.1: stability the US lost to enemy ships in the North Atlantic. */
  usStabilityLoss: number;
  /** GW-08/09: pressured players that failed the attack condition. */
  politicalPressureLosses: Power[];
  /**
   * 29.2: the live transfer choices still to be answered.  Only the interactive
   * winter creates these; the deterministic fallback applies the transfer at
   * once and leaves the list empty/absent.
   */
  colonialTransfers?: GwColonialTransferChoice[];
  /** 29.2.1: the live bonus-CP allocations (computed after the transfers). */
  colonialBonus?: GwColonialBonusChoice[];
  /** True once `colonialBonus` has been computed for this winter. */
  colonialBonusPlanned?: boolean;
}

/** 29.2: one winning alliance's pending "take an unoccupied space" choice. */
export interface GwColonialTransferChoice {
  region: "africa" | "asia";
  side: "te" | "ta";
  /** The deterministic controller that answers the decision. */
  by: Power;
  /** Spaces still to take (1, or 2 on a differential of 4+). */
  remaining: number;
  /** Spaces already taken by this choice, in order. */
  taken: SpaceId[];
  done: boolean;
}

/** 29.2.1: one winning alliance's pending bonus-CP allocation. */
export interface GwColonialBonusChoice {
  side: "te" | "ta";
  /** The printed 1 or 3 CP pool. */
  pool: number;
  /** The deterministic controller that answers the decision. */
  by: Power;
  /** Living, non-blockaded alliance members that may receive the CP. */
  eligible: Power[];
  /** CP still unallocated. */
  remaining: number;
  /** The split chosen so far (for the result/log). */
  allocation: Partial<Record<Power, number>>;
  done: boolean;
}

/** Serializable shape of one colonial-war roll (29.2). */
export interface GwColonialWarRollState {
  region: "africa" | "asia";
  /** Final totals after modifiers and the "controls the continent" rule. */
  te: number;
  ta: number;
  winner: "te" | "ta" | null;
  /** Raw die faces, kept for the log and the stability rule. */
  teRoll: number;
  taRoll: number;
  /** Modifier totals. */
  teMod: number;
  taMod: number;
  /** Human-readable modifier sources (`ef:GE`, `elite:FR`, …). */
  teModifiers: string[];
  taModifiers: string[];
  /** The alliance that controls every counted space on the submap. */
  controllingSide: "te" | "ta" | null;
  /** Losses the losing alliance actually took. */
  losses: {power: Power; unitId: string; kind: string; eliminated: boolean}[];
  /** Control transfers the winning alliance actually made. */
  transfers: {side: "te" | "ta"; by: Power; space: SpaceId; from: string | null}[];
}

/** 29.3 neutral-entry sequence bookkeeping. */
export interface GwNeutralEntryState {
  /** Neutrals still to choose, in roll-off order (highest roll first). */
  queue: Power[];
  /** The neutral currently deciding. */
  current: Power | null;
  /** Roll-off results, for the log/audit. */
  rolls: {power: Power; roll: number}[];
  /** The current neutral's choice: a side, "stay", or null before choosing. */
  choice: "te" | "ta" | "stay" | null;
  /** Free actions already taken by the current neutral. */
  usedRedeploy: boolean;
  usedDeploy: boolean;
  /** Unit chosen for the free redeployment while its destination is picked. */
  unitId: string | null;
}

/**
 * Every pending-decision kind, in one runtime list so the UI can verify that
 * its bilingual label map covers exactly the union (a union alone is not
 * visible at runtime, and tests are not part of the `tsc` program here).
 * `PendingKind` is derived from this array, so adding a kind here without a
 * label fails `pendingKindLabels.test.tsx`.
 */
export const PENDING_KINDS = [
  "discardForStability",
  "chooseHomeCard",
  "giveCard",
  "eventTargetSpace",
  "eventTargetPower",
  "eventChoice",
  "eventUnits",
  "combatSupport",
  /** 19.1: a port's ships may attempt to intercept a naval move into the box. */
  "navalInterception",
  /** 19.5 footnote: the attacker chooses the adjacent box of a two-box port. */
  "navalPortBox",
  /** 19.2: the naval defender chooses to fight or attempt to avoid battle. */
  "navalAvoid",
  /** 19.1: after winning an interception battle the mover may finish the move. */
  "navalContinuation",
  /** 19.8: the active player may move the battle's units into an adjacent friendly port. */
  "navalPortContinuation",
  /** 19.4: after two mine hits the attacker may retreat instead of taking the rest. */
  "mineRetreat",
  "combatElite",
  "combatCard",
  "combatDiscard",
  "combatLosses",
  "decisiveBattle",
  "combatRetreat",
  "combatAdvance",
  "movementDestination",
  "warAim",
  "warAlly",
  "warInitiative",
  /** 13.4.1/13.4.2: the called ally accepts or refuses the call. */
  "warAllyConsent",
  /** 13.4.1: a player ally may abandon the non-player power that was attacked. */
  "minorAbandon",
  /** 13.4.2: a player is asked to aid the attacked non-player power. */
  "minorAid",
  /** UK Balance of Power: the defender agrees (or not) to the UK becoming primary. */
  "balanceOfPower",
  "treatyOption",
  "treatySpace",
  /** 16.1.6: a two-sided white-peace knockout has no printed chooser order. */
  "whitePeaceOrder",
  "demobilizationFreeAction",
  "goalChoice",
  "industryCard",
  "mpitAllocation",
  "italyTable",
  /** 22.1.3: choose Sardinia-Piedmont or the Kingdom of the Two Sicilies. */
  "italianInternalWar",
  "crisis",
  /** 23.3: the active player chooses the bordering nation / Balkan state. */
  "crisisIncident",
  /** 23.5: a single neutral player chooses the alliance it joins. */
  "crisisAlliance",
  "gwDraft",
  "gwCard",
  "gwWinter",
  "scoringChoice",
  "responseCard",
  "confirm",
  /** 5.5.3 / 5.6.2: the owning player chooses which unit loses a step. */
  "impulseLoss",
  /** 20.1 Militarism: one army step or protect a fort from degrading. */
  "militarism",
  /** 20.5 Set manpower: the owner picks the standing armies over the new limit. */
  "manpowerExcess",
  /** 8.6 / 20.9: the player chooses the direction of a tied alliance roll. */
  "allianceTie",
  /** 29.3: a neutral player chooses whether to join an alliance or stay out. */
  "gwNeutralEntry",
  /** 29.3: a neutral player's free redeployment / deploy reserves / bonus CP. */
  "gwNeutralAction",
  /** 29.3: choose which unit takes the free redeployment. */
  "gwNeutralUnit",
  /** 29.3: choose the free redeployment destination. */
  "gwNeutralDestination",
  /** 29.3: choose the space for the free deploy-reserves action. */
  "gwNeutralDeploy",
  /** 29.2: the winning alliance chooses an unoccupied colonial space to take. */
  "gwColonialTransfer",
  /** 29.2.1: the winning alliance allocates (or loses) its colonial bonus CP. */
  "gwColonialBonusCp",
  /** 33.1 Blood and Iron!: turn-1 end phase, search the NG deck for Unification!. */
  "bloodAndIron",
  /** 33.1 German Confederation: take control of a German minor ally after a unification win. */
  "germanConfederation",
  /** 33.3 Napoleon's Legacy: optionally reveal NG-24 when launching a war of conquest. */
  "napoleonsLegacy",
  /** 33.4 Metternich's Legacy: AU chooses its two minor-power allies on turn 1. */
  "metternich",
  /** 3.4.1: the Dardanelles controller's permission for one passage. */
  "dardanellesPassage",
] as const;

export type PendingKind = (typeof PENDING_KINDS)[number];

export interface PendingDecision {
  id: string;
  kind: PendingKind;
  /** The power that must decide. */
  power: Power;
  /** Public prompt key; no hidden information. */
  prompt: string;
  /** Prompt arguments, public. */
  promptArgs?: Record<string, unknown>;
  /** Legal options.  Sensitive options are filtered in playerView. */
  options: PendingOption[];
  /** Opaque context needed to resume the interrupted action. */
  context?: Record<string, unknown>;
  /** Card that caused the decision, if any. */
  cardId?: CardId;
  /** When true, the decision is part of a battle and blocks everything else. */
  blocking?: boolean;
  createdAt: number;
}

export interface PendingOption {
  id: string;
  label: string;
  /**
   * Optional pre-localized label.  Engine-created options that build their
   * label from state (power/space/unit names, counts) set this so the board
   * can render Chinese without re-deriving the text; the board falls back to
   * `OPTION_ZH` and then to `label`.
   */
  labelZh?: string;
  /** Hidden detail (e.g. card id) is stripped for other players. */
  secret?: boolean;
  data?: Record<string, unknown>;
}

/**
 * Rule 20.0 — the live end phase suspends while a player decides.
 *
 * `resolveEnd` in `moves.ts` walks `endPhaseOrder` from `step`.  A step that
 * opens a pending decision (20.1 Militarism, 20.5 excess armies, 20.9's tied
 * alliance roll) records its progress here so the pending handler can resume
 * the same step without replaying the earlier ones.  The whole object is
 * deleted when 20.12 completes.
 */
export interface EndPhaseProgress {
  /** Index into `economy.ts#endPhaseOrder` of the step being applied. */
  step: number;
  /** 20.1: powers whose Militarism benefit is already recorded, in seat order. */
  militarismSettled?: Power[];
  /** 20.5: true once `recomputeTracks` has run for this end phase. */
  manpowerSet?: boolean;
  /**
   * 20.9: the resolutions left to run, in 8.6 order, and the cursor.  The die
   * results of the power at `index` are kept in the pending decision's context
   * (a suspended roll must not be re-rolled).
   */
  alliance?: {
    order: Power[];
    index: number;
    /**
     * Rules 8.5/8.6: a unified Italy's own resolution runs after the players'
     * (Italy is exempt from the 8.4 three-player cap, so its position in the
     * order cannot change any player's shift).  Set once it has resolved so a
     * suspended/resumed step never rolls Italy twice.
     */
    italyDone?: boolean;
  };
  /**
   * 20.11: the next power to draw NGs.  Set when the Blood and Iron! choice
   * suspends the draw step so the remaining powers are drawn exactly once.
   */
  ngDraw?: {index: number};
}

/**
 * 19.1: the interrupted naval movement.  Recorded when the interception window
 * opens and consumed by `finishBattle` once the interception battle resolves.
 */
export interface NavalContinuationState {
  /** The active power whose naval movement was interrupted. */
  power: Power;
  /** The space the naval move started from. */
  from: SpaceId;
  /** The space the move was stopped in (the interception battle space). */
  contact: SpaceId;
  /** The units that made the move and may finish it. */
  unitIds: string[];
  /** A GW joint naval operation's allied power, when one took part. */
  ally?: Power;
  /** 19.1: the interception window actually opened for this move. */
  intercepted: boolean;
}

/**
 * 19.1 transit interception: a multi-box naval move that is interrupted by a
 * port adjacent to an intermediate box.  The move already paid its action, so
 * when no interception succeeds it simply resumes from `path[index]` to the
 * original final destination without spending again.
 */
export interface NavalTransitState {
  /** The active power making the move. */
  power: Power;
  /** A GW joint naval operation's allied power, when one takes part. */
  ally?: Power;
  /** The mover's units still taking part (a 12.3 transport also carries its land unit). */
  unitIds: string[];
  /** The whole planned 12.3 route: origin first, final destination last. */
  path: SpaceId[];
  /** Index in `path` of the box the units currently occupy. */
  index: number;
}

/**
 * 22.3.1 Kingdom of Italy Table, result 5–6: "Italy permanently gains an
 * additional reserve army and an additional naval unit."  The counts are the
 * grants made so far, capped by the printed Italian counter row (two spare
 * army counters beyond 22.2's three standing armies; two spare squadrons beyond
 * its single starting squadron).
 */
export interface ItalyReinforcements {
  armies: number;
  squadrons: number;
}

/**
 * The serialized game state.
 *
 * The `?` fields are the round 1–6 additions.  Their documented defaults (and
 * the legacy `persistent` → typed folds, e.g. `italy_mpit_*` → `italyMpit`)
 * live in one place: `engine/migrations.ts#ensureStateDefaults`.  That helper
 * runs at `setupImperialElegy`, at the prep phase `onBegin` and defensively in
 * `moves.ts#resolveEnd`, so a loaded old save and a fresh game have the same
 * shape before any rules code reads them.
 */
export interface ImperialElegyState {
  /** Match configuration. */
  scenario: "campaign";
  turn: number;
  decade: string;
  phase: GamePhase;
  activePower: Power;
  /** Turn-order index for the active phase. */
  turnIndex: number;
  powers: Record<Power, PowerState>;
  spaces: Record<SpaceId, SpaceState>;
  units: Record<string, Unit>;
  nextUnitId: number;
  deck: CardId[];
  discard: CardId[];
  removed: CardId[];
  /** Cards that enter on a later decade (10.1). */
  delayedCards: Record<string, CardId[]>;
  wtt: number;
  worldTensionMax: number;
  /** Passes in the current action round. */
  passed: Power[];
  /** Cards played / CP remaining in the current impulse. */
  cpRemaining: number;
  impulseCard: CardId | null;
  /** The card event currently being resolved. */
  resolvingCard: CardId | null;
  /** A limited war in progress. */
  war: WarState | null;
  /** Completed wars, for history / truces. */
  wars: WarState[];
  /**
   * 13.4/8.2: live declarations against non-player powers that no player
   * defends.  Optional for older saves.
   */
  minorDeclarations?: NonPlayerWarDeclaration[];
  /**
   * Rules 8.5 / 13.4.1: the MPIT column of a unified Italy.  Only Italy's own
   * three counters live here (players carry theirs on `PowerState.mpit`).
   * Optional so older saves and test states remain valid; a missing column
   * reads as all zeroes (plus any legacy `persistent.italy_mpit_*` values).
   */
  italyMpit?: ItalyMpit;
  /**
   * Rule 16.2: card markers awarded to independent minor powers as treaty
   * beneficiaries.  Minor powers have no hand, so the marker is bookkeeping
   * only; it is kept typed and public instead of being silently dropped.
   */
  minorCardMarkers?: Record<string, number>;
  /** Great War, if it has broken out. */
  gw: GreatWarState | null;
  /** Active battle state. */
  battle: BattleState | null;
  /** Pending decision that blocks the active action. */
  pending: PendingDecision | null;
  /** Stack of suspended decisions (nested responses). */
  pendingStack: PendingDecision[];
  /** Randomizer bookkeeping (server-authoritative). */
  seed: number;
  /** Public log; hidden details are stripped by playerView. */
  log: LogEntry[];
  nextLogId: number;
  /** Per-turn flags. */
  flags: Record<string, boolean | number | string>;
  /** Final result when the game ends. */
  result?: {
    winners: Power[];
    reason: string;
    scores: Partial<Record<Power, number>>;
  } | null;
  /**
   * 3.4.1: the Dardanelles controller has granted `requesting` permission to
   * cross the strait this turn.  Optional so older saves remain valid.
   */
  dardanellesPassage?: {requesting: Power; granting: Power; turn: number; gwTurn?: number} | null;
  /**
   * 3.4.1: every permission granted this turn.  A joint naval operation moves
   * units of two powers, so both need their own grant; `dardanellesPassage`
   * keeps the latest one for saves/tests that only read a single record.
   * Optional so older saves remain valid.
   */
  dardanellesPassages?: {requesting: Power; granting: Power; turn: number; gwTurn?: number}[] | null;
  /**
   * 19.1: a naval move whose 19.1 interception window was opened.  The move
   * itself already paid for the action; if the mover wins the interception
   * battle (and the fight was in European Waters) the typed `navalContinuation`
   * decision lets it finish the naval movement without spending again.
   * Optional so older saves remain valid.
   */
  navalContinuation?: NavalContinuationState | null;
  /**
   * 19.1 transit interception: a multi-box move currently stopped in an
   * intermediate box whose adjacent enemy port may intercept it.  Optional so
   * older saves remain valid.
   */
  navalTransit?: NavalTransitState | null;
  /** Public scoreboard after scoring. */
  scores?: Partial<Record<Power, number>>;
  /** Card effects that persist for the whole game. */
  persistent: Record<string, boolean | number | string>;
  /**
   * 22.3.1: the permanent Italian reserve-army / naval grants from the Kingdom
   * of Italy table.  Optional so older saves and hand-written test states
   * remain valid (absent = no grant yet).
   */
  italyReinforcements?: ItalyReinforcements;
  /**
   * National Goals revealed faceup during play (33.1 Blood and Iron!'s
   * Unification! card, 33.3 Napoleon's Legacy).  The owning power's `goals`
   * stay private in `playerView`; this public list is the faceup record.
   */
  revealedGoals?: GoalId[];
  /**
   * Minor powers permanently eliminated by 33.1 German Confederation.  Their
   * control markers and units are gone and they can never return as an ally.
   */
  eliminatedMinors?: string[];
  /**
   * 20.3 End Phase Build Box bookkeeping.  Optional for older saves; the
   * end-phase helpers fall back to the printed campaign roster.
   */
  nonPlayerBuildBox?: NonPlayerBuildBox;
  /** Live end-phase cursor while a 20.1/20.5/20.9 decision is open. */
  endPhase?: EndPhaseProgress;
  /** Current decision sequence, used to keep ids unique. */
  decisionSeq: number;
  /** Version for migrations. */
  version: number;
}

/** WarState is kept separate from The Great War so the two can coexist. */
export type WarState = WarSide;

export interface BattleState {
  kind: "land" | "naval";
  attacker: Power;
  defender: Power;
  from: SpaceId;
  to: SpaceId;
  mainAttack: string[];
  mainDefense: string[];
  /**
   * Owners of the main forces when the battle began (32.1/32.2 "US-/Italian-
   * led force"), kept because eliminated units leave `G.units`.  Optional for
   * saves and test states created before it existed.
   */
  forceOwners?: {attacker: string[]; defender: string[]};
  supportAttack: {space: SpaceId; units: string[]; fp: number}[];
  supportDefense: {space: SpaceId; units: string[]; fp: number}[];
  stage: "support" | "cards" | "roll" | "lossesAttack" | "lossesDefense" | "retreat" | "advance" | "done";
  supportSide: "attacker" | "defender";
  cardSide?: "attacker" | "defender";
  attackerDrm: number;
  defenderDrm: number;
  attackerRoll?: number;
  defenderRoll?: number;
  diff?: number;
  attackerLosses: number;
  defenderLosses: number;
  /** 18.6: the first step loss must be taken from the main force. */
  firstLossAttack?: boolean;
  firstLossDefense?: boolean;
  decisive: boolean;
  winner?: "attacker" | "defender";
  amphibious?: boolean;
  /** 19.4: mine hits inflicted on the attacker before the battle dice. */
  mines?: number;
  /** 19.3 step 1: the mine dice have already been rolled for this battle. */
  minesRolled?: boolean;
  trench?: boolean;
  notes: string[];
  /**
   * The two BDRM totals actually used for the roll.  GW-05 rerolls one die and
   * must recompute the differential/CRT without recalculating support, so the
   * resolved totals are recorded here.
   */
  attackDrmTotal?: number;
  defenceDrmTotal?: number;
  /** Spaces denied support by A062 for the rest of this battle. */
  supportDenied?: SpaceId[];
  /** A062 is waiting for its controller to choose the denied space. */
  pendingSupportDeny?: boolean;
  /** Players who draw an extra card when the battle ends (A058/A059/A062). */
  extraDraws?: Power[];
  /** GW-03/GW-04 cards to place facedown in front of the opponent at battle end. */
  faceDownCards?: {cardId: CardId; holder: Power}[];
  /** GW-05 is waiting for its controller to choose which side rerolls. */
  rerollPending?: boolean;
  /** A GW-05 reroll has already been resolved in this battle. */
  rerollUsed?: boolean;
  /** 33.6: an Ottoman Jihad marker was spent in this battle (opponent -1). */
  jihadUsed?: boolean;
  /**
   * 19.5 footnote: for a battle in a port the embattled area is treated as the
   * adjacent naval box the attacker chose (stored for audit/tests).
   */
  portBox?: SpaceId;
  /** 18.7 / 28.1.1: the retreat destination chosen in a `combatRetreat` decision. */
  retreatTo?: SpaceId;
  /**
   * 18.7 / 28.1.1: per-unit retreat destinations when the losing force is
   * mixed and its units have different legal spaces.  Takes precedence over
   * `retreatTo` in `finishBattle`.
   */
  retreatAssignments?: {unitId: string; space: SpaceId}[];
  /**
   * 19.4/19.6: "the majority (more than half) of step losses ... must be taken
   * by dreadnoughts if any are present".  The quota is fixed when the losses
   * are rolled so the loss allocation can enforce it while the owner still
   * chooses which dreadnought takes each step.
   */
  dreadnoughtRequired?: {attacker: number; defender: number};
  /** 19.4/19.6: dreadnought steps already taken in this battle. */
  dreadnoughtLosses?: {attacker: number; defender: number};
  /**
   * 30.0: owners of dreadnoughts eliminated in this battle.  The GW stability
   * loss ("Losing a dreadnought in battle: -1 stability") is applied once the
   * battle's own effects are done, so a mid-battle surrender cannot truncate
   * the loss/reward sequence.
   */
  dreadnoughtsSunk?: string[];
}

export interface MoveContext {
  playerID: string | null;
}
