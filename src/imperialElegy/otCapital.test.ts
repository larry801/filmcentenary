/**
 * 29.1 / 33.5: the Ottoman capital moves from Istanbul to Ankara when Russia
 * takes Istanbul, and every live capital lookup (blockade here) follows it.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {capitalOf, isBlockaded, subcapitalOf} from "./engine/rules";
import {resolveGwWinter} from "./engine/greatWarFlow";
import {applyWarEndCharacteristics} from "./moves";

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
    order: ["GE", "FR"],
    belligerents: ["GE", "FR", "RU", "OT"],
    neutrals: [],
    te: ["FR", "OT"],
    ta: ["GE", "RU"],
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
  G.powers.RU.alliance = "taCommitted";
  G.powers.OT.alliance = "teCommitted";
  G.phase = "gwWinter";
  return G;
};

const makeWar = (attacker: Power, defender: Power, overrides: Partial<WarState> = {}): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: "defender",
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

describe("capitalOf (33.5)", () => {
  test("uses the printed capital before RU takes Istanbul", () => {
    const G = gwState();
    expect(capitalOf(G, "OT")).toBe("istanbul");
    expect(capitalOf(G, "GE")).toBe("berlin");
    expect(capitalOf(G, "RU")).toBe("st-petersburg");
  });

  test("returns Ankara for the Ottomans after the Second Rome switch", () => {
    const G = gwState();
    G.persistent.otCapital = "ankara";
    expect(capitalOf(G, "OT")).toBe("ankara");
    // The switch is Ottoman-only.
    expect(capitalOf(G, "GE")).toBe("berlin");
    expect(capitalOf(G, "RU")).toBe("st-petersburg");
    // The printed subcapital is unchanged for AU/RU/OT.
    expect(subcapitalOf("OT")).toBe("ankara");
    expect(subcapitalOf("AU")).toBe("hungary");
    expect(subcapitalOf("RU")).toBe("moscow");
    expect(subcapitalOf("GE")).toBeUndefined();
  });

  test("RU taking Istanbul at the end of a won war flips the capital", () => {
    const G = setupImperialElegy(makeCtx());
    G.spaces.istanbul.occupiedBy = "RU";
    G.war = makeWar("RU", "OT", {victor: "attacker"});

    applyWarEndCharacteristics(G, makeCtx());

    expect(G.spaces.istanbul.control).toBe("RU");
    expect(G.persistent.otCapital).toBe("ankara");
    expect(capitalOf(G, "OT")).toBe("ankara");
    expect(G.log.some((entry) => entry.key === "secondRome")).toBe(true);
  });

  test("a lost or white-peace war leaves the printed capital in place", () => {
    const lost = setupImperialElegy(makeCtx());
    lost.spaces.istanbul.occupiedBy = "RU";
    lost.war = makeWar("RU", "OT", {victor: "defender"});
    applyWarEndCharacteristics(lost, makeCtx());
    expect(lost.persistent.otCapital).toBeUndefined();
    expect(capitalOf(lost, "OT")).toBe("istanbul");
  });
});

describe("29.1 blockade follows the capital", () => {
  test("an enemy-held Istanbul blockades the Ottomans before the switch", () => {
    const G = gwState();
    G.spaces.istanbul.occupiedBy = "RU";

    expect(isBlockaded(G, "OT")).toBe(true);
    // The other belligerents still trace to their own capitals.
    expect(isBlockaded(G, "GE")).toBe(false);
    expect(isBlockaded(G, "FR")).toBe(false);
    expect(isBlockaded(G, "RU")).toBe(false);

    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.blockaded).toContain("OT");
  });

  test("after the switch Ankara is the capital, so RU-held Istanbul is not a blockade", () => {
    const G = gwState();
    G.persistent.otCapital = "ankara";
    // RU took Istanbul, exactly as the Second Rome result leaves it.
    G.spaces.istanbul.control = "RU";
    G.spaces.istanbul.occupiedBy = null;
    G.spaces.ankara.control = "OT";

    expect(isBlockaded(G, "OT")).toBe(false);

    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.blockaded).not.toContain("OT");
  });

  test("after the switch an enemy-held Ankara still blockades the Ottomans", () => {
    const G = gwState();
    G.persistent.otCapital = "ankara";
    G.spaces.istanbul.occupiedBy = "RU";
    G.spaces.ankara.occupiedBy = "RU";
    expect(isBlockaded(G, "OT")).toBe(true);
  });

  test("the switch does not change any other power's blockade check", () => {
    const G = gwState();
    G.persistent.otCapital = "ankara";
    G.spaces.berlin.occupiedBy = "FR";
    expect(isBlockaded(G, "GE")).toBe(true);
    expect(isBlockaded(G, "FR")).toBe(false);
  });
});
