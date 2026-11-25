import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {attemptNavalInterception, resolveNavalCombatEnemy} from "./navalCombat";
import {setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("naval interception (rule 16.1 steps 2 and 4)", () => {
    it("refuses to intercept a fleet entering a port", () => {
        const G = game();
        G.powers.england.wars = [...new Set([...G.powers.england.wars, "france"])];
        G.powers.france.wars = [...new Set([...G.powers.france.wars, "england"])];
        G.spaces.brest.naval.france = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        G.seaZones.atlanticOcean.naval.england = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};

        expect(attemptNavalInterception(G, context([6, 6]), "france", "bayOfBiscay", "brest", false)).toBe(false);
    });

    it("refuses to intercept a fleet joining friendly ships in a sea zone", () => {
        const G = game();
        G.powers.england.wars = [...new Set([...G.powers.england.wars, "france"])];
        G.powers.france.wars = [...new Set([...G.powers.france.wars, "england"])];
        G.seaZones.bayOfBiscay.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.atlanticOcean.naval.england = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};

        expect(attemptNavalInterception(G, context([6, 6]), "france", "northAtlantic", "bayOfBiscay",
            false, undefined, undefined, false, true)).toBe(false);
    });
});

describe("naval leaders of a destroyed fleet (rule 16.2 step 10)", () => {
    it("places the leader on the Turn Track when his side is eliminated", () => {
        const G = game();
        G.powers.england.wars = [...new Set([...G.powers.england.wars, "france"])];
        G.powers.france.wars = [...new Set([...G.powers.france.wars, "england"])];
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.northSea.naval.france = {galley: 0, galleon: 3, racebuilt: 0, corsair: 0};
        G.seaZones.northSea.leaders = ["howard"];
        G.leaders.howard = {id: "howard", location: "northSea"};

        // England rolls two 1s; France's six dice all hit.
        resolveNavalCombatEnemy(G, context([1, 1, 6, 6, 6, 6, 6, 6]), "northSea", "england", "france");

        expect(G.seaZones.northSea.naval.england).toBeUndefined();
        expect(G.leaders.howard.location).toBe("pool");
        expect(G.leaders.howard.returnTurn).toBe(G.year + 1);
        expect(G.seaZones.northSea.leaders).not.toContain("howard");
    });
});
