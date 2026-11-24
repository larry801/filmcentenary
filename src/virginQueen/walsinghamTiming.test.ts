import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {chooseEspionage, espionageOptions} from "./espionage";
import {gainIntelligence, playCard} from "./moves";
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

/** Spain's pre-dice window against England, with a Spanish spy on England's card. */
const spanishIntelligenceAgainstEngland = (): VQGame => {
    const G = game();
    G.powers.england.cards = ["vq-081"];
    G.informants = [informant("spain", "england")];
    return G;
};

describe("#81 Walsingham as a free-timing response", () => {
    it("may remove an operative and gain intelligence before another power's Espionage dice", () => {
        const G = spanishIntelligenceAgainstEngland();
        const ctx = context("spain", [6, 1, 1, 1, 6, 1]);
        gainIntelligence(G, ctx, {target: "england"});

        expect(G.pendingEspionage).toMatchObject({step: "responses", responding: "england", power: "spain"});
        expect(options(G)).toEqual(expect.arrayContaining(["walsingham:remove"]));

        choose(G, "walsingham:remove", ctx);
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        expect(G.pendingEspionage).toMatchObject({
            kind: "walsingham", power: "england", targetPower: "spain", step: "neutralize",
        });
        expect(options(G)).toContain("informant:spain");

        choose(G, "informant:spain", ctx);
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: true});
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "england", targetPower: "spain", step: "offense", attackBonus: 2,
        });

        choose(G, "inspect", ctx);
        // The interrupted pre-dice window resumes; the Spanish spy is now
        // neutralized, but the second supplied die still gives the action a hit.
        expect(G.pendingEspionage).toMatchObject({kind: "intelligence", power: "spain", step: "offense", remaining: 1});
        choose(G, "inspect", ctx);
        expect(G.pendingEspionage).toBeUndefined();
    });

    it("offers #102 against a nested Walsingham and cancels its removal", () => {
        const G = spanishIntelligenceAgainstEngland();
        G.powers.spain.cards = ["vq-102"];
        const ctx = context("spain", [1, 1, 1, 1, 1, 1]);
        gainIntelligence(G, ctx, {target: "england"});
        choose(G, "walsingham:remove", ctx);

        expect(G.pendingEspionage).toMatchObject({step: "staffordResponse", responding: "spain"});
        expect(options(G)).toEqual(["stafford", "continue"]);

        choose(G, "stafford", ctx);
        expect(G.powers.spain.cards).not.toContain("vq-102");
        expect(G.homeSetAside).toContain("vq-081");
        expect(G.discard).toContain("vq-102");
        // The canceled Walsingham never removed the Spanish spy.  The original
        // action resumes and rolls without the canceled bonus intelligence.
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false});
        expect(G.pendingEspionage).toBeUndefined();
    });

    it("still resolves the interrupted neutralization after #102 cancels Walsingham", () => {
        const G = game();
        G.powers.spain.cards = ["vq-102"];
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("england", "spain")];
        const ctx = context("spain", [6, 6, 1]);
        gainIntelligence(G, ctx, {target: "england"});
        choose(G, "continue", ctx);
        choose(G, "neutralize", ctx);
        expect(options(G)).toContain("informant:england");

        choose(G, "informant:england", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});
        choose(G, "walsingham", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "staffordResponse", responding: "spain"});
        choose(G, "stafford", ctx);

        // #102 canceled Walsingham, but the neutralization it interrupted still
        // resolves; one intelligence hit remains to spend.
        expect(informantOn(G, "england", "spain")).toMatchObject({neutralized: true});
        expect(G.pendingEspionage).toMatchObject({kind: "intelligence", power: "spain", step: "offense", remaining: 1});
        choose(G, "inspect", ctx);
        expect(G.pendingEspionage).toBeUndefined();
    });

    it("offers #102 when Walsingham answers #92 and resumes the event after a cancel", () => {
        const G = game();
        G.powers.spain.cards = ["vq-092", "vq-102"];
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("england", "spain"), informant("spain", "england")];
        const ctx = context("spain", [6, 1, 1, 1, 1, 1]);
        playCard(G, ctx, {cardId: "vq-092", asEvent: true, target: "england"});
        choose(G, "walsingham", ctx);

        expect(G.pendingEspionage).toMatchObject({step: "staffordResponse", responding: "spain"});
        choose(G, "stafford", ctx);
        expect(G.homeSetAside).toContain("vq-081");
        expect(G.discard).toEqual(expect.arrayContaining(["vq-102", "vq-092"]));
        // Canceled Walsingham leaves the Spanish spy in place, then #92's own
        // removal cuts the English informant on Spain's card.
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false});
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(G.pendingEspionage).toBeUndefined();
    });
});
