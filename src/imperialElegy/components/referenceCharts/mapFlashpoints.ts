/**
 * Chart 2 — the flashpoint map's printed panels.
 *
 * The map itself is the published PNG; what is transcribed is the chart's
 * text: the nine flashpoints, the naval-movement rule, the power-projection
 * ladder and the flashpoint summary (which awards the printed card bonuses).
 */
import {bullets, prose, same, sub, t, table, type ChartText} from "./types";

export const MAP_FLASHPOINTS: ChartText = {
  id: "map-flashpoints",
  title: t("Flashpoints", "闪点地区"),
  sections: [
    {
      title: t("Flashpoints", "闪点地区"),
      blocks: [
        table(
          [t("Marker", "标记"), t("Flashpoint", "闪点"), t("Marker", "标记"), t("Flashpoint", "闪点")],
          [
            [same("a."), t("Balkans", "巴尔干"), same("f."), t("Great Game", "大博弈")],
            [same("b."), t("Central Europe", "中欧"), same("g."), t("Germany", "德意志")],
            [same("c."), t("Lowlands", "低地国家"), same("h."), t("Africa", "非洲")],
            [same("d."), t("China & Japan", "清帝国与日本"), same("i."), t("Caucasus", "高加索")],
            [same("e."), t("Italy", "意大利"), same("-"), same("-")],
          ],
        ),
        sub("Map callouts", "地图注释"),
        bullets(
          t(
            "Italy Unified? After unification Italy can only be influenced on the MPIT.",
            "意大利已统一？统一之后，意大利只能在 MPIT（大国影响力轨道）上被施加影响。",
          ),
          t(
            "Berlin Conference Played? Max 1 Influence until Berlin Conference played.",
            "柏林会议已召开？在柏林会议召开之前，最多只能放置 1 点影响力。",
          ),
          t(
            "Players cannot place diplomacy or ally markers in Qing China. If China is attacked in a war of conquest, place the Qing army at full strength in the targeted key. The player that aids the Qing in a war of conquest gains a +1 card marker regardless of the war's outcome.",
            "玩家不能在清帝国放置外交或同盟标记。若清帝国在征服战争中遭到进攻，在被进攻的关键区放置满编的清军。在征服战争中援助清帝国的玩家，无论战争结果如何，获得 +1 抽牌标记。",
          ),
          t(
            "Units supporting to or from a RU home space have their FP halved.",
            "支援进入或离开俄国本土空间的单位，其火力减半。",
          ),
        ),
      ],
    },
    {
      title: t("Naval Movement", "海上移动"),
      blocks: [
        prose(
          "1 Naval MP moves a fleet an unlimited distance through European Waters.",
          "1 点海上移动力可使一支舰队在欧洲水域内移动任意距离。",
        ),
        bullets(
          t("North Atlantic", "北大西洋"),
          t("Baltic Sea", "波罗的海"),
          t("Black Sea", "黑海"),
          t("Western Mediterranean", "西地中海"),
          t("Eastern Mediterranean", "东地中海"),
          t("Indian Ocean", "印度洋"),
          t("Pacific Ocean", "太平洋"),
          t("South Atlantic", "南大西洋"),
          t("South Pacific", "南太平洋"),
        ),
      ],
    },
    {
      title: t("National Flags", "各国旗帜"),
      blocks: [
        prose(
          "The printed board shows one flag per nation; the flags themselves are artwork on the PNG.",
          "印刷版图上每个国家有一面旗帜；旗帜本身是 PNG 图表上的图像。",
        ),
        prose(
          "Bavaria · Bohemia · Bosnia-Herzegovina · Piedmont · Poland · Croatia · Dagestan · Denmark · Serbia · Saxony · Ethiopia · Egypt · Greece · Qing China · Arabs · Hanover · Hungary · India · Tunisia · Tuscany · Ireland · Japan · Bulgaria · Armenia · Romania · Mexico · Sicily · Tripoli · Vatican",
          "巴伐利亚 · 波希米亚 · 波斯尼亚-黑塞哥维那 · 皮埃蒙特 · 波兰 · 克罗地亚 · 达吉斯坦 · 丹麦 · 塞尔维亚 · 萨克森 · 埃塞俄比亚 · 埃及 · 希腊 · 清帝国 · 阿拉伯 · 汉诺威 · 匈牙利 · 印度 · 突尼斯 · 托斯卡纳 · 爱尔兰 · 日本 · 保加利亚 · 亚美尼亚 · 罗马尼亚 · 墨西哥 · 西西里 · 的黎波里 · 梵蒂冈",
        ),
      ],
    },
    {
      title: t("How do Players Get Power Projection?", "玩家如何获得力量投射？"),
      blocks: [
        bullets(
          t(
            "Players can gain a maximum of two power projection per naval box.",
            "每个海军区最多可获得 2 点力量投射。",
          ),
          t(
            "+1 power projection for controlling a port space adjacent to a naval box.",
            "控制一个邻接海军区的港口空间：+1 力量投射。",
          ),
          t(
            "+2 power projection for controlling a port space (either a key or territory) and a naval base adjacent to a naval box.",
            "控制一个港口空间（关键区或领地）以及一个邻接海军区的海军基地：+2 力量投射。",
          ),
          t(
            "Players can only gain power projection from a maximum of three European waters naval boxes.",
            "玩家最多只能从三个欧洲水域海军区获得力量投射。",
          ),
          t(
            "A player's power projection cannot be greater than the number of naval units they control multiplied by two.",
            "玩家的力量投射不能超过其所控制海军单位数量的两倍。",
          ),
        ),
      ],
    },
    {
      title: t("Flashpoint Summary", "闪点汇总"),
      blocks: [
        table(
          [t("Flashpoint", "闪点"), t("To dominate", "支配条件"), t("Reward", "奖励")],
          [
            [t("Germany", "德意志"), t("Control 8 keys", "控制 8 个关键区"), t("+1 card", "+1 张牌")],
            [t("China", "清帝国"), t("Control 3 keys", "控制 3 个关键区"), t("+1 card", "+1 张牌")],
            [t("Italy", "意大利"), t("Control 4 keys", "控制 4 个关键区"), t("+1 card", "+1 张牌")],
            [t("Africa", "非洲"), t("Control most keys (min. 5)", "控制最多关键区（至少 5 个）"), t("+1 card", "+1 张牌")],
            [t("Low Countries", "低地国家"), t("Control both keys", "控制两个关键区"), t("+½ card", "+½ 张牌")],
            [t("Great Game", "大博弈"), t("Control 3 keys", "控制 3 个关键区"), t("+½ card", "+½ 张牌")],
            [t("Balkans", "巴尔干"), t("Control most keys", "控制最多关键区"), t("+½ card", "+½ 张牌")],
            [t("Central Europe", "中欧"), t("Control 3 keys", "控制 3 个关键区"), t("+½ card", "+½ 张牌")],
            [t("Caucasus", "高加索"), t("Control 5 spaces", "控制 5 个空间"), t("+½ card", "+½ 张牌")],
            [t("Power Projection", "力量投射"), t("Lead the track", "轨道领先"), t("+1 Industrialization DRM", "+1 工业化 DRM")],
            [t("Suez Canal", "苏伊士运河"), t("If the canal is built, control Egypt", "若运河已建成，控制埃及"), t("+½ card", "+½ 张牌")],
          ],
        ),
      ],
    },
  ],
};
