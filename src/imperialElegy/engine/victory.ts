import {Ctx} from "boardgame.io";
import {GoalId, ImperialElegyState, Power, POWERS, SpaceId} from "../types";
import {GoalDef, GOALS_BY_ID} from "../constant/goals";
import {POWER_DEFS, FLASHPOINTS} from "../constant/powers";
import {SPACES} from "../constant/spaces";
import {CAMPAIGN_SETUP} from "../constant/setup";
import {
  allied,
  controlledBy,
  dominatedFlashpoints,
  effectiveKeyType,
  flashpointController,
  isHomeSpace,
  isPower,
  keyTypeForPower,
  log,
  minorAlliesOf,
  ownsKey,
  recomputeTracks,
  setSpaceControl,
} from "./rules";
import {matchedAuCitizenshipCount} from "./nationality";

const initialControl = (id: SpaceId): string | null => {
  const override = CAMPAIGN_SETUP.controlOverrides.find((o) => o.space === id);
  return override ? override.control : SPACES[id].control;
};

export const europeanKeys = (G: ImperialElegyState, power: Power): number =>
  Object.values(SPACES).filter(
    (s) =>
      s.region === "europe" &&
      // 33.1 Zollverein: GE counts the German unification spaces as
      // territorial keys even though they print no key type.
      keyTypeForPower(G, s.id, power) === "territorial" &&
      G.spaces[s.id].control === power,
  ).length;

export const africaKeys = (G: ImperialElegyState, power: Power): number => {
  let count = Object.values(SPACES).filter((s) => s.region === "africa" && effectiveKeyType(G, s.id) !== undefined && G.spaces[s.id].control === power).length;
  // Minor allies in Africa count for the Africa goals.
  for (const space of Object.values(SPACES)) {
    if (space.region !== "africa" || effectiveKeyType(G, space.id) === undefined) continue;
    const state = G.spaces[space.id];
    if (state.control !== null && !isPower(state.control) && state.ally === power) count += 1;
  }
  return count;
};

export const colonialKeys = (G: ImperialElegyState, power: Power, mexicoDouble = false): number => {
  let count = Object.values(SPACES).filter(
    // 33.2.2: independent India never counts as a colonial key, even if a
    // legacy path leaves a control marker behind.
    (s) =>
      effectiveKeyType(G, s.id) === "colonial" &&
      !(s.id === "india" && G.powers.UK.indiaIndependent === true) &&
      G.spaces[s.id].control === power,
  ).length;
  if (mexicoDouble && G.spaces.mexico.control === power) count += 1;
  return count;
};

export const asiaColonialKeys = (G: ImperialElegyState, power: Power, mexicoDouble = false): number => {
  let count = Object.values(SPACES).filter(
    (s) =>
      effectiveKeyType(G, s.id) === "colonial" &&
      s.region === "asia" &&
      !(s.id === "india" && G.powers.UK.indiaIndependent === true) &&
      G.spaces[s.id].control === power,
  ).length;
  // The South & Central Pacific counts as Asia for NGs (3.1.5).
  count += Object.values(SPACES).filter((s) => s.region === "pacific" && effectiveKeyType(G, s.id) !== undefined && G.spaces[s.id].control === power).length;
  return count;
};

const controlledHomeKeys = (G: ImperialElegyState, power: Power): SpaceId[] =>
  Object.values(SPACES).filter((s) => s.home === power && effectiveKeyType(G, s.id) !== undefined && G.spaces[s.id].control === power).map((s) => s.id);

export const germanKeysControlled = (G: ImperialElegyState, power: Power): number =>
  Object.values(SPACES).filter((s) => (s.home === "GE" || s.flashpoints?.includes("germany")) && G.spaces[s.id].control === power).length;

export const italianKeysControlled = (G: ImperialElegyState, power: Power): number =>
  Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy") && G.spaces[s.id].control === power).length;

export const goalMetric = (G: ImperialElegyState, power: Power, goal: GoalDef): number => {
  switch (goal.kind) {
    case "rankedEuropeanKeys": return G.powers[power].territorialKeys;
    case "rankedAfricaKeys": return africaKeys(G, power);
    case "rankedAlliances": return minorAlliesOf(G, power).length;
    case "rankedStability": return G.powers[power].stability;
    case "rankedFlashpoints": {
      const dominated = dominatedFlashpoints(G, power);
      let count = dominated.filter((f) => f !== "powerProjection").length;
      if (dominated.includes("powerProjection")) count += 1;
      return count;
    }
    default: return 0;
  }
};

const opposingAlliance = (G: ImperialElegyState, power: Power): "te" | "ta" | null => {
  const box = G.powers[power].alliance;
  if (box === "teAligned" || box === "teCommitted") return "te";
  if (box === "taAligned" || box === "taCommitted") return "ta";
  return null;
};

const sameAlliance = (G: ImperialElegyState, a: Power, b: Power): boolean => {
  const aa = opposingAlliance(G, a);
  const bb = opposingAlliance(G, b);
  return aa !== null && aa === bb;
};

export const achievementReached = (G: ImperialElegyState, power: Power, goal: GoalDef): number => {
  if (goal.noGreatWar && G.gw?.active) return 0;
  switch (goal.condition) {
    case "noGreatWar": return goal.vp;
    case "GE_placeInTheSun": {
      const four = colonialKeys(G, power) >= 4 && asiaColonialKeys(G, power) >= 1;
      const two = colonialKeys(G, power) >= 2 && dominatedFlashpoints(G, power).includes("powerProjection");
      return four || two ? goal.vp : 0;
    }
    case "GE_surrounded": {
      const fr = G.powers.FR.alliance;
      const frOk = fr === "neutral" || !sameAlliance(G, "FR", "GE") ? true : false;
      const au = G.powers.AU.alliance;
      const ru = G.powers.RU.alliance;
      const bothOpposing = opposingAlliance(G, "AU") !== null && opposingAlliance(G, "AU") === opposingAlliance(G, "RU") && opposingAlliance(G, "AU") !== opposingAlliance(G, "GE");
      return frOk && !bothOpposing ? goal.vp : 0;
    }
    case "GE_germanHome": {
      // "Control all German home spaces.  Unification is not sufficient if you
      // later lose a German home space."  The minor German states are
      // unification spaces (33.1.1); once GE has taken one it is a permanent
      // home space (`homeOverride`), and a unified Germany owns them all.
      const homes = Object.values(SPACES).filter(
        (s) =>
          s.home === "GE" ||
          G.spaces[s.id]?.homeOverride === "GE" ||
          s.flashpoints?.includes("germany") === true,
      );
      const controlled = homes.filter((s) => G.spaces[s.id].control === "GE").length;
      if (controlled === homes.length) return goal.vp;
      if (controlled >= 8) return goal.partialVp ?? 0;
      return 0;
    }
    case "UK_twoPower": {
      const pp = Number(G.powers.UK.flags.powerProjection ?? 0);
      const others = POWERS.filter((p) => p !== "UK").map((p) => Number(G.powers[p].flags.powerProjection ?? 0));
      return pp > 0 && pp >= Math.max(0, ...others) * 2 ? goal.vp : 0;
    }
    case "UK_ruleBritannia": {
      const newly = Object.values(SPACES).filter((s) => effectiveKeyType(G, s.id) === "colonial" && s.region !== "northAmerica"
        && G.spaces[s.id].control === "UK" && initialControl(s.id) !== "UK");
      let count = newly.length;
      const newBases = Object.values(SPACES).filter((s) => s.type === "navalBase"
        && G.spaces[s.id].control === "UK" && initialControl(s.id) !== "UK").length;
      count += Math.floor(newBases / 2);
      return count >= 8 ? goal.vp : 0;
    }
    case "UK_balanceOfPower": {
      let one = 0;
      let two = 0;
      for (const s of Object.values(SPACES)) {
        if (s.region !== "europe" || effectiveKeyType(G, s.id) === undefined) continue;
        const owner = G.spaces[s.id].control;
        if (!isPower(owner)) continue;
        if (isHomeSpace(G, s.id, owner)) continue;
        one += 1;
        if (one >= 2) two += 1;
      }
      if (one === 0) return goal.vp;
      if (two === 0) return goal.partialVp ?? 0;
      return 0;
    }
    case "FR_franceResurgent": {
      const six = colonialKeys(G, power, true) >= 6 && asiaColonialKeys(G, power, true) >= 2;
      const three = colonialKeys(G, power, true) >= 3 && dominatedFlashpoints(G, power).includes("powerProjection");
      return six || three ? goal.vp : 0;
    }
    case "FR_cityOfLight": return (G.powers.FR.cityOfLight ?? 0) >= 4 ? goal.vp : 0;
    case "FR_napoleon": {
      let count = 0;
      for (const s of Object.values(SPACES)) {
        if (s.region !== "europe" || effectiveKeyType(G, s.id) === undefined) continue;
        if (G.spaces[s.id].control === "FR" && initialControl(s.id) !== "FR") count += 1;
      }
      count += Math.min(1, minorAlliesOf(G, "FR").filter((m) => {
        const home = Object.values(SPACES).find((s) => s.minorHome === m);
        return home?.region === "europe";
      }).length);
      if (count >= 4) return goal.vp;
      if (count >= 3) return goal.partialVp ?? 0;
      return 0;
    }
    case "AU_containItaly": {
      if (!G.persistent.italyUnified && !G.flags.italyUnified) return goal.vp;
      const italian = Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy"));
      const count = italian.filter((s) => G.spaces[s.id].control === "IT" || G.spaces[s.id].control === "Italy").length;
      return count <= 3 ? goal.vp : 0;
    }
    case "AU_containPrussia": {
      if (!G.powers.GE.unified) return goal.vp;
      return germanKeysControlled(G, "GE") <= 8 ? goal.vp : 0;
    }
    case "AU_precarious":
    case "OT_precarious": {
      const p = G.powers[power];
      const other = POWERS.find((x) => x !== power && G.powers[x].alliance === p.alliance && p.alliance.includes("Committed"));
      return other ? goal.vp : 0;
    }
    case "AU_bindThemTogether": {
      const count = matchedAuCitizenshipCount(G);
      if (count >= 4) return goal.vp;
      if (count >= 3) return goal.partialVp ?? 0;
      return 0;
    }
    case "RU_easternAmbitions": {
      const four = Object.values(SPACES).filter((s) => s.region === "asia" && effectiveKeyType(G, s.id) !== undefined
        && G.spaces[s.id].control === "RU" && initialControl(s.id) !== "RU").length >= 4;
      const two = asiaColonialKeys(G, "RU") >= 2 && dominatedFlashpoints(G, "RU").includes("powerProjection");
      return four || two ? goal.vp : 0;
    }
    case "RU_finishTurks": {
      const balkan = Object.values(SPACES).filter((s) => s.flashpoints?.includes("balkans") || s.region === "europe" && s.name.includes("Balkan"));
      const otBalkan = balkan.filter((s) => G.spaces[s.id].control === "OT").length;
      const otCaucasus = Object.values(SPACES).filter((s) => s.submap === "main" && (s.id === "caucasus" || s.id === "dagestan" || s.id === "georgia" || s.id === "azerbaijan" || s.id === "baku" || s.id === "erzurum" || s.id === "van")).filter((s) => G.spaces[s.id].control === "OT").length;
      return otBalkan <= 2 || otCaucasus === 0 ? goal.vp : 0;
    }
    case "RU_russianHegemony": {
      let count = 0;
      for (const s of Object.values(SPACES)) {
        if (s.region !== "europe" || effectiveKeyType(G, s.id) === undefined) continue;
        if (G.spaces[s.id].control === "RU" && initialControl(s.id) !== "RU") count += 1;
      }
      count += minorAlliesOf(G, "RU").filter((m) => {
        const home = Object.values(SPACES).find((s) => s.minorHome === m);
        return home?.region === "europe";
      }).length;
      if (count >= 5) return goal.vp;
      if (count >= 4) return goal.partialVp ?? 0;
      return 0;
    }
    case "OT_industry4": return G.powers.OT.industry >= 4 ? goal.vp : 0;
    case "OT_deathGrip": {
      // Europe home keys lost, with Egypt treated as lost at the start.
      const keys = Object.values(SPACES).filter((s) => s.home === "OT" && s.region === "europe" && effectiveKeyType(G, s.id) !== undefined);
      let lost = 0;
      for (const s of keys) {
        if (G.spaces[s.id].control !== "OT") lost += 1;
      }
      if (G.spaces.egypt.control !== "OT") lost += 1;
      if (lost < G.turn) return goal.vp;
      if (lost < G.turn + 1) return goal.partialVp ?? 0;
      return 0;
    }
    default:
      return 0;
  }
};

export interface GoalScore {
  goal: GoalId;
  vp: number;
  metric?: number;
  rank?: number;
  note?: string;
}

export const scoreGoals = (G: ImperialElegyState): Record<Power, GoalScore[]> => {
  const result = Object.fromEntries(POWERS.map((p) => [p, [] as GoalScore[]])) as Record<Power, GoalScore[]>;
  // Ranked goals are compared across all powers, but only the selecting player
  // receives the VPs (2.4.2).
  for (const power of POWERS) {
    for (const goalId of G.powers[power].goals) {
      const goal = GOALS_BY_ID[goalId];
      if (!goal) continue;
      if (goal.kind === "achievement") {
        const vp = achievementReached(G, power, goal);
        result[power].push({goal: goalId, vp});
        continue;
      }
      const metrics = POWERS.map((p) => ({power: p, value: goalMetric(G, p, goal)}));
      const sorted = [...metrics].sort((a, b) => b.value - a.value);
      const value = goalMetric(G, power, goal);
      const greater = sorted.filter((m) => m.value > value).length;
      const equal = sorted.filter((m) => m.value === value).length;
      const place = greater + 1;
      // Tied players share the place; the next place reward is skipped.
      let vp = 0;
      if (place === 1) vp = 3;
      else if (place === 2) vp = 2;
      else if (place === 3) vp = 1;
      result[power].push({goal: goalId, vp, metric: value, rank: place, note: equal > 1 ? "tied" : undefined});
    }
  }
  return result;
};

export const stabilityVp = (G: ImperialElegyState, power: Power): number => {
  const effect = POWER_DEFS[power].stability[G.powers[power].stability];
  return effect?.vp ?? 0;
};

export const scoreGame = (G: ImperialElegyState): {scores: Record<Power, number>; details: Record<Power, GoalScore[]>; winners: Power[]} => {
  const details = scoreGoals(G);
  const scores = Object.fromEntries(POWERS.map((p) => [p, 0])) as Record<Power, number>;
  for (const power of POWERS) {
    let total = G.powers[power].vp;
    for (const entry of details[power]) total += entry.vp;
    total += stabilityVp(G, power);
    if (power === "RU" && G.spaces.istanbul?.control === "RU") total += 2;
    if (power === "FR" && G.powers.FR.government === "thirdRepublic") {
      // no direct VP, the ability is a CP grant
    }
    scores[power] = total;
  }
  const max = Math.max(...POWERS.map((p) => scores[p]));
  const winners = POWERS.filter((p) => scores[p] === max);
  return {scores, details, winners};
};

export const checkGermanUnification = (G: ImperialElegyState, ctx?: Ctx): boolean => {
  if (G.powers.GE.unified) return false;
  const german = Object.values(SPACES).filter((s) => s.flashpoints?.includes("germany"));
  const controlled = german.every((s) => {
    const st = G.spaces[s.id];
    return st.control === "GE" || st.diplomacy === "GE" || st.ally === "GE";
  });
  if (!controlled) return false;
  G.powers.GE.unified = true;
  for (const s of german) {
    if (G.spaces[s.id].diplomacy === "GE" || G.spaces[s.id].ally === "GE") {
      setSpaceControl(G, s.id, "GE", {clearDiplomacy: true});
      G.spaces[s.id].diplomacy = null;
      G.spaces[s.id].ally = null;
    }
  }
  // Imperial Germany (GE display): "+1 manpower during the end phase (one
  // time)".  The bonus is granted by the next end phase (`resolveEnd`) and is
  // then a permanent +1 on top of the key-manpower track in `recomputeTracks`,
  // so the per-turn recomputation does not wipe it out.
  if (G.persistent.imperialGermany !== "granted") G.persistent.imperialGermany = "pending";
  log(G, "GE", "germanUnification", {});
  recomputeTracks(G);
  return true;
};

export const checkItalianUnification = (G: ImperialElegyState, ctx?: Ctx): boolean => {
  if (G.persistent.italyUnified) return false;
  const italian = Object.values(SPACES).filter((s) => s.flashpoints?.includes("italy"));
  const controlledByMinor = italian.filter((s) => {
    const c = G.spaces[s.id].control;
    return c === "Sardinia-Piedmont" || c === "Two Sicilies";
  }).length;
  if (controlledByMinor < 3) return false;
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  G.persistent.italyUnifiedAt = G.turn;
  for (const s of italian) {
    // 3.2.6.1: the Italian unification spaces belong to Italy, so its own
    // markers clear and a unified Italy is not a diplomatic asset.  22.2:
    // "All Italian unification spaces that are not controlled by a player
    // become part of the new Kingdom of Italy" — that includes Rome, the
    // Papal States capital, and the other minor-power homes.
    const control = G.spaces[s.id].control;
    if (control === null || control === undefined || !isPower(control)) {
      // 15.3: a live enemy occupation survives the unification.
      setSpaceControl(G, s.id, "IT", {preserveOccupation: true});
    }
    G.spaces[s.id].influence = null;
    G.spaces[s.id].diplomacy = null;
    G.spaces[s.id].ally = null;
  }
  log(G, undefined, "italianUnification", {});
  return true;
};

export const checkAutoVictory = (G: ImperialElegyState): Power | null => {
  for (const power of POWERS) {
    const def = POWER_DEFS[power];
    if (def.autoVictoryKeys !== undefined && G.powers[power].territorialKeys >= def.autoVictoryKeys) return power;
    if (def.autoVictoryColonialKeys !== undefined && G.powers[power].colonialKeys >= def.autoVictoryColonialKeys) return power;
  }
  return null;
};

export const finishGame = (G: ImperialElegyState, reason: string): void => {
  const {scores, details, winners} = scoreGame(G);
  G.scores = scores;
  G.result = {winners, reason, scores};
  log(G, undefined, "gameOver", {winners: winners.join(","), reason});
};
