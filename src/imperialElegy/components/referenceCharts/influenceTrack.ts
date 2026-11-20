/**
 * Chart 7 — the Major Power Influence Track (the "Player Display").
 *
 * The chart itself is a track of boxes 0–10 for the six powers plus Italy: the
 * art carries the flags and the box colours, and this transcription carries
 * the scoring note.  The live track is drawn by `MpitPanel`; this is the
 * printed sheet's own wording.
 */
import {bullets, prose, same, t, table, type ChartText} from "./types";

export const INFLUENCE_TRACK: ChartText = {
  id: "influence-track",
  title: t("Player Display", "玩家面板"),
  sections: [
    {
      title: t("Major Power Influence Track", "大国影响力轨道"),
      blocks: [
        prose(
          "One column per major power (GE, UK, FR, AU, RU, OT) and one for Italy. Each column runs from 0 to 10; a marker on 0 or 1 is minimum influence.",
          "每个大国一列（GE、UK、FR、AU、RU、OT），意大利另占一列。每列从 0 到 10；标记位于 0 或 1 即最低影响力。",
        ),
        table(
          [t("Power", "势力"), t("Track", "轨道"), t("At 0–1", "0–1 时")],
          [
            [t("GE", "德国"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
            [t("UK", "英国"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
            [t("FR", "法国"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
            [t("AU", "奥匈"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
            [t("RU", "俄国"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
            [t("OT", "奥斯曼"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
            [t("Italy", "意大利"), t("0 to 10", "0 至 10"), t("Current position minimum influence", "当前位置为最低影响力")],
          ],
        ),
        prose(
          "Only roll for MPIT markers that are ≥ 1. If the differential is ≥ 10 the alliance chit is shifted twice.",
          "仅为 ≥1 的 MPIT 标记掷骰。若差值 ≥10，同盟标记移动两格。",
        ),
        bullets(
          t(
            "Major Power Influence Track: 1–4 CP adds influence equal to the CP spent (12.1).",
            "大国影响力轨道：1–4 CP，按花费的 CP 增加等量影响力（12.1）。",
          ),
          t(
            "At the alliance resolution step (8.6) a die is rolled for every marker ≥ 1 and its influence is added as a DRM.",
            "在同盟结算步骤（8.6），每个 ≥1 的标记各掷 1 个骰子，其影响力作为 DRM 加入。",
          ),
          t(
            "After unification Italy can only be influenced on the MPIT.",
            "意大利统一之后，只能在 MPIT 上对其施加影响。",
          ),
        ),
      ],
    },
  ],
};
