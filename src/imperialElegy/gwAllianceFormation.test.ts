/**
 * 25.2.2 — the Outbreak Step's alliance formation.
 *
 *   "In the unlikely event that neither alliance has a player in it, roll a die
 *   and use the following results: 1 - GE and FR go to war … 6 - AU and GE go
 *   to war."
 *
 * The engine used to key that roll on the constant setup seed (`G.seed`, always
 * 0), which made the pair deterministically GE vs FR.  These tests pin a real
 * die.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";

const makeCtx = (die: number): Ctx =>
  ({
    playerID: "0",
    random: {Die: (sides: number) => Math.min(die, sides)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 7,
    phase: "end",
  }) as unknown as Ctx;

const neutralCampaign = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(1));
  // The campaign opens with every power neutral.
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  return G;
};

const pair = (G: ImperialElegyState): string[] =>
  POWERS.filter((p) => G.powers[p].alliance === "taCommitted" || G.powers[p].alliance === "teCommitted");

test("25.2.2 all-neutral outbreak rolls a die for the pair of enemies", () => {
  const first = neutralCampaign();
  outbreakGreatWar(first, makeCtx(1), "GE", "IE-A001");
  expect(pair(first)).toEqual(["GE", "FR"]);

  const last = neutralCampaign();
  outbreakGreatWar(last, makeCtx(6), "GE", "IE-A001");
  expect(pair(last)).toEqual(["GE", "AU"]);

  // The roll is logged so the table can see which printed result applied.
  expect(first.log.some((entry) => entry.key === "gwAllianceRoll" && entry.args?.roll === 1)).toBe(true);
  expect(last.log.some((entry) => entry.key === "gwAllianceRoll" && entry.args?.roll === 6)).toBe(true);
});

test("25.2.2 one empty alliance picks a neutral target by die, not by seat order", () => {
  const G = neutralCampaign();
  G.powers.GE.alliance = "taAligned";
  outbreakGreatWar(G, makeCtx(6), "GE", "IE-A001");
  const te = POWERS.filter((p) => G.powers[p].alliance === "teCommitted");
  expect(te).toHaveLength(1);
  expect(te[0]).not.toBe("GE");
  expect(G.log.some((entry) => entry.key === "gwAllianceTarget")).toBe(true);
});
