import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {chooseEspionage, espionageOptions} from "./espionage";
import {playCard} from "./moves";
import {ownerOf} from "./ownership";
import {setupGame} from "./util";

const context = (p: Power = "spain", values: number[] = [], fallback = 1): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => values.shift() ?? fallback, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    G.year = 3; G.impulse = 10; G.activePower = "spain";
    for (const p of POWERS) {G.powers[p].cards = []; G.powers[p].treasures = []; G.powers[p].cp = 20;}
    return G;
};
const options = (G: VQGame): string[] => espionageOptions(G).map((o) => o.id);
const choose = (G: VQGame, choice: string, ctx = context()): void => {
    chooseEspionage(G, {...ctx, playerID: ownerOf(G, G.pendingEspionage?.responding ?? "spain")}, {choice});
};
const informant = (owner: Power, target: Power, neutralized = false) =>
    ({owner, target, neutralized, plantedImpulse: 1});
const informantOn = (G: VQGame, owner: Power, target: Power) =>
    G.informants.find((i) => i.owner === owner && i.target === target);

/**
 * Spain holds #90 Priest Holes and plays #92 Double Agent against England's
 * informant.  England answers with #81 Walsingham; its nested remove-person
 * targets the Jesuit on England's card, which is exactly the removal #90 can
 * prevent.  This is the only real interaction between Walsingham's nested
 * sequence and Priest Holes: #90 is a response that prevents a Jesuit removal,
 * not a removal/neutralization event that could open the Walsingham window.
 */
const doubleAgentIntoWalsinghamJesuitRemoval = (): VQGame => {
    const G = game();
    G.powers.spain.cards = ["vq-092", "vq-090"];
    G.powers.england.cards = ["vq-081"];
    G.espionage!.jesuits = ["york"];
    G.informants = [informant("england", "spain"), informant("spain", "england")];
    return G;
};

describe("#81 Walsingham nested response and #90 Priest Holes", () => {
    it("accepts Priest Holes to preserve the Jesuit during Walsingham's nested removal, then restores #92", () => {
        const G = doubleAgentIntoWalsinghamJesuitRemoval();
        const ctx = context("spain", [6,1,1,1,1,1]);
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});
        expect(G.pendingEspionage).toMatchObject({
            kind: "doubleAgent", event: "doubleAgent", step: "walsinghamResponse", responding: "england",
        });

        choose(G, "walsingham", ctx);
        expect(G.pendingEspionage).toMatchObject({
            kind: "walsingham", power: "england", targetPower: "spain", step: "neutralize", responding: "england",
        });
        expect(options(G)).toEqual(["informant:spain", "jesuit:york"]);

        choose(G, "jesuit:york", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "priestHoles", responding: "spain"});
        expect(options(G)).toEqual(["allowNeutralize", "priestHoles"]);

        choose(G, "priestHoles", ctx);
        expect(G.espionage!.jesuits).toEqual(["york"]);
        expect(G.powers.spain.cards).not.toContain("vq-090");
        expect(G.discard).toContain("vq-090");
        // #90 resolves before Walsingham's bonus intelligence action continues.
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "england", targetPower: "spain", step: "offense", attackBonus: 2,
        });

        // Walsingham's one intelligence hit is spent inspecting Spain; the nested
        // action then finishes and the interrupted #92 Double Agent resumes.
        choose(G, "inspect", ctx);
        // The interrupted #92 Double Agent resumes and removes the English informant.
        expect(G.pendingEspionage).toBeUndefined();
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false});
        expect(G.discard).toContain("vq-092");
    });

    it("declines Priest Holes, removes the Jesuit, and still restores #92 after Walsingham's intelligence", () => {
        const G = doubleAgentIntoWalsinghamJesuitRemoval();
        const ctx = context("spain", [6,1,1,1,1,1]);
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});
        choose(G, "walsingham", ctx);
        choose(G, "jesuit:york", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "priestHoles", responding: "spain"});

        choose(G, "allowNeutralize", ctx);
        expect(G.espionage!.jesuits).toEqual([]);
        // Declining leaves #90 in Spain's hand for a later removal.
        expect(G.powers.spain.cards).toContain("vq-090");
        expect(G.discard).not.toContain("vq-090");
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "england", targetPower: "spain", step: "offense", attackBonus: 2,
        });

        choose(G, "inspect", ctx);
        expect(G.pendingEspionage).toBeUndefined();
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(G.discard).toContain("vq-092");
    });

    it("restores #92 immediately when Walsingham's bonus intelligence misses after Priest Holes", () => {
        const G = doubleAgentIntoWalsinghamJesuitRemoval();
        const ctx = context("spain", [1,1,1,1,1,1]);
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});
        choose(G, "walsingham", ctx);
        choose(G, "jesuit:york", ctx);
        choose(G, "priestHoles", ctx);

        // No intelligence hits, so the nested action finishes and #92 resumes at once.
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.espionage!.jesuits).toEqual(["york"]);
        expect(G.discard).toContain("vq-090");
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(G.discard).toContain("vq-092");
    });
});
