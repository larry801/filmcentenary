import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseBattle, startBattle} from "./combat";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const defenseDice = (armada: boolean): number => {
    const G = setupGame({...context("0"), phase: "action"} as Ctx);
    G.seaZones.northSea.naval.france = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    G.seaZones.northSea.naval.england = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    G.powers.england.cards = ["vq-009"];
    if (armada) G.armada = {strength: 4, location: "northSea"};
    startBattle(G, context("0"), "naval", "northSea", "france", ["england"], "calais");
    chooseBattle(G, context("2"), {choice: "fight"});
    chooseBattle(G, context("3"), {choice: "done"});
    chooseBattle(G, context("2"), {choice: "card:vq-009"});
    chooseBattle(G, context("2"), {choice: "done"});
    return G.pendingBattle!.rolls!.defender.length;
};

describe("Fire Ships (card #9)", () => {
    it("rolls four extra dice against the Armada", () => {
        expect(defenseDice(true)).toBe(defenseDice(false) + 2);
    });
});
