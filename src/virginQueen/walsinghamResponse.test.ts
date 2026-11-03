import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {chooseEspionage, espionageOptions} from "./espionage";
import {assassinate, gainIntelligence} from "./moves";
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
const informant = (owner: Power, target: Power) => ({owner, target, neutralized: false, plantedImpulse: 1});

/** Spain's informant on England supplies the attack dice; England's is the target. */
const englishOperativeUnderThreat = (): VQGame => {
    const G = game();
    G.powers.england.cards = ["vq-081"];
    G.informants = [informant("spain", "england"), informant("england", "spain")];
    return G;
};

describe("#81 Walsingham nested response", () => {
    it("offers Walsingham before a foreign action neutralizes an English informant and resolves remove-person + intelligence", () => {
        const G = englishOperativeUnderThreat();
        const ctx = context("spain", [6,1,1,1, 6,6,1,1,1,1], 1);
        gainIntelligence(G, ctx, {target: "england"});
        // England may first play the Walsingham marker before the roll.
        choose(G, "continue", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "offense", remaining: 1});
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);

        // The effect waits for England; the English informant is still active.
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});
        expect(options(G)).toEqual(["walsingham", "continue"]);
        expect(G.informants.find((i) => i.owner === "england")!.neutralized).toBe(false);

        choose(G, "walsingham", ctx);
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        // The nested action is England's own Walsingham: remove a person, then
        // gain intelligence against the power whose action was interrupted.
        expect(G.pendingEspionage).toMatchObject({
            kind: "walsingham", power: "england", targetPower: "spain", responding: "england", step: "neutralize",
        });
        expect(options(G)).toContain("informant:spain");

        choose(G, "informant:spain", ctx);
        expect(G.informants.find((i) => i.owner === "spain" && i.target === "england")!.neutralized).toBe(true);
        // Walsingham's intelligence action starts with two bonus dice.  England's
        // own informant on Spain adds its normal two dice as well.
        expect(G.pendingEspionage).toMatchObject({kind: "intelligence", step: "offense", remaining: 2, attackBonus: 2});
        expect(G.pendingEspionage!.attack).toHaveLength(6);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        // The interrupted Spanish action resumes and finishes the neutralization.
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")!.neutralized).toBe(true);
    });

    it("lets England decline, resolving the original neutralization without spending the card", () => {
        const G = englishOperativeUnderThreat();
        const ctx = context("spain", [6,1,1,1], 1);
        gainIntelligence(G, ctx, {target: "england"});
        choose(G, "continue", ctx);
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);
        choose(G, "continue", ctx);

        expect(G.powers.england.cards).toContain("vq-081");
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")!.neutralized).toBe(true);
    });

    it("does not open the window when England does not hold Walsingham", () => {
        const G = englishOperativeUnderThreat();
        G.powers.england.cards = [];
        const ctx = context("spain", [6,1,1,1], 1);
        gainIntelligence(G, ctx, {target: "england"});
        choose(G, "continue", ctx);
        choose(G, "neutralize", ctx);
        choose(G, "informant:england", ctx);

        expect(G.pendingEspionage).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")!.neutralized).toBe(true);
    });

    it("also intercepts an extra neutralization of an English informant", () => {
        const G = game();
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("spain", "france"), informant("spain", "england"), informant("france", "spain"), informant("england", "spain")];
        const ctx = context("spain", [6,1,1,1, 4, 1,1,1,1,1,1], 1);
        gainIntelligence(G, ctx, {target: "france"});
        choose(G, "continue", ctx);
        choose(G, "neutralize", ctx);
        choose(G, "informant:france", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "extraNeutralize", responding: "spain"});

        choose(G, "informant:england", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});
        expect(G.powers.england.cards).toContain("vq-081");
        choose(G, "walsingham", ctx);
        expect(G.pendingEspionage).toMatchObject({kind: "walsingham", targetPower: "spain"});
        // The extra neutralization is still pending behind the nested response.
        expect(G.pendingEspionage!.walsinghamReturn).toMatchObject({step: "walsinghamResponse", walsinghamStep: "extraNeutralize"});
    });

    it("opens the same window when a defender's neutralization targets England's informant", () => {
        const G = game();
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("spain", "england"), informant("england", "spain")];
        G.leaders.alba = {id: "alba", location: "brussels"};
        G.spaces.brussels.leaders.push("alba");
        const ctx = context("england", [1,1,1,1, 6,6,6], 1);
        assassinate(G, ctx, {target: "alba", cp: 2});
        choose(G, "continue", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "defense", responding: "spain"});

        choose(G, "neutralize", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});
        expect(G.pendingEspionage!.walsinghamStep).toBe("defense");
        expect(G.informants.find((i) => i.owner === "england")!.neutralized).toBe(false);

        choose(G, "walsingham", ctx);
        expect(G.pendingEspionage).toMatchObject({kind: "walsingham", targetPower: "spain", responding: "england"});
    });
});
