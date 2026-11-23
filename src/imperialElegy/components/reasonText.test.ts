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

test("the log's ' | ' separator is translated part by part and kept", () => {
  expect(engineReasonText("zh_CN", "Stacking limit reached | Not a home space")).toBe(
    "已达堆叠上限 | 不是本国核心领土",
  );
});

test("characteristics gates quote the minor and the counter in Chinese", () => {
  expect(engineReasonText("zh_CN", "Bavaria has no eliteCorps counter left (4.2)")).toBe(
    "巴伐利亚已无精英军棋子（4.2）",
  );
  expect(engineReasonText("zh_CN", "The unit must be built in a home space of Bavaria")).toBe(
    "该单位必须建在巴伐利亚的本土空间",
  );
  expect(engineReasonText("zh_CN", "Bavaria must control that home space")).toBe(
    "巴伐利亚必须控制该本土空间",
  );
});

test("the reserve-army refusal names the power in Chinese", () => {
  expect(engineReasonText("zh_CN", "UK may not build reserve armies")).toBe("英国不能建造预备军");
});

test("a log-only colonial-stability cause is translated", () => {
  expect(engineReasonText("zh_CN", "lost the africa colonial war")).toBe("输掉了非洲殖民战争");
  expect(engineReasonText("zh_CN", "lost the asia colonial war")).toBe("输掉了亚洲殖民战争");
});

test("a plural reasons list from the engine is translated as one list", () => {
  expect(engineReasonText(
    "zh_CN",
    "Only the player allied to Poland may build its units (12.8) | Poland is not independent",
  )).toBe("只有与波兰结盟的玩家可以建造其单位（12.8） | 波兰尚未独立");
});
