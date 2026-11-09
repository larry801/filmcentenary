import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {influence, recruit} from "./moves";
import {setupGame} from "./util";

const context = (player = "1"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    events: {endStage: () => undefined},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Jilted by Elizabeth compensation (rule 23.3)", () => {
    it("spends restricted CP on diplomatic influence", () => {
        const G = game();
        G.powers.spain.cp = 0;
        G.powers.spain.jiltedCp = 2;
        const before = G.powers.spain.influence.papacy ?? 0;

        expect(influence(G, context(), {target: "papacy"})).toBeUndefined();

        expect(G.powers.spain.influence.papacy).toBe(before + 1);
        expect(G.powers.spain.jiltedCp).toBe(1);
        expect(G.powers.spain.cp).toBe(0);
    });

    it("spends restricted CP on mercenaries in an eligible home space", () => {
        const G = game();
        G.powers.spain.cp = 0;
        G.powers.spain.jiltedCp = 1;
        const before = G.spaces.madrid.land.spain?.merc ?? 0;

        expect(recruit(G, context(), {space: "madrid", kind: "merc"})).toBeUndefined();

        expect(G.spaces.madrid.land.spain?.merc).toBe(before + 1);
        expect(G.powers.spain.jiltedCp).toBeUndefined();
    });

    it("does not spend restricted CP on regulars or other actions", () => {
        const G = game();
        G.powers.spain.cp = 0;
        G.powers.spain.jiltedCp = 2;

        expect(recruit(G, context(), {space: "madrid", kind: "regular"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.jiltedCp).toBe(2);
    });
});
