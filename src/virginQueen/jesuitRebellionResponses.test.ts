import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {beginEspionageEvent, chooseEspionage, espionageOptions, refreshJesuits} from "./espionage";
import {englishCatholicRebellion, gainIntelligence, playCard} from "./moves";
import {ownerOf} from "./ownership";
import {SPACES} from "./mapData";
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
const choose = (G: VQGame, choice: string, ctx = context()) => chooseEspionage(G,
    {...ctx, playerID: ownerOf(G, G.pendingEspionage?.responding ?? "spain")}, {choice});
const options = (G: VQGame) => espionageOptions(G).map((o) => o.id);
const rolls = (hits: number, misses: number) => [...Array(hits).fill(6), ...Array(misses).fill(1)];
/** Spain's 3 CP rebellion with Mary dead: 3 attack dice against England's 5. */
const rebellionDice = (attackHits: number, defenseHits: number): number[] => [
    ...Array(attackHits).fill(6), ...Array(3 - attackHits).fill(1),
    ...Array(defenseHits).fill(6), ...Array(5 - defenseHits).fill(1),
];
describe("English Catholic Rebellion conversion targets", () => {
    it("never offers a continental space as a conversion target", () => {
        const G = game();
        for (const s of SPACES.filter((s) => s.area === "england")) {
            G.spaces[s.id].religion = "protestant";
            G.spaces[s.id].land = {}; G.spaces[s.id].naval = {}; G.spaces[s.id].leaders = [];
        }
        // Every continental space is Catholic, so port linkage makes several
        // English ports adjacent to the base — that part is rules-correct.
        for (const s of SPACES.filter((s) => s.area !== "england")) G.spaces[s.id].religion = "catholic";
        G.espionage!.mary = "dead";
        // +2 = "6 Catholic Conversions (must be in England)".  Fallback 5 keeps
        // the six conversion dice as minor conversions.
        englishCatholicRebellion(G, context("spain", rebellionDice(2, 0), 5), {cp: 3});

        expect(G.pendingEspionage?.step).toBe("conversions");
        expect(G.pendingEspionage?.conversionAreas).toEqual(["england"]);
        expect(G.pendingEspionage?.conversionDice).toHaveLength(6);
        const converts = options(G).filter((id) => id.startsWith("convert:") || id.startsWith("expand:"));
        expect(converts.length).toBeGreaterThan(0);
        for (const id of converts) {
            const space = id.split(":")[id.startsWith("expand:") ? 1 : 2];
            expect(SPACES.find((s) => s.id === space)?.area).toBe("england");
        }
    });

    it("offers English targets when an English Catholic space exists", () => {
        const G = game();
        for (const s of SPACES.filter((s) => s.area === "england")) {
            G.spaces[s.id].religion = "protestant";
            G.spaces[s.id].land = {}; G.spaces[s.id].naval = {}; G.spaces[s.id].leaders = [];
        }
        G.spaces.london.religion = "catholic";
        G.espionage!.mary = "dead";
        englishCatholicRebellion(G, context("spain", rebellionDice(2, 0), 5), {cp: 3});

        const converts = options(G).filter((id) => id.startsWith("convert:"));
        expect(converts.length).toBeGreaterThan(0);
        for (const id of converts) {
            expect(SPACES.find((s) => s.id === id.split(":")[2])?.area).toBe("england");
        }
    });
});

describe("Topcliffe (#96) and God's Secret Agents (#94)", () => {
    it("still makes its five Protestant attempts with a single Jesuit", () => {
        const G = game();
        G.powers.england.cards = ["vq-096"];
        G.espionage!.jesuits = ["york"];
        beginEspionageEvent(G, context("england", [], 5), "england", "richardTopcliffe");
        choose(G, "jesuit:york", context("england", [], 5));

        expect(G.espionage!.jesuits).toEqual([]);
        // The printed card always converts afterwards, even after one removal.
        expect(G.pendingEspionage?.conversionDice).toHaveLength(5);
        expect(G.pendingEspionage?.conversionAreas).toEqual(["england"]);
    });

    it("spends exactly the power-board Jesuits and converts the target", () => {
        const G = game();
        for (const s of SPACES.filter((s) => s.area === "england")) {
            G.spaces[s.id].land = {}; G.spaces[s.id].naval = {}; G.spaces[s.id].leaders = [];
        }
        G.espionage!.jesuitsOnCard = 2;
        beginEspionageEvent(G, context(), "spain", "godsSecretAgents");
        choose(G, "place:york"); choose(G, "place:london");

        expect(G.espionage!.jesuits).toEqual(["york", "london"]);
        expect(G.espionage!.jesuitsOnCard).toBe(0);
        expect(G.spaces.york.religion).toBe("catholic");
    });
});

describe("Douai (#93) Jesuit supply", () => {
    it("places the extra Jesuit without consuming a power-board allowance", () => {
        const G = game();
        G.spaces.lille.religion = "catholic";
        refreshJesuits(G);
        expect(G.espionage!.jesuitsOnCard).toBe(1);
        beginEspionageEvent(G, context(), "spain", "englishCollegeAtDouai");
        choose(G, options(G).find((id) => id.startsWith("place:"))!);

        // The card grants a marker "from outside its power board".
        expect(G.espionage!.jesuits).toHaveLength(1);
        expect(G.espionage!.jesuitsOnCard).toBe(1);
        expect(G.espionage!.douai).toBe(true);
    });
});

describe("Walsingham (#81) answered by Stafford (#102)", () => {
    it("lets a third power cancel the marker inside the espionage window", () => {
        const G = game();
        G.powers.england.cards = ["vq-081"];
        G.powers.france.cards = ["vq-102"];
        // Two attack dice, no hits and no defense dice: England wins the window
        // and sets the marker before the roll is resolved.
        gainIntelligence(G, context("spain", [1, 1]), {target: "england"});

        expect(G.pendingEspionage?.responding).toBe("england");
        expect(options(G)).toContain("walsingham:defensive");
        choose(G, "walsingham:defensive", context("england"));
        expect(G.espionage!.walsingham).toBe("defensive");
        expect(G.pendingEspionage?.walsinghamFresh).toBe(true);

        // England closes its own window; France then answers the fresh marker.
        choose(G, "continue", context("england"));
        expect(G.pendingEspionage?.responding).toBe("france");
        expect(options(G)).toContain("stafford");

        choose(G, "stafford", context("france"));
        expect(G.espionage!.walsingham).toBeUndefined();
        expect(G.powers.france.cards).not.toContain("vq-102");
        expect(G.discard).toContain("vq-102");
    });
});
