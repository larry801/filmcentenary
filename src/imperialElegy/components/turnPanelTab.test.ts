/**
 * The turn panel's body choice, shared by the desktop turn panel and the phone's
 * one bottom sheet.
 *
 * The bug this pins: `useBoardModel` brought the War tab to the front when a war
 * started (`setRailTab("war")`), but the desktop turn panel was never given that
 * value — it fell back to its own internal state and stayed on Orders.  A player
 * declared a war (Bismarck's unification war was the report) and the war screen
 * simply never appeared, so the declaration looked like it had done nothing.
 */
import {
  mobileTabForTurnTab,
  resolveTurnTab,
  turnTabForMobileTab,
  turnTabKeys,
} from "./turnPanelTab";
import {readFileSync} from "node:fs";
import {join} from "node:path";

test("the War body exists only while a war runs", () => {
  expect(turnTabKeys(true)).toEqual(["action", "war", "log"]);
  expect(turnTabKeys(false)).toEqual(["action", "log"]);
});

test("a request for a body that no longer exists falls back to Orders", () => {
  expect(resolveTurnTab("war", true)).toBe("war");
  expect(resolveTurnTab("log", true)).toBe("log");
  // The war ended under the reader: the War tab is gone, Orders is in front.
  expect(resolveTurnTab("war", false)).toBe("action");
  // Anything unrecognised (a future body, a stale value) is Orders, never blank.
  expect(resolveTurnTab("nonsense", true)).toBe("action");
});

test("the board's War tab and the dock's War tab are the same body", () => {
  expect(mobileTabForTurnTab("war")).toBe("war");
  expect(mobileTabForTurnTab("log")).toBe("log");
  // Hand and Mat have no turn-panel counterpart, so they leave Orders in front.
  expect(mobileTabForTurnTab("action")).toBe("orders");
  expect(turnTabForMobileTab("war")).toBe("war");
  expect(turnTabForMobileTab("log")).toBe("log");
  expect(turnTabForMobileTab("orders")).toBe("action");
  expect(turnTabForMobileTab("hand")).toBe("action");
  expect(turnTabForMobileTab("mat")).toBe("action");
});

test("the two shells round-trip a war and a log selection", () => {
  for (const tab of ["action", "war", "log"] as const) {
    expect(turnTabForMobileTab(mobileTabForTurnTab(tab))).toBe(tab);
  }
});

/**
 * The regression itself: the model wrote `railTab` but the desktop panel was
 * never handed it.  Static markup cannot run an effect, so this pins the two
 * wiring lines that make the hand-off real.
 */
test("the shell feeds the model's railTab to the desktop turn panel", () => {
  const shell = readFileSync(join(__dirname, "BoardLayout.tsx"), "utf8");
  expect(shell).toContain("activeTab={isPhone ? phoneTurnTab : resolveTurnTab(railTab, warVisible)}");
  // The reader's own tab choice goes back to the same model value.
  expect(shell).toContain("else setRailTab(next);");

  const model = readFileSync(join(__dirname, "useBoardModel.ts"), "utf8");
  // Both shells move on the war's rising edge; the phone sheet also opens.
  expect(model).toContain('setRailTab("war");');
  expect(model).toContain('setMobileTab("war");');
});
