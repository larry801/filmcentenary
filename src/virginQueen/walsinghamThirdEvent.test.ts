import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {chooseEspionage, espionageOptions} from "./espionage";
import {playCard} from "./moves";
import {ownerOf} from "./ownership";
import {setupGame} from "./util";

const context = (p: Power = "france", values: number[] = [], fallback = 1): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => values.shift() ?? fallback, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    G.year = 3; G.impulse = 10; G.activePower = "france";
    for (const p of POWERS) {G.powers[p].cards = []; G.powers[p].treasures = []; G.powers[p].cp = 20;}
    return G;
};
const options = (G: VQGame): string[] => espionageOptions(G).map((o) => o.id);
const choose = (G: VQGame, choice: string, ctx = context()): void => {
    chooseEspionage(G, {...ctx, playerID: ownerOf(G, G.pendingEspionage?.responding ?? "france")}, {choice});
};
const informant = (owner: Power, target: Power, neutralized = false) =>
    ({owner, target, neutralized, plantedImpulse: 1});
const informantOn = (G: VQGame, owner: Power, target: Power) =>
    G.informants.find((i) => i.owner === owner && i.target === target);

/** France plays #80 Black Queen's spy option against England. */
const blackQueenSpyOnEngland = (): VQGame => {
    const G = game();
    G.powers.france.cards = ["vq-080"];
    G.powers.england.cards = ["vq-081"];
    G.informants = [informant("france", "england"), informant("england", "france")];
    return G;
};

/**
 * England's informant is neutralized by the Gain Intelligence action that #80
 * The Black Queen launches.  This is the third event-driven path into #81's
 * nested remove-person + bonus-intelligence response (after #92 and #59).
 */
describe("#81 Walsingham response to #80 The Black Queen's event Espionage action", () => {
    it("accepts Walsingham before #80 neutralizes the English informant, then finishes the action and draws", () => {
        const G = blackQueenSpyOnEngland();
        const handBefore = G.powers.france.cards.length;
        const ctx = context("france", [6,6,6,6, 6,6,6,6,6,6, 1], 1);
        expect(playCard(G, ctx, {cardId: "vq-080", asEvent: true, target: "spy:england"})).toBeUndefined();

        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "france", targetPower: "england", event: "blackQueen",
            step: "responses", responding: "england",
        });
        // The event's "then draw a card" waits for the Espionage action.
        expect(G.powers.france.cards).toHaveLength(handBefore - 1);
        expect(options(G)).toEqual(["continue", "walsingham:offensive", "walsingham:defensive"]);

        choose(G, "continue", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "offense", remaining: 4});
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);

        // The effect waits for England; the English informant is still active.
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});
        expect(options(G)).toEqual(["walsingham", "continue"]);
        expect(informantOn(G, "england", "france")).toMatchObject({neutralized: false});

        choose(G, "walsingham", ctx);
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        expect(G.pendingEspionage).toMatchObject({
            kind: "walsingham", power: "england", targetPower: "france", step: "neutralize",
        });
        expect(G.pendingEspionage!.walsinghamReturn).toMatchObject({
            kind: "intelligence", event: "blackQueen", step: "walsinghamResponse",
            walsinghamStep: "neutralize", targetPower: "england",
        });
        expect(options(G)).toContain("informant:france");

        choose(G, "informant:france", ctx);
        expect(informantOn(G, "france", "england")!.neutralized).toBe(true);
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "england", targetPower: "france", step: "offense", attackBonus: 2,
        });
        expect(G.pendingEspionage!.attack).toHaveLength(6);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        // Walsingham's nested sequence has ended, but the event's Espionage
        // action still has hits to spend before the event can finish.
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "france", targetPower: "england", step: "offense", remaining: 3,
        });
        expect(informantOn(G, "england", "france")!.neutralized).toBe(true);
        expect(G.powers.france.cards).toHaveLength(handBefore - 1);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.powers.france.cards).toHaveLength(handBefore);
        expect(G.log.join("\n")).toContain("The Black Queen draws a card.");
    });

    it("declines Walsingham and still resolves #80's neutralization and delayed draw", () => {
        const G = blackQueenSpyOnEngland();
        const handBefore = G.powers.france.cards.length;
        const ctx = context("france", [6,6,6,6, 1], 1);
        playCard(G, ctx, {cardId: "vq-080", asEvent: true, target: "spy:england"});
        choose(G, "continue", ctx);
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);
        choose(G, "continue", ctx);

        expect(G.powers.england.cards).toContain("vq-081");
        expect(G.homeSetAside).not.toContain("vq-081");
        expect(informantOn(G, "england", "france")!.neutralized).toBe(true);
        expect(G.pendingEspionage).toMatchObject({step: "offense", remaining: 3});
        expect(G.powers.france.cards).toHaveLength(handBefore - 1);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.powers.france.cards).toHaveLength(handBefore);
    });

    it("resolves #80's Espionage action directly when England does not hold Walsingham", () => {
        const G = blackQueenSpyOnEngland();
        G.powers.england.cards = [];
        const handBefore = G.powers.france.cards.length;
        const ctx = context("france", [6,6,6,6, 1], 1);
        playCard(G, ctx, {cardId: "vq-080", asEvent: true, target: "spy:england"});

        expect(G.pendingEspionage).toMatchObject({kind: "intelligence", step: "offense", remaining: 4});
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "offense", remaining: 3});
        expect(informantOn(G, "england", "france")!.neutralized).toBe(true);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.powers.france.cards).toHaveLength(handBefore);
    });

    it("restores #80's delayed draw after a Walsingham sequence with no operative to remove", () => {
        const G = game();
        G.powers.france.cards = ["vq-080"];
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("england", "france")];
        const handBefore = G.powers.france.cards.length;
        const ctx = context("france", [6,6, 6,6,6,6,6,6, 1], 1);
        playCard(G, ctx, {cardId: "vq-080", asEvent: true, target: "spy:england"});
        expect(G.pendingEspionage).toMatchObject({step: "responses", responding: "england"});
        choose(G, "continue", ctx);

        expect(G.pendingEspionage).toMatchObject({step: "offense", remaining: 2});
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});

        choose(G, "walsingham", ctx);
        // Walsingham finds no enemy operative on England's card; only its
        // bonus intelligence remains, and the event still waits for it.
        expect(G.pendingEspionage).toMatchObject({kind: "intelligence", power: "england", attackBonus: 2});
        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        expect(G.pendingEspionage).toMatchObject({kind: "intelligence", power: "france", step: "offense", remaining: 1});
        expect(informantOn(G, "england", "france")!.neutralized).toBe(true);

        choose(G, "inspect", ctx);
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.powers.france.cards).toHaveLength(handBefore);
    });
});
