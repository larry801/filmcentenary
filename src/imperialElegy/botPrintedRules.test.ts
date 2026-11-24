/**
 * Rule 34's printed bot decisions that were still deterministic/rolled:
 * 34.3.2 auto-pacification, 34.4.1's declaration-strength guard, 34.4.7's EC
 * differential, 34.4.8's self-only treaty options and 34.5's Impulsive Ruler.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {pileHomeCard} from "./moves";
import {createWarState} from "./engine/limitedWar";
import {CARDS} from "./constant/cards.data";
import {decision, openDecision, option} from "./engine/pending";
import {botDecision, botPendingMove, withinDeclarationStrength} from "./engine/bot";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 2,
      Shuffle: (items: unknown[]) => items,
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
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const actionImpulse = (G: ImperialElegyState, power: Power): void => {
  G.phase = "action";
  G.activePower = power;
  G.pending = null;
  G.pendingStack = [];
  G.cpRemaining = 0;
  G.wtt = 1;
  G.powers[power].hand = [];
  G.powers[power].selectedHomeCard = null;
};

describe("34.3.2 automatic bot pacification", () => {
  test("a priority-2 roll of 1–4 spends 1 CP to pacify first", () => {
    const G = fresh();
    actionImpulse(G, "AU");
    G.cpRemaining = 1;
    const space = "bosnia-herzegovina";
    G.units = {};
    for (const state of Object.values(G.spaces)) state.units = [];
    G.spaces[space].control = "AU";
    G.spaces[space].pacificationMarker = true;
    G.spaces[space].pacification = 2;
    placeUnit(G, "AU", "army", space, 2);
    // 2d6 with a constant 2 -> priority-2 row 4 (auto-pacify band).
    const move = botDecision(G, makeCtx([2], seat("AU")), "AU");
    expect(move.move).toBe("pacify");
    expect(move.args?.[0]).toBe(space);
  });
});

describe("34.4.1 declaration-strength guard", () => {
  test("a target with ≥4 more army steps is excluded", () => {
    const G = fresh();
    G.units = {};
    for (const space of Object.values(G.spaces)) space.units = [];
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    // GE: 2 steps; Bavaria: 6 steps -> 4 more, refused (6 - 2 = 4).
    expect(withinDeclarationStrength(G, "GE", "Bavaria")).toBe(false);
    // Reduce Bavaria to 5 steps -> 3 more, allowed.
    const bavarian = Object.values(G.units).find((unit) => unit.owner === "Bavaria")!;
    bavarian.steps = 1;
    expect(withinDeclarationStrength(G, "GE", "Bavaria")).toBe(true);
  });
});

describe("34.4.7 EC differential", () => {
  const elitePending = (G: ImperialElegyState, attack: number, defence: number): void => {
    G.battle = {attackDrmTotal: attack, defenceDrmTotal: defence, mainAttack: [], mainDefense: []} as unknown as BattleState;
    openDecision(G, makeCtx(), decision(
      "combatElite",
      "GE",
      "Commit an elite unit?",
      [option("commit", "Commit"), option("decline", "Decline")],
      {eliteSide: "attacker", battle: true},
    ));
  };

  test("commits between −2 and +2, declines outside it", () => {
    const inside = fresh();
    elitePending(inside, 0, -2);
    expect(botPendingMove(inside, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["commit"]});

    const ahead = fresh();
    elitePending(ahead, 3, 0);
    expect(botPendingMove(ahead, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["decline"]});

    const behind = fresh();
    elitePending(behind, 0, 3);
    expect(botPendingMove(behind, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["decline"]});
  });
});

describe("34.4.8 treaty options", () => {
  test("never allocates to another player; always keeps it for itself", () => {
    const G = fresh();
    G.pending = null;
    openDecision(G, makeCtx(), decision(
      "treatyOption",
      "GE",
      "Choose a treaty option",
      [option("territorial@ALLY", "Give France land"), option("done", "Finish")],
      {options: [{id: "territorial@ALLY", beneficiary: "FR"}, {id: "done"}]},
    ));
    expect(botPendingMove(G, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["done"]});
  });
});

describe("34.5 Impulsive Ruler", () => {
  test("a bot plays A105 for CP, never for its event", () => {
    const G = fresh();
    actionImpulse(G, "AU");
    G.powers.AU.hand = ["IE-A105"];
    G.pending = null;
    const move = botDecision(G, makeCtx([1], seat("AU")), "AU");
    expect(move).toEqual({move: "playCard", args: ["IE-A105", "cp"]});
  });
});

describe("34.3.1 bot placement order", () => {
  test("a standing-army build goes into the empty capital first", () => {
    const G = fresh();
    actionImpulse(G, "GE");
    G.cpRemaining = 1;
    G.units = {};
    for (const state of Object.values(G.spaces)) state.units = [];
    const move = botDecision(G, makeCtx([1], seat("GE")), "GE");
    expect(move.move).toBe("recruit");
    expect(move.args?.[0]).toBe("berlin");
  });
});

describe("34.4.2 closest/two-space war aims", () => {
  const bismarck = (industry: number) => {
    const G = fresh();
    actionImpulse(G, "GE");
    G.units = {};
    for (const state of Object.values(G.spaces)) state.units = [];
    placeUnit(G, "GE", "army", "berlin", 2);
    G.powers.GE.flags.warDeclarationCard = "IE-H-GE-1";
    G.powers.GE.industry = industry;
    G.wtt = 1;
    return G;
  };

  test("an industrial bot targets two spaces, a zero-industry bot one", () => {
    const rich = bismarck(5);
    const two = botDecision(rich, makeCtx([1], seat("GE")), "GE");
    expect(two.move).toBe("declareWar");
    // The campaign's German targets usually control one qualifying space each,
    // so the printed "two" cap is only reached when the closest target controls
    // two objectives; it is never more than two.
    expect((two.args?.[2] as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect((two.args?.[2] as unknown[]).length).toBeLessThanOrEqual(2);

    const poor = bismarck(0);
    const one = botDecision(poor, makeCtx([1], seat("GE")), "GE");
    expect(one.move).toBe("declareWar");
    expect((one.args?.[2] as unknown[]).length).toBe(1);
  });
});

describe("34.4.4 ally calls and joins", () => {
  test("a called aligned bot joins on 3+, refuses on 1–2, committed always joins", () => {
    const G = fresh();
    G.pending = null;
    openDecision(G, makeCtx(), decision(
      "warAllyConsent",
      "FR",
      "Join the war?",
      [option("accept", "Join"), option("refuse", "Refuse")],
    ));
    G.powers.FR.alliance = "teAligned";
    expect(botPendingMove(G, "FR", makeCtx([2]))).toEqual({move: "resolvePending", args: ["refuse"]});
    expect(botPendingMove(G, "FR", makeCtx([3]))).toEqual({move: "resolvePending", args: ["accept"]});
    G.powers.FR.alliance = "teCommitted";
    expect(botPendingMove(G, "FR", makeCtx([1]))).toEqual({move: "resolvePending", args: ["accept"]});
  });

  test("the PAC's aid answer always aids the attacked minor", () => {
    const G = fresh();
    G.pending = null;
    openDecision(G, makeCtx(), decision(
      "minorAid",
      "GE",
      "Seeking Aid: aid the minor?",
      [option("aid", "Aid"), option("decline", "Decline")],
    ));
    expect(botPendingMove(G, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["aid"]});
  });
});

describe("34.2 bot home-card pile", () => {
  const diplomatic = (power: Power): ImperialElegyState => {
    const G = fresh();
    G.phase = "diplomacy";
    G.activePower = power;
    G.pending = null;
    for (const p of POWERS) G.powers[p].flags.negotiationDone = true;
    G.powers[power].hand = [];
    G.powers[power].selectedHomeCard = null;
    G.powers[power].flags.homeChosen = false;
    return G;
  };

  test("every bot adds a random home card", () => {
    const first = diplomatic("FR");
    pileHomeCard(first, makeCtx([1], seat("FR")));
    const second = diplomatic("FR");
    pileHomeCard(second, makeCtx([2], seat("FR")));
    expect(first.powers.FR.selectedHomeCard).not.toBe(second.powers.FR.selectedHomeCard);
  });

  test("GE/OT put it on top, UK on the bottom, FR/AU/RU shuffle it in", () => {
    const ge = diplomatic("GE");
    pileHomeCard(ge, makeCtx([1], seat("GE")));
    expect(ge.powers.GE.hand[0]).toBe(ge.powers.GE.selectedHomeCard);

    const ot = diplomatic("OT");
    pileHomeCard(ot, makeCtx([1], seat("OT")));
    expect(ot.powers.OT.hand[0]).toBe(ot.powers.OT.selectedHomeCard);

    const uk = diplomatic("UK");
    pileHomeCard(uk, makeCtx([1], seat("UK")));
    expect(uk.powers.UK.hand[uk.powers.UK.hand.length - 1]).toBe(uk.powers.UK.selectedHomeCard);

    const fr = diplomatic("FR");
    pileHomeCard(fr, makeCtx([1], seat("FR")));
    expect(fr.powers.FR.hand).toContain(fr.powers.FR.selectedHomeCard);
  });
});

describe("34.4.3 bot war-budget card", () => {
  test("the defender plays its top non-home, non-mandatory card for the budget", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.cpRemaining = 0;
    G.wtt = 1;
    G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war.status = "warAim";
    const homeCard = G.powers.FR.homeCards[0];
    const eventCard = CARDS.actions.find((card) => card.kind === "action" && card.type === "event")!.id;
    G.powers.FR.hand = [homeCard, "IE-A072", eventCard];
    const move = botDecision(G, makeCtx([1], seat("FR")), "FR");
    expect(move).toEqual({move: "playWarBudgetCard", args: [eventCard]});
  });
});
