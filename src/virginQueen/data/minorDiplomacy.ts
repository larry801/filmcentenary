import {MinorPower, Power} from "../constant/general";

/**
 * Diplomatic Influence Table relationships. `eligible` is the set of powers
 * with a marker on each track; `activateOrder` lists the printed Activate
 * powers (membership only).  Rule 24.6 resolves ties by Impulse Order, not by
 * this list — the roll in `resolveMinorDiplomacy` sorts on `POWERS`.
 */
export interface MinorDiplomacyDef {
    eligible: Power[];
    activateOrder: Power[];
    deactivate: Power[];
}

export const MINOR_DIPLOMACY: Record<MinorPower, MinorDiplomacyDef> = {
    papacy: {
        eligible: ["spain", "france", "hre"],
        activateOrder: ["spain", "france", "hre"],
        deactivate: [],
    },
    venice: {
        eligible: ["spain", "france", "hre", "ottoman"],
        activateOrder: ["spain", "france", "hre"],
        deactivate: ["ottoman"],
    },
    scotland: {
        eligible: ["england", "france", "protestant"],
        activateOrder: ["england", "france", "protestant"],
        deactivate: ["england"],
    },
    ireland: {
        eligible: ["england", "france", "hre", "spain"],
        activateOrder: ["spain", "france", "hre"],
        deactivate: ["england"],
    },
    portugal: {
        eligible: ["spain", "france", "england"],
        activateOrder: ["spain", "france", "england"],
        deactivate: [],
    },
};
