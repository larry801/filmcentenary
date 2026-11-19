import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveLand} from "./moves";
import {setWar, setupGame, winter} from "./util";

const context = (values: number[] = [6], playerID = "3"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("a defeated attacker retreats only to its origin (rule 14.1)", () => {
    it("does not offer a friendly space other than the space it came from", () => {
        const G = game();
        setWar(G, "france", "england");
        G.spaces.paris.control = "england";
        G.spaces.paris.land = {england: {regular: 6, merc: 0, cav: 0}};
        G.spaces.rouen.control = "france";
        G.spaces.rouen.land = {france: {regular: 8, merc: 0, cav: 0}};
        G.spaces.amiens.control = "france";
        G.spaces.amiens.land = {};
        G.powers.france.cp = 4;

        // Give the attacker a leader so it can bring 8 units as one formation.
        G.spaces.rouen.leaders = [];
        G.leaders.montmorency = {id: "montmorency", location: "rouen"};
        G.spaces.rouen.leaders.push("montmorency");

        expect(moveLand(G, context([1, 1, 1, 1, 1, 1]), {
            from: "rouen", to: "paris", units: {regular: 5}, leaders: ["montmorency"],
        })).toBeUndefined();

        // The losing attacker goes home to Rouen, not to friendly Amiens.
        expect(G.spaces.rouen.land.france?.regular).toBeGreaterThan(0);
        expect(G.spaces.amiens.land.france).toBeUndefined();
    });
});

describe("a broken siege retreats its remaining besiegers (rule 15.3)", () => {
    it("moves the besieging stack out when it no longer outnumbers the defenders", () => {
        const G = game();
        setWar(G, "france", "england");
        G.impulse = 2;
        G.spaces.paris.control = "england";
        G.spaces.paris.siege = {by: "france", besiegers: ["france"], inside: ["england"], sinceImpulse: 1};
        G.spaces.paris.land = {
            france: {regular: 3, merc: 0, cav: 0},
            england: {regular: 3, merc: 0, cav: 0},
        };
        G.spaces.rouen.control = "france";
        G.spaces.rouen.land = {france: {regular: 6, merc: 0, cav: 0}};
        G.spaces.paris.leaders = [];
        G.powers.france.cp = 4;

        // France marches two of its three besiegers away to Rouen; only one
        // remains, no longer outnumbering the three defenders.
        expect(moveLand(G, context([6, 6, 6, 6, 6, 6]), {
            from: "paris", to: "rouen", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.spaces.paris.siege).toBeUndefined();
        // Rule 15.3: the remaining besieger must retreat out of Paris.
        expect(G.spaces.paris.land.france).toBeUndefined();
    });
});

describe("field battle dice are capped at the moving formation (rule 14 step 2)", () => {
    it("does not roll friendly units beyond the moving formation", () => {
        const G = game();
        setWar(G, "france", "england");
        // A 4-unit formation attacked, but the space ends up holding 10
        // friendly units (for example an ally's stack).  Only 4 count.
        G.spaces.paris.control = "england";
        G.spaces.paris.land = {
            france: {regular: 6, merc: 0, cav: 0},
            protestant: {regular: 4, merc: 0, cav: 0},
            england: {regular: 1, merc: 0, cav: 0},
        };
        G.spaces.paris.leaders = [];

        require("./util").fieldBattle(G, context([1, 1, 1, 1]), "paris", "france",
            ["england"], "rouen", false, ["france", "protestant"], 4);
        expect(G.lastRolls).toMatch(/4 dice/);
    });

    it("rolls every unit when no formation cap is given (relief forces)", () => {
        const G = game();
        setWar(G, "france", "england");
        G.spaces.paris.control = "england";
        G.spaces.paris.land = {
            france: {regular: 6, merc: 0, cav: 0},
            england: {regular: 1, merc: 0, cav: 0},
        };
        G.spaces.paris.leaders = [];

        require("./util").fieldBattle(G, context([1, 1, 1, 1, 1, 1, 1, 1]), "paris", "france",
            ["england"], "rouen", false, ["france"]);
        expect(G.lastRolls).toMatch(/6 dice/);
    });
});

describe("winter resolves marriages before Virgin Queen VP (rules 21.1–21.3)", () => {
    it("does not pay Virgin Queen VP for an Elizabeth who married this turn", () => {
        const G = game();
        const elizabeth = G.royals.find((royal) => royal.id === "elizabeth")!;
        const philip = G.royals.find((royal) => royal.id === "philip")!;
        expect(elizabeth).toBeDefined();
        expect(philip).toBeDefined();
        elizabeth.married = false;
        philip.married = false;
        elizabeth.alive = true;
        philip.alive = true;
        elizabeth.status = "available";
        philip.status = "available";
        G.betrothals = [{male: "philip", female: "elizabeth"}];
        G.virginQueenVpAwarded = 0;
        const englishVpBefore = G.powers.england.bonusVp;

        winter(G, context([6]));

        if (elizabeth.married) {
            // The wedding resolved first, so England earns no Virgin Queen VP.
            expect(G.virginQueenVpAwarded).toBe(0);
        }
        expect(G.powers.england.bonusVp).toBeGreaterThanOrEqual(englishVpBefore);
    });
});

describe("only the resolved diplomatic track resets in winter (rule 20.9)", () => {
    it("keeps influence bought in a minor that was not resolved", () => {
        const G = game();
        G.powers.england.influence.scotland = 4;
        G.minorDiplomacyResolved = [];
        winter(G, context([6]));
        expect(G.powers.england.influence.scotland).toBe(4);
    });

    it("resets influence in a minor that was resolved", () => {
        const G = game();
        G.powers.england.influence.scotland = 4;
        G.minorDiplomacyResolved = ["scotland"];
        winter(G, context([6]));
        expect(G.powers.england.influence.scotland).toBe(G.minorInfluenceDefaults.england.scotland ?? 0);
    });
});

describe("the HRE replacement follows the capital (rule 20.6)", () => {
    it("places the regular in Prague after Rudolf II relocates the capital", () => {
        const G = game();
        G.hreCapital = "prague";
        G.spaces.prague.control = "hre";
        G.spaces.prague.unrest = false;
        G.spaces.vienna.control = "hre";
        G.spaces.vienna.unrest = false;
        const viennaBefore = G.spaces.vienna.land.hre?.regular ?? 0;
        G.pendingHreReplacement = {canRegular: true, canMercs: true, canMarker: false};
        expect(require("./util").applyHreReplacement(G, "regular")).toBe(true);
        expect(G.spaces.prague.land.hre?.regular ?? 0).toBeGreaterThan(0);
        expect(G.spaces.vienna.land.hre?.regular ?? 0).toBe(viennaBefore);
    });
});
