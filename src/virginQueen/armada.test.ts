import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveNaval, playCard, upgradeArmada} from "./moves";
import {applyNavalCombatLosses, navalCombatDice} from "./navalCombat";
import {setupGame} from "./util";

const context = (values: number[] = [], player = "1"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Spanish Armada (rule 23.2)", () => {
    it("places the Armada and grants 5 CP from the home card", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-099")) G.powers.spain.cards.push("vq-099");
        G.spaces.seville.control = "spain";
        G.spaces.seville.unrest = false;
        G.powers.spain.cp = 0;

        expect(playCard(G, context(), {cardId: "vq-099", asEvent: true})).toBeUndefined();

        expect(G.armada).toEqual({strength: 2, location: "seville"});
        expect(G.powers.spain.cp).toBe(5);
    });

    it("grants 7 CP when the Armada is already on the map", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-099")) G.powers.spain.cards.push("vq-099");
        G.armada = {strength: 4, location: "seville"};
        G.powers.spain.cp = 0;

        expect(playCard(G, context(), {cardId: "vq-099", asEvent: true})).toBeUndefined();

        expect(G.armada.strength).toBe(4);
        expect(G.powers.spain.cp).toBe(7);
    });

    it("upgrades only in a legal port and only up to strength 8", () => {
        const G = game();
        G.armada = {strength: 2, location: "seville"};
        G.powers.spain.cp = 6;

        expect(upgradeArmada(G, context())).toBeUndefined();
        expect(G.armada.strength).toBe(4);
        expect(G.powers.spain.cp).toBe(3);

        G.armada.location = "englishChannel";
        expect(upgradeArmada(G, context())).toBe(INVALID_MOVE);
    });

    it("adds its strength to naval dice and absorbs hits before ships", () => {
        const G = game();
        G.armada = {strength: 4, location: "englishChannel"};
        G.seaZones.englishChannel.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(navalCombatDice(G, "englishChannel", ["spain"], false)).toBe(6);

        expect(applyNavalCombatLosses(G, "englishChannel", ["spain"], 2, false, [])).toBe(0);
        expect(G.armada.strength).toBe(2);
        expect(G.seaZones.englishChannel.naval.spain.galleon).toBe(1);

        expect(applyNavalCombatLosses(G, "englishChannel", ["spain"], 2, false, [])).toBe(0);
        expect(G.armada).toBeUndefined();
        expect(G.seaZones.englishChannel.naval.spain.galleon).toBe(1);
    });

    it("moves with a Spanish naval stack from its location", () => {
        const G = game();
        G.powers.spain.cp = 1;
        G.armada = {strength: 2, location: "englishChannel"};
        G.seaZones.englishChannel.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([6, 6]), {from: "englishChannel", to: "northSea"})).toBeUndefined();

        expect(G.armada.location).toBe("northSea");
    });
});
