/**
 * War-move authority (4.4/4.5, 13.2, 14.3, 15.0).
 *
 * `declareWar` widens boardgame.io's dispatch to every seat (`{all: "play"}`)
 * so the defender can answer 13.7's budget card and 15.5's surrender inside
 * the attacker's move.  That widening used to be all the engine checked: any
 * seat could name the war aim, start the maneuver, spend another belligerent's
 * war budget, pass on its behalf or settle the war early — the buttons were
 * merely hidden in the panel.
 *
 * These tests pin the engine-side answer, so the UI and the move layer cannot
 * drift apart again:
 *
 *  - 13.2 / 14.3 belong to the attacker;
 *  - a maneuver impulse belongs to one belligerent (4.4), so only it may pass
 *    or take a 15.2 action;
 *  - 15.0 settles the war at the all-passed boundary, not on an earlier click;
 *  - a war already recorded as won (15.5) settles through the victory step.
 *
 * The printed steps the alliance-shift and initiative rolls live in are
 * resolved inside `startWarManeuver`, so `WarState.status` has no separate
 * rung for them; the reference ladder in `phaseSteps` is not engine state.
 */
import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {belligerentsOf, canPassWarImpulse, createWarState, holdsWarImpulse, warAllPassed} from "./engine/limitedWar";
import {
  chooseWarAim,
  declinePending,
  passWarMove,
  playWarBudgetCard,
  resolvePending,
  resolveWar,
  startWarManeuver,
} from "./moves";

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

/** A declared, legal GE-vs-FR conquest war sitting in the aim/alliance steps. */
const declaredWar = (status: "warAim" | "alliance" | "maneuver" = "warAim"): ImperialElegyState => {
  const G = fresh();
  G.phase = "wartime";
  G.pending = null;
  G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
  G.war.status = status;
  G.activePower = "GE";
  G.cpRemaining = 0;
  return G;
};

const eventCard = (G: ImperialElegyState, power: Power): string => {
  const id = G.powers[power].hand.find((cardId) => /^IE-A0\d\d$/.test(cardId));
  expect(id).toBeDefined();
  return id!;
};

// ---------------------------------------------------------------------------
// 13.2 — the war aim belongs to the attacker
// ---------------------------------------------------------------------------

describe("13.2 the war aim belongs to the attacker", () => {
  test("the attacker announces its aim and the war advances", () => {
    const G = declaredWar("warAim");
    expect(chooseWarAim(G, makeCtx(seat("GE")), "conquest")).toBeUndefined();
    expect(G.war!.warAim).toBe("conquest");
    expect(G.war!.status).toBe("alliance");
  });

  test("the defender cannot announce the aim", () => {
    const G = declaredWar("warAim");
    const before = JSON.stringify(G.war);
    expect(chooseWarAim(G, makeCtx(seat("FR")), "conquest")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G.war)).toBe(before);
  });

  test("a neutral seat cannot announce the aim", () => {
    const G = declaredWar("warAim");
    expect(chooseWarAim(G, makeCtx(seat("UK")), "conquest")).toBe(INVALID_MOVE);
    expect(chooseWarAim(G, makeCtx(null), "conquest")).toBe(INVALID_MOVE);
    expect(G.war!.status).toBe("warAim");
  });
});

// ---------------------------------------------------------------------------
// 14.3 — the maneuver belongs to the attacker
// ---------------------------------------------------------------------------

describe("14.3 only the attacker opens the maneuver", () => {
  test("the attacker starts it and the initiative order is recorded", () => {
    const G = declaredWar("alliance");
    expect(startWarManeuver(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war!.status).toBe("maneuver");
    expect(G.war!.initiative.length).toBeGreaterThan(0);
    expect(G.activePower).toBe(G.war!.initiative[0]);
  });

  test("the defender cannot start the maneuver", () => {
    const G = declaredWar("alliance");
    expect(startWarManeuver(G, makeCtx(seat("FR")))).toBe(INVALID_MOVE);
    expect(G.war!.status).toBe("alliance");
  });

  test("an outsider cannot start the maneuver", () => {
    const G = declaredWar("alliance");
    expect(startWarManeuver(G, makeCtx(seat("UK")))).toBe(INVALID_MOVE);
    expect(G.war!.status).toBe("alliance");
  });

  test("the defender may still play its 13.7 budget card before the maneuver", () => {
    const G = declaredWar("warAim");
    const id = eventCard(G, "FR");
    expect(playWarBudgetCard(G, makeCtx(seat("FR")), id)).toBeUndefined();
    expect(G.war!.budgets.FR).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4.4 — one impulse at a time
// ---------------------------------------------------------------------------

describe("4.4 the maneuver impulse belongs to one belligerent", () => {
  /** A war in maneuver, GE holding the impulse first. */
  const maneuvering = (): ImperialElegyState => {
    const G = declaredWar("maneuver");
    G.war!.initiative = ["GE", "FR"];
    G.war!.budgets = {GE: 2, FR: 2}; // 15.0: pass only at budget ≤ 2
    G.war!.passed = [];
    G.activePower = "GE";
    return G;
  };

  test("holdsWarImpulse names exactly the open belligerent", () => {
    const G = maneuvering();
    expect(holdsWarImpulse(G, "GE")).toBe(true);
    expect(holdsWarImpulse(G, "FR")).toBe(false);
    expect(holdsWarImpulse(G, "UK")).toBe(false);

    // A war in another step has no impulse at all.
    G.war!.status = "alliance";
    expect(holdsWarImpulse(G, "GE")).toBe(false);
  });

  test("only the impulse holder may pass, and passing hands it over", () => {
    const G = maneuvering();
    const before = JSON.stringify(G.war);
    expect(passWarMove(G, makeCtx(seat("FR")))).toBe(INVALID_MOVE);
    expect(JSON.stringify(G.war)).toBe(before);

    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war!.passed).toEqual(["GE"]);
    expect(G.activePower).toBe("FR");
    // The seat that just passed is out of the maneuver, so it holds nothing.
    expect(holdsWarImpulse(G, "GE")).toBe(false);
    expect(holdsWarImpulse(G, "FR")).toBe(true);
  });

  test("a passed belligerent cannot act until the maneuver comes back around", () => {
    const G = maneuvering();
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(passWarMove(G, makeCtx(seat("GE")))).toBe(INVALID_MOVE);
  });

  test("an outsider can never pass", () => {
    const G = maneuvering();
    expect(passWarMove(G, makeCtx(seat("UK")))).toBe(INVALID_MOVE);
    expect(G.war!.passed).toEqual([]);
  });

  test("a non-belligerent cannot spend the war budget", () => {
    const G = declaredWar("maneuver");
    G.war!.budgets = {GE: 4, FR: 0};
    G.powers.UK.flags.freeColonialCp = 1;
    const id = eventCard(G, "UK");
    // 13.7 is a defending-seat action; an outsider has no war budget at all.
    expect(playWarBudgetCard(G, makeCtx(seat("UK")), id)).toBe(INVALID_MOVE);
    expect(G.war!.budgets.UK).toBeUndefined();
  });

  test("the panel's pass control and canPassWarImpulse agree", () => {
    const G = maneuvering();
    expect(canPassWarImpulse(G, "GE")).toBe(true);
    expect(canPassWarImpulse(G, "FR")).toBe(false);
    expect(canPassWarImpulse(G, "UK")).toBe(false);

    // Once a 15.5 surrender records the result the maneuver is over, so any
    // belligerent may send the war on to its victory step.
    G.war!.status = "victory";
    expect(canPassWarImpulse(G, "GE")).toBe(true);
    expect(canPassWarImpulse(G, "FR")).toBe(true);
    expect(canPassWarImpulse(G, "UK")).toBe(false);
  });

  test("warAllPassed is 15.0's boundary, not the panel's guess", () => {
    const G = maneuvering();
    expect(warAllPassed(G.war)).toBe(false);
    G.war!.passed = ["GE"];
    expect(warAllPassed(G.war)).toBe(false);
    G.war!.passed = ["GE", "FR"];
    expect(warAllPassed(G.war)).toBe(true);
    // A war with no belligerents is not "all passed".
    expect(warAllPassed(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15.0 — settled at the all-passed boundary
// ---------------------------------------------------------------------------

describe("15.0 the war is over only when every belligerent has passed", () => {
  const maneuvering = (): ImperialElegyState => {
    const G = declaredWar("maneuver");
    G.war!.initiative = ["GE", "FR"];
    G.war!.budgets = {GE: 2, FR: 2}; // 15.0: pass only at budget ≤ 2
    G.war!.passed = [];
    G.activePower = "GE";
    return G;
  };

  test("resolveWar refuses while the maneuver is still running", () => {
    const G = maneuvering();
    const before = JSON.stringify(G.war);
    expect(resolveWar(G, makeCtx(seat("GE")))).toBe(INVALID_MOVE);
    expect(JSON.stringify(G.war)).toBe(before);
  });

  test("the last pass settles the war", () => {
    const G = maneuvering();
    // Give FR nothing to fight over: every objective stays in its hands and no
    // capital fell, which 16.1.2 classifies as a white peace.
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(passWarMove(G, makeCtx(seat("FR")))).toBeUndefined();
    // The settlement ran: the war left the table (or is waiting on a treaty).
    expect(G.war === null || G.war.status === "victory").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15.5 — a recorded result settles through the victory step
// ---------------------------------------------------------------------------

describe("15.5 a war recorded as won settles through its victory step", () => {
  test("resolveWar on a surrendered war classifies the recorded result", () => {
    const G = declaredWar("maneuver");
    // 15.5 records the result on the war; the victory step then applies it.
    G.war!.status = "victory";
    G.war!.victor = "defender";
    expect(resolveWar(G, makeCtx(seat("FR")))).toBeUndefined();
    expect(G.war!.victoryPrimary).toBe("major");
    expect(G.war!.victor).toBe("defender");
    // 16.2: the recorded major victory opens the treaty chooser for FR.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("FR");
    expect(declinePending(G, makeCtx(seat("FR")))).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0]).toMatchObject({victor: "defender", status: "done"});
  });

  test("passing a surrendered war routes to the settlement instead of refusing", () => {
    const G = declaredWar("maneuver");
    G.war!.status = "victory";
    G.war!.victor = "defender";
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war === null || G.pending?.kind === "treatyOption").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The printed ladder is a reference, not engine state
// ---------------------------------------------------------------------------

describe("the war status ladder", () => {
  test("every rung the engine writes is a declared status", () => {
    // A declaration walks warAim → alliance → maneuver → victory → done.  The
    // type is the contract; this guards against re-adding a dead rung.
    const G = declaredWar("warAim");
    const seen = new Set<string>([G.war!.status]);
    expect(chooseWarAim(G, makeCtx(seat("GE")), "conquest")).toBeUndefined();
    seen.add(G.war!.status);
    expect(startWarManeuver(G, makeCtx(seat("GE")))).toBeUndefined();
    seen.add(G.war!.status);
    expect([...seen]).toEqual(["warAim", "alliance", "maneuver"]);
  });

  test("a war never reaches the printed intermediate rungs", () => {
    // `shift`, `initiative` and `demobilization` are printed steps the engine
    // resolves inside the alliance and victory steps; they are not statuses a
    // save can hold.  Passing one in reads as an unknown status, so the war
    // controls stay shut rather than silently accepting a stale save.
    const G = declaredWar("maneuver");
    G.war!.status = "shift" as never;
    expect(holdsWarImpulse(G, "GE")).toBe(false);
    expect(passWarMove(G, makeCtx(seat("GE")))).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// 13.6 — the defender's pre-maneuver concession is still open
// ---------------------------------------------------------------------------

describe("13.6 the defender may concede before the maneuver", () => {
  test("the defender's concession still ends the war from the aim step", () => {
    const G = declaredWar("warAim");
    // `surrender` is imported lazily to keep the authority list above focused.
    const {surrender} = require("./moves") as typeof import("./moves");
    expect(surrender(G, makeCtx(seat("FR")))).toBeUndefined();
    expect(G.war!.status).toBe("victory");
    expect(G.war!.victor).toBe("attacker");
    // The victory step applies it: a major victory opens the 16.2 chooser.
    expect(resolveWar(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war!.victor).toBe("attacker");
    expect(G.pending?.kind).toBe("treatyOption");
    expect(declinePending(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war).toBeNull();
  });

  test("the attacker cannot concede before the maneuver", () => {
    const G = declaredWar("warAim");
    const {surrender} = require("./moves") as typeof import("./moves");
    expect(surrender(G, makeCtx(seat("GE")))).toBe(INVALID_MOVE);
    expect(G.war!.status).toBe("warAim");
  });
});

// ---------------------------------------------------------------------------
// Belligerent bookkeeping
// ---------------------------------------------------------------------------

describe("belligerentsOf is the authority list", () => {
  test("allies on both sides are belligerents and may be passed by", () => {
    const G = declaredWar("maneuver");
    G.war!.attackerAllies = ["AU"];
    G.war!.defenderAllies = ["RU"];
    G.war!.initiative = ["GE", "FR", "AU", "RU"];
    G.war!.budgets = {GE: 2, FR: 2, AU: 2, RU: 2}; // 15.0: pass only at budget ≤ 2
    G.war!.passed = [];
    G.activePower = "GE";
    expect(belligerentsOf(G.war!).sort()).toEqual(["AU", "FR", "GE", "RU"]);

    // 15.0 needs every one of them, so a missing ally pass keeps the war open.
    for (const power of ["GE", "FR", "AU"] as const) {
      expect(passWarMove(G, makeCtx(seat(power)))).toBeUndefined();
    }
    expect(G.war).not.toBeNull();
    expect(passWarMove(G, makeCtx(seat("RU")))).toBeUndefined();
    expect(G.war === null || G.war.status === "victory" || G.pending !== null).toBe(true);
    if (G.pending?.kind === "treatyOption") declinePending(G, makeCtx(seat("GE")));
  });
});
