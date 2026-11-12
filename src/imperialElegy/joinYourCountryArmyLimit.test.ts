/**
 * 33.2 "Join Your Country's Army!" / 4.2 / 5.5.3.
 *
 * Two printed edges around the free Outbreak-Step armies:
 *  - they are ordinary British standing-army counters, so the 4.2 UK army pool
 *    caps the gain (there is no printed exemption);
 *  - the placement itself is unconditional ("places all armies ... in London"),
 *    so London may end overstacked and the live 5.5.3 impulse-start upkeep
 *    resolves the excess.
 *
 * This suite pins the live path and that the coverage registry no longer
 * records the old gap.
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
import {characteristicsCoverageFor} from "./engine/characteristicsCoverage";
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

describe("33.2 Join Your Country's Army! — pool and London", () => {
  test("the 4.2 pool caps the free gain and the live placement uses it", () => {
    const G = fresh();
    maxedUk(G);
    const owned = Object.values(G.units).filter((unit) => unit.owner === "UK" && unit.kind === "army").length;
    for (let i = owned; i < 10; i += 1) placeUnit(G, "UK", "army", null, 2);
    expect(counterRemaining(G, "UK", "army")).toBe(0);

    outbreakUkBelligerent(G);
    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBeUndefined();
    const before = londonArmies(G).length;
    startTurn1Planning(G);
    expect(londonArmies(G)).toHaveLength(before);
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "joinYourCountrysArmyLimited")).toBe(true);
  });

  test("an available pool places all three for free and the printed overstack is punished live", () => {
    const G = fresh();
    maxedUk(G);
    const before = londonArmies(G).length;
    const manpower = G.powers.UK.manpower;

    outbreakUkBelligerent(G);
    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBe(3);
    startTurn1Planning(G);

    expect(londonArmies(G)).toHaveLength(before + 3);
    expect(G.powers.UK.manpower).toBe(manpower);
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBe(true);
    // The printed placement is unconditional, so London is over its limit and
    // the live 5.5.3 upkeep makes the UK player resolve it.
    expect(isOverstacked(G, "london")).toBe(true);
    expect(placeJoinYourCountrysArmy(G)).toBe(0);

    expect(beginImpulseUpkeep(G, makeCtx([], seat("UK")), "UK")).toBe(true);
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.context?.space).toBe("london");
    const chosen = G.pending!.options[0].id;
    expect(resolvePending(G, makeCtx([], seat("UK")), chosen)).toBeUndefined();
    expect(G.pending).toBeNull();
  });

  test("no coverage gap is recorded for the bullet any more", () => {
    const entry = characteristicsCoverageFor("UK").find((item) => item.label === "Join Your Country's Army!");
    expect(entry?.status).toBe("live");
    expect(entry && "gaps" in entry ? entry.gaps : undefined).toBeUndefined();
  });
});
