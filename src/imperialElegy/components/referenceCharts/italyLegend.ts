/**
 * Chart 8 — the Italian mandatory event and the map legend.
 *
 * Rule 22.0's two tables and the unification procedure, then the legend the
 * board itself reuses in `MapLegend` (keys, territory, naval bases, the three
 * connection styles and the Trans-Siberian Railroad).
 */
import {bullets, prose, same, sub, t, table, type ChartText} from "./types";

export const ITALY_LEGEND: ChartText = {
  id: "italy-legend",
  title: t("Italy & Legend", "意大利与图例"),
  sections: [
    {
      title: t("Italian Minor Power Table", "意大利小国表"),
      rule: "22.0",
      blocks: [
        table(
          [t("Roll", "骰值"), t("Result", "结果")],
          [
            [t("≤0", "≤0"), t("A Lost Dream - Remove the Italy Card from the game", "失落的梦想 - 将意大利牌移出游戏")],
            [same("1"), t("Uprising", "起义")],
            [same("2-3"), t("Italian state petitions foreign power for aid", "意大利国家向外国求援")],
            [same("4-5"), t("Internal Italian War", "意大利内战")],
            [same("6"), t("Nationalist wave!", "民族主义浪潮！")],
          ],
        ),
        prose(
          "DRMs: The player who dominates the Italy Flashpoint may apply a -2 DRM",
          "DRM：支配意大利闪点的玩家可应用 -2 DRM",
        ),
        sub("Explanation of results", "结果说明"),
        bullets(
          t(
            "Petition for Aid: If Sardinia-Piedmont or the Kingdom of the Two Sicilies are allied with a player that controls an Italian unification space, the active player removes that player's ally marker from one of those powers. Place a +1 card marker in the Italian unification box if one is not already there. After a player wins an Italian war of unification they gain the +1 card marker.",
            "求援：若撒丁-皮埃蒙特或两西西里王国与某玩家结盟，且该玩家控制一个意大利统一空间，当前玩家从这两个势力之一移除该玩家的同盟标记。若意大利统一框内尚无 +1 抽牌标记，则放置一个。玩家赢得意大利统一战争后获得该 +1 抽牌标记。",
          ),
          t(
            "Internal Italian War: Choose either Sardinia-Piedmont or the Kingdom of the Two Sicilies. That power gains 1 army, 1 naval squadron, and takes control of a neighboring Italian key that is not controlled by a player (there will only ever be one). Eliminate all minor power armies in the conquered space. If Sardinia-Piedmont or the Kingdom of the Two Sicilies now controls 3 or more Italian keys, roll for Italian Unification.",
            "意大利内战：选择撒丁-皮埃蒙特或两西西里王国。该势力获得 1 个军团、1 个分舰队，并控制一个邻接的、无玩家控制的意大利关键区（全场只会有一个）。消灭被征服空间内的所有小国军团。若撒丁-皮埃蒙特或两西西里王国此时控制 3 个或以上意大利关键区，进行意大利统一掷骰。",
          ),
          t(
            "Nationalist Wave!: Choose either Sardinia-Piedmont or the Kingdom of the Two Sicilies. That power immediately takes control of 2 keys in Italy that are not controlled by a player. The active player chooses which keys are taken. Roll Italian Unification.",
            "民族主义浪潮！：选择撒丁-皮埃蒙特或两西西里王国。该势力立即控制意大利境内 2 个无玩家控制的关键区，由当前玩家选择。随后进行意大利统一掷骰。",
          ),
        ),
        sub("Italian Unification Die Roll", "意大利统一掷骰"),
        prose("Roll a die. On a result ≥ 7 Italy immediately unifies. Add the following DRMs:", "掷 1 个骰子。结果 ≥7 时意大利立即统一。应用以下 DRM："),
        bullets(
          t("+2 if there are no player controlled spaces in Italy", "若意大利境内没有玩家控制的空间：+2"),
          t("+1 per key controlled by the Italian minor power with the most keys", "控制关键区最多的意大利小国每控制 1 个关键区：+1"),
          t("If the result < 7 Italy does not unify; end this procedure.", "若结果 <7，意大利不统一，结束此流程。"),
        ),
      ],
    },
    {
      title: t("Kingdom of Italy Table", "意大利王国表"),
      blocks: [
        table(
          [t("Roll", "骰值"), t("Result", "结果")],
          [
            [t("1-2", "1-2"), t("The King Vacillates - Italy gains 2 neutral influence on the MPIT", "国王犹豫不决 - 意大利在 MPIT 上获得 2 点中立影响力")],
            [t("3-4", "3-4"), t("The active player places an Italian control marker in an uncontrolled naval base.", "当前玩家在一个无控制的海军基地放置意大利控制标记。")],
            [t("5-6", "5-6"), t("Italy permanently gains an additional reserve army and an additional naval unit.", "意大利永久获得 1 个额外预备军和 1 个额外海军单位。")],
            [
              t("7+", "7+"),
              t(
                "Italy declares war on OT to conquer an Eastern Mediterranean naval base and either Tunisia or Libya (active player's choice). Do not increase the WTT. Roll a die, on a result ≥ 4 Italy wins. Add the following modifiers: +1 DRM for each Italian naval unit on the Europe map, -1 DRM for each OT naval unit on the Europe map, -2 DRM if OT has an army in Africa. If OT does not control any of the above spaces OR Italy and OT have a truce, treat this result as a 5.",
                "意大利对奥斯曼宣战，以夺取一个东地中海海军基地以及突尼斯或利比亚（由当前玩家选择）。不增加世界紧张。掷 1 个骰子，结果 ≥4 则意大利获胜。应用以下修正：欧洲地图上每个意大利海军单位 +1 DRM，欧洲地图上每个奥斯曼海军单位 -1 DRM，若奥斯曼在非洲有军团则 -2 DRM。若奥斯曼不控制上述任何空间，或意大利与奥斯曼处于停战，将此结果视为 5。",
              ),
            ],
          ],
        ),
        prose("DRMs: +1 DRM if turn 5 or later", "DRM：第 5 回合或之后 +1 DRM"),
        sub("Italian Redeployment", "意大利重新部署"),
        prose(
          "One Italian standing army is placed in Rome and the other two Italian standing armies are placed in spaces that are adjacent to player controlled spaces. If there are two such spaces, place an Italian army in each space. Italian naval units are always placed in Naples or Piedmont if Naples is not Italian controlled.",
          "1 个意大利常备军放置于罗马，另外 2 个意大利常备军放置在与玩家控制空间相邻的空间。若有两个这样的空间，则每个空间各放 1 个意大利军团。意大利海军单位始终放置在那不勒斯或皮埃蒙特（若那不勒斯不受意大利控制）。",
        ),
      ],
    },
    {
      title: t("Italian Wars of Unification Reminder", "意大利统一战争提醒"),
      blocks: [
        prose(
          "Any player with diplomacy or an alliance with either Sardinia-Piedmont or the Kingdom of the Two Sicilies may declare a war for Italian unification. First, the attacking player must declare which Italian state they will give any conquered land to (this must be either Sardinia-Piedmont or the Kingdom of the Two Sicilies), then the attacking player gains an alliance with that power if they do not already have one. See 22.1.6 for more details.",
          "任何与撒丁-皮埃蒙特或两西西里王国拥有外交或同盟的玩家，都可以发动意大利统一战争。首先，攻方必须声明将把征服的土地交给哪个意大利国家（必须是撒丁-皮埃蒙特或两西西里王国），随后若攻方尚未与该势力结盟，则获得其同盟。详见 22.1.6。",
        ),
        prose("Full Strength: 2 FP · Half Strength: 1 FP · Rebel", "满编：2 火力 · 减员：1 火力 · 叛军"),
      ],
    },
    {
      title: t("Legend", "图例"),
      blocks: [
        table(
          [t("Symbol", "符号"), t("Meaning", "含义")],
          [
            [t("Star", "星形"), t("Keys (capitals are stars)", "关键区（首都是星形）")],
            [t("Coloured box", "色块"), t("Territory (Ottoman)", "领地（奥斯曼）")],
            [same("FP"), t("Flashpoint", "闪点")],
            [t("Red pyramid", "红色金字塔"), t("Naval Base (naval units and EFs only)", "海军基地（仅限海军单位与远征军）")],
            [t("Anchor plates", "锚形标记"), t("Sea/Ocean specific ports", "特定海域／洋区港口")],
            [t("Grey double arrow", "灰色双向箭头"), t("Inter map connections", "子地图之间的连接")],
          ],
        ),
        sub("Terrain and connections", "地形与连接"),
        table(
          [t("Line", "线条"), t("Limits", "限制")],
          [
            [
              t("Clear (solid dark)", "通畅（深色实线）"),
              t("March 2 areas · Attack normal · Support normal", "行军 2 个区域 · 进攻正常 · 支援正常"),
            ],
            [
              t("Difficult (dashed)", "困难（虚线）"),
              t("March 1 area max · Attack -1 · Support ½ FP", "行军最多 1 个区域 · 进攻 -1 · 支援 ½ 火力"),
            ],
            [
              t("Severe (solid red)", "险峻（红色实线）"),
              t("March 1 area max · No Rail Movement · Attack -1 · Support not possible", "行军最多 1 个区域 · 不能铁路运输 · 进攻 -1 · 不能支援"),
            ],
            [
              t("Severe connect to new map (dashed red)", "通往新地图的险峻连接（红色虚线）"),
              t("Same as severe", "同险峻"),
            ],
            [
              t("Trans-Siberian Railroad (dash-dot)", "西伯利亚大铁路（点划线）"),
              t("Rail along the railroad only", "仅可沿铁路进行铁路运输"),
            ],
          ],
        ),
      ],
    },
  ],
};
