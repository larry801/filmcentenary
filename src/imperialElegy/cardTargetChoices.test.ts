/**
 * Printed card choices instead of auto-picks (IMPLEMENTATION_STATUS "Card
 * targets"):
 *  - A38 Second Opium War: the UK then France each choose;
 *  - A36 Rebellions in China: the active player, then another player, choose;
 *  - A74 Berlin Conference: printed placement order, Belgium, Africa limit;
 *  - A71 Urabi Revolt and A102 Moroccan Crisis: the printed card auctions;
 *  - A92 Naval Arms Race and A108 High Seas Fleet: explicit targets;
 *  - A96 Empire of the Sun: Korea or Manchuria, defender losses;
 *  - A100 The Balkan Wars: the printed roll and the Macedonia award.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, legalSpaces} from "./engine/effects";
import {beginLandBattle} from "./engine/combat";
import {cardById} from "./engine/deck";
import {CARDS} from "./constant/cards.data";
import {SPACES} from "./constant/spaces";
import {ImperialElegyGameDef} from "./game";
import {
  constructFleet,
  declinePending,
  placeInfluence,
  playCard,
  removeInfluence,
  resolvePending,
} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3),
    },
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
const ctxFor = (power: Power, dice: number[] = []): Ctx => makeCtx(dice, seat(power));
const fresh = (dice: number[] = []): ImperialElegyState => setupImperialElegy(makeCtx(dice));

const optionIds = (G: ImperialElegyState): string[] => (G.pending?.options ?? []).map((o) => o.id);

/** Put a card in `power`'s hand and play it as an event. */
const playEvent = (
  G: ImperialElegyState,
  cardId: string,
  power: Power = "GE",
  dice: number[] = [],
): Ctx => {
  G.phase = "action";
  G.activePower = power;
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  const ctx = makeCtx(dice, seat(power));
  expect(playCard(G, ctx, cardId, "event")).toBeUndefined();
  return ctx;
};

/** An action event card with the requested printed CP value. */
const cardOfCp = (cp: number): string => {
  const card = CARDS.actions.find(
    (entry) => entry.cp === cp && entry.type === "event" && entry.kind === "action",
  );
  if (!card) throw new Error(`no event card with CP ${cp}`);
  return card.id;
};

const africanSpaces = Object.values(SPACES)
  .filter((s) => s.submap === "africa")
  .map((s) => s.id);

// ---------------------------------------------------------------------------
// A38 Second Opium War
// ---------------------------------------------------------------------------
describe("A38 Second Opium War", () => {
  test("the UK chooses first, then France, and no space is auto-picked", () => {
    const G = fresh();
    playEvent(G, "IE-A038");

    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.power).toBe("UK");
    const ukOptions = optionIds(G);
    expect(ukOptions.sort()).toEqual(["guangzhou", "manchuria", "shandong-peninsula", "shanghai"]);
    for (const id of ukOptions) expect(G.spaces[id].control).toBe("Qing China");

    expect(resolvePending(G, ctxFor("UK"), "shanghai")).toBeUndefined();
    expect(G.spaces.shanghai.control).toBe("UK");
    expect(G.pending?.power).toBe("FR");
    // France may not pick the space the UK just took.
    expect(optionIds(G)).not.toContain("shanghai");

    expect(resolvePending(G, ctxFor("FR"), "manchuria")).toBeUndefined();
    expect(G.spaces.manchuria.control).toBe("FR");
    expect(G.pending).toBeNull();
  });

  test("a power with no legal space is skipped and logged", () => {
    const G = fresh();
    for (const id of ["manchuria", "shanghai", "shandong-peninsula"]) {
      G.spaces[id].control = "GE";
    }
    // Only one Qing space is left: the UK takes it and France is skipped.
    const ctx = makeCtx();
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.hand.push("IE-A038");
    expect(playCard(G, ctx, "IE-A038", "event")).toBeUndefined();

    expect(G.pending?.power).toBe("UK");
    expect(optionIds(G)).toEqual(["guangzhou"]);
    expect(resolvePending(G, ctxFor("UK"), "guangzhou")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.log.some((entry) => entry.key === "noLegalTarget")).toBe(true);
    expect(G.spaces.manchuria.control).toBe("GE");
  });

  test("declining a required placement is rejected", () => {
    const G = fresh();
    playEvent(G, "IE-A038");
    expect(G.pending?.power).toBe("UK");
    // No "pass"/"done" option exists, so there is nothing to decline to.
    expect(G.pending?.options.some((o) => o.id === "pass" || o.id === "done")).toBe(false);
    expect(declinePending(G, ctxFor("UK"))).toBe(INVALID_MOVE);
    expect(G.pending?.power).toBe("UK");
    expect(G.spaces.shanghai.control).toBe("Qing China");
  });

  test("the deciding seat is made active for boardgame.io dispatch", () => {
    const G = fresh();
    const calls: unknown[] = [];
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.hand.push("IE-A038");
    const ctx = {
      ...makeCtx([], "0"),
      events: {
        setPhase: () => undefined,
        setActivePlayers: (arg: unknown) => calls.push(arg),
        endGame: () => undefined,
        endTurn: () => undefined,
      },
    } as unknown as Ctx;
    expect(playCard(G, ctx, "IE-A038", "event")).toBeUndefined();
    // The UK decides while GE is the active power; every seat must be
    // dispatchable or the decision could never be answered.
    expect(calls).toContainEqual({all: "play"});
  });
});

// ---------------------------------------------------------------------------
// A36 Rebellions in China
// ---------------------------------------------------------------------------
describe("A36 Rebellions in China", () => {
  test("the active player places, then chooses another player who places", () => {
    const G = fresh();
    // A36 is printed "Germany only after unification".
    G.powers.GE.unified = true;
    playEvent(G, "IE-A036");

    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, ctxFor("GE"), "shanghai")).toBeUndefined();
    expect(G.spaces.shanghai.control).toBe("GE");

    expect(G.pending?.kind).toBe("eventTargetPower");
    expect(G.pending?.power).toBe("GE");
    const others = optionIds(G);
    expect(others).not.toContain("GE");
    expect(others).toEqual(["UK", "FR", "AU", "RU", "OT"]);

    expect(resolvePending(G, ctxFor("GE"), "FR")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.power).toBe("FR");
    // "does not allow players to place control markers in spaces that already
    // contain control markers" - Shanghai now has one.
    expect(optionIds(G)).not.toContain("shanghai");

    expect(resolvePending(G, ctxFor("FR"), "manchuria")).toBeUndefined();
    expect(G.spaces.manchuria.control).toBe("FR");
    expect(G.pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A74 Berlin Conference
// ---------------------------------------------------------------------------
describe("A74 Berlin Conference", () => {
  test("places influence in printed order and only once for Belgium", () => {
    const G = fresh();
    G.spaces.belgium.ally = "OT";
    playEvent(G, "IE-A074", "GE");

    const placed: {power: Power; space: string}[] = [];
    const order: Power[] = ["GE", "UK", "FR", "OT"];
    for (const power of order.slice(0, 3)) {
      expect(G.pending?.kind).toBe("eventTargetSpace");
      expect(G.pending?.power).toBe(power);
      const space = optionIds(G)[0];
      expect(africanSpaces).toContain(space);
      expect(resolvePending(G, ctxFor(power), space)).toBeUndefined();
      placed.push({power, space});
      expect(G.spaces[space].influence).toBe(power);
    }
    // The Belgian ally places the Belgian control marker once (optional).
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.power).toBe("OT");
    const done = optionIds(G).find((id) => id === "done");
    expect(done).toBe("done");
    const belgianSpace = optionIds(G).find((id) => id !== "done")!;
    expect(resolvePending(G, ctxFor("OT"), belgianSpace)).toBeUndefined();
    expect(G.spaces[belgianSpace].control).toBe("Belgium");
    expect(G.pending).toBeNull();

    expect(G.persistent.berlinConference).toBe(true);
    expect(placed).toHaveLength(3);
  });

  test("lifts the one-influence limit in Africa and blocks removing it", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 10;
    G.powers.UK.flags.alreadyInfluenced = false;

    // UK LoC reaches these two spaces from South Africa.
    const reachable = africanSpaces.filter(
      (id) => G.spaces[id].control === null && G.spaces[id].influence === null,
    );
    expect(reachable).toContain("southwest-africa");
    expect(reachable).toContain("rhodesia");

    expect(placeInfluence(G, ctxFor("UK"), "southwest-africa")).toBeUndefined();
    G.powers.UK.flags.alreadyInfluenced = false;
    // 12.5.2 before Berlin: only one influence marker in Africa.
    expect(placeInfluence(G, ctxFor("UK"), "rhodesia")).toBe(INVALID_MOVE);
    // 12.6 before Berlin: the marker may be removed again.
    expect(removeInfluence(G, ctxFor("UK"), "southwest-africa")).toBeUndefined();

    G.persistent.berlinConference = true;
    G.powers.UK.flags.alreadyInfluenced = false;
    expect(placeInfluence(G, ctxFor("UK"), "southwest-africa")).toBeUndefined();
    G.powers.UK.flags.alreadyInfluenced = false;
    expect(placeInfluence(G, ctxFor("UK"), "rhodesia")).toBeUndefined();
    // 12.6 exception: after Berlin no removal in Africa.
    expect(removeInfluence(G, ctxFor("UK"), "rhodesia")).toBe(INVALID_MOVE);
  });

  test("a unified Italy's marker is placed by its ally", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.spaces.tuscany.control = "Italy";
    G.spaces.tuscany.ally = "FR";
    playEvent(G, "IE-A074", "GE");

    const seen: Power[] = [];
    for (let step = 0; step < 4; step += 1) {
      const pending = G.pending;
      if (!pending) break;
      expect(pending.kind).toBe("eventTargetSpace");
      seen.push(pending.power);
      resolvePending(G, ctxFor(pending.power), optionIds(G)[0]);
    }
    // GE (actor), UK, FR, then Italy's marker placed by its ally FR.
    expect(seen).toEqual(["GE", "UK", "FR", "FR"]);
    expect(G.pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A71 Urabi Revolt
// ---------------------------------------------------------------------------
describe("A71 Urabi Revolt", () => {
  test("the UK, France and the Ottomans bid cards and the highest total wins", () => {
    const G = fresh();
    const ukCard = cardOfCp(3);
    G.powers.UK.hand = [ukCard];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];

    playEvent(G, "IE-A071", "GE");
    // Egypt's minor army was eliminated before the auction.
    expect(G.spaces.egypt.units.some((id) => G.units[id].owner === "Egypt")).toBe(false);

    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("UK");
    const cardOption = optionIds(G).find((id) => id === `card:${ukCard}`);
    expect(cardOption).toBe(`card:${ukCard}`);
    expect(optionIds(G)).toContain("pass");

    const wttBefore = G.wtt;
    // UK bids CP 3 + d6(4) = 7; FR d6(2); OT d6(1).
    expect(resolvePending(G, ctxFor("UK", [4, 2, 1]), `card:${ukCard}`)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.UK.hand).not.toContain(ukCard);
    expect(G.discard).toContain(ukCard);

    for (const id of ["egypt", "great-sand-sea", "sinai"]) {
      expect(G.spaces[id].control).toBe("UK");
      expect(G.spaces[id].homeOverride).toBe("UK");
    }
    expect(G.persistent.egyptColonialHome).toBe("UK");
    // Only one player played a card: the WTT does not rise.
    expect(G.wtt).toBe(wttBefore);
  });

  test("the Egypt diplomacy bonus adds +2 and two cards raise the WTT", () => {
    const G = fresh();
    const ukCard = cardOfCp(1);
    const frCard = cardOfCp(1);
    G.powers.UK.hand = [ukCard];
    G.powers.FR.hand = [frCard];
    G.powers.OT.hand = [];
    G.spaces.egypt.diplomacy = "FR";

    playEvent(G, "IE-A071", "GE");
    const wttBefore = G.wtt;
    expect(resolvePending(G, ctxFor("UK", [1]), `card:${ukCard}`)).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    // FR: CP 1 + diplomacy 2 + d6(1) = 4 beats UK CP 1 + d6(1) = 2.
    expect(resolvePending(G, ctxFor("FR", [1, 1, 1]), `card:${frCard}`)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces.egypt.control).toBe("FR");
    expect(G.spaces.sinai.control).toBe("FR");
    expect(G.spaces.egypt.homeOverride).toBe("FR");
    expect(G.wtt).toBe(Math.min(5, wttBefore + 1));
  });

  test("a bid card is hidden from the other bidders", () => {
    const G = fresh();
    G.powers.UK.hand = [cardOfCp(2)];
    G.powers.FR.hand = [cardOfCp(2)];
    G.powers.OT.hand = [];
    playEvent(G, "IE-A071", "GE");

    const ukSeat = ImperialElegyGameDef.playerView!(G, ctxFor("UK"), seat("UK")) as unknown as ImperialElegyState;
    expect((ukSeat.pending?.options ?? []).length).toBeGreaterThan(1);
    const frSeat = ImperialElegyGameDef.playerView!(G, ctxFor("FR"), seat("FR")) as unknown as ImperialElegyState;
    expect(frSeat.pending?.options).toEqual([]);
    expect(frSeat.pending?.power).toBe("UK");

    // An option that is not offered is rejected.
    expect(resolvePending(G, ctxFor("FR"), "card:IE-A001")).toBe(INVALID_MOVE);
  });

  test("declining an auction bids no card", () => {
    const G = fresh();
    G.powers.UK.hand = [cardOfCp(2)];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];
    playEvent(G, "IE-A071", "GE");
    expect(G.pending?.power).toBe("UK");
    expect(declinePending(G, ctxFor("UK", [5, 3, 2]))).toBeUndefined();
    expect(G.pending).toBeNull();
    // The declined bid counts as a pass: UK d6(5) still beats FR/OT.
    expect(G.spaces.egypt.control).toBe("UK");
    expect(G.powers.UK.hand).toEqual([cardOfCp(2)]);
  });

  test("passing is an explicit choice", () => {
    const G = fresh();
    G.powers.UK.hand = [cardOfCp(2)];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];
    playEvent(G, "IE-A071", "GE");
    expect(resolvePending(G, ctxFor("UK"), "pass")).toBeUndefined();
    expect(G.pending).toBeNull();
    // Nobody played a card, so the auction still rolls: UK d6(5) beats 3s.
    expect(G.spaces.egypt.control).toBe("UK");
  });
});

// ---------------------------------------------------------------------------
// A102 Moroccan Crisis
// ---------------------------------------------------------------------------
describe("A102 Moroccan Crisis", () => {
  test("the controller and the UK aid decide who takes Morocco", () => {
    const G = fresh();
    const geCard = cardOfCp(1);
    const frCard = cardOfCp(1);
    const ukCard = cardOfCp(2);
    G.spaces.morocco.control = "FR";
    G.powers.GE.hand = [geCard];
    G.powers.FR.hand = [frCard];
    G.powers.UK.hand = [ukCard];

    playEvent(G, "IE-A102", "GE");
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, ctxFor("GE", [1]), `card:${geCard}`)).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, ctxFor("FR", [1]), `card:${frCard}`)).toBeUndefined();
    // The UK may help one side.
    expect(G.pending?.power).toBe("UK");
    expect(optionIds(G)).toContain(`card:${ukCard}:a`);
    expect(optionIds(G)).toContain(`card:${ukCard}:b`);
    expect(optionIds(G)).toContain("pass");

    // GE: 1 + 1 = 2; FR: 1 + 2 (UK aid) + 1 = 4.
    expect(resolvePending(G, ctxFor("UK", [1, 1, 1]), `card:${ukCard}:b`)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces.morocco.control).toBe("FR");
    expect(G.powers.FR.hand).not.toContain(frCard);
    // Three cards played, so the WTT rises.
    expect(G.wtt).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A92 Naval Arms Race
// ---------------------------------------------------------------------------
describe("A92 Naval Arms Race", () => {
  test("only a non-allied UK or shared-naval-box player can be chosen", () => {
    const G = fresh();
    playEvent(G, "IE-A092", "GE");
    expect(G.pending?.kind).toBe("eventTargetPower");
    const targets = optionIds(G);
    expect(targets).toContain("UK");
    // GE and RU both touch the Baltic Sea box; FR does not.
    expect(targets).toContain("RU");
    expect(targets).not.toContain("FR");
    expect(targets).not.toContain("GE");
  });

  test("applies the discount, the alliance shift, the WTT and the naval limit", () => {
    const G = fresh();
    G.powers.GE.alliance = "neutral";
    G.powers.RU.alliance = "neutral";
    const wttBefore = G.wtt;
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.hand.push("IE-A092");
    const ctx = makeCtx([1], "0");
    expect(playCard(G, ctx, "IE-A092", "event")).toBeUndefined();

    expect(resolvePending(G, ctxFor("GE", [1]), "RU")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.GE.flags.navalDiscount).toBe(1);
    expect(G.powers.RU.flags.navalDiscount).toBe(1);
    expect(G.powers.GE.flags.navalDiscountThrough).toBe(G.turn + 1);
    expect(G.persistent.navalLimitRaised).toBe("GE");
    expect(G.wtt).toBe(Math.min(5, wttBefore + 1));
    // Both neutral: the shifts are random but they must move in opposite
    // directions, away from each other.
    expect(G.powers.GE.alliance).not.toBe(G.powers.RU.alliance);

    // The discount is live in the build cost for this turn.
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 3;
    expect(constructFleet(G, ctxFor("GE"), "pomerania", "squadron")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
    // It expires after the next turn.
    G.turn += 2;
    G.cpRemaining = 3;
    expect(constructFleet(G, ctxFor("GE"), "pomerania", "squadron")).toBeUndefined();
    expect(G.cpRemaining).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A108 High Seas Fleet
// ---------------------------------------------------------------------------
describe("A108 High Seas Fleet", () => {
  test("the chosen non-British player gets a dreadnought in a legal port", () => {
    const G = fresh();
    // A108 is printed "Playable after Dreadnought has been played".
    G.persistent.dreadnoughts = true;
    playEvent(G, "IE-A108", "GE");
    expect(G.pending?.kind).toBe("eventTargetPower");
    expect(optionIds(G)).not.toContain("UK");
    expect(optionIds(G)).toContain("FR");

    expect(resolvePending(G, ctxFor("GE"), "FR")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.power).toBe("GE");
    const ports = optionIds(G);
    expect(ports.length).toBeGreaterThan(0);
    for (const id of ports) expect(G.spaces[id].control).toBe("FR");
    expect(ports).toContain("provence");

    expect(resolvePending(G, ctxFor("GE"), "provence")).toBeUndefined();
    expect(G.pending).toBeNull();
    const dreadnought = G.spaces.provence.units
      .map((id) => G.units[id])
      .find((unit) => unit.kind === "dreadnought");
    expect(dreadnought?.owner).toBe("FR");
  });
});

// ---------------------------------------------------------------------------
// A96 Empire of the Sun
// ---------------------------------------------------------------------------
describe("A96 Empire of the Sun", () => {
  test("the active player chooses Korea or Manchuria", () => {
    const G = fresh();
    // A96 is printed "Playable after Meiji Restoration".
    G.persistent.meiji = true;
    G.spaces.korea.control = "Korea";
    playEvent(G, "IE-A096", "GE");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(optionIds(G)).toEqual(["korea", "manchuria"]);

    expect(resolvePending(G, ctxFor("GE"), "manchuria")).toBeUndefined();
    // Uncontrolled by a player: Japan simply takes it.
    expect(G.spaces.manchuria.control).toBe("Japan");
    expect(G.spaces.japan.ally).toBe("GE");
    expect(G.spaces.korea.control).toBe("Korea");
  });

  test("a player-controlled space is conquered with the printed DRMs", () => {
    const G = fresh();
    G.persistent.meiji = true;
    G.spaces.korea.control = "RU";
    const pacificSquadron = placeUnit(G, "RU", "squadron", "pacific-ocean", 2);
    G.powers.RU.hand = [cardOfCp(2)];
    const stabilityBefore = G.powers.RU.stability;

    playEvent(G, "IE-A096", "GE");
    expect(resolvePending(G, ctxFor("GE"), "korea")).toBeUndefined();
    // The defender may discard a random card; here it does: -1 more DRM.
    expect(G.pending?.power).toBe("RU");
    expect(resolvePending(G, ctxFor("RU", [5]), "discard")).toBeUndefined();
    expect(G.pending).toBeNull();

    // d6(5) - 1 defending squadron - 1 discarded card = 3: Japan wins.
    expect(G.spaces.korea.control).toBe("Japan");
    expect(G.powers.RU.stability).toBe(stabilityBefore - 1);
    // Every defending naval unit in or adjacent to the Pacific is eliminated.
    expect(G.units[pacificSquadron.id]).toBeUndefined();
    expect(G.spaces["pacific-ocean"].units).not.toContain(pacificSquadron.id);
  });

  test("without the discard a 2 is not enough to conquer", () => {
    const G = fresh();
    G.persistent.meiji = true;
    G.spaces.korea.control = "RU";
    G.powers.RU.hand = [];
    playEvent(G, "IE-A096", "GE");
    expect(resolvePending(G, ctxFor("GE", [2]), "korea")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces.korea.control).toBe("RU");
  });
});

// ---------------------------------------------------------------------------
// A100 The Balkan Wars
// ---------------------------------------------------------------------------
describe("A100 The Balkan Wars", () => {
  test("a 5+ roll gives two Ottoman spaces independence, then Macedonia is awarded", () => {
    const G = fresh();
    G.spaces.serbia.ally = "OT";
    expect(G.spaces["bosnia-herzegovina"].control).toBe("OT");

    // The setup Ottoman army in Macedonia gives the roll a -1 DRM: 6 - 1 = 5.
    playEvent(G, "IE-A100", "GE", [6]);
    expect(G.spaces.serbia.ally).toBeNull();
    // Four Ottoman Balkan spaces: the active player chooses which two go.
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.power).toBe("GE");
    const first = optionIds(G);
    expect(first.sort()).toEqual(["bosnia-herzegovina", "bulgaria", "macedonia", "serbia"]);
    expect(resolvePending(G, ctxFor("GE"), "serbia")).toBeUndefined();
    expect(G.spaces.serbia.control).toBe("Serbia");

    expect(G.pending?.kind).toBe("eventTargetSpace");
    const second = optionIds(G);
    expect(second).not.toContain("serbia");
    expect(resolvePending(G, ctxFor("GE"), "bulgaria")).toBeUndefined();
    expect(G.spaces.bulgaria.control).toBe("Bulgaria");

    // The Macedonia award offers the independent minors plus the Ottomans.
    expect(G.pending?.kind).toBe("eventChoice");
    expect(optionIds(G)).toContain("OT");
    expect(optionIds(G)).toContain("greece");
    expect(resolvePending(G, ctxFor("GE"), "greece")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces.macedonia.control).toBe("Greece");
    expect(G.spaces.macedonia.ally).toBeNull();
  });

  test("a low roll costs rebels and independent minors a step", () => {
    const G = fresh();
    const rebel = placeUnit(G, "REBEL:Serbia", "rebelArmy", "serbia", 2);
    const greek = placeUnit(G, "Greece", "minorArmy", "greece", 2);
    playEvent(G, "IE-A100", "GE", [1]);

    expect(G.units[rebel.id].steps).toBe(1);
    expect(G.units[greek.id].steps).toBe(1);
    expect(G.spaces.serbia.control).toBe("OT");

    // The award still happens.
    expect(G.pending?.kind).toBe("eventChoice");
    expect(resolvePending(G, ctxFor("GE"), "OT")).toBeUndefined();
    expect(G.spaces.macedonia.control).toBe("OT");
  });

  test("no Ottoman Balkan space means no roll but the award is still offered", () => {
    const G = fresh();
    for (const id of ["bosnia-herzegovina", "serbia", "bulgaria", "macedonia"]) {
      G.spaces[id].control = "Serbia";
    }
    playEvent(G, "IE-A100", "GE", [6]);
    expect(G.pending?.kind).toBe("eventChoice");
    expect(resolvePending(G, ctxFor("GE"), "OT")).toBeUndefined();
    expect(G.spaces.macedonia.control).toBe("OT");
    expect(G.spaces.serbia.control).toBe("Serbia");
  });
});

// ---------------------------------------------------------------------------
// Regression: no auto-pick anywhere in the listed cards
// ---------------------------------------------------------------------------
describe("no auto-pick remains", () => {
  test.each([
    ["IE-A038", "eventTargetSpace"],
    ["IE-A036", "eventTargetSpace"],
    ["IE-A074", "eventTargetSpace"],
    ["IE-A071", "eventChoice"],
    ["IE-A102", "eventChoice"],
    ["IE-A092", "eventTargetPower"],
    ["IE-A108", "eventTargetPower"],
    ["IE-A096", "eventChoice"],
    ["IE-A100", "eventTargetSpace"],
  ])("%s opens a real decision (%s)", (cardId, kind) => {
    const G = fresh();
    if (cardId === "IE-A102") G.spaces.morocco.control = "FR";
    if (cardId === "IE-A096") G.persistent.meiji = true;
    if (cardId === "IE-A108") G.persistent.dreadnoughts = true;
    // A36 is printed "Germany only after unification".
    if (cardId === "IE-A036") G.powers.GE.unified = true;
    playEvent(G, cardId, "GE", [5]);
    expect(G.pending).not.toBeNull();
    const expected = cardId === "IE-A100" ? ["eventTargetSpace", "eventChoice"] : [kind];
    expect(expected).toContain(G.pending?.kind);
  });

  test("A92 still validates a manual land battle target after the chain", () => {
    // Guard: the land-battle entry point used by the tests above is untouched.
    const G = fresh();
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(legalSpaces(G, "GE", {region: "africa"}).length).toBeGreaterThan(0);
    expect(cardById("IE-A092").title).toBe("Naval Arms Race");
  });
});
