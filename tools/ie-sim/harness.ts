/**
 * Seeded self-play harness for Imperial Elegy.
 *
 * Runs the *real* boardgame.io reducer (seeded random plugin, phase/turn flow,
 * move validation, playerView) and drives every seat with `botDecision`.
 * Everything except the UI is exercised, so a failure here is an engine or
 * rule-implementation bug.
 */
import {Ctx} from "boardgame.io";
import {CreateGameReducer, InitializeGame, ProcessGameConfig} from "boardgame.io/internal";
import {ImperialElegyGameDef} from "../../src/imperialElegy/game";
import {redactForView} from "../../src/imperialElegy/engine/privacy";
import {botDecision} from "../../src/imperialElegy/engine/bot";
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {ensureStateDefaults} from "../../src/imperialElegy/engine/migrations";
import {SPACES, isNavalBox, neighboursOf, portBoxes} from "../../src/imperialElegy/constant/spaces";
import {planNavalMove} from "../../src/imperialElegy/engine/navalMovement";
import {amphibiousAssaultCheck, navalInterceptCheck} from "../../src/imperialElegy/moves";
import {isArmyKind, landUnitsIn} from "../../src/imperialElegy/engine/rules";
import {hasCounterFor} from "../../src/imperialElegy/engine/counters";
import {placeUnit} from "../../src/imperialElegy/engine/effects";
import {atWar, controlledBy, maneuverDestinationProblem, friendlySpace, hostileOwner, navalUnitsIn, ownsKey, PORT_NAVAL_LIMIT} from "../../src/imperialElegy/engine/rules";
import {performGwManeuver} from "../../src/imperialElegy/engine/greatWarFlow";
import {hasTruce, validateWarAim} from "../../src/imperialElegy/engine/limitedWar";
import {outbreakGreatWar} from "../../src/imperialElegy/engine/greatWar";

export interface SimOptions {
  seed: string | number;
  /**
   * Start the match in the Great War (25.x) instead of 1850.  The pre-war
   * decade loop is the same either way; this only moves the start so the GW
   * half of the engine gets the same coverage.
   */
  greatWar?: boolean;
  /**
   * Aggressive player: when the bot has nothing better to do, advance a unit
   * toward the nearest enemy instead of passing.  That is what drives contact,
   * battles, retreats and occupation through the real engine.
   */
  aggressive?: boolean;
  /**
   * Declare a legal limited war during the action phase.  The Rule 34 bot never
   * does, so without this the entire `wartime` phase is skipped.
   */
  war?: boolean;
  /**
   * Build fleets, sail them and fight naval battles.  The Rule 34 bot only
   * builds the occasional dreadnought, so 19.1–19.9 had no coverage.
   */
  navy?: boolean;
  /**
   * Stage two armies plus an escort next to an enemy port each action phase so
   * the 19.10 amphibious assault actually runs.
   */
  amphibious?: boolean;
  /** Hard cap on dispatched actions. */
  maxSteps?: number;
  /** Randomised pending choices (chaos exploration) instead of first option. */
  chaos?: number;
  /** RNG for the chaos option picker. */
  rng?: () => number;
  /** Called on every dispatched action (for tracing). */
  trace?: (step: number, event: SimEvent) => void;
}

export interface SimEvent {
  step: number;
  phase: string;
  turn: number;
  power: Power | null;
  move: string;
  args: unknown[];
  status: "ok" | "invalid" | "no-such-move" | "threw";
  error?: string;
}

export interface SimIssue {
  kind: "illegal" | "stall" | "invariant" | "exception" | "unfinished";
  step: number;
  turn: number;
  phase: string;
  power: Power | null;
  move?: string;
  args?: unknown[];
  detail: string;
}

export interface SimResult {
  seed: string | number;
  steps: number;
  phase: string;
  turn: number;
  finished: boolean;
  result: ImperialElegyState["result"];
  issues: SimIssue[];
  gw: boolean;
  events: SimEvent[];
}

const cloneCtx = (ctx: Ctx): Ctx => JSON.parse(JSON.stringify(ctx)) as Ctx;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seat the board (or the hotseat driver) would click for right now. */
export function actingSeatFor(G: ImperialElegyState, ctx: Ctx, states: Map<string, ImperialElegyState>): string | null {
  if (G.pending) {
    const owner = G.pending.power;
    return String(POWERS.indexOf(owner));
  }
  if (G.phase === "end" || G.phase === "gwPlanning" || G.phase === "gwWinter") {
    // Sequential per-player turns: pick the first power that has not acted yet.
    const undone = POWERS.find((p) => {
      const own = states.get(String(POWERS.indexOf(p))) ?? G;
      return !own.powers[p].flags.endDone;
    });
    if (G.phase === "end" && undone) return String(POWERS.indexOf(undone));
    return ctx.currentPlayer ?? null;
  }
  if (G.phase === "prep" || G.phase === "diplomacy") {
    return ctx.currentPlayer ?? null;
  }
  return String(POWERS.indexOf(G.activePower));
}

/** Cards that live in a power's `homeCards` list by design. */
const isHomeCard = (G: ImperialElegyState, card: string): boolean =>
  POWERS.some((p) => G.powers[p].homeCards.includes(card));

/** Structural invariants that must hold after every action. */
export function checkInvariants(G: ImperialElegyState): string[] {
  const problems: string[] = [];
  // A home card legitimately appears in both `homeCards` and `hand` when it is
  // selected for the turn; `homeCards` is the permanent pool, not a zone.  Only
  // track real card zones here.
  const seenCards = new Map<string, string>();
  const noteCard = (card: string, where: string) => {
    if (isHomeCard(G, card)) return;
    const prev = seenCards.get(card);
    if (prev !== undefined) problems.push(`card ${card} is in both ${prev} and ${where}`);
    else seenCards.set(card, where);
  };
  G.deck.forEach((c) => noteCard(c, "deck"));
  G.discard.forEach((c) => noteCard(c, "discard"));
  G.removed.forEach((c) => noteCard(c, "removed"));
  for (const p of POWERS) {
    const ps = G.powers[p];
    ps.hand.forEach((c) => noteCard(c, `${p} hand`));
    (ps.cpChain ?? []).forEach((c) => noteCard(c, `${p} cpChain`));
    if (ps.industryCard) noteCard(ps.industryCard, `${p} industryCard`);
    if (ps.stability < 0) problems.push(`${p} stability ${ps.stability} < 0`);
    if (ps.manpower < 0) problems.push(`${p} manpower ${ps.manpower} < 0`);
    if (ps.industry < 0) problems.push(`${p} industry ${ps.industry} < 0`);
  }
  // Unit bookkeeping: a unit lives exactly once, in its space and the units map.
  const counted = new Set<string>();
  for (const [spaceId, space] of Object.entries(G.spaces)) {
    for (const uid of space.units) {
      if (counted.has(uid)) problems.push(`unit ${uid} listed twice (second in ${spaceId})`);
      counted.add(uid);
      const unit = G.units[uid];
      if (!unit) problems.push(`space ${spaceId} references missing unit ${uid}`);
      else if (unit.space !== spaceId && !unit.naval) {
        // Naval boxes: movement bookkeeping may keep space in sync; flag only land.
        problems.push(`unit ${uid} in ${spaceId}.units but unit.space=${String(unit.space)}`);
      }
    }
  }
  for (const [uid, unit] of Object.entries(G.units)) {
    if (unit.space !== null && unit.space !== undefined && !counted.has(uid)) {
      problems.push(`unit ${uid} has space ${String(unit.space)} but is not in that space's units list`);
    }
  }
  if (G.pending) {
    if (!G.pending.options || G.pending.options.length === 0) {
      problems.push(`pending ${G.pending.kind} has no options`);
    }
    if (!POWERS.includes(G.pending.power) && !G.pending.power.startsWith("IT") && !G.pending.power.startsWith("US")) {
      problems.push(`pending ${G.pending.kind} has unknown owner ${String(G.pending.power)}`);
    }
  }
  if (G.cpRemaining < 0) problems.push(`cpRemaining ${G.cpRemaining}`);
  return problems;
}

/**
 * A harness-only move that opens the Great War from inside a real move, so the
 * outbreak runs with the engine's seeded random plugin (an out-of-move call has
 * no `ctx.random`).  Boardgame.io resolves moves from the phase stage, so the
 * move is injected there as well.
 */
const simOutbreak = (G: ImperialElegyState, ctx: Ctx): void => {
  for (const p of POWERS) {
    G.powers[p].alliance = p === "GE" || p === "AU" || p === "OT" ? "taCommitted" : "teCommitted";
  }
  G.wtt = 5;
  outbreakGreatWar(G, ctx, "GE", "sim" as any, undefined);
  G.phase = "gwPlanning";
};

/**
 * Harness-only setup move: put two armies and a squadron in a naval box so the
 * 19.10 amphibious assault has something to launch.  The printed game reaches
 * that state through transport/naval movement; this fast-forwards it so the
 * landing path is exercised rather than skipped.
 */
const simStageAmphibious = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.phase !== "action" || G.pending !== null) return;
  const power = G.activePower;
  const stageKey = `${G.turn}:${power}`;
  if (G.flags.simAmphibStageTurn === stageKey) return;
  G.flags.simAmphibStageTurn = stageKey;
  // Find a friendly home port whose adjacent box touches an enemy port.
  for (const [port, def] of Object.entries(SPACES)) {
    if (def.home !== power || !portBoxes(port).length) continue;
    if (!friendlySpace(G, port, power)) continue;
    for (const box of portBoxes(port)) {
      const enemies = Object.keys(SPACES).filter((id) =>
        portBoxes(id).includes(box) && G.spaces[id]?.control !== null && !friendlySpace(G, id, power));
      if (enemies.length === 0) continue;
      const target = enemies[0];
      // 19.10 needs the armies *and* an escort in the box (12.3 transport).
      const present = landUnitsIn(G, box).filter((unit) => unit.owner === power && isArmyKind(unit.kind)).length;
      for (let i = present; i < 2; i += 1) placeUnit(G, power, "army", box, 2);
      if (navalUnitsIn(G, box).filter((unit) => unit.owner === power).length === 0) {
        placeUnit(G, power, "squadron", box, 2);
      }
      G.flags.simAmphibTarget = target;
      return;
    }
  }
  void ctx;
};

/** Record that this impulse already staged a landing (harness bookkeeping). */
const simMarkAmphibious = (G: ImperialElegyState, _ctx: Ctx, key: string): void => {
  G.flags.simAmphibLastKey = key;
};

const withSimMoves = (def: typeof ImperialElegyGameDef): typeof ImperialElegyGameDef => {
  const phases: Record<string, any> = {};
  for (const [name, phase] of Object.entries(def.phases ?? {})) {
    phases[name] = {
      ...phase,
      turn: {
        ...phase.turn,
        stages: {play: {moves: {...(phase.turn as any)?.stages?.play?.moves, simOutbreak, simStageAmphibious, simMarkAmphibious}}},
      },
    };
  }
  return {...def, moves: {...def.moves, simOutbreak, simStageAmphibious, simMarkAmphibious}, phases: phases as any};
};

/** Opposing alliance of `power`, from the GW boxes. */
const gwEnemiesOf = (G: ImperialElegyState, power: Power): Power[] => {
  if (!G.gw) return [];
  const side = G.gw.te.includes(power) ? "te" : G.gw.ta.includes(power) ? "ta" : null;
  if (side === null) return [];
  const rivals = side === "te" ? G.gw.ta : G.gw.te;
  return rivals.filter((p) => !G.powers[p].eliminated);
};

/**
 * A legal declaration of war for this seat, if any.  The Rule 34 bot never
 * declares war on its own, which left the whole `wartime` phase (initiative,
 * war budgets, maneuver, battles, victory classification, treaties,
 * demobilisation) untested by the sweep.  The declaration is built through the
 * engine's own `validateWarAim`, so a refusal below is a genuine engine
 * refusal and not an invented target.
 */
const aggressiveWarDeclaration = (
  G: ImperialElegyState,
  power: Power,
): {move: string; args: unknown[]} | null => {
  if (G.phase !== "action" || G.war !== null || G.wtt >= 3) return null;
  // Never stack a declaration on an open decision: FR's Napoleon's Legacy and
  // the minor-war aid search both suspend the declaration on a pending choice,
  // so a second declaration in the same impulse is correctly refused.
  if (G.pending !== null) return null;
  // A declaration needs a real budget to spend; `declareWar` charges CP.
  if (G.cpRemaining < 1) return null;
  // A declaration spends CP from the impulse, so it needs the CP banked.  The
  // `actionCpSpentThisImpulse` flag is NOT a gate: the bot sets it whenever it
  // plays a card for CP, which is exactly how the CP got banked in the first
  // place.
  if (G.powers[power].eliminated) return null;
  const cp = 2;
  if (G.cpRemaining < cp) return null;

  for (const defender of POWERS) {
    if (defender === power || G.powers[defender].eliminated) continue;
    // 13.5: a truce blocks a declaration.  Checked here as well as inside
    // `validateWarAim`'s caller so the sweep never names a declaration the
    // engine will refuse (a just-settled war leaves a 1-turn truce).
    if (hasTruce(G, power, defender)) continue;
    // `controlledBy` (not a raw `control` compare) is what `validateWarAim`
    // uses, and it accounts for allied minors; comparing `control` directly
    // picked the attacker's own spaces and produced `same-power` refusals.
    const objectives = Object.keys(SPACES).filter(
      (id) => SPACES[id].type === "key" && controlledBy(G, id, defender),
    );
    for (const objective of objectives) {
      const validation = validateWarAim(G, power, defender, "conquest", [objective]);
      if (!validation.ok) continue;
      return {move: "declareWar", args: [defender, "conquest", [objective], cp]};
    }
  }
  return null;
};

/**
 * One naval action for a seat, built through the engine's own route planner so
 * a refusal here is a real engine refusal.  Covers the three live naval
 * verbs the Rule 34 bot never uses: `constructFleet`, `navalMove` and
 * `navalBattle` (19.0 contact), which together drive 19.1–19.9.
 */
const navalAction = (
  G: ImperialElegyState,
  power: Power,
): {move: string; args: unknown[]} | null => {
  const me = G.powers[power];
  if (me.eliminated) return null;
  // Only a *live* Great War uses the GW budget; a finished war leaves `G.gw`
  // behind with `active` false while the phase can still read `gwManeuver`.
  const gwManeuver = G.phase === "gwManeuver" && G.gw?.active === true;
  // The live budget is the impulse CP in the action phase and the war/GW budget
  // otherwise; `navalMove`/`navalBattle` charge it, so a 0 budget means every
  // naval action would be refused.
  const budget = gwManeuver
    ? me.gwBudget ?? 0
    : G.phase === "wartime" && G.war
      ? G.war.budgets[power] ?? 0
      : G.cpRemaining;
  if (budget < 1) return null;

  // Every naval verb below charges the impulse/budget, and the bot may have
  // spent it on a different action between two calls; re-check before naming a
  // move so a 0-budget impulse cannot produce a refused action.
  if (budget < 1) return null;

  // 1. 19.10 amphibious assault: land up to two armies from a box that already
  // holds them onto an adjacent enemy port.  Probed with the same check the
  // move uses, so a refusal here is a real engine refusal.  Only once per
  // impulse: the staging move keeps refilling the box, and a second landing
  // would spend CP the impulse no longer has.
  const amphibKey = `${G.turn}:${power}:${G.cpRemaining}`;
  if ((G.phase === "action" || G.phase === "wartime") && G.flags.simAmphibLastKey !== amphibKey) {
    for (const box of Object.keys(G.spaces)) {
      if (!isNavalBox(box)) continue;
      const armies = landUnitsIn(G, box).filter((unit) => unit.owner === power && isArmyKind(unit.kind));
      if (armies.length === 0) continue;
      const fleet = navalUnitsIn(G, box).filter((unit) => unit.owner === power);
      if (fleet.length === 0) continue;
      const targets = Object.keys(SPACES).filter((id) => portBoxes(id).includes(box));
      for (const port of targets) {
        const ids = armies.slice(0, 2).map((unit) => unit.id);
        if (amphibiousAssaultCheck(G, power, box, port, ids).ok) {
          return {move: "amphibiousAssault", args: [box, port, ids]};
        }
      }
    }
  }


  // 19.1 only exists while two powers are at war: a peaceful sea move never
  // opens an interception window, so the sweep would never exercise it.
  const hostile = POWERS.some((other) => other !== power && atWar(G, power, other));

  // 2. Attack with a fleet that already has a legal target (19.0 contact).
  // A naval battle needs an *enemy* (at war), so the check is `hostileOwner`:
  // neutral ships in a shared box are not a legal target.
  for (const unit of Object.values(G.units)) {
    if (unit.owner !== power || !unit.naval || !unit.space) continue;
    const from = unit.space;
    for (const to of neighboursOf(from)) {
      if (!G.spaces[to]) continue;
      const plan = planNavalMove(G, power, from, to, {allowEnemyDestination: true});
      if (!plan.ok) continue;
      const contact = navalUnitsIn(G, to).some((other) => hostileOwner(G, power, other.owner));
      if (!contact) continue;
      return {move: "navalBattle", args: [from, to]};
    }
  }

  // 3. Move a fleet toward the nearest enemy fleet, so contact eventually
  // happens.  A move that ends in the enemy's box is still `navalMove` (the
  // contact battle is resolved by the move itself, 19.0).
  const enemyBoxes = new Set<string>();
  for (const [id, space] of Object.entries(G.spaces)) {
    if (!space.units.some((uid) => {
      const other = G.units[uid];
      return other && other.naval && hostileOwner(G, power, other.owner);
    })) continue;
    enemyBoxes.add(id);
  }
  void hostile;
  for (const unit of Object.values(G.units)) {
    if (unit.owner !== power || !unit.naval || !unit.space) continue;
    const from = unit.space;
    const step = enemyBoxes.size > 0 ? nextHopToward(G, from, enemyBoxes) : null;
    // Prefer an EMPTY box: a move straight into enemy ships resolves as a
    // contact battle and closes the 19.1 reaction window before it can open.
    // 19.1 needs an empty destination box next to an enemy-held port: a box
    // with enemy ships resolves as a contact battle instead, which closes the
    // reaction window before any interception can be attempted.
    const interceptable = neighboursOf(from).filter((id) => {
      if (!isNavalBox(id) || navalUnitsIn(G, id).length > 0) return false;
      return Object.keys(SPACES).some((port) =>
        portBoxes(port).includes(id) && G.spaces[port]?.control !== null
        && !friendlySpace(G, port, power));
    });
    const rest = neighboursOf(from).filter((id) => !navalUnitsIn(G, id).length);
    const candidates = [...interceptable, ...(step !== null ? [step] : []), ...rest, ...neighboursOf(from)]
      .filter((id, i, arr) => arr.indexOf(id) === i);
    for (const to of candidates) {
      if (!G.spaces[to]) continue;
      const contact = navalUnitsIn(G, to).some((other) => hostileOwner(G, power, other.owner));
      // 26.x is stricter than 12.3: a GW naval move must end in a naval box or
      // a friendly port.  Ending in a neutral/enemy port is refused by
      // `performGwManeuver` even though the action-phase planner allows it.
      if (gwManeuver && !isNavalBox(to) && !friendlySpace(G, to, power)) continue;
      // 5.5.4: a port holds at most four naval units.  The engine refuses a
      // move that would end overstacked; naming it just produces a rejected
      // action, so skip a full port (a contact battle is still allowed).
      if (!isNavalBox(to) && !contact && navalUnitsIn(G, to).length >= PORT_NAVAL_LIMIT) continue;
      if (budget < 1) return null;
      // 32.5: during the GW rebels and non-rebels cannot coexist, and the flow
      // refuses a naval move into a rebel space.  Ask the same destination gate
      // the flow uses so the sweep never names that move.
      if (gwManeuver && maneuverDestinationProblem(G, power, {kind: "naval", to, unitIds: [unit.id]}) !== null) continue;
      // Let the planner decide: it refuses an empty enemy/neutral port (that
      // needs an amphibious assault) and allows a port holding enemy ships
      // (19.0 contact).  Forcing `allowEnemyDestination` named illegal moves.
      const plan = planNavalMove(G, power, from, to, contact ? {allowEnemyDestination: true} : {});
      if (!plan.ok || plan.cost < 1) continue;
      return {move: "navalMove", args: [[unit.id], to]};
    }
  }

  // 4. 19.1 interception.  The engine opens a `navalInterception` pending
  // decision after a naval move and the sweep answers it with the first
  // `intercept:<port>` option, so that path is already covered; this
  // standalone move is only reachable from the board's explicit button, and a
  // random pending answer may decline it, so it is offered here too.
  for (const port of Object.keys(G.spaces)) {
    if (isNavalBox(port) || !portBoxes(port).length) continue;
    if (!friendlySpace(G, port, power)) continue;
    for (const box of portBoxes(port)) {
      if (navalInterceptCheck(G, power, port, box).ok) {
        return {move: "navalIntercept", args: [port, box]};
      }
    }
  }

  // 5. Build a squadron in a home port with room and a free counter.
  if (G.phase === "action" && budget >= 2) {
    for (const [id, def] of Object.entries(SPACES)) {
      if (def.home !== power) continue;
      if (!portBoxes(id).length) continue;
      if (!ownsKey(G, id, power)) continue;
      if (navalUnitsIn(G, id).length >= PORT_NAVAL_LIMIT) continue;
      if (!hasCounterFor(G, power, "squadron")) continue;
      return {move: "constructFleet", args: [id, "squadron"]};
    }
  }
  return null;
};

/**
 * One aggressive GW maneuver for a seat: deploy/refit/march into contact.
 * Deliberately engine-shaped (it only reads state and names a real move), so
 * a refusal here is a genuine engine refusal rather than a bot heuristic.
 */
const aggressiveGwMove = (
  G: ImperialElegyState,
  power: Power,
  phase: "gwPlanning" | "gwManeuver",
): {move: string; args: unknown[]} | null => {
  if (!G.gw) return null;
  const me = G.powers[power];
  if (me.eliminated) return null;
  const enemies = gwEnemiesOf(G, power);
  if (enemies.length === 0) return null;
  // Both GW steps spend the same war budget.
  if ((me.gwBudget ?? 0) < 1) return null;

  // 26.x planning: draft onto a home key so there is something to march with.
  if (phase === "gwPlanning") {
    if (me.manpower < 1) return null;
    const home = Object.keys(G.spaces).find((id) => G.spaces[id].control === power
      && G.spaces[id].units.length === 0
      && G.spaces[id].trench);
    if (home === undefined) return null;
    return {move: "gwDraft", args: [home]};
  }

  // Maneuver: attack when already adjacent, otherwise march toward contact.
  const enemySpaces = new Set<string>();
  for (const [id, space] of Object.entries(G.spaces)) {
    if (space.units.some((uid) => {
      const unit = G.units[uid];
      if (!unit || unit.naval) return false;
      return hostileOwner(G, power, unit.owner);
    })) enemySpaces.add(id);
  }
  // 26.x: a land battle is declared from an adjacent friendly space; marching
  // *into* an enemy-held space is illegal (the destination must be friendly).
  for (const [id, space] of Object.entries(G.spaces)) {
    // A naval box holds ships, never a land-battle origin (26.x); naming one
    // makes `performGwManeuver` refuse with "Land battles need land spaces".
    if (isNavalBox(id)) continue;
    for (const uid of space.units) {
      const unit = G.units[uid];
      if (!unit || unit.naval || unit.owner !== power) continue;
      for (const to of neighboursOf(id)) {
        if (isNavalBox(to)) continue;
        if (enemySpaces.has(to)) return {move: "landBattle", args: [id, to]};
      }
    }
  }
  // Otherwise march one hop toward the nearest enemy, but only into a space the
  // engine will accept: a friendly destination with no hostile army in it.
  for (const [id, space] of Object.entries(G.spaces)) {
    for (const uid of space.units) {
      const unit = G.units[uid];
      if (!unit || unit.naval || unit.owner !== power) continue;
      if (isNavalBox(id) || !friendlySpace(G, id, power)) continue;
      const step = nextHopToward(G, id, enemySpaces);
      if (step === null || enemySpaces.has(step)) continue;
      const target = G.spaces[step];
      if (!target || isNavalBox(step) || !friendlySpace(G, step, power)) continue;
      if (target.units.some((other) => {
        const candidate = G.units[other];
        return candidate && !candidate.naval && hostileOwner(G, power, candidate.owner);
      })) continue;
      return {move: "gwMarch", args: [unit.id, step]};
    }
  }
  // Refit a reduced unit rather than wasting the impulse.
  const reduced = Object.values(G.units).find(
    (unit) => unit.owner === power && !unit.naval && unit.steps < 2,
  );
  if (reduced) return {move: "gwRefit", args: [reduced.id]};
  return null;
};

/** One BFS step from `from` toward any space in `targets`. */
const nextHopToward = (G: ImperialElegyState, from: string, targets: Set<string>): string | null => {
  if (targets.has(from)) return null;
  const prev = new Map<string, string>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (!G.spaces[next] || seen.has(next)) continue;
      seen.add(next);
      prev.set(next, current);
      if (targets.has(next)) {
        // Walk back to the first hop off `from`.
        let hop = next;
        while (prev.get(hop) !== undefined && prev.get(hop) !== from) hop = prev.get(hop)!;
        return hop;
      }
      queue.push(next);
    }
  }
  return null;
};

/**
 * Probe a GW maneuver on a deep clone with the real flow, so the aggressive
 * driver only ever names a move the engine accepts (a refused move would look
 * like an engine bug but is really a bad heuristic).
 */
const probeGwManeuver = (
  G: ImperialElegyState,
  power: Power,
  move: string,
  args: unknown[],
): boolean => {
  const clone = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
  const ctx = {
    playerID: String(POWERS.indexOf(power)),
    random: {Die: () => 3, Number: () => 0, Shuffle: (a: unknown[]) => a},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    phase: clone.phase,
  } as unknown as Ctx;
  let request: Parameters<typeof performGwManeuver>[2];
  if (move === "gwMarch") request = {kind: "march", power, unitId: String(args[0]), to: String(args[1])};
  else if (move === "gwRail") request = {kind: "rail", power, unitId: String(args[0]), to: String(args[1])};
  else if (move === "gwRefit") request = {kind: "refit", power, unitId: String(args[0])};
  else if (move === "gwDraft") request = {kind: "draft", power, space: String(args[0])};
  else if (move === "landBattle") request = {kind: "landBattle", power, from: String(args[0]), to: String(args[1])};
  else return false;
  try {
    return performGwManeuver(clone, ctx, request).ok;
  } catch {
    return false;
  }
};

export function runSeededGame(opts: SimOptions): SimResult {
  const needsSimMoves = Boolean(opts.greatWar || opts.amphibious);
  const def = needsSimMoves ? withSimMoves(ImperialElegyGameDef) : ImperialElegyGameDef;
  const game = ProcessGameConfig({...def, seed: opts.seed} as any);
  const reducer = CreateGameReducer({game, isClient: false});
  const rng = opts.rng ?? mulberry32(0x51ed);
  const maxSteps = opts.maxSteps ?? 20000;

  // One authoritative server state.  Per-seat views are derived with the same
  // `playerView` the online server uses, mirroring the hotseat board.
  let state: any = InitializeGame({game, numPlayers: 6});
  if (opts.greatWar) {
    state = reducer(state, {type: "MAKE_MOVE", payload: {type: "simOutbreak", args: [], playerID: state.ctx.currentPlayer}});
    if (!(state.G as ImperialElegyState).gw?.active) {
      throw new Error("harness: simOutbreak did not start the Great War");
    }
  }
  const views = new Map<string, ImperialElegyState>();

  const viewFor = (seat: string | null): ImperialElegyState => {
    const cached = seat === null ? undefined : views.get(seat);
    if (cached !== undefined) return cached;
    const G = redactForView(JSON.parse(JSON.stringify(state.G)) as ImperialElegyState, seat, state.ctx) as ImperialElegyState;
    ensureStateDefaults(G);
    if (seat !== null) views.set(seat, G);
    return G;
  };

  const events: SimEvent[] = [];
  const issues: SimIssue[] = [];
  let steps = 0;
  /** Repeated identical rejected decision detector (mirrors the board's escape). */
  let repeat = {key: "", count: 0};
  /** (power|target|objective) declarations the engine refused — never retried. */
  let warRefused = false;
  /** True when this iteration already staged amphibious units (bounds a retry). */
  let stagedThisStep = false;
  let navalOverrideBlocked = false;
  /** (unitId|dest) naval moves the engine refused — never proposed again. */
  const refusedNaval = new Set<string>();

  for (; steps < maxSteps; steps += 1) {
    const G = state.G as ImperialElegyState;
    if (G.result) break;
    if (state.ctx.gameover !== undefined) break;

    let seat = actingSeatFor(G, state.ctx, views);
    if (seat === null) {
      issues.push({kind: "stall", step: steps, turn: G.turn, phase: G.phase, power: null, detail: "no acting seat"});
      break;
    }
    // In sequential phases the bot must be asked for the seat that still owes
    // an action; the pending owner wins.
    const view = viewFor(seat);
    const power = POWERS[Number(seat)] ?? (G.pending?.power as Power) ?? null;

    // Amphibious mode: fast-forward the transport step so 19.10 has units.
    if (opts.amphibious && !G.pending && G.phase === "action" && power === G.activePower
      && G.flags.simAmphibStageTurn !== `${G.turn}:${G.activePower}`) {
      const staged = reducer(state, {type: "MAKE_MOVE", payload: {type: "simStageAmphibious", args: [], playerID: seat}});
      if (!staged.transients?.error) {
        state = staged;
        views.clear();
      }
      // Restart the iteration with the staged state: `G`/`seat` above were read
      // before the staging move, and building a decision from them would name
      // units that no longer exist.  `stagedThisStep` bounds the restart so a
      // rejected staging move cannot spin.
      if (!stagedThisStep) {
        stagedThisStep = true;
        // Re-enter the loop *without* consuming a step: `for` increments after
        // the body, so compensate once.
        steps -= 1;
        continue;
      }
    }
    stagedThisStep = false;
    const decision = (() => {
      try {
        if (G.pending) {
          const pendingView = view.pending ?? G.pending;
          if (opts.chaos && opts.chaos > 0 && rng() < opts.chaos && pendingView.options.length > 1) {
            const pick = pendingView.options[Math.floor(rng() * pendingView.options.length)];
            return {move: "resolvePending", args: [pick.id]};
          }
          if (!pendingView.options || pendingView.options.length === 0) return {move: "declinePending", args: []};
          return {move: "resolvePending", args: [pendingView.options[0].id]};
        }
        const botMove = botDecision(view, state.ctx, power as Power);
        // In wartime the Rule 34 bot only ever passes; a naval sortie is what
        // opens the 19.1 interception window, so prefer it when available.
        if (opts.navy && state.ctx.phase === "wartime" && botMove.move === "passWarMove") {
          const naval = navalAction(view, power as Power);
          if (naval !== null && (naval.move === "navalMove" || naval.move === "navalBattle" || naval.move === "amphibiousAssault")) {
            return naval;
          }
        }
        return botMove;
      } catch (err) {
        issues.push({
          kind: "exception", step: steps, turn: G.turn, phase: G.phase, power,
          detail: `botDecision threw: ${(err as Error)?.stack ?? String(err)}`,
        });
        return {move: "__none__", args: []};
      }
    })();
    // The staging move above may have replaced `state`, so `G` is stale: any
    // later read of units/CP must come from the current state or the harness
    // names a unit id that no longer exists (and the engine rightly refuses).
    const liveG = state.G as ImperialElegyState;
    // Aggressive mode: declare a legal war when the action phase would
    // otherwise just bank CP, so the `wartime` phase actually runs.  The
    // declaration belongs to the *active* power: in the action phase only that
    // seat may act, and `power` can differ (a stale per-seat view).
    // A refused declaration is not retried: `warRetry` remembers the exact
    // (power, target, objective) that the engine refused so the sweep cannot
    // spin on it the way the real hotseat bot would have.
    if ((opts.war || opts.navy) && !liveG.pending && liveG.phase === "action"
      && power === liveG.activePower && !warRefused
      && (decision.move === "playCard" || decision.move === "pass" || decision.move === "endImpulse" || decision.move === "placeMpit" || decision.move === "buildFort")) {
      const declaration = aggressiveWarDeclaration(liveG, liveG.activePower);
      if (declaration !== null) {
        decision.move = declaration.move;
        decision.args = declaration.args;
      }
    }
    // Navy mode: replace a passive naval/CP action with a real naval one.
    if (opts.navy && !liveG.pending && (liveG.phase === "action" || liveG.phase === "gwManeuver" || liveG.phase === "wartime")
      && power === liveG.activePower
      && (decision.move === "pass" || decision.move === "endImpulse" || decision.move === "placeMpit"
        || decision.move === "buildFort" || decision.move === "gwPass" || decision.move === "playCard")) {
      const naval = navalAction(liveG, liveG.activePower);
      if (naval !== null && naval.move === "navalMove") {
        const [ids, dest] = naval.args as [string[], string];
        if (refusedNaval.has(`${ids[0]}|${dest}`)) {
          // Skip a move this sweep already saw refused (a fleet stranded in a
          // port that stopped being friendly); otherwise it re-sends forever.
          decision.move = "endImpulse";
          decision.args = [];
          navalOverrideBlocked = true;
        }
      }
      // Re-check affordability against the live impulse: the CP may have been
      // spent between the budget snapshot inside `navalAction` and here.
      const liveBudget = liveG.phase === "gwManeuver" && liveG.gw?.active === true
        ? liveG.powers[liveG.activePower].gwBudget ?? 0
        : liveG.phase === "wartime" && liveG.war
          ? liveG.war.budgets[liveG.activePower] ?? 0
          : liveG.cpRemaining;
      const affordable = naval !== null
        && (naval.move === "navalIntercept" || liveBudget >= 1);
      if (naval !== null && affordable && !navalOverrideBlocked) {
        decision.move = naval.move;
        decision.args = naval.args;
      }
      navalOverrideBlocked = false;
    }
    // Aggressive mode: override a passive decision with a real maneuver so the
    // contact/battle/retreat paths are exercised through the engine.  The move
    // is probed with the real flow first, so a refusal reported below is always
    // an engine refusal rather than a heuristic mistake.
    if (opts.aggressive && !G.pending && (G.phase === "gwManeuver" || G.phase === "gwPlanning")) {
      const attacking = aggressiveGwMove(view, power as Power, G.phase as "gwPlanning" | "gwManeuver");
      const probed = attacking !== null && probeGwManeuver(G, power as Power, attacking.move, attacking.args);
      if (
        attacking !== null &&
        probed &&
        (decision.move === "gwPass" || decision.move === "endGwPlanningMove")
      ) {
        decision.move = attacking.move;
        decision.args = attacking.args;
      }
    }

    const before = state.G as ImperialElegyState;
    const beforePhase = before.phase;
    const beforeStepSignature = `${before.phase}|${before.turn}|${before.cpRemaining}|${before.log.length}|${before.pending?.id ?? "-"}`;
    const action = {type: "MAKE_MOVE", payload: {type: decision.move, args: decision.args ?? [], playerID: seat}};
    let next: any;
    try {
      next = reducer(state, action);
    } catch (err) {
      issues.push({
        kind: "exception", step: steps, turn: before.turn, phase: before.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: String((err as Error)?.stack ?? err),
      });
      break;
    }
    const transient = next.transients;
    const changed = next.G !== before || next.ctx !== state.ctx;
    const event: SimEvent = {
      step: steps, phase: beforePhase, turn: before.turn, power,
      move: decision.move, args: (decision.args ?? []) as unknown[],
      status: "ok",
    };
    if (transient?.error) {
      const err = transient.error;
      event.status = err.type === "InactivePlayer" ? "invalid" : "invalid";
      event.error = `${err.type}: ${JSON.stringify(err.payload ?? null)}`;
      // Ask the flow itself why a GW maneuver was refused; the reducer only
      // says "invalid_move", which cannot distinguish a real engine refusal
      // from a bad heuristic in this harness.
      if (decision.move === "declareWar") warRefused = true;
      if (decision.move === "navalMove") {
        const [ids, dest] = (decision.args ?? []) as [string[], string];
        if (ids?.[0]) refusedNaval.add(`${ids[0]}|${dest}`);
      }
      let reason = "";
      if (err.type === "action/invalid_move" && decision.move === "declareWar") {
        const args = decision.args ?? [];
        reason = ` [declareWar power=${String(power)} active=${before.activePower} war=${before.war ? "yes" : "no"} wtt=${before.wtt} cp=${before.cpRemaining} args=${JSON.stringify(args)}]`;
      }
      if (err.type === "action/invalid_move" && decision.move === "navalMove" && power !== null) {
        const [ids, dest] = (decision.args ?? []) as [string[], string];
        const unit = before.units[ids?.[0]];
        reason = ` [navalMove active=${String(before.activePower)} cp=${before.cpRemaining}`
          + ` from=${String(unit?.space)} to=${String(dest)}`
          + ` destNaval=${navalUnitsIn(before, String(dest)).length}`
          + ` destControl=${String(before.spaces[String(dest)]?.control)}]`;
      }
      if (err.type === "action/invalid_move" && decision.move === "navalMove" && power !== null
        && before.phase === "gwManeuver" && before.gw?.active === true) {
        const args = decision.args ?? [];
        const clone = JSON.parse(JSON.stringify(before)) as ImperialElegyState;
        const ctxProbe = {
          playerID: String(POWERS.indexOf(power)),
          random: {Die: () => 3, Number: () => 0, Shuffle: (a: unknown[]) => a},
          events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
          phase: clone.phase,
        } as unknown as Ctx;
        const res = performGwManeuver(clone, ctxProbe, {kind: "naval", power, unitIds: args[0] as string[], to: String(args[1])});
        reason += ` [gwNaval ${res.ok ? "probe accepted" : `${res.error}: ${res.message ?? ""}`}]`;
      }
      if (err.type === "action/invalid_move" && before.phase === "gwManeuver" && power !== null) {
        const probeArgs = decision.args ?? [];
        const request =
          decision.move === "landBattle" ? {kind: "landBattle" as const, power, from: String(probeArgs[0]), to: String(probeArgs[1])} :
          decision.move === "gwMarch" ? {kind: "march" as const, power, unitId: String(probeArgs[0]), to: String(probeArgs[1])} :
          decision.move === "gwRail" ? {kind: "rail" as const, power, unitId: String(probeArgs[0]), to: String(probeArgs[1])} :
          decision.move === "gwRefit" ? {kind: "refit" as const, power, unitId: String(probeArgs[0])} :
          decision.move === "gwDraft" ? {kind: "draft" as const, power, space: String(probeArgs[0])} :
          null;
        if (request !== null) {
          try {
            const res = performGwManeuver(JSON.parse(JSON.stringify(before)), state.ctx, request);
            reason = res.ok ? " (probe accepted — sees a stale/different state)" : ` ${res.error}: ${res.message ?? ""}`;
          } catch (probeError) {
            reason = ` probe threw ${String(probeError)}`;
          }
        }
      }
      issues.push({
        kind: err.type === "InactivePlayer" ? "illegal" : "illegal",
        step: steps, turn: before.turn, phase: before.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: `${err.type} ${JSON.stringify(err.payload ?? null)}${reason}`,
      });
    } else if (!changed) {
      issues.push({
        kind: "illegal", step: steps, turn: before.turn, phase: before.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: "reducer returned an unchanged state (move rejected)",
      });
      event.status = "invalid";
    }
    events.push(event);
    opts.trace?.(steps, event);
    state = next;
    if (opts.navy && decision.move === "amphibiousAssault" && event.status === "ok") {
      // Mark this impulse as landed so the staging refill cannot produce a
      // second attack the impulse can no longer pay for.
      const marked = reducer(state, {type: "MAKE_MOVE", payload: {type: "simMarkAmphibious", args: [`${(state.G as ImperialElegyState).turn}:${String(power)}:${(state.G as ImperialElegyState).cpRemaining}`], playerID: seat}});
      if (!marked.transients?.error) state = marked;
      views.clear();
    }
    views.clear();
    const after = state.G as ImperialElegyState;
    const problems = checkInvariants(after);
    if (problems.length > 0) {
      issues.push({
        kind: "invariant", step: steps, turn: after.turn, phase: after.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: problems.slice(0, 8).join("; "),
      });
    }
    // A rejected move leaves the state untouched, so an identical decision on
    // an identical state is the board's "bot is stuck" signal.  Report it once
    // and escape with a legal move so the rest of the game can be explored
    // (the hotseat board does the same).
    if (event.status === "invalid" || !changed) {
      const decisionKey = `${decision.move}|${JSON.stringify(decision.args ?? [])}|${beforeStepSignature}`;
      repeat = repeat.key === decisionKey ? {key: decisionKey, count: repeat.count + 1} : {key: decisionKey, count: 1};
      if (repeat.count >= 3) {
        issues.push({
          kind: "stall", step: steps, turn: after.turn, phase: after.phase, power,
          move: decision.move, args: decision.args ?? [],
          detail: "bot repeated a rejected decision three times (deadlock)",
        });
        const escape: Record<string, {move: string; args: unknown[]}> = {
          action: {move: "endImpulse", args: []},
          wartime: {move: "passWarMove", args: []},
          prep: {move: "finishPrep", args: []},
          diplomacy: {move: "endDiplomacy", args: []},
          end: {move: "endPhaseTurn", args: []},
          gwPlanning: {move: "endGwPlanningMove", args: []},
          gwManeuver: {move: "gwPass", args: []},
          gwWinter: {move: "gwResolveWinter", args: []},
        };
        const fallback = escape[after.phase];
        if (fallback) {
          const escaped = reducer(state, {type: "MAKE_MOVE", payload: {type: fallback.move, args: fallback.args, playerID: seat}});
          views.clear();
          if (escaped.transients?.error) {
            issues.push({
              kind: "exception", step: steps, turn: after.turn, phase: after.phase, power,
              move: fallback.move, args: fallback.args,
              detail: `escape move also rejected: ${escaped.transients.error.type}`,
            });
            break;
          }
          state = escaped;
          repeat = {key: "", count: 0};
          steps += 1;
          if (steps >= maxSteps) break;
          continue;
        }
        break;
      }
    } else {
      repeat = {key: "", count: 0};
    }

    // Keep the loop bounded but let the game finish naturally.
    if (steps > 0 && steps % 500 === 0) {
      // Cheap progress guard: a game that never leaves turn 1 is stalled.
      if (after.turn === 1 && after.log.length < 10) {
        issues.push({kind: "stall", step: steps, turn: after.turn, phase: after.phase, power, detail: "no progress in 500 steps"});
        break;
      }
    }
  }

  const finalG = state.G as ImperialElegyState;
  return {
    seed: opts.seed,
    steps,
    phase: finalG.phase,
    turn: finalG.turn,
    finished: Boolean(finalG.result) || state.ctx.gameover !== undefined,
    result: finalG.result ?? null,
    issues,
    gw: Boolean(finalG.gw?.outbreakDone),
    events,
  };
}

export const ALL_POWER_SEATS = ["0", "1", "2", "3", "4", "5"];
export {SPACES, cloneCtx};
