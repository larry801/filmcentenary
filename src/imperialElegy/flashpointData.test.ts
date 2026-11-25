/**
 * The printed Flashpoint Summary, as data.
 *
 * The map chart (`public/imperial-elegy/charts/map-flashpoints.png`, also
 * transcribed in `components/referenceCharts/mapFlashpoints.ts`) prints one
 * domination condition and one reward per flashpoint.  The engine had inherited
 * a different set of thresholds, and two of them (Germany 6, the Low Countries
 * 3) could never be reached: Germany carried five tagged spaces and the Low
 * Countries two.  These tests pin the chart's own numbers, the member counts
 * that make them reachable, the keys-versus-spaces wording, and the card
 * bonuses the summary prints.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {SPACES} from "./constant/spaces";
import {FLASHPOINTS} from "./constant/powers";
import {cardsToDraw, flashpointController, flashpointCounts, flashpointMemberCount} from "./engine/rules";

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

describe("the printed Flashpoint Summary", () => {
  test("every row prints the chart's threshold and card bonus", () => {
    expect(Object.fromEntries(Object.entries(FLASHPOINTS).map(([id, def]) => [id, {keys: def.keys, cardBonus: def.cardBonus, unit: def.unit ?? "keys"}])))
      .toEqual({
        lowCountries: {keys: 2, cardBonus: 0.5, unit: "keys"},
        germany: {keys: 8, cardBonus: 1, unit: "keys"},
        italy: {keys: 4, cardBonus: 1, unit: "keys"},
        balkans: {keys: 1, cardBonus: 0.5, unit: "keys"},
        centralEurope: {keys: 3, cardBonus: 0.5, unit: "keys"},
        africa: {keys: 5, cardBonus: 1, unit: "keys"},
        greatGame: {keys: 3, cardBonus: 0.5, unit: "keys"},
        chinaJapan: {keys: 3, cardBonus: 1, unit: "keys"},
        caucasus: {keys: 5, cardBonus: 0.5, unit: "spaces"},
        powerProjection: {keys: 0, cardBonus: 0, unit: "keys"},
        suez: {keys: 1, cardBonus: 0.5, unit: "keys"},
      });
  });

  test("every regional threshold is reachable on the map", () => {
    const G = fresh();
    for (const [id, def] of Object.entries(FLASHPOINTS)) {
      if (id === "powerProjection" || id === "suez") continue;
      const members = flashpointMemberCount(G, id);
      expect({id, enough: members >= def.keys}).toEqual({id, enough: true});
    }
  });
});

describe("Germany is the nine German keys, so its printed eight is reachable", () => {
  test("the campaign starts with five of them and no domination", () => {
    const G = fresh();
    expect(flashpointMemberCount(G, "germany")).toBe(9);
    expect(germanKeys().sort()).toEqual([
      "bavaria", "berlin", "hanover", "pomerania", "prussia",
      "saxony", "schleswig-holstein", "silesia", "westphalia",
    ].sort());
    expect(flashpointCounts(G, "germany").get("GE")).toBe(5);
    expect(flashpointController(G, "germany")).toEqual([]);
  });

  test("eight keys dominate; seven do not", () => {
    const G = fresh();
    give(G, "GE", ["hanover", "saxony"]);
    expect(flashpointCounts(G, "germany").get("GE")).toBe(7);
    expect(flashpointController(G, "germany")).toEqual([]);

    give(G, "GE", ["bavaria"]);
    expect(flashpointCounts(G, "germany").get("GE")).toBe(8);
    expect(flashpointController(G, "germany")).toEqual(["GE"]);
  });

  test("the chart's +1 card applies once Germany is dominated", () => {
    const G = fresh();
    const before = cardsToDraw(G, "GE");
    give(G, "GE", ["hanover", "saxony", "bavaria"]);
    expect(cardsToDraw(G, "GE")).toBe(before + 1);
  });
});

describe("the Caucasus is the chart's spaces-based region", () => {
  test("seven spaces, five to dominate", () => {
    const G = fresh();
    expect(flashpointMemberCount(G, "caucasus")).toBe(7);
    // RU starts with the five Russian Caucasus spaces, so the chart's five
    // spaces already dominate at setup.
    expect(flashpointCounts(G, "caucasus").get("RU")).toBe(5);
    expect(flashpointController(G, "caucasus")).toEqual(["RU"]);
  });

  test("territories count here, unlike the key-based rows", () => {
    const G = fresh();
    // Georgia, Dagestan, Azerbaijan, Baku and the Caucasus are territories;
    // taking them is enough because the chart says spaces, not keys.
    const russian = Object.values(SPACES).filter((space) => space.flashpoints?.includes("caucasus") && space.home === "RU");
    expect(russian.every((space) => space.keyType === undefined && space.type === "territory")).toBe(true);
    for (const space of russian) G.spaces[space.id].control = null;
    expect(flashpointController(G, "caucasus")).toEqual([]);
    give(G, "OT", russian.slice(0, 5).map((space) => space.id));
    expect(flashpointController(G, "caucasus")).toEqual(["OT"]);
  });
});

describe("key-based rows ignore non-key spaces", () => {
  test("Africa counts its fifteen keys, not the two territories", () => {
    const G = fresh();
    expect(flashpointMemberCount(G, "africa")).toBe(15);
    const territories = ["algeria", "west-africa"];
    give(G, "GE", territories);
    expect(flashpointCounts(G, "africa").get("GE")).toBe(0);
    give(G, "GE", ["egypt"]);
    expect(flashpointCounts(G, "africa").get("GE")).toBe(1);
  });
});

describe("the chart's card bonuses replace the old half-per-domination shortcut", () => {
  test("Balkans sits at the chart's one-key minimum", () => {
    const G = fresh();
    for (const space of Object.values(SPACES).filter((def) => def.flashpoints?.includes("balkans"))) {
      G.spaces[space.id].control = null;
    }
    const before = cardsToDraw(G, "GE");
    give(G, "GE", ["serbia"]);
    expect(flashpointController(G, "balkans")).toEqual(["GE"]);
    // +½ rounds up, matching the old lone-half behaviour.
    expect(cardsToDraw(G, "GE")).toBe(before + 1);
  });

  test("two printed +1 theatres add two cards", () => {
    const G = fresh();
    const before = cardsToDraw(G, "GE");
    give(G, "GE", ["hanover", "saxony", "bavaria"]);
    give(G, "GE", ["shanghai", "guangzhou", "korea"]);
    expect(flashpointController(G, "germany")).toEqual(["GE"]);
    expect(flashpointController(G, "chinaJapan")).toEqual(["GE"]);
    expect(cardsToDraw(G, "GE")).toBe(before + 2);
  });

  test("a +1 and a +½ theatre add two cards after rounding up", () => {
    const G = fresh();
    const before = cardsToDraw(G, "GE");
    give(G, "GE", ["hanover", "saxony", "bavaria"]);
    for (const space of Object.values(SPACES).filter((def) => def.flashpoints?.includes("balkans"))) {
      G.spaces[space.id].control = null;
    }
    give(G, "GE", ["serbia"]);
    expect(cardsToDraw(G, "GE")).toBe(before + 2);
  });

  test("power projection domination is a DRM, never a card", () => {
    const G = fresh();
    const before = cardsToDraw(G, "UK");
    // The campaign starts with UK on 8 projection and dominating the track.
    expect(flashpointController(G, "powerProjection")).toContain("UK");
    expect(cardsToDraw(G, "UK")).toBe(before);
  });
});

test("every power's counts sum to the members in play", () => {
  const G = fresh();
  for (const id of Object.keys(FLASHPOINTS)) {
    if (id === "powerProjection" || id === "suez") continue;
    const counts = flashpointCounts(G, id);
    const total = POWERS.reduce((sum, power) => sum + (counts.get(power) ?? 0), 0);
    expect({id, nonNegative: [...counts.values()].every((n) => n >= 0)}).toEqual({id, nonNegative: true});
    expect(total).toBeLessThanOrEqual(flashpointMemberCount(G, id));
  }
});
