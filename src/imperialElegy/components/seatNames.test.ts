/**
 * A047 The Dual Monarchy renames the Austrian seat.  The panel must print
 * "Austrian Empire" before the card resolves (the solo QA report caught 1850
 * already calling it Austria-Hungary) and the formed name afterwards.
 */
import {setupImperialElegy} from "../engine/setup";
import {ieStringsFor} from "./i18n";
import {auFormedForScenario, auFormedForState, seatPowerName} from "./seatNames";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "../types";

const ctx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
} as unknown as Ctx;
const game = (): ImperialElegyState => setupImperialElegy(ctx);

test("the 1850 opening prints the Austrian Empire", () => {
  const G = game();
  expect(auFormedForState(G)).toBe(false);
  expect(seatPowerName(ieStringsFor("zh_CN"), "AU", "zh_CN", false)).toBe("奥地利帝国");
  expect(seatPowerName(ieStringsFor("en"), "AU", "en", false)).toBe("Austrian Empire");
});

test("A047, Hungarian citizenship and a later decade form the Dual Monarchy", () => {
  const flags = game();
  flags.persistent.dualMonarchyPlayed = true;
  expect(auFormedForState(flags)).toBe(true);

  const citizens = game();
  citizens.powers.AU.citizenship = ["Hungarians"];
  expect(auFormedForState(citizens)).toBe(true);

  const later = game();
  later.decade = "1870s";
  expect(auFormedForState(later)).toBe(true);
  expect(seatPowerName(ieStringsFor("zh_CN"), "AU", "zh_CN", true)).toBe("奥匈帝国");
});

test("a setup screen follows the scenario it is about to deal", () => {
  expect(auFormedForScenario("campaign")).toBe(false);
  expect(auFormedForScenario("tutorial1850")).toBe(false);
  expect(auFormedForScenario("s1870")).toBe(true);
  expect(auFormedForScenario("gwTutorial")).toBe(true);
});

test("other powers keep their printed names", () => {
  expect(seatPowerName(ieStringsFor("zh_CN"), "GE", "zh_CN", false)).toBe("德国");
});
