import {MODE_POWER_ALLOWED} from "./components/board/panels/ActionModePicker";

/**
 * Rule 17.2/17.3: the power card lists only the actions that power may take.
 * Galleys: Ottoman, Spain, France, Holy Roman.  Corsairs: Ottoman only.
 * Race-built galleons: England only.  Galleons: Spain, England, France,
 * Protestant.  Mercenaries: every power except the Ottoman.  Cavalry: Ottoman
 * only.  Rebellions: Protestant only.
 */
describe("action picker power filter (rules 17.2/17.3)", () => {
    const allowed = (mode: string, me: string): boolean => MODE_POWER_ALLOWED[mode]?.(me) !== false;

    it("limits galleys to their four printed powers", () => {
        for (const me of ["ottoman", "spain", "france", "hre"]) expect(allowed("buildGalley", me)).toBe(true);
        for (const me of ["england", "protestant"]) expect(allowed("buildGalley", me)).toBe(false);
    });

    it("limits galleons to their four printed powers", () => {
        for (const me of ["spain", "england", "france", "protestant"]) expect(allowed("buildGalleon", me)).toBe(true);
        for (const me of ["ottoman", "hre"]) expect(allowed("buildGalleon", me)).toBe(false);
    });

    it("allows race-built galleons and corsairs only to England and the Ottoman", () => {
        expect(allowed("buildRacebuilt", "england")).toBe(true);
        expect(allowed("buildRacebuilt", "spain")).toBe(false);
        expect(allowed("buildCorsair", "ottoman")).toBe(true);
        expect(allowed("buildCorsair", "england")).toBe(false);
    });

    it("hides mercenaries from the Ottoman and cavalry from everyone else", () => {
        expect(allowed("recruitMerc", "ottoman")).toBe(false);
        expect(allowed("recruitMerc", "spain")).toBe(true);
        expect(allowed("recruitCav", "ottoman")).toBe(true);
        expect(allowed("recruitCav", "france")).toBe(false);
    });

    it("hides the rebellion action from every power but the Protestant", () => {
        expect(allowed("rebellion", "protestant")).toBe(true);
        for (const me of ["ottoman", "spain", "england", "france", "hre"]) {
            expect(allowed("rebellion", me)).toBe(false);
        }
    });

    it("leaves unrestricted modes available to every power", () => {
        for (const me of ["ottoman", "spain", "england", "france", "hre", "protestant"]) {
            for (const mode of ["moveLand", "moveNaval", "navalTransport", "recruitRegular", "control", "assault", "buildFortress"]) {
                expect(allowed(mode, me)).toBe(true);
            }
        }
    });
});
