import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveExpedition} from "./moves";
import {returnSeaCaptains, setupGame} from "./util";

const context = (values: number[], player = "2"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    G.powers.england.cp = 2;
    G.worldCaptains.drake = {power: "england", location: "chileanCoast", damaged: false, colony: false};
};

describe("Navigation Table (rule 16.4)", () => {
    it("eliminates the expedition on 2-6", () => {
        const G = game();
        prepare(G);

        expect(moveExpedition(G, context([1, 2]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.seaCaptainReturn?.drake).toBeUndefined();
        expect(G.lastRolls).toContain("= 6");
    });

    it("damages the expedition on 7-8", () => {
        const G = game();
        prepare(G);

        expect(moveExpedition(G, context([2, 3]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake.location).toBe("southAtlantic");
        expect(G.worldCaptains.drake.damaged).toBe(true);
    });

    it("eliminates an already damaged expedition on a second damaged result", () => {
        const G = game();
        prepare(G);
        G.worldCaptains.drake.damaged = true;

        expect(moveExpedition(G, context([2, 3]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.seaCaptainReturn?.drake).toMatchObject({power: "england", turn: G.year + 1});
    });

    it("returns Murat Reis to the Turn Track instead of removing him", () => {
        const G = game();
        G.powers.ottoman.cp = 2;
        G.powers.ottoman.seaCaptains = G.powers.ottoman.seaCaptains.filter((id) => id !== "muratReis");
        G.worldCaptains.muratReis = {power: "ottoman", location: "chileanCoast", damaged: false, colony: false};

        expect(moveExpedition(G, context([1, 2], "0"), {captain: "muratReis", zone: "southAtlantic"})).toBeUndefined();

        expect(G.seaCaptainReturn?.muratReis).toMatchObject({power: "ottoman", turn: G.year + 1});
        expect(G.powers.ottoman.seaCaptains).not.toContain("muratReis");
    });

    it("requires a check when moving against a trade wind", () => {
        const G = game();
        G.powers.england.cp = 2;
        G.worldCaptains.drake = {power: "england", location: "southAtlantic", damaged: false, colony: false};

        expect(moveExpedition(G, context([1, 2]), {captain: "drake", zone: "guineaCoast"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.lastRolls).toContain("Navigation");
    });

    it("does not check when moving with a trade wind", () => {
        const G = game();
        G.powers.england.cp = 2;
        G.worldCaptains.drake = {power: "england", location: "guineaCoast", damaged: false, colony: false};

        expect(moveExpedition(G, context([1, 2]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake.location).toBe("southAtlantic");
        expect(G.worldCaptains.drake.damaged).toBe(false);
    });

    it("returns a Turn Track captain to the pool in a later Card Draw", () => {
        const G = game();
        G.powers.england.seaCaptains = G.powers.england.seaCaptains.filter((id) => id !== "drake");
        G.seaCaptainReturn = {drake: {power: "england", turn: G.year}};

        returnSeaCaptains(G);

        expect(G.powers.england.seaCaptains).toContain("drake");
        expect(G.seaCaptainReturn?.drake).toBeUndefined();
    });

    it("survives on 9+ and adds the Map Projection bonus", () => {
        const safe = game();
        prepare(safe);
        expect(moveExpedition(safe, context([6, 6]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();
        expect(safe.worldCaptains.drake.location).toBe("southAtlantic");
        expect(safe.worldCaptains.drake.damaged).toBe(false);

        const projection = game();
        prepare(projection);
        projection.powers.england.scienceBonuses = ["mapProjection"];
        expect(moveExpedition(projection, context([1, 2]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();
        expect(projection.worldCaptains.drake.damaged).toBe(true);
        expect(projection.lastRolls).toContain("Map Projection");
    });
});
