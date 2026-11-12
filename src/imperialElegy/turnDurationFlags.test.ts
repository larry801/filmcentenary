/**
 * `duration: "turn"` flag lifecycle (round 5).
 *
 * Every card effect printed "for the rest of the turn" must stop at the turn
 * boundary instead of leaking into the next turn/decade.  The generic `flag`
 * effect writes to the acting power's `flags` bag; a few live readers were
 * pointed at `G.flags`, so the cleanup covers both scopes.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {CARDS} from "./constant/cards.data";
import {TURN_DURATION_FLAG_DEFAULTS, clearTurnDurationFlags} from "./engine/rules";
import {playResponseCard, resolveEnd} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** Every `duration: "turn"` flag printed in the card data. */
const printedTurnFlags = (): string[] => {
  const flags = new Set<string>();
  for (const card of [...CARDS.actions, ...CARDS.home, ...CARDS.greatWar]) {
    const effects = [...card.effects, ...(card.options?.flatMap((option) => option.effects) ?? [])];
    for (const effect of effects) {
      if (effect.type === "flag" && effect.duration === "turn") flags.add(effect.flag);
    }
  }
  return [...flags].sort();
};

test("the typed list covers every duration:turn flag in the card data (plus A41's handler flag)", () => {
  // A41 is a `special` handler, so its `landDrm` flag never appears in the
  // card data; it is the documented extra key.
  expect(Object.keys(TURN_DURATION_FLAG_DEFAULTS).sort()).toEqual(
    [...printedTurnFlags(), "landDrm"].sort(),
  );
  expect(printedTurnFlags()).toEqual(
    expect.arrayContaining([
      "combatDrm",
      "siegeGuns",
      "flankAttack",
      "enemyLandDrm",
      "navalDrm",
      "noMines",
      "industryDrm",
      "auNoCitizenship",
      "frLandDrm",
      "gwCombatDrm",
      "noRetreat",
    ]),
  );
});

test("clearTurnDurationFlags resets both the global and the per-power scopes", () => {
  const G = fresh();
  G.flags.combatDrm = 1;
  G.flags.enemyLandDrm = -1;
  G.flags.gwCombatDrm = 2;
  G.flags.auNoCitizenship = true;
  G.powers.GE.flags.landDrm = 1;
  G.powers.FR.flags.frLandDrm = -1;
  G.powers.UK.flags.siegeGuns = true;
  G.powers.RU.flags.industryDrm = 2;
  G.powers.OT.flags.noRetreat = true;

  clearTurnDurationFlags(G);

  expect(G.flags.combatDrm).toBe(0);
  expect(G.flags.enemyLandDrm).toBe(0);
  expect(G.flags.gwCombatDrm).toBe(0);
  expect(G.flags.auNoCitizenship).toBe(false);
  expect(G.powers.GE.flags.landDrm).toBe(0);
  expect(G.powers.FR.flags.frLandDrm).toBe(0);
  expect(G.powers.UK.flags.siegeGuns).toBe(false);
  expect(G.powers.RU.flags.industryDrm).toBe(0);
  expect(G.powers.OT.flags.noRetreat).toBe(false);
  // A flag a power never held stays absent.
  expect(G.powers.UK.flags.frLandDrm).toBeUndefined();
});

test("war-duration and game-duration flags are not touched", () => {
  const G = fresh();
  G.flags.warLandDrm = 1;
  G.flags.rapidMobilization = true;
  G.persistent.machineGuns = true;
  G.powers.GE.flags.frLandDrm = -1;

  clearTurnDurationFlags(G);

  expect(G.flags.warLandDrm).toBe(1);
  expect(G.flags.rapidMobilization).toBe(true);
  expect(G.persistent.machineGuns).toBe(true);
  expect(G.powers.GE.flags.frLandDrm).toBe(0);
});

test("the live end phase clears A98's flag when the turn/decade advances", () => {
  const G = fresh();
  clearHands(G);
  G.phase = "action";
  G.activePower = "FR";
  G.cpRemaining = 0;
  G.powers.FR.hand = ["IE-A098"];
  const ctx = makeCtx(seat("FR"));

  expect(playResponseCard(G, ctx, "IE-A098")).toBeUndefined();
  expect(G.powers.FR.flags.frLandDrm).toBe(-1);

  const turnBefore = G.turn;
  const decadeBefore = G.decade;
  resolveEnd(G, makeCtx());

  expect(G.turn).toBe(turnBefore + 1);
  expect(G.decade).not.toBe(decadeBefore);
  expect(G.powers.FR.flags.frLandDrm).toBe(0);
});

test("the live end phase clears A41's flag too", () => {
  const G = fresh();
  clearHands(G);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.powers.GE.hand = ["IE-A041"];
  const ctx = makeCtx(seat("GE"));

  expect(playResponseCard(G, ctx, "IE-A041")).toBeUndefined();
  expect(G.powers.GE.flags.landDrm).toBe(1);

  resolveEnd(G, makeCtx());

  expect(G.powers.GE.flags.landDrm).toBe(0);
});

test("a turn flag raised globally by an effect is cleared at the same boundary", () => {
  const G = fresh();
  G.flags.combatDrm = 1;
  G.flags.auNoCitizenship = true;
  resolveEnd(G, makeCtx());
  expect(G.flags.combatDrm).toBe(0);
  expect(G.flags.auNoCitizenship).toBe(false);
});

function clearHands(G: ImperialElegyState): void {
  for (const power of POWERS) G.powers[power].hand = [];
}
