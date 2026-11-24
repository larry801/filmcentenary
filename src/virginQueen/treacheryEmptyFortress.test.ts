import {Ctx} from "boardgame.io";
import {Power, VQGame} from "./constant/general";
import {ownerOf} from "./ownership";
import {playCard} from "./moves";
import {deactivateMajor, defenderOwners, setWar, setupGame} from "./util";

/**
 * Rule 15.1 step 4: "The player controlling the space is always considered the
 * defender in an assault."  A besieged fortification can hold no land units at
 * all (they were eliminated, or the siege was placed on an empty fortress),
 * and the A/31 Treachery! event forces an assault regardless of the normal
 * requirements.  The defender is then the space's controller, not the owner of
 * a defending stack.
 *
 * This became a real deadlock: `startBattle` used to fall back to "the power
 * opposite to the attacker" when no defender stack had a seat, which in a
 * 2-player game handed the battle stage to a *deactivated* major with no seat.
 * The forced assault then had no panel to answer and the game stopped.  Found
 * by the `tools/vq-sim` seeded sweep (campaign-2, year 6, Amsterdam).
 */
const context = (playerID: string, numPlayers = 2): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const twoPlayerCampaign = (): VQGame => setupGame(context("0"), {scenario: "campaign"});

/** A Spanish besieger in Amsterdam, held (as an empty fortress) by the Protestant. */
const besiegeEmptyAmsterdam = (G: VQGame): void => {
    G.impulse = 5;
    G.spaces.amsterdam.control = "protestant";
    G.spaces.amsterdam.siege = {by: "spain", besiegers: ["spain"], sinceImpulse: 4};
    G.spaces.amsterdam.land = {spain: {regular: 6, merc: 2, cav: 0}};
    G.spaces.amsterdam.unrest = false;
    setWar(G, "spain", "protestant");
    G.powers.spain.cards = ["vq-031"];
    G.powers.spain.cp = 10;
    G.activePower = "spain";
};

describe("assault defender identity (rule 15.1 step 4)", () => {
    it("names the space's controller when the fortress holds no land units", () => {
        const G = twoPlayerCampaign();
        besiegeEmptyAmsterdam(G);

        // Sanity: there is no defending *stack*, so only the control marker
        // identifies the defender.
        expect(defenderOwners(G, "amsterdam")).toEqual([]);

        expect(playCard(G, context("0"), {cardId: "vq-031", asEvent: true, target: "amsterdam"}))
            .toBeUndefined();

        expect(G.pendingBattle?.phase).toBe("assault");
        expect(G.pendingBattle?.treachery).toBe(true);
        expect(G.pendingBattle?.defender).toBe("protestant");
        // Rule 15.1 step 5: the attacker declares Combat cards first, so the
        // open stage is the attacker's; the defender answers at step 6.
        expect(G.pendingBattle?.responding).toBe("spain");
        expect(G.pendingBattle?.step).toBe("attackerCards");
        // Rule 15.1 step 4: even an empty fortress gets the "being the
        // defender" die, so the controller really is a battle participant.
        expect(G.pendingBattle?.defenders).toEqual([]);
    });

    it("never hands a forced assault to a power with no seat", () => {
        const G = twoPlayerCampaign();
        besiegeEmptyAmsterdam(G);
        // In 2-player games the Ottoman starts as England's activated major; a
        // deactivation leaves it with no controlling seat at all.
        expect(G.activatedMajors?.ottoman).toBeDefined();
        deactivateMajor(G, "ottoman");
        expect(ownerOf(G, "ottoman")).toBeUndefined();

        expect(playCard(G, context("0"), {cardId: "vq-031", asEvent: true, target: "amsterdam"}))
            .toBeUndefined();

        const battle = G.pendingBattle;
        expect(battle).toBeDefined();
        // Every power the battle addresses must have a seat, otherwise the
        // stage has no panel and no move can advance it.
        for (const power of [battle!.defender, battle!.responding] as Power[]) {
            expect(ownerOf(G, power)).toBeDefined();
        }
    });

    it("keeps the controlling defender even when the besieger is the Ottoman", () => {
        const G = twoPlayerCampaign();
        besiegeEmptyAmsterdam(G);
        // Rule 15.1's fallback once used the Ottoman as the universal opponent;
        // when the attacker *is* the Ottoman the same code chose Spain, which is
        // also wrong for an empty fortress.
        G.spaces.amsterdam.land = {ottoman: {regular: 6, merc: 2, cav: 0}};
        G.spaces.amsterdam.siege = {by: "ottoman", besiegers: ["ottoman"], sinceImpulse: 4};
        setWar(G, "ottoman", "protestant");
        G.activatedMajors!.ottoman = {ally: "england", baseline: 0};
        G.powers.ottoman.cards = ["vq-031"];
        G.powers.ottoman.cp = 10;
        G.activePower = "ottoman";

        expect(playCard(G, context("1"), {cardId: "vq-031", asEvent: true, target: "amsterdam"}))
            .toBeUndefined();

        expect(G.pendingBattle?.attacker).toBe("ottoman");
        expect(G.pendingBattle?.defender).toBe("protestant");
        expect(ownerOf(G, G.pendingBattle!.defender)).toBeDefined();
    });
});
