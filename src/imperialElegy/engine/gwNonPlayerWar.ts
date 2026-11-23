/**
 * Rule 32.4 — Attacking neutral non-player powers during the Great War.
 *
 *   "Players can declare war on non-player powers at any point during their
 *   impulse.  When this happens a player from the opposing alliance immediately
 *   places an alliance marker in the minor power's space.  If the alliance
 *   members cannot agree which receives the minor power as an ally, use a die
 *   roll to resolve it.
 *
 *   If a neutral player is allied to or has a diplomacy marker in the attacked
 *   power's space, that neutral player has the option to immediately join the
 *   GW with the opposing alliance (the opposing alliance in this case is the
 *   alliance that didn't attack the minor power)."
 *
 * The subsystem has three state effects:
 *
 *  1. `G.gw.nonPlayerBelligerents` records the declared power, its alliance,
 *     the marker owner and its home spaces.  `hostileOwner`/`legalLandBattleTarget`
 *     read it, so a neutral non-player is no longer a free target.
 *  2. The opposing alliance's marker is written into the power's home space, so
 *     its units fight for that side through the ordinary 15.4 control path.
 *  3. A neutral player with an ally or diplomacy marker in the space is asked
 *     (`gwNonPlayerJoin`) whether to join the opposing alliance.
 *
 * 30.2 then governs the declared non-player's exit: a minor never "surrenders"
 * but is effectively eliminated from the war once all its troops are gone and
 * its home space(s) are occupied.  Its alliance marker is inherited by a
 * surviving member of the same alliance (the same determinism `rules.ts` uses
 * for an eliminated player under 30.1); a unified Italy still uses the 30.2
 * stability/Rome surrender path.
 */
import type {Ctx} from "boardgame.io";
import type {
  GwNonPlayerBelligerent,
  GwSide,
  ImperialElegyState,
  Power,
  PowerOrMinor,
  SpaceId,
} from "../types";
import {SPACES} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {die, isPower, log, minorController, occupyingOwners, POWER_ORDER} from "./rules";
import {decision, openDecision, option} from "./pending";
import {gwNonPlayerBelligerents} from "./gwNonPlayer";

export type GwNonPlayerTargetKind = "minor" | "major";

export interface GwNonPlayerTargetInfo {
  power: string;
  kind: GwNonPlayerTargetKind;
  spaces: SpaceId[];
}

export interface GwNonPlayerWarCheck {
  ok: boolean;
  reason?: string;
  info?: GwNonPlayerTargetInfo;
}

export interface GwNonPlayerDeclaration {
  ok: boolean;
  reason?: string;
  entry?: GwNonPlayerBelligerent;
  /** The neutral players still to be asked about joining the opposing side. */
  joinQueue?: Power[];
}

const sideOfPower = (G: ImperialElegyState, power: Power): GwSide | null => {
  if (!G.gw?.active) return null;
  if (G.gw.te.includes(power)) return "te";
  if (G.gw.ta.includes(power)) return "ta";
  return null;
};

/** The alliance opposite `power`'s; null when `power` is not a belligerent. */
export const opposingSide = (G: ImperialElegyState, power: Power): GwSide | null => {
  const side = sideOfPower(G, power);
  return side === null ? null : side === "te" ? "ta" : "te";
};

const rosterFor = (G: ImperialElegyState, side: GwSide): Power[] =>
  (side === "te" ? G.gw?.te : G.gw?.ta) ?? [];

/** The home space(s) of a minor power, in a stable map order. */
export const minorHomeSpaces = (G: ImperialElegyState, minor: string): SpaceId[] => {
  const out: SpaceId[] = [];
  const primary = MINOR_POWER_HOMES[minor];
  if (primary !== undefined && G.spaces[primary]) out.push(primary);
  for (const def of Object.values(SPACES)) {
    if (def.minorHome === minor && !out.includes(def.id) && G.spaces[def.id]) out.push(def.id);
  }
  return out;
};

/** 32.2/30.2: a unified Italy's home keys (Rome included). */
export const italianGwSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter(
      (def) =>
        def.id === "rome" ||
        (def.flashpoints?.includes("italy") === true &&
          ["key", "capital", "subcapital"].includes(def.type) &&
          def.home === undefined &&
          G.spaces[def.id] !== undefined),
    )
    .map((def) => def.id);

const minorInfo = (G: ImperialElegyState, minor: string): GwNonPlayerTargetInfo | null => {
  const spaces = minorHomeSpaces(G, minor);
  if (spaces.length === 0) return null;
  const exists = Object.values(G.spaces).some(
    (state) => state.control === minor || state.occupiedBy === minor ||
      state.units.some((id) => G.units[id]?.owner === minor),
  );
  return exists ? {power: minor, kind: "minor", spaces} : null;
};

const majorInfo = (G: ImperialElegyState, target: string): GwNonPlayerTargetInfo | null => {
  if (target !== "IT") return null;
  if (G.persistent.italyUnified !== true || G.gw?.italyIn === true || G.gw?.italySurrendered === true) {
    return null;
  }
  return {power: "IT", kind: "major", spaces: italianGwSpaces(G)};
};

/** The typed target record for a non-player power, or null when it is not one. */
export const gwNonPlayerTargetInfo = (
  G: ImperialElegyState,
  target: string,
): GwNonPlayerTargetInfo | null => {
  if (target === "IT") return majorInfo(G, target);
  if (target === "US" || target === "United States") return null;
  return minorInfo(G, target);
};

/**
 * 32.4's prohibition on a target that is already on the declarer's side.
 * A non-player controlled by a *neutral* player is still a legal target (the
 * rule gives that neutral the option to join the other side).
 */
const friendlyToAttacker = (G: ImperialElegyState, power: Power, target: string): boolean => {
  const side = sideOfPower(G, power);
  if (side === null) return false;
  const entry = gwNonPlayerBelligerents(G).find((item) => item.power === target && item.eliminated !== true);
  if (entry !== undefined) return entry.side === side;
  const controller = minorController(G, target);
  if (controller !== null && !G.powers[controller]?.eliminated) return sideOfPower(G, controller) === side;
  return false;
};

/** True when the target already fights on the *other* alliance. */
const alreadyEnemyBelligerent = (G: ImperialElegyState, power: Power, target: string): boolean => {
  const side = sideOfPower(G, power);
  if (side === null) return false;
  const entry = gwNonPlayerBelligerents(G).find((item) => item.power === target && item.eliminated !== true);
  if (entry !== undefined) return entry.side !== side;
  const controller = minorController(G, target);
  if (controller !== null && !G.powers[controller]?.eliminated) {
    const controllerSide = sideOfPower(G, controller);
    return controllerSide !== null && controllerSide !== side;
  }
  return false;
};

/**
 * Validate one 32.4 declaration.  Kept separate from the mutation so the board,
 * the bot and the move all read the same gate.
 */
export const checkGwNonPlayerDeclaration = (
  G: ImperialElegyState,
  power: Power,
  target: string,
): GwNonPlayerWarCheck => {
  if (!G.gw?.active) return {ok: false, reason: "no-great-war"};
  if (G.phase !== "gwManeuver") return {ok: false, reason: "wrong-phase"};
  if (G.pending !== null) return {ok: false, reason: "pending"};
  if (G.powers[power]?.eliminated) return {ok: false, reason: "eliminated"};
  if (G.activePower !== power) return {ok: false, reason: "not-active"};
  if (!G.gw.belligerents.includes(power)) return {ok: false, reason: "not-belligerent"};
  const side = sideOfPower(G, power);
  if (side === null) return {ok: false, reason: "neutral-player"};
  const info = gwNonPlayerTargetInfo(G, target);
  if (info === null) return {ok: false, reason: "not-non-player"};
  if (minorHomeSpaces(G, target).some((space) => G.spaces[space]?.strictNeutrality === true)) {
    return {ok: false, reason: "strict-neutrality"};
  }
  const existing = gwNonPlayerBelligerents(G).find((item) => item.power === target);
  if (existing?.eliminated === true) return {ok: false, reason: "eliminated"};
  if (existing !== undefined) {
    return {ok: false, reason: existing.side === side ? "friendly" : "already-belligerent"};
  }
  if (friendlyToAttacker(G, power, target)) return {ok: false, reason: "friendly"};
  if (alreadyEnemyBelligerent(G, power, target)) return {ok: false, reason: "already-belligerent"};
  return {ok: true, info};
};

/** Every non-player power `power` may declare war on right now (UI/bot list). */
export const gwNonPlayerWarTargets = (G: ImperialElegyState, power: Power): GwNonPlayerTargetInfo[] => {
  const out: GwNonPlayerTargetInfo[] = [];
  const minors = new Set<string>();
  for (const state of Object.values(G.spaces)) {
    if (typeof state.control === "string" && MINOR_POWER_HOMES[state.control] !== undefined) {
      minors.add(state.control);
    }
    for (const id of state.units) {
      const owner = G.units[id]?.owner;
      if (typeof owner === "string" && MINOR_POWER_HOMES[owner] !== undefined) minors.add(owner);
    }
  }
  for (const minor of minors) {
    const check = checkGwNonPlayerDeclaration(G, power, minor);
    if (check.ok && check.info !== undefined) out.push(check.info);
  }
  const italy = checkGwNonPlayerDeclaration(G, power, "IT");
  if (italy.ok && italy.info !== undefined) out.push(italy.info);
  return out.sort((a, b) => a.power.localeCompare(b.power));
};

/** The living members of `side`, in GW initiative order (deterministic heir/owner). */
const orderedSurvivors = (G: ImperialElegyState, side: GwSide, exclude?: Power): Power[] =>
  rosterFor(G, side)
    .filter((candidate) => candidate !== exclude &&
      G.powers[candidate] !== undefined && !G.powers[candidate].eliminated)
    .sort((a, b) => {
      const ia = G.gw!.order.indexOf(a);
      const ib = G.gw!.order.indexOf(b);
      const oa = ia < 0 ? Number.MAX_SAFE_INTEGER : ia;
      const ob = ib < 0 ? Number.MAX_SAFE_INTEGER : ib;
      return oa - ob || POWER_ORDER[a] - POWER_ORDER[b];
    });

/**
 * 32.4's "a player from the opposing alliance immediately places an alliance
 * marker ... If the alliance members cannot agree ... use a die roll".
 *
 * The engine has no negotiation channel, so an explicit `preferredAlly` (the
 * table's agreement) wins when it is a living member of the opposing alliance.
 * Otherwise the first member in initiative order places the marker.  With two
 * members the printed disagreement fallback is the die roll, matching 30.1's
 * helper so the two inheritance paths cannot disagree.
 */
export const chooseOpposingMarkerOwner = (
  G: ImperialElegyState,
  side: GwSide,
  preferredAlly?: Power | null,
  ctx?: Ctx,
): Power | null => {
  const survivors = orderedSurvivors(G, side);
  if (survivors.length === 0) return null;
  if (preferredAlly !== undefined && preferredAlly !== null && survivors.includes(preferredAlly)) {
    return preferredAlly;
  }
  if (survivors.length === 2 && ctx !== undefined) {
    const rolls = survivors.map((candidate) => ({power: candidate, roll: die(ctx, 6)}));
    const best = Math.max(...rolls.map((entry) => entry.roll));
    const winner = rolls.find((entry) => entry.roll === best);
    if (winner !== undefined) return winner.power;
  }
  return survivors[0];
};

const neutralJoinQueue = (
  G: ImperialElegyState,
  info: GwNonPlayerTargetInfo,
): Power[] => {
  if (!G.gw) return [];
  const queue: Power[] = [];
  const add = (candidate: unknown): void => {
    if (!isPower(candidate)) return;
    if (G.gw!.neutrals.includes(candidate) && !G.powers[candidate].eliminated &&
      !queue.includes(candidate)) queue.push(candidate);
  };
  for (const space of info.spaces) {
    add(G.spaces[space]?.ally);
    add(G.spaces[space]?.diplomacy);
  }
  // Only a *neutral* player has the 32.4 option; `add` filters the `gw.neutrals`
  // roster, and a player already in an alliance has a non-null side.
  return queue.filter((candidate) => sideOfPower(G, candidate) === null);
};

/** Open the next 32.4 neutral-player join question, if any. */
export const openGwNonPlayerJoinDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  target: string,
  side: GwSide,
  queue: Power[],
): void => {
  const next = queue[0];
  if (next === undefined) return;
  const rest = queue.slice(1);
  openDecision(G, ctx, decision(
    "gwNonPlayerJoin",
    next,
    "Rule 32.4: you may join the Great War with the opposing alliance",
    [
      option("join", `Join the Great War with ${side === "te" ? "the Triple Entente" : "the Triple Alliance"}`,
        {target, side}, false, `加入大战，站在${side === "te" ? "协约国" : "同盟国"}一方`),
      option("stay", "Remain neutral", undefined, false, "保持中立"),
    ],
    {target, side, queue: rest},
    undefined,
    `规则 32.4：你可以立即加入大战，站在${side === "te" ? "协约国" : "同盟国"}一方。`,
  ));
  log(G, undefined, "gwNonPlayerJoinAsked", {neutral: next, target, side});
};

/** The marker owner recorded for a declaration (a living opposing member). */
const markerOwner = (G: ImperialElegyState, side: GwSide, ctx?: Ctx, preferred?: Power | null): Power | null =>
  chooseOpposingMarkerOwner(G, side, preferred, ctx);

/**
 * Apply a 32.4 declaration on a *minor* power.  (A unified Italy needs the
 * 32.2 entry/unit placement in `moves.ts#gwDeclareWarOnNonPlayer`.)
 */
export const declareGwWarOnMinor = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  target: string,
  preferredAlly?: Power | null,
): GwNonPlayerDeclaration => {
  const check = checkGwNonPlayerDeclaration(G, power, target);
  if (!check.ok || check.info === undefined || check.info.kind !== "minor") {
    return {ok: false, reason: check.reason ?? "not-non-player"};
  }
  const side = opposingSide(G, power);
  if (side === null) return {ok: false, reason: "not-belligerent"};
  const ally = markerOwner(G, side, ctx, preferredAlly);
  if (ally === null) return {ok: false, reason: "no-alliance-member"};
  const info = check.info;
  const entry: GwNonPlayerBelligerent = {
    power: info.power,
    side,
    ally,
    declaredBy: power,
    turn: G.gw!.turn,
    spaces: [...info.spaces],
  };
  (G.gw!.nonPlayerBelligerents ??= []).push(entry);
  // 32.4's neutral-player option reads the *old* ally/diplomacy markers, so
  // capture it before the opposing alliance's marker overwrites the ally slot.
  const queue = neutralJoinQueue(G, info);
  for (const space of info.spaces) {
    if (G.spaces[space]) G.spaces[space].ally = ally;
  }
  // The declaration is the first act of the power's war status; 30.2's
  // elimination sweep runs after later maneuvers/battles.
  log(G, power, "gwNonPlayerWarDeclared", {
    target: info.power,
    side,
    ally,
    spaces: info.spaces.join(","),
  });
  return {ok: true, entry, joinQueue: queue};
};

/** Record a declaration for a non-player major whose entry was applied elsewhere. */
export const recordGwNonPlayerBelligerent = (
  G: ImperialElegyState,
  power: Power,
  target: string,
  side: GwSide,
  ally: Power | null,
  spaces: SpaceId[],
): GwNonPlayerBelligerent => {
  const entry: GwNonPlayerBelligerent = {
    power: target,
    side,
    ally,
    declaredBy: power,
    turn: G.gw!.turn,
    spaces: [...spaces],
  };
  (G.gw!.nonPlayerBelligerents ??= []).push(entry);
  log(G, power, "gwNonPlayerWarDeclared", {
    target,
    side,
    ally: ally ?? "",
    spaces: spaces.join(","),
  });
  return entry;
};

const ownerOnSide = (G: ImperialElegyState, owner: PowerOrMinor, side: GwSide): boolean => {
  if (isPower(owner)) {
    if (G.powers[owner]?.eliminated) return false;
    return sideOfPower(G, owner) === side;
  }
  if (owner === "IT" || owner === "US") {
    const raw = owner === "IT" ? G.flags.italySide : G.flags.usSide;
    return raw === side;
  }
  const controller = minorController(G, owner);
  if (controller !== null) return !G.powers[controller]?.eliminated && sideOfPower(G, controller) === side;
  const entry = gwNonPlayerBelligerents(G).find((item) => item.power === owner && item.eliminated !== true);
  return entry?.side === side;
};

/** 30.2: every home space is held by the other alliance. */
const allHomesOccupiedByEnemy = (
  G: ImperialElegyState,
  homes: SpaceId[],
  side: GwSide,
): boolean => {
  if (homes.length === 0) return false;
  return homes.every((home) => {
    const owners = occupyingOwners(G, home);
    return owners.length > 0 && owners.every((owner) => !ownerOnSide(G, owner, side));
  });
};

/** The surviving member of `side` that inherits a departing non-player's marker. */
const chooseHeir = (
  G: ImperialElegyState,
  side: GwSide,
  leavingAlly: Power | null,
  ctx?: Ctx,
): Power | null => {
  const survivors = orderedSurvivors(G, side, leavingAlly ?? undefined);
  if (survivors.length === 0) return null;
  if (survivors.length === 1) return survivors[0];
  if (survivors.length === 2 && ctx !== undefined) {
    const rolls = survivors.map((candidate) => ({power: candidate, roll: die(ctx, 6)}));
    const best = Math.max(...rolls.map((entry) => entry.roll));
    const winner = rolls.find((entry) => entry.roll === best);
    if (winner !== undefined) return winner.power;
  }
  return survivors[0];
};

export interface GwNonPlayerElimination {
  power: string;
  heir: Power | null;
}

/**
 * 30.2: "Minor Powers do not surrender during the GW.  However, if all their
 * troops are eliminated and their home space(s) is occupied, they are
 * effectively eliminated from the war."
 *
 * A declared minor is removed from the belligerent ledger and its alliance
 * marker is inherited by a surviving member of its alliance (the same
 * deterministic 30.1 fallback).  A surrendered US/Italy closes its ledger row
 * too; their own surrender bookkeeping is in `gwMajors.ts`.
 */
export const resolveGwNonPlayerEliminations = (
  G: ImperialElegyState,
  ctx?: Ctx,
): GwNonPlayerElimination[] => {
  if (!G.gw?.active) return [];
  const out: GwNonPlayerElimination[] = [];
  for (const entry of gwNonPlayerBelligerents(G)) {
    if (entry.eliminated === true) continue;
    if (entry.power === "US" || entry.power === "IT") {
      const surrendered = entry.power === "US" ? G.gw.usSurrendered === true : G.gw.italySurrendered === true;
      if (!surrendered) continue;
      entry.eliminated = true;
      entry.eliminatedTurn = G.gw.turn;
      out.push({power: entry.power, heir: null});
      log(G, undefined, "gwNonPlayerEliminated", {target: entry.power, reason: "30.2-surrender"});
      continue;
    }
    const units = Object.values(G.units).filter((unit) => unit.owner === entry.power);
    if (units.length > 0) continue;
    if (!allHomesOccupiedByEnemy(G, entry.spaces, entry.side)) continue;
    entry.eliminated = true;
    entry.eliminatedTurn = G.gw.turn;
    const heir = chooseHeir(G, entry.side, entry.ally, ctx);
    for (const space of entry.spaces) {
      if (G.spaces[space]?.ally === entry.ally) G.spaces[space].ally = heir;
    }
    entry.ally = heir;
    out.push({power: entry.power, heir});
    log(G, undefined, "gwNonPlayerEliminated", {
      target: entry.power,
      reason: "30.2-minor",
      heir: heir ?? "",
    });
    if (heir !== null) {
      log(G, heir, "gwNonPlayerAllyInherited", {target: entry.power, from: entry.declaredBy, heir});
    }
  }
  return out;
};

/** Powers that may be asked to join the opposing side (pure helper for tests). */
export const gwNonPlayerJoinCandidates = (
  G: ImperialElegyState,
  target: string,
): Power[] => {
  const info = gwNonPlayerTargetInfo(G, target);
  if (info === null) return [];
  return neutralJoinQueue(G, info);
};
