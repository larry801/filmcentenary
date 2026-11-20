/**
 * 9.1.3: "Response card events all have specific conditions which must be met
 * in order to be played."
 *
 * A44/A89/A109 only print a trigger (France lost a war / French or Russian
 * stability decreased); A67 prints a fixed WTT window with one exception.  The
 * impulse window alone used to be enough, which left those clauses cosmetic.
 * These suites pin the live gate, the state it reads, and the move layer's
 * refusal.
 */
import {INVALID_MOVE} from "boardgame.io/core";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {changeStability} from "./engine/rules";
import {playResponseCard, responseCardEligibility, applyWarEndCharacteristics} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3)},
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

/** Put the power at the start of its own action impulse with the card in hand. */
const atImpulseStart = (G: ImperialElegyState, power: Power, cardId: string): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  for (const p of POWERS) G.powers[p].hand = [];
  G.powers[power].hand = [cardId];
};

describe("A89 / A109 — Russian stability triggers", () => {
  test("both are closed until Russian stability has actually decreased", () => {
    const G = fresh();
    atImpulseStart(G, "RU", "IE-A089");
    G.powers.RU.hand.push("IE-A109");
    expect(responseCardEligibility(G, "RU", "IE-A089")).toMatchObject({ok: false, reason: "russia-trigger"});
    expect(responseCardEligibility(G, "RU", "IE-A109")).toMatchObject({ok: false, reason: "russia-trigger"});
    expect(playResponseCard(G, makeCtx([], seat("RU")), "IE-A089")).toBe(INVALID_MOVE);
    expect(G.powers.RU.hand).toContain("IE-A089");
  });

  test("a live stability loss opens A89 for good and A109 for that turn", () => {
    const G = fresh();
    changeStability(G, "RU", -1, makeCtx());
    expect(G.powers.RU.flags.stabilityDecreased).toBe(true);
    expect(G.powers.RU.flags.stabilityDecreasedTurn).toBe(G.turn);

    atImpulseStart(G, "RU", "IE-A089");
    G.powers.RU.hand.push("IE-A109");
    expect(responseCardEligibility(G, "RU", "IE-A089")).toEqual({ok: true});
    expect(responseCardEligibility(G, "RU", "IE-A109")).toEqual({ok: true});
  });

  test("A109's present-tense trigger spans the turn boundary, then expires; A89 keeps the past loss", () => {
    const G = fresh();
    changeStability(G, "RU", -1, makeCtx());
    G.turn += 1;
    atImpulseStart(G, "RU", "IE-A089");
    G.powers.RU.hand.push("IE-A109");
    // The response window opens at the start of an impulse, which can be the
    // turn after the loss.
    expect(responseCardEligibility(G, "RU", "IE-A089")).toEqual({ok: true});
    expect(responseCardEligibility(G, "RU", "IE-A109")).toEqual({ok: true});
    G.turn += 1;
    expect(responseCardEligibility(G, "RU", "IE-A089")).toEqual({ok: true});
    expect(responseCardEligibility(G, "RU", "IE-A109")).toMatchObject({ok: false, reason: "russia-trigger"});
  });

  test("the move layer accepts the card once the trigger is live", () => {
    const G = fresh();
    changeStability(G, "RU", -1, makeCtx());
    atImpulseStart(G, "RU", "IE-A089");
    expect(playResponseCard(G, makeCtx([], seat("RU")), "IE-A089")).toBeUndefined();
    expect(G.powers.RU.hand).not.toContain("IE-A089");
    expect(G.discard).toContain("IE-A089");
  });
});

describe("A44 — Paris Commune triggers", () => {
  test("closed until France loses stability or a war", () => {
    const G = fresh();
    atImpulseStart(G, "GE", "IE-A044");
    expect(responseCardEligibility(G, "GE", "IE-A044")).toMatchObject({ok: false, reason: "france-trigger"});
    expect(playResponseCard(G, makeCtx([], seat("GE")), "IE-A044")).toBe(INVALID_MOVE);
    expect(G.powers.GE.hand).toContain("IE-A044");
  });

  test("a French stability decrease opens it for the rest of that turn", () => {
    const G = fresh();
    changeStability(G, "FR", -1, makeCtx());
    atImpulseStart(G, "GE", "IE-A044");
    expect(responseCardEligibility(G, "GE", "IE-A044")).toEqual({ok: true});
    G.turn += 1;
    // The next impulse window may fall just after the turn boundary.
    expect(responseCardEligibility(G, "GE", "IE-A044")).toEqual({ok: true});
    G.turn += 1;
    expect(responseCardEligibility(G, "GE", "IE-A044")).toMatchObject({ok: false, reason: "france-trigger"});
  });

  test("a war France lost stamps the victory-step trigger", () => {
    const G = fresh();
    const war = {
      attacker: "FR",
      defender: "GE",
      attackerAllies: [],
      defenderAllies: [],
      attackerMinors: [],
      defenderMinors: [],
      warAim: "conquest",
      objectives: [],
      status: "victory",
      budgets: {},
      initiative: [],
      treaties: [],
      victor: "defender",
      truceTurns: 0,
      passed: [],
      startedTurn: G.turn,
    } as WarState;
    G.war = war;
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.flags.frLostWarTurn).toBe(G.turn);

    atImpulseStart(G, "GE", "IE-A044");
    expect(responseCardEligibility(G, "GE", "IE-A044")).toEqual({ok: true});
  });
});
