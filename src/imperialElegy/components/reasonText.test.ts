/**
 * The engine's refusal reasons are English state; the Chinese UI has to print
 * them in Chinese.  These pin the two reasons the solo QA report caught (the
 * Vienna manpower ceiling and the AU citizenship gate) plus the fallback that
 * keeps an unknown rule citation visible.
 */
import {engineReasonText} from "./reasonText";

test("an army/manpower ceiling prints in Chinese with its number", () => {
  expect(engineReasonText("zh_CN", "Manpower/army limit 4 reached")).toBe("人力／军团上限 4 已达");
});

test("a nationality reason uses the printed Chinese nationality name", () => {
  expect(engineReasonText("zh_CN", "Italians does not have rights yet")).toBe("意大利尚未获得权利");
  expect(engineReasonText("zh_CN", "Czechs already has full citizenship")).toBe("捷克已获得完整公民权");
});

test("a joined reason list is translated part by part", () => {
  expect(engineReasonText("zh_CN", "Not a home space · Stacking limit reached")).toBe(
    "不是本国核心领土 · 已达堆叠上限",
  );
});

test("an unknown reason stays as printed instead of becoming a generic sentence", () => {
  const reason = "Some future rule citation (12.34)";
  expect(engineReasonText("zh_CN", reason)).toBe(reason);
});

test("the English UI keeps the engine wording", () => {
  expect(engineReasonText("en", "Manpower/army limit 4 reached")).toBe("Manpower/army limit 4 reached");
});
