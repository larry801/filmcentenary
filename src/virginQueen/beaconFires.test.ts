import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveNaval, playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [], player = "2"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Beacon Fires (card #14)", () => {
    it("makes the next interception automatic", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-014")) G.powers.england.cards.push("vq-014");

        expect(playCard(G, context([], "2"), {cardId: "vq-014", asEvent: true})).toBeUndefined();
        expect(G.beaconFires).toBe("england");

        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([6, 6, 6, 6], "3"), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.beaconFires).toBeUndefined();
        expect(G.log.join("\n")).toContain("Beacon Fires");
    });
});
