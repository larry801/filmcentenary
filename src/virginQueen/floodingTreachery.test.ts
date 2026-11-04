import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {battleOptions, chooseBattle, startBattle} from "./combat";
import {assault, playCard} from "./moves";
import {assaultSpace, setWar, setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

/**
 * A French besieger in Ghent (Netherlands) with a Spanish defender holding
 * Flooding (#39).  Also gives France a LOC to Ghent for the campaign assault
 * shortcut.
 */
const fortifyGhent = (G: VQGame): void => {
    G.impulse = 2;
    G.spaces.ghent.control = "spain";
    G.spaces.ghent.siege = {by: "france", sinceImpulse: 1};
    G.spaces.ghent.land.spain = {regular: 1, merc: 0, cav: 0};
    G.spaces.ghent.land.france = {regular: 6, merc: 4, cav: 0};
    G.spaces.brussels.control = "france";
    G.spaces.brussels.unrest = false;
    G.powers.spain.cards = ["vq-039"];
    G.powers.france.cards = [];
    G.powers.france.cp = 10;
    setWar(G, "france", "spain");
};

/** Plays #31 Treachery! and advances the forced assault to the defender's card step. */
const playTreachery = (G: VQGame): void => {
    G.powers.france.cards = ["vq-031"];
    expect(playCard(G, context("3"), {cardId: "vq-031", asEvent: true, target: "ghent"})).toBeUndefined();
    expect(G.pendingBattle?.phase).toBe("assault");
    expect(G.pendingBattle?.treachery).toBe(true);
    // The attacker finishes its card step before the defender is prompted.
    expect(chooseBattle(G, context("3"), {choice: "done"})).toBeUndefined();
    expect(G.pendingBattle?.step).toBe("defenderCards");
};

describe("Flooding (#39) vs Treachery! (#31)", () => {
    it("does not offer Flooding to the defender in a Treachery assault", () => {
        const G = game();
        fortifyGhent(G);
        playTreachery(G);

        // Sanity: the defender holds #39 and the space is a Netherlands
        // fortress, so only the Treachery flag keeps the option out.
        expect(G.powers.spain.cards).toContain("vq-039");
        expect(battleOptions(G).some((option) => option.id === "card:vq-039")).toBe(false);
    });

    it("rejects a direct Flooding submission without changing the siege", () => {
        const G = game();
        fortifyGhent(G);
        playTreachery(G);

        expect(chooseBattle(G, context("1"), {choice: "card:vq-039"})).toBe(INVALID_MOVE);

        expect(G.powers.spain.cards).toContain("vq-039");
        expect(G.pendingBattle?.treachery).toBe(true);
        expect(G.pendingBattle?.cards.spain).toBeUndefined();
        expect(G.spaces.ghent.siege).toEqual({by: "france", sinceImpulse: 1});
        expect(G.spaces.ghent.land.france).toEqual({regular: 6, merc: 4, cav: 0});
    });

    it("does not auto-flood a pending Treachery assault", () => {
        const G = game();
        fortifyGhent(G);
        playTreachery(G);

        // `moveError` blocks a second assault move while a battle is pending,
        // so exercise the campaign shortcut directly: it must not auto-play
        // Flooding against the forced Treachery assault.
        expect(assaultSpace(G, context("3"), "france", "ghent")).toBe(false);

        expect(G.powers.spain.cards).toContain("vq-039");
        expect(G.spaces.ghent.siege).toBeDefined();
        expect(G.spaces.ghent.land.france?.merc).toBe(4);
        expect(G.log.join("\n")).not.toContain("Flooding");
    });

    it("still offers and resolves Flooding in an ordinary assault", () => {
        const G = game();
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.siege = {by: "france", sinceImpulse: 1};
        G.spaces.brussels.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 3, cav: 0};
        G.powers.spain.cards = ["vq-039"];

        startBattle(G, context("0"), "assault", "brussels", "france", ["spain"], "paris");
        chooseBattle(G, context("3"), {choice: "done"});
        expect(battleOptions(G).some((option) => option.id === "card:vq-039")).toBe(true);
        expect(chooseBattle(G, context("1"), {choice: "card:vq-039"})).toBeUndefined();

        expect(G.spaces.brussels.siege).toBeUndefined();
        expect(G.spaces.paris.land.france?.merc).toBe(1);
        expect(G.pendingBattle).toBeUndefined();
    });

    it("still auto-floods an ordinary campaign assault", () => {
        const G = game();
        fortifyGhent(G);

        expect(assault(G, context("3"), {space: "ghent"})).toBeUndefined();

        expect(G.spaces.ghent.siege).toBeUndefined();
        expect(G.spaces.ghent.land.france?.merc).toBe(2);
        expect(G.powers.spain.cards).not.toContain("vq-039");
    });
});
