import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {dragutFallsRoll, playCard} from "./moves";
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
    it("rolls 4-6: Dragut dies and Uluch Ali returns", () => {
        const G = game();
        G.powers.spain.cards = ["vq-011"];
        G.spaces.tripoli.leaders = ["dragut"];
        G.leaders.dragut = {id: "dragut", power: "ottoman", kind: "naval", location: "tripoli", battle: 3, piracy: 2};

        const highContext = {...context(), random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards}} as unknown as Ctx;
        expect(dragutFallsRoll(G, highContext)).toBeUndefined();

        expect(G.leaders.dragut).toBeUndefined();
        expect(G.leaders.uluchAli.returnTurn).toBe(G.year + 1);
        expect(G.removed).toContain("vq-011");
    });

    it("rolls 1-3: Dragut returns next turn", () => {
        const G = setupGame({...context(), phase: "action"} as Ctx);
        G.powers.spain.cards = ["vq-011"];
        G.spaces.tripoli.leaders = ["dragut"];
        G.leaders.dragut = {id: "dragut", power: "ottoman", kind: "naval", location: "tripoli", battle: 3, piracy: 2};
        const lowContext = {...context(), random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards}} as unknown as Ctx;

        expect(dragutFallsRoll(G, lowContext)).toBeUndefined();

        expect(G.leaders.dragut.location).toBe("pool");
        expect(G.leaders.dragut.returnTurn).toBe(G.year + 1);
    });

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
