/**
 * 33.4 A New Way Forward: "AU receives +1 manpower when 4 nationalities have
 * citizenship ... AU gains this manpower during the end phase, this is a one
 * time bonus."
 *
 * The grant is latched by the live end phase (20.5 Set manpower) and the
 * latched value is kept by every later `recomputeTracks`, even if AU loses a
 * matched nationality or its space.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, PendingDecision, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {recomputeTracks} from "./engine/rules";
import {AU_NEW_WAY_FORWARD, auNewWayForwardGranted, grantAuNewWayForward} from "./engine/nationality";
import {beginEndPhase, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
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
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const FOUR = ["Czechs", "Hungarians", "Poles", "Croats"];

/** Run the live end phase to completion, taking the printed first options. */
const runEndPhase = (G: ImperialElegyState, ctx: Ctx): string[] => {
  const seen: string[] = [];
  beginEndPhase(G, ctx);
  let guard = 0;
  while (G.pending !== null) {
    guard += 1;
    if (guard > 500) throw new Error("the end phase did not settle");
    const pending: PendingDecision = G.pending;
    seen.push(`${pending.kind}:${pending.power}`);
    const decisionCtx = {...ctx, playerID: seat(pending.power)};
    const optionId =
      pending.options.find((option) => option.id === "skip")?.id ??
      pending.options.find((option) => option.id === "done")?.id ??
      pending.options[0]?.id ??
      "";
    expect(resolvePending(G, decisionCtx, optionId)).toBeUndefined();
  }
  expect(G.endPhase).toBeUndefined();
  return seen;
};

describe("33.4 A New Way Forward", () => {
  test("the +1 is latched by the end phase and survives losing a nationality", () => {
    const G = fresh();
    recomputeTracks(G);
    const baseline = G.powers.AU.manpower;
    G.phase = "action";

    // Before the end phase nothing has been granted.
    G.powers.AU.citizenship = [...FOUR];
    recomputeTracks(G);
    expect(G.powers.AU.manpower).toBe(baseline);
    expect(auNewWayForwardGranted(G)).toBe(false);

    runEndPhase(G, makeCtx([3]));
    expect(G.persistent[AU_NEW_WAY_FORWARD]).toBe("granted");
    recomputeTracks(G);
    expect(G.powers.AU.manpower).toBeGreaterThanOrEqual(baseline);

    const granted = G.powers.AU.manpower;
    // The one-time bonus stays even when the four matched citizenships drop.
    G.powers.AU.citizenship = ["Germans"];
    recomputeTracks(G);
    expect(G.powers.AU.manpower).toBe(granted);
    expect(grantAuNewWayForward(G)).toBe(false);
  });

  test("negative: three matched nationalities never latch the grant", () => {
    const G = fresh();
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles"];
    expect(grantAuNewWayForward(G)).toBe(false);
    expect(auNewWayForwardGranted(G)).toBe(false);
  });

  test("negative: four citizenships without matching AU spaces do not count", () => {
    const G = fresh();
    // "Germans" is not one of the eight AU nationalities and no German space
    // prints the others under AU control at setup.
    G.powers.AU.citizenship = ["Germans", "Scots", "Welsh", "Irish"];
    expect(grantAuNewWayForward(G)).toBe(false);
  });
});
