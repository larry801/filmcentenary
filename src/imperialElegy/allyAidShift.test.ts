/**
 * Rule 14.2 — the ally-aiding Alliance Track shift.
 *
 * "The defender shifts their alliance chit away from the attacker on the
 * alliance track [8.2].  This includes a player ally that just agreed to aid a
 * minor power."
 *
 * `allyAidShift` owns the direction (the two chits, exactly like an 8.2
 * declaration shift) and the rule 8.4 cap.  It is live through `declareWar` on
 * an allied non-player power (the ally is the defending primary) and through
 * `joinWarAsAlly` when a further player joins the defending side of such a war.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {allyAidShift, allianceMembers} from "./engine/alliance";
import {joinWarAsAlly} from "./engine/limitedWar";
import {chooseAllianceShift, declareWar, resolvePending} from "./moves";

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

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

/**
 * GE declares a live war on Belgium (allied to FR) and FR joins (13.4.1).
 *
 * Both chits start neutral, so 8.2 leaves the direction to FR; the helper
 * answers it with the Triple Entente unless `settle` says otherwise.
 */
const declareOnBelgium = (G: ImperialElegyState, settle: "te" | "ta" | null = "te"): void => {
  G.spaces.belgium.ally = "FR";
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
  expect(G.pending?.kind).toBe("minorAbandon");
  expect(resolvePending(G, makeCtx([], seat("FR")), "join")).toBeUndefined();
  if (settle !== null) expect(chooseAllianceShift(G, makeCtx([], seat("FR")), settle)).toBeUndefined();
};

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

describe("14.2 ally-aiding shift", () => {
  test("the direction is derived from the two chits", () => {
    const G = fresh();
    G.powers.GE.alliance = "taAligned";
    G.powers.FR.alliance = "neutral";
    const shift = allyAidShift(G, "GE", "FR");
    expect(shift).toMatchObject({direction: "te", from: "neutral", to: "teAligned", steps: 1, defaultDirection: false});
    expect(G.powers.FR.alliance).toBe("teAligned");
  });

  test("both neutral falls back deterministically to the Triple Entente", () => {
    const G = fresh();
    const shift = allyAidShift(G, "GE", "FR");
    expect(shift).toMatchObject({direction: "te", from: "neutral", to: "teAligned", defaultDirection: true});
  });

  test("rule 8.4's three-player maximum blocks the aiding shift", () => {
    const G = fresh();
    G.powers.GE.alliance = "taAligned";
    for (const power of ["UK", "AU", "RU"] as const) G.powers[power].alliance = "teAligned";
    const shift = allyAidShift(G, "GE", "FR");
    expect(shift).toMatchObject({direction: "te", from: "neutral", to: "neutral", steps: 0, blocked: true});
    expect(G.powers.FR.alliance).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// Live: the defending ally of a non-player power
// ---------------------------------------------------------------------------

describe("the 14.2 shift on the live minor-war path", () => {
  test("both neutral defers the 14.2 direction to the defending ally (8.2)", () => {
    const G = fresh();
    declareOnBelgium(G, null);
    expect(G.war?.defender).toBe("FR");
    // The chit has not moved yet: 8.2 asks the defending power, and FR is the
    // player ally that just agreed to aid Belgium.
    expect(G.powers.FR.alliance).toBe("neutral");
    expect(G.war?.defenderShift).toMatchObject({from: "neutral", to: null, steps: 0, choice: true});
    expect(lastLog(G, "allianceShiftChoice")?.power).toBe("FR");
    expect(lastLog(G, "allianceShifted")).toBeUndefined();

    // The defender may not pick the attacker's box, but the two free boxes work.
    expect(chooseAllianceShift(G, makeCtx([], seat("GE")), "te")).toBe(INVALID_MOVE);
    expect(chooseAllianceShift(G, makeCtx([], seat("FR")), "te")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(allianceMembers(G, "te")).toContain("FR");
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({
      attacker: "GE", aidMinor: "Belgium", steps: 1, chosen: true,
    });
  });

  test("the defending ally shifts when the declaration is made", () => {
    const G = fresh();
    declareOnBelgium(G);
    expect(G.war?.defender).toBe("FR");
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(allianceMembers(G, "te")).toContain("FR");
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({attacker: "GE", aidMinor: "Belgium", steps: 1, chosen: true});
  });

  test("a further defender joining an allied-minor war also shifts", () => {
    const G = fresh();
    declareOnBelgium(G);
    // FR is now TE-aligned; RU joins the same alliance on the defending side.
    G.powers.RU.alliance = "teAligned";
    G.powers.RU.hand = ["IE-A018"];
    expect(joinWarAsAlly(G, G.war, "FR", "RU", {cardId: "IE-A018"}).applied).toBe(true);
    expect(G.war?.defenderAllies).toContain("RU");
    expect(G.powers.RU.alliance).toBe("teCommitted");
    const shiftLog = lastLog(G, "allianceShifted");
    expect(shiftLog?.power).toBe("RU");
    expect(shiftLog?.args).toMatchObject({attacker: "GE", aidMinor: "Belgium", steps: 1});
  });

  test("a defender joining a player war does not take the 14.2 shift", () => {
    const G = fresh();
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
    // Both chits were neutral at the declaration, so put FR and RU in the same
    // alliance before the ordinary 14.0 call.
    G.powers.FR.alliance = "teAligned";
    G.powers.RU.alliance = "teAligned";
    G.powers.RU.hand = ["IE-A018"];
    expect(joinWarAsAlly(G, G.war, "FR", "RU", {cardId: "IE-A018"}).applied).toBe(true);
    // The 14.2 aid shift would have moved RU to teCommitted; an ordinary 14.0
    // call carries no shift.
    expect(G.powers.RU.alliance).toBe("teAligned");
    expect(G.log.filter((entry) => entry.key === "allianceShifted")).toHaveLength(0);
  });
});
