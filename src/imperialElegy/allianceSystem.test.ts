/** A015/A111 and rules 8.0, 8.4–8.7: printed shifts, dice and crisis timing. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {AllianceBox, ImperialElegyState, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {applyAllianceResolution, resolveAllianceStep, rollAllianceResolution} from "./engine/effects";
import {beginImpulseUpkeep} from "./engine/rules";
import {shiftAlliance} from "./engine/alliance";
import {cpChain, declinePending, endImpulse, playCard, resolvePending} from "./moves";

const scripted = (dice: number[] = []) => {
  let index = 0;
  const Die = jest.fn((_sides: number) => dice[index++] ?? 3);
  const ctx = {
    playerID: "0",
    random: {Die},
    events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
  return {ctx, Die};
};

const fresh = (card = "IE-A015"): ImperialElegyState => {
  const G = setupImperialElegy(scripted().ctx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.wtt = 0;
  G.units = {};
  for (const power of POWERS) {
    G.powers[power].mpit = {te: 0, ta: 0, neutral: 0};
    G.powers[power].alliance = "neutral";
    G.powers[power].hand = [];
  }
  G.powers.GE.hand = [card];
  return G;
};

const play = (G: ImperialElegyState, ctx: Ctx, card: string, choice = "te") => {
  expect(playCard(G, ctx, card, "event")).toBeUndefined();
  expect(G.pending?.context?.special).toBe("shiftingAlliances");
  expect(resolvePending(G, ctx, choice)).toBeUndefined();
};

describe.each(["IE-A015", "IE-A111"])("%s printed alliance event", (card) => {
  test("a neutral player must shift, and cannot choose an alliance already holding three players", () => {
    const G = fresh(card);
    const {ctx} = scripted();
    for (const power of ["UK", "FR", "RU"] as const) G.powers[power].alliance = "teAligned";
    expect(playCard(G, ctx, card, "event")).toBeUndefined();
    expect(G.pending?.options.map((o) => o.id)).toEqual(["ta"]);
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctx, "neutral")).toBe(INVALID_MOVE);
    expect(resolvePending(G, ctx, "te")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.powers.GE.alliance).toBe("taAligned");
  });

  test("a committed chit shifts only one adjacent box", () => {
    const G = fresh(card);
    const {ctx} = scripted();
    G.powers.GE.alliance = "teCommitted";
    play(G, ctx, card, "ta");
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(G.pending).toBeNull();
  });

  test.each(["neutral", "ta"] as const)("starting neutral blocks the automatic %s resolution and resets MPIT to the actual box", (direction) => {
    const G = fresh(card);
    const {ctx, Die} = scripted();
    G.powers.GE.mpit[direction] = 8;
    play(G, ctx, card);
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(G.powers.GE.mpit).toEqual({te: 1, ta: 0, neutral: 0});
    expect(Die).not.toHaveBeenCalled();
    expect(G.cpRemaining).toBe(2);
    expect(G.discard.filter((id) => id === card)).toHaveLength(1);
  });

  test("a double shift toward the opposite alliance cannot pass through neutrality", () => {
    const G = fresh(card);
    const {ctx} = scripted([1, 6]);
    G.powers.GE.mpit = {te: 1, ta: 6, neutral: 0};
    play(G, ctx, card);
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(G.log.find((entry) => entry.key === "allianceResolution")?.args).toMatchObject({steps: 0, blocked: true});
  });

  test("the neutral restriction follows the original player across another player's tie", () => {
    const G = fresh(card);
    const {ctx, Die} = scripted([3, 3]);
    G.powers.UK.mpit = {te: 2, ta: 2, neutral: 0};
    G.powers.GE.mpit = {te: 0, ta: 0, neutral: 1};
    play(G, ctx, card);
    expect(G.pending?.power).toBe("UK");
    expect(G.resolvingCard).toBe(card);
    expect(resolvePending(G, {...ctx, playerID: "1"}, "ta")).toBeUndefined();
    expect(G.powers.UK.alliance).toBe("taAligned");
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(Die).toHaveBeenCalledTimes(2);
    expect(G.pending).toBeNull();
  });

  test("a tied choice toward neutral obeys the restriction without rerolling", () => {
    const G = fresh(card);
    const {ctx, Die} = scripted([4, 4]);
    G.powers.GE.mpit = {te: 1, ta: 0, neutral: 1};
    play(G, ctx, card);
    expect(G.pending?.kind).toBe("allianceTie");
    expect(resolvePending(G, ctx, "neutral")).toBeUndefined();
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(Die).toHaveBeenCalledTimes(2);
  });

  test("a player who began aligned may return to neutral during resolution", () => {
    const G = fresh(card);
    const {ctx} = scripted([1, 6]);
    G.powers.GE.alliance = "teAligned";
    G.powers.GE.mpit = {te: 1, ta: 0, neutral: 6};
    play(G, ctx, card); // aligned -> committed; differential 10 -> neutral
    expect(G.powers.GE.alliance).toBe("neutral");
    expect(G.powers.GE.mpit).toEqual({te: 0, ta: 0, neutral: 1});
  });

  test.each([
    {boxes: ["neutral", "teAligned", "taAligned", "neutral", "neutral", "neutral"], increase: 0},
    {boxes: ["neutral", "teAligned", "teAligned", "neutral", "neutral", "neutral"], increase: 1},
    {boxes: ["neutral", "teAligned", "taAligned", "taAligned", "neutral", "neutral"], increase: 1},
    {boxes: ["neutral", "teAligned", "teAligned", "taAligned", "neutral", "neutral"], increase: 1},
  ])("WTT condition after resolution: $boxes -> +$increase", ({boxes, increase}) => {
    const G = fresh(card);
    const {ctx} = scripted();
    POWERS.forEach((power, index) => { G.powers[power].alliance = boxes[index] as AllianceBox; });
    // Italy is not a player and must not break a 3:3 tie in player counts.
    G.persistent.italyUnified = true;
    G.persistent.italyAlliance = "teCommitted";
    play(G, ctx, card);
    expect(G.wtt).toBe(increase);
  });

  test("WTT uses the final positions, not the three-player alliance before resolution", () => {
    const G = fresh(card);
    const {ctx} = scripted();
    G.powers.UK.alliance = "teAligned";
    G.powers.FR.alliance = "teAligned";
    G.powers.UK.mpit.neutral = 1;
    play(G, ctx, card);
    expect(G.powers.UK.alliance).toBe("neutral");
    expect(G.wtt).toBe(0);
  });

  test("the final cross-seat tie opens the original player's crisis exactly once", () => {
    const G = fresh(card);
    const {ctx, Die} = scripted([3, 3, 6]);
    G.wtt = 4;
    G.powers.FR.alliance = "teAligned";
    G.powers.UK.mpit = {te: 1, ta: 1, neutral: 0};
    play(G, ctx, card);
    expect(G.wtt).toBe(4);
    expect(G.pending?.power).toBe("UK");
    expect(resolvePending(G, {...ctx, playerID: "1"}, "te")).toBeUndefined();
    expect(G.wtt).toBe(5);
    expect(G.pending?.kind).toBe("crisis");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.inciting).toBe(card);
    expect(G.resolvingCard).toBe(card);
    expect(G.discard).not.toContain(card);
    expect(resolvePending(G, ctx, "roll")).toBeUndefined();
    expect(G.wtt).toBe(4);
    expect(G.persistent.conferenceUsed).toBe(true);
    expect(G.gw).toBeNull();
    expect(G.pending).toBeNull();
    expect(G.discard.filter((id) => id === card)).toHaveLength(1);
    expect(Die).toHaveBeenCalledTimes(3);
    expect(G.log.filter((entry) => entry.key === "wttMax")).toHaveLength(1);
    expect(G.log.find((entry) => entry.key === "wttMax")?.args?.incitingCard).toBe(card);
  });
});

test("the lock uses impulse-start allegiance even if the chit changes before the card", () => {
  const G = fresh();
  const {ctx} = scripted([1, 6]);
  beginImpulseUpkeep(G, ctx, "GE");
  shiftAlliance(G, "GE", "te");
  G.powers.GE.mpit = {te: 1, ta: 0, neutral: 6};
  play(G, ctx, "IE-A015");
  // Event shifts aligned -> committed; the two-step resolution stops at aligned.
  expect(G.powers.GE.alliance).toBe("teAligned");
});

test("the next impulse has a fresh allegiance snapshot and end-phase resolution has no lock", () => {
  const G = fresh();
  const {ctx} = scripted([1, 6]);
  G.powers.GE.hand.push("IE-A111");
  G.powers.GE.mpit.neutral = 1;
  play(G, ctx, "IE-A015");
  expect(G.powers.GE.alliance).toBe("teAligned");
  expect(endImpulse(G, ctx)).toBeUndefined();
  G.powers.GE.mpit = {te: 1, ta: 0, neutral: 6};
  play(G, ctx, "IE-A111");
  expect(G.powers.GE.alliance).toBe("neutral");
  G.powers.GE.alliance = "teAligned";
  resolveAllianceStep(G, ctx);
  expect(G.powers.GE.alliance).toBe("neutral");
});

test("CP-chain insertion resolves the same mandatory event and keeps the physical card in the chain", () => {
  const G = fresh();
  const {ctx} = scripted();
  G.powers.GE.mpit.neutral = 1;
  G.powers.UK.hand = ["IE-A019"];
  expect(cpChain(G, ctx, "IE-A015")).toBeUndefined();
  expect(resolvePending(G, ctx, "te")).toBeUndefined();
  expect(G.powers.GE.alliance).toBe("teAligned");
  expect(G.powers.GE.cpChain).toEqual(["IE-A015"]);
  expect(G.discard).not.toContain("IE-A015");
  expect(G.activePower).toBe("UK");
});

test("8.7's printed GE example rolls TA 2+3 and neutral 4+1, with no TE roll", () => {
  const G = fresh();
  G.powers.GE.mpit = {te: 0, ta: 3, neutral: 1};
  const {ctx, Die} = scripted([2, 4, 6]);
  const roll = rollAllianceResolution(G, ctx, "GE");
  expect(roll.rolls).toEqual({te: 0, ta: 5, neutral: 5});
  expect(roll.tied).toEqual(["ta", "neutral"]);
  expect(Die).toHaveBeenCalledTimes(2);
  applyAllianceResolution(G, roll, "ta");
  expect(G.powers.GE.alliance).toBe("taAligned");
});

test.each([{influence: 5, destination: "teAligned"}, {influence: 6, destination: "teCommitted"}])(
  "8.6.1 requires a differential of ten, not nine: influence $influence -> $destination",
  ({influence, destination}) => {
    const G = fresh();
    G.powers.GE.mpit = {te: influence, ta: 1, neutral: 0};
    const {ctx, Die} = scripted([6, 1]);
    const roll = rollAllianceResolution(G, ctx, "GE");
    applyAllianceResolution(G, roll, roll.direction);
    expect(G.powers.GE.alliance).toBe(destination);
    expect(Die).toHaveBeenCalledTimes(2);
  },
);
