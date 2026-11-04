import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** Every Netherlands port that opens onto the North Sea. */
const northSeaPorts = (): string[] =>
    SPACES.filter((space) => space.area === "netherlands" && space.ports?.includes("northSea"))
        .map((space) => space.id);

const arrange = (G: VQGame, antwerpUnrest: boolean): void => {
    // Spain controls every eligible North Sea port; all of them are in unrest
    // except, in the normal case, Antwerp.
    for (const id of northSeaPorts()) {
        G.spaces[id].control = "spain";
        G.spaces[id].unrest = true;
    }
    G.spaces.antwerp.unrest = antwerpUnrest;

    G.powers.spain.cards = ["vq-110"];
    G.spaces.norwich.control = "england";
    G.spaces.norwich.unrest = false;
};

describe("Dunkirk Privateers (card #110) unrest guard", () => {
    it("rejects an Antwerp/Dunkirk port that is in unrest", () => {
        const G = game();
        arrange(G, true);
        G.spaces.dunkirk.control = "spain";
        G.spaces.dunkirk.unrest = true;

        expect(playCard(G, context(), {cardId: "vq-110", asEvent: true, target: "norwich"})).toBeUndefined();

        expect(G.pendingPiracy).toBeUndefined();
        expect(G.lastRolls).toBe("");
        expect(G.log.join("\n")).not.toContain("Dunkirk Privateers");
    });

    it("starts the free North Sea piracy when Antwerp is not in unrest", () => {
        const G = game();
        arrange(G, false);

        expect(playCard(G, context(), {cardId: "vq-110", asEvent: true, target: "norwich"})).toBeUndefined();

        expect(G.pendingPiracy?.zone).toBe("northSea");
        expect(G.pendingPiracy?.power).toBe("spain");
        expect(G.pendingPiracy?.remaining).toBe(4);
        expect(G.lastRolls).toContain("Dunkirk Privateers");
        expect(G.log.join("\n")).toContain("Norwich");
    });
});
