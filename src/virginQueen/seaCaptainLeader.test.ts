import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {placeSeaCaptainLeader} from "./moves";
import {bestBattle, setupGame, winter} from "./util";

const context = (player = "2", phase = "spring"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("English sea captains as naval leaders (rule 10.2)", () => {
    it("places an available captain as a naval leader in an English home port", () => {
        const G = game();
        expect(G.powers.england.seaCaptains).toContain("hawkins");
        expect(G.spaces.portsmouth.naval.england).toBeDefined();

        expect(placeSeaCaptainLeader(G, context(), {captain: "hawkins", port: "portsmouth"})).toBeUndefined();

        expect(G.leaders["captain-hawkins"].location).toBe("portsmouth");
        expect(G.spaces.portsmouth.leaders).toContain("captain-hawkins");
        expect(G.powers.england.seaCaptains).not.toContain("hawkins");
        expect(bestBattle(G, "portsmouth", ["england"], "naval")).toBe(1);
    });

    it("requires spring, an available captain and a home port with an English fleet", () => {
        const G = game();
        expect(placeSeaCaptainLeader(G, context("2", "action"), {captain: "hawkins", port: "portsmouth"})).toBe(INVALID_MOVE);
        expect(placeSeaCaptainLeader(G, context("2"), {captain: "hawkins", port: "york"})).toBe(INVALID_MOVE);
        expect(placeSeaCaptainLeader(G, context("3"), {captain: "hawkins", port: "portsmouth"})).toBe(INVALID_MOVE);
        expect(G.powers.england.seaCaptains).toContain("hawkins");
    });

    it("returns the captain to the pool during the Winter Phase", () => {
        const G = game();
        placeSeaCaptainLeader(G, context(), {captain: "hawkins", port: "portsmouth"});

        winter(G, context("2", "action"));

        expect(G.leaders["captain-hawkins"]).toBeUndefined();
        expect(G.spaces.portsmouth.leaders).not.toContain("captain-hawkins");
        expect(G.powers.england.seaCaptains).toContain("hawkins");
    });
});
