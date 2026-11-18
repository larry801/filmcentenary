/**
 * The join page's human-seat filter.
 *
 * `humanSeatIds` decides which seats the invite links offer and which seat a
 * join URL may take.  Imperial Elegy seats all six powers but may hand four of
 * them to the Rule 34 bot, so the filter is the only thing that keeps an invite
 * from pointing at a bot seat.
 */

import {Player} from "../../Game";
import {humanSeatIds} from "./humanSeats";
import {botsForHumanCount} from "../../imperialElegy/configuration";

const seats = (...names: Array<string | null>): Map<Player, string | null> =>
    new Map(names.map((name, index) => [String(index) as Player, name]));

const sixSeats = (): Map<Player, string | null> => seats(...Array.from({length: 6}, () => null));

describe("humanSeatIds", () => {
    test("every other game has no filtered seats", () => {
        expect(humanSeatIds("film", seats(null, null))).toBeNull();
        expect(humanSeatIds("songJinn", seats(null, null))).toBeNull();
        expect(humanSeatIds("virginQueen", seats(null, null))).toBeNull();
    });

    test("a six-human Imperial Elegy match offers all six seats", () => {
        expect([...humanSeatIds("imperialElegy", sixSeats())!]).toEqual(["0", "1", "2", "3", "4", "5"]);
    });

    test("a two-human table offers only the two human seats", () => {
        const players = seats(null, null, "Bot FR", "Bot AU", "Bot RU", "Bot OT");
        const result = humanSeatIds("imperialElegy", players, {bots: botsForHumanCount(2)});
        expect([...result!]).toEqual(["0", "1"]);
    });

    test("setupData alone is enough before the server has seated the bots", () => {
        // AU is seat 3 and OT is seat 5, so those two are the bots.
        const result = humanSeatIds("imperialElegy", sixSeats(), {bots: ["AU", "OT"]});
        expect([...result!]).toEqual(["0", "1", "2", "4"]);
    });

    test("a garbage bot list is ignored rather than hiding seats", () => {
        for (const bots of [["nope"], [3, null], "FR", 7]) {
            const result = humanSeatIds("imperialElegy", sixSeats(), {bots});
            expect([...result!]).toEqual(["0", "1", "2", "3", "4", "5"]);
        }
    });

    test("the spectator pseudo-seat is never a joinable seat", () => {
        const players = new Map<Player, string | null>([
            ["0" as Player, "P1"],
            [Player.SPECTATE, null],
        ]);
        expect([...humanSeatIds("imperialElegy", players)!]).toEqual(["0"]);
    });

    test("a seat already named by a human stays joinable-listed", () => {
        // `players` names are not part of the decision: the lobby decides who is
        // a bot, and a human seat keeps its invite even after it is filled.
        const players = seats("P1", "P2", "Bot FR", null, null, null);
        expect([...humanSeatIds("imperialElegy", players, {bots: botsForHumanCount(2)})!]).toEqual(["0", "1"]);
    });
});
