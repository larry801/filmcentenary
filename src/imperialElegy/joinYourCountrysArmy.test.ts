/**
 * 33.2 "Join Your Country's Army!" / 25.6.1.
 *
 * "The UK places all armies gained during the Outbreak Step of the GW in
 * London during the Planning Step of GW turn 1 ... This still happens if the
 * UK is neutral at this point."  The free outbreak armies do not cost manpower
 * (33.2.1), and later GW drafts under the marker bring units in reduced
 * (27.5.2 special).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {beginGwTurn, placeJoinYourCountrysArmy} from "./engine/greatWarFlow";
import {gwDraft} from "./moves";

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

/** Move the game to the Planning Step of GW turn 1. */
const startTurn1Planning = (G: ImperialElegyState): void => {
  G.gw!.turn = 1;
  beginGwTurn(G, makeCtx([3]));
};

describe("Join Your Country's Army! (33.2 / 25.6.1)", () => {
  test("the outbreak records the paid-for armies but places nothing yet", () => {
    const G = fresh();
    maxedUk(G);
    const before = londonArmies(G).length;
    const manpower = G.powers.UK.manpower;

    outbreakUkBelligerent(G);

    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBe(3);
    expect(londonArmies(G)).toHaveLength(before);
    expect(G.powers.UK.manpower).toBe(manpower);
  });

  test("GW turn 1 planning places them in London at full strength, free of manpower", () => {
    const G = fresh();
    maxedUk(G);
    outbreakUkBelligerent(G);
    const before = londonArmies(G).length;
    const manpower = G.powers.UK.manpower;

    startTurn1Planning(G);

    const after = londonArmies(G);
    expect(after).toHaveLength(before + 3);
    expect(after.every((unit) => unit!.steps === 2)).toBe(true);
    for (const unit of after.slice(before)) expect(unit!.space).toBe("london");
    // 33.2.1: the free outbreak armies do not cost manpower.
    expect(G.powers.UK.manpower).toBe(manpower);
    // Reminder counter and pending bookkeeping.
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBe(true);
    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "joinYourCountrysArmy")).toBe(true);
  });

  test("placement is idempotent", () => {
    const G = fresh();
    maxedUk(G);
    outbreakUkBelligerent(G);
    startTurn1Planning(G);
    const after = londonArmies(G).length;
    expect(placeJoinYourCountrysArmy(G)).toBe(0);
    expect(londonArmies(G)).toHaveLength(after);
  });

  test("it still happens while the UK is neutral at that point", () => {
    const G = fresh();
    maxedUk(G);
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    for (const power of POWERS) {
      if (power !== "GE" && power !== "FR") G.powers[power].alliance = "neutral";
    }
    outbreakGreatWar(G, makeCtx([3]), "GE", "incident");
    expect(G.gw?.neutrals).toContain("UK");
    expect(G.powers.UK.flags.joinYourCountrysArmyPending).toBe(3);
    const before = londonArmies(G).length;

    startTurn1Planning(G);

    expect(londonArmies(G)).toHaveLength(before + 3);
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBe(true);
  });

  test("no outbreak armies means no placement and no marker", () => {
    const G = fresh();
    G.powers.UK.vp = 0;
    outbreakUkBelligerent(G);
    const before = londonArmies(G).length;

    startTurn1Planning(G);

    expect(londonArmies(G)).toHaveLength(before);
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBeUndefined();
  });

  test("later drafts under the marker bring reduced armies and pay manpower", () => {
    const G = fresh();
    maxedUk(G);
    outbreakUkBelligerent(G);
    startTurn1Planning(G);
    const fullStrength = londonArmies(G).filter((unit) => unit!.steps === 2).length;
    const manpowerBefore = G.powers.UK.manpower;

    G.phase = "gwManeuver";
    G.activePower = "UK";
    G.powers.UK.gwBudget = 4;
    G.pending = null;
    expect(gwDraft(G, makeCtx([], seat("UK")), "london")).toBeUndefined();

    const drafted = londonArmies(G).filter((unit) => unit!.steps === 1);
    expect(drafted.length).toBe(2);
    expect(londonArmies(G).filter((unit) => unit!.steps === 2)).toHaveLength(fullStrength);
    expect(G.powers.UK.manpower).toBe(manpowerBefore - 1);
    // The marker stays on the original free armies.
    expect(G.powers.UK.flags.joinYourCountrysArmy).toBe(true);
  });
});
