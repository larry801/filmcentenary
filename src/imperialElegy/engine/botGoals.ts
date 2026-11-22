/**
 * Rule 34.1 — bot National Goals.
 *
 * "Bots do not draw NGs when player's draw NGs, instead bots draw all their
 * NGs at the end of the game (if there has been no GW) or the start of the GW.
 * … A bot's difficulty level determines how many NGs they draw:
 * Easy: 3 NGs, Normal: 4 NGs, Hard: 5 NGs."
 *
 * The 20.11 end-phase draw therefore skips bot seats, and the two checkpoints
 * below hand every bot its full difficulty count: `outbreakGreatWar` before
 * 25.5 scores the NGs, and `finishScenario` before the end-of-game scoring.
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, POWERS} from "../types";
import {botDifficultyOf, isBotPower} from "../configuration";
import {log} from "./rules";
import {shuffle} from "./deck";

/** The number of NGs a bot draws for the match's difficulty (34.1). */
export const botGoalCount = (G: ImperialElegyState): number => {
  switch (botDifficultyOf(G)) {
    case "easy": return 3;
    case "hard": return 5;
    default: return 4;
  }
};

/**
 * Give every bot seat its 34.1 NGs, drawn from its NG deck.
 *
 * Bots do not choose: 34.1 fixes the count, and 34.3's "roll a die for a
 * decision the PAC does not lay out" covers the pick.  The deck is shuffled
 * first (2.4/20.11's draw procedure).
 */
export const drawBotGoals = (G: ImperialElegyState, ctx: Ctx): void => {
  const count = botGoalCount(G);
  for (const power of POWERS) {
    if (!isBotPower(G, power)) continue;
    const p = G.powers[power];
    if (p.eliminated) continue;
    const need = count - p.goals.length;
    if (need <= 0) continue;
    p.goalDeck = shuffle(ctx, p.goalDeck);
    const drawn = p.goalDeck.splice(0, Math.min(need, p.goalDeck.length));
    p.goals.push(...drawn);
    log(G, power, "botGoalsDrawn", {count: drawn.length, difficulty: botDifficultyOf(G)});
  }
};
