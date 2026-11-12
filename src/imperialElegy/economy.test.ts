import {CardDef} from "./constant/cards";
import {CARDS} from "./constant/cards.data";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {ALL_CARDS, cardById} from "./engine/deck";
import {
  beginTurnDecade,
  cpChainResolution,
  CP_CHAIN_MAX_CARDS,
  CP_CHAIN_SINGLE_ACTION_CAP,
  decadeForTurn,
  endPhaseOrder,
  industryRollNeeded,
  industryTarget,
  autoIndustrySuccess,
  reserveAllowance,
  reserveRemaining,
} from "./engine/economy";

const ctx: any = {
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}},
};

const fresh = () => setupImperialElegy(ctx);

const actionCard = (cp: number): CardDef => ALL_CARDS.find((c) => c.kind === "action" && c.cp === cp)!;

// ---------------------------------------------------------------------------
// Decade sequence
// ---------------------------------------------------------------------------

test("decade sequence runs 1850s → 1910s across the seven campaign turns", () => {
  const sequence = [1, 2, 3, 4, 5, 6, 7].map(decadeForTurn);
  expect(sequence[0]).toBe("1850s");
  expect(sequence[sequence.length - 1]).toBe("1910s");
  expect(sequence).toEqual(["1850s", "1860s", "1870s", "1880s", "1890s", "1900s", "1910s"]);
  // One playbook decade label per turn, including the two label-only bands
  // (1860s/1910s) that no card is printed for.
  expect([...new Set(sequence)]).toEqual(["1850s", "1860s", "1870s", "1880s", "1890s", "1900s", "1910s"]);
  // Out-of-range turns clamp rather than throw (UI/logs may read turn 8+).
  expect(decadeForTurn(0)).toBe("1850s");
  expect(decadeForTurn(-1)).toBe("1850s");
  expect(decadeForTurn(8)).toBe("1910s");
  expect(decadeForTurn(Number.NaN)).toBe("1850s");
});

test("beginTurnDecade reports the entering cards without mutating G", () => {
  const G = fresh();
  const snapshot = JSON.stringify({
    deck: G.deck,
    discard: G.discard,
    removed: G.removed,
    hands: POWERS.map((p) => G.powers[p].hand),
    chains: POWERS.map((p) => G.powers[p].cpChain),
    decade: G.decade,
  });

  const turn1 = beginTurnDecade(G, 1);
  expect(turn1).toMatchObject({turn: 1, decade: "1850s"});
  // The 1850s band is dealt out during setup, so nothing is "entering" on turn 1.
  expect(turn1.entering).toHaveLength(0);

  const turn2 = beginTurnDecade(G, 2);
  expect(turn2).toMatchObject({turn: 2, decade: "1860s"});
  // 1860s is a playbook label only: no card is printed with that entry band.
  expect(turn2.entering).toHaveLength(0);

  // Printed card bands, per docs/imperial-elegy/CORRECTIONS.md §5.
  expect(beginTurnDecade(G, 3)).toMatchObject({decade: "1870s"});
  expect(beginTurnDecade(G, 3).entering).toHaveLength(11);
  expect(beginTurnDecade(G, 4).entering).toHaveLength(10);
  expect(beginTurnDecade(G, 5).entering).toHaveLength(8);
  expect(beginTurnDecade(G, 6).entering).toHaveLength(13);

  // 1910s is likewise a label only; on a fresh state the 1900s band is still
  // unentered, so turn 7 reports the 1910s label with no cards of its own.
  expect(beginTurnDecade(G, 7)).toMatchObject({decade: "1910s", entering: []});

  // Every reported card really is printed for that decade and is not yet in play.
  const inPlay = new Set([...G.deck, ...G.discard, ...G.removed, ...POWERS.flatMap((p) => G.powers[p].hand)]);
  for (const id of beginTurnDecade(G, 3).entering) {
    expect(cardById(id).entry).toBe("1870s");
    expect(inPlay.has(id)).toBe(false);
  }

  // The helper is pure and repeatable.
  expect(beginTurnDecade(G, 3)).toEqual(beginTurnDecade(G, 3));
  expect(JSON.stringify({
    deck: G.deck,
    discard: G.discard,
    removed: G.removed,
    hands: POWERS.map((p) => G.powers[p].hand),
    chains: POWERS.map((p) => G.powers[p].cpChain),
    decade: G.decade,
  })).toBe(snapshot);
});

test("beginTurnDecade excludes cards already in the discard, removed pile, or a hand", () => {
  const G = fresh();
  const entering = beginTurnDecade(G, 3).entering;
  expect(entering).toHaveLength(11);

  G.discard.push(entering[0]);
  expect(beginTurnDecade(G, 3).entering).toHaveLength(10);

  G.removed.push(entering[1]);
  expect(beginTurnDecade(G, 3).entering).toHaveLength(9);

  G.powers.GE.hand.push(entering[2]);
  expect(beginTurnDecade(G, 3).entering).toHaveLength(8);
});

// ---------------------------------------------------------------------------
// CP Chain (12.14)
// ---------------------------------------------------------------------------

test("CP chain banks its printed CP but one action may spend at most 4", () => {
  const G = fresh();
  const four = actionCard(4);
  const two = actionCard(2);
  G.powers.GE.cpChain = [four.id, two.id];

  const res = cpChainResolution(G, "GE");
  expect(res.power).toBe("GE");
  expect(res.cards).toEqual([four.id, two.id]);
  expect(res.cardCount).toBe(2);
  expect(res.overLimit).toBe(false);
  expect(res.maxCards).toBe(CP_CHAIN_MAX_CARDS);
  expect(res.cpGranted).toBe(6);
  expect(res.cpSpendable).toBe(CP_CHAIN_SINGLE_ACTION_CAP);
  expect(res.cpWasted).toBe(2);
});

test("chained mandatory events still trigger and the chain never survives the action phase", () => {
  const G = fresh();
  const mandatory = CARDS.actions.find((c) => c.type === "mandatory")!;
  G.powers.FR.cpChain = [mandatory.id];

  const res = cpChainResolution(G, "FR");
  expect(res.mandatoryEvents).toEqual([mandatory.id]);
  // 12.14: CP chained cards cannot be used to industrialize.
  expect(res.canIndustrialize).toBe(false);
  // 12.14: always discarded at the end of the action phase …
  expect(res.discardAtEndOfActionPhase).toEqual([mandatory.id]);
  // … never returned to hand and never carried into the next turn.
  expect(res.returnsToHand).toEqual([]);
  expect(res.cpNextTurn).toBe(0);
});

test("an empty CP chain grants and returns nothing", () => {
  const G = fresh();
  const res = cpChainResolution(G, "RU");
  expect(res).toMatchObject({
    cards: [],
    cardCount: 0,
    cpGranted: 0,
    cpSpendable: 0,
    cpWasted: 0,
    mandatoryEvents: [],
    returnsToHand: [],
    cpNextTurn: 0,
    overLimit: false,
  });
});

test("more than the two-card limit is flagged defensively", () => {
  const G = fresh();
  G.powers.OT.cpChain = CARDS.actions.slice(0, 3).map((c) => c.id);
  const res = cpChainResolution(G, "OT");
  expect(res.cardCount).toBe(3);
  expect(res.overLimit).toBe(true);
  expect(res.cpGranted).toBeGreaterThan(CP_CHAIN_SINGLE_ACTION_CAP);
  expect(res.cpSpendable).toBe(CP_CHAIN_SINGLE_ACTION_CAP);
});

// ---------------------------------------------------------------------------
// Industrialization (12.13 / 20.6)
// ---------------------------------------------------------------------------

test("industrialization targets are 5, and 6 for RU and OT", () => {
  const G = fresh();
  expect(industryTarget(G, "GE")).toBe(5);
  expect(industryTarget(G, "UK")).toBe(5);
  expect(industryTarget(G, "FR")).toBe(5);
  expect(industryTarget(G, "AU")).toBe(5);
  expect(industryTarget(G, "RU")).toBe(6);
  expect(industryTarget(G, "OT")).toBe(6);
});

test("industryRollNeeded subtracts the card CP and the turn's DRM from the target", () => {
  const G = fresh();
  expect(industryRollNeeded(G, "GE", 2)).toBe(3); // 5 - 2
  expect(industryRollNeeded(G, "RU", 2)).toBe(4); // 6 - 2
  expect(industryRollNeeded(G, "OT", 1)).toBe(5); // 6 - 1
  // World's Fair gives every other player +2 this turn.
  G.powers.GE.flags.industryDrm = 2;
  expect(industryRollNeeded(G, "GE", 2)).toBe(1);
  // 4 CP is already enough for a standard power.
  expect(industryRollNeeded(G, "GE", 4)).toBeLessThanOrEqual(1);
  // RU's Agrarian target: a 1 CP card needs a 5, a 0 CP card needs a 6.
  expect(industryRollNeeded(G, "RU", 1)).toBe(5);
  expect(industryRollNeeded(G, "RU", 0)).toBe(6);
});

test("autoIndustrySuccess needs both the auto chit and a played card", () => {
  const G = fresh();
  expect(autoIndustrySuccess(G, "GE")).toBe(false);
  G.powers.GE.autoIndustry = true;
  expect(autoIndustrySuccess(G, "GE")).toBe(false); // no card played yet
  G.powers.GE.industryCard = CARDS.actions[0].id;
  expect(autoIndustrySuccess(G, "GE")).toBe(true);
});

// ---------------------------------------------------------------------------
// Reserve allowance (7.3 / national characteristics)
// ---------------------------------------------------------------------------

test("reserve allowance is the lower of manpower and industry, and the UK has none", () => {
  const G = fresh();
  expect(reserveAllowance(G, "UK")).toBe(0);
  G.powers.UK.manpower = 6;
  G.powers.UK.industry = 6;
  expect(reserveAllowance(G, "UK")).toBe(0); // Professional Army: never any reserves

  G.powers.GE.manpower = 5;
  G.powers.GE.industry = 2;
  expect(reserveAllowance(G, "GE")).toBe(2);

  G.powers.AU.manpower = 1;
  G.powers.AU.industry = 3;
  expect(reserveAllowance(G, "AU")).toBe(1);

  G.powers.OT.manpower = 3;
  G.powers.OT.industry = 0;
  expect(reserveAllowance(G, "OT")).toBe(0);
});

test("RU Steamroller adds one to the lower of manpower and industry", () => {
  const G = fresh();
  G.powers.RU.manpower = 4;
  G.powers.RU.industry = 2;
  expect(reserveAllowance(G, "RU")).toBe(3);
  G.powers.RU.industry = 4;
  expect(reserveAllowance(G, "RU")).toBe(5);
  // Lower of the two still wins.
  G.powers.RU.manpower = 1;
  G.powers.RU.industry = 6;
  expect(reserveAllowance(G, "RU")).toBe(2);
});

test("Extreme Militarism raises the box limit by one, but the UK stays at none", () => {
  const G = fresh();
  G.powers.GE.manpower = 3;
  G.powers.GE.industry = 2;
  expect(reserveAllowance(G, "GE")).toBe(2);
  G.powers.GE.flags.reserveLimitBonus = 1;
  expect(reserveAllowance(G, "GE")).toBe(3);

  G.powers.RU.manpower = 4;
  G.powers.RU.industry = 2;
  G.powers.RU.flags.reserveLimitBonus = 1;
  expect(reserveAllowance(G, "RU")).toBe(4); // (2 + 1) + 1

  G.powers.UK.flags.reserveLimitBonus = 1;
  expect(reserveAllowance(G, "UK")).toBe(0);
});

test("reserveRemaining subtracts the armies in the box and never goes negative", () => {
  const G = fresh();
  G.powers.RU.manpower = 4;
  G.powers.RU.industry = 2; // allowance 3
  G.powers.RU.reserves = ["u1"];
  expect(reserveRemaining(G, "RU")).toBe(2);

  G.powers.RU.reserves = ["u1", "u2", "u3"];
  expect(reserveRemaining(G, "RU")).toBe(0);
  G.powers.RU.reserves = ["u1", "u2", "u3", "u4"];
  expect(reserveRemaining(G, "RU")).toBe(0);

  G.powers.UK.reserves = [];
  expect(reserveRemaining(G, "UK")).toBe(0);
});

// ---------------------------------------------------------------------------
// End-phase order (20.0)
// ---------------------------------------------------------------------------

test("endPhaseOrder lists rules 20.1–20.12 in printed order", () => {
  const steps = endPhaseOrder();
  expect(steps).toHaveLength(12);
  expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(steps.map((s) => s.rule)).toEqual([
    "20.1",
    "20.2",
    "20.3",
    "20.4",
    "20.5",
    "20.6",
    "20.7",
    "20.8",
    "20.9",
    "20.10",
    "20.11",
    "20.12",
  ]);
  expect(steps.map((s) => s.key)).toEqual([
    "militarism",
    "degradeForts",
    "nonPlayerBuild",
    "navalUnitsToPort",
    "setManpower",
    "industrialization",
    "progressTruces",
    "progressWarsOfIndependence",
    "allianceResolution",
    "decreaseWorldTension",
    "drawNationalGoals",
    "advanceTurn",
  ]);
  expect(steps[0].title).toBe("Militarism");
  expect(steps[11].title).toBe("Advance Turn");
  // 20.11 only happens on turns 1, 3, and 5.
  expect(steps.find((s) => s.key === "drawNationalGoals")?.turns).toEqual([1, 3, 5]);
  expect(steps.filter((s) => s.turns !== undefined)).toHaveLength(1);
  // The list is immutable.
  expect(Object.isFrozen(steps)).toBe(true);
});
