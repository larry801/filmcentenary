/**
 * 29.2 The Colonial War — the printed modifiers (EF, elite unit, elite colonial
 * EF, army on the continent, naval supremacy), the "controls the whole submap"
 * rule, the outcome table (losses and territorial transfer), 29.2.1 stability
 * and the planning-step bonus CP.
 */
import {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  hasColonialNavalSupremacy,
  neutralBonusCpLoc,
  resolveColonialWar,
  resolveGwWinter,
} from "./engine/greatWarFlow";
import {colonialWarModifiers, colonialSubmapControl} from "./engine/greatWarFlow";

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
  for (const power of G.gw.te) G.powers[power].alliance = "teCommitted";
  for (const power of G.gw.ta) G.powers[power].alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

describe("29.2 colonial-war modifiers", () => {
  test("no units and no navy leaves the roll unmodified", () => {
    const G = baseGw();
    expect(colonialWarModifiers(G, "te", "africa")).toEqual({mod: 0, sources: []});
    expect(colonialWarModifiers(G, "ta", "asia")).toEqual({mod: 0, sources: []});
  });

  test("each EF gives +1 and each army on the continent gives +1", () => {
    const G = baseGw();
    placeUnit(G, "FR", "expeditionary", "sudan", 1);
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "reserveArmy", "nigeria", 2);
    const {mod, sources} = colonialWarModifiers(G, "te", "africa");
    expect(mod).toBe(3);
    expect([...sources].sort()).toEqual(["army:FR", "army:FR", "ef:FR"]);
  });

  test("an elite unit gives +1 and an elite colonial EF gives +2", () => {
    const G = baseGw();
    placeUnit(G, "FR", "eliteCorps", "nigeria", 1);
    expect(colonialWarModifiers(G, "te", "africa").mod).toBe(1);
    placeUnit(G, "FR", "zouave", "sudan", 1);
    expect(colonialWarModifiers(G, "te", "africa").mod).toBe(2);
    placeUnit(G, "FR", "eliteColonialEf", "cameroon", 1);
    const result = colonialWarModifiers(G, "te", "africa");
    expect(result.mod).toBe(4);
    expect(result.sources).toContain("eliteColonialEf:FR");
  });

  test("units on the main map (North Africa, Algeria) do not count as on the submap", () => {
    const G = baseGw();
    placeUnit(G, "FR", "army", "algeria", 2);
    expect(colonialWarModifiers(G, "te", "africa").mod).toBe(0);
  });

  test("naval supremacy in Africa needs the South Atlantic and Indian Ocean", () => {
    const G = baseGw();
    expect(hasColonialNavalSupremacy(G, "te", "africa")).toBe(false);
    placeUnit(G, "FR", "squadron", "south-atlantic", 2);
    expect(hasColonialNavalSupremacy(G, "te", "africa")).toBe(false);
    placeUnit(G, "FR", "squadron", "indian-ocean", 2);
    expect(hasColonialNavalSupremacy(G, "te", "africa")).toBe(true);
    expect(colonialWarModifiers(G, "te", "africa")).toEqual({
      mod: 2,
      sources: ["navalSupremacy"],
    });
    // Any enemy ship in either box breaks it.
    placeUnit(G, "GE", "squadron", "indian-ocean", 2);
    expect(hasColonialNavalSupremacy(G, "te", "africa")).toBe(false);
  });

  test("naval supremacy in Asia needs the Pacific and Indian Ocean", () => {
    const G = baseGw();
    placeUnit(G, "FR", "squadron", "pacific-ocean", 2);
    placeUnit(G, "FR", "squadron", "indian-ocean", 2);
    expect(hasColonialNavalSupremacy(G, "te", "asia")).toBe(true);
    expect(hasColonialNavalSupremacy(G, "te", "africa")).toBe(false);
  });
});

describe("29.2 colonial submap control", () => {
  test("control ignores neutral and uncontrolled spaces", () => {
    const G = baseGw({te: ["UK"], ta: ["GE"], belligerents: ["UK", "GE"], order: ["UK", "GE"]});
    G.powers.UK.alliance = "teCommitted";
    // Every player-controlled Africa space is British, so TE controls the
    // continent; the minor/uncontrolled spaces are neutral and not counted.
    expect(colonialSubmapControl(G, "africa")).toBe("te");
  });

  test("an enemy-controlled space breaks control", () => {
    const G = baseGw({te: ["UK"], ta: ["GE"], belligerents: ["UK", "GE"], order: ["UK", "GE"]});
    G.powers.UK.alliance = "teCommitted";
    G.spaces.nigeria.control = "GE";
    expect(colonialSubmapControl(G, "africa")).toBe(null);
  });
});

describe("29.2 opposed rolls and outcomes", () => {
  test("a larger total wins and the loser takes one unit loss", () => {
    const G = baseGw({neutrals: []});
    placeUnit(G, "FR", "army", "sudan", 2); // TE +1
    placeUnit(G, "FR", "army", "nigeria", 2); // TE +1
    placeUnit(G, "GE", "army", "east-africa", 2); // TA +1
    const roll = resolveColonialWar(G, makeCtx(3), "africa");
    expect(roll.teRoll).toBe(3);
    expect(roll.taRoll).toBe(3);
    expect(roll.teMod).toBe(2);
    expect(roll.taMod).toBe(1);
    expect(roll.winner).toBe("te");
    expect(roll.losses).toHaveLength(1);
    expect(roll.losses[0]).toMatchObject({power: "GE", eliminated: false});
    // 2-step army -> one step lost.
    const army = Object.values(G.units).find((unit) => unit.owner === "GE" && unit.space === "east-africa");
    expect(army?.steps).toBe(1);
  });

  test("a differential of 4 or more takes two losses and two spaces", () => {
    const G = baseGw({neutrals: []});
    // TE +4: two armies (+2) and naval supremacy (+2).
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "army", "nigeria", 2);
    placeUnit(G, "FR", "army", "cameroon", 2);
    placeUnit(G, "FR", "squadron", "south-atlantic", 2);
    placeUnit(G, "FR", "squadron", "indian-ocean", 2);
    placeUnit(G, "GE", "army", "east-africa", 2);
    const roll = resolveColonialWar(G, makeCtx(3), "africa");
    expect(roll.te - roll.ta).toBe(4);
    expect(roll.winner).toBe("te");
    expect(roll.losses).toHaveLength(2);
    expect(roll.transfers.length).toBeGreaterThanOrEqual(1);
  });

  test("a tie applies no losses and no transfers", () => {
    const G = baseGw({neutrals: []});
    const roll = resolveColonialWar(G, makeCtx(3), "africa");
    expect(roll.winner).toBe(null);
    expect(roll.losses).toEqual([]);
    expect(roll.transfers).toEqual([]);
  });

  test("controlling the whole submap makes the opposing total count as 0", () => {
    const G = baseGw({te: ["UK"], ta: ["GE"], belligerents: ["UK", "GE"], neutrals: [], order: ["UK", "GE"]});
    G.powers.UK.alliance = "teCommitted";
    // Give the Central Powers a huge modifier and a high die: the continental
    // control rule still zeroes its total (the die is rolled for stability).
    placeUnit(G, "GE", "eliteColonialEf", "nigeria", 1);
    placeUnit(G, "GE", "eliteColonialEf", "sudan", 1);
    const roll = resolveColonialWar(G, makeCtx(6), "africa");
    expect(roll.controllingSide).toBe("te");
    expect(roll.ta).toBe(0);
    expect(roll.taRoll).toBe(6);
    expect(roll.winner).toBe("te");
  });

  test("the winner takes an unoccupied space it can trace a LoC to", () => {
    const G = baseGw({neutrals: []});
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "army", "nigeria", 2);
    placeUnit(G, "GE", "army", "east-africa", 2);
    const roll = resolveColonialWar(G, makeCtx(3), "africa");
    expect(roll.transfers.length).toBe(1);
    const transfer = roll.transfers[0];
    expect(transfer.side).toBe("te");
    expect(transfer.by).toBe("FR");
    expect(G.spaces[transfer.space].control).toBe("FR");
    expect(G.spaces[transfer.space].units).toEqual([]);
  });

  test("no legal unoccupied space leaves the winner with no transfer", () => {
    const G = baseGw({neutrals: []});
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "army", "nigeria", 2);
    placeUnit(G, "GE", "army", "east-africa", 2);
    // Occupy every other Africa-submap space with a neutral unit so none is a
    // legal transfer target.
    const africa = [
      "south-africa", "morocco", "nigeria", "cameroon", "west-congo", "central-congo",
      "east-africa", "somalia", "ethiopia", "sudan", "southwest-africa", "rhodesia", "madagascar",
    ];
    for (const space of africa) {
      if (space === "sudan" || space === "east-africa") continue;
      placeUnit(G, "Belgium", "minorArmy", space, 1);
    }
    const roll = resolveColonialWar(G, makeCtx(3), "africa");
    expect(roll.winner).toBe("te");
    expect(roll.transfers).toEqual([]);
  });
});

describe("29.2.1 colonial-war stability", () => {
  test("the UK loses 1 stability for a colonial roll its alliance loses", () => {
    const G = baseGw({
      te: ["UK", "FR"],
      ta: ["GE"],
      belligerents: ["UK", "FR", "GE"],
      order: ["UK", "FR", "GE"],
      neutrals: [],
    });
    G.powers.UK.alliance = "teCommitted";
    G.powers.FR.alliance = "teCommitted";
    // Break TE's African continental control and give TA a big modifier.
    G.spaces.nigeria.control = "GE";
    placeUnit(G, "GE", "eliteColonialEf", "east-africa", 1);
    placeUnit(G, "GE", "eliteColonialEf", "somalia", 1);
    const before = G.powers.UK.stability;
    const res = resolveGwWinter(G, makeCtx(1));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.colonialWar.africa.winner).toBe("ta");
    expect(G.powers.UK.stability).toBe(before - 1);
    expect(res.colonialStability?.some((entry) => entry.power === "UK")).toBe(true);
  });

  test("RU loses 1 stability with two of Central Asia, Qajar Persia and Manchuria enemy controlled", () => {
    const G = baseGw({te: ["GE"], ta: ["RU"], belligerents: ["GE", "RU"], order: ["GE", "RU"], neutrals: []});
    G.powers.RU.alliance = "taCommitted";
    G.spaces["central-asia"].control = "GE";
    G.spaces["qajar-persia"].control = "GE";
    const before = G.powers.RU.stability;
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.powers.RU.stability).toBe(before - 1);
    expect(res.colonialStability?.some((entry) => entry.power === "RU")).toBe(true);
  });

  test("one enemy-controlled space does not cost RU stability", () => {
    const G = baseGw({te: ["GE"], ta: ["RU"], belligerents: ["GE", "RU"], order: ["GE", "RU"], neutrals: []});
    G.powers.RU.alliance = "taCommitted";
    G.spaces["central-asia"].control = "GE";
    const before = G.powers.RU.stability;
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    expect(G.powers.RU.stability).toBe(before);
  });
});

describe("29.2.1 colonial bonus CP", () => {
  test("controlling both submaps gives 3 bonus CP, split deterministically", () => {
    const G = baseGw({
      te: ["UK", "FR"],
      ta: ["GE", "AU"],
      belligerents: ["UK", "FR", "GE", "AU"],
      order: ["UK", "FR", "GE", "AU"],
      neutrals: [],
    });
    G.powers.UK.alliance = "teCommitted";
    G.powers.FR.alliance = "teCommitted";
    // TE controls both counted submaps; FR is not blockaded (no enemy ships).
    expect(colonialSubmapControl(G, "africa")).toBe("te");
    expect(colonialSubmapControl(G, "asia")).toBe("te");
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.bonusCp).toEqual({UK: 2, FR: 1});
    // The CP lands in the next planning budgets (industry-based budget + bonus);
    // `gw.bonusCp` is consumed by that planning pass.
    expect(G.gw!.bonusCp).toEqual({});
    expect(G.powers.UK.gwBudget).toBe(Math.max(2, G.powers.UK.industry) + 2);
    const frEmpire = G.powers.FR.government === "secondEmpire" ? 1 : 0;
    expect(G.powers.FR.gwBudget).toBe(Math.max(2, G.powers.FR.industry) + 1 + frEmpire);
  });

  test("controlling one submap gives 1 bonus CP", () => {
    const G = baseGw({te: ["UK"], ta: ["GE"], belligerents: ["UK", "GE"], order: ["UK", "GE"], neutrals: []});
    G.powers.UK.alliance = "teCommitted";
    // Break Asia control with an enemy-held space.
    G.spaces.india.control = "GE";
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.bonusCp).toEqual({UK: 1});
  });
});
