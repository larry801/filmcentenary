import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Dragut Falls (card #11)", () => {
    it("kills Dragut and schedules Uluch Ali", () => {
        const G = game();
        G.powers.spain.cards = ["vq-011"];
        G.spaces.tripoli.control = "spain";
        G.spaces.tripoli.leaders = ["dragut"];
        G.leaders.dragut = {id: "dragut", power: "ottoman", kind: "naval", location: "tripoli", battle: 3, piracy: 2};
        const vp = G.powers.spain.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-011", asEvent: true})).toBeUndefined();

        expect(G.leaders.dragut).toBeUndefined();
        expect(G.spaces.tripoli.leaders).not.toContain("dragut");
        expect(G.leaders.uluchAli.returnTurn).toBe(G.year + 1);
        expect(G.powers.spain.bonusVp).toBe(vp + 1);
        expect(G.removed).toContain("vq-011");
    });
});
