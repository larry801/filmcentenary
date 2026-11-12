import {Ctx} from "boardgame.io";
import {AllianceBox, ImperialElegyState, PendingDecision, Power, POWERS, SpaceId} from "../types";
import {POWER_DEFS, POWER_NAMES_ZH} from "../constant/powers";
import {SPACES, connectionsOf, neighboursOf, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import type {Effect} from "../constant/cards";
import {discardCard} from "./deck";
import {
  allianceOf,
  allied,
  die,
  changeStability,
  isArmyKind,
  isMinorPowerOwner,
  isPower,
  minorController,
  italianNavalDeploySpace,
  log,
  ownsKey,
  ITALIAN_EXTRA_NAVAL_MAX,
  ITALIAN_RESERVE_ARMY_MAX,
  setSpaceControl,
} from "./rules";
import {closeDecision, decision, openDecision, option} from "./pending";
import {counterRemaining} from "./counters";
import {scoreGame, scoreGoals} from "./victory";
import {grantRapidDeployment, placeNonPlayerCounter, placeUnit, removeUnit} from "./effects";
import {resolveGwNeutralOption, resolveGwWinter, resolveItalyAtOutbreak, redeployItaly} from "./greatWarFlow";
import {usNorthAtlanticCheck} from "./gwMajors";
import {recordWarKnockoutCapture} from "./limitedWar";
import {addItalyMpit, italyAllianceBox, italyAllianceSide, italyMpitOf, shiftItalyToward} from "./italyEntry";
import {
  BALKAN_MINORS,
  CRISIS_ROWS,
  CrisisResultKind,
  CrisisRowId,
  crisisIncitingFor,
  crisisLabel,
  drawBalkanState,
  resolveCrisisRoll,
  type BalkanMinor,
} from "./crisisTable";

const sideOf = (G: ImperialElegyState, p: Power): "te" | "ta" | null => {
  const box = G.powers[p].alliance;
  if (box === "teAligned" || box === "teCommitted") return "te";
  if (box === "taAligned" || box === "taCommitted") return "ta";
  return null;
};

/** 22.1.3: the two Italian minors the Internal Italian War can choose. */
export const ITALIAN_INTERNAL_WAR_POWERS = ["Sardinia-Piedmont", "Two Sicilies"] as const;
export type ItalianInternalWarPower = (typeof ITALIAN_INTERNAL_WAR_POWERS)[number];

/**
 * 22.1.3: "takes control of a neighboring Italian key that is not controlled
 * by a player (there will only ever be one)."  On the printed map that single
 * key is Tuscany: it borders both Piedmont (Sardinia-Piedmont) and Naples (the
 * Two Sicilies), while Lombardy is an AU home key and Rome is the Papal
 * capital rather than a key.  Player-controlled keys are never taken.
 */
export const italianInternalWarKey = (
  G: ImperialElegyState,
  power: ItalianInternalWarPower,
): SpaceId | null => {
  const home = MINOR_POWER_HOMES[power];
  if (!home) return null;
  return (
    neighboursOf(home)
      .filter((id) => {
        const def = SPACES[id];
        if (!def || def.type !== "key" || !def.flashpoints?.includes("italy")) return false;
        return !isPower(G.spaces[id]?.control);
      })
      .sort()[0] ?? null
  );
};

const isItalianInternalWarPower = (value: string | null | undefined): value is ItalianInternalWarPower =>
  value === "Sardinia-Piedmont" || value === "Two Sicilies";

/**
 * 22.1.3: "Choose either Sardinia-Piedmont or the Kingdom of the Two Sicilies."
 * The live card has no interactive chooser, so the default is deterministic:
 * prefer the requested power when it still borders a free Italian key, else the
 * printed order (Sardinia-Piedmont first) among the powers that do.  Both
 * powers usually contest the same key (Tuscany).
 */
export const chooseItalianInternalWarPower = (
  G: ImperialElegyState,
  preferred?: string | null,
): ItalianInternalWarPower => {
  if (isItalianInternalWarPower(preferred) && italianInternalWarKey(G, preferred) !== null) return preferred;
  for (const power of ITALIAN_INTERNAL_WAR_POWERS) {
    if (italianInternalWarKey(G, power) !== null) return power;
  }
  return isItalianInternalWarPower(preferred) ? preferred : ITALIAN_INTERNAL_WAR_POWERS[0];
};

/**
 * 22.1.3 Internal Italian War:
 *
 *  - choose Sardinia-Piedmont or the Two Sicilies;
 *  - that power gains 1 army and 1 naval squadron (through the 4.2 non-player
 *    counter row, so a second play cannot over-place the printed counters);
 *  - it takes control of the one neighboring Italian key not controlled by a
 *    player (Tuscany), whose minor-power armies are eliminated.
 */
export const applyInternalItalianWar = (
  G: ImperialElegyState,
  preferred?: string | null,
): {power: ItalianInternalWarPower; key: SpaceId | null; armyId: string | null; squadronId: string | null} => {
  const power = chooseItalianInternalWarPower(G, preferred);
  const key = italianInternalWarKey(G, power);
  // The chosen minor's controlling player (15.4) keeps command of the
  // conquered key: its ally marker follows the control marker.
  const controller = minorController(G, power);
  if (key !== null) {
    // "Eliminate all minor power armies in the conquered space."
    for (const unitId of [...(G.spaces[key]?.units ?? [])]) {
      const unit = G.units[unitId];
      if (unit && isArmyKind(unit.kind) && isMinorPowerOwner(unit.owner)) removeUnit(G, unitId);
    }
    const state = G.spaces[key];
    setSpaceControl(G, key, power, {clearInfluence: true, clearDiplomacy: true});
    // The old minor's player ally marker goes with the lost key; the chosen
    // minor's controller replaces it, so the space is friendly to that player.
    state.ally = controller;
  }
  const army = key !== null
    ? placeNonPlayerCounter(G, power, "minorArmy", key, 2)
    : placeNonPlayerCounter(G, power, "minorArmy", MINOR_POWER_HOMES[power] ?? null, 2);
  const squadron = placeNonPlayerCounter(G, power, "squadron", MINOR_POWER_HOMES[power] ?? null, 2);
  return {power, key, armyId: army?.id ?? null, squadronId: squadron?.id ?? null};
};

/** The legal Internal Italian War choices: both minors border the same free key. */
export const italianInternalWarChoices = (G: ImperialElegyState): ItalianInternalWarPower[] =>
  ITALIAN_INTERNAL_WAR_POWERS.filter((power) => italianInternalWarKey(G, power) !== null);

/**
 * Apply the 22.1.3 result.  When both minors are legal the live card asks the
 * active player to choose; `italyTable` returns false while that decision is
 * open.  A direct/one-shot call (no `interactive` option) keeps the
 * deterministic printed-order auto-pick for tools and older callers.
 */
export interface ItalyTableOptions {
  interactive?: boolean;
}

const grantItalianReinforcement = (G: ImperialElegyState): void => {
  const grants = (G.italyReinforcements ??= {armies: 0, squadrons: 0});
  // 22.3.1: "Italy permanently gains an additional reserve army".  Reserve
  // armies live in the Italian reserve holding box (`space: null`), never as a
  // fourth/fifth standing army on the map.
  if (grants.armies < ITALIAN_RESERVE_ARMY_MAX) {
    grants.armies += 1;
    placeNonPlayerCounter(G, "IT", "italianArmy", null, 2);
  }
  // ... "and an additional naval unit."  The printed Italian row has room for
  // two beyond the single 22.2 squadron; an available port receives it.
  if (grants.squadrons < ITALIAN_EXTRA_NAVAL_MAX) {
    grants.squadrons += 1;
    placeNonPlayerCounter(G, "IT", "squadron", italianNavalDeploySpace(G), 2);
  }
};

/** The Italian Minor Power Table (22.1).  Returns false when a decision is open. */
export const italyTable = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  options: ItalyTableOptions = {},
): boolean => {
  if (G.persistent.italyUnified) {
    const roll = die(ctx, 6) + (G.turn >= 5 ? 1 : 0);
    if (roll <= 2) {
      // Italy gains 2 neutral influence on the MPIT.
      addItalyMpit(G, "neutral", 2);
    } else if (roll <= 4) {
      const bases = Object.values(SPACES).filter((s) => s.type === "navalBase" && s.region === "europe" && G.spaces[s.id].control === null);
      if (bases.length > 0) setSpaceControl(G, bases[0].id, "IT");
    } else if (roll <= 6) {
      grantItalianReinforcement(G);
    } else {
      // Italy declares war on the Ottomans for an Eastern Mediterranean base.
      log(G, actor, "italyOttomanWar", {});
    }
    return true;
  }
  let roll = die(ctx, 6);
  if (G.flags.italyFlashpointDominator === actor) roll -= 2;
  if (roll <= 0) {
    log(G, actor, "italyLostDream", {});
    return true;
  }
  if (roll === 1) {
    const playerSpaces = Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy") && G.spaces[s.id].control === actor);
    const target = playerSpaces.length > 0 ? playerSpaces[0].id : "piedmont";
    G.spaces[target].rebellion = {minor: "Italian Rebels", step: 0, rebels: []};
    const rebel = placeUnit(G, "REBEL:Italian", "rebelArmy", target, 2);
    G.spaces[target].rebellion.rebels.push(rebel.id);
    return true;
  }
  if (roll <= 3) {
    // Petition for aid: remove an ally marker from an Italian minor.
    const alliedMinor = Object.values(SPACES).find((s) => s.flashpoints?.includes("italy") && G.spaces[s.id].ally !== null);
    if (alliedMinor) G.spaces[alliedMinor.id].ally = null;
    G.flags.italyPetition = true;
    return true;
  }
  if (roll <= 5) {
    // 22.1.3 Internal Italian War: "Choose either Sardinia-Piedmont or the
    // Kingdom of the Two Sicilies."  When both minors border a free key the
    // active player chooses; the deterministic printed-order fallback is kept
    // for the one-shot path (no interactive option).
    const choices = italianInternalWarChoices(G);
    if (options.interactive === true && choices.length > 1) {
      openDecision(
        G,
        ctx,
        decision(
          "italianInternalWar",
          actor,
          `${POWER_DEFS[actor].name}: choose Sardinia-Piedmont or the Kingdom of the Two Sicilies`,
          choices.map((power) => option(power, power)),
        ),
      );
      return false;
    }
    applyInternalItalianWar(G);
    return true;
  }
  // Nationalist wave: a minor takes 2 uncontrolled Italian keys, then roll.
  const uncontrolled = Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy") && G.spaces[s.id].control === null).slice(0, 2);
  for (const s of uncontrolled) setSpaceControl(G, s.id, "Sardinia-Piedmont");
  italianUnificationRoll(G, ctx, actor);
  return true;
};

export const italianUnificationRoll = (G: ImperialElegyState, ctx: Ctx, actor: Power): boolean => {
  if (G.persistent.italyUnified) return false;
  const italian = Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy"));
  const playerControlled = italian.filter((s) => isPower(G.spaces[s.id].control)).length;
  const minorControls = new Map<string, number>();
  for (const s of italian) {
    const c = G.spaces[s.id].control;
    if (c !== null && !isPower(c)) minorControls.set(c, (minorControls.get(c) ?? 0) + 1);
  }
  const maxMinor = Math.max(0, ...minorControls.values());
  let roll = die(ctx, 6) + (playerControlled === 0 ? 2 : 0) + maxMinor;
  if (roll >= 7) {
    unifyItaly(G, ctx, actor);
    return true;
  }
  return false;
};

export const unifyItaly = (G: ImperialElegyState, ctx: Ctx, actor: Power): void => {
  if (G.persistent.italyUnified) return;
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  // 8.5: every power starts with 1 neutral influence; a unified Italy gets its
  // own MPIT column at the same printed value (legacy saves keep their
  // persistent markers because `italyMpitOf` still reads them).
  if (G.italyMpit === undefined) {
    const existing = italyMpitOf(G);
    G.italyMpit = existing.te + existing.ta + existing.neutral > 0 ? existing : {te: 0, ta: 0, neutral: 1};
  }
  const italian = Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy"));
  for (const s of italian) {
    // 22.2: every unification space not controlled by a player joins Italy
    // (Rome, the Papal States capital, included).
    const control = G.spaces[s.id].control;
    if (control === null || control === undefined || !isPower(control)) {
      // 15.3: an enemy occupation of an Italian space survives the political
      // unification; it still keeps the redeployment out of that space.
      setSpaceControl(G, s.id, "IT", {preserveOccupation: true});
    }
    G.spaces[s.id].influence = null;
    G.spaces[s.id].diplomacy = null;
    G.spaces[s.id].ally = null;
  }
  for (const id of Object.keys(G.units)) {
    const u = G.units[id];
    if (u.owner === "Sardinia-Piedmont" || u.owner === "Two Sicilies" || u.owner === "Tuscany") removeUnit(G, id);
  }
  // 22.2/22.4: three standing armies and one naval squadron, placed by the
  // printed Italian redeployment (Rome plus the frontier spaces, Naples/Piedmont
  // for the squadron) instead of the old fixed Naples/Piedmont/Tuscany seeding.
  redeployItaly(G, ctx);
  log(G, actor, "italyUnified", {});
};

/**
 * Apply the stability loss for losing a key (33.2/33.5).
 *
 * Routes through `changeStability` so the national characteristics see the
 * cause: RU's Scorched Earth absorbs the first key loss of the Great War and
 * is consumed, while AU's Unstable Situation and FR's government change stay
 * inert during the war.
 *
 * Safe to call from a capture/retreat resolver: it does nothing for an unknown
 * power or space, a non-key space, an eliminated power, or a key that is still
 * controlled by the power (e.g. the key was retaken).
 */
export const applyKeyLoss = (
  G: ImperialElegyState,
  power: Power,
  spaceId: SpaceId,
  ctx?: Ctx,
): number => {
  if (!isPower(power) || !G.powers[power] || G.powers[power].eliminated) return 0;
  const def = SPACES[spaceId];
  const state = G.spaces[spaceId];
  if (!def || !state) return 0;
  if (!isKeySpace(spaceId)) return 0;
  // Already retaken/held: there is no loss to apply.  An enemy occupation
  // (GW advance) leaves `control` unchanged, so it still counts as a loss.
  if (ownsKey(G, spaceId, power) && (!isPower(state.occupiedBy) || state.occupiedBy === power)) return 0;
  return changeStability(G, power, -1, ctx, {cause: "keyLoss", space: spaceId});
};

const isKeySpace = (spaceId: SpaceId): boolean => {
  const type = SPACES[spaceId]?.type;
  return type === "key" || type === "capital" || type === "subcapital";
};

/**
 * Rule 30.0: the keys whose loss/recapture moves a power's GW stability — a
 * territorial key on the main map, or one of the power's own home keys on the
 * Asia/Africa submaps.
 */
export const gwStabilityKey = (spaceId: SpaceId, power: Power): boolean => {
  const def = SPACES[spaceId];
  if (!def || !isKeySpace(spaceId)) return false;
  if (def.submap === "main") return def.keyType === "territorial";
  if (def.submap === "africa" || def.submap === "asia") return def.home === power;
  return false;
};

/** Who currently holds a space for 30.0: an occupier, otherwise the controller. */
export const keyHolder = (G: ImperialElegyState, spaceId: SpaceId): Power | null => {
  const state = G.spaces[spaceId];
  if (!state) return null;
  if (isPower(state.occupiedBy)) return state.occupiedBy;
  return isPower(state.control) ? state.control : null;
};

/**
 * Rule 30.0 GW stability for a land capture.  Call after `captor` has taken
 * `spaceId` from `previousHolder`:
 *  - the previous holder loses 1 stability for a 30.0 key (through
 *    `applyKeyLoss`, so RU's Scorched Earth can absorb the first one);
 *  - the captor gains 1 stability when it recaptures a 30.0 key it controls.
 * Returns the stability deltas actually applied. Does nothing outside the GW.
 */
export const applyGwKeyCapture = (
  G: ImperialElegyState,
  spaceId: SpaceId,
  previousHolder: Power | null,
  captor: Power,
  ctx?: Ctx,
): {loser: number; captor: number} => {
  const result = {loser: 0, captor: 0};
  if (!G.gw?.active) {
    // 15.6: outside the GW a capture can knock a player ally out of a limited
    // war.  Record it now, so a later recapture cannot erase the 16.1.6 treaty
    // option.  Inert when no limited war is running.
    recordWarKnockoutCapture(G, spaceId, captor);
    return result;
  }
  if (previousHolder === null || previousHolder === captor) return result;
  // Only the controller loses the key: an occupier being driven out of an
  // enemy key loses nothing (the owner's recapture is handled below).
  if (
    G.spaces[spaceId]?.control === previousHolder &&
    gwStabilityKey(spaceId, previousHolder) &&
    G.gw.belligerents.includes(previousHolder)
  ) {
    result.loser = applyKeyLoss(G, previousHolder, spaceId, ctx);
    log(G, previousHolder, "gwKeyLost", {space: spaceId, by: captor, stability: result.loser});
  }
  if (G.spaces[spaceId]?.control === captor && gwStabilityKey(spaceId, captor) && !G.powers[captor]?.eliminated) {
    result.captor = changeStability(G, captor, 1, ctx);
    log(G, captor, "gwKeyRecaptured", {space: spaceId});
  }
  return result;
};

const formAlliances = (G: ImperialElegyState): void => {
  const te = POWERS.filter((p) => G.powers[p].alliance === "teAligned" || G.powers[p].alliance === "teCommitted");
  const ta = POWERS.filter((p) => G.powers[p].alliance === "taAligned" || G.powers[p].alliance === "taCommitted");
  if (te.length === 0 && ta.length === 0) {
    // 25.2.2: neither alliance has a player - roll a die for a pair of enemies.
    const roll = (G.seed % 6) + 1;
    const pairs: [Power, Power][] = [["GE", "FR"], ["FR", "UK"], ["UK", "RU"], ["RU", "OT"], ["OT", "AU"], ["AU", "GE"]];
    const [a, b] = pairs[(roll - 1) % pairs.length];
    G.powers[a].alliance = a === "GE" ? "taCommitted" : "teCommitted";
    G.powers[b].alliance = b === "GE" ? "taCommitted" : "teCommitted";
    G.powers[a].mpit = {te: 0, ta: 1, neutral: 0};
    G.powers[b].mpit = {te: 1, ta: 0, neutral: 0};
  } else if (te.length === 0) {
    const target = POWERS.find((p) => G.powers[p].alliance === "neutral");
    if (target) G.powers[target].alliance = "teCommitted";
  } else if (ta.length === 0) {
    const target = POWERS.find((p) => G.powers[p].alliance === "neutral");
    if (target) G.powers[target].alliance = "taCommitted";
  }
};

/**
 * Crisis Table context handed to the Outbreak Step.  25.3's exception is
 * "if Italy is blamed for the inciting incident **based on the Crisis Table
 * Result**", so the real blamed power (a bordering nation, the assassination
 * target, the Black Hand target, the losing power…) travels with the outbreak.
 */
export interface CrisisOutbreakInfo {
  /** Printed "Event — Incident — Result" label, for the log. */
  label?: string;
  /** The power blamed by the table; "IT" means a unified Italy is blamed. */
  blame?: Power | "IT" | null;
  /** Set when a minor power (not a player) was named as the bordering nation. */
  blameMinor?: string | null;
}

export const outbreakGreatWar = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  incident: string,
  crisis?: CrisisOutbreakInfo,
): void => {
  if (G.gw?.active) return;
  // 25.3: the Alliance Track chit of a unified Italy outlives the pre-war state;
  // `G.gw` is replaced below, so keep the box across the outbreak.  Read it as a
  // plain value: `italyAllianceBox` falls back to `persistent`, which is the same
  // object this function later writes to.
  const italyChit = italyAllianceBox(G);
  G.wtt = 5;
  // 25.1 discard all action cards (including home cards).
  for (const p of POWERS) {
    for (const card of [...G.powers[p].hand]) discardCard(G, p, card, "gwOutbreakDiscard");
    G.powers[p].homeCards.forEach((id) => {
      if (!G.removed.includes(id) && !G.discard.includes(id)) G.discard.push(id);
    });
    G.powers[p].homeCards = [];
    G.powers[p].selectedHomeCard = null;
  }
  formAlliances(G);
  const te = POWERS.filter((p) => sideOf(G, p) === "te");
  const ta = POWERS.filter((p) => sideOf(G, p) === "ta");
  const neutrals = POWERS.filter((p) => sideOf(G, p) === null);
  G.gw = {
    active: true,
    turn: 0,
    order: [],
    belligerents: [...te, ...ta],
    neutrals,
    te,
    ta,
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    italyAlliance: italyChit,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: false,
    nationalWillDone: false,
    bonusImpulses: [],
  };
  // 33.2 Rapid Deployment: the UK entered the GW when it is a belligerent.
  if (G.gw.belligerents.includes("UK")) grantRapidDeployment(G, "gw");
  // 33.1 Superior Staff Work: a fresh Great War re-arms the one free deploy of
  // GE's first GW impulse (the latched impulse key belongs to this GW only).
  delete G.powers.GE.flags.superiorStaffWorkGwUsed;
  delete G.powers.GE.flags.superiorStaffWorkGwFirst;
  // 33.6 Jihad: the Ottomans gain 3 Jihad markers at the start of the GW.
  // Any markers already gained from OT's Jihad home card are kept.
  G.powers.OT.jihad = (G.powers.OT.jihad ?? 0) + 3;
  log(G, "OT", "jihadMarkersGained", {markers: 3, total: G.powers.OT.jihad});
  // 25.3: Italy's own Alliance Track chit decides whether a unified Italy joins
  // at the outbreak.  It runs after the alliances are formed (25.2) and before
  // the GW turn order, so its slot lands after the player slots (26.3).
  // `italyIndependent` is false until this point, so `italyAllianceBox` reads
  // the GW state that was just created and 25.3 never shows up mid-war only.
  resolveItalyAtOutbreak(G, ctx, incident, actor, crisis);
  G.persistent.italyAlliance = G.gw.italyAlliance ?? "neutral";
  G.flags.gwOutbreakItalyResolved = true;
  const italySlot: "IT"[] = G.gw.italyIn ? ["IT"] : [];
  // 33.5 The Second Rome: "Controlling Istanbul at the end of the game and/or
  // the start of the GW gives Russia 2 VPs."  The end-of-game half is scored by
  // `victory.scoreGame`; this is the separate start-of-GW checkpoint, awarded
  // before 25.5/25.6 so it is part of Russia's total there.
  if (G.spaces.istanbul?.control === "RU") {
    G.powers.RU.vp += 2;
    log(G, "RU", "secondRomeVp", {vp: 2});
  }
  // Score NGs at the outbreak (25.5).
  const scores = scoreGoals(G);
  for (const p of POWERS) {
    for (const entry of scores[p]) G.powers[p].vp += entry.vp;
    G.powers[p].goals = [];
  }
  // National will (25.6).
  let ukOutbreakArmies = 0;
  for (const p of POWERS) {
    const vp = G.powers[p].vp;
    if (vp >= 3) placeUnit(G, p, "eliteCorps", null, 1);
    if (vp >= 5) ukOutbreakArmies += boostTrack(G, p, 1, ctx);
    if (vp >= 7) ukOutbreakArmies += boostTrack(G, p, 1, ctx);
    if (vp >= 9) ukOutbreakArmies += boostTrack(G, p, 1, ctx);
  }
  // 25.6.1 / 33.2 "Join Your Country's Army!": the UK has no reserve box, so
  // every bonus reserve army gained here waits in the UK's holding box and is
  // placed in London during the Planning Step of GW turn 1.
  if (ukOutbreakArmies > 0) {
    // 4.2 counter limit: the free outbreak armies are still British standing
    // army counters and no printed clause exempts them from the UK pool
    // (5 standing + 5 Indian/CW).  Cap the gain at the counters the UK still
    // owns; the rulebook gives no "gained but unbuildable" marker.
    const room = counterRemaining(G, "UK", "army");
    const placeable = room === null ? ukOutbreakArmies : Math.min(ukOutbreakArmies, Math.max(0, room));
    if (placeable > 0) G.powers.UK.flags.joinYourCountrysArmyPending = placeable;
    if (placeable < ukOutbreakArmies) {
      log(G, "UK", "joinYourCountrysArmyLimited", {gained: ukOutbreakArmies, placeable});
    }
  }
  // 25.3: Italy enters at the outbreak before 25.4 — a major that enters at 0
  // stability gains 1.
  if (G.gw.italyIn && G.gw.italyStability <= 0) G.gw.italyStability = 1;
  // GW turn order: alternating, GE's alliance first.
  const geSide = sideOf(G, "GE") ?? "ta";
  const first = geSide === "te" ? te : ta;
  const second = geSide === "te" ? ta : te;
  const order: (Power | "bonus" | "IT")[] = [];
  const max = Math.max(first.length, second.length);
  for (let i = 0; i < max; i += 1) {
    if (first[i]) order.push(first[i]);
    if (second[i]) order.push(second[i]);
  }
  if (first.length !== second.length) {
    order.push("bonus");
  }
  // 26.3: Italy's impulse comes at the end of the order.
  order.push(...italySlot);
  G.gw.order = order;
  // 25.7.1: the single bonus marker belongs to the outnumbered alliance.
  G.gw.bonusImpulseSide =
    first.length === second.length ? null : first.length < second.length ? geSide : geSide === "te" ? "ta" : "te";
  G.gw.outbreakDone = true;
  G.gw.nationalWillDone = true;
  G.phase = "gwPlanning";
  G.wtt = 4;
  log(G, actor, "greatWarOutbreak", {
    incident,
    te: te.join(","),
    ta: ta.join(","),
    neutrals: neutrals.join(","),
    crisis: crisis?.label ?? "",
    blame: crisis?.blame ?? "",
    blameMinor: crisis?.blameMinor ?? "",
  });
  ctx.events?.setPhase?.("gwPlanning");
};

/**
 * 25.6: apply one display track boost.  When every printed track is already
 * maxed the printed benefit becomes a bonus reserve army.  The UK owns no
 * reserve box (33.2 Professional Army), so those armies are returned to the
 * caller; `outbreakGreatWar` records them for Join Your Country's Army!.
 */
const boostTrack = (G: ImperialElegyState, power: Power, count: number, ctx: Ctx): number => {
  let joinArmies = 0;
  for (let i = 0; i < count; i += 1) {
    const p = G.powers[power];
    // A stability gain goes through changeStability so a future characteristic
    // that reacts to gains (or the elimination check) is not bypassed.
    if (p.stability < 6) changeStability(G, power, 1, ctx);
    else if (p.industry < 7) p.industry += 1;
    else if (power === "UK" && p.manpower >= ukManpowerCeiling()) joinArmies += 1;
    else p.manpower += 1;
  }
  return joinArmies;
};

/** The top box of the UK manpower track (33.2); a boost above it is wasted. */
const ukManpowerCeiling = (): number => {
  const track = POWER_DEFS.UK.keyManpower;
  return track[track.length - 1] ?? 0;
};

/* -------------------------------------------------------------------------- */
/* 23.0–23.5 The Crisis Table                                                 */
/* -------------------------------------------------------------------------- */

/** How one crisis roll ended. */
export type CrisisOutcome =
  /** International Conference*: no Great War, the inciting card resumes. */
  | "conference"
  /** The Great War broke out (the Outbreak Step already ran, §25.0). */
  | "outbreak"
  /** The table still needs a player choice; a pending decision is open. */
  | "pending";

/** Bounded so a constant die can never loop forever (see conference reroll). */
const CRISIS_MAX_CONFERENCE_REROLLS = 12;
/** Bounded Balkan draw retries for the same reason. */
const BALKAN_MAX_DRAWS = 24;

/** A bordering nation the active player may select (§23.3). */
interface BorderChoice {
  kind: "power" | "minor" | "italy";
  power?: Power;
  minor?: string;
  space?: string;
}

/** The serializable continuation stored in the pending decision's context. */
interface CrisisRun {
  inciting: string | null;
  rowId: CrisisRowId;
  roll: number;
  kind: CrisisResultKind;
  /** Printed "Event — Incident — Result" label. */
  label: string;
  special: boolean;
  /** `Balkan Table (Roll twice)` = 2. */
  rolls: 1 | 2;
  respondentFallback: Power | null;
  /** The player the inciting event affected (bordering nation / blame). */
  targetPower: Power | null;
  threatened: BalkanMinor | null;
  losingSpace: string | null;
  balkanDraws: string[];
  rollsLeft: number;
  respondent: Power | null;
  border: BorderChoice | null;
  blame: Power | "IT" | null;
  blameMinor: string | null;
  drawn: Power[];
  joinsDone: boolean;
  effectsDone: boolean;
  stage: "target" | "bordering" | "threatened" | "balkan" | "joins" | "done";
}

const crisisRunOf = (pending: PendingDecision): CrisisRun | null => {
  const raw = pending.context?.crisis;
  if (raw === null || typeof raw !== "object") return null;
  const run = raw as unknown as CrisisRun;
  return typeof run.rowId === "string" ? run : null;
};

/**
 * Open the "Roll on the Crisis Table" decision.  Exported so `effects.ts` can
 * use the single decision shape for the `wtt` effect, the `crisis` effect and
 * the post-event check that catches WTT increases raised inside a special
 * handler (Powder Keg, Naval Arms Race, Balkan Wars, Bosnian Crisis).
 */
export const openCrisisDecision = (G: ImperialElegyState, ctx: Ctx, actor: Power, resume: Effect[] = []): void => {
  openDecision(
    G,
    ctx,
    decision("crisis", actor, "Roll on the Crisis Table", [option("roll", "Roll")], {
      resume,
      inciting: G.resolvingCard,
    }),
  );
};

const isAlliedToAU = (G: ImperialElegyState, power: Power | null): boolean =>
  power !== null && allied(G, power, "AU");

const opposingSideOf = (G: ImperialElegyState, power: Power): "te" | "ta" | null => {
  const side = allianceOf(G.powers[power].alliance);
  if (side === "te") return "ta";
  if (side === "ta") return "te";
  return null;
};

const playersOnSide = (G: ImperialElegyState, side: "te" | "ta"): Power[] =>
  POWERS.filter((p) => !G.powers[p].eliminated && allianceOf(G.powers[p].alliance) === side);

const balkanHome = (minor: string): SpaceId | null => MINOR_POWER_HOMES[minor] ?? null;

const isBalkanIndependent = (G: ImperialElegyState, minor: BalkanMinor): boolean => {
  const home = balkanHome(minor);
  return home !== null && G.spaces[home]?.control === minor;
};

const independentBalkanStates = (G: ImperialElegyState): BalkanMinor[] =>
  BALKAN_MINORS.filter((minor) => isBalkanIndependent(G, minor));

/** §23.2: draw a Balkan state, rerolling until the state is independent. */
const drawLiveBalkan = (G: ImperialElegyState, ctx: Ctx): {minor: BalkanMinor | null; choice: boolean} => {
  for (let attempt = 0; attempt < BALKAN_MAX_DRAWS; attempt += 1) {
    const draw = drawBalkanState([die(ctx, 6)], (minor) => isBalkanIndependent(G, minor));
    if (draw.choice) return {minor: null, choice: true};
    if (draw.drawn !== null) return {minor: draw.drawn, choice: false};
  }
  const fallback = independentBalkanStates(G)[0] ?? null;
  log(G, undefined, "noLegalTarget", {card: G.resolvingCard ?? ""});
  return {minor: fallback, choice: false};
};

/** The player allied to a minor power (its ally marker's owner), if any. */
const minorAlly = (G: ImperialElegyState, minor: string): Power | null => {
  const home = balkanHome(minor);
  if (home === null) return null;
  const ally = G.spaces[home]?.ally ?? null;
  return isPower(ally) ? ally : null;
};

const setMinorAlly = (G: ImperialElegyState, actor: Power, minor: string, ally: Power): void => {
  const home = balkanHome(minor);
  if (home === null || !G.spaces[home]) return;
  G.spaces[home].ally = ally;
  log(G, actor, "minorAlliance", {space: home});
};

/**
 * The Black Hand step 1 row: roll the target (1 GE … 6 OT).  The result is the
 * incident for step 2 (§23.2 "consult the incident column").
 */
const blackHandTargetRoll = (G: ImperialElegyState, ctx: Ctx): Power | null => {
  const roll = die(ctx, 6);
  const res = resolveCrisisRoll({rowId: "blackHandStep1", roll});
  const target = res.kind === "outbreak" ? res.result.target ?? null : null;
  log(G, undefined, "crisisRoll", {roll, inciting: G.resolvingCard ?? "", step: 1, target: target ?? "", result: "Target"});
  return target;
};

/** Home spaces of a player power (its printed home keys). */
const homeSpacesOf = (power: Power): SpaceId[] =>
  Object.values(SPACES)
    .filter((def) => def.home === power)
    .map((def) => def.id);

const landAdjacent = (a: SpaceId, b: SpaceId): boolean =>
  connectionsOf(a).some((conn) => {
    const other = conn.a === a ? conn.b : conn.a;
    return other === b && conn.type !== "sea";
  });

/** Powers (major or minor) that share a land border with the targeted player. */
const borderingCandidates = (G: ImperialElegyState, target: Power): BorderChoice[] => {
  const targetHomes = new Set(homeSpacesOf(target));
  const touchesTarget = (home: SpaceId): boolean =>
    [...targetHomes].some((other) => landAdjacent(home, other));
  const out: BorderChoice[] = [];
  let italy: BorderChoice | null = null;
  for (const power of POWERS) {
    if (power === target || G.powers[power].eliminated) continue;
    if (allied(G, power, target)) continue;
    if (homeSpacesOf(power).some(touchesTarget)) out.push({kind: "power", power});
  }
  for (const [minor, home] of Object.entries(MINOR_POWER_HOMES)) {
    if (!G.spaces[home] || G.spaces[home].control === null) continue;
    const ally = G.spaces[home].ally ?? null;
    if (isPower(ally) && (ally === target || allied(G, ally, target))) continue;
    if (touchesTarget(home)) out.push({kind: "minor", minor, space: home});
  }
  // "A unified Italy can only be chosen if there are no other options (but
  // Italy still can't be chosen if it is allied to the targeted power)."
  if (G.persistent.italyUnified === true) {
    const italySide = italyAllianceSide(G);
    const italyAlliedToTarget = italySide !== null && allianceOf(G.powers[target].alliance) === italySide;
    const italyHomes = Object.values(SPACES)
      .filter((def) => def.flashpoints?.includes("italy"))
      .map((def) => def.id);
    if (!italyAlliedToTarget && italyHomes.some(touchesTarget)) italy = {kind: "italy"};
  }
  return out.length > 0 ? out : italy !== null ? [italy] : [];
};

const crisisOptionLabel = (choice: BorderChoice): string =>
  choice.kind === "italy"
    ? "Italy"
    : choice.kind === "power" && choice.power !== undefined
      ? POWER_DEFS[choice.power].name
      : choice.minor ?? "";

const borderOptionId = (choice: BorderChoice): string =>
  choice.kind === "italy"
    ? "italy"
    : choice.kind === "power"
      ? `power:${choice.power}`
      : `minor:${choice.minor}`;

const borderChoiceFromOption = (id: string): BorderChoice | null => {
  if (id === "italy") return {kind: "italy"};
  if (id.startsWith("power:")) {
    const power = id.slice("power:".length);
    return isPower(power) ? {kind: "power", power} : null;
  }
  if (id.startsWith("minor:")) {
    const minor = id.slice("minor:".length);
    const home = MINOR_POWER_HOMES[minor];
    return home ? {kind: "minor", minor, space: home} : null;
  }
  return null;
};

/** Chinese text for a crisis incident option id (23.3/23.5 choices). */
const crisisOptionLabelZh = (id: string): string => {
  if (id === "italy") return "意大利";
  if (id.startsWith("power:")) {
    const power = id.slice("power:".length);
    return isPower(power) ? POWER_DEFS[power].nameZh : power;
  }
  if (id.startsWith("minor:")) {
    const minor = id.slice("minor:".length);
    if (minor === "German minors") return "德意志诸小国";
    const home = MINOR_POWER_HOMES[minor];
    return home !== undefined && SPACES[home] !== undefined ? spaceLabel(home, "zh_CN") : minor;
  }
  return id;
};

/** Open one of the table's "the active player chooses" decisions. */
const openCrisisIncident = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  run: CrisisRun,
  stage: CrisisRun["stage"],
  options: {id: string; label: string}[],
  prompt: string,
): void => {
  run.stage = stage;
  openDecision(
    G,
    ctx,
    decision(
      "crisisIncident",
      actor,
      prompt,
      options.map((entry) => option(entry.id, entry.label, undefined, false, crisisOptionLabelZh(entry.id))),
      {crisis: run},
    ),
  );
};

const blameOf = (run: CrisisRun): void => {
  if (run.blame !== null) return;
  if (run.targetPower !== null) run.blame = run.targetPower;
};

/**
 * §23.5: which neutral players the crisis draws into the Great War.
 *
 * The printed list: targeted by the assassination, threatening/threatened in
 * the Balkan Wars or Powder Keg, the respondent, the Black Hand target, a
 * player involved in the Bosnian Crisis, the Moroccan Crisis / 'Urabi Revolt,
 * and the Impulsive Leader result.  Each maps to a power we already track.
 */
const collectDrawnNeutrals = (G: ImperialElegyState, run: CrisisRun): Power[] => {
  const out: Power[] = [];
  const add = (power: Power | null | undefined): void => {
    if (power === null || power === undefined) return;
    if (!isPower(power) || G.powers[power].eliminated) return;
    if (G.powers[power].alliance !== "neutral") return;
    if (!out.includes(power)) out.push(power);
  };
  add(run.targetPower);
  add(run.respondent);
  for (const minor of run.balkanDraws) add(minorAlly(G, minor));
  blameOf(run);
  if (run.blame !== null && run.blame !== "IT") add(run.blame);
  return out;
};

/** §23.5: a single neutral freely chooses; neither alliance may have 3+, nor
 *  more players than the opposing alliance. */
const legalAllianceSides = (G: ImperialElegyState): ("te" | "ta")[] => {
  const te = playersOnSide(G, "te").length;
  const ta = playersOnSide(G, "ta").length;
  const counts = {te, ta};
  return (["te", "ta"] as const).filter((side) => {
    const other = side === "te" ? "ta" : "te";
    return counts[side] < 3 && counts[side] <= counts[other];
  });
};

const joinAlliance = (G: ImperialElegyState, power: Power, side: "te" | "ta"): void => {
  G.powers[power].alliance = side === "te" ? "teAligned" : "taAligned";
  log(G, power, "gwNeutralEntry", {side});
};

/** §23.5: multiple neutrals are allocated randomly. */
const assignRandomSides = (G: ImperialElegyState, ctx: Ctx, drawn: Power[]): void => {
  for (const power of [...drawn].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b))) {
    const legal = legalAllianceSides(G);
    if (legal.length === 0) {
      log(G, power, "crisisRoll", {roll: 0, inciting: "", impossible: true, power});
      continue;
    }
    const side = legal.length === 1 ? legal[0] : legal[Math.max(0, Math.min(legal.length - 1, die(ctx, legal.length) - 1))];
    joinAlliance(G, power, side);
  }
};

const openAllianceChoice = (G: ImperialElegyState, ctx: Ctx, power: Power, run: CrisisRun): void => {
  const legal = legalAllianceSides(G);
  run.stage = "joins";
  openDecision(
    G,
    ctx,
    decision(
      "crisisAlliance",
      power,
      "Choose the alliance your neutral player joins",
      legal.map((side) => option(side, side === "te" ? "Triple Entente" : "Triple Alliance")),
      {crisis: run},
    ),
  );
};

/** §23.3/§23.4: place the bordering nation's ally marker / shift Italy. */
const applyBorderingChoice = (G: ImperialElegyState, actor: Power, run: CrisisRun): void => {
  const choice = run.border;
  const target = run.targetPower;
  const opposing = target !== null ? opposingSideOf(G, target) : null;
  if (choice === null) return;
  if (choice.kind === "italy") {
    if (opposing === null) return;
    run.blame = "IT";
    shiftItalyToward(G, opposing);
    return;
  }
  if (choice.kind === "minor" && choice.minor !== undefined) {
    run.blame = null;
    run.blameMinor = choice.minor;
    const home = balkanHome(choice.minor);
    if (home === null || opposing === null) return;
    const existing = G.spaces[home]?.ally ?? null;
    const alreadyOpposing = isPower(existing) && allianceOf(G.powers[existing].alliance) === opposing;
    if (alreadyOpposing) return;
    const placer = playersOnSide(G, opposing)[0];
    if (placer === undefined) return;
    setMinorAlly(G, actor, choice.minor, placer);
    return;
  }
  if (choice.kind === "power" && choice.power !== undefined) run.blame = choice.power;
};

/**
 * §23.3.1–23.3.3: the Balkan Table's alliance changes.
 *  - Bosnian Crisis: the drawn states enter the alliance opposing AU.
 *  - Balkan Wars / Powder Keg: the threatened state joins the respondent's
 *    alliance, the threatening states the alliance opposing the respondent.
 */
const applyBalkanTable = (G: ImperialElegyState, actor: Power, run: CrisisRun): void => {
  if (run.rowId === "bosnianCrisis") {
    const opposing = opposingSideOf(G, "AU");
    if (opposing === null) {
      log(G, actor, "noLegalTarget", {card: G.resolvingCard ?? ""});
      return;
    }
    const placer = playersOnSide(G, opposing)[0];
    if (placer === undefined) return;
    for (const minor of run.balkanDraws) setMinorAlly(G, actor, minor, placer);
    return;
  }
  const respondent = run.respondent;
  const side = respondent !== null ? allianceOf(G.powers[respondent].alliance) : null;
  if (respondent === null || side === null) {
    // §23.4: the respondent is impossible (e.g. no alliance to join).
    log(G, actor, "noLegalTarget", {card: G.resolvingCard ?? ""});
    return;
  }
  if (run.threatened !== null) setMinorAlly(G, actor, run.threatened, respondent);
  const opposing = side === "te" ? "ta" : "te";
  const placer = playersOnSide(G, opposing)[0];
  for (const minor of run.balkanDraws) {
    const home = balkanHome(minor);
    if (home === null) continue;
    const existing = G.spaces[home]?.ally ?? null;
    if (isPower(existing) && allianceOf(G.powers[existing].alliance) === opposing) continue;
    if (placer !== undefined) setMinorAlly(G, actor, minor, placer);
  }
};

/** Finish the crisis procedure: neutral joins (§23.5), special effects, then
 *  the Outbreak Step (§23.2/§25.0). */
const completeCrisis = (G: ImperialElegyState, ctx: Ctx, actor: Power, run: CrisisRun): CrisisOutcome => {
  if (!run.joinsDone) {
    const drawn = collectDrawnNeutrals(G, run);
    run.drawn = drawn;
    if (drawn.length === 1) {
      // "If only one neutral player is drawn into the GW, the player freely
      // chooses which alliance they shift into."  With no legal alliance
      // (§23.5's 3-player cap) the player stays neutral.
      if (legalAllianceSides(G).length > 0) {
        openAllianceChoice(G, ctx, drawn[0], run);
        return "pending";
      }
      log(G, drawn[0], "crisisRoll", {roll: 0, inciting: "", impossible: true, power: drawn[0]});
    }
    if (drawn.length > 1) assignRandomSides(G, ctx, drawn);
    run.joinsDone = true;
  }
  if (!run.effectsDone) {
    if (run.kind === "borderingNation") applyBorderingChoice(G, actor, run);
    else if (run.kind === "balkanTable") applyBalkanTable(G, actor, run);
    run.effectsDone = true;
  }
  run.stage = "done";
  outbreakGreatWar(G, ctx, actor, run.inciting ?? "", {
    label: run.label,
    blame: run.blame,
    blameMinor: run.blameMinor,
  });
  return "outbreak";
};

/** Roll the Powder Keg/Balkan Wars step 2 row (§23.3.3). */
const rollRespondent = (G: ImperialElegyState, ctx: Ctx, run: CrisisRun): void => {
  if (run.threatened === null) return;
  const roll = die(ctx, 6);
  const res = resolveCrisisRoll({
    rowId: "powderKegStep2",
    roll,
    alliedToAU: POWERS.filter((p) => isAlliedToAU(G, p)),
  });
  if (res.kind !== "outbreak") {
    // A step-2 conference leaves no respondent; the first roll already decided
    // the outbreak, so the Great War still occurs (see the module report).
    log(G, undefined, "crisisRoll", {roll, inciting: G.resolvingCard ?? "", step: 2, result: "International Conference"});
    return;
  }
  run.respondentFallback = res.result.fallback ?? null;
  const alliedToThreatened = minorAlly(G, run.threatened);
  run.respondent = alliedToThreatened ?? run.respondentFallback;
  log(G, undefined, "crisisRoll", {
    roll,
    inciting: G.resolvingCard ?? "",
    step: 2,
    result: res.result.label,
    respondent: run.respondent ?? "",
  });
};

/** §23.3: roll the Balkan Table once/twice, then the step 2 respondent. */
const advanceBalkan = (G: ImperialElegyState, ctx: Ctx, actor: Power, run: CrisisRun): CrisisOutcome => {
  // Only the Powder Keg / Balkan Wars incident ("random Balkan state") has a
  // threatened state; the Bosnian Crisis row draws Balkan states directly and
  // puts them in the alliance opposing AU.
  if (run.rowId === "powderKegStep1" && run.threatened === null) {
    const draw = drawLiveBalkan(G, ctx);
    if (draw.choice) {
      const options = independentBalkanStates(G).map((minor) => ({id: `minor:${minor}`, label: minor}));
      if (options.length === 0) return completeCrisis(G, ctx, actor, run);
      openCrisisIncident(G, ctx, actor, run, "threatened", options, "Choose the threatened Balkan state");
      return "pending";
    }
    run.threatened = draw.minor;
    if (run.threatened === null) return completeCrisis(G, ctx, actor, run);
  }
  while (run.rollsLeft > 0) {
    const draw = drawLiveBalkan(G, ctx);
    if (draw.choice) {
      const options = independentBalkanStates(G).map((minor) => ({id: `minor:${minor}`, label: minor}));
      if (options.length === 0) break;
      openCrisisIncident(G, ctx, actor, run, "balkan", options, "Choose a Balkan state");
      return "pending";
    }
    if (draw.minor === null) break;
    run.balkanDraws.push(draw.minor);
    run.rollsLeft -= 1;
  }
  if (run.rowId === "powderKegStep1" && run.respondent === null) rollRespondent(G, ctx, run);
  return completeCrisis(G, ctx, actor, run);
};

/** §23.3: the bordering-nation selection, or §23.4 when nothing can be chosen. */
const chooseBorderingNation = (G: ImperialElegyState, ctx: Ctx, actor: Power, run: CrisisRun): CrisisOutcome => {
  const target = run.targetPower;
  if (target === null) return completeCrisis(G, ctx, actor, run);
  const candidates = borderingCandidates(G, target);
  if (candidates.length === 0) {
    // §23.4: "a member of the opposing alliance is blamed and the GW still
    // occurs. Such results are purely narrative and do not affect the state."
    const opposing = opposingSideOf(G, target);
    run.blame = opposing !== null ? playersOnSide(G, opposing)[0] ?? null : null;
    log(G, actor, "noLegalTarget", {card: G.resolvingCard ?? ""});
    return completeCrisis(G, ctx, actor, run);
  }
  if (candidates.length === 1 && candidates[0].kind === "italy") {
    // "A unified Italy can only be chosen if there are no other options."
    run.border = candidates[0];
    return completeCrisis(G, ctx, actor, run);
  }
  openCrisisIncident(
    G,
    ctx,
    actor,
    run,
    "bordering",
    candidates.map((choice) => ({id: borderOptionId(choice), label: crisisOptionLabel(choice)})),
    "Choose the power blamed for the incident",
  );
  return "pending";
};

/** Continue a rolled crisis: incident answers, then the special result. */
const continueCrisis = (G: ImperialElegyState, ctx: Ctx, actor: Power, run: CrisisRun): CrisisOutcome => {
  // The Assassination row's incident ("Blame") needs the player the event
  // affected; it is chosen by the card, but the card text is skipped on an
  // outbreak (§23.1), so the crisis asks for it here.
  if (run.rowId === "assassination" && run.targetPower === null) {
    openCrisisIncident(
      G,
      ctx,
      actor,
      run,
      "target",
      POWERS.map((power) => ({id: `power:${power}`, label: POWER_DEFS[power].name})),
      "Choose the player the assassination targeted",
    );
    return "pending";
  }
  if (run.kind === "borderingNation") return chooseBorderingNation(G, ctx, actor, run);
  if (run.kind === "balkanTable") return advanceBalkan(G, ctx, actor, run);
  blameOf(run);
  return completeCrisis(G, ctx, actor, run);
};

/**
 * 23.0–23.5: roll once on the Crisis Table for the inciting event.
 *
 * Signature kept for the existing callers (`moves.ts`, the engine tests); the
 * optional `targetPower` lets a caller that already knows the event's target
 * pass it in.  Returns how the crisis ended so the move layer knows whether to
 * resume the inciting card's remaining text.
 */
export const crisisRoll = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  inciting: string,
  targetPower: Power | null = null,
): CrisisOutcome => {
  if (G.gw?.active) return "outbreak";
  const def = crisisIncitingFor(inciting === "" ? null : inciting);
  const drm = Number(G.flags.crisisDrm ?? 0);
  G.flags.crisisDrm = 0;
  // For the two-roll rows the *last* printed row carries the result: the Black
  // Hand's step 1 rolls the target (the incident) and step 2 the terrorism
  // result.  Powder Keg's step 1 is the result row and step 2 the respondent.
  const primaryRow = def.incident === "blackHandTarget" ? def.rows[1] ?? def.rows[0] : def.rows[0];
  let target = targetPower;
  if (def.incident === "blackHandTarget") target = blackHandTargetRoll(G, ctx);
  let losingSpace: string | null = null;
  if (def.incident === "annexation") {
    losingSpace = def.losingSpace ?? null;
    const controller = losingSpace !== null ? G.spaces[losingSpace]?.control ?? null : null;
    target = isPower(controller) ? controller : null;
  }
  const alliedToAU = POWERS.filter((p) => isAlliedToAU(G, p));
  const printedRow = CRISIS_ROWS[primaryRow];
  let resolution = resolveCrisisRoll({rowId: primaryRow, roll: 1});
  let rerolls = 0;
  for (;;) {
    const roll = die(ctx, 6);
    resolution = resolveCrisisRoll({
      rowId: primaryRow,
      roll,
      drm,
      conferenceUsed: G.persistent.conferenceUsed === true,
      alliedToAU,
      targetPower: target,
      losingSpace,
    });
    if (resolution.kind === "outbreak") break;
    if (!resolution.reroll) break;
    if (rerolls >= CRISIS_MAX_CONFERENCE_REROLLS) {
      // Safety valve: a constant die would otherwise reroll forever.  The
      // design note in 23.5 says the war is unavoidable, so stop treating the
      // repeat as a conference and fall through to a narrative outbreak.
      resolution = resolveCrisisRoll({rowId: "fallback", roll: 4});
      break;
    }
    rerolls += 1;
    // Footnote `*`: the conference already happened once, so reroll the die.
    log(G, actor, "crisisRoll", {roll, inciting, result: "International Conference (reroll)"});
  }
  if (resolution.kind === "conference") {
    log(G, actor, "crisisRoll", {
      roll: resolution.roll,
      inciting,
      event: printedRow.event,
      incident: printedRow.incident,
      result: "International Conference",
    });
    if (!resolution.reroll) {
      // "The Great War does not start, reset the WTT to 4. Can only happen
      // once per game."
      G.persistent.conferenceUsed = true;
      G.wtt = 4;
      log(G, actor, "internationalConference", {});
    }
    return "conference";
  }
  const run: CrisisRun = {
    inciting: inciting === "" ? null : inciting,
    rowId: resolution.rowId,
    roll: resolution.roll,
    kind: resolution.result.kind,
    label: crisisLabel(resolution.incident, resolution.result),
    special: resolution.special,
    rolls: resolution.result.rolls ?? 1,
    respondentFallback: resolution.result.fallback ?? null,
    targetPower: target,
    threatened: null,
    losingSpace,
    balkanDraws: [],
    rollsLeft: resolution.result.rolls ?? 1,
    respondent: null,
    border: null,
    blame: null,
    blameMinor: null,
    drawn: [],
    joinsDone: false,
    effectsDone: false,
    stage: "target",
  };
  // The Black Hand's step 1 target and the Impulsive Leader result both name
  // the player involved; the annexation rows name the losing power.
  if (resolution.result.kind === "targetPower" && resolution.result.target !== undefined) {
    run.targetPower = resolution.result.target;
  }
  if (resolution.result.kind === "losingPower") {
    const controller = losingSpace !== null ? G.spaces[losingSpace]?.control ?? null : null;
    run.targetPower = isPower(controller) ? controller : null;
  }
  log(G, actor, "crisisRoll", {
    roll: run.roll,
    inciting,
    event: printedRow.event,
    incident: resolution.incident.incident,
    result: resolution.result.label,
    special: resolution.special,
    rollDrm: drm,
    target: run.targetPower ?? "",
    // Defensive fallback (§23.2): an inciting card with no printed row.
    fallback: def.cardId === null,
  });
  return continueCrisis(G, ctx, actor, run);
};

/**
 * Resolve a follow-up decision opened by {@link crisisRoll}.  Called from
 * `moves.ts`'s crisis branch; `G.pending` has already been cleared.
 */
export const resolveCrisisPending = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): CrisisOutcome => {
  const run = crisisRunOf(pending);
  if (run === null) return "outbreak";
  const actor = pending.power;
  if (pending.kind === "crisisAlliance") {
    if (!run.drawn.includes(actor)) return "outbreak";
    const side = optionId === "te" ? "te" : optionId === "ta" ? "ta" : null;
    if (side !== null && legalAllianceSides(G).includes(side) && G.powers[actor].alliance === "neutral") {
      joinAlliance(G, actor, side);
    } else {
      log(G, actor, "crisisRoll", {roll: 0, inciting: "", refused: side ?? ""});
    }
    run.joinsDone = true;
    return completeCrisis(G, ctx, actor, run);
  }
  if (pending.kind !== "crisisIncident") return "outbreak";
  switch (run.stage) {
    case "target": {
      const choice = borderChoiceFromOption(optionId);
      if (choice === null || choice.kind !== "power" || choice.power === undefined) return "outbreak";
      run.targetPower = choice.power;
      run.blame = choice.power;
      return run.kind === "borderingNation"
        ? chooseBorderingNation(G, ctx, actor, run)
        : completeCrisis(G, ctx, actor, run);
    }
    case "bordering": {
      const choice = borderChoiceFromOption(optionId);
      if (choice === null) return "outbreak";
      run.border = choice;
      // The blamed power is known before §23.5 collects the neutral players it
      // draws in, so a neutral major chosen as the bordering nation joins.
      if (choice.kind === "power" && choice.power !== undefined) run.blame = choice.power;
      if (choice.kind === "italy") run.blame = "IT";
      return completeCrisis(G, ctx, actor, run);
    }
    case "threatened":
    case "balkan": {
      if (!optionId.startsWith("minor:")) return "outbreak";
      const minor = optionId.slice("minor:".length);
      if (!(BALKAN_MINORS as readonly string[]).includes(minor)) return "outbreak";
      if (run.stage === "threatened") {
        run.threatened = minor as BalkanMinor;
        return advanceBalkan(G, ctx, actor, run);
      }
      run.balkanDraws.push(minor);
      run.rollsLeft = Math.max(0, run.rollsLeft - 1);
      return advanceBalkan(G, ctx, actor, run);
    }
    default:
      return completeCrisis(G, ctx, actor, run);
  }
};

/**
 * @deprecated Legacy one-shot winter kept only for the two older suites that
 * call it directly (`game.test.ts`, `gwMajors.test.ts`).  The live game enters
 * the `gwWinter` phase and runs `greatWarFlow.ts#resolveGwWinter` from its
 * `onBegin` hook.  This wrapper delegates to that resolver instead of keeping a
 * second, divergent blockade/colonial-war implementation: it aligns 29.1's
 * maximum-industry track, 29.2's printed colonial-war modifiers/losses and
 * 29.3's neutral entry.  Because a helper cannot prompt, every neutral entry is
 * answered deterministically with "stay" and its free action menu with "done".
 */
export const winter = (G: ImperialElegyState, ctx: Ctx): void => {
  if (!G.gw?.active) return;
  G.phase = "gwWinter";
  G.pending = null;
  const first = resolveGwWinter(G, ctx);
  if (!first.ok) return;
  // 29.3: auto-answer the neutral-entry decisions so this one-shot call still
  // finishes the winter synchronously.  Read `G.pending` through a function so
  // the compiler does not narrow it to the `null` assigned above.
  const currentPending = (): PendingDecision | null => G.pending;
  for (let guard = 0; guard < 64; guard += 1) {
    const pending = currentPending();
    if (pending === null) break;
    const choice = pending.kind === "gwNeutralEntry" ? "stay" : "done";
    if (!pending.options.some((entry) => entry.id === choice)) break;
    if (!resolveGwNeutralOption(G, ctx, pending, choice)) break;
  }
};

export const endGreatWar = (
  G: ImperialElegyState,
  ctx: Ctx,
  reason: "elimination" | "turnLimit" | "onePower",
): void => {
  if (!G.gw) return;
  if (reason === "elimination") {
    const teAlive = G.gw.te.filter((p) => !G.powers[p].eliminated);
    const taAlive = G.gw.ta.filter((p) => !G.powers[p].eliminated);
    G.gw.victor = teAlive.length > 0 && taAlive.length === 0 ? "te" : taAlive.length > 0 && teAlive.length === 0 ? "ta" : null;
  } else if (reason === "onePower") {
    // 31.0: the alliance reduced to one living power while the opposing
    // alliance still has more than one is the defeated one; the larger
    // alliance wins.  (A 1v1 endgame is not a defeat — see checkGwVictory.)
    const teAlive = G.gw.te.filter((p) => !G.powers[p].eliminated);
    const taAlive = G.gw.ta.filter((p) => !G.powers[p].eliminated);
    const teOne = teAlive.length === 1;
    const taOne = taAlive.length === 1;
    G.gw.victor = teOne && !taOne ? "ta" : taOne && !teOne ? "te" : null;
  }
  if (G.gw.victor !== null) {
    const winners = G.gw.victor === "te" ? G.gw.te : G.gw.ta;
    const {scores} = scoreGame(G);
    // If there are neutral players compare the best victor with the best neutral.
    const neutrals = G.gw.neutrals.filter((p) => !G.powers[p].eliminated);
    let finalWinners = winners;
    if (neutrals.length > 0) {
      const bestVictor = Math.max(...winners.map((p) => scores[p] ?? 0));
      const bestNeutral = Math.max(...neutrals.map((p) => scores[p] ?? 0));
      if (bestNeutral > bestVictor) finalWinners = neutrals.filter((p) => scores[p] === bestNeutral);
      else finalWinners = winners.filter((p) => scores[p] === bestVictor);
    }
    G.scores = scores;
    G.result = {winners: finalWinners, reason: `greatWar:${G.gw.victor}`, scores};
    log(G, undefined, "greatWarEnded", {victor: G.gw.victor, winners: finalWinners.join(",")});
    G.phase = "gameOver";
    return;
  }
  // Turn limit: neutral with highest VP wins, else highest stability.
  const {scores} = scoreGame(G);
  const neutrals = G.gw.neutrals.filter((p) => !G.powers[p].eliminated);
  let winners: Power[];
  if (neutrals.length > 0) {
    const max = Math.max(...neutrals.map((p) => scores[p] ?? 0));
    winners = neutrals.filter((p) => scores[p] === max);
    G.result = {winners, reason: "gwTurnLimit:neutralVp", scores};
  } else {
    const max = Math.max(...POWERS.filter((p) => !G.powers[p].eliminated).map((p) => G.powers[p].stability));
    winners = POWERS.filter((p) => !G.powers[p].eliminated && G.powers[p].stability === max);
    G.result = {winners, reason: "gwTurnLimit:stability", scores};
  }
  G.scores = scores;
  G.phase = "gameOver";
  log(G, undefined, "greatWarEnded", {reason: "turnLimit", winners: winners.join(",")});
};

export const checkGwVictory = (G: ImperialElegyState, ctx: Ctx): void => {
  // Idempotent: the battle-end and winter checkpoints can both run after the
  // war has already been decided.
  if (!G.gw || G.result) return;
  const teAlive = G.gw.te.filter((p) => !G.powers[p].eliminated);
  const taAlive = G.gw.ta.filter((p) => !G.powers[p].eliminated);
  if (teAlive.length === 0 || taAlive.length === 0) {
    endGreatWar(G, ctx, "elimination");
    return;
  }
  // 31.0 second bullet: "There is only one power remaining in an alliance and
  // there are no neutral players".  A neutral *player* is a living power still
  // outside both alliances (US/Italy are non-player majors, not neutral
  // players); while one remains it could still join the depleted alliance, so
  // the war goes on.  The condition defeats the alliance that is down to one
  // power while the opposing alliance still has more than one.  If both
  // alliances are down to one (a 1v1 endgame) neither has won, so the war runs
  // on to the turn-5 limit as the printed "if neither alliance has won" rule
  // provides.
  const neutralPlayers = G.gw.neutrals.filter((p) => G.powers[p] && !G.powers[p].eliminated);
  if (neutralPlayers.length > 0) return;
  const teOutnumbered = teAlive.length === 1 && taAlive.length > 1;
  const taOutnumbered = taAlive.length === 1 && teAlive.length > 1;
  if (!teOutnumbered && !taOutnumbered) return;
  endGreatWar(G, ctx, "onePower");
};

