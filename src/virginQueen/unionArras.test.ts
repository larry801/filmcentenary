import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {buildNaval, playCard, recruit} from "./moves";
import {SPACES} from "./mapData";
import {rebellionTargets, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Union of Arras (card #109)", () => {
    it("can choose the five secured spaces", () => {
        const G = game();
        G.powers.spain.cards = ["vq-109"];
        const chosen = ["brussels", "ghent", "antwerp", "rotterdam", "flushing"];

        expect(playCard(G, context(), {cardId: "vq-109", asEvent: true, target: chosen.join(":")})).toBeUndefined();

        for (const id of chosen) {
            expect(G.spaces[id].control).toBe("spain");
            expect(G.spaces[id].religion).toBe("catholic");
        }
    });

    it("removes Dutch mercenaries and secures five spaces", () => {
        const G = game();
        G.powers.spain.cards = ["vq-109"];
        G.spaces.brussels.land.spain = {regular: 2, merc: 3, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-109", asEvent: true})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.regular).toBe(0);
        expect(G.spaces.brussels.land.spain?.merc).toBeLessThanOrEqual(4);
        expect(G.unionOfArras).toBe(true);
        expect(SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].control === "spain").length).toBeGreaterThanOrEqual(5);
        expect(G.removed).toContain("vq-109");
        expect(rebellionTargets(G).some((id) => SPACES.find((space) => space.id === id)?.area === "netherlands")).toBe(false);
        expect(G.dutchSpanishHome).toBe(true);
        G.powers.spain.cp = 20;
        expect(recruit(G, context(), {space: "amsterdam", kind: "regular"})).toBeUndefined();
        expect(buildNaval(G, context(), {port: "amsterdam", kind: "galleon"})).toBeUndefined();
    });
});
