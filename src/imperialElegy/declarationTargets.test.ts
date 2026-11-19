/**
 * The target list the home-card war declarations offer.
 *
 * The four declaration home cards used to require the player to find an enemy
 * space on the map; the target chooser now lists every legal declaration.  This
 * suite pins the list itself: each card's printed target/aim limits, the 13.0
 * World Tension gate, and — most importantly — that every listed candidate is
 * actually accepted by `declareWar`, so the chooser can never offer a move the
 * engine refuses.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, SpaceId} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  AUX_ARMES_HOME_CARD,
  BISMARCK_HOME_CARD,
  JIHAD_HOME_CARD,
  RUSSO_TURKISH_WARS_HOME_CARD,
  warDeclarationEntitlement,
} from "./engine/rules";
import {declarationTargetCandidates, warTargetCandidateKey} from "./engine/declarationTargets";
import {createWarState} from "./engine/limitedWar";
import {SPACES} from "./constant/spaces";
import {declareWar, playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
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

/** The seat's action impulse after its declaration home card resolved. */
const homeImpulse = (power: Power, card: string): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.turn = 5;
  G.powers[power].hand = [card];
  G.powers[power].selectedHomeCard = card;
  playCard(G, makeCtx([], seat(power)), card, "event");
  return G;
};

/** Answer any decision the card's other clauses opened (RU-9's alliance pick). */
const settlePending = (G: ImperialElegyState, power: Power): void => {
  let guard = 0;
  while (G.pending !== null && guard++ < 10) {
    const pending = G.pending;
    resolvePending(G, makeCtx([], seat(pending.power)), pending.options[0]?.id);
  }
};

const candidatesFor = (G: ImperialElegyState, power: Power) =>
  declarationTargetCandidates(G, power, warDeclarationEntitlement(G, power));

const objectivesOf = (G: ImperialElegyState, power: Power): Set<SpaceId> =>
  new Set(candidatesFor(G, power).map((candidate) => candidate.objective));

describe("Bismarck's unification targets", () => {
  test("lists the German-nationality spaces held by another power", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    const candidates = candidatesFor(G, "GE");
    expect(candidates.length).toBeGreaterThan(0);
    // Every candidate is a unification war; Bismarck prints no other aim.
    expect(candidates.every((candidate) => candidate.aim === "unification")).toBe(true);
    const objectives = objectivesOf(G, "GE");
    // FR-held Alsace-Lorraine and Danish Schleswig-Holstein are the historic
    // objectives; the independent German minors are 13.4 targets.
    expect(objectives).toContain("alsace-lorraine");
    expect(objectives).toContain("schleswig-holstein");
    expect(objectives).toContain("bavaria");
    expect(objectives).toContain("saxony");
    expect(objectives).toContain("hanover");
    // German spaces GE already controls are not targets.
    expect(objectives).not.toContain("berlin");
    expect(objectives).not.toContain("westphalia");
    // The chooser names the defender a 13.4 declaration resolves to.
    const alsace = candidates.find((candidate) => candidate.objective === "alsace-lorraine");
    expect(alsace?.target).toBe("FR");
    expect(alsace?.defender).toBe("FR");
    const schleswig = candidates.find((candidate) => candidate.objective === "schleswig-holstein");
    expect(schleswig?.target).toEqual({minor: "Denmark"});
    expect(schleswig?.defender).toBe("Denmark");
  });

  test("every offered candidate is a declaration the engine accepts", () => {
    const base = homeImpulse("GE", BISMARCK_HOME_CARD);
    const candidates = candidatesFor(base, "GE");
    expect(candidates.length).toBeGreaterThan(4);
    for (const candidate of candidates) {
      // Each declaration changes the state (war or a 13.4 aid search), so try
      // it on a fresh copy of the same impulse.
      const G = JSON.parse(JSON.stringify(base)) as ImperialElegyState;
      const result = declareWar(
        G,
        makeCtx([2, 1], seat("GE")),
        candidate.target,
        candidate.aim,
        [candidate.objective],
        3,
      );
      expect({key: warTargetCandidateKey(candidate), result}).toEqual({
        key: warTargetCandidateKey(candidate),
        result: undefined,
      });
      expect(G.war !== null || G.pending !== null).toBe(true);
    }
  });

  test("the 13.0 World Tension gate empties the list", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    G.wtt = 3;
    expect(declarationTargetCandidates(G, "GE", warDeclarationEntitlement(G, "GE"))).toEqual([]);
  });

  test("no entitlement means no candidates", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    expect(declarationTargetCandidates(G, "GE", null)).toEqual([]);
    expect(declarationTargetCandidates(G, "FR", warDeclarationEntitlement(G, "FR"))).toEqual([]);
  });

  test("a player at truce with a power is not offered that power", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    // Rule 13.5: a truce excludes the defender, so its spaces leave the list.
    const truce = createWarState(G, "GE", "FR", "conquest", ["paris"], 1);
    truce.status = "done";
    truce.victor = "attacker";
    truce.truceTurns = 2;
    G.wars = [truce];
    const targets = candidatesFor(G, "GE").map((candidate) => candidate.target);
    expect(targets).not.toContain("FR");
    expect(objectivesOf(G, "GE")).not.toContain("alsace-lorraine");
  });
});

describe("the other declaration home cards", () => {
  test("Aux Armes offers only its printed aims and legal conquest keys", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    settlePending(G, "FR");
    const candidates = candidatesFor(G, "FR");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.aim !== "unification")).toBe(true);
    expect(candidates.some((candidate) => candidate.aim === "conquest")).toBe(true);
    // Conquest never targets a capital or subcapital (13.3).
    for (const candidate of candidates) {
      if (candidate.aim !== "conquest") continue;
      expect(["capital", "subcapital"]).not.toContain(SPACES[candidate.objective].type);
    }
  });

  test("Russo-Turkish Wars may only name the Ottomans", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    settlePending(G, "RU");
    const candidates = candidatesFor(G, "RU");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.target === "OT")).toBe(true);
    expect(candidates.every((candidate) => candidate.defender === "OT")).toBe(true);
    expect(candidates.some((candidate) => candidate.aim === "conquest")).toBe(true);
  });

  test("Jihad may only name Russia or a power holding an Ottoman home space", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    const candidates = candidatesFor(G, "OT");
    expect(candidates.length).toBeGreaterThan(0);
    // At setup Russia holds no Ottoman home space, so RU is the only target.
    expect(candidates.every((candidate) => candidate.target === "RU")).toBe(true);
    expect(candidates.every((candidate) => candidate.aim !== "unification")).toBe(true);
  });

  test("every card's candidates declare", () => {
    const cases: [Power, string][] = [
      ["FR", AUX_ARMES_HOME_CARD],
      ["RU", RUSSO_TURKISH_WARS_HOME_CARD],
      ["OT", JIHAD_HOME_CARD],
    ];
    for (const [power, card] of cases) {
      const base = homeImpulse(power, card);
      settlePending(base, power);
      const candidates = candidatesFor(base, power);
      expect({power, count: candidates.length > 0}).toEqual({power, count: true});
      for (const candidate of candidates) {
        const G = JSON.parse(JSON.stringify(base)) as ImperialElegyState;
        const result = declareWar(G, makeCtx([2, 1], seat(power)), candidate.target, candidate.aim, [candidate.objective], 3);
        expect({power, key: warTargetCandidateKey(candidate), result}).toEqual({
          power,
          key: warTargetCandidateKey(candidate),
          result: undefined,
        });
      }
    }
  });
});
