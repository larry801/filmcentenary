import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseBattle, startBattle} from "./combat";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (playerID = "2"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** England attacks a French fleet in the North Sea: an open naval Combat window. */
const navalBattle = (G: VQGame): void => {
    G.seaZones.northSea.naval.england = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    G.seaZones.northSea.naval.france = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    startBattle(G, context(), "naval", "northSea", "england", ["france"], "london");
};

/** Resolve the defender's decisions so the dice routine actually runs. */
const rollBattle = (G: VQGame): number => {
    chooseBattle(G, context("3"), {choice: "fight"});
    chooseBattle(G, context("2"), {choice: "done"});
    chooseBattle(G, context("3"), {choice: "done"});
    return G.pendingBattle!.rolls!.attacker.length;
};

const virginQueen = (G: VQGame): VQGame => {
    G.powers.england.cards = ["vq-036"];
    return G;
};

describe("Virgin Queen (#36) immediate play of a response/combat card", () => {
    it("retrieves a Combat card and registers it with the open battle window", () => {
        const G = virginQueen(game());
        G.discard = ["vq-009"];
        navalBattle(G);

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-009:play",
        })).toBeUndefined();

        expect(G.pendingBattle!.cards.england).toEqual(["vq-009"]);
        expect(G.discard).toContain("vq-009");
        expect(G.powers.england.cards).not.toContain("vq-009");
        expect(G.powers.england.cards).not.toContain("vq-036");
        expect(G.log.join("\n")).toContain("for the naval battle");
    });

    it("adds the printed extra dice to the battle it was played into", () => {
        const control = virginQueen(game());
        navalBattle(control);
        const baseDice = rollBattle(control);

        const withCard = virginQueen(game());
        withCard.discard = ["vq-009"];
        navalBattle(withCard);
        expect(playCard(withCard, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-009:play",
        })).toBeUndefined();

        // Fire Ships rolls 2 extra dice in a normal naval battle.
        expect(rollBattle(withCard)).toBe(baseDice + 2);
    });

    it("keeps a combat card in the discard pile when its phase does not match", () => {
        const G = virginQueen(game());
        // #8 Elite Troops is a field-battle card; this is a naval window.
        G.discard = ["vq-008"];
        navalBattle(G);

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-008:play",
        })).toBeUndefined();

        expect(G.pendingBattle!.cards).toEqual({});
        expect(G.discard).toEqual(["vq-008"]);
        expect(G.powers.england.cards).not.toContain("vq-008");
        expect(G.log.join("\n")).toContain("remains in the discard pile");
    });

    it("keeps a combat card in the discard pile when no battle window is open", () => {
        const G = virginQueen(game());
        G.discard = ["vq-009"];

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-009:play",
        })).toBeUndefined();

        expect(G.pendingBattle).toBeUndefined();
        expect(G.discard).toEqual(["vq-009"]);
        expect(G.powers.england.cards).not.toContain("vq-009");
    });

    it("keeps a trigger-bound Response card in the discard pile without its window", () => {
        const G = virginQueen(game());
        // #15 Storms answers another power's movement action; no window is open.
        G.discard = ["vq-015"];

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-015:play",
        })).toBeUndefined();

        expect(G.discard).toEqual(["vq-015"]);
        expect(G.powers.england.cards).not.toContain("vq-015");
        expect(G.log.join("\n")).toContain("remains in the discard pile");
    });

    it("restores the impulse after a rejected combat play", () => {
        const G = virginQueen(game());
        G.discard = ["vq-008"];
        navalBattle(G);
        G.powers.england.cardPlayed = false;

        playCard(G, context(), {cardId: "vq-036", asEvent: true, target: "retrieve:vq-008:play"});

        // The Virgin Queen itself was played, so the impulse is still spent;
        // only the retrieved card's play was rolled back.
        expect(G.powers.england.cardPlayed).toBe(true);
        expect(G.powers.england.cards).toEqual([]);
    });
});
