import {CardId, Power, SpaceId} from "../types";

/**
 * Decade labels used by the campaign and by a card's printed entry band.
 *
 * The playbook labels one decade per campaign turn (turn 1 = 1850s … turn 7 =
 * 1910s), so the union includes the 1860s and 1910s even though no card is
 * printed with either entry band.  Cards themselves stay on the five printed
 * bands, so those two turns simply add no cards; see `engine/economy.ts`.
 */
export type Decade = "1850s" | "1860s" | "1870s" | "1880s" | "1890s" | "1900s" | "1910s";

export type CardKind = "action" | "home" | "greatWar";
export type CardType = "event" | "response" | "combat" | "mandatory" | "mandatoryResponse";

export interface SpaceFilter {
  region?: "europe" | "africa" | "asia" | "northAmerica" | "pacific";
  submap?: "main" | "africa" | "asia" | "northAmerica";
  type?: "key" | "territory" | "navalBase" | "capital" | "subcapital";
  controlledBy?: "self" | "enemy" | "neutral" | "any";
  uncontrolled?: boolean;
  homeOf?: "self" | "other";
  hasUnit?: boolean;
  hasPort?: boolean;
  inFlashpoint?: string;
  excluding?: SpaceId[];
  homeSpace?: boolean;
  colonial?: boolean;
  minDistance?: number;
}

export interface PowerFilter {
  side?: "self" | "ally" | "enemy" | "neutral" | "any";
  hasCards?: boolean;
  stabilityAtMost?: number;
}

export type Effect =
  | {type: "stability"; target?: "self" | Power; delta: number; optional?: boolean}
  | {type: "draw"; target?: "self" | Power; count: number}
  | {type: "discard"; target?: "self" | Power; count: number; random?: boolean; allowHome?: boolean}
  | {type: "wtt"; delta: number}
  | {type: "vp"; target?: "self" | Power; delta: number}
  | {type: "mpit"; track: "te" | "ta" | "neutral"; amount: number; target?: "self" | Power}
  | {type: "mpitChoice"; amount: number; track?: "te" | "ta" | "neutral"; target?: "self" | Power}
  | {type: "allianceShift"; direction: "te" | "ta" | "neutral"; steps?: number; target?: "self" | Power}
  | {type: "allianceResolution"}
  | {type: "placeInfluence"; filter?: SpaceFilter; count?: number; target?: "self" | Power}
  | {type: "placeDiplomacy"; filter?: SpaceFilter; count?: number; target?: "self" | Power}
  | {type: "removeInfluence"; filter?: SpaceFilter; count?: number}
  | {type: "removeDiplomacy"; filter?: SpaceFilter; count?: number}
  | {type: "minorAlliance"; filter?: SpaceFilter; count?: number}
  | {type: "removeMinorAlliance"; filter?: SpaceFilter}
  | {type: "controlSpace"; filter?: SpaceFilter; count?: number}
  | {type: "pacification"; filter?: SpaceFilter; value?: number}
  | {type: "fort"; filter?: SpaceFilter; level?: 1 | 2 | 3; remove?: boolean}
  | {type: "fortDelta"; delta: number}
  | {type: "units"; unit: string; count: number; filter?: SpaceFilter; target?: "self" | Power; reduced?: boolean}
  | {type: "removeUnits"; filter?: SpaceFilter; count: number; target?: "self" | Power}
  | {type: "reserve"; target?: "self" | Power; count: number}
  | {type: "industry"; target?: "self" | Power; delta: number}
  | {type: "keys"; target?: "self" | Power; territorial?: number; colonial?: number; arab?: number}
  | {type: "manpower"; target?: "self" | Power; delta: number}
  | {type: "cityOfLight"; delta: number}
  | {type: "indiaStability"; stable: boolean}
  | {type: "tsrr"; complete?: boolean}
  | {
      type: "flag";
      flag: string;
      value: number | boolean | string;
      duration?: "turn" | "war" | "game";
      /**
       * Who receives the flag.  `"self"` (the default) is the playing power,
       * `"global"` is the public `G.flags` / `G.persistent` bag (used by A85's
       * Austria-wide "no citizenship" restriction), and `"others"` is every
       * power except the playing power (A75's +2 DRM to all other players).
       */
      scope?: "self" | "global" | "others";
    }
  | {type: "removeCard"; card?: CardId}
  | {type: "removeThisCard"}
  | {type: "drawReplacement"}
  | {type: "war"; aim?: "liberation" | "unification" | "conquest"; target?: Power; free?: boolean}
  | {type: "peace"; white?: boolean}
  | {type: "shiftAllianceOf"; target: "self" | Power; direction: "te" | "ta" | "neutral"}
  | {type: "suez"; build?: boolean; blockedBy?: Power | false}
  | {type: "italy"; action: "roll" | "unify" | "suppress" | "table"}
  | {type: "meiji"}
  | {type: "americanCivilWar"; side?: "union" | "confederacy"}
  | {type: "minorIndependence"; filter?: SpaceFilter}
  | {type: "rebel"; filter?: SpaceFilter; count?: number; nationality?: string}
  | {type: "jihad"; count: number}
  | {type: "germanUnificationCheck"}
  | {type: "italianUnificationCheck"}
  | {type: "crisis"}
  | {type: "choice"; options: {label: string; labelZh: string; effects: Effect[]}[]}
  | {type: "targetSpace"; filter: SpaceFilter; count?: number; then: Effect[]; optional?: boolean}
  | {type: "targetPower"; filter: PowerFilter; then: Effect[]; optional?: boolean}
  | {type: "if"; condition: string; then: Effect[]; otherwise?: Effect[]}
  | {type: "special"; handler: string; args?: Record<string, unknown>}
  | {type: "note"; text: string};

export interface CardOption {
  label: string;
  labelZh: string;
  text: string;
  textZh: string;
  effects: Effect[];
}

export interface CardDef {
  id: CardId;
  number?: number;
  kind: CardKind;
  power?: Power;
  cp: number;
  entry: Decade;
  type: CardType;
  title: string;
  titleZh: string;
  text: string;
  textZh: string;
  remove?: boolean;
  draw?: boolean;
  effects: Effect[];
  options?: CardOption[];
  /** Module image, relative to public/imperial-elegy. */
  image?: string;
  /** Source note when the transcription or art differs from the module. */
  source?: string;
  correction?: string;
  /** Applies only while at war. */
  warOnly?: boolean;
  /** Requires the GW. */
  gwOnly?: boolean;
}

export const cardIdForAction = (n: number): CardId => `IE-A${String(n).padStart(3, "0")}`;
export const cardIdForHome = (power: Power, n: number): CardId => `IE-H-${power}-${n}`;
export const cardIdForGw = (n: number): CardId => `IE-GW-${String(n).padStart(2, "0")}`;

/**
 * All card data is transcribed in `cards.data.ts`.  This module only holds the
 * types so the engine and the data stay separable.
 */
export interface CardData {
  actions: CardDef[];
  home: CardDef[];
  greatWar: CardDef[];
}

export const isActionCard = (card: CardDef): boolean => card.kind === "action";
