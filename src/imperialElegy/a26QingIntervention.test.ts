/**
 * A026 Chinese Intervention deadline scan (card 26 / rule 13.4.4 errata).
 *
 * `resolveQingInterventionDeadline` runs at the top of 20.12 while `G.turn`
 * still names the play turn: a surviving Qing army and the intervention's
 * control marker are removed, and the controlling player either loses a
 * stability or gains a -1 card marker.  These tests drive the live end phase
 * (earlier 20.x decisions answered with their printed defaults) and pin:
 *  - the pending stability-or-marker choice for the interactive player;
 *  - the decline path taking the printed stability default;
 *  - the printed stability default when nobody can answer;
 *  - no penalty once the Qing army was eliminated before the deadline.
 */

import type {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeNonPlayerCounter, removeUnit} from "./engine/effects";
import {beginEndPhase, declinePending, resolveEnd, resolvePending} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "end",
  } as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** Card 26's aftermath: the reduced Qing army, the control marker, the flag. */
const stageIntervention = (G: ImperialElegyState, owner: Power): void => {
  G.spaces.shanghai.rebellion = {minor: "Qing", step: 0, rebels: []};
  const rebel = placeNonPlayerCounter(G, "REBEL:Qing", "rebelArmy", "shanghai", 1);
  if (!rebel) throw new Error("the REBEL pool is exhausted");
  G.spaces.shanghai.rebellion!.rebels.push(rebel.id);
  G.spaces.shanghai.control = owner;
  G.flags["qingIntervention_shanghai"] = G.turn;
};

/** Answer every earlier 20.x decision with its printed default. */
const answerDefaults = (G: ImperialElegyState, kind: string): void => {
  for (let index = 0; index < 50 && G.pending && G.pending.kind !== kind; index += 1) {
    expect(declinePending(G, makeCtx(seat(G.pending.power)))).toBeUndefined();
  }
};

test("20.12: a surviving Qing army suspends the end phase on the owner's choice", () => {
  const G = fresh();
  stageIntervention(G, "RU");
  const stabilityBefore = G.powers.RU.stability;
  const markersBefore = G.powers.RU.cardMarkers;

  beginEndPhase(G, makeCtx(seat("RU")));
  answerDefaults(G, "qingPenalty");
  expect(G.pending?.kind).toBe("qingPenalty");
  expect(G.pending?.power).toBe("RU");
  expect(G.pending?.options.map((option) => option.id)).toEqual(["stability", "cardMarker"]);

  expect(G.spaces.shanghai.control).toBeNull();
  expect(G.spaces.shanghai.rebellion).toBeNull();
  expect(
    Object.values(G.units).some((unit) => unit.space === "shanghai" && unit.owner === "REBEL:Qing"),
  ).toBe(false);
  expect(
    G.log.some(
      (entry) =>
        entry.key === "qingInterventionExpired" &&
        entry.power === "RU" &&
        entry.args?.space === "shanghai",
    ),
  ).toBe(true);
  expect(G.turn).toBe(1);

  resolvePending(G, makeCtx(seat("RU")), "cardMarker");
  expect(G.pending).toBeNull();
  expect(G.powers.RU.cardMarkers).toBe(markersBefore - 1);
  expect(G.powers.RU.stability).toBe(stabilityBefore);
  expect(G.turn).toBe(2);
});

test("20.12: declining the choice takes the printed stability loss", () => {
  const G = fresh();
  stageIntervention(G, "RU");
  const stabilityBefore = G.powers.RU.stability;

  beginEndPhase(G, makeCtx(seat("RU")));
  answerDefaults(G, "qingPenalty");
  expect(G.pending?.kind).toBe("qingPenalty");
  declinePending(G, makeCtx(seat("RU")));

  expect(G.pending).toBeNull();
  expect(G.powers.RU.stability).toBe(stabilityBefore - 1);
  expect(G.turn).toBe(2);
});

test("20.12: the printed stability default applies when nobody answers", () => {
  const G = fresh();
  stageIntervention(G, "RU");
  const stabilityBefore = G.powers.RU.stability;
  const trace: string[] = [];

  resolveEnd(G, makeCtx(), trace);

  expect(G.pending).toBeNull();
  expect(G.powers.RU.stability).toBe(stabilityBefore - 1);
  expect(G.turn).toBe(2);
  expect(trace[trace.length - 1]).toBe("advanceTurn");
  expect(G.log.some((entry) => entry.key === "qingInterventionExpired")).toBe(true);
});

test("20.12: eliminating the Qing army before the deadline avoids the penalty", () => {
  const G = fresh();
  stageIntervention(G, "RU");
  const stabilityBefore = G.powers.RU.stability;
  const markersBefore = G.powers.RU.cardMarkers;
  for (const id of G.spaces.shanghai.rebellion!.rebels) removeUnit(G, id);
  G.spaces.shanghai.rebellion = null;

  resolveEnd(G, makeCtx());

  expect(G.pending).toBeNull();
  expect(G.flags["qingIntervention_shanghai"]).toBeUndefined();
  expect(G.spaces.shanghai.control).toBe("RU");
  expect(G.powers.RU.stability).toBe(stabilityBefore);
  expect(G.powers.RU.cardMarkers).toBe(markersBefore);
  expect(G.log.some((entry) => entry.key === "qingInterventionExpired")).toBe(false);
});
