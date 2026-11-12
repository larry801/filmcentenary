/**
 * Imperial Elegy — legacy-save defaults and state migration.
 *
 * Rounds 1–6 of the conversion added a large number of typed state fields and
 * nested records: the top-level `minorDeclarations` / `italyMpit` /
 * `minorCardMarkers` / `navalTransit` / `italyReinforcements` /
 * `revealedGoals` / `eliminatedMinors` / `nonPlayerBuildBox` records, the
 * `gw.*` lifecycle records (`blockaded`, `combatCardsInFront`, `discard`,
 * `exhaustionPending`, `bonusImpulseSide`, `italyAlliance`, …), the per-power
 * `maxIndustry` / `rapidDeployment` fields and the optional `WarState`
 * bookkeeping.  Old saves, hand-built test states and partial fixtures can be
 * missing them, and the engine (and the board) read several of them without a
 * fallback.
 *
 * `ensureStateDefaults` is the one place that knows each documented default.
 * It is:
 *
 *  - **additive** — it only fills fields that are `undefined`/`null` where the
 *    documented default is not `null`; an existing value is never overwritten;
 *  - **idempotent** — running it twice leaves the state deep-equal;
 *  - **recursive** — `powers`, `spaces`, `war`/`wars` and `gw` are normalised
 *    too, including legacy `persistent` markers folded into their typed homes;
 *  - **JSON-safe** — it never introduces functions or class instances, so the
 *    migrated state still round-trips through `JSON.parse(JSON.stringify())`.
 *
 * Live call sites: `engine/setup.ts#setupImperialElegy` (new game / fresh
 * boardgame.io match), `game.ts#prepBegin` (the prep phase `onBegin`, the
 * earliest live hook) and `moves.ts#resolveEnd` (defensive: a save resumed in
 * the middle of a turn never runs a phase `onBegin` before its next move).
 *
 * It is deliberately **not** called from `playerView`: that hook must stay
 * read-only.  `engine/privacy.ts` instead tolerates missing fields directly.
 *
 * Fields intentionally left alone (documented so the audit is complete):
 *  - `endPhase` — a live end-phase cursor; absent means "no end phase in
 *    progress" and `moves.ts` deletes it when the phase completes.
 *  - `scores` — absent means "not scored yet"; `{}` would be a different
 *    (scored, empty) state.
 *  - `BattleState` optional fields (`retreatAssignments`, `dreadnoughtRequired`,
 *    `forceOwners`, …) — `undefined` is a *semantic* value there ("no per-unit
 *    retreat choice yet", "no dreadnought quota", "leader not snapshotted"),
 *    so filling them would change rules behaviour.
 *  - per-power characteristic markers (`government`, `unified`, `tsrr`,
 *    `jihad`, `indiaStable`, …) — their defaults are printed per power, so
 *    "absent" already encodes the printed value; every reader uses `?? 0` /
 *    `=== true`.  Blanket-filling them would invent markers a power never had.
 *  - `Persistent` bag keys — rules track one-off markers by presence; seeding
 *    them (e.g. `italyUnified: false`) would make `delete`-based cleanup and
 *    "marker never happened" assertions lie.
 *  - `keyTypeOverride`, `trenchLine`, `occupiedBy`, `global.Unit.flags` — the
 *    canonical fresh state leaves them absent; readers use `??`/`=== true`.
 */

import {
  AllianceBox,
  GreatWarState,
  ImperialElegyState,
  ItalyMpit,
  Power,
  POWERS,
  PowerState,
  SpaceId,
  SpaceState,
  WarState,
} from "../types";
import {POWER_DEFS} from "../constant/powers";
import {SPACES, createSpaceStates} from "../constant/spaces";
import {createEmptyPowerState} from "../constant/setup";
import {initialNonPlayerBuildBox} from "./endPhase";
import {printedMaxIndustry} from "./greatWarFlow";

/** Schema version written by the migration into `ImperialElegyState.version`. */
export const CURRENT_STATE_VERSION = 2;

const ALLIANCE_BOXES: readonly AllianceBox[] = [
  "neutral",
  "teAligned",
  "teCommitted",
  "taAligned",
  "taCommitted",
];

/** `undefined` / non-numeric counters read as 0 (the `italyMpitOf` fallback). */
const counter = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

/** A valid printed Alliance Track box, else null. */
const allianceBoxOf = (raw: unknown): AllianceBox | null =>
  typeof raw === "string" && (ALLIANCE_BOXES as readonly string[]).includes(raw)
    ? (raw as AllianceBox)
    : null;

/**
 * 8.5: an old save kept Italy's MPIT column in the `persistent` bag with
 * string keys.  Return the typed column when at least one legacy marker is
 * present, else null (so a state that never had a column keeps the documented
 * lazy default — `unifyItaly` still seeds the printed 1 neutral influence).
 */
const legacyItalyMpit = (G: ImperialElegyState): ItalyMpit | null => {
  const bag = G.persistent;
  if (bag === undefined || bag === null) return null;
  const keys = ["italy_mpit_te", "italy_mpit_ta", "italy_mpit_neutral"] as const;
  if (!keys.some((key) => bag[key] !== undefined)) return null;
  return {
    te: counter(bag.italy_mpit_te),
    ta: counter(bag.italy_mpit_ta),
    neutral: counter(bag.italy_mpit_neutral),
  };
};

// ---------------------------------------------------------------------------
// 20.3 — End Phase Build Box
// ---------------------------------------------------------------------------

/**
 * Fill the build box recursively.  The printed campaign roster and the empty
 * Italy counter row are the documented defaults (`initialNonPlayerBuildBox`);
 * the 22.5 Polish reserve box defaults to an empty holding box.  A missing
 * box is created, an existing box only has its missing pieces filled.
 */
const ensureNonPlayerBuildBox = (G: ImperialElegyState): void => {
  if (G.nonPlayerBuildBox === undefined || G.nonPlayerBuildBox === null) {
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
  }
  const box = G.nonPlayerBuildBox;
  if (!Array.isArray(box.minors)) box.minors = [...initialNonPlayerBuildBox().minors];
  if (box.italy === undefined || box.italy === null) {
    box.italy = {italianArmy: 0, squadron: 0, dreadnought: 0};
  } else {
    box.italy.italianArmy = counter(box.italy.italianArmy);
    box.italy.squadron = counter(box.italy.squadron);
    box.italy.dreadnought = counter(box.italy.dreadnought);
  }
  if (box.poland === undefined || box.poland === null) {
    box.poland = {reserveArmies: []};
  } else if (!Array.isArray(box.poland.reserveArmies)) {
    box.poland.reserveArmies = [];
  }
};

// ---------------------------------------------------------------------------
// Powers
// ---------------------------------------------------------------------------

/** Fill every per-power container/optional field with its documented default. */
const ensurePowers = (G: ImperialElegyState): void => {
  const powers = G.powers as Record<Power, PowerState | undefined>;
  for (const power of POWERS) {
    let p = powers[power];
    if (p === undefined || p === null) {
      // A partial fixture without the seat: rebuild the printed starting
      // display rather than leave a hole every `for (const power of POWERS)`
      // loop (privacy, end phase, GW) would trip over.
      p = createEmptyPowerState(power);
      powers[power] = p;
    }
    p.citizenship ??= [];
    p.rights ??= [];
    p.hand ??= [];
    p.homeCards ??= [];
    p.goals ??= [];
    p.goalDeck ??= [];
    p.reserves ??= [];
    p.cpChain ??= [];
    if (p.selectedHomeCard === undefined) p.selectedHomeCard = null;
    if (p.industryCard === undefined) p.industryCard = null;
    p.autoIndustry ??= false;
    p.alliance ??= "neutral";
    p.mpit ??= {te: 0, ta: 0, neutral: 1};
    p.cardMarkers ??= 0;
    p.vp ??= 0;
    p.warBudget ??= 0;
    p.gwBudget ??= 0;
    if (p.gwCard === undefined) p.gwCard = null;
    p.gwHandLimit ??= 1;
    p.eliminated ??= false;
    // 29.1: the blockade cap defaults to the printed display maximum.
    p.maxIndustry ??= printedMaxIndustry(power);
    // 33.2 Rapid Deployment: no grant until the UK enters a war.
    if (p.rapidDeployment === undefined) p.rapidDeployment = null;
    // Secondary (colonial / Arab) manpower and Arab keys are read with `?? 0`.
    p.secondaryManpower ??= 0;
    p.arabKeys ??= 0;
    p.flags ??= {};
  }
};

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

/**
 * Restore the canonical fresh-space shape (`constant/spaces#createSpaceStates`)
 * on partial saves and re-create missing printed spaces.  Only fields whose
 * absent value differs from the canonical `null`/`0`/`[]` are touched; the
 * genuinely dynamic fields (`occupiedBy`, `keyTypeOverride`, `homeOverride`,
 * `trenchLine`) keep their absent encoding.
 */
const ensureSpaces = (G: ImperialElegyState): void => {
  const spaces = G.spaces as Record<SpaceId, SpaceState | undefined>;
  if (spaces === undefined || spaces === null) {
    G.spaces = createSpaceStates();
    return;
  }
  let factory: Record<SpaceId, SpaceState> | null = null;
  for (const id of Object.keys(SPACES)) {
    if (spaces[id] === undefined || spaces[id] === null) {
      factory ??= createSpaceStates();
      spaces[id] = factory[id];
    }
  }
  for (const state of Object.values(spaces)) {
    if (state === undefined || state === null) continue;
    if (state.control === undefined) state.control = null;
    if (state.influence === undefined) state.influence = null;
    if (state.diplomacy === undefined) state.diplomacy = null;
    if (state.ally === undefined) state.ally = null;
    if (state.fort === undefined) state.fort = null;
    if (state.pacification === undefined) state.pacification = 0;
    if (state.rebellion === undefined) state.rebellion = null;
    if (state.trench === undefined) state.trench = null;
    if (!Array.isArray(state.units)) state.units = [];
  }
  // A71 Urabi Revolt: older saves recorded only the Egyptian `homeOverride`.
  // Backfill the explicit colonial key classification so the display and every
  // `effectiveKeyType` reader agree without a live replay of the event.
  const egypt = spaces["egypt"];
  if (
    egypt !== undefined &&
    egypt !== null &&
    egypt.keyTypeOverride === undefined &&
    (egypt.control === "UK" || egypt.control === "FR") &&
    egypt.homeOverride === egypt.control
  ) {
    egypt.keyTypeOverride = "colonial";
  }
};

// ---------------------------------------------------------------------------
// Wars
// ---------------------------------------------------------------------------

/**
 * Fill the optional `WarState` bookkeeping added by rounds 4–6.  Every reader
 * uses `?? []` / `?? null` for these, so materialising the documented default
 * is behaviour-neutral and makes the archive (`wars`) easier to inspect.
 * `minorTarget` is deliberately left absent: it is the typed marker of a
 * 13.4/15.4.2 non-player war, not an optional bag entry.
 */
const ensureWar = (war: WarState | null | undefined): void => {
  if (war === undefined || war === null) return;
  // 14.0: player allies that refused the call in this war.
  war.refusedAllies ??= [];
  // 17.0: free-action entitlements / records on the archived war.
  war.freeActionEntitlements ??= [];
  war.freeActions ??= [];
  // 8.2/14.2: the defender's declaration shift (absent = not a live declaration).
  if (war.defenderShift === undefined) war.defenderShift = null;
  // The card behind the declaration (Balance of Power reads it).
  if (war.declarationCard === undefined) war.declarationCard = null;
  // 14.2.1 / Balance of Power: powers that draw when the war ends.
  war.postWarDraws ??= [];
  // 15.6: player allies knocked out of this war.
  war.knockedOut ??= [];
};

// ---------------------------------------------------------------------------
// Great War
// ---------------------------------------------------------------------------

/** Fill the optional `GreatWarState` lifecycle records (rounds 4–6). */
const ensureGreatWar = (G: ImperialElegyState, gw: GreatWarState): void => {
  gw.order ??= [];
  gw.belligerents ??= [];
  gw.neutrals ??= [];
  gw.te ??= [];
  gw.ta ??= [];
  gw.bonusImpulses ??= [];
  gw.trenches ??= {};
  if (gw.lastColonialWar === undefined) gw.lastColonialWar = null;
  if (gw.victor === undefined) gw.victor = null;
  gw.outbreakDone ??= false;
  gw.nationalWillDone ??= false;
  // 30.1: the alliance that owns the bonus-impulse marker.  Absent = derive it
  // from the living alliance sizes (the documented pre-round-6 fallback).
  if (gw.bonusImpulseSide === undefined) gw.bonusImpulseSide = null;
  // 29.1: blockade sets for the current / previous GW turn.
  gw.blockaded ??= [];
  gw.blockadedLastTurn ??= [];
  // 30.2: a surrendered major is out for good.
  gw.usSurrendered ??= false;
  gw.italySurrendered ??= false;
  // 32.2: Italian home keys already charged to stability.
  gw.italyLostKeys ??= [];
  // 25.3: Italy's Alliance Track chit.  Old saves kept it in `persistent`;
  // fold that value in before falling back to the neutral box.
  if (gw.italyAlliance === undefined) {
    gw.italyAlliance = allianceBoxOf(G.persistent.italyAlliance) ?? "neutral";
  }
  // 29.3: the interactive neutral-entry sequence (absent = not running).
  if (gw.neutralEntry === undefined) gw.neutralEntry = null;
  // 29.1/29.2: the winter bookkeeping (absent = winter not started).
  if (gw.winter === undefined) gw.winter = null;
  if (gw.winter !== null) {
    gw.winter.colonialTransfers ??= [];
    gw.winter.colonialBonus ??= [];
    gw.winter.colonialBonusPlanned ??= false;
  }
  // GW-10 Exhaustion: the queued mode for the current impulse.
  if (gw.exhaustionPending === undefined) gw.exhaustionPending = null;
  // 29.2/29.3: bonus CP promised for the next planning step.
  gw.bonusCp ??= {};
  // The GW turn whose budgets were already set; -1 means "never".
  gw.budgetTurn ??= -1;
  // 26.1: GW combat cards in front of a player (faceup or facedown).
  gw.combatCardsInFront ??= [];
  // The GW discard pile (never reshuffled into the action deck).
  gw.discard ??= [];
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Fill every documented default on `G` in place and return it.
 *
 * Safe to call on a fresh `setupImperialElegy` state (it is a no-op apart from
 * the version stamp), on an old save loaded by boardgame.io and on the
 * hand-built partial states the tests use.  It never overwrites an existing
 * value and never mutates `playerView` (call it before the view is built).
 */
export const ensureStateDefaults = (G: ImperialElegyState): ImperialElegyState => {
  // ---------------------------------------------------------------- containers
  G.powers ??= {} as Record<Power, PowerState>;
  G.spaces ??= {} as Record<SpaceId, SpaceState>;
  G.units ??= {};
  G.deck ??= [];
  G.discard ??= [];
  G.removed ??= [];
  G.delayedCards ??= {};
  G.passed ??= [];
  G.wars ??= [];
  G.pendingStack ??= [];
  G.log ??= [];
  G.flags ??= {};
  G.persistent ??= {};
  if (G.gw === undefined) G.gw = null;
  if (G.battle === undefined) G.battle = null;
  if (G.pending === undefined) G.pending = null;
  if (G.war === undefined) G.war = null;
  if (G.result === undefined) G.result = null;
  if (!Number.isFinite(G.nextLogId) || G.nextLogId < 1) G.nextLogId = 1;
  if (!Number.isFinite(G.decisionSeq) || G.decisionSeq < 1) G.decisionSeq = 1;

  // ------------------------------------------------ top-level optional records
  // 13.4/8.2: the live declaration ledger for non-player powers.
  G.minorDeclarations ??= [];
  // 16.2: card markers awarded to independent minor powers.
  G.minorCardMarkers ??= {};
  // 33.1/33.3: National Goals revealed faceup during play.
  G.revealedGoals ??= [];
  // 33.1 German Confederation: permanently eliminated minor powers.
  G.eliminatedMinors ??= [];
  // 22.3.1: permanent Italian reserve-army / naval grants.
  G.italyReinforcements ??= {armies: 0, squadrons: 0};
  G.italyReinforcements.armies = counter(G.italyReinforcements.armies);
  G.italyReinforcements.squadrons = counter(G.italyReinforcements.squadrons);
  // 8.5: fold legacy `persistent.italy_mpit_*` into the typed column.  Only
  // when the legacy markers exist: a state that never had a column keeps the
  // documented lazy default (all zeroes), which `unifyItaly` seeds with the
  // printed 1 neutral influence.
  if (G.italyMpit === undefined || G.italyMpit === null) {
    const legacy = legacyItalyMpit(G);
    if (legacy !== null) G.italyMpit = legacy;
    // A `null` column (never written by this code, but possible in a
    // hand-edited save) must not stay null: `italyMpitOf` reads it as zeroes
    // when it is absent, so restore that encoding.
    else delete G.italyMpit;
  }
  // 3.4.1: Dardanelles permissions for this turn.
  if (G.dardanellesPassage === undefined) G.dardanellesPassage = null;
  if (G.dardanellesPassages === undefined) G.dardanellesPassages = null;
  // 19.1: interrupted naval moves.
  if (G.navalContinuation === undefined) G.navalContinuation = null;
  if (G.navalTransit === undefined) G.navalTransit = null;

  // ------------------------------------------------------------ nested records
  ensureNonPlayerBuildBox(G);
  ensurePowers(G);
  ensureSpaces(G);
  ensureWar(G.war);
  for (const war of G.wars) ensureWar(war);
  if (G.gw !== null) ensureGreatWar(G, G.gw);

  // ---------------------------------------------------------------- schema stamp
  const version = typeof G.version === "number" && Number.isFinite(G.version) ? G.version : 0;
  G.version = Math.max(version, CURRENT_STATE_VERSION);
  return G;
};

export default ensureStateDefaults;
