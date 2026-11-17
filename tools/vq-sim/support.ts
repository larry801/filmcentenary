import {Controller, MinorPower, Power, VQGame, isPower} from "../../src/virginQueen/constant/general";
import {minorAlly} from "../../src/virginQueen/util";

/**
 * Major power that decides for a garrison.  A major's stack belongs to its own
 * seat; a minor's stack is decided by the major allied to that minor, which is
 * the seat the moves accept the choice from.
 */
export const controlOf = (G: VQGame, controller: Controller): Power | undefined => {
    if (isPower(controller)) return controller;
    if (controller === "independent") return undefined;
    return minorAlly(G, controller as MinorPower);
};
