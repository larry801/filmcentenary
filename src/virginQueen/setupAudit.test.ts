import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {proposeBetroth} from "./moves";
import {dealYear, setupGame} from "./util";

const context = (player = "1", phase = "action", numPlayers = 6): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

describe("Sea Captain Table arrivals (rule 8.1 / Scenario Book p. 34)", () => {
    it("adds Drake to the English pool in Campaign Turn 3", () => {
        const G = setupGame(context());
        expect(G.powers.england.seaCaptains).not.toContain("drake");
        G.year = 3;
        dealYear(G, context());
        expect(G.powers.england.seaCaptains).toContain("drake");
    });

    it("adds the later English captains in Tournament Turns 4 and 5", () => {
        const G: VQGame = setupGame(context(), {scenario: "tournament"});
        G.year = 4;
        dealYear(G, context());
        expect(G.powers.england.seaCaptains).toContain("frobisher");

        G.year = 5;
        dealYear(G, context());
        expect(G.powers.england.seaCaptains).toEqual(expect.arrayContaining(["raleigh", "cavendish"]));
        expect(G.powers.protestant.seaCaptains).toContain("vanNoort");
    });
});

describe("Scenario extras in the setup tables", () => {
    it("places Spain's Tournament Treasure Fleet escort galleon", () => {
        const G = setupGame(context(), {scenario: "tournament"});
        expect(G.treasureFleetEscorts).toBe(1);
    });

    it("leaves the Tutorial without the Campaign's Seville galleon or Dublin garrison", () => {
        const G = setupGame(context("0", "action", 2), {scenario: "tutorial"});
        expect(G.spaces.seville.naval.spain).toBeUndefined();
        // England's pieces are not used in the Tutorial (Scenario Book p. 4).
        expect(G.spaces.dublin.land.england).toBeUndefined();
        expect(G.spaces.dublin.control).not.toBe("england");
    });
});

describe("same-power marriages (rules 9.1 and 21.1)", () => {
    it("lets France marry Mary Queen of Scots to a French royal", () => {
        const G = setupGame(context());
        G.year = 3;
        // Mary Queen of Scots and Charles IX are both French royals.
        const mary = G.royals.find((r) => r.id === "maryScots");
        const charles = G.royals.find((r) => r.id === "charlesIX");
        if (mary === undefined || charles === undefined) return;
        mary.status = "available";
        mary.alive = true;
        G.espionage!.mary = "scotland";

        expect(proposeBetroth(G, context("3", "diplomacy"), {male: "charlesIX", female: "maryScots"})).toBeUndefined();
        expect(G.betrothals.some((b) => b.male === "charlesIX" && b.female === "maryScots")).toBe(true);
    });

    it("lets Elizabeth I marry Leicester within England", () => {
        const G = setupGame(context());
        expect(proposeBetroth(G, context("2", "diplomacy"), {male: "leicester", female: "elizabeth"})).toBeUndefined();
        expect(G.betrothals.some((b) => b.male === "leicester" && b.female === "elizabeth")).toBe(true);
    });
});
