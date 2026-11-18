/**
 * Printed-rule completion coverage for the two clauses closed in this change:
 *
 *  - 22.3.1 (p. 44): "If Italy and OT are allied, shift Italy into the neutral
 *    box and end this procedure."
 *  - 12.10 (p. 26, as amended by the March 2026 errata): the EF action sends an
 *    EF to a friendly controlled space, a friendly home space, or a space with
 *    the player's influence or control marker; no LoC is traced.
 *
 * The rulebook authority is `/Users/larryw/tools/ie-assets/IE_rule.pdf` plus
 * `IE_ERRATA_-_Mar_20_2026.pdf` in the repository root.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {unifyItaly, italyTable} from "./engine/greatWar";
import {italyAllianceBox} from "./engine/italyEntry";
import {efDestinationAllowed} from "./engine/rules";
import {buildEf, declareWar, resolvePending} from "./moves";

const makeCtx = (dice: number | number[] = 3, playerID = "0"): Ctx => {
  const values = Array.isArray(dice) ? dice : [dice];
  let index = 0;
  return {
    playerID,
    random: {
      Die: () => values[Math.min(index++, values.length - 1)] ?? 3,
      Number: () => 1,
      Shuffle: (items: unknown[]) => items,
    },
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const seat = (power: Power): string => String(POWERS.indexOf(power));

const beginAction = (G: ImperialElegyState, active: Power, cp = 12): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

// ---------------------------------------------------------------------------
// 22.3.1 — the Ottoman alliance clause
// ---------------------------------------------------------------------------

describe("22.3.1 Kingdom of Italy table: Italy and OT allied", () => {
  const lastOttomanLog = (G: ImperialElegyState) =>
    [...G.log].reverse().find((entry) => entry.key === "italyOttomanWar");

  test("an allied Italy shifts straight to the neutral box and the procedure ends", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(3), "GE");
    G.turn = 5; // 7+ result
    G.persistent.italyAlliance = "taCommitted";
    G.persistent.alliance = undefined;
    // OT shares Italy's alliance.
    G.powers.OT.alliance = "taCommitted";
    G.spaces.rhodes.control = "OT";

    expect(italyTable(G, makeCtx(6), "GE")).toBe(true);

    expect(italyAllianceBox(G)).toBe("neutral");
    expect(lastOttomanLog(G)?.args).toMatchObject({result: "alliedNeutral", to: "neutral"});
    // The printed clause ends the procedure: no reinforcement and no Ottoman war.
    expect(G.italyReinforcements?.armies ?? 0).toBe(0);
    expect(G.spaces.rhodes.control).toBe("OT");
  });

  test("an allied Italy is caught even when OT is only aligned, and no territory changes hands", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(3), "GE");
    G.turn = 5;
    G.persistent.italyAlliance = "teAligned";
    G.powers.OT.alliance = "teAligned";
    G.spaces.rhodes.control = "OT";
    G.spaces.tunisia.control = "OT";

    expect(italyTable(G, makeCtx(6), "GE")).toBe(true);

    expect(italyAllianceBox(G)).toBe("neutral");
    expect(G.spaces.tunisia.control).toBe("OT");
  });

  test("an Italy in the opposing alliance still fights the printed Ottoman war", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(3), "GE");
    G.turn = 5;
    G.persistent.italyAlliance = "teCommitted";
    G.powers.OT.alliance = "taCommitted";
    G.spaces.rhodes.control = "OT";

    expect(italyTable(G, makeCtx(6), "GE")).toBe(true);

    expect(italyAllianceBox(G)).toBe("teCommitted");
    expect(lastOttomanLog(G)?.args?.result).not.toBe("alliedNeutral");
    expect(G.spaces.rhodes.control).toBe("IT");
  });
});

// ---------------------------------------------------------------------------
// 12.10 — EF destination
// ---------------------------------------------------------------------------

describe("12.10 EF destinations", () => {
  test("the shared predicate accepts home, own control and own influence", () => {
    const G = fresh();
    G.spaces.paris.control = "FR";
    expect(efDestinationAllowed(G, "paris", "FR")).toBe(true); // home
    // 12.5: influence sits on an uncontrolled space.
    G.spaces.paris.control = null;
    G.spaces.paris.influence = "FR";
    expect(efDestinationAllowed(G, "paris", "FR")).toBe(true); // influence
    G.spaces.paris.influence = null;
    expect(efDestinationAllowed(G, "paris", "FR")).toBe(true); // lost home, empty
    G.spaces.paris.control = "GE";
    expect(efDestinationAllowed(G, "paris", "FR")).toBe(false); // enemy-held
  });

  test("a naval box and an enemy space are refused by the move", () => {
    const G = fresh();
    beginAction(G, "FR");
    const ctx = makeCtx(3, seat("FR"));
    expect(buildEf(G, ctx, "north-atlantic")).toBe(INVALID_MOVE);
    expect(buildEf(G, ctx, "berlin")).toBe(INVALID_MOVE);
    // Nothing was spent on either refusal.
    expect(G.cpRemaining).toBe(12);
  });

  test("a friendly home space is accepted and costs 2 CP", () => {
    const G = fresh();
    beginAction(G, "FR");
    const ctx = makeCtx(3, seat("FR"));
    expect(buildEf(G, ctx, "paris")).toBeUndefined();
    expect(G.cpRemaining).toBe(10);
    const ef = Object.values(G.units).find((unit) => unit.owner === "FR" && unit.kind === "expeditionary");
    expect(ef?.space).toBe("paris");
  });

  test("moving an existing EF follows the same destination rule", () => {
    const G = fresh();
    beginAction(G, "FR");
    const ctx = makeCtx(3, seat("FR"));
    expect(buildEf(G, ctx, "paris")).toBeUndefined();
    const ef = Object.values(G.units).find((unit) => unit.owner === "FR" && unit.kind === "expeditionary")!;

    // A legal move (own colonial home / control) costs 1 CP.
    G.spaces.algeria.control = "FR";
    expect(buildEf(G, ctx, "algeria", ef.id)).toBeUndefined();
    expect(G.units[ef.id].space).toBe("algeria");
    expect(G.cpRemaining).toBe(9);

    // An illegal destination is refused and the EF stays put.
    expect(buildEf(G, ctx, "moscow", ef.id)).toBe(INVALID_MOVE);
    expect(G.units[ef.id].space).toBe("algeria");
    expect(G.cpRemaining).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// 13.4.4 — attacking China (March 2026 errata)
// ---------------------------------------------------------------------------

describe("13.4.4 attacking China in a war of conquest", () => {
  test("the Qing army is placed at full strength in the targeted key", () => {
    const G = fresh();
    beginAction(G, "GE");
    expect(declareWar(G, makeCtx([1, 1], seat("GE")), {minor: "Qing China"}, "conquest", ["shanghai"], 2)).toBeUndefined();
    // 13.4.2 opens the aid search first; decline every candidate so the lone
    // war is created and the declaration finalizes.
    let guard = 0;
    while (G.pending !== null && guard++ < 10) {
      const power = G.pending.power as Power;
      expect(resolvePending(G, makeCtx(3, seat(power)), "decline")).toBeUndefined();
    }
    expect(G.war?.minorTarget).toEqual({minor: "Qing China", ally: null});
    const qing = Object.values(G.units).filter((unit) => unit.owner === "Qing China");
    expect(qing).toHaveLength(1);
    expect(qing[0]).toMatchObject({kind: "minorArmy", steps: 2, space: "shanghai"});
  });

  test("an aiding player gains a +1 card marker", () => {
    const G = fresh();
    beginAction(G, "GE");
    // Qing has no player ally, so 13.4.2 opens the aid search for a player.
    declareWar(G, makeCtx([1, 1], seat("GE")), {minor: "Qing China"}, "conquest", ["shanghai"], 2);
    expect(G.pending?.kind).toBe("minorAid");
    const aider = G.pending!.power as Power;
    const before = G.powers[aider].cardMarkers;

    expect(resolvePending(G, makeCtx(3, seat(aider)), "aid")).toBeUndefined();

    expect(G.powers[aider].cardMarkers).toBe(before + 1);
    expect(G.log.some((entry) => entry.key === "qingAidCardMarker" && entry.args?.minor === "Qing China")).toBe(true);
  });
});
