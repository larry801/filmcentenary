import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {commitForeignWarForce, playCard} from "./moves";
import {landCount} from "./constant/general";
import {setupGame} from "./util";

const context = (player = "1", events = true): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    ...(events ? {events: {endStage: () => undefined, setActivePlayers: () => undefined}} : {}),
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Foreign War unit selection (rule 23.7)", () => {
    it("opens a selection window for the affected power even when another power played the event", () => {
        const G = game();
        G.powers.spain.cards.push("vq-073");

        expect(playCard(G, context("1"), {cardId: "vq-073", asEvent: true, target: "3"})).toBeUndefined();

        expect(G.foreignWars.ottoman?.status).toBe("setup");
        expect(G.pendingForeignWar).toEqual({power: "ottoman"});
        // Spain's seat cannot make the Ottoman's choice.
        expect(commitForeignWarForce(G, context("1"), {units: [{space: "istanbul", kind: "regular"},
            {space: "istanbul", kind: "regular"}, {space: "istanbul", kind: "regular"}]})).toBe(INVALID_MOVE);
    });

    it("commits 3-8 units and one leader from unbesieged spaces", () => {
        const G = game();
        G.powers.spain.cards.push("vq-073");
        playCard(G, context("1"), {cardId: "vq-073", asEvent: true, target: "3"});
        const before = landCount(G.spaces.istanbul.land.ottoman);

        expect(commitForeignWarForce(G, context("0"), {
            units: [
                {space: "istanbul", kind: "regular"},
                {space: "istanbul", kind: "regular"},
                {space: "istanbul", kind: "regular"},
            ],
            leaderId: "mehmed",
        })).toBeUndefined();

        expect(G.foreignWars.ottoman?.status).toBe("active");
        expect(landCount(G.foreignWars.ottoman!.units)).toBe(3);
        expect(landCount(G.spaces.istanbul.land.ottoman)).toBe(before - 3);
        expect(G.foreignWars.ottoman?.leaderId).toBe("mehmed");
        expect(G.pendingForeignWar).toBeUndefined();
    });

    it("rejects fewer than three or more than eight units", () => {
        const G = game();
        G.powers.spain.cards.push("vq-073");
        playCard(G, context("1"), {cardId: "vq-073", asEvent: true, target: "3"});

        expect(commitForeignWarForce(G, context("0"), {
            units: [{space: "istanbul", kind: "regular"}, {space: "istanbul", kind: "regular"}],
        })).toBe(INVALID_MOVE);
    });
});
