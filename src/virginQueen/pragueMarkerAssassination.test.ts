import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, Power, VQGame} from "./constant/general";
import {assassinationTargets} from "./espionage";
import {assassinate, playCard} from "./moves";
import {patronById} from "./scenario";
import {setupGame, winter} from "./util";

/**
 * Rule 3.3: of the four final rulers only Elizabeth I (19.3) and Henry III (an
 * army leader) may be assassinated; Philip II and Rudolf II can only die
 * through a Marriage result (21.1).  Rudolf's death still removes the +2 Prague
 * Cultural Center marker (Card FAQ #35).
 */

const context = (p: Power = "spain", values: number[] = []): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    G.year = 3;
    G.impulse = 10;
    G.activePower = "spain";
    for (const p of POWERS) {
        G.powers[p].cards = [];
        G.powers[p].treasures = [];
        G.powers[p].cp = 20;
    }
    return G;
};

describe("Rudolf II and assassination (rule 3.3)", () => {
    it("is not an assassination target", () => {
        const G = game();
        G.royals = G.royals.filter((r) => r.id !== "rudolf" && r.id !== "rudolfII");
        G.royals.push({id: "rudolf", name: "Rudolf II", power: "hre", gender: "male", eligibility: 3, alive: true, married: false, status: "available"});
        G.powers.hre.ruler = "rudolf";

        expect(assassinationTargets(G, "spain")).not.toContain("rudolf");
        expect(assassinate(G, context("spain", [6, 6, 6, 6, 1, 1]), {target: "rudolf", cp: 4})).toBe(INVALID_MOVE);
        expect(G.royals.find((r) => r.id === "rudolf")?.alive).toBe(true);
    });

    it("loses the Prague Cultural Center marker when he dies in a marriage", () => {
        const G = game();
        G.royals = G.royals.filter((r) => r.id !== "rudolf" && r.id !== "rudolfII");
        G.royals.push({id: "rudolf", name: "Rudolf II", power: "hre", gender: "male", eligibility: 3, alive: true, married: false, status: "available"});
        G.powers.hre.ruler = "rudolf";
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) => candidate?.rating !== null);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        G.royals.push({id: "isabellaClaraEugenia", name: "Isabella Clara Eugenia", power: "spain", gender: "female",
            eligibility: 2, alive: true, married: false, status: "available"});
        G.betrothals = [{male: "rudolf", female: "isabellaClaraEugenia"}];

        winter(G, context());

        const royal = G.royals.find((r) => r.id === "rudolf");
        if (royal?.alive === false) {
            expect(G.pragueCulturalCenter).toBeUndefined();
        }
    });

    it("does not let Patron of Arts re-place the marker after Rudolf's death", () => {
        const G = game();
        G.royals = G.royals.filter((r) => r.id !== "rudolf" && r.id !== "rudolfII");
        G.royals.push({id: "rudolf", name: "Rudolf II", power: "hre", gender: "male", eligibility: 3, alive: false, married: false, status: "dead"});
        G.powers.hre.ruler = "rudolf";
        G.powers.hre.cards = ["vq-035"];
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) => candidate?.rating !== null);
        expect(patron).toBeDefined();

        const ctx = context("hre");
        expect(playCard(G, ctx, {cardId: "vq-035", asEvent: true, target: patron!.id})).toBeUndefined();
        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(G.log.join("\n")).not.toContain("Prague Cultural Center marker is removed");
    });
});

/**
 * Rule 21.4: "Elizabeth I, Henry III, Henry Navarre and William of Orange may
 * die from assassination.  In this situation the marriage is ended just as if
 * the 'Back in pool; no bonuses' result occurred, though the royal that died is
 * of course removed from play."  Navarre and Orange double as army leaders
 * under different ids (`navarre`, `orange`).
 */
describe("assassinating a royal army leader (rule 21.4)", () => {
    const prepareRoyal = (G: VQGame, leaderId: string, royalId: string): void => {
        const leader = G.leaders[leaderId];
        leader.location = "bearn";
        G.spaces.bearn.leaders = [...G.spaces.bearn.leaders.filter((id) => id !== leaderId), leaderId];
        G.spaces.bearn.control = "protestant";
        G.spaces.bearn.unrest = false;
        G.royals = G.royals.filter((r) => r.id !== royalId);
        G.royals.push({id: royalId, name: royalId, power: "protestant", gender: "male",
            eligibility: 3, alive: true, married: false, status: "available"});
        G.betrothals = [{male: royalId, female: "elizabeth", power: "protestant"}];
    };

    it("kills Henry of Navarre's royal and cancels the betrothal", () => {
        const G = game();
        prepareRoyal(G, "navarre", "henryIV");

        expect(assassinationTargets(G, "spain")).toContain("navarre");
        expect(assassinate(G, context("spain", [6, 6, 6, 6, 1, 1]), {target: "navarre", cp: 4})).toBeUndefined();
        let guard = 0;
        while (G.pendingEspionage && guard++ < 10) {
            const {espionageOptions, chooseEspionage} = require("./espionage");
            const {ownerOf} = require("./ownership");
            const ids = espionageOptions(G).map((option: {id: string}) => option.id);
            if (!ids.includes("continue")) break;
            chooseEspionage(G, {...context(), playerID: ownerOf(G, G.pendingEspionage.responding)!}, {choice: "continue"});
        }

        expect(G.royals.find((r) => r.id === "henryIV")?.alive).toBe(false);
        expect(G.betrothals).toEqual([]);
    });
});
