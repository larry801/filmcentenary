/**
 * The turn panel's body choice, shared by the desktop turn panel and the phone's
 * one bottom sheet.
 *
 * Two bugs are pinned here.  The first: `useBoardModel` brought the War tab to
 * the front when a war started (`setRailTab("war")`), but the desktop turn
 * panel was never given that value — it fell back to its own internal state and
 * stayed on Orders, so a declaration looked like it had done nothing.  The
 * second: the War body only existed while a war ran, which is why declarations
 * were pushed back into the Orders panel and onto the map.  The body now always
 * exists, because that is where a war is declared.
 */
import {
  mobileTabForTurnTab,
  resolveTurnTab,
  turnTabForMobileTab,
  turnTabKeys,
} from "./turnPanelTab";
import {readFileSync} from "node:fs";
import {join} from "node:path";

test("the three bodies always exist, because war is declared before it starts", () => {
  expect(turnTabKeys()).toEqual(["action", "war", "log"]);
});

test("an unrecognised body falls back to Orders, never to a blank panel", () => {
  expect(resolveTurnTab("war")).toBe("war");
  expect(resolveTurnTab("log")).toBe("log");
  expect(resolveTurnTab("action")).toBe("action");
  expect(resolveTurnTab("nonsense")).toBe("action");
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
 * wiring lines that make the hand-off real, plus the declaration edge that
 * used to open a separate chooser dialog instead.
 */
test("the shell feeds the model's railTab to the desktop turn panel", () => {
  const shell = readFileSync(join(__dirname, "BoardLayout.tsx"), "utf8");
  expect(shell).toContain("activeTab={isPhone ? phoneTurnTab : resolveTurnTab(railTab)}");
  // The reader's own tab choice goes back to the same model value.
  expect(shell).toContain("else setRailTab(next);");
  // The War body carries the declaration form, not only a running war's report.
  expect(shell).toContain("<WarDeclarationPanel");

  const model = readFileSync(join(__dirname, "useBoardModel.ts"), "utf8");
  // Both shells move on the war's rising edge; the phone sheet also opens.
  expect(model).toContain('setRailTab("war");');
  expect(model).toContain('setMobileTab("war");');
  // A live home-card entitlement brings the same body to the front.
  expect(model).toContain("if (declarationWaiting && !declarationWasWaiting.current) {");
});
