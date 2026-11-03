import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, Power, VQGame} from "./constant/general";
import {chooseEspionage, espionageOptions, informantCutTargets} from "./espionage";
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

/** Spain holds #59 and plays its cut option against England's informant. */
const hawkinsAgainstEnglishInformant = (): VQGame => {
    const G = game();
    G.powers.spain.cards = ["vq-059"];
    G.powers.england.cards = ["vq-081"];
    G.informants = [informant("england", "spain")];
    return G;
};

describe("#81 Walsingham response to generic event removal (#59 John Hawkins)", () => {
    it("accepts Walsingham before #59 cuts the English informant, then restores the cut and plant", () => {
        const G = hawkinsAgainstEnglishInformant();
        // France spies on England, so Walsingham's own removal has a target.
        G.informants.push(informant("france", "england"));
        const ctx = context("spain", [6,6,6,6,6,6], 1);
        expect(playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:england"})).toBeUndefined();

        expect(G.pendingEspionage).toMatchObject({
            kind: "johnHawkins", event: "johnHawkins", power: "spain", targetPower: "england",
            target: "cut:england", step: "walsinghamResponse", responding: "england",
        });
        expect(options(G)).toEqual(["walsingham", "continue"]);
        // The English informant survives until England decides.
        expect(informantOn(G, "england", "spain")).toMatchObject({neutralized: false});

        choose(G, "walsingham", ctx);
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        expect(G.pendingEspionage).toMatchObject({
            kind: "walsingham", power: "england", targetPower: "spain", step: "neutralize",
        });
        expect(G.pendingEspionage!.walsinghamReturn).toMatchObject({
            kind: "johnHawkins", event: "johnHawkins", step: "walsinghamResponse", target: "cut:england",
        });
        expect(options(G)).toContain("informant:france");

        choose(G, "informant:france", ctx);
        expect(informantOn(G, "france", "england")!.neutralized).toBe(true);
        expect(G.pendingEspionage).toMatchObject({
            kind: "intelligence", power: "england", targetPower: "spain", step: "offense", attackBonus: 2,
        });
        expect(G.pendingEspionage!.attack).toHaveLength(6);

        choose(G, "inspect", ctx);
        choose(G, "done", ctx);
        // The interrupted #59 resumes: the English informant is cut and Spain
        // plants an informant on England because it has none there.
        expect(G.pendingEspionage).toBeUndefined();
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false, plantedImpulse: G.impulse});
        expect(G.discard).toContain("vq-059");
    });

    it("declines Walsingham and resolves the #59 cut and plant without spending the card", () => {
        const G = hawkinsAgainstEnglishInformant();
        const ctx = context("spain");
        playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:england"});
        choose(G, "continue", ctx);

        expect(G.powers.england.cards).toContain("vq-081");
        expect(G.homeSetAside).not.toContain("vq-081");
        expect(G.pendingEspionage).toBeUndefined();
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false, plantedImpulse: G.impulse});
        expect(G.discard).toContain("vq-059");
    });

    it("restores #59 after a Walsingham sequence with no operative to remove", () => {
        const G = hawkinsAgainstEnglishInformant();
        const ctx = context("spain", [1,1,1,1,1,1], 1);
        playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:england"});
        expect(G.pendingEspionage).toMatchObject({step: "walsinghamResponse", responding: "england"});

        choose(G, "walsingham", ctx);
        // Walsingham finds no enemy operative on England's card; its bonus
        // intelligence misses, so the interrupted cut resumes at once.
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-081");
        expect(G.homeSetAside).toContain("vq-081");
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false, plantedImpulse: G.impulse});
    });

    it("resolves #59 directly when England does not hold Walsingham", () => {
        const G = hawkinsAgainstEnglishInformant();
        G.powers.england.cards = [];
        const ctx = context("spain");
        playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:england"});

        expect(G.pendingEspionage).toBeUndefined();
        expect(informantOn(G, "england", "spain")).toBeUndefined();
        expect(informantOn(G, "spain", "england")).toMatchObject({neutralized: false, plantedImpulse: G.impulse});
    });

    it("does not open the response window when the cut informant is not English", () => {
        const G = game();
        G.powers.spain.cards = ["vq-059"];
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("france", "spain")];
        const ctx = context("spain");
        playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:france"});

        expect(G.pendingEspionage).toBeUndefined();
        expect(informantOn(G, "france", "spain")).toBeUndefined();
        expect(informantOn(G, "spain", "france")).toMatchObject({neutralized: false});
        expect(G.powers.england.cards).toContain("vq-081");
    });

    it("moves one of the player's own informants when both are already placed", () => {
        const G = game();
        G.powers.spain.cards = ["vq-059"];
        G.powers.england.cards = ["vq-081"];
        G.informants = [informant("england", "spain"), informant("spain", "france"), informant("spain", "hre")];
        expect(informantCutTargets(G, "spain")).toEqual(["cut:england>france", "cut:england>hre"]);

        const ctx = context("spain", [1,1,1,1,1,1], 1);
        playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:england>france"});
        choose(G, "continue", ctx);

        expect(informantOn(G, "england", "spain")).toBeUndefined();
        // Spain's informant on France relocates instead of a new one appearing.
        expect(informantOn(G, "spain", "france")).toBeUndefined();
        expect(informantOn(G, "spain", "england")).toMatchObject({plantedImpulse: G.impulse});
        expect(G.informants.filter((i) => i.owner === "spain")).toHaveLength(2);
    });

    it("rejects a cut target that has no matching informant", () => {
        const G = hawkinsAgainstEnglishInformant();
        const ctx = context("spain");
        expect(playCard(G, ctx, {cardId: "vq-059", asEvent: true, target: "cut:france"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.cards).toContain("vq-059");
        expect(G.pendingEspionage).toBeUndefined();
    });

    it("leaves #59's other options unchanged", () => {
        const G = game();
        G.activePower = "england";
        G.powers.england.cards = ["vq-059"];
        playCard(G, context("england"), {cardId: "vq-059", asEvent: true});
        expect(G.powers.england.cp).toBe(25);
        expect(G.hawkinsBonus).toBe(true);
        expect(G.pendingEspionage).toBeUndefined();
    });
});
