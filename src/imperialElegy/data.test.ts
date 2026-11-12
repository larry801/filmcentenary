import {ACTION_CARDS, HOME_CARDS, GREAT_WAR_CARDS} from "./constant/cards.data";
import {GOALS, CAMPAIGN_GOALS, GOALS_BY_ID} from "./constant/goals";
import {SPACES, SPACE_IDS, CONNECTIONS, connectionsOf} from "./constant/spaces";
import {CAMPAIGN_SETUP} from "./constant/setup";
import {setupImperialElegy} from "./engine/setup";
import {recomputeTracks} from "./engine/rules";
import {POWERS} from "./types";
import fs from "fs";
import path from "path";

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/imperial-elegy/manifest.json"), "utf8"));

test("action card inventory is 13-112", () => {
  expect(ACTION_CARDS).toHaveLength(100);
  const numbers = ACTION_CARDS.map((c) => c.number!).sort((a, b) => a - b);
  expect(numbers).toEqual(Array.from({length: 100}, (_, i) => i + 13));
  expect(new Set(ACTION_CARDS.map((c) => c.id)).size).toBe(100);
  for (const card of ACTION_CARDS) {
    expect(card.cp).toBeGreaterThanOrEqual(1);
    expect(card.cp).toBeLessThanOrEqual(4);
    expect(card.title.length).toBeGreaterThan(0);
    expect(card.text.length).toBeGreaterThan(0);
  }
});

test("every card has a concrete effect", () => {
  for (const card of [...ACTION_CARDS, ...HOME_CARDS, ...GREAT_WAR_CARDS]) {
    expect(card.effects.length).toBeGreaterThan(0);
    expect(card.effects.some((e) => e.type !== "note")).toBe(true);
    expect(JSON.stringify(card.effects)).not.toContain("unhandledSpecial");
  }
});

test("home cards, GW cards and national goals", () => {
  expect(HOME_CARDS).toHaveLength(12);
  expect(GREAT_WAR_CARDS).toHaveLength(10);
  expect(GOALS).toHaveLength(49);
  expect(CAMPAIGN_GOALS).toHaveLength(48);
  expect(GOALS_BY_ID["NG-22"]).toBeDefined();
  expect(GOALS_BY_ID["NG-22"].title).toBe("Peace in Our Time");
  expect(GOALS_BY_ID["NG-31"].scenarioOnly).toBe(true);
  for (const power of POWERS) {
    expect(CAMPAIGN_GOALS.filter((g) => g.power === power)).toHaveLength(8);
  }
});

test("deck entry decades follow the printed decade bands", () => {
  const byDecade: Record<string, number> = {};
  for (const card of ACTION_CARDS) byDecade[card.entry] = (byDecade[card.entry] ?? 0) + 1;
  expect(byDecade).toEqual({"1850s": 58, "1870s": 11, "1880s": 10, "1890s": 8, "1900s": 13});
  expect(ACTION_CARDS.find((c) => c.number === 82)!.entry).toBe("1880s");
  expect(ACTION_CARDS.find((c) => c.number === 81)!.entry).toBe("1870s");
  expect(ACTION_CARDS.find((c) => c.number === 99)!.entry).toBe("1890s");
  expect(ACTION_CARDS.find((c) => c.number === 100)!.entry).toBe("1900s");
});

test("reconstructed cards", () => {
  const wilhelm = ACTION_CARDS.find((c) => c.number === 82)!;
  expect(wilhelm.cp).toBe(2);
  expect(wilhelm.type).toBe("mandatory");
  expect(wilhelm.entry).toBe("1880s");
  expect(wilhelm.remove).toBeUndefined();
  expect(JSON.stringify(wilhelm.effects)).toContain("IE-H-GE-1");
  expect(JSON.stringify(wilhelm.effects)).toContain("removeThisCard");
  const nationalRailroad = ACTION_CARDS.find((c) => c.number === 21)!;
  expect(nationalRailroad.title).toBe("National Railroad");
  expect(nationalRailroad.correction).toBeTruthy();
});

test("setup quantities match the playbook", () => {
  expect(CAMPAIGN_SETUP.units).toHaveLength(50);
  expect(CAMPAIGN_SETUP.forts).toHaveLength(4);
  expect(CAMPAIGN_SETUP.diplomacy).toHaveLength(3);
  expect(CAMPAIGN_SETUP.influence).toHaveLength(1);
  expect(CAMPAIGN_SETUP.powers.GE.territorialKeys).toBe(5);
  expect(CAMPAIGN_SETUP.powers.FR.territorialKeys).toBe(9);
  expect(CAMPAIGN_SETUP.powers.AU.territorialKeys).toBe(9);
  expect(CAMPAIGN_SETUP.powers.RU.territorialKeys).toBe(12);
  expect(CAMPAIGN_SETUP.powers.UK.territorialKeys).toBe(5);
  expect(CAMPAIGN_SETUP.powers.UK.colonialKeys).toBe(7);
  expect(CAMPAIGN_SETUP.powers.OT.territorialKeys).toBe(8);
  expect(CAMPAIGN_SETUP.powers.OT.arabKeys).toBe(5);
});

test("map data is closed and symmetric", () => {
  expect(SPACE_IDS.length).toBeGreaterThan(100);
  const seen = new Set<string>();
  for (const c of CONNECTIONS) {
    expect(SPACES[c.a]).toBeDefined();
    expect(SPACES[c.b]).toBeDefined();
    const key = [c.a, c.b].sort().join("|");
    expect(seen.has(key)).toBe(false);
    seen.add(key);
    expect(connectionsOf(c.a).some((x) => (x.a === c.a ? x.b : x.a) === c.b)).toBe(true);
    expect(connectionsOf(c.b).some((x) => (x.a === c.b ? x.b : x.a) === c.a)).toBe(true);
  }
  for (const id of SPACE_IDS) {
    expect(SPACES[id].x).toBeGreaterThan(0);
    expect(SPACES[id].y).toBeGreaterThan(0);
  }
  const has = (a: string, b: string) => CONNECTIONS.some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  expect(has("berlin", "saxony")).toBe(true);
  expect(has("paris", "champagne")).toBe(true);
  expect(has("london", "belgium")).toBe(true);
  expect(has("istanbul", "dardanelles")).toBe(true);
  expect(has("egypt", "indian-ocean")).toBe(true);
  expect(has("denmark", "schleswig-holstein")).toBe(true);
});

test("asset manifest references published files", () => {
  expect(manifest.counts.actionCards).toBe(98);
  expect(manifest.counts.homeCards).toBe(12);
  expect(manifest.counts.greatWarCards).toBe(10);
  expect(manifest.counts.goals).toBe(48);
  for (const asset of manifest.assets) {
    expect(fs.existsSync(path.join(__dirname, "../../public/imperial-elegy", asset.published))).toBe(true);
  }
});

test("setup recomputes to the same track totals", () => {
  const ctx: any = {random: {Die: (n: number) => 1}, events: {}};
  const G = setupImperialElegy(ctx);
  const before = Object.fromEntries(POWERS.map((p) => [p, {t: G.powers[p].territorialKeys, c: G.powers[p].colonialKeys, a: G.powers[p].arabKeys}]));
  recomputeTracks(G);
  for (const p of POWERS) {
    expect(G.powers[p].territorialKeys).toBe(before[p].t);
    expect(G.powers[p].colonialKeys).toBe(before[p].c);
    expect(G.powers[p].arabKeys).toBe(before[p].a);
  }
});
