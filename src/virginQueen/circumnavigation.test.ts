import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveExpedition} from "./moves";
import {setupGame} from "./util";

const context = (values: number[], player = "2"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const prepare = (G: VQGame, route: string[], location: string): void => {
    G.powers.england.cp = 2;
    G.worldCaptains.drake = {power: "england", location, damaged: false, colony: false, route};
};

describe("circumnavigation (rule 16.6)", () => {
    it("awards 2 VP for the first circumnavigation", () => {
        const G = game();
        prepare(G, ["guineaCoast", "indianOcean", "chileanCoast"], "chileanCoast");
        const vp = G.powers.england.bonusVp;

        expect(moveExpedition(G, context([6, 6]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.circumnavigations).toBe(1);
        expect(G.powers.england.bonusVp).toBe(vp + 2);
        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.seaCaptainReturn?.drake).toMatchObject({power: "england", turn: G.year + 1});
    });

    it("awards 1 VP after the first circumnavigation", () => {
        const G = game();
        prepare(G, ["guineaCoast", "indianOcean", "chileanCoast"], "chileanCoast");
        G.circumnavigations = 1;
        const vp = G.powers.england.bonusVp;

        expect(moveExpedition(G, context([6, 6]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.circumnavigations).toBe(2);
        expect(G.powers.england.bonusVp).toBe(vp + 1);
    });

    it("delivers loot treasures to the hand when the voyage completes", () => {
        const G = game();
        prepare(G, ["guineaCoast", "indianOcean", "chileanCoast"], "chileanCoast");
        G.worldCaptains.drake.treasureValues = [4, 5];
        const before = [...G.powers.england.treasures];

        expect(moveExpedition(G, context([6, 6]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.powers.england.treasures).toEqual([...before, 4, 5]);
        expect(G.worldCaptains.drake).toBeUndefined();
    });

    it("does not award VP without the prerequisite Indian Ocean leg", () => {
        const G = game();
        prepare(G, ["chileanCoast"], "chileanCoast");

        expect(moveExpedition(G, context([6, 6]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.circumnavigations).toBeUndefined();
        expect(G.worldCaptains.drake.location).toBe("southAtlantic");
    });

    it("handles the Ottoman Indian Ocean return route", () => {
        const G = game();
        G.powers.ottoman.cp = 2;
        G.worldCaptains.muratReis = {
            power: "ottoman", location: "guineaCoast", damaged: false, colony: false,
            route: ["indianOcean", "southPacific", "guineaCoast"],
        };
        const vp = G.powers.ottoman.bonusVp;

        expect(moveExpedition(G, context([6, 6], "0"), {captain: "muratReis", zone: "indianOcean"})).toBeUndefined();

        expect(G.circumnavigations).toBe(1);
        expect(G.powers.ottoman.bonusVp).toBe(vp + 2);
    });
});
