/**
 * Chart 3 — the Crisis Table.
 *
 * The ten rows and the Balkan States table are transcribed from
 * `engine/crisisTable.ts` (`PRINTED_CRISIS_ROWS` / `BALKAN_STATE_TABLE`), which
 * already owns them for the engine.  The footnotes are the printed right-column
 * text the engine records in that module's header comment.
 */
import {bullets, prose, same, t, table, type ChartText} from "./types";

export const CRISIS: ChartText = {
  id: "crisis",
  title: t("Crisis Table", "危机表"),
  sections: [
    {
      title: t("Crisis Track", "危机轨道"),
      blocks: [
        prose(
          "Roll one die when a crisis is incited and read the cell for that result. Every result except an International Conference starts the Great War.",
          "危机被引发时掷 1 个骰子，读取该结果对应的格子。除“国际会议”外，任何结果都会引爆大战。",
        ),
        table(
          [t("Event", "事件"), t("Incident", "事端"), same("1"), same("2"), same("3"), same("4"), same("5"), same("6")],
          [
            [
              t("Assassination", "刺杀"),
              t("Blame", "归咎"),
              t("Minority Nationality", "少数民族"),
              t("Minority Nationality", "少数民族"),
              t("Bordering Nation**", "邻国**"),
              t("Bordering Nation**", "邻国**"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("Naval Arms Race", "海军军备竞赛"),
              t("Naval Incident", "海军事件"),
              t("Fired on fishing boats", "向渔船开火"),
              t("Colonial proxy war", "殖民地代理战争"),
              t("Colonial proxy war", "殖民地代理战争"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("Powder Keg/Balkans Wars: Step 1", "火药桶／巴尔干战争：步骤 1"),
              t("random Balkan state** threatened by", "随机巴尔干国家** 受到威胁，来自"),
              t("Balkan Table (Roll twice)**", "巴尔干表（掷两次）**"),
              t("Balkan Table (Roll twice)**", "巴尔干表（掷两次）**"),
              t("Balkan Table (Roll once)**", "巴尔干表（掷一次）**"),
              t("Balkan Table (Roll once)**", "巴尔干表（掷一次）**"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("Powder Keg/Balkans Wars: Step 2", "火药桶／巴尔干战争：步骤 2"),
              t("Balkan state appeals to", "巴尔干国家求援于"),
              t("Ally (Russia if no ally)", "盟友（无盟友则为俄国）"),
              t("Ally (France if no ally)", "盟友（无盟友则为法国）"),
              t("Ally (France if no ally)", "盟友（无盟友则为法国）"),
              t("Ally (Austria if no ally)", "盟友（无盟友则为奥匈）"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("The Black Hand: Step 1", "黑手会：步骤 1"),
              t("Target", "目标"),
              t("Germany", "德国"),
              t("UK", "英国"),
              t("France", "法国"),
              t("Russia", "俄国"),
              t("Austria", "奥匈"),
              t("Ottomans", "奥斯曼"),
            ],
            [
              t("The Black Hand: Step 2", "黑手会：步骤 2"),
              t("Terrorism supported by", "恐怖活动支持者"),
              t("Minority Nationality", "少数民族"),
              t("Minority Nationality", "少数民族"),
              t("Bordering Nation**", "邻国**"),
              t("Bordering Nation**", "邻国**"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("Bosnian Crisis", "波斯尼亚危机"),
              t("Outraged by annexation", "因吞并而愤怒"),
              t("Balkan Table (Roll twice)**", "巴尔干表（掷两次）**"),
              t("Russia (Unless AU Ally)†", "俄国（除非与奥匈同盟）†"),
              t("Ottomans (Unless AU Ally)†", "奥斯曼（除非与奥匈同盟）†"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("Moroccan Crisis/'Urabi Revolt", "摩洛哥危机／阿拉比起义"),
              t("Outraged by annexation", "因吞并而愤怒"),
              t("Losing Power", "失败方"),
              t("Losing Power", "失败方"),
              t("Losing Power", "失败方"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
            [
              t("Impulsive Leader", "冲动的领袖"),
              t("Rash decision made by", "轻率决定由谁做出"),
              t("Germany", "德国"),
              t("UK", "英国"),
              t("France", "法国"),
              t("Russia", "俄国"),
              t("Austria", "奥匈"),
              t("Ottomans", "奥斯曼"),
            ],
            [
              t("Alliance System/Shifting Alliances", "联盟体系／联盟变动"),
              t("Roll on state table for target", "为目标在国别表上掷骰"),
              t("Border incident", "边境事件"),
              t("Border incident", "边境事件"),
              t("Espionage", "间谍活动"),
              t("Espionage", "间谍活动"),
              t("International Conference*", "国际会议*"),
              t("International Conference*", "国际会议*"),
            ],
          ],
        ),
      ],
    },
    {
      title: t("Balkan States", "巴尔干国家"),
      blocks: [
        table(
          [t("Roll", "骰值"), t("Result", "结果")],
          [
            [same("1"), t("Choice", "选择")],
            [same("2"), t("Bosnia", "波斯尼亚")],
            [same("3"), t("Serbia", "塞尔维亚")],
            [same("4"), t("Bulgaria", "保加利亚")],
            [same("5"), t("Romania", "罗马尼亚")],
            [same("6"), t("Greece", "希腊")],
          ],
        ),
      ],
    },
    {
      title: t("Footnotes", "脚注"),
      blocks: [
        bullets(
          t(
            "*International Conference – Crisis averted: the Great War does not start, reset the WTT to 4. Can only happen once per game. If it happens a second time reroll the die.",
            "*国际会议——危机化解：大战不爆发，世界紧张重置为 4。每局只能发生一次；若第二次出现，重掷骰子。",
          ),
          t(
            "**Special Crisis Table Result: See 22.3 for more details",
            "**特殊危机表结果：详见 22.3",
          ),
          t("† Treat as a 1 if player is allied to AU", "† 若该玩家与奥匈同盟，按 1 处理"),
          t("Treat any results >6 as an International Conference*", "任何 >6 的结果都按国际会议* 处理"),
        ),
      ],
    },
  ],
};
