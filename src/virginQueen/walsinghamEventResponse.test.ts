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

/** Spain's Double Agent would cut the English informant on Spain's card. */
const doubleAgentAgainstEnglishInformant = (): VQGame => {
    const G = game();
    G.powers.spain.cards = ["vq-092"];
    G.powers.england.cards = ["vq-081"];
    G.informants = [informant("england", "spain"), informant("spain", "england")];
    return G;
};

describe("#81 Walsingham response to event-driven removal", () => {
    it("accepts Walsingham before #92 Double Agent removes the English informant, then restores the event", () => {
        const G = doubleAgentAgainstEnglishInformant();
        const ctx = context("spain", [6,6,6,6,6,6], 1);
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});

        expect(G.pendingEspionage).toMatchObject({
            kind: "doubleAgent", event: "doubleAgent", power: "spain", targetPower: "england",
            target: "england", step: "walsinghamResponse", responding: "england",
        });
        expect(options(G)).toEqual(["walsingham", "continue"]);
        // The English informant is still in place until England decides.
        expect(G.informants).toContainEqual(informant("england", "spain"));

        choose(G, "walsingham", ctx);
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        // The nested Walsingham action removes a Spanish operative, then gains
        // intelligence against Spain with two bonus dice.
        expect(G.pendingEspionage).toMatchObject({
            kind: "walsingham", power: "england", targetPower: "spain", step: "neutralize",
        });
        expect(G.pendingEspionage!.walsinghamReturn).toMatchObject({
            kind: "doubleAgent", event: "doubleAgent", step: "walsinghamResponse", target: "england",
        });
        choose(G, "informant:spain", ctx);
        expect(G.informants.find((i) => i.owner === "spain" && i.target === "england")!.neutralized).toBe(true);
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "england", targetPower: "spain", step: "offense", attackBonus: 2,
        });
        expect(G.pendingEspionage!.attack).toHaveLength(6);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        // The interrupted Double Agent resumes: the English informant is cut.
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")).toBeUndefined();
        expect(G.discard).toContain("vq-092");
    });

    it("declines Walsingham and resolves the Double Agent removal without spending the card", () => {
        const G = doubleAgentAgainstEnglishInformant();
        const ctx = context("spain");
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});
        choose(G, "continue", ctx);

        expect(G.powers.england.cards).toContain("vq-081");
        expect(G.homeSetAside).not.toContain("vq-081");
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")).toBeUndefined();
        // Spain already had an informant on England, so Double Agent adds none.
        expect(G.informants.find((i) => i.owner === "spain" && i.target === "england")).toMatchObject({neutralized: false});
        expect(G.discard).toContain("vq-092");
    });

    it("restores Double Agent after a Walsingham sequence with no operative to remove", () => {
        const G = game();
        G.powers.spain.cards = ["vq-092"];
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("england", "spain")];
        const ctx = context("spain", [1,1,1,1,1,1], 1);
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});

        choose(G, "walsingham", ctx);
        // Walsingham finds no operative on England's card; its bonus
        // intelligence misses (no hits), so the outer event resumes at once.
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        // The event's own removal still resolves, then Spain plants an
        // informant on England because it no longer has one there.
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "spain" && i.target === "england"))
            .toMatchObject({neutralized: false, plantedImpulse: G.impulse});
    });

    it("resolves Double Agent directly when England does not hold Walsingham", () => {
        const G = doubleAgentAgainstEnglishInformant();
        G.powers.england.cards = [];
        const ctx = context("spain");
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});

        expect(G.pendingEspionage).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "england" && i.target === "spain")).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "spain" && i.target === "england")).toMatchObject({neutralized: false});
    });
});
