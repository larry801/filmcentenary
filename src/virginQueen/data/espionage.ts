/** GMT 2024 Reference Card, Espionage Table. Differences are attacker minus defender hits. */
export const assassinationResult = (difference: number, battleRating: number) => ({
    killed: difference >= 2 && difference > battleRating,
    discard: difference >= 2,
    reroll: difference === 1,
    neutralize: difference === 0,
    defensiveActions: difference === -1 ? 2 : difference <= -2 ? 3 : 0,
});

export type CatholicRebellionResult = "victory" | "conversionsAndRebellion" | "conversions" |
    "inspectEngland" | "loseOperatives" | "inspectSpain" | "minusCard";
export const catholicRebellionResult = (difference: number): CatholicRebellionResult =>
    difference >= 4 ? "victory" : difference === 3 ? "conversionsAndRebellion" :
        difference === 2 ? "conversions" : difference === 1 ? "inspectEngland" :
            difference === 0 ? "loseOperatives" : difference === -1 ? "inspectSpain" : "minusCard";
