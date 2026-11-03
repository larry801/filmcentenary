import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount, navalCount} from "./constant/general";
import {buildNaval, recruit} from "./moves";
import {setupGame} from "./util";

const context = (player = "0"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

describe("construction costs and restrictions (rules 17.2-17.3)", () => {
    it("charges 2 CP for a regular and 1 CP for mercenaries or cavalry", () => {
        const G = game();
        G.powers.ottoman.cp = 3;
        expect(recruit(G, context("0"), {space: "istanbul", kind: "regular"})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(1);
        expect(recruit(G, context("0"), {space: "istanbul", kind: "cav"})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(0);

        G.powers.france.cp = 1;
        const before = G.spaces.paris.land.france?.merc ?? 0;
        expect(recruit(G, context("3"), {space: "paris", kind: "merc"})).toBeUndefined();
        expect(G.powers.france.cp).toBe(0);
        expect(G.spaces.paris.land.france?.merc).toBe(before + 1);
    });

    it("builds in any controlled home space, including unfortified ones", () => {
        const G = game();
        G.spaces.amiens.control = "france";
        G.spaces.amiens.unrest = false;
        G.spaces.amiens.land = {};
        G.powers.france.cp = 2;
        const before = landCount(G.spaces.amiens.land.france);

        expect(recruit(G, context("3"), {space: "amiens", kind: "regular"})).toBeUndefined();
        expect(landCount(G.spaces.amiens.land.france)).toBe(before + 1);
        expect(G.powers.france.cp).toBe(0);
    });

    it("rejects construction outside a power's own home spaces", () => {
        const G = game();
        G.powers.france.cp = 2;
        expect(recruit(G, context("3"), {space: "edinburgh", kind: "regular"})).toBe(INVALID_MOVE);
        expect(G.powers.france.cp).toBe(2);
    });

    it("applies the Ottoman and Spanish land-construction exceptions", () => {
        const G = game();
        G.powers.ottoman.cp = 4;
        expect(recruit(G, context("0"), {space: "algiers", kind: "regular"})).toBe(INVALID_MOVE);
        expect(recruit(G, context("0"), {space: "tripoli", kind: "regular"})).toBe(INVALID_MOVE);

        G.powers.spain.cp = 4;
        expect(recruit(G, context("1"), {space: "oran", kind: "regular"})).toBe(INVALID_MOVE);
        expect(recruit(G, context("1"), {space: "malta", kind: "regular"})).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cp).toBe(4);
        expect(G.powers.spain.cp).toBe(4);
    });

    it("charges 2 CP for galleys and restricts Ottoman galleys at Algiers/Tripoli", () => {
        const G = game();
        G.powers.spain.cp = 2;
        const before = navalCount(G.spaces.barcelona.naval.spain);
        expect(buildNaval(G, context("1"), {port: "barcelona", kind: "galley"})).toBeUndefined();
        expect(navalCount(G.spaces.barcelona.naval.spain)).toBe(before + 1);
        expect(G.powers.spain.cp).toBe(0);

        G.powers.spain.cp = 1;
        expect(buildNaval(G, context("1"), {port: "barcelona", kind: "galley"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.cp).toBe(1);

        G.powers.ottoman.cp = 2;
        expect(buildNaval(G, context("0"), {port: "algiers", kind: "galley"})).toBe(INVALID_MOVE);
        expect(buildNaval(G, context("0"), {port: "tripoli", kind: "galley"})).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cp).toBe(2);
    });

    it("allows corsairs in the excluded Ottoman ports and Spanish galleys at Oran", () => {
        const G = game();
        G.powers.ottoman.cp = 1;
        expect(buildNaval(G, context("0"), {port: "algiers", kind: "corsair"})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(0);

        G.powers.spain.cp = 2;
        expect(buildNaval(G, context("1"), {port: "oran", kind: "galley"})).toBeUndefined();
        expect(G.powers.spain.cp).toBe(0);
    });

    it("requires an Atlantic port for galleons", () => {
        const G = game();
        G.powers.spain.cp = 4;
        expect(buildNaval(G, context("1"), {port: "barcelona", kind: "galleon"})).toBe(INVALID_MOVE);
        expect(buildNaval(G, context("1"), {port: "seville", kind: "galleon"})).toBeUndefined();
        expect(G.powers.spain.cp).toBe(2);
    });
});
