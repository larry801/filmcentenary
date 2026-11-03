import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {SPACE_BY_ID, SPACES} from "./mapData";
import {makePeace, moveLand} from "./moves";
import {atWar, checkCatholicLeague, isFortifiedSpace, setupGame, winter} from "./util";

const context = (roll = 6, numPlayers = 6): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers,
    random: {Die: () => roll, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

const frenchRegulars = (G: VQGame): number =>
    SPACES.reduce((total, space) => total + (G.spaces[space.id].land.france?.regular ?? 0), 0);

const frenchMercenaries = (G: VQGame): number =>
    SPACES.reduce((total, space) => total + (G.spaces[space.id].land.france?.merc ?? 0), 0);

const giveProtestantKeys = (G: VQGame): void => {
    for (const id of ["paris", "lyon", "laRochelle"]) {
        G.spaces[id].control = "protestant";
    }
};

const giveProtestantHomes = (G: VQGame, count: number): void => {
    const homes = ["amiens", "bourges", "clermont", "toulouse", "nantes", "rennes"];
    for (const id of homes.slice(0, count)) {
        G.spaces[id].control = "protestant";
    }
};

describe("Catholic League formation (rule 20.10)", () => {
    it("adds Reims as an unfortified French home space", () => {
        const G = game();
        expect(G.spaces.reims).toBeDefined();
        expect(G.spaces.reims.control).toBe("france");
        expect(G.spaces.reims.religion).toBe("catholic");
        expect(isFortifiedSpace(G, "reims")).toBe(false);
    });

    it("does not check before turn 3 or in the tutorial", () => {
        const early = game();
        early.year = 2;
        giveProtestantKeys(early);
        expect(checkCatholicLeague(early, context())).toBe(false);

        const tutorial = setupGame(context(3, 2), {scenario: "tutorial"});
        tutorial.year = 4;
        expect(checkCatholicLeague(tutorial, context(3, 2))).toBe(false);
    });

    it("forms automatically when the Protestants control three keys in France", () => {
        const G = game();
        G.year = 4;
        giveProtestantKeys(G);
        const regularsBefore = frenchRegulars(G);
        const mercsBefore = frenchMercenaries(G);

        expect(checkCatholicLeague(G, context())).toBe(true);

        expect(G.catholicLeagueFormed).toBe(true);
        expect(G.catholicLeagueSpaces).toHaveLength(3);
        expect(G.catholicLeagueSpaces![0]).toBe("reims");
        expect(G.spaces.reims.control).toBe("spain");
        expect(G.spaces.reims.religion).toBe("catholic");
        expect(G.spaces.reims.fortress).toBe(true);
        expect(isFortifiedSpace(G, "reims")).toBe(true);
        expect(G.spaces.reims.land.spain?.regular).toBe(Math.max(4, Math.ceil(regularsBefore / 3)));
        expect(G.spaces.reims.land.spain?.merc).toBe(Math.ceil(mercsBefore / 3));
        expect(frenchRegulars(G)).toBe(regularsBefore - Math.ceil(regularsBefore / 3));
        expect(frenchMercenaries(G)).toBe(mercsBefore - Math.ceil(mercsBefore / 3));
        expect(G.spaces.reims.leaders).toContain("guise");
        expect(G.leaders.guise.location).toBe("reims");
        expect(atWar(G, "spain", "france")).toBe(true);
        expect(atWar(G, "spain", "protestant")).toBe(true);
        expect(G.catholicLeagueNoDealsUntil).toBe(5);
        expect(G.log.join("\n")).toContain("Catholic League");
    });

    it("does not form with five French home spaces and fewer than three keys", () => {
        const G = game();
        G.year = 5;
        giveProtestantHomes(G, 5);
        expect(checkCatholicLeague(G, context())).toBe(false);
        expect(G.catholicLeagueFormed).toBeUndefined();
        expect(G.log.join("\n")).toContain("not formed this year");
    });

    it("rolls one die when more than five French home spaces are Protestant", () => {
        const formed = game();
        formed.year = 4;
        giveProtestantHomes(formed, 6);
        expect(checkCatholicLeague(formed, context(6))).toBe(true);
        expect(formed.log.join("\n")).toContain("6 French home space(s) + die 6 = 12");

        const failed = game();
        failed.year = 4;
        giveProtestantHomes(failed, 6);
        expect(checkCatholicLeague(failed, context(5))).toBe(false);
        expect(failed.log.join("\n")).toContain("6 French home space(s) + die 5 = 11");
    });

    it("does not repeat the formation procedure in a later winter", () => {
        const G = game();
        G.year = 4;
        giveProtestantKeys(G);
        expect(checkCatholicLeague(G, context())).toBe(true);
        const regulars = frenchRegulars(G);
        const spanish = G.spaces.reims.land.spain?.regular;

        expect(checkCatholicLeague(G, context())).toBe(false);
        expect(frenchRegulars(G)).toBe(regulars);
        expect(G.spaces.reims.land.spain?.regular).toBe(spanish);
    });

    it("runs at the end of winter and blocks deals during the next diplomacy segment", () => {
        const G = game();
        G.year = 4;
        giveProtestantKeys(G);

        winter(G, context());

        expect(G.catholicLeagueFormed).toBe(true);
        expect(G.year).toBe(5);
        expect(G.catholicLeagueNoDealsUntil).toBe(5);

        const diplomacy = {...context(), phase: "diplomacy", currentPlayer: "1"} as Ctx;
        expect(makePeace(G, diplomacy, {target: "france"})).toBe(INVALID_MOVE);

        G.year = 6;
        expect(makePeace(G, diplomacy, {target: "france"})).toBeUndefined();
        expect(atWar(G, "spain", "france")).toBe(false);
    });

    it("keeps the Duke of Guise inside the French religious struggle area", () => {
        const G = game();
        G.powers.france.cp = 4;
        G.spaces.paris.leaders = G.spaces.paris.leaders.filter((id) => id !== "guise");
        G.spaces.lyon.leaders.push("guise");
        G.leaders.guise = {id: "guise", location: "lyon"};
        G.spaces.lyon.land.france = {regular: 2, merc: 0, cav: 0};
        const ctx = {...context(), currentPlayer: "3", playerID: "3"} as Ctx;

        expect(moveLand(G, ctx, {from: "lyon", to: "geneva", leaders: ["guise"]})).toBe(INVALID_MOVE);
        expect(G.powers.france.cp).toBe(4);
        expect(G.leaders.guise.location).toBe("lyon");

        expect(moveLand(G, ctx, {from: "lyon", to: "dijon", leaders: ["guise"]})).toBeUndefined();
        expect(G.leaders.guise.location).toBe("dijon");
    });

    it("displaces a French garrison from a fortress built at Reims before formation", () => {
        const G = game();
        G.year = 4;
        G.spaces.reims.fortress = true;
        G.spaces.reims.land.france = {regular: 2, merc: 0, cav: 0};
        giveProtestantKeys(G);

        expect(checkCatholicLeague(G, context())).toBe(true);

        expect(G.spaces.reims.land.france).toBeUndefined();
        expect(G.spaces.reims.land.spain?.regular).toBeGreaterThanOrEqual(4);
        expect(SPACE_BY_ID.reims.name).toBe("Reims");
    });
});
