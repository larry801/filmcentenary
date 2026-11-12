/**
 * 33.4 Austrian war aims — live and pure coverage.
 *
 * Incorporate's unification wars may target spaces containing a nationality
 * with full AU citizenship (only the eight printed nationalities of 33.4.1 can
 * hold it), and Arbiter of Italy lets AU declare a war of liberation on
 * Italian-nationality spaces before Italy unifies.  Neither exception may
 * widen the normal validation for another power.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {validateWarAim} from "./engine/limitedWar";
import {declareWar} from "./moves";

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

describe("33.4 AU wars of unification on citizen nationalities", () => {
  test("a space whose nationality has full citizenship is a legal unification target", () => {
    const G = fresh();
    G.spaces.bohemia.control = "GE";
    G.powers.AU.citizenship = ["Czechs"];
    expect(validateWarAim(G, "AU", "GE", "unification", ["bohemia"]).ok).toBe(true);
  });

  test("an Italian nationality with full citizenship is also legal", () => {
    const G = fresh();
    G.spaces.tuscany.control = "GE";
    G.powers.AU.citizenship = ["Italians"];
    expect(validateWarAim(G, "AU", "GE", "unification", ["tuscany"]).ok).toBe(true);
  });

  test("without full citizenship the target is rejected", () => {
    const G = fresh();
    G.spaces.bohemia.control = "GE";
    G.powers.AU.citizenship = [];
    const result = validateWarAim(G, "AU", "GE", "unification", ["bohemia"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "unification-not-citizenship")).toBe(true);
  });

  test("citizenship entries outside the eight AU nationalities cannot open a target", () => {
    const G = fresh();
    G.spaces.bavaria.control = "GE";
    // Germans is not one of the eight nationalities AU may naturalise (33.4.1).
    G.powers.AU.citizenship = ["Germans"];
    const result = validateWarAim(G, "AU", "GE", "unification", ["bavaria"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "unification-not-citizenship")).toBe(true);
  });

  test("the target must still be controlled by the defender", () => {
    const G = fresh();
    G.powers.AU.citizenship = ["Czechs"];
    G.spaces.bohemia.control = "AU";
    const result = validateWarAim(G, "AU", "GE", "unification", ["bohemia"]);
    expect(result.issues.some((issue) => issue.code === "objective-not-controlled")).toBe(true);
  });

  test("only AU may use the citizenship exception", () => {
    const G = fresh();
    G.spaces.bohemia.control = "GE";
    G.powers.AU.citizenship = ["Czechs"];
    const result = validateWarAim(G, "FR", "GE", "unification", ["bohemia"]);
    expect(result.issues.some((issue) => issue.code === "unification-wrong-power")).toBe(true);
  });

  test("live: AU declares the unification war through the real move", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.spaces.bohemia.control = "GE";
    G.powers.AU.citizenship = ["Czechs"];
    const ctx = makeCtx(seat("AU"));
    expect(declareWar(G, ctx, "GE", "unification", ["bohemia"], 2)).toBeUndefined();
    expect(G.war?.attacker).toBe("AU");
    expect(G.war?.warAim).toBe("unification");
    expect(G.phase).toBe("wartime");
  });
});

describe("33.4 Arbiter of Italy", () => {
  test("before Italian unification AU may liberate a non-rebellious Italian space", () => {
    const G = fresh();
    G.spaces.tuscany.control = "GE";
    expect(validateWarAim(G, "AU", "GE", "liberation", ["tuscany"]).ok).toBe(true);
  });

  test("after Italian unification the Arbiter exception is gone", () => {
    const G = fresh();
    G.spaces.tuscany.control = "GE";
    G.persistent.italyUnified = true;
    const result = validateWarAim(G, "AU", "GE", "liberation", ["tuscany"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "liberation-not-home-or-rebellion")).toBe(true);
  });

  test("the flags-based unification marker also closes the exception", () => {
    const G = fresh();
    G.spaces.tuscany.control = "GE";
    G.flags.italyUnified = true;
    const result = validateWarAim(G, "AU", "GE", "liberation", ["tuscany"]);
    expect(result.issues.some((issue) => issue.code === "liberation-not-home-or-rebellion")).toBe(true);
  });

  test("a rebellion is still a legal liberation target after unification", () => {
    const G = fresh();
    G.spaces.tuscany.control = "GE";
    G.spaces.tuscany.rebellion = {minor: "Tuscany", step: 0, rebels: ["r1"]};
    G.persistent.italyUnified = true;
    expect(validateWarAim(G, "AU", "GE", "liberation", ["tuscany"]).ok).toBe(true);
  });

  test("the Arbiter exception does not apply to other powers", () => {
    const G = fresh();
    G.spaces.tuscany.control = "GE";
    const result = validateWarAim(G, "FR", "GE", "liberation", ["tuscany"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "liberation-not-home-or-rebellion")).toBe(true);
  });

  test("a non-Italian nationality gets no Arbiter exception", () => {
    const G = fresh();
    G.spaces.silesia.control = "GE";
    const result = validateWarAim(G, "AU", "GE", "liberation", ["silesia"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "liberation-not-home-or-rebellion")).toBe(true);
  });

  test("live: AU declares the liberation war before unification", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.spaces.tuscany.control = "GE";
    const ctx = makeCtx(seat("AU"));
    expect(declareWar(G, ctx, "GE", "liberation", ["tuscany"], 2)).toBeUndefined();
    expect(G.war?.warAim).toBe("liberation");
  });

  test("live: the same declaration is rejected after unification and spends no CP", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.spaces.tuscany.control = "GE";
    G.persistent.italyUnified = true;
    const ctx = makeCtx(seat("AU"));
    expect(declareWar(G, ctx, "GE", "liberation", ["tuscany"], 2)).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
    expect(G.cpRemaining).toBe(4);
    expect(G.phase).toBe("action");
  });
});
