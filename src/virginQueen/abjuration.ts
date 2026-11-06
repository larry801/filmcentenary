import {BoardProps} from "boardgame.io/react";
import i18n from "../constant/i18n";
import {Power, powerName, spaceHomes, VQGame} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {SPACES, SPACE_BY_ID} from "./mapData";

/**
 * Act of Abjuration (#103) previews.  Kept in its own module so the pending
 * response panel can use them without importing the whole board.
 */

export interface AbjurationOffer {
    power: Power;
    powerName: string;
    /** Netherlands space the accepted offer would reinforce. */
    space: string;
    spaceName: string;
    /** Regulars the engine would move now, capped by the card's five. */
    units: number;
    /** Army leader that would accompany the regulars, when one is available. */
    leaderId?: string;
    leaderName?: string;
    /** Offer button label: power, destination, troops and leader. */
    label: string;
}

/**
 * Previews one #103 offer without mutating the game.  `chooseAbjuration`
 * deterministically takes regulars from the offering power's controlled home
 * spaces, in map order, until five have been moved; this mirrors that source
 * selection so the Protestant can see the destination and exact troops before
 * accepting.
 */
export const abjurationOfferDetails = (G: VQGame, offer: {power: Power; space: string}, locale: "en" | "zh_CN" = "zh_CN"): AbjurationOffer => {
    let remaining = 5;
    const sources: string[] = [];
    for (const space of SPACES.filter((def) => spaceHomes(def).includes(offer.power) && G.spaces[def.id].control === offer.power)) {
        const stack = G.spaces[space.id].land[offer.power];
        if (stack === undefined) continue;
        const take = Math.min(remaining, stack.regular);
        if (take > 0) sources.push(space.id);
        remaining -= take;
        if (remaining === 0) break;
    }
    const units = 5 - remaining;
    const leaderId = sources.flatMap((id) => G.spaces[id].leaders)
        .find((id) => LEADER_BY_ID[id]?.power === offer.power && LEADER_BY_ID[id]?.kind === "army");
    const leader = leaderId !== undefined ? LEADER_BY_ID[leaderId] : undefined;
    const powerNameStr = powerName(offer.power, locale);
    const spaceName = SPACE_BY_ID[offer.space]?.name ?? offer.space;
    const troops = units > 0 ? `${units} ${i18n.chain.vq.board.regulars}` : i18n.chain.vq.board.noRegulars;
    return {
        power: offer.power,
        powerName: powerNameStr,
        space: offer.space,
        spaceName,
        units,
        ...(leaderId !== undefined ? {leaderId} : {}),
        ...(leader !== undefined ? {leaderName: leader.name} : {}),
        label: `${powerNameStr}${i18n.chain.vq.eventTargets.abjurationAlliedAt}${spaceName}${i18n.chain.vq.eventTargets.abjurationAlliedSuffix}${troops}${leader !== undefined ? ` + ${leader.name}` : ""}`,
    };
};

/** Every pending #103 offer, ready for the offer buttons. */
export const abjurationOffers = (G: VQGame): AbjurationOffer[] =>
    (G.pendingAbjuration?.offers ?? []).map((offer) => abjurationOfferDetails(G, offer, i18n.getLocaleName() === "en" ? "en" : "zh_CN"));

/**
 * The offer whose button is highlighted.  A stale/unknown selection falls
 * back to the first offer so the panel always shows exactly one selection.
 */
export const abjurationSelection = (offers: AbjurationOffer[], power: Power | undefined): AbjurationOffer | undefined =>
    offers.find((offer) => offer.power === power) ?? offers[0];

/** Argument passed to `chooseAbjuration` when the Protestant accepts an offer. */
export const abjurationOfferMove = (offer: AbjurationOffer): {power: Power} => ({power: offer.power});

/** Routes an accepted offer through the boardgame.io move set. */
export const acceptAbjurationOffer = (moves: BoardProps<VQGame>["moves"], offer: AbjurationOffer): void =>
    (moves as unknown as {chooseAbjuration: (args: {power: Power}) => void})
        .chooseAbjuration(abjurationOfferMove(offer));
