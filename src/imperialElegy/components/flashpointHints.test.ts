/**
 * The flashpoint and power-projection hint lines.
 *
 * These are the strings the board prints in the map footer, the space panel,
 * the player mat, the six-power dashboard and the dock.  They must agree with
 * the award at every step, so each case is read back against the engine's own
 * `flashpointController` / `computePowerProjection`.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {SPACES} from "../constant/spaces";
import {computePowerProjection, flashpointController, refreshPowerProjection} from "../engine/rules";
import {
  flashpointOpportunity,
  flashpointReward,
  opportunityHint,
  powerProjectionHint,
  powerProjectionOpportunity,
  spaceFlashpointLines,
  spaceFlashpointNames,
} from "./flashpointHints";

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "prep",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const give = (G: ImperialElegyState, power: Power, ids: string[]): void => {
  for (const id of ids) G.spaces[id].control = power;
};

const germanKeys = (): string[] =>
  Object.values(SPACES).filter((space) => space.home === "GE" || space.flashpoints?.includes("germany")).map((space) => space.id);

describe("the space panel's flashpoint line", () => {
  test("a two-theatre space prints both rows with the printed threshold", () => {
    const G = fresh();
    const lines = spaceFlashpointLines(G, "silesia", "GE", "zh_CN");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("德意志");
    expect(lines[0]).toContain("/8");
    expect(lines[1]).toContain("中欧");
    expect(lines[1]).toContain("/3");
    expect(lines.join(" | ")).toContain("+1 张牌");
    expect(lines.join(" | ")).toContain("+½ 张牌");
  });

  test("a dominated theatre names the holder and the reward", () => {
    const G = fresh();
    give(G, "GE", ["hanover", "saxony", "bavaria"]);
    expect(flashpointController(G, "germany")).toEqual(["GE"]);
    const line = spaceFlashpointLines(G, "berlin", "GE", "zh_CN").join("");
    expect(line).toContain("你已支配");
    expect(line).toContain("8/8");
    expect(line).toContain("+1 张牌");
  });

  test("another power's domination is named, not hidden", () => {
    const G = fresh();
    give(G, "FR", germanKeys());
    const line = spaceFlashpointLines(G, "berlin", "GE", "en").join("");
    expect(line).toContain("France dominates");
    expect(line).toContain("9/8");
  });

  test("an empty theatre says nobody controls it yet", () => {
    const G = fresh();
    const line = spaceFlashpointLines(G, "belgium", "GE", "zh_CN").join("");
    expect(line).toContain("低地国家");
    expect(line).toContain("你 0/2");
    expect(line).toContain("尚无人控制");
  });

  test("the map card lists the theatre names only", () => {
    expect(spaceFlashpointNames("silesia", "en")).toEqual(["Germany", "Central Europe"]);
    expect(spaceFlashpointNames("berlin", "zh_CN")).toEqual(["德意志"]);
    expect(spaceFlashpointNames("london", "en")).toEqual([]);
  });
});

describe("the dock's flashpoint opportunity", () => {
  test("one key short names the theatre and the unit", () => {
    const G = fresh();
    give(G, "GE", ["hanover", "saxony"]); // 7 of the printed 8
    const hint = flashpointOpportunity(G, "GE", "zh_CN");
    expect(hint?.key).toBe("flashpointOpportunity");
    expect(hint?.text).toContain("德意志关键区");
    expect(hint?.text).toContain("+1 张牌");
  });

  test("the Caucasus counts spaces, not keys", () => {
    const G = fresh();
    G.spaces["baku"].control = null; // RU falls from 5 to 4
    const hint = flashpointOpportunity(G, "RU", "zh_CN");
    expect(hint?.text).toContain("高加索空间");
  });

  test("a tied leader is still one short of sole domination", () => {
    const G = fresh();
    const members = Object.values(SPACES).filter((def) => def.flashpoints?.includes("centralEurope")).map((def) => def.id);
    for (const id of members) G.spaces[id].control = null;
    give(G, "GE", members.slice(0, 2));
    give(G, "FR", members.slice(2, 4));
    // Both hold two of the chart's three keys, so neither dominates yet.
    expect(flashpointController(G, "centralEurope")).toEqual([]);
    const hint = flashpointOpportunity(G, "GE", "en");
    expect(hint?.text).toContain("Central Europe");
    // One more breaks the tie and reaches the printed three.
    give(G, "GE", [members[4]!]);
    expect(flashpointController(G, "centralEurope")).toEqual(["GE"]);
  });

  test("the one-key minimum row (Balkans) never fires from zero", () => {
    const G = fresh();
    // Clear every Balkan space so the max is 0; a one-key row would otherwise
    // read as "one short" of its own minimum.
    for (const space of Object.values(SPACES).filter((def) => def.flashpoints?.includes("balkans"))) {
      G.spaces[space.id].control = null;
    }
    expect(flashpointOpportunity(G, "GE", "zh_CN")).toBeNull();
  });
});

describe("the mat and dashboard's power-projection hint", () => {
  test("the leader prints the track value, its sources and the DRM", () => {
    const G = fresh();
    const hint = powerProjectionHint(G, "UK", "zh_CN");
    expect(hint.value).toBe(8);
    expect(hint.value).toBe(computePowerProjection(G, "UK"));
    expect(hint.dominates).toBe(true);
    expect(hint.detail).toContain("北大西洋");
    expect(hint.detail).toContain("= 8");
    expect(hint.detail).toContain("海军上限");
    expect(hint.standing).toContain("工业化 +1 DRM");
  });

  test("a chaser prints the gap to the unique leader", () => {
    const G = fresh();
    const hint = powerProjectionHint(G, "FR", "zh_CN");
    expect(hint.value).toBe(3);
    expect(hint.value).toBe(computePowerProjection(G, "FR"));
    expect(hint.dominates).toBe(false);
    expect(hint.leader).toBe("UK");
    expect(hint.standing).toContain("落后英国 5 点");
    expect(hint.detail).toContain("西地中海 2");
  });

  test("the naval ceiling is named when it cuts the port score", () => {
    const G = fresh();
    for (const unit of Object.values(G.units)) {
      if (unit.owner === "UK" && unit.naval) unit.steps = 0;
    }
    refreshPowerProjection(G);
    const hint = powerProjectionHint(G, "UK", "zh_CN");
    expect(hint.value).toBe(0);
    expect(hint.detail).toContain("海军上限 0");
    expect(hint.detail).toContain("被截断");
  });

  test("one point behind a unique leader is a two-way domination", () => {
    const G = fresh();
    G.powers.FR.flags.powerProjection = 8; // ties UK
    expect(flashpointController(G, "powerProjection").sort()).toEqual(["FR", "UK"]);
    G.powers.FR.flags.powerProjection = 7;
    const hint = powerProjectionOpportunity(G, "FR", "zh_CN");
    expect(hint?.key).toBe("projectionOpportunity");
    expect(hint?.text).toContain("落后英国 1 点");
  });

  test("a shared lead is not one point from domination", () => {
    const G = fresh();
    G.powers.FR.flags.powerProjection = 8;
    G.powers.AU.flags.powerProjection = 8;
    expect(flashpointController(G, "powerProjection")).toEqual([]);
    G.powers.AU.flags.powerProjection = 7;
    // FR and UK share the lead at 8; FR's +1 would make three at 9, and a
    // three-way tie dominates nobody, so neither chaser gets the line.
    expect(powerProjectionOpportunity(G, "FR", "zh_CN")).toBeNull();
    expect(powerProjectionOpportunity(G, "AU", "zh_CN")).toBeNull();
  });
});

describe("the dock's single opportunity line", () => {
  test("the map objective outranks the projection chase", () => {
    const G = fresh();
    give(G, "GE", ["hanover", "saxony"]); // one short of Germany
    G.powers.GE.flags.powerProjection = 7; // one behind UK
    const hint = opportunityHint(G, "GE", "zh_CN");
    expect(hint?.key).toBe("flashpointOpportunity");
  });

  test("with no flashpoint in reach it falls through to the projection", () => {
    const G = fresh();
    G.powers.FR.flags.powerProjection = 7;
    const hint = opportunityHint(G, "FR", "zh_CN");
    expect(hint?.key).toBe("projectionOpportunity");
  });

  test("nothing in reach prints no line", () => {
    const G = fresh();
    expect(opportunityHint(G, "GE", "zh_CN")).toBeNull();
  });
});

test("the reward text is the chart's, in both languages", () => {
  expect(flashpointReward("germany", "en")).toBe("+1 card");
  expect(flashpointReward("lowCountries", "zh_CN")).toBe("+½ 张牌");
  expect(flashpointReward("powerProjection", "en")).toBe("+1 Industrialization DRM");
});
