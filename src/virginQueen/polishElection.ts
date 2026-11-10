import i18n from "../constant/i18n";
import {VQGame} from "./constant/general";
import {cardById, cardName} from "./constant/cards";

export type PolishElectionPower = "france" | "hre" | "spain";

/** #86 bids are resolved in this fixed order, which also breaks ties. */
export const POLISH_ELECTION_POWERS: PolishElectionPower[] = ["france", "hre", "spain"];

export interface PolishElectionBidOption {
    /** Segment value for one power: "" (auto), a card id, or "treasure:N". */
    value: string;
    label: string;
}

/** Chosen segment per bidding power; a missing or empty entry means auto. */
export type PolishElectionBidChoices = Partial<Record<PolishElectionPower, string>>;

/** What `resolvePolishElection` does without a segment: highest-CP card, else highest treasure. */
export const POLISH_ELECTION_AUTO_LABEL = i18n.chain.vq.board.polishAuto;

/**
 * Bid choices for one power in #86, in the same order the engine considers
 * them: non-mandatory hand cards by descending CP, then treasures.  Mandatory
 * cards are never legal bids, so they are not offered.
 */
export const polishElectionBidOptions = (G: VQGame, power: PolishElectionPower, locale: "en" | "zh_CN" = "zh_CN"): PolishElectionBidOption[] => {
    const cards = [...G.powers[power].cards]
        .filter((id) => cardById(id).officialKind !== "mandatory")
        .sort((a, b) => cardById(b).cp - cardById(a).cp || a.localeCompare(b))
        .map((id) => {
            const def = cardById(id);
            return {value: id, label: `${cardName(id, locale)}${i18n.chain.vq.eventTargets.parenOpen}${i18n.chain.vq.board.hand} ${def.cp} CP${i18n.chain.vq.eventTargets.parenClose}`};
        });
    const treasures = [...G.powers[power].treasures].sort((a, b) => b - a)
        .map((value) => ({value: `treasure:${value}`, label: `${i18n.chain.vq.board.treasure} ${value}${i18n.chain.vq.eventTargets.parenOpen}${value} CP${i18n.chain.vq.eventTargets.parenClose}`}));
    return [{value: "", label: i18n.chain.vq.board.polishAuto}, ...cards, ...treasures];
};

/** Drops a stored bid that is no longer a legal choice for that power. */
export const polishElectionBidValue = (G: VQGame, power: PolishElectionPower, selected: string | undefined): string => {
    const value = selected ?? "";
    return polishElectionBidOptions(G, power).some((option) => option.value === value) ? value : "";
};

/**
 * Builds the `france:card|hre:card|spain:treasure:N` grammar `playCard`
 * expects.  Auto-bidding powers are omitted; no explicit bid at all yields
 * `undefined` so `playCard` keeps its no-target defaults.
 */
export const polishElectionTargetValue = (G: VQGame, choices: PolishElectionBidChoices): string | undefined => {
    const segments = POLISH_ELECTION_POWERS
        .map((power) => ({power, value: polishElectionBidValue(G, power, choices[power])}))
        .filter((entry) => entry.value !== "")
        .map((entry) => `${entry.power}:${entry.value}`);
    return segments.length > 0 ? segments.join("|") : undefined;
};
