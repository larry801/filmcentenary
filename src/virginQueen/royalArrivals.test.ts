import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {beginMassacre, massacreConversionTargets, navarreBetrothedToFrance} from "./espionage";
import {dealYear, setupGame} from "./util";

const context = (p: Power = "spain", values: number[] = [], fallback = 1): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "cardDraw", numPlayers: 6,
    random: {Die: () => values.shift() ?? fallback, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const campaign = (): VQGame => setupGame(context());

describe("royal arrivals in the Campaign (rule 8.1)", () => {
    it("adds the Turn 2 and Turn 3 royals during Card Draw", () => {
        const G = campaign();
        expect(G.royals.some((royal) => royal.id === "henryIV")).toBe(false);

        G.year = 2;
        dealYear(G, context());
        expect(G.royals.some((royal) => royal.id === "maryScots")).toBe(true);
        expect(G.royals.some((royal) => royal.id === "charlesIX")).toBe(true);

        G.year = 3;
        dealYear(G, context());
        expect(G.royals.find((royal) => royal.id === "henryIV")).toMatchObject({power: "protestant", turn: 3});
        expect(G.royals.find((royal) => royal.id === "margueriteValois")).toMatchObject({power: "france", turn: 3});
        expect(G.royals.find((royal) => royal.id === "henryIII")).toMatchObject({power: "france", turn: 3});
    });

    it("makes the Massacre's Navarre betrothal bonus reachable in a campaign game", () => {
        const G = campaign();
        G.year = 3;
        dealYear(G, context());
        G.betrothals = [{male: "henryIV", female: "margueriteValois"}];
        expect(navarreBetrothedToFrance(G)).toBe(true);

        // Give the Massacre at least one legal conversion target: a
        // French-controlled Protestant space while the area keeps another
        // Protestant space (18.1 core presence).
        G.spaces.paris.religion = "protestant";
        G.spaces.paris.control = "france";
        G.spaces.orleans.religion = "protestant";
        G.powers.france.cards = ["vq-097"];
        G.powers.france.cardPlayed = false;
        beginMassacre(G, {...context("france"), phase: "action"}, "france");
        expect(massacreConversionTargets(G).length).toBeGreaterThan(0);

        expect(G.pendingEspionage).toMatchObject({kind: "massacre", step: "massacreConvert", remaining: 8, cp: 4});
    });

    it("does not schedule event-only Louise of Lorraine as an automatic arrival", () => {
        const G = campaign();
        G.year = 3;
        dealYear(G, context());
        expect(G.royals.some((royal) => royal.id === "louiseLorraine")).toBe(false);
    });
});
