/**
 * End-phase residual rules (20.1, 20.4, 20.5, 20.9).
 *
 * Round 1 implemented the twelve-step walk; these tests pin the player-facing
 * residues added in round 2:
 *  - 20.1: the per-player Militarism decision (standing army, reserve army,
 *    fort protection, the level-3 refusal, the no-legal-benefit auto-skip) and
 *    the fact that 20.2 runs after every protection is recorded;
 *  - 20.4: a friendly port that contains enemy units is not a legal return
 *    destination;
 *  - 20.5: the owner eliminates the standing armies over the new manpower
 *    limit, one at a time, including the UK/OT separate manpower tracks;
 *  - 20.9: a tied alliance roll suspends on the deciding player's choice, and
 *    the decline fallback stays deterministic.
 *
 * Every live test goes through `beginEndPhase` + the real `resolvePending` /
 * `declinePending` moves, so the suspension and resume are exercised, not just
 * the pure planners.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, PendingDecision, Power, POWERS, Unit} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {manpowerExcess, navalReturnPlan} from "./engine/endPhase";
import {beginEndPhase, declinePending, endPhaseTurn, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [3], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "end",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const unitsOf = (G: ImperialElegyState, owner: string): Unit[] =>
  Object.values(G.units).filter((unit) => unit.owner === owner);

const armiesOnMap = (G: ImperialElegyState, owner: string): Unit[] =>
  unitsOf(G, owner).filter((unit) => unit.kind === "army" && unit.space !== null && unit.space !== undefined);

const defaultPick = (pending: PendingDecision): string =>
  pending.options.find((candidate) => candidate.id === "skip")?.id ?? pending.options[0]?.id ?? "";

type Pick = (pending: PendingDecision) => string | undefined;

/** Resolve the decisions of an already-started end phase. */
const settle = (G: ImperialElegyState, ctx: Ctx, pick: Pick = () => undefined): string[] => {
  const seen: string[] = [];
  let guard = 0;
  while (G.pending !== null) {
    guard += 1;
    if (guard > 300) throw new Error("the end phase did not settle");
    const pending = G.pending;
    seen.push(`${pending.kind}:${pending.power}`);
    const decisionCtx = {...ctx, playerID: seat(pending.power)};
    const optionId = pick(pending) ?? defaultPick(pending);
    expect(resolvePending(G, decisionCtx, optionId)).toBeUndefined();
  }
  expect(G.endPhase).toBeUndefined();
  return seen;
};

/** Start the live end phase and settle every decision. */
const run = (G: ImperialElegyState, ctx: Ctx, pick: Pick = () => undefined): string[] => {
  beginEndPhase(G, ctx);
  return settle(G, ctx, pick);
};

// ---------------------------------------------------------------------------
// 20.1 — Militarism
// ---------------------------------------------------------------------------

test("20.1 offers a free standing army step under the 12.2 rules", () => {
  const G = fresh();
  // Free one home key so Germany is under its manpower, and take its only
  // reserve box slot away so the reserve option is not legal.
  removeUnit(G, unitsOf(G, "GE").find((unit) => unit.space === "prussia")!.id);
  expect(G.powers.GE.reserves).toHaveLength(1);

  const ctx = makeCtx();
  let options: string[] = [];
  run(G, ctx, (pending) => {
    if (pending.kind === "militarism" && pending.power === "GE") {
      options = pending.options.map((candidate) => candidate.id);
      return "army:prussia";
    }
    return undefined;
  });

  expect(options).toContain("army:prussia");
  expect(options).not.toContain("reserve");
  const placed = armiesOnMap(G, "GE").filter((unit) => unit.space === "prussia");
  expect(placed).toHaveLength(1);
  expect(placed[0].steps).toBe(2);
  expect(placed[0].flags?.indian).toBeUndefined();
  expect(G.log.some((entry) => entry.key === "militarism" && entry.args?.choice === "army")).toBe(true);
});

test("20.1 can take a reserve army step when the holding box has room", () => {
  const G = fresh();
  G.powers.GE.industry = 3; // reserve limit = min(manpower 2, industry 3) = 2
  expect(G.powers.GE.reserves).toHaveLength(1);
  const seen = run(G, makeCtx(), (pending) =>
    pending.kind === "militarism" && pending.power === "GE" ? "reserve" : undefined,
  );
  expect(seen).toContain("militarism:GE");
  expect(G.powers.GE.reserves).toHaveLength(2);
});

test("20.1 protects a level-2 fort through 20.2 and refuses a level-3 fort", () => {
  const G = fresh();
  G.spaces.champagne.fort = {power: "FR", level: 2};
  G.spaces.lombardy.fort = {power: "AU", level: 3};

  let frOptions: string[] = [];
  let auOptions: string[] = [];
  run(G, makeCtx(), (pending) => {
    if (pending.kind === "militarism" && pending.power === "FR") {
      frOptions = pending.options.map((candidate) => candidate.id);
      return "fort:champagne";
    }
    if (pending.kind === "militarism" && pending.power === "AU") {
      auOptions = pending.options.map((candidate) => candidate.id);
    }
    return undefined;
  });

  // The protection is recorded in 20.1, then 20.2 keeps the fort at level 2.
  expect(frOptions).toContain("fort:champagne");
  expect(G.spaces.champagne.fort?.level).toBe(2);
  // The flag is consumed by 20.2 so it can never protect a later phase.
  expect(G.spaces.champagne.fort?.protectedThisPhase).toBeUndefined();
  // A level-3 fort can never be protected; it degrades normally.
  expect(auOptions).not.toContain("fort:lombardy");
  expect(G.spaces.lombardy.fort?.level).toBe(2);
  // Unprotected level-1 forts are still removed.
  expect(G.spaces["st-petersburg"].fort).toBeNull();
});

test("20.1 is not auto-picked and a player with no legal benefit is auto-skipped", () => {
  const G = fresh();
  // Strip every non-Indian fort so Germany (reserve box full, armies at
  // manpower) and the UK (no reserves, one British army pre-GW) have no legal
  // benefit at all.  France still has reserve-box room.
  for (const space of Object.keys(G.spaces)) G.spaces[space].fort = null;

  const ctx = makeCtx();
  beginEndPhase(G, ctx);
  expect(G.pending?.kind).toBe("militarism");
  expect(G.pending?.power).toBe("FR");
  const skips = G.log
    .filter((entry) => entry.key === "militarism" && entry.args?.choice === "skip")
    .map((entry) => entry.power);
  expect(skips).toEqual(["GE", "UK"]);
  // The phase cannot be closed while a decision is still open.
  expect(endPhaseTurn(G, {...ctx, playerID: seat("GE")})).toBe(INVALID_MOVE);
  // Only the deciding seat may answer.
  expect(resolvePending(G, {...ctx, playerID: seat("UK")}, "skip")).toBe(INVALID_MOVE);
  settle(G, ctx);
});

// ---------------------------------------------------------------------------
// 20.5 — Excess standing armies
// ---------------------------------------------------------------------------

test("20.5 asks the owner which standing army to eliminate over the new limit", () => {
  const G = fresh();
  const extra = placeUnit(G, "GE", "army", "westphalia", 2);
  expect(armiesOnMap(G, "GE")).toHaveLength(3);
  const reserveId = G.powers.GE.reserves[0];

  const seen = run(G, makeCtx(), (pending) =>
    pending.kind === "manpowerExcess" && pending.power === "GE" ? `excess:${extra.id}` : undefined,
  );

  expect(seen).toContain("manpowerExcess:GE");
  expect(G.units[extra.id]).toBeUndefined();
  expect(armiesOnMap(G, "GE")).toHaveLength(2);
  // 20.5 eliminates standing armies only; the reserve box is untouched.
  expect(G.units[reserveId]).toBeDefined();
  expect(G.powers.GE.reserves).toContain(reserveId);
  expect(G.log.some((entry) => entry.key === "manpowerExcess")).toBe(true);
});

test("20.5 repeats until every track is within the final manpower limit", () => {
  const G = fresh();
  placeUnit(G, "GE", "army", "westphalia", 2);
  placeUnit(G, "GE", "army", "silesia", 2);
  placeUnit(G, "GE", "army", "pomerania", 2);
  expect(armiesOnMap(G, "GE")).toHaveLength(5);
  expect(G.powers.GE.manpower).toBe(2);

  const seen = run(G, makeCtx());

  expect(seen.filter((entry) => entry === "manpowerExcess:GE")).toHaveLength(3);
  expect(armiesOnMap(G, "GE")).toHaveLength(2);
  expect(manpowerExcess(G, "GE")).toEqual([]);
});

test("20.5 keeps the UK/OT separate manpower tracks apart", () => {
  const G = fresh();
  const arab = unitsOf(G, "OT").find((unit) => unit.flags?.arab === true)!;
  const turkish = unitsOf(G, "OT").find((unit) => unit.kind === "army" && unit.flags?.arab !== true)!;
  const extraArab = placeUnit(G, "OT", "army", "mecca", 2, {flags: {arab: true}});

  let options: string[] = [];
  run(G, makeCtx(), (pending) => {
    if (pending.kind === "manpowerExcess" && pending.power === "OT") {
      options = pending.options.map((candidate) => candidate.id);
      return `excess:${extraArab.id}`;
    }
    return undefined;
  });

  expect(options).toEqual(expect.arrayContaining([`excess:${arab.id}`, `excess:${extraArab.id}`]));
  expect(options).not.toContain(`excess:${turkish.id}`);
  expect(G.units[extraArab.id]).toBeUndefined();
  expect(G.units[turkish.id]).toBeDefined();
  expect(unitsOf(G, "OT").filter((unit) => unit.kind === "army" && unit.flags?.arab === true)).toHaveLength(1);
});

test("a forced 20.5 removal (one candidate) is applied without a decision", () => {
  const G = fresh();
  // The UK's Indian track is over by one; make the British/Indian split the
  // only excess and check the pure planner's forced-removal shape.
  G.powers.UK.secondaryManpower = 0;
  const over = manpowerExcess(G, "UK");
  expect(over).toHaveLength(1);
  expect(over[0].key).toBe("indian");
  expect(over[0].candidates).toHaveLength(1);
  expect(over[0].count - over[0].limit).toBe(1);
});

// ---------------------------------------------------------------------------
// 20.9 — Tied alliance roll
// ---------------------------------------------------------------------------

test("20.9 suspends a tied alliance roll for the player's choice without rerolling", () => {
  const G = fresh();
  G.powers.GE.mpit = {te: 1, ta: 1, neutral: 0};
  // The first six dice are 1 (TE 3 vs TA 3); if the suspended roll were rolled
  // again on resume it would produce 13 vs 13 and loop forever.
  const ctx = makeCtx([1, 1, 1, 1, 1, 1, 6]);
  let tie: PendingDecision | null = null;

  const seen = run(G, ctx, (pending) => {
    if (pending.kind === "allianceTie") {
      tie = pending;
      return "ta";
    }
    return undefined;
  });

  expect(seen).toContain("allianceTie:GE");
  expect(tie).not.toBeNull();
  expect(tie!.power).toBe("GE");
  expect(tie!.options.map((candidate) => candidate.id).sort()).toEqual(["ta", "te"]);
  const roll = tie!.context?.roll as {rolls: {te: number; ta: number; neutral: number}};
  expect(roll.rolls).toEqual({te: 3, ta: 3, neutral: 2});
  expect(G.powers.GE.alliance).toBe("taAligned");
  expect(G.powers.GE.mpit).toEqual({te: 0, ta: 1, neutral: 0});
});

test("20.9's decline fallback is deterministic and never stalls the phase", () => {
  const G = fresh();
  G.powers.GE.mpit = {te: 1, ta: 1, neutral: 0};
  const ctx = makeCtx([1]);
  beginEndPhase(G, ctx);

  let guard = 0;
  while (G.pending !== null && G.pending.kind !== "allianceTie") {
    guard += 1;
    if (guard > 100) throw new Error("no tie decision appeared");
    const pending = G.pending;
    expect(resolvePending(G, {...ctx, playerID: seat(pending.power)}, defaultPick(pending))).toBeUndefined();
  }
  expect(G.pending?.kind).toBe("allianceTie");
  expect(declinePending(G, {...ctx, playerID: seat("GE")})).toBeUndefined();
  settle(G, ctx);
  // Deterministic 8.6 fallback from the neutral box: TE first.
  expect(G.powers.GE.alliance).toBe("teAligned");
});

test("20.9's resolution order still breaks equal influence totals by seat order", () => {
  const G = fresh();
  // FR and RU already fill two Entente slots.  GE and UK have equal totals;
  // GE is earlier in turn order, so it resolves first, takes the third slot and
  // leaves the UK at the capacity cap (8.4) despite the tie.
  G.powers.FR.alliance = "teAligned";
  G.powers.RU.alliance = "teAligned";
  G.powers.FR.mpit = {te: 1, ta: 0, neutral: 0};
  G.powers.RU.mpit = {te: 1, ta: 0, neutral: 0};
  G.powers.GE.mpit = {te: 2, ta: 0, neutral: 0};
  G.powers.UK.mpit = {te: 2, ta: 0, neutral: 0};

  run(G, makeCtx());

  expect(G.powers.GE.alliance).toBe("teAligned");
  expect(G.powers.UK.alliance).toBe("neutral");
});

// ---------------------------------------------------------------------------
// 20.4 — Enemy-occupied friendly ports
// ---------------------------------------------------------------------------

test("20.4 treats a friendly port holding enemy units as illegal", () => {
  const G = fresh();
  for (const space of ["brittany", "picardy", "aquitaine", "algeria"]) G.spaces[space].control = "GE";
  G.spaces["west-africa"].influence = null;
  placeUnit(G, "REBEL:Sepoy", "rebelArmy", "provence", 2);
  const ship = placeUnit(G, "FR", "squadron", "western-mediterranean", 2);

  const entry = navalReturnPlan(G).find((candidate) => candidate.unitId === ship.id)!;
  expect(entry.to).toBeNull();
  expect(entry.eliminate).toBe(false);
  expect(entry.reason).toBe("portOccupied");
});

test("20.4 live: the fleet skips an occupied adjacent port for a legal one", () => {
  const G = fresh();
  placeUnit(G, "REBEL:Sepoy", "rebelArmy", "provence", 2);
  placeUnit(G, "REBEL:Sepoy", "rebelArmy", "algeria", 2);
  const ship = placeUnit(G, "FR", "squadron", "western-mediterranean", 2);

  run(G, makeCtx());

  const destination = G.units[ship.id].space!;
  expect(destination).not.toBe("provence");
  expect(destination).not.toBe("algeria");
  expect(G.spaces[destination].control).toBe("FR");
});
