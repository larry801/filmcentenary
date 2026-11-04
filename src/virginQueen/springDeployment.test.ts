import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount} from "./constant/general";
import {springDeploy} from "./moves";
import {setupGame, zonePorts} from "./util";

const context = (player = "0"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "spring",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame({...context(), phase: "action"} as Ctx);
    G.springDone = [];
    return G;
};

describe("spring deployment (rule 10.6)", () => {
    it("moves a formation over a multi-space friendly land path", () => {
        const G = game();
        const before = landCount(G.spaces.athens.land.ottoman);

        expect(springDeploy(G, context(), {
            from: "istanbul", to: "athens", units: {regular: 2}, leaders: ["mehmed"],
        })).toBeUndefined();

        expect(landCount(G.spaces.athens.land.ottoman)).toBe(before + 2);
        expect(G.leaders.mehmed.location).toBe("athens");
        expect(G.springDone).toContain("ottoman");
    });

    it("limits the formation to the leaders' command capacity", () => {
        const G = game();
        const before = landCount(G.spaces.istanbul.land.ottoman);

        expect(springDeploy(G, context(), {
            from: "istanbul", to: "edirne", units: {regular: 7}, leaders: ["mehmed"],
        })).toBe(INVALID_MOVE);
        expect(springDeploy(G, context(), {
            from: "istanbul", to: "edirne", units: {regular: 5}, leaders: [],
        })).toBe(INVALID_MOVE);
        expect(landCount(G.spaces.istanbul.land.ottoman)).toBe(before);
        expect(G.springDone).not.toContain("ottoman");
    });

    it("rejects a path through a space containing foreign units", () => {
        const G = game();
        G.spaces.athens.land.spain = {regular: 1, merc: 0, cav: 0};

        expect(springDeploy(G, context(), {
            from: "istanbul", to: "athens", units: {regular: 2}, leaders: ["mehmed"],
        })).toBe(INVALID_MOVE);
        expect(G.springDone).not.toContain("ottoman");
    });

    it("rejects an unrest destination", () => {
        const G = game();
        G.spaces.athens.unrest = true;

        expect(springDeploy(G, context(), {
            from: "istanbul", to: "athens", units: {regular: 2}, leaders: ["mehmed"],
        })).toBe(INVALID_MOVE);
    });

    it("crosses a single sea zone between friendly ports", () => {
        const G = game();
        for (const port of zonePorts("gulfOfLyon")) G.spaces[port].naval = {};
        const before = landCount(G.spaces.genoa.land.spain);

        expect(springDeploy(G, context("1"), {
            from: "madrid", to: "genoa", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(landCount(G.spaces.genoa.land.spain)).toBe(before + 2);
        expect(G.springDone).toContain("spain");
    });

    it("blocks a sea crossing when another major power has naval units in a bordering port", () => {
        const G = game();
        for (const port of zonePorts("gulfOfLyon")) G.spaces[port].naval = {};
        G.spaces.marseille.naval.france = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};

        expect(springDeploy(G, context("1"), {
            from: "madrid", to: "genoa", units: {regular: 2}, leaders: [],
        })).toBe(INVALID_MOVE);
    });

    it("allows at most 5 units to cross a sea zone", () => {
        const G = game();
        for (const port of zonePorts("gulfOfLyon")) G.spaces[port].naval = {};

        expect(springDeploy(G, context("1"), {
            from: "madrid", to: "genoa", units: {regular: 6}, leaders: ["donJohn"],
        })).toBe(INVALID_MOVE);
    });

    it("allows only one spring deployment per power", () => {
        const G = game();
        expect(springDeploy(G, context(), {
            from: "istanbul", to: "edirne", units: {regular: 2}, leaders: ["mehmed"],
        })).toBeUndefined();
        expect(springDeploy(G, context(), {
            from: "istanbul", to: "edirne", units: {regular: 2}, leaders: ["mehmed"],
        })).toBe(INVALID_MOVE);
    });

    it("allows three army leaders and caps the formation with the two highest command ratings", () => {
        const G = game();
        const leaders = ["guise", "henryIII", "montmorency"];
        // Rule 4.2: three leaders still form a legal formation; the two
        // highest command ratings (7 + 6) cap it at 13 land units.
        for (const space of Object.values(G.spaces)) {
            space.leaders = space.leaders.filter((id) => !leaders.includes(id));
        }
        for (const id of leaders) G.leaders[id] = {id, location: "paris"};
        G.spaces.paris.leaders = [...leaders];
        G.spaces.paris.land.france = {regular: 14, merc: 0, cav: 0};

        expect(springDeploy(G, context("3"), {
            from: "paris", to: "reims", units: {regular: 14}, leaders,
        })).toBe(INVALID_MOVE);
        expect(springDeploy(G, context("3"), {
            from: "paris", to: "reims", units: {regular: 13}, leaders,
        })).toBeUndefined();

        expect(G.leaders.guise.location).toBe("reims");
        expect(G.leaders.henryIII.location).toBe("reims");
        expect(G.leaders.montmorency.location).toBe("reims");
    });
});
