/**
 * 20.5 "Set manpower" — the UK British/colonial and OT Turkish/Arab tracks.
 *
 * 20.5: "Players set their manpower based on how many keys they control [7.2].
 * Armies in excess of a player's new manpower limit are eliminated."  7.2:
 * "both UK and OT have two manpower markers because they have two different
 * kinds of manpower."
 *
 * The printed rule does not ask the owner to choose *which track's* excess is
 * removed: every marker is set from its own keys, so each over-limit track is
 * trimmed on its own and the owner only chooses which army *inside that track*
 * is eliminated.  These tests pin that reading and the live decision shape.
 * 33.2.1 puts Indian and Commonwealth armies on the UK's colonial track, so a
 * CW army is never counted against British manpower.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, PendingDecision, Power, Unit} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {recomputeTracks} from "./engine/rules";
import {manpowerExcess} from "./engine/endPhase";
import {beginEndPhase, resolvePending} from "./moves";

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

const armiesOnMap = (G: ImperialElegyState, owner: string): Unit[] =>
  Object.values(G.units).filter(
    (unit) => unit.owner === owner && unit.kind === "army" && unit.space !== null && unit.space !== undefined,
  );

const britishArmies = (G: ImperialElegyState): Unit[] =>
  armiesOnMap(G, "UK").filter((unit) => unit.flags?.indian !== true && unit.flags?.cw !== true);

const colonialArmies = (G: ImperialElegyState): Unit[] =>
  armiesOnMap(G, "UK").filter((unit) => unit.flags?.indian === true || unit.flags?.cw === true);

const clearArmies = (G: ImperialElegyState, owner: string): void => {
  for (const unit of armiesOnMap(G, owner)) removeUnit(G, unit.id);
};

/** Start the live end phase and answer every decision (first option). */
const runEndPhase = (
  G: ImperialElegyState,
  ctx: Ctx,
  observe?: (pending: PendingDecision) => void,
): string[] => {
  const seen: string[] = [];
  beginEndPhase(G, ctx);
  let guard = 0;
  while (G.pending !== null) {
    guard += 1;
    if (guard > 400) throw new Error("the end phase did not settle");
    const pending = G.pending;
    seen.push(`${pending.kind}:${pending.power}`);
    observe?.(pending);
    const playerCtx = {...ctx, playerID: seat(pending.power)};
    const optionId = pending.options[0]?.id ?? "";
    expect(resolvePending(G, playerCtx, optionId)).toBeUndefined();
  }
  return seen;
};

// ---------------------------------------------------------------------------
// The pure planner: one track at a time, no cross-track choice
// ---------------------------------------------------------------------------

describe("20.5 per-track excess (no printed choice of track)", () => {
  test("UK British and colonial excess are separate tracks with disjoint candidates", () => {
    const G = fresh();
    clearArmies(G, "UK");
    G.powers.UK.manpower = 2;
    G.powers.UK.secondaryManpower = 1;
    const british = [0, 1, 2].map(() => placeUnit(G, "UK", "army", "london", 2).id);
    const indian = [0, 1].map(() => placeUnit(G, "UK", "army", "india", 2, {flags: {indian: true}}).id);
    const cw = placeUnit(G, "UK", "army", "canada", 2, {flags: {cw: true}}).id;

    const excess = manpowerExcess(G, "UK");

    const primary = excess.find((track) => track.key === "primary")!;
    const colonial = excess.find((track) => track.key === "indian")!;
    expect(primary.limit).toBe(2);
    expect(primary.count).toBe(3);
    expect([...primary.candidates].sort()).toEqual([...british].sort());
    // 33.2.1: Indian and Commonwealth armies share the colonial track.
    expect(colonial.limit).toBe(1);
    expect(colonial.count).toBe(3);
    expect([...colonial.candidates].sort()).toEqual([...indian, cw].sort());
    // The planner never mixes the two pools into one list.
    for (const candidate of primary.candidates) expect([...indian, cw]).not.toContain(candidate);
    for (const candidate of colonial.candidates) expect(british).not.toContain(candidate);
  });

  test("OT Turkish and Arab excess are separate tracks too", () => {
    const G = fresh();
    clearArmies(G, "OT");
    G.powers.OT.manpower = 1;
    G.powers.OT.secondaryManpower = 0;
    const turkish = [0, 1].map(() => placeUnit(G, "OT", "army", "istanbul", 2).id);
    const arab = placeUnit(G, "OT", "army", "mecca", 2, {flags: {arab: true}}).id;

    const excess = manpowerExcess(G, "OT");

    expect(excess.map((track) => track.key).sort()).toEqual(["arab", "primary"]);
    const primary = excess.find((track) => track.key === "primary")!;
    const arabTrack = excess.find((track) => track.key === "arab")!;
    expect(primary.candidates).toEqual([...turkish].sort());
    expect(arabTrack.candidates).toEqual([arab]);
    expect(primary.limit).toBe(1);
    expect(arabTrack.limit).toBe(0);
  });

  test("a CW army does not count against British manpower", () => {
    const G = fresh();
    clearArmies(G, "UK");
    G.powers.UK.manpower = 1;
    G.powers.UK.secondaryManpower = 1;
    placeUnit(G, "UK", "army", "london", 2);
    placeUnit(G, "UK", "army", "india", 2, {flags: {indian: true}});
    const cw = placeUnit(G, "UK", "army", "canada", 2, {flags: {cw: true}}).id;

    const excess = manpowerExcess(G, "UK");

    // British 1/1 and colonial 2/1: only the colonial track is over, and its
    // forced choice is one of the two colonial armies.
    expect(excess).toHaveLength(1);
    expect(excess[0].key).toBe("indian");
    expect(excess[0].count - excess[0].limit).toBe(1);
    expect(excess[0].candidates).toContain(cw);
  });
});

// ---------------------------------------------------------------------------
// The live end phase opens one decision per over-limit track
// ---------------------------------------------------------------------------

test("20.5 opens one owner decision per over-limit track and never offers a cross-track pick", () => {
  const G = fresh();
  clearArmies(G, "UK");
  recomputeTracks(G);
  const britishLimit = G.powers.UK.manpower;
  const colonialLimit = G.powers.UK.secondaryManpower;

  const britishIds: string[] = [];
  const colonialIds: string[] = [];
  for (let i = 0; i < britishLimit + 1; i += 1) {
    britishIds.push(placeUnit(G, "UK", "army", "london", 2).id);
  }
  for (let i = 0; i < colonialLimit + 1; i += 1) {
    colonialIds.push(placeUnit(G, "UK", "army", "india", 2, {flags: {indian: true}}).id);
  }

  const ukDecisions: string[][] = [];
  runEndPhase(G, makeCtx(), (pending) => {
    if (pending.kind !== "manpowerExcess" || pending.power !== "UK") return;
    ukDecisions.push(pending.options.map((option) => String(option.data?.unit ?? "")));
  });

  expect(ukDecisions.length).toBeGreaterThanOrEqual(2);
  const britishOnly = ukDecisions.filter((units) => units.every((id) => britishIds.includes(id)));
  const colonialOnly = ukDecisions.filter((units) => units.every((id) => colonialIds.includes(id)));
  // One decision belongs to the British track and one to the colonial track.
  expect(britishOnly.length).toBeGreaterThanOrEqual(1);
  expect(colonialOnly.length).toBeGreaterThanOrEqual(1);
  // No decision mixes the two pools: there is no "which track" option.
  expect(britishOnly.length + colonialOnly.length).toBe(ukDecisions.length);

  // The printed limits are enforced one track at a time.
  expect(britishArmies(G).length).toBeLessThanOrEqual(britishLimit);
  expect(colonialArmies(G).length).toBeLessThanOrEqual(colonialLimit);
  // Every eliminated army came from its own over-limit track.
  const removedBritish = britishIds.filter((id) => G.units[id] === undefined);
  const removedColonial = colonialIds.filter((id) => G.units[id] === undefined);
  expect(removedBritish).toHaveLength(1);
  expect(removedColonial).toHaveLength(1);
});
