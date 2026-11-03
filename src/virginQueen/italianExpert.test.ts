import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {patronById} from "./scenario";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Italian Expert (card #48)", () => {
    it("sponsors an Italian patron without spending CP", () => {
        const G = game();
        if (!G.powers.france.cards.includes("vq-048")) G.powers.france.cards.push("vq-048");
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) => candidate?.region === "italy" &&
            candidate.rating !== null && !G.powers.france.patrons.includes(candidate.id));
        expect(patron).toBeDefined();
        const cp = G.powers.france.cp;

        expect(playCard(G, context(), {cardId: "vq-048", asEvent: true, target: patron!.id})).toBeUndefined();

        expect(G.powers.france.cp).toBe(cp);
        expect(G.pendingPatronage.some((entry) => entry.patronId === patron!.id && entry.cp === 3)).toBe(true);
    });
});
