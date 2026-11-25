import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {patronById} from "./scenario";
import {resolvePatronage, setupGame} from "./util";

const context = (values: number[] = [], player = "2"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "winter",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

describe("Observatory science bonus (Scenario Book p. 35)", () => {
    it("returns the scientist to the available pool instead of finishing him", () => {
        const G = game();
        const scientist = G.patronsAvailable
            .map((id) => patronById(G, id))
            .find((patron) => patron?.kind === "scientist" && (patron?.rating ?? 0) > 0);
        expect(scientist).toBeDefined();
        G.powers.england.scienceBonuses = ["observatory"];
        G.scienceBonusesAvailable = ["observatory"];
        G.vpAwardsAvailable = [];
        G.pendingPatronage = [{power: "england", patronId: scientist!.id, cp: 4}];

        resolvePatronage(G, context());

        // "return this scientist to pool" — he may be patronized again.
        expect(G.patronsAvailable).toContain(scientist!.id);
        expect(G.powers.england.patrons).not.toContain(scientist!.id);
        expect(G.powers.england.scienceBonuses).toContain("observatory");
    });
});
