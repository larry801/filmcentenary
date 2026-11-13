/**
 * 30.1 GW Surrender and Elimination — the marker bookkeeping.
 *
 * "When a player surrenders, remove the following markers from play: all their
 * units, their marker on the Alliance track, their wartime initiative marker,
 * and all their ally markers on minor powers.  Lastly, replace the eliminated
 * player's space on the wartime initiative track with a bonus impulse for their
 * alliance.  Exception: only one alliance can have a bonus impulse on the
 * wartime initiative track.  If a player elimination would cause both
 * alliances to have a bonus impulse on the wartime initiative track, instead
 * remove both bonus impulse markers and move all player initiative markers up
 * the track to fill the newly vacated spaces."
 *
 * Also: "If any of the eliminated player's allies were actively fighting in
 * the GW, replace the eliminated player's ally marker with an ally marker
 * belonging to a member of their alliance."
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {eliminatePower, resolveCapitalSurrenders} from "./engine/rules";
import {surrenderGwMajor} from "./engine/gwMajors";
import {advanceGwImpulse} from "./engine/greatWarFlow";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const gwState = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["FR", "GE"],
    belligerents: ["GE", "FR"],
    neutrals: [],
    te: ["FR"],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    ...overrides,
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  return G;
};

const bonusCount = (G: ImperialElegyState): number =>
  G.gw!.order.filter((slot) => slot === "bonus").length;

describe("30.1 eliminated power's markers", () => {
  test("the Alliance Track chit leaves play", () => {
    const G = gwState();
    G.spaces.berlin.occupiedBy = "FR";

    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["GE"]);

    expect(G.powers.GE.eliminated).toBe(true);
    expect(G.powers.GE.alliance).toBe("neutral");
    // The eliminated power no longer counts toward the 8.4 alliance cap.
    expect(G.gw!.ta).not.toContain("GE");
  });

  test("the initiative slot becomes a bonus impulse for its alliance", () => {
    const G = gwState({
      order: ["FR", "GE", "AU"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
    });
    G.powers.AU.alliance = "taCommitted";
    G.spaces.berlin.occupiedBy = "FR";

    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["GE"]);

    expect(G.gw!.order).toEqual(["FR", "bonus", "AU"]);
    expect(G.gw!.bonusImpulseSide).toBe("ta");
    const entry = G.log.find((item) => item.key === "gwBonusImpulse");
    expect(entry?.args).toMatchObject({side: "ta", reason: "elimination"});
  });

  test("the bonus impulse is actually granted to the eliminated alliance", () => {
    const G = gwState({
      order: ["FR", "GE", "AU"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
    });
    G.powers.AU.alliance = "taCommitted";
    G.spaces.berlin.occupiedBy = "FR";
    resolveCapitalSurrenders(G, makeCtx());
    // The alliances are now equal (1 v 1): the historic size heuristic would
    // hand out nothing, but the recorded marker still belongs to the TA.
    G.powers.FR.flags.passedGw = true;
    G.powers.AU.flags.passedGw = false;
    G.activePower = "FR";
    G.turnIndex = 0;
    G.powers.AU.gwBudget = 2;

    const result = advanceGwImpulse(G, makeCtx());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.kind).toBe("bonus");
    expect(result.power).toBe("AU");
    expect(result.side).toBe("ta");
  });

  test("only one bonus impulse per alliance: an existing marker is kept", () => {
    const G = gwState({
      order: ["FR", "bonus", "GE", "AU"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
      bonusImpulseSide: "ta",
    });
    G.spaces.berlin.occupiedBy = "FR";

    resolveCapitalSurrenders(G, makeCtx());

    expect(bonusCount(G)).toBe(1);
    expect(G.gw!.order).toEqual(["FR", "bonus", "AU"]);
    expect(G.gw!.bonusImpulseSide).toBe("ta");
    expect(G.log.some((item) => item.key === "gwBonusImpulse")).toBe(false);
  });

  test("both alliances would have one: both markers are removed and the track compacts", () => {
    const G = gwState({
      order: ["FR", "bonus", "GE", "AU"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
      bonusImpulseSide: "te",
    });
    G.spaces.berlin.occupiedBy = "FR";

    resolveCapitalSurrenders(G, makeCtx());

    expect(bonusCount(G)).toBe(0);
    expect(G.gw!.order).toEqual(["FR", "AU"]);
    expect(G.gw!.bonusImpulseSide).toBeNull();
    const entry = G.log.find((item) => item.key === "gwBonusImpulseRemoved");
    expect(entry?.args).toMatchObject({reason: "elimination"});
  });

  test("legacy saves without a recorded side compact rather than guess", () => {
    const G = gwState({
      order: ["FR", "bonus", "GE", "AU"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
    });
    // No bonusImpulseSide on this save.  After GE is eliminated the alliances
    // are 1 v 1, so the size heuristic cannot identify the marker's owner; the
    // elimination must then follow 30.1's "both alliances" exception.
    G.spaces.berlin.occupiedBy = "FR";
    eliminatePower(G, "GE", makeCtx(), "capital");
    expect(bonusCount(G)).toBe(0);
    expect(G.gw!.order).not.toContain("GE");
  });

  test("the maneuver cursor keeps pointing at the active slot after compaction", () => {
    const G = gwState({
      order: ["GE", "AU", "FR", "UK", "bonus"],
      te: ["FR", "UK"],
      ta: ["GE", "AU"],
      belligerents: ["GE", "AU", "FR", "UK"],
      bonusImpulseSide: "ta",
    });
    G.activePower = "FR";
    G.turnIndex = 2;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.gw!.order).toEqual(["AU", "FR", "UK", "bonus"]);
    // FR's slot moved from index 2 to index 1; the cursor must follow it or the
    // next impulse would skip UK.
    expect(G.turnIndex).toBe(1);
  });

  test("an already-eliminated power is not processed twice", () => {
    const G = gwState({
      order: ["FR", "GE", "AU"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
    });
    G.spaces.tuscany.ally = "GE";
    G.spaces.berlin.occupiedBy = "FR";
    resolveCapitalSurrenders(G, makeCtx());
    const order = [...G.gw!.order];
    const reassigned = G.log.filter((item) => item.key === "allyMarkerReassigned").length;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.gw!.order).toEqual(order);
    expect(G.log.filter((item) => item.key === "allyMarkerReassigned")).toHaveLength(reassigned);
  });
});

describe("30.1 minor-power ally markers", () => {
  test("reassigned to a surviving alliance member, deterministically", () => {
    const G = gwState({
      order: ["FR", "GE", "OT", "AU"],
      te: ["FR"],
      ta: ["GE", "OT", "AU"],
      belligerents: ["FR", "GE", "OT", "AU"],
    });
    G.spaces.tuscany.ally = "GE";
    G.spaces.saxony.ally = "GE";
    G.spaces.berlin.occupiedBy = "FR";

    resolveCapitalSurrenders(G, makeCtx());

    // OT is earlier in the initiative order than AU, so it is the heir.
    expect(G.spaces.tuscany.ally).toBe("OT");
    expect(G.spaces.saxony.ally).toBe("OT");
    const entries = G.log.filter((item) => item.key === "allyMarkerReassigned");
    expect(entries).toHaveLength(2);
    expect(entries[0].args).toMatchObject({from: "GE", to: "OT"});
  });

  test("two surviving powers use a die roll when they cannot agree", () => {
    const run = (dice: number[]) => {
      const G = gwState({
        order: ["FR", "GE", "OT", "AU"],
        te: ["FR"],
        ta: ["GE", "OT", "AU"],
        belligerents: ["FR", "GE", "OT", "AU"],
      });
      G.spaces.tuscany.ally = "GE";
      G.spaces.berlin.occupiedBy = "FR";
      let index = 0;
      const ctx = {
        ...makeCtx(3),
        random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
      } as Ctx;
      resolveCapitalSurrenders(G, ctx);
      return G.spaces.tuscany.ally;
    };
    // OT and AU are the two remaining alliance members; the higher roll takes
    // the minor power, whichever seat that is.
    expect(run([2, 6])).toBe("AU");
    expect(run([6, 2])).toBe("OT");
    // A tie falls back to the earlier initiative order (OT).
    expect(run([3, 3])).toBe("OT");
  });

  test("removed when no alliance member survives", () => {
    const G = gwState();
    G.spaces.tuscany.ally = "GE";
    G.spaces.berlin.occupiedBy = "FR";

    resolveCapitalSurrenders(G, makeCtx());

    expect(G.spaces.tuscany.ally).toBeNull();
    const entry = G.log.find((item) => item.key === "allyMarkerReassigned");
    expect(entry?.args).toMatchObject({from: "GE", to: ""});
  });
});

describe("30.1 non-player major surrender shares the bookkeeping", () => {
  test("a surrendering Italy's chit and slot follow the same rules", () => {
    const G = gwState({
      order: ["FR", "IT"],
      te: ["FR"],
      ta: ["GE"],
      belligerents: ["FR", "GE"],
    });
    G.gw!.italyIn = true;
    G.gw!.italyAlliance = "taCommitted";
    G.flags.italySide = "ta";

    surrenderGwMajor(G, "IT", "stability", makeCtx());

    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.gw!.italyAlliance).toBe("neutral");
    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(G.gw!.order).toEqual(["FR", "bonus"]);
    expect(G.gw!.bonusImpulseSide).toBe("ta");
  });

  test("a surrendering US uses its order slot for its alliance", () => {
    const G = gwState({
      order: ["FR", "US", "GE"],
      te: ["FR"],
      ta: ["GE"],
      belligerents: ["FR", "GE"],
    });
    G.gw!.usIn = true;
    G.flags.usSide = "te";

    surrenderGwMajor(G, "US", "stability", makeCtx());

    expect(G.gw!.usSurrendered).toBe(true);
    expect(G.gw!.order).toEqual(["FR", "bonus", "GE"]);
    expect(G.gw!.bonusImpulseSide).toBe("te");
  });
});
