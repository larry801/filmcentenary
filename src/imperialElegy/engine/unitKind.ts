/**
 * Unit kinds in both UI languages.
 *
 * The engine builds certain decision labels itself (a retreat split names each
 * unit's kind next to its destination), so the table lives beside the engine
 * rather than in the board's helpers: both halves then print the same word.
 * `components/boardHelpers.ts` re-exports it for the unit chips.
 */
export const UNIT_KIND_LABELS: Readonly<Record<string, {en: string; zh: string}>> = {
  army: {en: "army", zh: "军团"},
  reserveArmy: {en: "R army", zh: "预备军"},
  eliteCorps: {en: "EC", zh: "精英军"},
  expeditionary: {en: "EF", zh: "远征军"},
  eliteColonialEf: {en: "colonial EF", zh: "殖民远征军"},
  zouave: {en: "zouave", zh: "祖阿夫"},
  minorArmy: {en: "minor army", zh: "小国军团"},
  rebelArmy: {en: "rebel army", zh: "叛军"},
  italianArmy: {en: "Italian army", zh: "意大利军团"},
  usArmy: {en: "US army", zh: "美军"},
  squadron: {en: "Sq", zh: "分舰队"},
  dreadnought: {en: "Dn", zh: "无畏舰"},
};

/** One unit kind's label; an unknown kind prints as it is stored. */
export const unitKindLabel = (kind: string, locale: "en" | "zh_CN"): string => {
  const entry = UNIT_KIND_LABELS[kind];
  if (entry === undefined) return kind;
  return locale === "zh_CN" ? entry.zh : entry.en;
};
