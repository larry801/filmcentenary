/**
 * 33.3 FR Napoleon's Legacy — reveal coverage.
 *
 * The printed goal may be revealed when France launches a war of conquest; while
 * revealed, the conquest declaration's stability loss is reduced by 2 (the WTT
 * still rises by 1).  The reveal is offered as a live pending choice inside the
 * real `declareWar` move.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {declareWar, resolvePending} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const startAction = (G: ImperialElegyState, power: Power, cp = 4): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

/** A legal FR war of conquest against AU over the single key Bohemia. */
const declareConquest = (G: ImperialElegyState): string | void => {
  G.spaces.bohemia.control = "AU";
  return declareWar(G, makeCtx(seat("FR")), "AU", "conquest", ["bohemia"], 2);
};

describe("33.3 Napoleon's Legacy reveal", () => {
  test("launching a war of conquest offers the reveal before the war is created", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = ["NG-24"];
    expect(declareConquest(G)).toBeUndefined();

    expect(G.pending?.kind).toBe("napoleonsLegacy");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending!.options.map((o) => o.id)).toEqual(["reveal", "decline"]);
    expect(G.war).toBeNull();
    expect(G.powers.FR.stability).toBe(3);
    expect(G.wtt).toBe(0);
    // CP is already committed: the choice only decides the reveal.
    expect(G.cpRemaining).toBe(2);
  });

  test("revealing publishes NG-24 and turns the conquest loss into 0 (WTT still +1)", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = ["NG-24"];
    declareConquest(G);

    const ctx = makeCtx(seat("FR"));
    expect(resolvePending(G, {...ctx, playerID: seat("AU")}, "reveal")).toBe(INVALID_MOVE);
    expect(resolvePending(G, ctx, "reveal")).toBeUndefined();

    expect(G.revealedGoals).toContain("NG-24");
    expect(G.war?.warAim).toBe("conquest");
    expect(G.war?.attacker).toBe("FR");
    expect(G.phase).toBe("wartime");
    expect(G.wtt).toBe(1);
    expect(G.powers.FR.stability).toBe(3);
    expect(G.log.some((entry) => entry.key === "napoleonsLegacyRevealed")).toBe(true);
  });

  test("declining keeps the goal secret and pays the full stability loss", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = ["NG-24"];
    declareConquest(G);

    const ctx = makeCtx(seat("FR"));
    expect(resolvePending(G, ctx, "decline")).toBeUndefined();

    expect(G.revealedGoals ?? []).not.toContain("NG-24");
    expect(G.war?.warAim).toBe("conquest");
    expect(G.wtt).toBe(1);
    expect(G.powers.FR.stability).toBe(2);
    expect(G.log.some((entry) => entry.key === "napoleonsLegacyRevealed")).toBe(false);
  });

  test("an already-revealed goal applies the discount without a new choice", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = ["NG-24"];
    G.revealedGoals = ["NG-24"];
    expect(declareConquest(G)).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war?.warAim).toBe("conquest");
    expect(G.wtt).toBe(1);
    expect(G.powers.FR.stability).toBe(3);
  });

  test("without the NG there is no reveal choice and the full loss applies", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = [];
    expect(declareConquest(G)).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war?.warAim).toBe("conquest");
    expect(G.powers.FR.stability).toBe(2);
  });

  test("a non-conquest aim never offers the reveal", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = ["NG-24"];
    G.spaces.paris.control = "GE";
    expect(declareWar(G, makeCtx(seat("FR")), "GE", "liberation", ["paris"], 2)).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war?.warAim).toBe("liberation");
    expect(G.powers.FR.stability).toBe(3);
    expect(G.revealedGoals ?? []).not.toContain("NG-24");
  });

  test("another power holding the card in a hand-built state gets no reveal choice", () => {
    const G = fresh();
    startAction(G, "GE");
    G.powers.FR.goals = ["NG-24"];
    G.spaces.bohemia.control = "AU";
    expect(declareWar(G, makeCtx(seat("GE")), "AU", "conquest", ["bohemia"], 2)).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war?.attacker).toBe("GE");
  });

  test("the reveal is refused when the declaration is no longer valid", () => {
    const G = fresh();
    startAction(G, "FR");
    G.powers.FR.goals = ["NG-24"];
    declareConquest(G);
    // The board cannot normally change while the decision blocks everything,
    // but a hand-built/tainted state must not create an illegal war.
    G.spaces.bohemia.control = "FR";
    const ctx = makeCtx(seat("FR"));
    expect(resolvePending(G, ctx, "reveal")).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
    expect(G.pending?.kind).toBe("napoleonsLegacy");
  });
});
