/**
 * Typed coverage registry for the national-characteristic bullets printed on
 * the six power displays (33.1–33.6).
 *
 * The printed text lives in `constant/powers.ts`; this module is the audit
 * layer that says, for every bullet, whether the live engine honours it and
 * where.  An entry marked `display-only` must carry the reason it is not live;
 * a `live` entry may still list printed sub-clauses that remain approximations
 * in `gaps` (the registry never claims more than the code does).
 *
 * `characteristicsCoverage.test.ts` pins both directions: every printed bullet
 * has exactly one entry, and every entry points at a real bullet.
 */

import {POWERS, Power} from "../types";
import {POWER_DEFS} from "../constant/powers";

export type CharacteristicStatus = "live" | "display-only";

interface CoverageBase {
  power: Power;
  /** Index into `POWER_DEFS[power].characteristics`. */
  index: number;
  /** Trait name; must be the bullet's leading text before the colon. */
  label: string;
}

export interface LiveCharacteristicCoverage extends CoverageBase {
  status: "live";
  /** `module.ts#helper` references for the live implementation. */
  implementation: string;
  /** Printed sub-clauses that are still partial/approximate. */
  gaps?: readonly string[];
}

export interface DisplayOnlyCharacteristicCoverage extends CoverageBase {
  status: "display-only";
  /** Why the printed rule has no live path yet. */
  reason: string;
}

export type CharacteristicCoverageEntry =
  | LiveCharacteristicCoverage
  | DisplayOnlyCharacteristicCoverage;

export const CHARACTERISTICS_COVERAGE: readonly CharacteristicCoverageEntry[] = [
  // ------------------------------------------------------------------- GE
  {
    power: "GE",
    index: 0,
    label: "Bewegungskrieg",
    status: "live",
    implementation: "engine/limitedWar.ts#initiativeOrder; engine/greatWar.ts#outbreakGreatWar",
  },
  {
    power: "GE",
    index: 1,
    label: "Superior Staff Work",
    status: "live",
    implementation:
      "engine/characteristics.ts#superiorStaffWorkFreeDeploy; engine/characteristics.ts#superiorStaffWorkGwFreeDeploy; engine/characteristics.ts#markSuperiorStaffWorkGwImpulse",
  },
  {
    power: "GE",
    index: 2,
    label: "German Confederation",
    status: "live",
    implementation:
      "engine/characteristics.ts#germanConfederationCandidates; engine/characteristics.ts#applyGermanConfederationHomeOverrides; engine/rules.ts#recomputeTracks; moves.ts#resolvePending",
  },
  {
    power: "GE",
    index: 3,
    label: "Imperial Germany",
    status: "live",
    implementation: "engine/victory.ts#checkGermanUnification; moves.ts#endPhaseSetManpower",
  },
  {
    power: "GE",
    index: 4,
    label: "Blood and Iron!",
    status: "live",
    implementation: "moves.ts#applyEndPhaseStep; moves.ts#resolveBloodAndIron",
  },
  {
    power: "GE",
    index: 5,
    label: "Continental Focus",
    status: "live",
    implementation: "engine/characteristics.ts#pacificationCost; engine/counters.ts#navalCounterLimit",
  },
  {
    power: "GE",
    index: 6,
    label: "Zollverein",
    status: "live",
    implementation: "engine/rules.ts#keyTypeForPower; engine/rules.ts#recomputeTracks",
  },

  // ------------------------------------------------------------------- UK
  {
    power: "UK",
    index: 0,
    label: "Professional Army",
    status: "live",
    implementation: "engine/characteristics.ts#recruitmentLimits; engine/characteristics.ts#landBattleModifier",
  },
  {
    power: "UK",
    index: 1,
    label: "Join Your Country's Army!",
    status: "live",
    implementation:
      "engine/greatWar.ts#outbreakGreatWar; engine/greatWarFlow.ts#placeJoinYourCountrysArmy; engine/counters.ts#counterRemaining; engine/rules.ts#landStackingLimit",
  },
  {
    power: "UK",
    index: 2,
    label: "The Indian Army",
    status: "live",
    implementation:
      "engine/characteristics.ts#recruitmentLimits; engine/characteristics.ts#planIndianArmyDisplacement",
  },
  {
    power: "UK",
    index: 3,
    label: "Maintaining the Status Quo",
    status: "live",
    implementation: "engine/limitedWar.ts#allyCallEligibility; moves.ts#callWarAlly",
  },
  {
    power: "UK",
    index: 4,
    label: "Rapid Deployment",
    status: "live",
    implementation: "engine/characteristics.ts#rapidDeploymentGrant; moves.ts#rapidDeploy",
  },
  {
    power: "UK",
    index: 5,
    label: "Crown Jewel",
    status: "live",
    implementation: "engine/rules.ts#recomputeTracks",
  },
  {
    power: "UK",
    index: 6,
    label: "British Banking",
    status: "live",
    implementation: "engine/characteristics.ts#cardDrawModifier; moves.ts#saveCard",
  },
  {
    power: "UK",
    index: 7,
    label: "India",
    status: "live",
    implementation: "engine/characteristics.ts#cardDrawModifier; engine/characteristics.ts#landBattleModifier",
  },

  // ------------------------------------------------------------------- FR
  {
    power: "FR",
    index: 0,
    label: "The Zouaves",
    status: "live",
    implementation:
      "engine/characteristics.ts#pacificationModifier; engine/characteristics.ts#landBattleModifier; moves.ts#rebuildZouave",
  },
  {
    power: "FR",
    index: 1,
    label: "Second French Empire",
    status: "live",
    implementation:
      "engine/characteristics.ts#governmentBenefits; engine/limitedWar.ts#warBudgetFor; engine/greatWarFlow.ts#beginGwTurn",
  },
  {
    power: "FR",
    index: 2,
    label: "The Third Republic",
    status: "live",
    implementation: "engine/characteristics.ts#governmentBenefits; engine/characteristics.ts#thirdRepublicCp",
  },
  {
    power: "FR",
    index: 3,
    label: "Cultural Symbol",
    status: "live",
    implementation:
      "engine/characteristics.ts#culturalSymbolLoss; engine/characteristics.ts#settleCulturalSymbolLoss; engine/rules.ts#recordOccupation; moves.ts#resolvePending",
  },

  // ------------------------------------------------------------------- AU
  {
    power: "AU",
    index: 0,
    label: "Metternich's Legacy",
    status: "live",
    implementation:
      "engine/characteristics.ts#metternichAllies; moves.ts#chooseHomeCard; moves.ts#endDiplomacy; moves.ts#resolvePending",
  },
  {
    power: "AU",
    index: 1,
    label: "A Compromise Needed",
    status: "live",
    implementation:
      "engine/characteristics.ts#dualMonarchy; engine/characteristics.ts#grantAuCitizenship; moves.ts#applyPrepCharacteristics",
  },
  {
    power: "AU",
    index: 2,
    label: "Reforms - 3 CP",
    status: "live",
    implementation:
      "engine/characteristics.ts#auRightsDecision; engine/characteristics.ts#canGrantCitizenship; moves.ts#auAction",
  },
  {
    power: "AU",
    index: 3,
    label: "Incorporate",
    status: "live",
    implementation: "engine/characteristics.ts#auIncorporateDecision; engine/limitedWar.ts#validateWarAim",
  },
  {
    power: "AU",
    index: 4,
    label: "Unstable Situation",
    status: "live",
    implementation: "engine/characteristics.ts#stabilityLoss",
  },
  {
    power: "AU",
    index: 5,
    label: "Continental Power",
    status: "live",
    implementation: "engine/characteristics.ts#pacificationCost; engine/limitedWar.ts#validateWarAim",
  },
  {
    power: "AU",
    index: 6,
    label: "A New Way Forward",
    status: "live",
    implementation:
      "engine/characteristics.ts#grantAuNewWayForward; engine/characteristics.ts#auNewWayForwardGranted; engine/rules.ts#recomputeTracks; engine/nationality.ts#matchedAuCitizenshipCount",
  },

  // ------------------------------------------------------------------- RU
  {
    power: "RU",
    index: 0,
    label: "Russian Steamroller",
    status: "live",
    implementation: "engine/characteristics.ts#recruitmentLimits; engine/economy.ts#reserveAllowance",
  },
  {
    power: "RU",
    index: 1,
    label: "Scorched Earth",
    status: "live",
    implementation: "engine/characteristics.ts#stabilityLoss; engine/greatWar.ts#applyKeyLoss",
  },
  {
    power: "RU",
    index: 2,
    label: "Endless Space",
    status: "live",
    implementation: "engine/characteristics.ts#endlessSpaceSupport; engine/characteristics.ts#landBattleModifier",
  },
  {
    power: "RU",
    index: 3,
    label: "Trans-Siberian Railroad",
    status: "live",
    implementation:
      "engine/rules.ts#recomputeTracks; engine/characteristics.ts#cardDrawModifier; moves.ts#tsrrRailMove",
  },
  {
    power: "RU",
    index: 4,
    label: "Agrarian",
    status: "live",
    implementation: "engine/characteristics.ts#industryRoll; engine/economy.ts#industryRollNeeded",
  },
  {
    power: "RU",
    index: 5,
    label: "The Second Rome",
    status: "live",
    implementation:
      "engine/characteristics.ts#secondRome; engine/greatWar.ts#outbreakGreatWar; engine/victory.ts#scoreGoals; engine/rules.ts#capitalOf",
  },
  {
    power: "RU",
    index: 6,
    label: "Tsarist Repression",
    status: "live",
    implementation: "engine/characteristics.ts#cardDrawModifier; engine/rules.ts#cardsToDraw",
  },

  // ------------------------------------------------------------------- OT
  {
    power: "OT",
    index: 0,
    label: "Local Autonomy",
    status: "live",
    implementation:
      "engine/rules.ts#keyTypeForPower; engine/rules.ts#recomputeTracks; engine/greatWar.ts#gwStabilityKey; constant/spaces.ts#otLandLocKeyType",
  },
  {
    power: "OT",
    index: 1,
    label: "Ottoman Manpower",
    status: "live",
    implementation:
      "engine/characteristics.ts#recruitmentLimits; engine/characteristics.ts#ottomanArmyTypeFor",
  },
  {
    power: "OT",
    index: 2,
    label: "Europeanization",
    status: "live",
    implementation: "engine/characteristics.ts#industryRoll; moves.ts#industrialize",
  },
  {
    power: "OT",
    index: 3,
    label: "Poor Infrastructure",
    status: "live",
    implementation: "engine/rules.ts#landStackingLimit; engine/rules.ts#isOverstacked",
  },
  {
    power: "OT",
    index: 4,
    label: "Jihad",
    status: "live",
    implementation:
      "engine/characteristics.ts#jihadUse; engine/characteristics.ts#landBattleModifier; engine/greatWar.ts#outbreakGreatWar",
  },
];

/** Coverage entries for one power, in printed bullet order. */
export const characteristicsCoverageFor = (power: Power): CharacteristicCoverageEntry[] =>
  CHARACTERISTICS_COVERAGE.filter((entry) => entry.power === power).sort(
    (a, b) => a.index - b.index,
  );

/** The bullets that still have no live implementer (normally none). */
export const DISPLAY_ONLY_CHARACTERISTICS = CHARACTERISTICS_COVERAGE.filter(
  (entry): entry is DisplayOnlyCharacteristicCoverage => entry.status === "display-only",
);

/** Safety net: the registry must stay in POWER_DEFS order per power. */
export const CHARACTERISTICS_POWER_ORDER = POWERS;
