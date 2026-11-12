/**
 * Rules 13.4 / 13.5 / 14.2 — war on a non-player power with a player ally.
 *
 * "Declaring war against a non-player power that has a player ally is treated
 * as declaring war against that player.  Meaning, all normal alliance rules
 * apply, and the defending player will shift away from the attacker on the
 * alliance track [8.2]."  The live `declareWar` accepts the typed minor target,
 * makes the ally the defending primary, records the minor on the defending
 * side, and applies the 14.2 ally-aiding shift instead of the ordinary 8.2
 * defender shift.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState, minorWarInfo, nonPlayerHome} from "./engine/limitedWar";
import {declareWar, resolvePending} from "./moves";

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

/** Belgium is an independent minor allied to FR (13.4: the printed case). */
const belgiumAlliedToFrance = (G: ImperialElegyState): void => {
  G.spaces.belgium.ally = "FR";
};

// ---------------------------------------------------------------------------
// Target resolution (pure)
// ---------------------------------------------------------------------------

describe("13.4 non-player target resolution", () => {
  test("the non-player's home space identifies it", () => {
    expect(nonPlayerHome("Belgium")).toBe("belgium");
    expect(nonPlayerHome("Italy")).toBe("rome");
    expect(nonPlayerHome("Atlantis")).toBeNull();
  });

  test("an allied minor resolves to its player ally", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    const info = minorWarInfo(G, "GE", "Belgium");
    expect(info.ok).toBe(true);
    expect(info.ally).toBe("FR");
    expect(info.home).toBe("belgium");
  });

  test("a minor with no player ally has ally null", () => {
    const G = fresh();
    const info = minorWarInfo(G, "GE", "Belgium");
    expect(info.ok).toBe(true);
    expect(info.ally).toBeNull();
  });

  test("a minor allied to the attacker cannot be attacked (13.4.1)", () => {
    const G = fresh();
    G.spaces.belgium.ally = "GE";
    expect(minorWarInfo(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "allied-to-attacker"});
  });

  test("a minor holding the attacker's diplomacy marker cannot be attacked", () => {
    const G = fresh();
    G.spaces.belgium.diplomacy = "GE";
    expect(minorWarInfo(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "diplomacy-with-attacker"});
  });

  test("a minor allied to a member of the attacker's alliance is protected (8.1.2)", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    G.powers.GE.alliance = "teAligned";
    G.powers.FR.alliance = "teAligned";
    expect(minorWarInfo(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "attacker-alliance"});
  });

  test("a truce with the defending player blocks the declaration (13.5)", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    const settled = createWarState(G, "FR", "GE", "conquest", ["alsace-lorraine"], 2);
    settled.truceTurns = 1;
    G.wars.push(settled);
    expect(minorWarInfo(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "truce"});
  });
});

// ---------------------------------------------------------------------------
// Live declaration
// ---------------------------------------------------------------------------

describe("declareWar on an allied non-player power", () => {
  test("the ally becomes the defending primary and its chit shifts (14.2)", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    beginAction(G);
    const wtt = G.wtt;

    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    // 13.4.1: the player ally first decides whether to fight or abandon; this
    // test covers the "join" answer (the live abandonment path is in
    // minorAbandonment.test.ts).
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(resolvePending(G, makeCtx([], seat("FR")), "join")).toBeUndefined();

    // Rule 13.4: treated as a declaration on the player ally.
    expect(G.war?.attacker).toBe("GE");
    expect(G.war?.defender).toBe("FR");
    expect(G.war?.minorTarget).toEqual({minor: "Belgium", ally: "FR"});
    // The minor fights on the defending side (15.4).
    expect(G.war?.defenderMinors).toEqual(["Belgium"]);
    // 13.3 conquest penalty still applies.
    expect(G.wtt).toBe(wtt + 1);
    // The live war phase opened.
    expect(G.phase).toBe("wartime");
    expect(G.activePower).toBe("GE");

    // 14.2: the aiding player shifts away from the attacker.  Both chits are
    // neutral, so the deterministic Triple Entente fallback is used.
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.war?.defenderShift).toEqual({
      from: "neutral",
      to: "teAligned",
      steps: 1,
      forced: false,
      choice: false,
    });
    const shiftLog = lastLog(G, "allianceShifted");
    expect(shiftLog?.power).toBe("FR");
    expect(shiftLog?.args).toMatchObject({from: "neutral", to: "teAligned", attacker: "GE", aidMinor: "Belgium"});
    expect(lastLog(G, "warDeclared")?.args).toMatchObject({target: "Belgium", aim: "conquest"});
  });

  test("the 14.2 shift respects rule 8.4's three-player maximum", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    // GE is TA-aligned, so the derived direction is away toward the Entente.
    G.powers.GE.alliance = "taAligned";
    // The Entente already has three players.
    for (const power of ["UK", "AU", "RU"] as const) G.powers[power].alliance = "teAligned";
    beginAction(G);

    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), "join")).toBeUndefined();

    expect(G.powers.FR.alliance).toBe("neutral");
    expect(G.war?.defenderShift).toMatchObject({from: "neutral", steps: 0});
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({steps: 0, blocked: true});
  });

  test("a truce with the defending player rejects the declaration before any CP is spent", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    beginAction(G, "GE", 4);
    const settled = createWarState(G, "FR", "GE", "conquest", ["alsace-lorraine"], 2);
    settled.truceTurns = 1;
    G.wars.push(settled);

    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.war).toBeNull();
    expect(G.phase).toBe("action");
  });

  test("a minor with no player ally starts the 13.4.2 aid search", () => {
    const G = fresh();
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    // The declaration is paid for, no WarState exists yet, and the first
    // printed aid candidate holds the decision.
    expect(G.cpRemaining).toBe(2);
    expect(G.war).toBeNull();
    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("UK");
  });

  test("an unknown non-player power is rejected", () => {
    const G = fresh();
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Atlantis"}, "conquest", ["belgium"], 2)).toBe(INVALID_MOVE);
  });

  test("objectives must be held by the defending side", () => {
    const G = fresh();
    belgiumAlliedToFrance(G);
    beginAction(G);
    // Paris belongs to FR, who is the defender here (13.4 treats the ally as
    // the defender), so it is legal; Berlin is GE's and is not.
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["berlin"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Existing player-vs-player validation is unchanged
// ---------------------------------------------------------------------------

test("a player target still uses the ordinary 8.2 defender shift", () => {
  const G = fresh();
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
  expect(G.war?.minorTarget).toBeUndefined();
  expect(G.war?.defenderMinors).toEqual([]);
  // Both chits are neutral, so the defender keeps the printed 8.2 choice open.
  expect(G.war?.defenderShift?.choice).toBe(true);
  expect(G.powers.FR.alliance).toBe("neutral");
});
