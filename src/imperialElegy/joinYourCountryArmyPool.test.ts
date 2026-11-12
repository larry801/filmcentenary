/**
 * 33.2 "Join Your Country's Army!" / 4.2 / 5.5.3.
 *
 * The printed rule places every army gained during the Outbreak Step in London
 * at the start of GW turn 1, even if the UK is neutral, and 33.2.1 says they
 * cost no manpower.  Two edges are pinned here:
 *
 *  - the free British armies are standing-army counters, and rule 4.2 prints no
 *    exemption for them, so the gain is capped by the UK 4.2 army pool;
 *  - the placement is unconditional, so London may end overstacked; that excess
 *    must then be resolved by the live 5.5.3 impulse-start upkeep, not silently
 *    dropped or hidden.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {counterRemaining} from "./engine/counters";
import {outbreakGreatWar} from "./engine/greatWar";
import {beginGwTurn, placeJoinYourCountrysArmy} from "./engine/greatWarFlow";
import {beginImpulseUpkeep, isOverstacked} from "./engine/rules";
import {resolvePending} from "./moves";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const londonArmies = (G: ImperialElegyState) =>
  G.spaces.london.units
    .map((id) => G.units[id])
    .filter((unit) => unit !== undefined && unit.owner === "UK" && unit.kind === "army");

/** The UK player with every national-will track maxed (three bonuses). */
const maxedUk = (G: ImperialElegyState): void => {
  G.powers.UK.vp = 9;
  G.powers.UK.stability = 6;
  G.powers.UK.industry = 7;
  G.powers.UK.manpower = 3;
};

const outbreakUkBelligerent = (G: ImperialElegyState): void => {
  G.powers.GE.alliance = "taCommitted";
  G.powers.UK.alliance = "teCommitted";
  for (const power of POWERS) {
    if (power !== "GE" && power !== "UK") G.powers[power].alliance = "neutral";
  }
  outbreakGreatWar(G, makeCtx([3]), "GE", "incident");
};

const startTurn1Planning = (G: ImperialElegyState): void => {
  G.gw!.turn = 1;
  beginGwTurn(G, makeCtx([3]));
};

/** Fill the UK standing-army counter pool up to `target` counters. */
const fillUkArmyPool = (G: ImperialElegyState, target: number): void => {
  const owned = Object.values(G.units).filter((unit) => unit.owner === "UK" && unit.kind === "army").length;
  for (let i = owned; i < target; i += 1) placeUnit(G, "UK", "army", null, 2);
};

describe("4.2 — the free outbreak armies use the UK army pool", () => {
  test("a full UK army pool caps the free gain (no printed exemption)", () => {
    const G = fresh();
    maxedUk(G);
    fillUkArmyPool(G, 10);
    expect(counterRemaining(G, "UK", "army")).toBe(0);

    outbreakUkBelligerent(G);

    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "joinYourCountrysArmyLimited" && entry.args?.placeable === 0)).toBe(true);
    const before = londonArmies(G).length;

    startTurn1Planning(G);

    expect(londonArmies(G)).toHaveLength(before);
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBeUndefined();
  });

  test("a partial pool places only the remaining counters", () => {
    const G = fresh();
    maxedUk(G);
    fillUkArmyPool(G, 9);
    expect(counterRemaining(G, "UK", "army")).toBe(1);

    outbreakUkBelligerent(G);

    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBe(1);
    const before = londonArmies(G).length;
    startTurn1Planning(G);
    expect(londonArmies(G)).toHaveLength(before + 1);
  });

  test("an available pool still places all three and costs no manpower", () => {
    const G = fresh();
    maxedUk(G);
    const before = londonArmies(G).length;
    const manpower = G.powers.UK.manpower;

    outbreakUkBelligerent(G);
    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBe(3);
    startTurn1Planning(G);

    expect(londonArmies(G)).toHaveLength(before + 3);
    expect(G.powers.UK.manpower).toBe(manpower);
  });
});

describe("5.5.3 — the unconditional London placement is not hidden from overstacking", () => {
  test("four armies in London trigger the UK impulse-start step loss", () => {
    const G = fresh();
    maxedUk(G);
    outbreakUkBelligerent(G);
    startTurn1Planning(G);

    // 1st Army + three free armies: the printed placement is unconditional.
    const armies = londonArmies(G);
    expect(armies).toHaveLength(4);
    expect(isOverstacked(G, "london")).toBe(true);
    // The extra armies are real counters, so the pool counts them too.
    expect(placeJoinYourCountrysArmy(G)).toBe(0);

    // The live 5.5.3 hook runs when the UK's impulse begins.  A port overstack
    // offers every step-bearing unit there (armies and ships) one step loss.
    expect(beginImpulseUpkeep(G, makeCtx([], seat("UK")), "UK")).toBe(true);
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.context?.space).toBe("london");
    const armyIds = armies.map((unit) => unit!.id);
    expect(G.pending?.options.map((option) => option.id)).toEqual(expect.arrayContaining(armyIds));

    const chosen = armyIds[0];
    const stepsBefore = G.units[chosen].steps;
    expect(resolvePending(G, makeCtx([], seat("UK")), chosen)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[chosen].steps).toBe(stepsBefore - 1);
  });
});
