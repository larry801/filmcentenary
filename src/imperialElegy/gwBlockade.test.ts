/**
 * 29.1 Blockade — capital LoC to an allowed naval box, the Baltic/Black Sea
 * "ending there counts" clarification, the RU TSRR Pacific gate, the yearly
 * maximum-industry reduction (floor 3, turn 0 excluded) and 29.1.1's US check.
 */
import {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {navalHopPassable} from "./engine/rules";
import {
  beginGwTurn,
  blockadePlan,
  blockadeTrace,
  maxIndustryOf,
  resolveGwWinter,
} from "./engine/greatWarFlow";

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

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 2,
    order: ["FR", "GE"],
    belligerents: ["FR", "GE"],
    neutrals: ["UK", "AU", "RU", "OT"],
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
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

const blockAllBoxesExcept = (G: ImperialElegyState, owner: Power, boxes: string[]): void => {
  for (const box of boxes) placeUnit(G, owner, "squadron", box, 2);
};

describe("29.1 blockade trace", () => {
  test("a capital whose only LoC ends in the Baltic is blockaded", () => {
    const G = baseGw();
    // Enemy ships in the North Atlantic cut the Baltic's exit to the ocean, so
    // every box GE can trace to is the (exempt) Baltic Sea itself.
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    expect(blockadeTrace(G, "GE")).toContain("baltic-sea");
    expect(blockadeTrace(G, "GE")).not.toContain("north-atlantic");
    expect(blockadePlan(G)).toEqual(["GE"]);
    // The French capital still reaches the North Atlantic through Brittany.
    expect(blockadePlan(G)).not.toContain("FR");
  });

  test("tracing *through* the Baltic to an allowed box is not a blockade", () => {
    const G = baseGw();
    expect(blockadeTrace(G, "GE")).toContain("baltic-sea");
    expect(blockadeTrace(G, "GE")).toContain("north-atlantic");
    expect(blockadePlan(G)).not.toContain("GE");
  });

  test("RU can only use the Pacific boxes with the TSRR completed", () => {
    const G = baseGw({te: ["RU"], ta: ["GE"], order: ["RU", "GE"], belligerents: ["RU", "GE"]});
    G.powers.RU.alliance = "teCommitted";
    // Cut every non-Pacific route: the Baltic exit, the Black Sea exit and the
    // Indian Ocean all hold enemy ships.
    blockAllBoxesExcept(G, "GE", ["north-atlantic", "western-mediterranean", "eastern-mediterranean", "indian-ocean", "south-atlantic"]);
    expect(blockadePlan(G)).toContain("RU");
    // The Trans-Siberian Railroad opens the overland Pacific route.
    G.powers.RU.tsrr = true;
    expect(blockadePlan(G)).not.toContain("RU");
  });

  test("a US/Italy major's side is not a belligerent for the blockade list", () => {
    const G = baseGw({te: ["FR"], ta: ["GE"], belligerents: ["FR", "GE"]});
    expect(blockadePlan(G).every((power) => (POWERS as readonly string[]).includes(power))).toBe(true);
  });
});

describe("29.1 yearly maximum-industry reduction", () => {
  test("a blockaded player's maximum industry drops by one and industry is clamped", () => {
    const G = baseGw({neutrals: []});
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    G.powers.GE.maxIndustry = 6;
    G.powers.GE.industry = 6;
    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.blockaded).toEqual(["GE"]);
    expect(res.industryLost).toEqual(["GE"]);
    expect(maxIndustryOf(G, "GE")).toBe(5);
    expect(G.powers.GE.industry).toBe(5);
    expect(G.log.some((entry) => entry.key === "gwBlockade" && entry.power === "GE")).toBe(true);
  });

  test("the maximum never drops below three", () => {
    const G = baseGw({neutrals: []});
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    G.powers.GE.maxIndustry = 4;
    G.powers.GE.industry = 4;
    expect(resolveGwWinter(G, makeCtx()).ok).toBe(true);
    expect(maxIndustryOf(G, "GE")).toBe(3);
    // A further blockaded year stays at the floor and logs no reduction.
    G.phase = "gwWinter";
    G.gw!.turn = 3;
    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(maxIndustryOf(G, "GE")).toBe(3);
    expect(res.industryLost).toEqual([]);
  });

  test("GW turn 0 is not a year: no maximum-industry loss", () => {
    const G = baseGw({turn: 0, neutrals: []});
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const before = maxIndustryOf(G, "GE");
    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.blockaded).toEqual(["GE"]);
    expect(res.industryLost).toEqual([]);
    expect(maxIndustryOf(G, "GE")).toBe(before);
  });

  test("planning clamps current industry to the reduced maximum", () => {
    const G = baseGw({neutrals: []});
    G.powers.GE.maxIndustry = 3;
    G.powers.GE.industry = 5;
    G.phase = "gwPlanning";
    const res = beginGwTurn(G, makeCtx());
    expect(res.ok).toBe(true);
    expect(G.powers.GE.industry).toBe(3);
    expect(G.powers.GE.gwBudget).toBeGreaterThanOrEqual(2);
  });
});

describe("29.1.1 the US and blockade", () => {
  test("enemy ships in the North Atlantic cost the US 1 stability at winter", () => {
    const G = baseGw({neutrals: [], usIn: true});
    G.flags.usSide = "te";
    placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.usStabilityLoss).toBe(-1);
    expect(G.gw!.usStability).toBe(2);
    expect(G.log.find((entry) => entry.key === "gwMajorStability")?.args).toMatchObject({
      cause: "northAtlantic",
    });
  });

  test("no enemy ships in the North Atlantic leaves US stability alone", () => {
    const G = baseGw({neutrals: [], usIn: true});
    G.flags.usSide = "te";
    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.usStabilityLoss).toBe(0);
    expect(G.gw!.usStability).toBe(3);
  });
});

describe("29.1/29.2 sea-route gates", () => {
  test("a closed or enemy-blocked Suez cuts a sea LoC hop", () => {
    const G = baseGw();
    G.persistent.suezCanal = false;
    expect(navalHopPassable(G, "UK", "eastern-mediterranean", "indian-ocean")).toBe(false);
    G.persistent.suezCanal = true;
    expect(navalHopPassable(G, "UK", "eastern-mediterranean", "indian-ocean")).toBe(true);
    G.persistent.suezBlockedBy = "FR";
    expect(navalHopPassable(G, "UK", "eastern-mediterranean", "indian-ocean")).toBe(false);
    expect(navalHopPassable(G, "FR", "eastern-mediterranean", "indian-ocean")).toBe(true);
  });

  test("the Dardanelles need the controller's grant", () => {
    const G = baseGw();
    G.spaces.istanbul.control = "OT";
    G.spaces.dardanelles.control = "OT";
    G.persistent.suezCanal = true;
    expect(navalHopPassable(G, "RU", "black-sea", "eastern-mediterranean")).toBe(false);
    expect(navalHopPassable(G, "OT", "black-sea", "eastern-mediterranean")).toBe(true);
    G.dardanellesPassages = [
      {requesting: "RU", granting: "OT", turn: G.turn, gwTurn: G.gw!.turn},
    ];
    expect(navalHopPassable(G, "RU", "black-sea", "eastern-mediterranean")).toBe(true);
  });
});
