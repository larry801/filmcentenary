import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {navalForceCount, navalLostCount, recordNavalLoss, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0", playerID: "0", phase: "action", numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Rule 17.3: "If a power has earned the Dry Dock science bonus, he may
 * immediately rebuild lost naval units ... Those units immediately return to
 * the power's force pool when eliminated."
 */
describe("Dry Dock science bonus (rule 17.3)", () => {
    it("records the loss while the bonus is unearned", () => {
        const G = game();
        recordNavalLoss(G, "england", "galleon");
        expect(navalLostCount(G, "england")).toBe(1);
    });

    it("returns the counter to the pool immediately once earned", () => {
        const G = game();
        G.powers.england.scienceBonuses = ["dryDock"];
        const before = navalForceCount(G, "england");
        recordNavalLoss(G, "england", "galleon");
        expect(navalLostCount(G, "england")).toBe(0);
        // The rebuild allowance is unchanged, so a replacement can be laid down.
        expect(navalForceCount(G, "england")).toBe(before);
    });

    it("does not apply to minor-power allies (no science bonuses of their own)", () => {
        const G = game();
        recordNavalLoss(G, "spain", "galley");
        expect(navalLostCount(G, "spain")).toBe(1);
    });
});
