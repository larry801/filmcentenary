/**
 * The board's flashpoint and power-projection hints.
 *
 * Both mechanics were correct in the engine but invisible on the board: the
 * map hatches its flashpoint theatres with no key, and the power-projection
 * track never appeared outside the reference chart.  A player who only read
 * the UI could not tell which theatre a space belonged to, who was close to
 * dominating it, or why a port did not raise their projection.
 *
 * These helpers are presentation-only and pure.  They read the same engine
 * helpers the award uses (`flashpointCounts`, `flashpointController`,
 * `flashpointMemberCount`, `powerProjectionParts`), so a line can never claim a
 * threshold or a bonus the rules do not apply.  The printed numbers come from
 * `FLASHPOINTS`, which is the map chart's own Flashpoint Summary.
 */
import {ImperialElegyState, Power, POWERS, SpaceId} from "../types";
import {SPACES} from "../constant/spaces";
import {FLASHPOINTS, POWER_DEFS} from "../constant/powers";
import {
  flashpointController,
  flashpointCounts,
  flashpointMemberCount,
  powerProjectionParts,
} from "../engine/rules";
import {bi} from "./boardHelpers";
import type {IELocale} from "./i18n";

export interface HintLine {
  key: string;
  text: string;
}

const powerLabel = (power: Power, locale: IELocale): string =>
  bi(locale, POWER_DEFS[power].name, POWER_DEFS[power].nameZh);

/** A naval box's short name: "North Atlantic Box" reads as "North Atlantic". */
const boxName = (id: SpaceId, locale: IELocale): string => {
  const def = SPACES[id];
  if (def === undefined) return id;
  return bi(locale, def.name.replace(/ Box$/, ""), def.nameZh.replace(/海域$/, ""));
};

/** The chart's own reward wording: "+1 card", "+½ card", or the projection DRM. */
export const flashpointReward = (id: string, locale: IELocale): string => {
  if (id === "powerProjection") return bi(locale, "+1 Industrialization DRM", "+1 工业化 DRM");
  const bonus = FLASHPOINTS[id]?.cardBonus ?? 0;
  if (bonus === 0) return bi(locale, "no card bonus", "无抽牌奖励");
  return bi(locale, `+${bonus === 0.5 ? "½" : bonus} card`, `+${bonus === 0.5 ? "½" : bonus} 张牌`);
};

/** "key" or "space", the chart's two domination units. */
const unitLabel = (id: string, locale: IELocale): string =>
  FLASHPOINTS[id]?.unit === "spaces" ? bi(locale, "space", "空间") : bi(locale, "key", "关键区");

/**
 * The flashpoint rows for one space: what the space belongs to, where its
 * theatre stands, and what domination pays.
 *
 * A space can be in two theatres (Silesia is Germany and Central Europe), so
 * the panel prints one row per theatre rather than picking a favourite.
 */
export const spaceFlashpointLines = (
  G: ImperialElegyState,
  spaceId: SpaceId,
  viewer: Power | null,
  locale: IELocale,
): string[] => {
  const ids = SPACES[spaceId]?.flashpoints ?? [];
  return ids.flatMap((id) => {
    const def = FLASHPOINTS[id];
    if (def === undefined) return [];
    const name = bi(locale, def.name, def.nameZh);
    const reward = flashpointReward(id, locale);
    const threshold = def.keys;
    const counts = flashpointCounts(G, id);
    const max = Math.max(0, ...counts.values());
    const controllers = flashpointController(G, id);
    if (controllers.length > 0) {
      const holder = controllers.map((power) => powerLabel(power, locale)).join(" / ");
      if (viewer !== null && controllers.includes(viewer)) {
        return [bi(locale,
          `${name}: you dominate (${max}/${threshold}, ${reward})`,
          `${name}：你已支配（${max}/${threshold}，${reward}）`)];
      }
      return [bi(locale,
        `${name}: ${holder} dominates (${max}/${threshold}, ${reward})`,
        `${name}：${holder} 支配（${max}/${threshold}，${reward}）`)];
    }
    const leaders = POWERS.filter((power) => (counts.get(power) ?? 0) === max && max > 0);
    const leader = leaders.length === 1 ? leaders[0] : null;
    if (viewer !== null) {
      const mine = counts.get(viewer) ?? 0;
      const lead = max === 0
        ? bi(locale, "nobody controls one yet", "尚无人控制")
        : leader !== null
          ? leader === viewer
            ? bi(locale, "you lead", "领先")
            : bi(locale, `${powerLabel(leader, locale)} leads with ${max}`, `${powerLabel(leader, locale)} 领先 ${max}`)
          : bi(locale, `tied at ${max}`, `并列 ${max}`);
      return [bi(locale,
        `${name}: you ${mine}/${threshold} (${lead}, ${reward})`,
        `${name}：你 ${mine}/${threshold}（${lead}，${reward}）`)];
    }
    const lead = leader !== null ? `${powerLabel(leader, locale)} ${max}` : `${max}`;
    return [bi(locale,
      `${name}: ${lead}/${threshold} (${reward})`,
      `${name}：${lead}/${threshold}（${reward}）`)];
  });
};

/** The compact line for the map's own space card: just the theatre names. */
export const spaceFlashpointNames = (spaceId: SpaceId, locale: IELocale): string[] =>
  (SPACES[spaceId]?.flashpoints ?? []).flatMap((id) => {
    const def = FLASHPOINTS[id];
    return def === undefined ? [] : [bi(locale, def.name, def.nameZh)];
  });

/**
 * The dock's one opportunity line: a flashpoint the seat is one member short
 * of dominating.
 *
 * A one-short hint is only honest when the theatre can actually reach its
 * threshold.  A region whose printed threshold exceeds its member count could
 * never be dominated, so it is skipped instead of promising an impossible move.
 */
export const flashpointOpportunity = (
  G: ImperialElegyState,
  viewer: Power,
  locale: IELocale,
): HintLine | null => {
  for (const id of Object.keys(FLASHPOINTS)) {
    if (id === "powerProjection" || id === "suez") continue;
    const def = FLASHPOINTS[id];
    // "Control most keys" rows print no minimum (Balkans) or one that cannot
    // be one short from zero (Africa's five); neither can produce this hint.
    if (def.keys <= 1) continue;
    if (flashpointMemberCount(G, id) < def.keys) continue;
    const counts = flashpointCounts(G, id);
    const mine = counts.get(viewer) ?? 0;
    const max = Math.max(0, ...counts.values());
    if (mine !== def.keys - 1 || mine !== max) continue;
    if (flashpointController(G, id).includes(viewer)) continue;
    const name = bi(locale, def.name, def.nameZh);
    const unit = unitLabel(id, locale);
    return {
      key: "flashpointOpportunity",
      text: bi(locale,
        `One more ${unit} in ${name} dominates that flashpoint (${flashpointReward(id, locale)}).`,
        `再取 1 个${name}${unit}即可支配该闪点（${flashpointReward(id, locale)}）。`),
    };
  }
  return null;
};

export interface PowerProjectionHint {
  /** The live track value (the same number the award reads). */
  value: number;
  /** Where the points come from, and the naval ceiling. */
  detail: string;
  /** "lead: +1 Industrialization DRM", "3 behind the UK", … */
  standing: string;
  dominates: boolean;
  leader: Power | null;
  leaderValue: number;
}

export const powerProjectionHint = (
  G: ImperialElegyState,
  power: Power,
  locale: IELocale,
): PowerProjectionHint => {
  const value = Number(G.powers[power].flags.powerProjection ?? 0);
  const parts = powerProjectionParts(G, power);
  const values = POWERS.map((candidate) => [candidate, Number(G.powers[candidate].flags.powerProjection ?? 0)] as const);
  const leaderValue = Math.max(0, ...values.map(([, amount]) => amount));
  const leaders = values.filter(([, amount]) => amount === leaderValue && amount > 0).map(([candidate]) => candidate);
  const controllers = flashpointController(G, "powerProjection");
  const dominates = controllers.includes(power);
  const leader = leaders.length === 1 ? leaders[0] : null;

  let standing: string;
  if (dominates) {
    standing = leaders.length > 1
      ? bi(locale, "joint lead: +1 Industrialization DRM", "并列领先：工业化 +1 DRM")
      : bi(locale, "lead: +1 Industrialization DRM", "领先：工业化 +1 DRM");
  } else if (leader !== null) {
    standing = bi(locale,
      `${leaderValue - value} behind ${powerLabel(leader, locale)}`,
      `落后${powerLabel(leader, locale)} ${leaderValue - value} 点`);
  } else if (leaders.length > 1) {
    standing = bi(locale, `tied at ${leaderValue} — no domination`, `并列 ${leaderValue}，无人支配`);
  } else {
    standing = bi(locale, "no projection yet", "尚无力量投射");
  }

  const counted = parts.parts.filter((part) => part.counted);
  const source = counted.length === 0
    ? bi(locale, "no port or base", "无港口或基地")
    : counted.map((part) => `${boxName(part.box, locale)} ${part.value}`).join(" · ");
  const cap = parts.claimed > parts.navalCap
    ? bi(locale,
      `naval ceiling ${parts.navalCap} cuts ${parts.claimed}`,
      `海军上限 ${parts.navalCap}，港口分 ${parts.claimed} 被截断`)
    : bi(locale, `naval ceiling ${parts.navalCap}`, `海军上限 ${parts.navalCap}`);
  return {
    value,
    detail: bi(locale, `${source} = ${value} (${cap})`, `${source} = ${value}（${cap}）`),
    standing,
    dominates,
    leader,
    leaderValue,
  };
};

/**
 * The dock's second opportunity: one point of projection from a two-way tie
 * for the lead, which the printed chart treats as domination for both.
 *
 * A tie of three or more dominates nobody, so a seat one behind a *shared*
 * lead is not one point away from the bonus and gets no line.
 */
export const powerProjectionOpportunity = (
  G: ImperialElegyState,
  viewer: Power,
  locale: IELocale,
): HintLine | null => {
  const value = Number(G.powers[viewer].flags.powerProjection ?? 0);
  const values = POWERS.map((candidate) => [candidate, Number(G.powers[candidate].flags.powerProjection ?? 0)] as const);
  const leaderValue = Math.max(0, ...values.map(([, amount]) => amount));
  const leaders = values.filter(([, amount]) => amount === leaderValue && amount > 0).map(([candidate]) => candidate);
  if (leaders.length !== 1 || leaderValue === 0) return null;
  if (value !== leaderValue - 1) return null;
  const leader = leaders[0];
  return {
    key: "projectionOpportunity",
    text: bi(locale,
      `Power projection ${value}, one behind ${powerLabel(leader, locale)}: one more point ties for domination (+1 Industrialization DRM).`,
      `力量投射 ${value}，落后${powerLabel(leader, locale)} 1 点——再 +1 即可并列支配（工业化 +1 DRM）。`),
  };
};

/** At most one opportunity for the dock: the map objective first. */
export const opportunityHint = (
  G: ImperialElegyState,
  viewer: Power,
  locale: IELocale,
): HintLine | null => flashpointOpportunity(G, viewer, locale) ?? powerProjectionOpportunity(G, viewer, locale);
