/**
 * Chart 5 — Combat Results Table, land/naval modifiers and the support summary.
 *
 * The CRT rows are printed here as text as well as computed by `referenceTables`
 * (which reads them from `crt()`), because the printed chart also carries the
 * footnotes the engine does not print anywhere: Hydraulic Recoil, the naval
 * loss doubling, and the Great War fort/trench clauses.
 */
import {bullets, prose, same, sub, t, table, type ChartText} from "./types";

export const COMBAT_CRT: ChartText = {
  id: "combat-crt",
  title: t("Combat Results Table", "战斗结果表"),
  sections: [
    {
      title: t("Combat Results Table", "战斗结果表"),
      rule: "18.4",
      blocks: [
        table(
          [t("Differential", "差值"), t("Casualties: Att/Def", "伤亡：攻/守"), t("Victor", "胜利方")],
          [
            [t("Att +≥4", "攻 +≥4"), same("0/2*"), t("Att (decisive)†", "攻方（决定性）†")],
            [t("Att + 3", "攻 + 3"), same("1/2*"), t("Attacker", "攻方")],
            [t("Att + 2", "攻 + 2"), same("1/1*"), t("Attacker", "攻方")],
            [t("0 or Att +1", "0 或 攻 +1"), same("1/1**"), t("Attacker", "攻方")],
            [t("Def + 1", "守 + 1"), same("1/1**"), t("Defender", "守方")],
            [t("Def + 2", "守 + 2"), same("1/1*"), t("Defender", "守方")],
            [t("Def + 3", "守 + 3"), same("2/1*"), t("Defender", "守方")],
            [t("Def +≥4", "守 +≥4"), same("2/0*"), t("Def (decisive)†", "守方（决定性）†")],
          ],
          t(
            "The printed sheet spells the Att + 3 victor “Attackear”; the Mar. 2026 errata (PAC) corrects it to “Attacker”.",
            "原表在“攻 + 3”一行的胜利方拼作“Attackear”；2026 年 3 月勘误（PAC）更正为“Attacker（攻方）”。",
          ),
        ),
        prose(
          "Only apply the * and ** portions of the combat results if Hydraulic Recoil has been played.",
          "只有在“液压后坐”（Hydraulic Recoil）已经打出时，才应用战斗结果中的 * 与 ** 部分。",
        ),
        bullets(
          t("** Both sides take +1 casualty", "** 双方各额外承受 1 点伤亡"),
          t("· The victor may inflict +1 casualty to both sides", "· 胜利方可令双方各承受 +1 点额外伤亡"),
          t("† In naval battles, the losing side doubles its losses", "† 海战中，失败方损失翻倍"),
          t("Naval Battles: Dreadnoughts must take the majority of losses", "海战：无畏舰必须承受大部分损失"),
          t(
            "During the GW: players may remove forts to cancel retreats, forts reduce their level by one after a battle, and trenches inflict an additional loss on the attacker.",
            "大战期间：玩家可移除要塞以取消撤退；战斗后要塞等级降一级；堑壕使攻方额外承受 1 点损失。",
          ),
        ),
      ],
    },
    {
      title: t("Land Battle Sequence", "陆战流程"),
      blocks: [
        bullets(
          t("1. Place Battle Chit and choose main attacker/defender", "1. 放置战斗标记，并指定主攻方／主守方"),
          t(
            "2. Calculate the BDRM: (a) total land combat modifiers, (b) declare support (attacker first), (c) commit elite unit (attacker first), (d) player combat cards (attacker first)",
            "2. 计算 BDRM：(a) 全部陆战修正，(b) 宣布支援（攻方先），(c) 投入精锐单位（攻方先），(d) 玩家战斗牌（攻方先）",
          ),
          t(
            "3. Each side rolls a die, with one side adding the BDRM to their die roll",
            "3. 双方各掷 1 个骰子，一方将其 BDRM 加到自己的骰值上",
          ),
          t("4. Determine the differential between the two rolls", "4. 计算两次掷骰之间的差值"),
          t("5. Consult the CRT and apply the results", "5. 查阅战斗结果表并应用结果"),
        ),
      ],
    },
    {
      title: t("Land Combat Modifiers", "陆战修正"),
      rule: "18.2",
      blocks: [
        prose(
          "These modifiers only apply to the main attack/defense force",
          "以下修正只作用于主攻／主守部队",
        ),
        bullets(
          t(
            "Firepower: +X DRM, X = a side's total FP (including supporting FP)",
            "火力：+X DRM，X = 该方总火力（含支援火力）",
          ),
          t("Elite Units: +1 DRM", "精锐单位：+1 DRM"),
          t("Low Stability BM: -1 or -2 (check stability track)", "稳定值低：-1 或 -2（查看稳定轨道）"),
          t("Attacking via a difficult/severe connection: -1", "经由困难／险峻连接进攻：-1"),
          t(
            "Only reduced armies in the main attack/defense force (unless defending in a fort): -1",
            "主攻／主守部队中只有减员军团（在要塞中防御时除外）：-1",
          ),
          t("Amphibious Landing: -1", "两栖登陆：-1"),
          t("Broken LoC: -1", "补给线中断：-1"),
          t("Jihad: -1", "圣战：-1"),
          t("Manpower exhausted (GW only): -1", "人力耗尽（仅大战）：-1"),
          t("Machine Guns: minimum die roll of a 3 for non-rebel units", "机枪：非叛军单位的最小骰值为 3"),
        ),
      ],
    },
    {
      title: t("Naval Combat Modifiers", "海战修正"),
      rule: "19.5",
      blocks: [
        bullets(
          t("Firepower*: +X, X = a side's total FP", "火力*：+X，X = 该方总火力"),
          t("*Squadron FP halved when fighting Dreadnoughts*", "*与无畏舰交战时，分舰队的火力减半*"),
          t("Low Stability BM: -1", "稳定值低：-1"),
          t("No ports adjacent to embattled area: -2", "交战区没有邻接港口：-2"),
          t(
            "2 or more ports adjacent to the embattled area greater than your opponent: +1",
            "邻接交战区的港口比对手多 2 个或以上：+1",
          ),
          t("Only spent units in battle: -1", "战斗中只有已消耗单位：-1"),
          t("Failure to avoid battle: -1", "回避战斗失败：-1"),
          t("Manpower exhausted (GW only): -1", "人力耗尽（仅大战）：-1"),
        ),
      ],
    },
    {
      title: t("Naval Interception", "海上拦截"),
      rule: "19.1",
      blocks: [
        prose(
          "Players must roll a 5 on one die to intercept an opponent. Apply the following DRMs when intercepting:",
          "玩家须掷出 1 个 5 才能拦截对手。拦截时应用以下 DRM：",
        ),
        bullets(
          t(
            "Intercepting player has three or more friendly ports adjacent to the naval box: +1",
            "拦截方在邻接该海军区有 3 个或以上友好港口：+1",
          ),
          t(
            "Moving naval units have no friendly ports adjacent to the naval box: +1",
            "移动中的海军单位在邻接该海军区没有友好港口：+1",
          ),
          t("Friendly naval units already present in the naval box: +1*", "该海军区内已有友方海军单位：+1*"),
          t("UK naval units intercepting into the North Atlantic: +1", "英国海军单位拦截进入北大西洋：+1"),
          t(
            "*This DRM only applies to units that started the impulse in the naval box",
            "*此 DRM 只适用于本行动轮开始时就在该海军区内的单位",
          ),
        ),
      ],
    },
    {
      title: t("Avoid Naval Battle", "回避海战"),
      rule: "19.2",
      blocks: [
        prose(
          "Players must choose the space they are avoiding battle to before attempting an avoid battle roll. Players must roll ≥ 5 on one die to avoid battle:",
          "玩家必须在进行回避战斗掷骰之前，选定回避到的空间。须掷出 1 个 ≥ 5 的骰子才能回避战斗：",
        ),
        bullets(
          t("Avoiding battle in an ocean box: +1", "在洋区回避战斗：+1"),
          t(
            "Attacking player has no friendly ports adjacent to the naval box: +1",
            "进攻方在邻接该海军区没有友好港口：+1",
          ),
          t("Attacker has two more ports than the player avoiding battle: -1", "进攻方港口比回避方多 2 个：-1"),
        ),
      ],
    },
    {
      title: t("Support Summary", "支援汇总"),
      rule: "18.3",
      blocks: [
        prose("A max of two spaces, per side, can support", "每方最多两个空间可以提供支援"),
        sub("How many armies can support?", "多少军团可以支援？"),
        bullets(
          t(
            "The supporting armies are adjacent to both the attacking and the defending space: all armies can support",
            "支援军团同时邻接进攻空间与防御空间：所有军团都可支援",
          ),
          t(
            "The supporting armies are adjacent to the attacking OR the defending space: 1 army can support",
            "支援军团只邻接进攻空间或防御空间其中之一：可支援 1 个军团",
          ),
          t("Armies adjacent via red connections cannot support", "经由红色连接相邻的军团不能支援"),
        ),
        sub("Half Support", "半额支援"),
        prose(
          "Armies under the following conditions support battles at ½ their FP:",
          "符合以下条件的军团以其火力的 ½ 支援战斗：",
        ),
        bullets(
          t(
            "Supporting armies are only adjacent via difficult connections",
            "支援军团仅通过困难连接相邻",
          ),
          t("Supporting armies from a different power", "支援军团来自另一个势力"),
          t("Supporting into or from a RU home space", "支援进入或离开俄国本土空间"),
          t("The supporting armies are in a trench battle", "支援军团处于堑壕战中"),
        ),
        prose("FP can only be halved once", "火力只能减半一次"),
        prose("Grey bar indicates GW only", "灰色条目表示仅大战时适用"),
      ],
    },
    {
      title: t("EF Special Rules", "远征军特殊规则"),      blocks: [
        bullets(
          t("EFs fighting rebel armies or other EFs: 2 FP", "远征军对抗叛军或其他远征军：2 火力"),
          t("EFs fighting non-rebel armies: 0 FP", "远征军对抗非叛军军团：0 火力"),
          t("EFs only have 1 step; if they suffer a step loss they are eliminated", "远征军只有 1 级；若承受 1 级损失即被消灭"),
          t(
            "A force comprised exclusively of EFs can inflict hits against but cannot eliminate non-rebel armies",
            "全由远征军组成的部队只能对非叛军军团造成命中，不能将其消灭",
          ),
          t(
            "A force comprised of EFs and armies cannot take losses on the EFs",
            "由远征军与军团混编的部队不能把损失算在远征军上",
          ),
          t(
            "When a force comprised of EFs and armies takes a step loss on an army they must also eliminate an EF",
            "当远征军与军团混编的部队在军团上承受 1 级损失时，必须同时消灭 1 个远征军",
          ),
          t(
            "Exception: Elite colonial EFs (and the Zouaves) are not subject to the latter bullet point. Instead, in such cases, they are treated as ECs for the purposes of elimination.",
            "例外：精锐殖民远征军（以及祖阿夫）不受上述最后一条限制；此时在消灭判定上按精英军处理。",
          ),
        ),
      ],
    },
  ],
};
