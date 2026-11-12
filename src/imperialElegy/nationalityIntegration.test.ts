import {GOALS_BY_ID} from "./constant/goals";
import {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, resolveEffects} from "./engine/effects";
import {achievementReached} from "./engine/victory";
import {recomputeTracks} from "./engine/rules";
import {grantAuNewWayForward} from "./engine/nationality";

const makeCtx = () => ({
  playerID: "0",
  random: {Die: (_sides: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const special = (G: ImperialElegyState, ctx: any, actor: Parameters<typeof resolveEffects>[2], handler: string): boolean =>
  resolveEffects(G, ctx, actor, [{type: "special", handler}], {});

describe("Nationalist Uprising candidate selection", () => {
  test("never offers Berlin or the German core as a target", () => {
    const G = fresh();
    const ctx = makeCtx();

    expect(special(G, ctx, "GE", "nationalistUprising")).toBe(false);
    expect(G.pending?.kind).toBe("eventTargetSpace");
    const candidates = G.pending!.options.map((option) => option.id);
    expect(candidates).not.toContain("berlin");
    for (const id of ["westphalia", "silesia", "pomerania", "prussia"]) {
      expect(candidates).not.toContain(id);
    }
  });

  test("offers Ireland for the UK", () => {
    const G = fresh();
    const ctx = makeCtx();
    expect(G.spaces.ireland.control).toBe("UK");

    expect(special(G, ctx, "UK", "nationalistUprising")).toBe(false);
    const candidates = G.pending!.options.map((option) => option.id);
    expect(candidates).toContain("ireland");
  });
});

describe("AU Bind Them Together", () => {
  const goal = GOALS_BY_ID["NG-33"];

  test("counts only citizenships backed by an AU-controlled space", () => {
    const G = fresh();
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Croats"];
    expect(achievementReached(G, "AU", goal)).toBe(goal.vp);

    // Bohemia falls to Russia: Czechs no longer match, leaving three.
    G.spaces.bohemia.control = "RU";
    expect(achievementReached(G, "AU", goal)).toBe(goal.partialVp ?? 0);

    // Galicia follows, leaving only two matched citizenships.
    G.spaces.galicia.control = "RU";
    expect(achievementReached(G, "AU", goal)).toBe(0);
  });

  test("ignores four core-only citizenships with no matching AU space", () => {
    const G = fresh();
    G.powers.AU.citizenship = ["Germans", "French", "Russians", "British"];
    expect(achievementReached(G, "AU", goal)).toBe(0);
  });
});

describe("sickMan", () => {
  test("ignores core-only citizenships and raw citizenship length", () => {
    const G = fresh();
    const ctx = makeCtx();
    G.powers.AU.citizenship = ["Germans", "French", "Russians", "British"];
    const before = G.powers.AU.stability;

    special(G, ctx, "AU", "sickMan");
    expect(G.powers.AU.stability).toBe(before - 1);
  });

  test("counts four citizenships when each is matched by an AU-controlled space", () => {
    const G = fresh();
    const ctx = makeCtx();
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Croats"];
    const before = G.powers.AU.stability;

    special(G, ctx, "AU", "sickMan");
    expect(G.powers.AU.stability).toBe(before);
  });
});

describe("A New Way Forward", () => {
  test("the +1 is granted once, during the end phase, and stays latched", () => {
    const G = fresh();
    recomputeTracks(G);
    const baseline = G.powers.AU.manpower;

    // Four matched citizenships alone do not pay out before the end phase.
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Croats"];
    recomputeTracks(G);
    expect(G.powers.AU.manpower).toBe(baseline);
    expect(grantAuNewWayForward(G)).toBe(true);
    recomputeTracks(G);
    expect(G.powers.AU.manpower).toBe(baseline + 1);

    // A one-time bonus: dropping below four matched citizenships keeps it.
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Germans"];
    recomputeTracks(G);
    expect(G.powers.AU.manpower).toBe(baseline + 1);
    expect(grantAuNewWayForward(G)).toBe(false);
  });
});

describe("Indian Ocean Arms Trade (IE-A065)", () => {
  test("flipReducedRebelToFull prefers a pacified space and draws an extra card", () => {
    const G = fresh();
    const ctx = makeCtx();
    const unpacified = placeUnit(G, "REBEL:Poland", "rebelArmy", "poland", 1);
    const pacified = placeUnit(G, "REBEL:Ireland", "rebelArmy", "ireland", 1);
    G.spaces.ireland.pacification = 1;
    const handBefore = G.powers.GE.hand.length;

    expect(special(G, ctx, "GE", "flipReducedRebelToFull")).toBe(true);
    expect(G.units[pacified.id].steps).toBe(2);
    expect(G.units[unpacified.id].steps).toBe(1);
    expect(G.powers.GE.hand.length).toBe(handBefore + 1);
  });

  test("flipReducedRebelToFull does nothing when no rebel is reduced", () => {
    const G = fresh();
    const ctx = makeCtx();
    const full = placeUnit(G, "REBEL:Poland", "rebelArmy", "poland", 2);
    const handBefore = G.powers.GE.hand.length;

    expect(special(G, ctx, "GE", "flipReducedRebelToFull")).toBe(true);
    expect(G.units[full.id].steps).toBe(2);
    expect(G.powers.GE.hand.length).toBe(handBefore);
  });
});
