import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {battleOptions, chooseBattle, startBattle} from "./combat";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const offered = (zone: string): boolean => {
    const G = setupGame({...context("0"), phase: "action"} as Ctx);
    G.seaZones[zone as keyof VQGame["seaZones"]].naval.france = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    G.seaZones[zone as keyof VQGame["seaZones"]].naval.england = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    G.powers.france.cards = ["vq-012"];
    startBattle(G, context("0"), "naval", zone, "france", ["england"], "venice");
    chooseBattle(G, context("2"), {choice: "fight"});
    chooseBattle(G, context("3"), {choice: "done"});
    chooseBattle(G, context("2"), {choice: "done"});
    return battleOptions(G).some((option) => option.id.startsWith("card:vq-012"));
};

describe("Venetian Galleasses (card #12)", () => {
    it("is only offered in the Mediterranean", () => {
        expect(offered("aegean")).toBe(true);
        expect(offered("northSea")).toBe(false);
    });
});
