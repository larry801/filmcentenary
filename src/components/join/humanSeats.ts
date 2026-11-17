/**
 * Which seats of a match a human can take.
 *
 * This module is deliberately free of React/MUI imports so it can be unit
 * tested in the node environment (the join page itself pulls in the whole board
 * tree).  It is the rule behind two behaviours on the join page: the invite
 * links only list human seats, and a join URL pointing at a bot seat is refused
 * with an explanation instead of a 409 from the server.
 *
 * Any game other than Imperial Elegy seats exactly its players, so `null`
 * ("no filtering") is the answer there.
 */

import {Player} from "../../Game";
import {imperialElegyName} from "../../constant/multi-games";
import {IE_SEATS, seatPower} from "../../imperialElegy/configuration";
import type {Power} from "../../imperialElegy/types";

/** The bot powers named by a match's `setupData`, ignoring anything unknown. */
const botPowersIn = (setupData?: Record<string, unknown>): Set<Power> => {
    const raw = setupData?.bots;
    if (!Array.isArray(raw)) return new Set<Power>();
    return new Set<Power>(
        raw.filter((power): power is Power => typeof power === "string" && (IE_SEATS as readonly string[]).includes(power)),
    );
};

/**
 * The joinable seats of a match, or `null` when every seat is joinable.
 *
 * Imperial Elegy always creates all six seats; the ones the lobby gave to the
 * Rule 34 bot are already named in the metadata (the server seats them at
 * creation), and `setupData.bots` names them even before it does.  A seat is
 * therefore human when it is a real seat and not one of the bot powers; the
 * `spectate` pseudo-player is never a seat.
 */
export const humanSeatIds = (
    gameName: string,
    players: Map<Player, string | null>,
    setupData?: Record<string, unknown>,
): Set<string> | null => {
    if (gameName !== imperialElegyName) return null;
    const bots = botPowersIn(setupData);
    const seats = new Set<string>();
    players.forEach((_name, seat) => {
        if (seat === Player.SPECTATE) return;
        const power = seatPower(seat);
        if (power !== undefined && bots.has(power)) return;
        seats.add(seat);
    });
    return seats;
};

export default humanSeatIds;
