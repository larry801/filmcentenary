/**
 * Per-constraint tests for the `A` group of `testing/invariants`.
 *
 * Every check gets one positive case (a fresh campaign state passes) and one
 * negative case (a single hand-made break is reported with that catalog id).
 * The negative cases are deliberately surgical: they assert that the code is
 * *reported*, not that it is the only thing wrong, because a mutated board can
 * legitimately trip a second invariant.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, GreatWarState, ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {INVARIANTS, checkAll} from "./testing/invariants";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const codes = (G: ImperialElegyState): string[] =>
  checkAll(G, {level: "full"}).map((violation) => violation.code);

describe("the campaign setup satisfies every structural invariant", () => {
  test("a fresh state reports nothing at full level", () => {
    const violations = checkAll(fresh(), {level: "full"});
    expect(violations.map((violation) => `${violation.code} ${violation.path}: ${violation.msg}`)).toEqual([]);
  });
});

describe("A01 — one physical copy, one zone", () => {
  test("a card in two zones is reported", () => {
    const G = fresh();
    expect(G.deck.length).toBeGreaterThan(0);
    G.removed.push(G.deck[0]);
    expect(codes(G)).toContain("A01");
  });
});

describe("A02 — no duplicate inside a zone or a decision id", () => {
  test("the same card twice in the deck is reported", () => {
    const G = fresh();
    G.deck.push(G.deck[0]);
    expect(codes(G)).toContain("A02");
  });

  test("two decisions sharing an id are reported", () => {
    const G = fresh();
    const pending = G.pending ?? {
      id: "p1",
      kind: "eventChoice" as const,
      power: "GE" as const,
      prompt: "p",
      options: [{id: "a", label: "A"}],
      createdAt: 0,
    };
    pending.id = "p1";
    G.pending = pending;
    G.pendingStack = [{...pending, kind: "combatCard"}];
    expect(codes(G)).toContain("A02");
  });
});

describe("A03 — unit bookkeeping is a bijection", () => {
  test("a space naming a unit that does not exist is reported", () => {
    const G = fresh();
    G.spaces.berlin.units.push("ghost");
    expect(codes(G)).toContain("A03");
  });

  test("a unit whose space disagrees with the list is reported", () => {
    const G = fresh();
    const uid = G.spaces.berlin.units[0];
    if (uid) G.units[uid].space = "paris";
    expect(codes(G)).toContain("A03");
  });

  test("a reserve counter still on the board is reported", () => {
    const G = fresh();
    const uid = G.powers.GE.reserves[0];
    expect(uid).toBeDefined();
    if (uid) G.units[uid].space = "berlin";
    expect(codes(G)).toContain("A03");
  });
});

describe("A04 — counter shape", () => {
  test("a three-step counter is reported", () => {
    const G = fresh();
    const uid = Object.keys(G.units)[0];
    G.units[uid].steps = 3;
    expect(codes(G)).toContain("A04");
  });

  test("an elite counter with two steps is reported", () => {
    const G = fresh();
    const uid = Object.keys(G.units)[0];
    G.units[uid].kind = "eliteCorps";
    G.units[uid].steps = 2;
    expect(codes(G)).toContain("A04");
  });
});

describe("A05 — 4.2 counter pools", () => {
  test("more elite corps than the printed pool is reported", () => {
    const G = fresh();
    for (let i = 0; i < 6; i += 1) {
      G.units[`surplus-ec-${i}`] = {id: `surplus-ec-${i}`, kind: "eliteCorps", owner: "GE", steps: 1, space: null};
    }
    expect(codes(G)).toContain("A05");
  });
});

describe("A06 — track bounds", () => {
  test("stability above 6 and negative industry are reported", () => {
    const G = fresh();
    G.powers.GE.stability = 7;
    G.powers.FR.industry = -1;
    const reported = codes(G);
    expect(reported).toContain("A06");
  });

  test("world tension above its maximum is reported", () => {
    const G = fresh();
    G.wtt = G.worldTensionMax + 1;
    expect(codes(G)).toContain("A06");
  });
});

describe("A07 — key tracks agree with the board", () => {
  test("a control change that was never recomputed is reported", () => {
    const G = fresh();
    G.spaces.berlin.control = "FR";
    expect(codes(G)).toContain("A07");
  });
});

describe("A08 — stacking (warn)", () => {
  test("four armies in a main-map space warn", () => {
    const G = fresh();
    for (let i = 0; i < 4; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    const violations = checkAll(G, {level: "cheap"}).filter((violation) => violation.code === "A08");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every((violation) => violation.severity === "warn")).toBe(true);
  });
});

describe("A09 — 12.12 forts", () => {
  test("a fort on a submap is reported", () => {
    const G = fresh();
    G.spaces.india.fort = {power: "GE", level: 1};
    expect(codes(G)).toContain("A09");
  });
});

describe("A10 — 12.14 CP chain", () => {
  test("three chained cards are reported", () => {
    const G = fresh();
    G.powers.GE.cpChain = G.deck.slice(0, 3);
    expect(codes(G)).toContain("A10");
  });
});

describe("A11 — 4.2.1 minor allies", () => {
  test("a sixth minor ally is reported", () => {
    const G = fresh();
    Object.keys(G.spaces)
      .slice(0, 6)
      .forEach((space, index) => {
        G.spaces[space].control = `Minor${index}`;
        G.spaces[space].ally = "GE";
      });
    expect(codes(G)).toContain("A11");
  });
});

describe("A12 — 8.4 alliance cap", () => {
  test("a fourth player in one alliance is reported as a warning", () => {
    const G = fresh();
    for (const power of ["GE", "UK", "FR", "RU"] as const) G.powers[power].alliance = "teAligned";
    const reported = checkAll(G, {level: "cheap"}).filter((violation) => violation.code === "A12");
    expect(reported.length).toBe(1);
    // 8.3's forced shift can legally fill an already-full alliance, and the
    // state does not record how a member joined, so this can only warn.
    expect(reported[0].severity).toBe("warn");
  });
});

describe("A13 — pending decisions are answerable", () => {
  test("an empty option list is reported", () => {
    const G = fresh();
    G.pending = {id: "empty", kind: "eventChoice", power: "GE", prompt: "p", options: [], createdAt: 0};
    expect(codes(G)).toContain("A13");
  });

  test("an unknown kind and owner are reported", () => {
    const G = fresh();
    G.pending = {id: "odd", kind: "nope" as never, power: "IT" as never, prompt: "p", options: [{id: "a", label: "A"}], createdAt: 0};
    const reported = codes(G);
    expect(reported).toContain("A13");
  });
});

describe("A14 — flow fields", () => {
  test("a turn outside 1..8 is reported", () => {
    const G = fresh();
    G.turn = 9;
    expect(codes(G)).toContain("A14");
  });

  test("a duplicated pass entry is reported", () => {
    const G = fresh();
    G.passed = ["GE", "GE"];
    expect(codes(G)).toContain("A14");
  });
});

describe("A15 — battle and Great War coherence", () => {
  test("a battle naming a space that does not exist is reported", () => {
    const G = fresh();
    G.battle = {
      kind: "land",
      attacker: "GE",
      defender: "FR",
      from: "nowhere",
      to: "berlin",
      mainAttack: [],
      mainDefense: [],
      supportAttack: [],
      supportDefense: [],
      stage: "support",
      supportSide: "attacker",
      attackerDrm: 0,
      defenderDrm: 0,
    } as unknown as BattleState;
    expect(codes(G)).toContain("A15");
  });

  test("a Great War turn outside 0..5 and a non-power belligerent are reported", () => {
    const G = fresh();
    G.gw = {
      active: true,
      turn: 9,
      order: [],
      belligerents: ["GE", "ZZ"],
      neutrals: [],
      te: [],
      ta: [],
      usIn: false,
      italyIn: false,
    } as unknown as GreatWarState;
    const reported = codes(G);
    expect(reported).toContain("A15");
  });
});

describe("A16 — the state is plain JSON", () => {
  test("NaN in state is reported", () => {
    const G = fresh();
    (G.flags as Record<string, unknown>).broken = Number.NaN;
    expect(codes(G)).toContain("A16");
  });

  test("an undefined entry in an array is reported by the round-trip", () => {
    const G = fresh();
    (G.deck as unknown[]).push(undefined);
    expect(codes(G)).toContain("A16");
  });

  test("a class instance is reported", () => {
    const G = fresh();
    (G.flags as Record<string, unknown>).when = new Date(0);
    expect(codes(G)).toContain("A16");
  });
});

test("the registry is ordered, unique and cites a rule", () => {
  expect(INVARIANTS.map((invariant) => invariant.code)).toEqual(
    Array.from({length: INVARIANTS.length}, (_unused, index) => `A${String(index + 1).padStart(2, "0")}`),
  );
  for (const invariant of INVARIANTS) expect(invariant.rule.length).toBeGreaterThan(0);
  expect(POWERS.length).toBe(6);
});
