import {Power, POWERS} from "./types";

/** The rulebook fixes seating and turn order as GE, UK, FR, AU, RU, OT. */
export const IE_SEATS: readonly Power[] = POWERS;

export const IE_SEAT_LABELS: Record<Power, {en: string; zh_CN: string}> = {
  GE: {en: "Germany", zh_CN: "德国"},
  UK: {en: "United Kingdom", zh_CN: "英国"},
  FR: {en: "France", zh_CN: "法国"},
  AU: {en: "Austria-Hungary", zh_CN: "奥匈帝国"},
  RU: {en: "Russia", zh_CN: "俄国"},
  OT: {en: "Ottoman Empire", zh_CN: "奥斯曼帝国"},
};

export const seatPower = (seat: string | number | null | undefined): Power | undefined => {
  const index = Number(seat);
  return Number.isInteger(index) && index >= 0 && index < IE_SEATS.length ? IE_SEATS[index] : undefined;
};

export const powerSeat = (power: Power): string => String(IE_SEATS.indexOf(power));

export const IE_SCENARIOS = [{id: "campaign", name: "Campaign 1850-1920", nameZh: "1850-1920 战役"}] as const;
