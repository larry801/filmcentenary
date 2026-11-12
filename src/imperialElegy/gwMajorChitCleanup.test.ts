/**
 * 30.2 / 25.2 / 25.3 — US and Italy non-player chit cleanup on surrender.
 *
 * 30.2: "When either of these major powers surrenders, remove all their units
 * from play."  30.1 gives every surrender the same marker bookkeeping, and the
 * two majors are handled symmetrically: Italy's chit returns to the neutral box
 * in both `gw.italyAlliance` and `persistent.italyAlliance`, and the US chit —
 * which only lives in `persistent.usAlliance` and is read back through
 * `usAllianceBox` — is neutralized the same way.  Neither may ever re-enter.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {resolveCapitalSurrenders} from "./engine/rules";
import {changeGwMajorStability, surrenderGwMajor, syncItalianHomeKeys} from "./engine/gwMajors";
import {
  enterGwAlly,
  majorEntryCandidates,
  resolveMajorPowerEntry,
  usAllianceBox,
} from "./engine/greatWarFlow";
import {italyAllianceBox} from "./engine/italyEntry";

const makeCtx = (dieValue = 4): Ctx =>
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
    order: ["FR", "US", "IT"],
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

describe("30.2 the US alliance chit is neutralized on surrender", () => {
  test("a committed US chit returns to the neutral box", () => {
    const G = gwState();
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    G.persistent.usAlliance = "teCommitted";
    G.persistent.italyAlliance = "taCommitted";

    surrenderGwMajor(G, "US", "stability", makeCtx());

    expect(G.gw!.usSurrendered).toBe(true);
    expect(G.gw!.usIn).toBe(false);
    expect(G.gw!.usBudget).toBe(0);
    expect(G.persistent.usAlliance).toBe("neutral");
    expect(usAllianceBox(G)).toBe("neutral");
    // The two chits are independent: Italy's chit is untouched.
    expect(G.persistent.italyAlliance).toBe("taCommitted");
  });

  test("a stability collapse runs the same chit cleanup", () => {
    const G = gwState();
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    G.persistent.usAlliance = "teCommitted";

    expect(changeGwMajorStability(G, "US", -3, "test", makeCtx())).toBe(-3);

    expect(G.gw!.usSurrendered).toBe(true);
    expect(G.gw!.usStability).toBe(0);
    expect(G.persistent.usAlliance).toBe("neutral");
    expect(usAllianceBox(G)).toBe("neutral");
  });

  test("a surrendered US cannot re-enter even if its stability is restored", () => {
    const G = gwState();
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    G.persistent.usAlliance = "teCommitted";
    surrenderGwMajor(G, "US", "stability", makeCtx());
    // A stale save or a stray effect restores the stability and the chit.
    G.gw!.usStability = 3;
    G.persistent.usAlliance = "teCommitted";

    expect(majorEntryCandidates(G, "FR")).not.toContain("US");
    expect(resolveMajorPowerEntry(G, makeCtx(), "FR", "US")).toBeNull();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(false);
  });
});

describe("30.2 Italy's chit is neutralized symmetrically", () => {
  test("both the GW chit and its persistent mirror return to neutral", () => {
    const G = gwState();
    G.gw!.italyIn = true;
    G.flags.italySide = "ta";
    G.gw!.italyAlliance = "taCommitted";
    G.persistent.italyAlliance = "taCommitted";
    G.persistent.usAlliance = "teCommitted";

    surrenderGwMajor(G, "IT", "stability", makeCtx());

    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.italyBudget).toBe(0);
    expect(G.gw!.italyAlliance).toBe("neutral");
    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(italyAllianceBox(G)).toBe("neutral");
    // The US chit is untouched.
    expect(G.persistent.usAlliance).toBe("teCommitted");
  });

  test("a stability collapse runs the same chit cleanup", () => {
    const G = gwState();
    G.gw!.italyIn = true;
    G.flags.italySide = "ta";
    G.gw!.italyAlliance = "taCommitted";

    expect(changeGwMajorStability(G, "IT", -3, "test", makeCtx())).toBe(-3);

    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.gw!.italyAlliance).toBe("neutral");
    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(italyAllianceBox(G)).toBe("neutral");
  });

  test("taking Rome surrenders Italy and cleans the chit", () => {
    const G = gwState();
    G.gw!.italyIn = true;
    G.flags.italySide = "ta";
    G.gw!.italyAlliance = "taCommitted";
    G.persistent.italyAlliance = "taCommitted";
    G.persistent.italyUnified = true;
    G.spaces.rome.control = "IT";
    G.spaces.rome.occupiedBy = "FR";

    // 32.2: an enemy in Rome surrenders Italy at once, through the same
    // home-key reconciler the live move path calls.
    syncItalianHomeKeys(G, makeCtx());

    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.gw!.italyAlliance).toBe("neutral");
    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(italyAllianceBox(G)).toBe("neutral");
  });

  test("a surrendered Italy cannot re-enter or be shifted back in", () => {
    const G = gwState();
    G.gw!.italyIn = true;
    G.flags.italySide = "ta";
    G.gw!.italyAlliance = "taCommitted";
    G.persistent.italyUnified = true;
    surrenderGwMajor(G, "IT", "capital", makeCtx());
    G.gw!.italyStability = 3;
    G.gw!.italyAlliance = "taCommitted";

    expect(majorEntryCandidates(G, "FR")).not.toContain("IT");
    expect(resolveMajorPowerEntry(G, makeCtx(), "FR", "IT")).toBeNull();
    expect(enterGwAlly(G, makeCtx(), "IT", "ta").ok).toBe(false);
  });
});

describe("30.1 the major surrender shares the initiative-slot bookkeeping", () => {
  test("both majors surrendering leaves one bonus impulse and neutral chits", () => {
    const G = gwState();
    G.gw!.order = ["FR", "US", "IT", "GE"];
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    G.persistent.usAlliance = "teCommitted";
    G.gw!.italyIn = true;
    G.flags.italySide = "ta";
    G.gw!.italyAlliance = "taCommitted";
    G.persistent.italyAlliance = "taCommitted";

    surrenderGwMajor(G, "US", "stability", makeCtx());
    // The US slot becomes TE's bonus impulse.
    expect(G.gw!.bonusImpulseSide).toBe("te");
    surrenderGwMajor(G, "IT", "stability", makeCtx());

    expect(G.persistent.usAlliance).toBe("neutral");
    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(G.gw!.italyAlliance).toBe("neutral");
    // 30.1: "only one alliance can have a bonus impulse"; the second
    // surrender (TA) collides with TE's marker, so both are removed.
    expect(bonusCount(G)).toBe(0);
    expect(G.gw!.bonusImpulseSide).toBeNull();
  });

  test("a player elimination does not touch either major's chit", () => {
    const G = gwState({order: ["FR", "GE"], te: ["FR"], ta: ["GE"], belligerents: ["FR", "GE"]});
    G.persistent.usAlliance = "teAligned";
    G.gw!.italyAlliance = "taAligned";
    G.persistent.italyAlliance = "taAligned";
    G.spaces.berlin.occupiedBy = "FR";

    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["GE"]);

    expect(G.persistent.usAlliance).toBe("teAligned");
    expect(G.gw!.italyAlliance).toBe("taAligned");
    expect(G.persistent.italyAlliance).toBe("taAligned");
  });

  test("the surrender cleanup is idempotent", () => {
    const G = gwState();
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    G.persistent.usAlliance = "teCommitted";
    surrenderGwMajor(G, "US", "stability", makeCtx());
    const before = JSON.stringify(G);

    surrenderGwMajor(G, "US", "stability", makeCtx());

    expect(JSON.stringify(G)).toBe(before);
  });
});
