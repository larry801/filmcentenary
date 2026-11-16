import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {buildExpedition} from "./moves";
import {returnSeaCaptains, setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (scenario: "campaign" | "tournament" = "campaign"): VQGame =>
    setupGame(context("0"), {scenario});

// 5.2: de Sores and le Clerc are available to either France or the Protestant;
// whoever first builds an expedition with one has exclusive use until he
// returns to Europe. 17.4: the shared (split orange/blue) captains are taken
// by whoever sponsors their voyage first.  The claim therefore happens at
// Build Expedition, never during the Card Draw Phase.
describe("Shared sea captains (rules 5.2 / 17.4)", () => {
    it("keeps the shared captains in the common pool at setup, with no claim move", () => {
        const G = game();

        expect(G.seaCaptainsAvailable).toContain("deSores");
        expect(G.seaCaptainsAvailable).toContain("leClerc");
        expect(G.powers.france.seaCaptains).not.toContain("deSores");
        expect(G.powers.protestant.seaCaptains).not.toContain("deSores");
        expect(Object.keys(VirginQueenGameDef.moves ?? {})).not.toContain("claimSeaCaptain");
    });

    it("claims a shared captain for the first sponsor at Build Expedition", () => {
        const G = game();
        G.powers.france.cp = 1;

        expect(buildExpedition(G, context("3"), {captain: "deSores"})).toBeUndefined();

        expect(G.worldCaptains.deSores?.power).toBe("france");
        expect(G.powers.france.seaCaptains).toContain("deSores");
        expect(G.seaCaptainsAvailable).not.toContain("deSores");
        expect(G.powers.france.cp).toBe(0);
    });

    it("locks the captain out of the other shared power until he returns", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.powers.protestant.cp = 1;
        expect(buildExpedition(G, context("3"), {captain: "deSores"})).toBeUndefined();

        expect(buildExpedition(G, context("5"), {captain: "deSores"})).toBe(INVALID_MOVE);

        expect(G.powers.protestant.seaCaptains).not.toContain("deSores");
        expect(G.seaCaptainsAvailable).not.toContain("deSores");
        expect(G.worldCaptains.deSores?.power).toBe("france");
        expect(G.powers.protestant.cp).toBe(1);
    });

    it("does not let a third power build a shared captain", () => {
        const G = game();
        G.powers.england.cp = 1;

        expect(buildExpedition(G, context("2"), {captain: "leClerc"})).toBe(INVALID_MOVE);

        expect(G.worldCaptains.leClerc).toBeUndefined();
        expect(G.seaCaptainsAvailable).toContain("leClerc");
        expect(G.powers.england.cp).toBe(1);
    });

    it("returns a claimed captain to the first sponsor, not to the shared pool", () => {
        const G = game();
        G.powers.france.cp = 1;
        expect(buildExpedition(G, context("3"), {captain: "deSores"})).toBeUndefined();
        G.seaCaptainReturn = {deSores: {power: "france", turn: G.year + 1}};
        G.year += 1;

        returnSeaCaptains(G);

        expect(G.powers.france.seaCaptains).toContain("deSores");
        expect(G.seaCaptainsAvailable).not.toContain("deSores");
        expect(G.powers.protestant.seaCaptains).not.toContain("deSores");
    });

    it("uses the Tournament shared pool (de Sores only)", () => {
        const G = game("tournament");

        expect(G.seaCaptainsAvailable).toContain("deSores");
        expect(G.seaCaptainsAvailable).not.toContain("leClerc");
    });
});
