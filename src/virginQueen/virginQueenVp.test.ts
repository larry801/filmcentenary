import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {royalAvailable} from "./scenario";
import {setupGame, winter} from "./util";

const context = (roll = 3): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => roll, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

const elizabethOf = (G: VQGame) => G.royals.find((royal) => royal.id === "elizabeth")!;

describe("Virgin Queen VP and royal aging (rules 21.2-21.3)", () => {
    it("awards at most five Virgin Queen VP", () => {
        const G = game();
        for (let year = 0; year < 6; year++) {
            winter(G, context());
        }
        expect(G.virginQueenVpAwarded).toBe(5);
        expect(G.log.join("\n")).toContain("(5/5)");
        expect(elizabethOf(G).status).toBe("aged");
    });

    it("does not award another bonus after the fifth", () => {
        const G = game();
        G.virginQueenVpAwarded = 5;
        const elizabeth = elizabethOf(G);
        elizabeth.eligibility = 5;
        elizabeth.status = "available";
        winter(G, context());
        expect(G.virginQueenVpAwarded).toBe(5);
        expect(G.log.join("\n")).not.toContain("(6/5)");
    });

    it("removes a royal from the marriage pool at eligibility zero", () => {
        const G = game();
        const elizabeth = elizabethOf(G);
        elizabeth.eligibility = 1;
        elizabeth.status = "available";

        winter(G, context());

        expect(elizabeth.eligibility).toBe(0);
        expect(elizabeth.status).toBe("aged");
        expect(royalAvailable(elizabeth)).toBe(false);
    });

    it("allows male royals to keep their eligibility on a 5 or 6", () => {
        const G = game();
        const philip = G.royals.find((royal) => royal.id === "philip")!;
        philip.eligibility = 3;
        philip.status = "available";

        winter(G, context(5));

        expect(philip.eligibility).toBe(3);
        expect(philip.status).toBe("available");
    });
});
