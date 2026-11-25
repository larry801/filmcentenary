import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {applyConversionRolls, religionCandidates, resolveRebellion, setupGame} from "./util";

const context = (values: number[] = [], player = "5"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

describe("conversion base areas (rule 18.5 condition b)", () => {
    it("does not chain through spaces flipped by the same action", () => {
        const G = game();
        for (const space of SPACES.filter((def) => def.area === "france")) {
            G.spaces[space.id].religion = space.id === "paris" ? "protestant" : "catholic";
            G.spaces[space.id].unrest = false;
            G.spaces[space.id].land = {};
            G.spaces[space.id].naval = {};
        }
        // Every space that was Protestant when the step began is a legal base
        // (condition b allows ports connected through a sea zone too).
        const startBase = SPACES.filter((def) => G.spaces[def.id].religion === "protestant").map((def) => def.id);
        const legalBase = religionCandidates(G, "protestant", "france", startBase);

        applyConversionRolls(G, context(), "protestant", "protestant", "france", [4, 4, 4, 4, 4, 4]);

        const flipped = SPACES.filter((def) => def.area === "france" && def.id !== "paris" &&
            G.spaces[def.id].religion === "protestant").map((def) => def.id);
        expect(flipped.length).toBeGreaterThan(0);
        expect(flipped.every((id) => legalBase.includes(id))).toBe(true);
    });
});

describe("rebellion casualties (rule 18.5 rebellion steps 2-3)", () => {
    it("ignores and displaces a third power's Catholic units", () => {
        const G = game();
        G.spaces.rouen.religion = "protestant";
        G.spaces.rouen.control = "france";
        G.spaces.rouen.siege = undefined;
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {
            france: {regular: 1, merc: 0, cav: 0},
            spain: {regular: 1, merc: 0, cav: 0},
        };

        // One hit eliminates the single French regular; the Spanish one is not
        // the space owner's unit, so the rebellion still succeeds.
        expect(resolveRebellion(G, context([5, 1]), "protestant", "rouen", 2)).toBe(true);
        expect(G.spaces.rouen.control).toBe("protestant");
        expect(G.spaces.rouen.land.spain).toBeUndefined();
    });
});
