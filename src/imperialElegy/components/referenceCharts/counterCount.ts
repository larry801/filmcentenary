/**
 * Chart 9 — the counter manifest.
 *
 * The published sheet is a spreadsheet of the physical counter mix.  The
 * player rows are the same numbers `engine/counters.ts` enforces (rule 4.2);
 * `referenceCharts.test.ts` pins that agreement, so a transcription that drifts
 * from the engine fails the suite instead of shipping.
 */
import {bullets, prose, same, sub, t, table, type ChartText} from "./types";

export const COUNTER_COUNT: ChartText = {
  id: "counter-count",
  title: t("Counter Count", "单位数量"),
  sections: [
    {
      title: t("Player Counters", "玩家棋子"),
      rule: "4.2",
      blocks: [
        table(
          [
            t("Counter", "棋子"),
            same("GE"),
            same("UK"),
            same("FR"),
            same("AU"),
            same("RU"),
            same("OT"),
            t("Row total", "合计"),
          ],
          [
            [t("Standing Armies", "常备军团"), same("5"), same("5"), same("5"), same("5"), same("5"), same("4"), same("29")],
            [t("Reserve Armies", "预备军团"), same("11"), same("0"), same("9"), same("9"), same("11"), same("1"), same("41")],
            [t("Special Armies", "特殊军团"), same("-"), same("5"), same("-"), same("-"), same("-"), same("4"), same("9")],
            [t("EFs", "远征军"), same("4"), same("5"), same("4"), same("1"), same("3"), same("1"), same("18")],
            [t("ECs", "精英军"), same("4"), same("2"), same("3"), same("2"), same("2"), same("2"), same("15")],
            [t("Squadrons", "分舰队"), same("4"), same("6"), same("4"), same("4"), same("4"), same("4"), same("26")],
            [t("Dreadnoughts", "无畏舰"), same("4"), same("6"), same("4"), same("4"), same("4"), same("4"), same("26")],
            [t("Influ/Control", "影响／控制"), same("12"), same("12"), same("12"), same("12"), same("12"), same("8"), same("68")],
            [t("Influ/Ally", "影响／同盟"), same("5"), same("5"), same("5"), same("5"), same("5"), same("5"), same("30")],
            [t("Special", "特殊"), same("1"), same("2"), same("4"), same("6"), same("1"), same("6"), same("20")],
            [t("Miscellaneous", "杂项"), same("10"), same("9"), same("10"), same("10"), same("10"), same("9"), same("58")],
          ],
          t(
            "The last column is this transcription's own row total. The published sheet's Totals column is offset against its rows (its army-line figures do not equal any row), so it is not reproduced.",
            "最后一列为本表自行计算的逐行合计。原表的合计列与其行错位（军团相关行的数字并不等于任何一行之和），故不照录。",
          ),
        ),
        sub("Notes", "备注"),
        bullets(
          t("Special Armies — UK: 4 Indian armies, one Commonwealth (CW) army", "特殊军团 —— 英国：4 个印度军团，1 个自治领（CW）军团"),
          t("Special Armies — OT: 4 Arab Armies (2 standing, 2 reserve)", "特殊军团 —— 奥斯曼：4 个阿拉伯军团（2 常备、2 预备）"),
          t("EFs — 1 Colonial Elite EF for GE, UK, FR, RU", "远征军 —— 德国、英国、法国、俄国各有 1 个精锐殖民远征军"),
          t(
            "OT + AU — mark 2 squadrons and 2 dreadnoughts as NAR (Naval Arms Race)",
            "奥斯曼 + 奥匈 —— 各将 2 个分舰队与 2 个无畏舰标记为 NAR（海军军备竞赛）",
          ),
          t(
            "Special Counters include — GE: Colonial Keys · UK: Colonial Keys, Colonial Manpower · FR: Colonial Keys, Zouaves, City of Lights x2 · AU: Rights/Citizenship counters x6 · RU: Trans-Siberian RR · OT: Arab Keys, Turkish Manpower, Arab Manpower, Jihad x3",
            "特殊棋子包括 —— 德国：殖民地关键区；英国：殖民地关键区、殖民地人力；法国：殖民地关键区、祖阿夫、光之城 ×2；奥匈：权利／公民权标记 ×6；俄国：西伯利亚大铁路；奥斯曼：阿拉伯关键区、土耳其人力、阿拉伯人力、圣战 ×3",
          ),
          t(
            "Miscellaneous includes — Alliance, CP War Budget, CP Chain, Stability, Manpower, Keys, Industry, Truce x3",
            "杂项包括 —— 同盟、CP 战争预算、CP 链、稳定、人力、关键区、工业、停战 ×3",
          ),
        ),
        prose(
          "Player Totals printed on the sheet: GE 60 · UK 57 · FR 60 · AU 58 · RU 57 · OT 48 (340 counters).",
          "表格上印制的玩家合计：德国 60 · 英国 57 · 法国 60 · 奥匈 58 · 俄国 57 · 奥斯曼 48（共 340 个棋子）。",
        ),
      ],
    },
    {
      title: t("Non-Player Powers", "非玩家势力"),
      blocks: [
        table(
          [
            t("Nation", "国家"),
            t("Armies", "军团"),
            t("ECs", "精英军"),
            t("EFs", "远征军"),
            t("Squadrons", "分舰队"),
            t("Dreadnoughts", "无畏舰"),
            t("Control Markers", "控制标记"),
          ],
          [
            [t("Italy", "意大利"), same("5"), same("-"), same("1"), same("3"), same("1"), same("5")],
            [t("US", "美国"), same("3"), same("-"), same("-"), same("2"), same("2"), same("2")],
            [t("Japan", "日本"), same("2"), same("-"), same("-"), same("2"), same("1"), same("2")],
            [t("Bulgarian", "保加利亚"), same("2"), same("-"), same("-"), same("-"), same("-"), same("1")],
            [t("Serb", "塞尔维亚"), same("2"), same("-"), same("-"), same("-"), same("-"), same("1")],
            [t("Greek", "希腊"), same("2"), same("-"), same("-"), same("2"), same("-"), same("1")],
            [t("Belgian", "比利时"), same("1"), same("-"), same("-"), same("-"), same("-"), same("1")],
            [t("Bosnian", "波斯尼亚"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Polish", "波兰"), same("5"), same("1"), same("-"), same("-"), same("-"), same("-")],
            [t("Bavarian", "巴伐利亚"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Hanoverian", "汉诺威"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Saxon", "萨克森"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Romanian", "罗马尼亚"), same("2"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Sar-Pied", "撒丁-皮埃蒙特"), same("2"), same("-"), same("-"), same("1"), same("-"), same("2*")],
            [t("Two Sicilies", "两西西里"), same("2"), same("-"), same("-"), same("1"), same("-"), same("-")],
            [t("Dutch", "荷兰"), same("1"), same("-"), same("-"), same("1"), same("-"), same("-")],
            [t("Danish", "丹麦"), same("1"), same("-"), same("-"), same("1"), same("-"), same("-")],
            [t("Persia", "波斯"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Qing", "清帝国"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Ethiopia", "埃塞俄比亚"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Zulu", "祖鲁"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Mahdi", "马赫迪"), same("1"), same("-"), same("-"), same("-"), same("-"), same("-")],
            [t("Generic", "通用"), same("4"), same("2"), same("-"), same("-"), same("-"), same("-")],
            [t("Boxers", "义和团"), same("3"), same("-"), same("-"), same("-"), same("-"), same("-")],
          ],
        ),
        prose(
          "*The two Sardinia-Piedmont control markers are the Two Sicilies markers on their flip side.",
          "*撒丁-皮埃蒙特的 2 个控制标记就是两西西里标记的背面。",
        ),
        prose(
          "Italy, the US and the minor powers are outside rule 4.2's player pools; the sheet also prints a Non Player Total of 82.",
          "意大利、美国与小国不在规则 4.2 的玩家棋子池之内；表格另印制非玩家合计 82。",
        ),
      ],
    },
  ],
};
