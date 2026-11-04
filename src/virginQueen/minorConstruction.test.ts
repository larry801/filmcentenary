import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {buildFortress, buildNaval, recruit} from "./moves";
import {setupGame} from "./util";

/**
 * Phase 3: minor powers 24.3 (Active) and 24.4 (Deactivation via diplomacy).
 * An allied major may recruit/build in its minor's home spaces.
 */

const context = (p: Power = "spain"): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => 6, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    for (const p of POWERS) {
        G.powers[p].cards = [];
        G.powers[p].cp = 20;
    }
    return G;
};

describe("minor powers 24.3 — allied construction", () => {
    it("recruits a papal regular in a papal home controlled by papacy", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("papacy");
        G.spaces.rome.control = "papacy";
        G.spaces.rome.unrest = false;

        const before = G.spaces.rome.land.papacy?.regular ?? 0;
        expect(recruit(G, context(), {space: "rome", kind: "regular"})).toBeUndefined();
        expect(G.spaces.rome.land.papacy?.regular).toBe(before + 1);
        expect(G.powers.spain.cp).toBe(18);
    });

    it("builds a Venetian galley in a Venetian home port", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("venice");
        G.spaces.venice.control = "venice";
        G.spaces.venice.unrest = false;
        G.spaces.venice.fortress = true;

        const before = G.spaces.venice.naval.venice?.galley ?? 0;
        expect(buildNaval(G, context(), {port: "venice", kind: "galley"})).toBeUndefined();
        expect(G.spaces.venice.naval.venice?.galley).toBe(before + 1);
    });

    it("builds a fortress in an allied minor open home", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("scotland");
        G.spaces.perth.control = "scotland";
        G.spaces.perth.unrest = false;
        G.spaces.perth.fortress = false;

        expect(buildFortress(G, context(), {space: "perth"})).toBeUndefined();
        expect(G.spaces.perth.fortress).toBe(true);
    });

    it("rejects minor construction without the alliance", () => {
        const G = game();
        G.powers.spain.alliedMinors = G.powers.spain.alliedMinors.filter((m) => m !== "papacy");
        G.spaces.rome.control = "papacy";
        expect(recruit(G, context(), {space: "rome", kind: "regular"})).toBe("INVALID_MOVE");
    });
});
