/**
 * 17.1 / 29.1 — "the RU player, and players allied to RU" may use the
 * Trans-Siberian Railroad instead of the ordinary Pacific sea route.
 *
 * `allied()` answers the 8.x alliance-track question: two powers in the same
 * alliance box are "allied" even before either joins the war.  The blockade
 * gate is about *this war's* participants (4.9.4), so a neutral RU must not
 * silently disable the Pacific route of the other alliance's members.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {allied} from "./engine/rules";
import {blockadeTrace, blockadedAt, tsrrConnectionUsable} from "./engine/blockade";

const makeCtx = (): Ctx => ({
  playerID: "0",
  random: {Die: () => 3},
  events: {
    setPhase: () => undefined,
    setActivePlayers: () => undefined,
    endGame: () => undefined,
    endTurn: () => undefined,
  },
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const gw = (te: ("GE" | "UK" | "FR" | "AU" | "RU" | "OT")[], ta: ("GE" | "UK" | "FR" | "AU" | "RU" | "OT")[]): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  const belligerents = [...te, ...ta];
  const neutrals = (["GE", "UK", "FR", "AU", "RU", "OT"] as const).filter((p) => !belligerents.includes(p));
  G.phase = "gwWinter";
  G.gw = {
    active: true, turn: 1, te: [...te], ta: [...ta], belligerents: [...belligerents],
    neutrals: [...neutrals], order: [...belligerents], italyIn: false, usIn: false,
    italyStability: 3, italyManpower: 3, italyBudget: 2,
    usStability: 3, usManpower: 3, usBudget: 4, trenches: {}, lastColonialWar: null,
    victor: null, outbreakDone: true, nationalWillDone: true, bonusImpulses: [],
  } as unknown as GreatWarState;
  return G;
};

test("a neutral RU does not block the opposing alliance's own Pacific route", () => {
  const G = gw(["GE", "FR", "RU"], ["UK"]);
  // RU is in the war on the other side, but UK's alliance-track box lines up
  // with Russia anyway, so the raw `allied()` test says "yes".
  G.powers.UK.alliance = "taCommitted";
  G.powers.RU.alliance = "taCommitted";
  expect(allied(G, "UK", "RU")).toBe(true);
  // The TSRR gate must only count an RU *belligerent ally of this war*.
  expect(tsrrConnectionUsable(G, "UK")).toBe(false);
  expect(blockadeTrace(G, "UK")).toContain("pacific-ocean");
  expect(blockadedAt(G, "UK")).toBe(false);
});

test("an actual RU war ally still needs the completed railroad", () => {
  const G = gw(["GE", "RU", "UK"], ["FR"]);
  G.powers.UK.alliance = G.powers.RU.alliance = "teCommitted";
  expect(tsrrConnectionUsable(G, "UK")).toBe(false);
  expect(blockadeTrace(G, "UK")).not.toContain("pacific-ocean");
  G.powers.RU.tsrr = true;
  expect(tsrrConnectionUsable(G, "UK")).toBe(true);
  expect(blockadeTrace(G, "UK")).toContain("pacific-ocean");
});

test("a peace-time neutral RU does not turn a belligerent into an 'RU ally'", () => {
  const G = gw(["GE", "FR", "RU"], ["UK"]);
  G.powers.UK.alliance = G.powers.RU.alliance = "taCommitted";
  // 4.9.4: only participating allies share this war's routes.
  expect(tsrrConnectionUsable(G, "UK")).toBe(false);
});
