import {OFFICIAL_CARDS} from "./cards";

/**
 * Six-player card pools.  The Scenario Book removes different cards from the
 * Campaign and Tournament decks; both lists are kept here so scenario setup and
 * validation share one source of truth.
 */
export const ALL_CARD_NUMBERS: number[] = OFFICIAL_CARDS.map((c) => c.number);

export const CAMPAIGN_REMOVED_CARDS = [4, 37] as const;
export const TOURNAMENT_REMOVED_CARDS = [4, 11, 37, 58] as const;

export const campaignCards = (): number[] =>
    ALL_CARD_NUMBERS.filter((n) => !CAMPAIGN_REMOVED_CARDS.includes(n as 4 | 37));

export const tournamentCards = (): number[] =>
    ALL_CARD_NUMBERS.filter((n) => !TOURNAMENT_REMOVED_CARDS.includes(n as 4 | 11 | 37 | 58));

export const isCardInPlay = (scenario: "campaign" | "tournament", number: number): boolean =>
    (scenario === "campaign" ? campaignCards() : tournamentCards()).includes(number);
