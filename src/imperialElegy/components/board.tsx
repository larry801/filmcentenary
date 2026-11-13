import React from "react";
import {Ctx} from "boardgame.io";
import Button from "@mui/material/Button";
import {ImperialElegyState, PendingOption, Power, POWERS, SpaceId, Unit} from "../types";
import {SPACES, TSRR_ROUTE, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {effectiveKeyType, friendlySpace, gwAllyImpulseFor, hasLoc, isArmyKind, isHomeSpace, landStackingLimit, landUnitsIn, minorAlliesOf, navalUnitsIn, ownsKey} from "../engine/rules";
import {CARD_BY_ID, cardById, decadeLabel} from "../engine/deck";
import {Decade} from "../constant/cards";
import {cpChainResolution} from "../engine/economy";
import {GOALS_BY_ID} from "../constant/goals";
import {IEBadge, IEPanel, IESurface} from "./theme";
import {ieT} from "./i18n";
import {logText} from "./logText";
import i18n from "../../constant/i18n";
import {
  BALANCE_OF_POWER_CARD,
  amphibiousAssaultCheck,
  navalInterceptCheck,
  navalTransportCheck,
  responseCardEligibility,
} from "../moves";
import {planNavalTransport} from "../engine/navalMovement";
import {
  AU_NATIONALITIES,
  auIncorporateDecision,
  auRightsDecision,
  canGrantCitizenship,
  isCwArmySpace,
  jihadUse,
  passRestriction,
  superiorStaffWorkFreeDeploy,
  TSRR_RAIL_ARMY_KINDS,
  tsrrRail,
} from "../engine/characteristics";
import {polishController, polishRecruitDecision} from "../engine/poland";
import {eventPlayability, gwEventHint} from "../engine/playability";
import {deployReserveLimit, isLoneMinorWar, loneMinorDefender, rapidMobilizationFreeDeploy} from "../engine/limitedWar";
import {polishReserveDeployer} from "../engine/poland";
import {italyAllianceBox, italyAllianceSide} from "../engine/italyEntry";
import {isIndependentItaly} from "../engine/greatWarFlow";
import {treatyOptionLabel} from "../engine/treatyChoice";
import {
  POWER_KEYS,
  amphibiousReasonText,
  bi,
  BATTLE_STAGE,
  cardArt,
  controlLabel,
  interceptReasonText,
  isPowerKey,
  OPTION_ZH,
  PHASE_LABEL,
  pickActionTarget,
  PROMPT_ZH,
  powerOrMinorLabel,
  responseReasonText,
  transportReasonText,
  unitLabel,
} from "./boardHelpers";
import {MapPanel} from "./MapPanel";
import {SpacePanel} from "./SpacePanel";
import {PendingPanel} from "./PendingPanel";
import {HandPanel} from "./HandPanel";
import {DashboardPanel} from "./DashboardPanel";
import {MpitPanel} from "./MpitPanel";
import {NationalActionsPanel} from "./NationalActionsPanel";
import {AmphibiousPanel, NavalTransportPanel, NavalInterceptPanel} from "./NavalPanel";
import {WarPanel} from "./WarPanel";
import {GreatWarPanel} from "./GreatWarPanel";
import {BotSeatsContext} from "./botContext";
import {botMoveFor} from "../engine/bot";

const LogLine = React.memo(({entry, locale}: {entry: ImperialElegyState["log"][number]; locale: "en" | "zh_CN"}) => (
  <div><span className="t">T{entry.turn}</span>{logText(entry, locale)}</div>
));

export interface IEBoardProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  matchID?: string;
  hotseat?: boolean;
}

export const ImperialElegyBoard = ({G, ctx, moves, playerID, hotseat = false}: IEBoardProps) => {
  i18n.use();
  const t = ieT();
  const actualLocale: "en" | "zh_CN" = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  const decade = decadeLabel(G.decade as Decade);
  const viewer = playerID === null || playerID === undefined ? null : POWER_KEYS[Number(playerID)] ?? null;

  const [selected, setSelected] = React.useState<SpaceId | null>(null);
  const [selectedUnit, setSelectedUnit] = React.useState<string | null>(null);
  const [battleFrom, setBattleFrom] = React.useState<SpaceId | null>(null);
  const [navalFrom, setNavalFrom] = React.useState<SpaceId | null>(null);
  const [board, setBoard] = React.useState<"world" | "greatWar">("world");
  const [showCharts, setShowCharts] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [warAim, setWarAim] = React.useState<"conquest" | "liberation" | "unification">("conquest");
  const [warCp, setWarCp] = React.useState(2);
  const [secondObjective, setSecondObjective] = React.useState<SpaceId | "">("");
  const [mpitTarget, setMpitTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "AU");
  const [mpitTrack, setMpitTrack] = React.useState<"te" | "ta" | "neutral">("neutral");
  const [warAlly, setWarAlly] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [warMinor, setWarMinor] = React.useState<string>("");
  const [giveTarget, setGiveTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [giveCardId, setGiveCardId] = React.useState<string>("");
  const [confirmSurrender, setConfirmSurrender] = React.useState(false);
  const [auReformTarget, setAuReformTarget] = React.useState<string>("");
  const [auCitizenTarget, setAuCitizenTarget] = React.useState<string>("");
  const [auIncorporateTarget, setAuIncorporateTarget] = React.useState<string>("");
  const [auSacrifice, setAuSacrifice] = React.useState(false);
  const [tsrrUnitId, setTsrrUnitId] = React.useState<string>("");
  const [tsrrTo, setTsrrTo] = React.useState<string>("");
  const [polishReserve, setPolishReserve] = React.useState(true);
  const [gwTransferTo, setGwTransferTo] = React.useState<string>("");
  const [gwTransferAmount, setGwTransferAmount] = React.useState(1);
  const [showLog, setShowLog] = React.useState(true);
  const [amphibiousFrom, setAmphibiousFrom] = React.useState<string>("");
  const [amphibiousTo, setAmphibiousTo] = React.useState<string>("");
  const [amphibiousUnitIds, setAmphibiousUnitIds] = React.useState<string[]>([]);
  const [transportFrom, setTransportFrom] = React.useState<string>("");
  const [transportTo, setTransportTo] = React.useState<string>("");
  const [transportLand, setTransportLand] = React.useState<string>("");
  const [interceptPort, setInterceptPort] = React.useState<string>("");

  const me = viewer ? G.powers[viewer] : null;
  const phase = G.phase;
  const active = G.activePower;
  const isActive = viewer !== null && viewer === active;
  const eliminated = me?.eliminated === true;
  // Rule 34: a hotseat seat marked as a bot is driven by `botMoveFor` below and
  // is read-only for the person at the keyboard.  Every "may act" flag folds
  // this in, so no control on a bot seat can be clicked.
  const botSeats = React.useContext(BotSeatsContext);
  const isBotViewer = hotseat && viewer !== null && botSeats.has(viewer);
  const pending = G.pending;
  const canDecide = pending !== null && viewer !== null && pending.power === viewer && !isBotViewer;
  const war = G.war;
  const gw = G.gw;
  const battle = G.battle;

  const warBelligerents = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])]
    : [];
  const isPrincipal = viewer !== null && war !== null && (viewer === war.attacker || viewer === war.defender);
  const isBelligerent = viewer !== null && warBelligerents.includes(viewer);

  const cpBudget = (): number => {
    if (viewer === null) return 0;
    if (phase === "action") return G.cpRemaining;
    if (phase === "wartime" && war) return war.budgets[viewer] ?? 0;
    if (phase === "gwManeuver") return G.powers[viewer].gwBudget ?? 0;
    return 0;
  };
  const canAct = viewer !== null && !eliminated && !isBotViewer && isActive && pending === null && (phase === "action" || phase === "wartime" || phase === "gwManeuver");
  const canSpend = (cost: number): boolean => canAct && cpBudget() >= cost;
  const canActionCard = viewer !== null && !eliminated && !isBotViewer && isActive && phase === "action" && pending === null;
  const canPhaseAct = viewer !== null && !eliminated && !isBotViewer && (phase === "end" || phase === "gwPlanning" ? true : isActive);
  const forcedPass = viewer !== null ? passRestriction(G, viewer).forced : false;
  const forcedCardIds = viewer !== null ? passRestriction(G, viewer).cards.map((c) => c.card) : [];
  const forcedGwCard = viewer !== null && phase === "gwManeuver" && G.powers[viewer].gwCard
    ? passRestriction(G, viewer, [G.powers[viewer].gwCard as string]).forced
    : false;
  const forcedPassTitle = bi(actualLocale,
    "A card in hand forbids passing (The Dual Monarchy / Exhaustion). Play it for CP or its event first.",
    "手中有禁止停牌的牌（二元君主国 / 精疲力竭）。请先作为 CP 或事件打出。");
  const hasPhaseButtons = viewer !== null && !eliminated && ((phase === "prep" || phase === "diplomacy") ? canPhaseAct : phase === "action" ? isActive : phase === "end" ? canPhaseAct : false);

  // ------------------------------------------------------------- 33.x national actions
  const nationalActionPhase = viewer !== null && !eliminated && isActive && phase === "action" && pending === null;
  const auRightsEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => auRightsDecision(G, nationality).allowed)
    : [];
  const auReformValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auReformTarget, AU_NATIONALITIES, auRightsEligible)
    : "";
  const auReformDecision = auReformValue !== "" ? auRightsDecision(G, auReformValue) : null;
  const auCitizenEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => canGrantCitizenship(G, "AU", nationality, {sacrificeStability: auSacrifice}).allowed)
    : [];
  const auCitizenValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auCitizenTarget, AU_NATIONALITIES, auCitizenEligible)
    : "";
  const auCitizenDecision = auCitizenValue !== ""
    ? canGrantCitizenship(G, "AU", auCitizenValue, {sacrificeStability: auSacrifice})
    : null;
  const auIncorporateCandidates = nationalActionPhase && viewer === "AU"
    ? Object.values(SPACES)
        .filter((space) => {
          const control = G.spaces[space.id]?.control;
          return typeof control === "string" && !isPowerKey(control) && G.spaces[space.id]?.ally === "AU";
        })
        .map((space) => space.id)
    : [];
  const auIncorporateEligible = auIncorporateCandidates.filter((space) => auIncorporateDecision(G, space).allowed);
  const auIncorporateValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auIncorporateTarget, auIncorporateCandidates, auIncorporateEligible)
    : "";
  const auIncorporate = auIncorporateValue !== "" ? auIncorporateDecision(G, auIncorporateValue) : null;
  const zouaveInPlay = Object.values(G.units).some((unit) => unit.kind === "zouave" && unit.owner === "FR");
  const zouaveReason = zouaveInPlay
    ? bi(actualLocale, "The Zouaves are already in play.", "祖阿夫已在场上。")
    : cpBudget() < 1
      ? bi(actualLocale, "Needs 1 CP in this impulse.", "本行动轮需要 1 CP。")
      : undefined;
  const tsrrPhase = viewer !== null && !eliminated && isActive && (phase === "action" || phase === "wartime") && pending === null;
  const tsrrArmies = tsrrPhase && viewer !== null
    ? Object.values(G.units).filter((unit) => unit.owner === viewer && TSRR_RAIL_ARMY_KINDS.includes(unit.kind) && unit.space && TSRR_ROUTE.includes(unit.space))
    : [];
  const tsrrUnitValue = tsrrPhase && viewer !== null
    ? pickActionTarget(tsrrUnitId, tsrrArmies.map((unit) => unit.id), tsrrArmies.map((unit) => unit.id))
    : "";
  const tsrrFrom = tsrrUnitValue !== "" ? G.units[tsrrUnitValue]?.space ?? null : null;
  const tsrrDestinations = tsrrFrom !== null ? TSRR_ROUTE.filter((space) => space !== tsrrFrom) : [];
  const tsrrToValue = tsrrFrom !== null ? pickActionTarget(tsrrTo, tsrrDestinations, tsrrDestinations) : "";
  const tsrrDecision = tsrrUnitValue !== "" && tsrrToValue !== ""
    ? tsrrRail(G, viewer as Power, tsrrUnitValue, tsrrToValue)
    : null;
  const showNationalActions = viewer !== null && (
    (nationalActionPhase && (viewer === "FR" || viewer === "AU" || viewer === "RU")) || tsrrArmies.length > 0
  );
  const needsCp = (cost: number): string => bi(actualLocale, `Needs ${cost} CP in this impulse.`, `本行动轮需要 ${cost} CP。`);
  const auReformReason = auReformDecision === null
    ? undefined
    : auReformDecision.allowed !== true
      ? auReformDecision.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auCitizenReason = auCitizenDecision === null
    ? undefined
    : auCitizenDecision.allowed !== true
      ? auCitizenDecision.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auIncorporateReason = auIncorporate === null
    ? bi(actualLocale, "No allied minor power is eligible.", "没有符合条件的盟国小国。")
    : auIncorporate.allowed !== true
      ? auIncorporate.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const tsrrReason = tsrrArmies.length === 0
    ? bi(actualLocale, "No army is on the Trans-Siberian Railroad.", "西伯利亚铁路上没有军团。")
    : tsrrDecision !== null && tsrrDecision.allowed !== true
      ? tsrrDecision.reasons.join(" | ")
      : undefined;
  const jihadDecision = battle !== null ? jihadUse(G, "OT", battle) : null;
  const jihadReason = jihadDecision !== null && jihadDecision.allowed !== true
    ? jihadDecision.reasons.join(" | ")
    : undefined;
  const polishOwner = viewer === null ? null : polishController(G);
  const polishArmyDecision = viewer !== null && selected !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "army", selected, 2)
    : null;
  const polishReserveDecision = viewer !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "reserveArmy", null, 2)
    : null;

  // ------------------------------------------------------- 19.10 / 19.1 naval controls
  const lastLog = G.log[G.log.length - 1];
  const lastNavalBox: SpaceId | null = (() => {
    if (!lastLog || lastLog.turn !== G.turn) return null;
    const destination = (): SpaceId | null => {
      if (lastLog.key === "navalMove" && typeof lastLog.args?.to === "string") return lastLog.args.to as SpaceId;
      if (lastLog.key === "gwManeuverAction" && lastLog.args?.kind === "naval" && typeof lastLog.args?.to === "string") {
        return lastLog.args.to as SpaceId;
      }
      return null;
    };
    const box = destination();
    return box !== null && isNavalBox(box) ? box : null;
  })();
  const lastNavalMover: Power | null = lastNavalBox !== null && lastLog?.power !== undefined ? lastLog.power : null;

  const amphibiousVisible = viewer !== null && !eliminated && (phase === "action" || phase === "wartime") && pending === null;
  const ownLoadedArmyAt = (space: SpaceId): boolean =>
    G.spaces[space]?.units.some((id) => {
      const unit = G.units[id];
      return unit !== undefined && unit.owner === viewer && isArmyKind(unit.kind) && !unit.naval;
    }) ?? false;
  const amphibiousOrigins: SpaceId[] = !amphibiousVisible || viewer === null
    ? []
    : Object.values(SPACES)
        .filter((def) => {
          if (!ownLoadedArmyAt(def.id)) return false;
          if (isNavalBox(def.id)) return true;
          return (def.ports?.length ?? 0) > 0 && friendlySpace(G, def.id, viewer);
        })
        .map((def) => def.id);
  const amphibiousFromValue = pickActionTarget(amphibiousFrom, amphibiousOrigins, amphibiousOrigins);
  const amphibiousTargets: SpaceId[] = React.useMemo(() => {
    if (!amphibiousVisible || viewer === null || amphibiousFromValue === "") return [];
    const boxes = isNavalBox(amphibiousFromValue) ? [amphibiousFromValue] : portBoxes(amphibiousFromValue);
    return Object.values(SPACES)
      .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0)
      .filter((def) => (def.ports ?? []).some((box) => boxes.includes(box)))
      .filter((def) => !friendlySpace(G, def.id, viewer))
      .map((def) => def.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amphibiousVisible, viewer, amphibiousFromValue, G.spaces]);
  const amphibiousToValue = pickActionTarget(amphibiousTo, amphibiousTargets, amphibiousTargets);
  const amphibiousBox: SpaceId | null = (() => {
    if (amphibiousFromValue === "" || amphibiousToValue === "") return null;
    if (isNavalBox(amphibiousFromValue)) {
      return portBoxes(amphibiousToValue).includes(amphibiousFromValue) ? amphibiousFromValue : null;
    }
    return portBoxes(amphibiousFromValue).find((box) => portBoxes(amphibiousToValue).includes(box)) ?? null;
  })();
  const amphibiousArmies: string[] = amphibiousBox === null || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => unit.owner === viewer && !unit.naval && isArmyKind(unit.kind) && (unit.space === amphibiousBox || unit.space === amphibiousFromValue))
        .map((unit) => unit.id);
  const chosenAmphibiousArmies = amphibiousUnitIds.filter((id) => amphibiousArmies.includes(id));
  const amphibiousArmyValue = chosenAmphibiousArmies.length > 0
    ? chosenAmphibiousArmies.slice(0, 2)
    : amphibiousArmies.slice(0, 2);
  const amphibiousCheck = amphibiousVisible && viewer !== null
    ? amphibiousAssaultCheck(G, viewer, amphibiousFromValue, amphibiousToValue, amphibiousArmyValue)
    : null;
  const amphibiousPhaseOk = phase === "action" ? isActive : phase === "wartime" ? isBelligerent : false;
  const amphibiousReason = amphibiousCheck === null
    ? undefined
    : amphibiousOrigins.length === 0
      ? bi(actualLocale, "No friendly army is loaded in a port or naval box.", "没有已装载于港口或海域的友方军团。")
      : amphibiousReasonText(actualLocale, amphibiousCheck);
  const amphibiousCanGo = amphibiousCheck?.ok === true && amphibiousPhaseOk;
  const toggleAmphibiousArmy = (id: string, checked: boolean): void => {
    const base = amphibiousArmyValue;
    const next = checked
      ? (base.includes(id) ? base : [...base, id]).slice(0, 2)
      : base.filter((entry) => entry !== id);
    setAmphibiousUnitIds(next);
  };

  // ------------------------------------------------------- 12.3 naval transport
  const transportVisible = viewer !== null && !eliminated && pending === null && battle === null &&
    (phase === "action" || phase === "wartime" || phase === "gwManeuver");
  const transportMajor = viewer !== null ? gwAllyImpulseFor(G, viewer) : null;
  const transportOwns = (owner: string | undefined): boolean =>
    viewer !== null && (owner === viewer || (transportMajor !== null && owner === transportMajor));
  const transportable = (id: string): boolean => {
    const unit = G.units[id];
    return unit !== undefined && transportOwns(unit.owner) && unit.naval !== true && isArmyKind(unit.kind) && Boolean(unit.space);
  };
  const transportOrigins: SpaceId[] = !transportVisible || viewer === null
    ? []
    : [...new Set(Object.values(G.units).filter((unit) => transportable(unit.id)).map((unit) => unit.space as SpaceId))]
        .filter((space) => G.spaces[space] && (isNavalBox(space) || portBoxes(space).length > 0))
        .sort();
  const transportFromValue = pickActionTarget(transportFrom, transportOrigins, transportOrigins);
  const transportLands = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units).filter((unit) => transportable(unit.id) && unit.space === transportFromValue).map((unit) => unit.id);
  const transportLandValue = pickActionTarget(transportLand, transportLands, transportLands);
  const transportFleet = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => transportOwns(unit.owner) && unit.naval === true && unit.space === transportFromValue)
        .map((unit) => unit.id);
  const transportReachableFrom = (target: SpaceId): boolean =>
    viewer !== null && transportLandValue !== "" &&
    planNavalTransport(
      G,
      viewer,
      G.units[transportLandValue],
      transportFleet.map((id) => G.units[id]),
      target,
    ).ok;
  const transportTargets: SpaceId[] = React.useMemo(
    () => !transportVisible || viewer === null || transportLandValue === ""
      ? []
      : Object.values(SPACES)
          .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0 && def.id !== transportFromValue)
          .filter((def) => transportReachableFrom(def.id))
          .map((def) => def.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transportVisible, viewer, transportLandValue, transportFromValue, transportFleet.join(","), G.spaces],
  );
  const transportToValue = pickActionTarget(transportTo, transportTargets, transportTargets);
  const transportCheck = transportVisible && viewer !== null
    ? navalTransportCheck(G, viewer, transportLandValue, transportFleet, transportToValue)
    : null;
  const transportPhaseOk = phase === "action" ? isActive
    : phase === "wartime" ? isActive && war?.status === "maneuver"
      : phase === "gwManeuver" ? isActive
        : false;
  const transportReason = transportCheck === null
    ? undefined
    : transportOrigins.length === 0
      ? bi(actualLocale, "No land unit is in a friendly port or naval box.", "没有位于友好港口或海域的陆军单位。")
      : transportTargets.length === 0
        ? bi(actualLocale, "No friendly port is reachable with this force.", "该部队没有可抵达的友好港口。")
        : transportReasonText(actualLocale, transportCheck.reason);
  const transportCanGo = transportCheck?.ok === true && transportPhaseOk;

  const adjacentPortsToBox: SpaceId[] = lastNavalBox === null
    ? []
    : Object.values(SPACES).filter((def) => (def.ports ?? []).includes(lastNavalBox)).map((def) => def.id);
  const ownAdjacentPorts = viewer === null ? [] : adjacentPortsToBox.filter((id) => friendlySpace(G, id, viewer));
  const interceptPorts = ownAdjacentPorts.length > 0 ? ownAdjacentPorts : adjacentPortsToBox;
  const interceptPortValue = pickActionTarget(interceptPort, interceptPorts, interceptPorts);
  const interceptCheck = lastNavalBox !== null
    ? navalInterceptCheck(G, viewer, interceptPortValue, lastNavalBox)
    : null;
  const interceptReason = interceptCheck === null ? undefined : interceptReasonText(actualLocale, interceptCheck);
  const interceptVisible = lastNavalBox !== null && viewer !== null && !eliminated;

  React.useEffect(() => { (window as any).__IE_STATE__ = G; }, [G]);
  React.useEffect(() => { setSecondObjective(""); setConfirmSurrender(false); }, [selected]);
  React.useEffect(() => { setConfirmSurrender(false); }, [war?.status, war?.attacker, war?.defender]);
  React.useEffect(() => { setBattleFrom(null); setNavalFrom(null); setSelectedUnit(null); }, [phase]);

  // ------------------------------------------------------------------ bot auto-submit (Rule 34)
  // When this board instance belongs to a bot seat in hotseat mode, automatically
  // dispatch the bot's decided move after a short delay so the human player can
  // see what happened before the state advances.
  const botTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // boardgame.io re-syncs the view even when a move is rejected, so an illegal
  // decision used to be re-sent every 500 ms forever (console flood + a frozen
  // match).  Track whether the state actually moved under the same decision.
  const botFailureRef = React.useRef<{key: string; state: string; count: number} | null>(null);
  React.useEffect(() => {
    // Only active in hotseat mode and when this seat is flagged as a bot.
    if (!hotseat || viewer === null || !botSeats.has(viewer) || eliminated) return;

    // The bot needs to act when:
    //   • There is an open pending decision addressed to this power, OR
    //   • It is this power's normal turn to act (action / wartime / prep /
    //     diplomacy / gwManeuver all use isActive; end / gwPlanning / gwWinter
    //     ask all powers to take their turn sequentially so canPhaseAct is true).
    const needsAct =
      (pending !== null && pending.power === viewer) ||
      (pending === null && (
        isActive ||
        phase === "end" ||
        phase === "gwPlanning" ||
        phase === "gwWinter"
      ));

    if (!needsAct) return;

    // Clear any previously scheduled timer before scheduling a new one.
    if (botTimerRef.current !== null) clearTimeout(botTimerRef.current);
    botTimerRef.current = setTimeout(() => {
      botTimerRef.current = null;
      try {
        const decision = botMoveFor(G, ctx, viewer);
        const key = `${decision.move}|${JSON.stringify(decision.args ?? [])}`;
        // A rejected move leaves the state untouched, so "same decision on an
        // unchanged state" is the reliable failure signal.
        const stateKey = `${G.turn}|${phase}|${active}|${G.cpRemaining}|${G.log.length}|${pending?.id ?? "-"}`;
        const previous = botFailureRef.current;
        const count = previous !== null && previous.key === key && previous.state === stateKey
          ? previous.count + 1
          : 0;
        if (count >= 3) {
          // The engine keeps refusing this decision.  Take a legal escape move
          // so the match can continue instead of spinning forever.
          botFailureRef.current = {key, state: stateKey, count};
          const escape: Record<string, string> = {
            action: "endImpulse",
            wartime: "passWarMove",
            prep: "finishPrep",
            diplomacy: "endDiplomacy",
            end: "endPhaseTurn",
            gwPlanning: "endGwPlanningMove",
            gwManeuver: "gwPass",
            gwWinter: "gwResolveWinter",
          };
          const fallback = escape[phase];
          console.warn("[IE bot] repeated invalid decision", key, "→ falling back to", fallback);
          const fn = fallback === undefined ? undefined : (moves as Record<string, () => void>)[fallback];
          if (typeof fn === "function") fn();
          return;
        }
        botFailureRef.current = {key, state: stateKey, count};
        const fn = (moves as Record<string, (...args: unknown[]) => void>)[decision.move];
        if (typeof fn === "function") fn(...(decision.args ?? []));
      } catch (err) {
        console.warn("[IE bot] auto-submit error", err);
      }
    }, 500);

    return () => {
      if (botTimerRef.current !== null) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  // G and ctx change on every game-state update — that is the correct trigger.
  // moves is a stable boardgame.io object; eslint-disable keeps the hook clean.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, ctx, viewer, hotseat, botSeats, eliminated, pending, isActive, phase]);

  const selectedState = selected ? G.spaces[selected] : null;
  const selectedUnitDef = selectedUnit ? G.units[selectedUnit] : undefined;
  const ownUnitsInSelected = selectedState
    ? selectedState.units.map((id) => G.units[id]).filter((u): u is Unit => u !== undefined && viewer !== null && u.owner === viewer)
    : [];
  const ownLandInSelected = ownUnitsInSelected.filter((u) => !u.naval);
  const ownNavalInSelected = ownUnitsInSelected.filter((u) => u.naval);

  const enemyLandTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      if (friendlySpace(G, id, viewer)) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && !u.naval && u.owner !== viewer;
      });
    });
  };
  const enemyNavalTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && u.naval === true && u.owner !== viewer;
      });
    });
  };
  const potentialLandTargets = enemyLandTargetsFrom(selected);
  const potentialNavalTargets = enemyNavalTargetsFrom(selected);

  const unitMoveTargets: SpaceId[] = (() => {
    if (!selectedUnitDef || !selectedUnitDef.space || viewer === null || selectedUnitDef.owner !== viewer) return [];
    return neighboursOf(selectedUnitDef.space).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      if (selectedUnitDef.naval) return true;
      return friendlySpace(G, id, viewer) || (state.influence === viewer && state.control === null);
    });
  })();

  const pendingSpaceTargets: SpaceId[] = canDecide && pending
    ? pending.options.filter((o) => SPACES[o.id]).map((o) => o.id as SpaceId)
    : [];
  const battleTargets = [...enemyLandTargetsFrom(battleFrom), ...enemyNavalTargetsFrom(navalFrom)];

  const myOnMapArmies = viewer === null ? 0 : Object.values(G.units).filter((u) => u.owner === viewer && isArmyKind(u.kind) && u.space).length;
  const myForts = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.fort?.power === viewer).length;
  const myMinorAllies = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.ally === viewer).length;

  const hand = viewer ? G.powers[viewer].hand : [];
  const handCounts = (G as unknown as {handCounts?: Partial<Record<Power, number>>}).handCounts ?? {};
  const goalCounts = (G as unknown as {goalCounts?: Partial<Record<Power, number>>}).goalCounts ?? {};

  const doAction = React.useCallback((fn: () => void) => {
    try {
      fn();
    } catch (error) {
      console.warn("illegal Imperial Elegy action", error);
    }
  }, []);

  const onSelectImpl = React.useRef<(id: SpaceId) => void>(() => {});
  onSelectImpl.current = (id: SpaceId) => {
    if (battleFrom) {
      if (canSpend(1)) doAction(() => moves.landBattle(battleFrom, id));
      setBattleFrom(null);
      return;
    }
    if (navalFrom) {
      if (canSpend(1)) doAction(() => moves.navalBattle(navalFrom, id));
      setNavalFrom(null);
      return;
    }
    if (canDecide && pending && pending.options.some((o) => o.id === id && SPACES[o.id])) {
      doAction(() => moves.resolvePending(id));
      return;
    }
    if (selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space && selectedUnitDef.space !== id) {
      if (phase === "gwManeuver" && !selectedUnitDef.naval) {
        setSelected(id);
        return;
      }
      if (canSpend(1)) {
        if (selectedUnitDef.naval) doAction(() => moves.navalMove([selectedUnitDef.id], id));
        else doAction(() => moves.redeploy(selectedUnitDef.id, id));
      }
      setSelectedUnit(null);
      setSelected(id);
      return;
    }
    setSelected(id);
    setSelectedUnit(null);
  };
  const onSelect = React.useCallback((id: SpaceId) => onSelectImpl.current(id), []);

  const pendingKindLabels = t.pendingKind as unknown as Record<string, string>;
  const pendingKind = pending ? pendingKindLabels[pending.kind] ?? t.pendingDecision : null;
  const pendingPrompt = pending ? (actualLocale === "zh_CN" ? PROMPT_ZH[pending.prompt] ?? pending.prompt : pending.prompt) : "";
  const optionLabel = (o: PendingOption): string => {
    if (o.secret) return t.hidden;
    if (actualLocale === "zh_CN" && o.labelZh !== undefined && o.labelZh !== "") return o.labelZh;
    if (o.id === "done") return o.label === "No more support" ? bi(actualLocale, "No more support", "不再支援") : t.skip;
    const optionCard = typeof o.data?.card === "string" ? o.data.card : null;
    if (optionCard && CARD_BY_ID[optionCard]) {
      const c = CARD_BY_ID[optionCard];
      return `${actualLocale === "zh_CN" ? c.titleZh : c.title} (${bi(actualLocale, "discard", "弃牌")})`;
    }
    if (o.id.startsWith("battle:") || o.id.startsWith("move:")) {
      const target = o.id.slice(o.id.indexOf(":") + 1);
      if (SPACES[target]) {
        const prefix = o.id.startsWith("battle:")
          ? bi(actualLocale, "Another battle", "再战")
          : bi(actualLocale, "Move one space", "移动一格");
        return `${prefix}: ${spaceLabel(target, actualLocale)}`;
      }
    }
    if (SPACES[o.id]) return spaceLabel(o.id, actualLocale);
    if (G.units[o.id]) return unitLabel(G.units[o.id], t);
    if (o.label.startsWith("Play ") && CARD_BY_ID[o.label.slice(5)]) {
      const c = CARD_BY_ID[o.label.slice(5)];
      return `${t.cardType.combat}: ${actualLocale === "zh_CN" ? c.titleZh : c.title}`;
    }
    return actualLocale === "zh_CN" ? OPTION_ZH[o.label] ?? o.label : o.label;
  };
  const canDecline = canDecide && pending !== null && pending.kind !== "combatLosses" && pending.kind !== "combatCard" && pending.kind !== "combatDiscard" && pending.kind !== "decisiveBattle";

  const warStatusLabels: Record<string, string> = {
    warAim: t.warAim,
    alliance: t.warAlliance,
    shift: bi(actualLocale, "Alliance shift", "同盟转换"),
    initiative: bi(actualLocale, "Initiative", "先手"),
    maneuver: t.warManeuver,
    victory: t.warVictory,
    demobilization: t.demobilization,
    done: t.done,
  };
  const warStatusLabel = war ? warStatusLabels[war.status] ?? war.status : "";
  const warAimLabel = (aim: string | null): string =>
    aim === "conquest" ? t.conquest : aim === "liberation" ? t.liberation : aim === "unification" ? t.unification : "—";
  const callableAllies = war && viewer !== null
    ? POWER_KEYS.filter((p) => p !== viewer && !warBelligerents.includes(p) && (handCounts[p] ?? G.powers[p].hand.length) > 0)
    : [];
  const warAllyValue = callableAllies.includes(warAlly) ? warAlly : callableAllies[0];
  const callableMinors = war && viewer !== null && (viewer === war.attacker || viewer === war.defender)
    ? minorAlliesOf(G, viewer).filter((minor) =>
      MINOR_POWER_HOMES[minor] !== undefined &&
      !war.attackerMinors.includes(minor) &&
      !war.defenderMinors.includes(minor))
    : [];
  const warMinorValue = pickActionTarget(warMinor, callableMinors, callableMinors);
  const warBudgetRows = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])].filter(isPowerKey)
    : [];
  const warDefenderMinors = war
    ? [...new Set(war.defenderMinors.filter((m) => m !== war.defender && m !== loneMinorDefender(war)))]
    : [];
  const minorMarkerRows = Object.entries(G.minorCardMarkers ?? {})
    .filter(([, count]) => count !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const warTargetControl = selectedState && isPowerKey(selectedState.control) && selectedState.control !== viewer ? selectedState.control : null;
  const targetControlledSpaces = warTargetControl
    ? Object.values(SPACES).filter((sp) => G.spaces[sp.id]?.control === warTargetControl && sp.id !== selected).map((sp) => sp.id)
    : [];
  const canDeclareWar = canActionCard && war === null && G.wtt < 3 && warTargetControl !== null && G.cpRemaining >= warCp;

  const gwOrderPowers = gw
    ? gw.order.map((slot) => (isPowerKey(slot) ? slot : null)).filter((p): p is Power => p !== null)
    : [];
  const gwBudgetOrder = [...new Set([...gwOrderPowers, ...POWER_KEYS])];
  const gwSlotLabel = (slot: Power | "bonus" | "IT" | "US" | null): string => {
    if (slot === null) return "—";
    if (slot === "bonus") return bi(actualLocale, "Bonus", "奖励");
    if (isPowerKey(slot)) return t.seats[slot];
    if (slot === "IT") {
      return isIndependentItaly(G) ? bi(actualLocale, "Italy (its own)", "意大利（自主）") : bi(actualLocale, "Italy", "意大利");
    }
    return bi(actualLocale, "US", "美国");
  };
  const italyBox = italyAllianceBox(G);
  const italySide = italyAllianceSide(G);
  const italyBoxLabel = italyBox === "neutral"
    ? bi(actualLocale, "neutral box", "中立框")
    : `${italySide === "te" ? "TE" : "TA"} ${italyBox.endsWith("Committed") ? bi(actualLocale, "committed", "承诺框") : bi(actualLocale, "aligned", "倾向框")}`;
  const italyShowing = G.persistent.italyUnified === true && gw !== undefined;
  const italyHow = italyBox === "neutral"
    ? bi(actualLocale, "stays out of the war (25.3)", "不参战（25.3）")
    : italyBox.endsWith("Committed")
      ? bi(actualLocale, "joins automatically at the outbreak (25.3)", "大战爆发时自动参战（25.3）")
      : bi(actualLocale, "roll 4–6 at the outbreak, else back to neutral (25.3)", "爆发时掷 4–6 参战，否则退回中立（25.3）");
  const canGwDraft = selected !== null && viewer !== null && me !== null && phase === "gwManeuver" && isActive && pending === null && !eliminated && (me.gwBudget ?? 0) >= 1 && me.manpower >= 1;
  const gwDeployRoom = selected !== null && selectedState !== null && selectedState !== undefined
    ? Math.max(0, landStackingLimit(selected) - landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length)
    : 0;
  const canGwDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState && phase === "gwManeuver" &&
    isActive && pending === null && !eliminated && (me.gwBudget ?? 0) >= 1 && me.reserves.length > 0 &&
    gwDeployRoom > 0 && !isNavalBox(selected) && friendlySpace(G, selected, viewer) &&
    (isHomeSpace(G, selected, viewer) || ownsKey(G, selected, viewer)) && !selectedState.trench,
  );
  const gwSideAllies: Power[] = viewer === null || !gw
    ? []
    : (gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [])
        .filter((power) => power !== viewer && G.powers[power]?.eliminated !== true);
  const gwTransferToValue: string = gwSideAllies.includes(gwTransferTo as Power)
    ? (gwTransferTo as Power)
    : gwSideAllies[0] ?? "";
  const gwTransferAmountValue = Number.isFinite(gwTransferAmount) ? Math.max(1, Math.floor(gwTransferAmount)) : 1;
  const canGwTransfer = Boolean(
    viewer !== null && me !== null && gw !== null && phase === "gwPlanning" && isActive && pending === null &&
    !eliminated && gwTransferToValue !== "" && gwTransferAmountValue <= (me.gwBudget ?? 0) &&
    me.flags.gwCpTransferDone !== true,
  );
  const gwJointNavalAllies: Power[] = (() => {
    if (viewer === null || !gw || phase !== "gwManeuver" || !selectedUnitDef || !selectedUnitDef.naval ||
      selectedUnitDef.owner !== viewer || !selectedUnitDef.space) return [];
    const side = gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [];
    return side.filter((ally) =>
      ally !== viewer &&
      G.powers[ally]?.eliminated !== true &&
      navalUnitsIn(G, selectedUnitDef.space!).some((unit) => unit.owner === ally),
    );
  })();
  const gwJointNavalUnitIds = (ally: Power): string[] =>
    selectedUnitDef?.space
      ? navalUnitsIn(G, selectedUnitDef.space).filter((unit) => unit.owner === ally).map((unit) => unit.id)
      : [];
  const gwCardId = me?.gwCard === undefined || me?.gwCard === null ? "" : String(me.gwCard);
  const gwCombatCardHeld = ["IE-GW-03", "IE-GW-04", "IE-GW-06"].includes(gwCardId);
  const gwCardAlreadyFaceup = gwCombatCardHeld && String(me?.flags.gwFaceupCombat ?? "").includes(gwCardId);
  const canGwReveal = Boolean(
    viewer !== null && !eliminated && pending === null && me !== null && gwCombatCardHeld && !gwCardAlreadyFaceup &&
    (phase === "gwPlanning" || phase === "gwManeuver"),
  );
  const deployFree = viewer !== null && phase === "wartime" && (
    rapidMobilizationFreeDeploy(G, viewer, war) || superiorStaffWorkFreeDeploy(G, viewer, war)
  );
  const deployLimit = viewer !== null ? deployReserveLimit(G, viewer, war) : 0;
  const deployRoom = selected !== null
    ? Math.max(0, (SPACES[selected]?.home === "OT" ? 2 : SPACES[selected]?.region === "europe" ? 3 : 2) - (selectedState ? landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length : 0))
    : 0;
  const canDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState &&
    phase === "wartime" && isActive && pending === null && !eliminated &&
    me.reserves.length > 0 && deployRoom > 0 && deployLimit > 0 &&
    (deployFree || cpBudget() >= 1) &&
    SPACES[selected]?.submap === "main" &&
    (selectedState.control === viewer || selectedState.occupiedBy === viewer) &&
    hasLoc(G, viewer, selected, {landOnly: true}),
  );

  const renderCard = (id: string) => {
    const card = cardById(id);
    const isMandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
    const saved = String(me?.flags.savedCards ?? "").split(",").filter(Boolean).includes(id);
    const cpAllowed = !isMandatory && card.type !== "response" && card.type !== "combat";
    const eventAllowed = (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041";
    const homeOk = card.kind !== "home" || me?.selectedHomeCard === card.id;
    const rescueOk = forcedCardIds.includes(id) && cpAllowed;
    const cpModeOk = canActionCard && cpAllowed && (G.cpRemaining === 0 || rescueOk) && homeOk;
    const eventGate = eventAllowed && viewer !== null ? eventPlayability(G, viewer, id) : null;
    const eventBlockReason = eventGate !== null && !eventGate.ok ? t.playBlock[eventGate.reason!] : undefined;
    const eventModeOk = canActionCard && eventAllowed && G.cpRemaining === 0 && (eventGate === null || eventGate.ok);
    const responseEligible = card.type === "response" ? responseCardEligibility(G, viewer, id) : null;
    const responseOk = responseEligible?.ok === true;
    const responseReason = responseEligible && !responseEligible.ok
      ? responseReasonText(actualLocale, responseEligible.reason)
      : undefined;
    const showResponse = card.type === "response" && viewer !== null && (
      phase === "action" ? isActive
        : phase === "wartime" ? isBelligerent && (isActive || war?.status === "alliance")
          : phase === "gwManeuver" ? isActive
            : false
    );
    const industOk = canActionCard && me !== null && me.industryCard === null && card.kind !== "home" && !isMandatory;
    const chainOk = canActionCard && me !== null && me.cpChain.length < 2;
    const saveOk = viewer !== null && (phase === "action" || phase === "end") && card.kind !== "home" && !isMandatory;
    return (
      <article key={id} className="ie-card" data-testid={`ie-card-${id}`}>
        <div className="ie-card-cp">{card.cp}</div>
        <div className="ie-card-type">{t.cardType[card.type] ?? card.type}</div>
        {cardArt(card.image) ? <img src={cardArt(card.image)} alt={card.title}/> : <div style={{padding: "18px 8px", background: "#3a2f24", color: "#f0dfba", minHeight: 180}}><strong>{card.title}</strong><div style={{fontSize: 10, marginTop: 6}}>{card.text}</div></div>}
        <div className="ie-card-body">
          <div className="ie-card-title">{actualLocale === "zh_CN" ? card.titleZh : card.title}</div>
          <div>{card.text}</div>
          <div className="ie-card-zh">{card.textZh}</div>
        </div>
        <div className="ie-card-actions">
          <button disabled={!cpModeOk} title={!cpModeOk ? bi(actualLocale, "Requires your impulse and no CP left in it.", "需在你的行动轮且当前无剩余 CP。") : undefined} onClick={() => doAction(() => moves.playCard(id, "cp"))}>{t.cpMode}</button>
          <button data-testid={`ie-play-event-${id}`} disabled={!eventModeOk} data-blocked={eventBlockReason ? eventGate?.reason : undefined} title={!eventModeOk ? (eventBlockReason ?? bi(actualLocale, "Events are played at the start of your impulse.", "事件需在你的行动轮开始时打出。")) : undefined} onClick={() => doAction(() => moves.playCard(id, "event"))}>{t.eventMode}</button>
          {showResponse && <button data-testid={`ie-response-${id}`} disabled={!responseOk} title={!responseOk ? responseReason : undefined} onClick={() => doAction(() => moves.playResponseCard(id))}>{t.playResponse}</button>}
          <button disabled={!industOk} onClick={() => doAction(() => moves.industrialize(id))}>{t.industrialize}</button>
          <button disabled={!chainOk} onClick={() => doAction(() => moves.cpChain(id))}>{t.cpChain}</button>
          <button disabled={!saveOk} aria-pressed={saved} onClick={() => doAction(() => moves.saveCard(id))}>{saved ? t.unsave : t.saveCard}</button>
        </div>
      </article>
    );
  };

  const homeCardTitle = (id: string): string => {
    const card = CARD_BY_ID[id];
    return card ? (actualLocale === "zh_CN" ? card.titleZh : card.title) : id;
  };
  const saveList = String(me?.flags.savedCards ?? "").split(",").filter(Boolean);
  const ngChoices = String(me?.flags.ngChoices ?? "").split(",").filter(Boolean);
  const giveCards = hand.filter((id) => cardById(id).kind !== "home");
  const giveCardValue = giveCards.includes(giveCardId) ? giveCardId : giveCards[0] ?? "";

  const responseInHand = hand.some((id) => cardById(id).type === "response");
  const responseWindow = viewer !== null && responseInHand &&
    hand.some((id) => cardById(id).type === "response" && responseCardEligibility(G, viewer, id).ok);

  const chainInfo = viewer !== null && me !== null ? cpChainResolution(G, viewer) : null;
  const chainUsed = G.flags.cpChainSpent === true;
  const chainNonEmpty = me !== null && me.cpChain.length > 0;
  const chainReady = viewer !== null && me !== null && !eliminated && isActive && phase === "action" &&
    pending === null && G.cpRemaining === 0 && chainNonEmpty && !chainUsed && (chainInfo?.cpSpendable ?? 0) > 0;
  const chainSpendable = chainInfo?.cpSpendable ?? 0;
  const chainCap = chainInfo?.singleActionCap ?? 4;
  const chainDisabledReason = chainReady ? undefined
    : !chainNonEmpty ? bi(actualLocale, "No cards in the CP chain.", "CP 链中没有牌。")
      : chainUsed ? bi(actualLocale, "Already used this action phase.", "本行动阶段已使用。")
        : phase !== "action" ? bi(actualLocale, "Only usable during the action phase.", "仅在行动阶段可用。")
          : !isActive || eliminated ? bi(actualLocale, "Only the active power can use its CP chain.", "仅当前行动国家可使用 CP 链。")
            : pending !== null ? bi(actualLocale, "Resolve the pending decision first.", "请先处理待决事项。")
              : G.cpRemaining > 0 ? bi(actualLocale, "Finish this impulse first; the chain starts a fresh one.", "请先结束本次行动；CP 链需从新的行动开始。")
                : chainSpendable <= 0 ? bi(actualLocale, "The chained cards have no CP.", "CP 链中的牌没有 CP。")
                  : bi(actualLocale, "Not available now.", "当前不可用。");  const mapHint = pendingSpaceTargets.length > 0
    ? bi(actualLocale, "Click a highlighted space to answer the pending decision.", "点击高亮空间以完成待决事项。")
    : battleFrom !== null
      ? bi(actualLocale, "Click a highlighted adjacent space to attack it.", "点击高亮的相邻空间发动进攻。")
      : navalFrom !== null
        ? bi(actualLocale, "Click a highlighted adjacent sea space to fight there.", "点击高亮的相邻海域发动海战。")
        : selectedUnitDef
          ? bi(actualLocale, "Click a highlighted space to move the selected unit there.", "点击高亮空间移动所选单位。")
          : bi(actualLocale, "Click a space; select one of your units to see its legal moves.", "点击空间；选择己方单位以查看合法移动。");

  return (
    <IESurface className="ie-board">
      <header className="ie-header">
        <div>
          <h1 className="ie-title">{t.title}</h1>
          <div className="ie-sub">{t.subtitle} · {t.turn} {G.turn} · {bi(actualLocale, decade.en, decade.zh)}</div>
        </div>
        {hotseat && viewer !== null && botSeats.has(viewer) && (
          <div className="ie-bot-banner" role="status" aria-live="polite" style={{
            padding: "4px 10px", background: "#2a2010", border: "1px solid #c8a84b",
            borderRadius: 4, fontSize: 12, color: "#e6c987", alignSelf: "center",
          }}>
            🤖 {t.seats[viewer]} — {t.botSeatBadge} · {t.seatBotHint}
          </div>
        )}
        <div className="ie-status">
          <IEBadge tone={active.toLowerCase()}>{t.active}: {t.seats[active]}</IEBadge>
          <IEBadge>{PHASE_LABEL(t, phase)}</IEBadge>
          <IEBadge tone={G.wtt >= 4 ? "warn" : "default"}>{t.wtt}: {G.wtt}/5</IEBadge>
          <IEBadge>{t.cp}: {G.cpRemaining}</IEBadge>
          {G.gw?.active && <IEBadge tone="warn">GW {G.gw.turn}</IEBadge>}
          {battle && <IEBadge tone="warn">{bi(actualLocale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")}</IEBadge>}
          {pending && <IEBadge tone="warn">{t.pending}: {t.seats[pending.power]}</IEBadge>}
          {responseWindow && <IEBadge tone="warn">{t.responseWindow}</IEBadge>}
          {viewer && <IEBadge tone={viewer.toLowerCase()}>{t.seats[viewer]}</IEBadge>}
          {!viewer && <IEBadge>{t.spectators}</IEBadge>}
          <button className="ie-btn secondary ie-mini" onClick={() => setShowCharts((v) => !v)}>{t.charts}</button>
          <button className="ie-btn secondary ie-mini" onClick={() => setShowHelp((v) => !v)}>{t.rulesCoverage}</button>
        </div>
      </header>

      {canDecide ? (
        <div className="ie-turn-strip ie-turn-decide" role="status" aria-live="polite" data-testid="ie-turn-decide">
          {t.yourDecision} — {pendingKind ?? pending?.kind ?? ""}
        </div>
      ) : canAct ? (
        <div className="ie-turn-strip ie-turn-action" role="status" aria-live="polite" data-testid="ie-turn-action">
          {bi(actualLocale, `Your impulse · ${cpBudget()} CP remaining`, `你的行动轮 · 剩余 ${cpBudget()} CP`)}
        </div>
      ) : null}

      <div className="ie-layout">
        <div className="ie-play-column">
          <MapPanel
            G={G}
            selected={selected}
            onSelect={onSelect}
            board={board}
            setBoard={setBoard}
            pendingSpaceTargets={pendingSpaceTargets}
            unitMoveTargets={unitMoveTargets}
            battleTargets={battleTargets}
            locale={actualLocale}
            t={t}
            mapHint={mapHint}
          />

          <HandPanel
            {...{G, viewer, me, t, phase, isActive, eliminated, pending, canPhaseAct,
              hasPhaseButtons, forcedPass, forcedPassTitle, hand, handCounts, renderCard,
              homeCardTitle, saveList, ngChoices, giveCards, giveCardId, setGiveCardId,
              giveTarget, setGiveTarget, giveCardValue, responseInHand, responseWindow,
              chainNonEmpty, chainSpendable, chainCap, chainReady, chainDisabledReason,
              cpBudget, doAction, moves}}
            locale={actualLocale}
          />
        </div>

        <div className="ie-right-col">
            <SpacePanel
              G={G}
              selected={selected}
              selectedUnit={selectedUnit}
              setSelectedUnit={setSelectedUnit}
              battleFrom={battleFrom}
              setBattleFrom={setBattleFrom}
              navalFrom={navalFrom}
              setNavalFrom={setNavalFrom}
              viewer={viewer}
              me={me}
              locale={actualLocale}
              t={t}
              phase={phase}
              canAct={canAct}
              canSpend={canSpend}
              cpRemaining={cpBudget()}
              canActionCard={canActionCard}
              pending={pending}
              canDecide={canDecide}
              war={war}
              warAim={warAim}
              setWarAim={setWarAim}
              warCp={warCp}
              setWarCp={setWarCp}
              secondObjective={secondObjective}
              setSecondObjective={setSecondObjective}
              targetControlledSpaces={targetControlledSpaces}
              warTargetControl={warTargetControl}
              canDeclareWar={canDeclareWar}
              gwJointNavalAllies={gwJointNavalAllies}
              gwJointNavalUnitIds={gwJointNavalUnitIds}
              polishReserve={polishReserve}
              setPolishReserve={setPolishReserve}
              deployLimit={deployLimit}
              deployFree={deployFree}
              canDeployHere={canDeployHere}
              canGwDraft={canGwDraft}
              canGwDeployHere={canGwDeployHere}
              polishArmyDecision={polishArmyDecision}
              polishReserveDecision={polishReserveDecision}
              myOnMapArmies={myOnMapArmies}
              myForts={myForts}
              myMinorAllies={myMinorAllies}
              ownLandInSelected={ownLandInSelected}
              ownNavalInSelected={ownNavalInSelected}
              potentialLandTargets={potentialLandTargets}
              potentialNavalTargets={potentialNavalTargets}
              selectedUnitDef={selectedUnitDef}
              doAction={doAction}
              moves={moves}
            />

            {(pending || battle || G.result) && <PendingPanel
              G={G}
              pending={pending}
              canDecide={canDecide}
              pendingKind={pendingKind}
              pendingPrompt={pendingPrompt}
              optionLabel={optionLabel}
              canDecline={canDecline}
              pendingSpaceTargets={pendingSpaceTargets}
              viewer={viewer}
              locale={actualLocale}
              t={t}
              jihadDecision={jihadDecision}
              jihadReason={jihadReason}
              doAction={doAction}
              moves={moves}
            />}

          <details className="ie-reference">
            <summary>{bi(actualLocale, "Powers & objectives", "列强与目标")}</summary>
          <DashboardPanel
            G={G}
            active={active}
            viewer={viewer}
            locale={actualLocale}
            t={t}
            handCounts={handCounts}
            goalCounts={goalCounts}
            homeCardTitle={homeCardTitle}
            minorMarkerRows={minorMarkerRows as [string, number][]}
          />

          <MpitPanel
            G={G}
            canAct={canAct}
            viewer={viewer}
            me={me}
            cpBudget={cpBudget}
            canSpend={canSpend}
            mpitTarget={mpitTarget}
            setMpitTarget={setMpitTarget}
            mpitTrack={mpitTrack}
            setMpitTrack={setMpitTrack}
            locale={actualLocale}
            t={t}
            doAction={doAction}
            moves={moves}
          />

          <NationalActionsPanel
            show={showNationalActions && viewer !== null}
            viewer={viewer as Power}
            locale={actualLocale}
            t={t}
            cpBudget={cpBudget}
            zouaveInPlay={zouaveInPlay}
            zouaveReason={zouaveReason}
            auReformValue={auReformValue}
            setAuReformTarget={setAuReformTarget}
            auReformDecision={auReformDecision}
            auReformReason={auReformReason}
            auCitizenValue={auCitizenValue}
            setAuCitizenTarget={setAuCitizenTarget}
            auCitizenDecision={auCitizenDecision}
            auCitizenReason={auCitizenReason}
            auSacrifice={auSacrifice}
            setAuSacrifice={setAuSacrifice}
            auIncorporateCandidates={auIncorporateCandidates}
            auIncorporateValue={auIncorporateValue}
            setAuIncorporateTarget={setAuIncorporateTarget}
            auIncorporate={auIncorporate}
            auIncorporateReason={auIncorporateReason}
            tsrrArmies={tsrrArmies}
            tsrrUnitValue={tsrrUnitValue}
            setTsrrUnitId={setTsrrUnitId}
            tsrrDestinations={tsrrDestinations}
            tsrrToValue={tsrrToValue}
            setTsrrTo={setTsrrTo}
            tsrrDecision={tsrrDecision}
            tsrrReason={tsrrReason}
            doAction={doAction}
            moves={moves}
          />
          </details>

          <AmphibiousPanel
            show={amphibiousVisible && viewer !== null}
            G={G}
            viewer={viewer as Power}
            locale={actualLocale}
            t={t}
            amphibiousOrigins={amphibiousOrigins}
            amphibiousFromValue={amphibiousFromValue}
            setAmphibiousFrom={setAmphibiousFrom}
            amphibiousTargets={amphibiousTargets}
            amphibiousToValue={amphibiousToValue}
            setAmphibiousTo={setAmphibiousTo}
            amphibiousArmies={amphibiousArmies}
            amphibiousArmyValue={amphibiousArmyValue}
            toggleAmphibiousArmy={toggleAmphibiousArmy}
            amphibiousCanGo={amphibiousCanGo}
            amphibiousReason={amphibiousReason}
            amphibiousCheck={amphibiousCheck}
            doAction={doAction}
            moves={moves}
          />

          <NavalTransportPanel
            show={transportVisible && viewer !== null}
            G={G}
            viewer={viewer as Power}
            locale={actualLocale}
            t={t}
            transportOrigins={transportOrigins}
            transportFromValue={transportFromValue}
            setTransportFrom={setTransportFrom}
            transportLands={transportLands}
            transportLandValue={transportLandValue}
            setTransportLand={setTransportLand}
            transportTargets={transportTargets}
            transportToValue={transportToValue}
            setTransportTo={setTransportTo}
            transportFleet={transportFleet}
            transportCanGo={transportCanGo}
            transportReason={transportReason}
            doAction={doAction}
            moves={moves}
          />

          <NavalInterceptPanel
            show={interceptVisible}
            lastNavalBox={lastNavalBox as SpaceId}
            lastNavalMover={lastNavalMover}
            viewer={viewer}
            locale={actualLocale}
            t={t}
            interceptPorts={interceptPorts}
            interceptPortValue={interceptPortValue}
            setInterceptPort={setInterceptPort}
            interceptCheck={interceptCheck}
            interceptReason={interceptReason}
            doAction={doAction}
            moves={moves}
          />

          {war && (
            <WarPanel
              war={war}
              G={G}
              viewer={viewer}
              active={active}
              phase={phase}
              locale={actualLocale}
              t={t}
              warStatusLabel={warStatusLabel}
              warAimLabel={warAimLabel}
              warBelligerents={warBelligerents}
              isPrincipal={isPrincipal}
              isBelligerent={isBelligerent}
              eliminated={eliminated}
              pending={pending}
              isActive={isActive}
              warBudgetRows={warBudgetRows}
              warDefenderMinors={warDefenderMinors}
              callableAllies={callableAllies}
              warAllyValue={warAllyValue}
              setWarAlly={setWarAlly}
              callableMinors={callableMinors}
              warMinorValue={warMinorValue}
              setWarMinor={setWarMinor}
              confirmSurrender={confirmSurrender}
              setConfirmSurrender={setConfirmSurrender}
              doAction={doAction}
              moves={moves}
            />
          )}

          {gw && (
            <GreatWarPanel
              gw={gw}
              G={G}
              viewer={viewer}
              me={me}
              active={active}
              phase={phase}
              locale={actualLocale}
              t={t}
              eliminated={eliminated}
              pending={pending}
              isActive={isActive}
              selected={selected}
              gwBudgetOrder={gwBudgetOrder}
              gwSlotLabel={gwSlotLabel}
              italyShowing={italyShowing}
              italyBox={italyBox}
              italyBoxLabel={italyBoxLabel}
              italyHow={italyHow}
              gwTransferToValue={gwTransferToValue}
              setGwTransferTo={setGwTransferTo}
              gwTransferAmountValue={gwTransferAmountValue}
              setGwTransferAmount={setGwTransferAmount}
              canGwTransfer={canGwTransfer}
              gwSideAllies={gwSideAllies}
              canGwReveal={canGwReveal}
              canGwDraft={canGwDraft}
              canGwDeployHere={canGwDeployHere}
              forcedGwCard={forcedGwCard}
              doAction={doAction}
              moves={moves}
            />
          )}

          <IEPanel title={t.log} actions={
            <button className="ie-log-toggle" onClick={() => setShowLog((v) => !v)} aria-expanded={showLog} aria-label={showLog ? bi(actualLocale, "Collapse log", "折叠日志") : bi(actualLocale, "Expand log", "展开日志")}>
              {showLog ? "▲" : "▼"}
            </button>
          }>
            <div className={`ie-log${showLog ? "" : " ie-log-collapsed"}`} data-testid="ie-log">
              {showLog && G.log.slice(-80).reverse().map((entry) => <LogLine key={entry.id} entry={entry} locale={actualLocale}/>)}
            </div>
          </IEPanel>
        </div>
      </div>

      {showCharts && (
        <IEPanel title={t.charts} actions={<Button size="small" onClick={() => setShowCharts(false)}>{t.close}</Button>}>
          <div className="ie-chart-grid">
            {[
              ["map-flashpoints", "Flashpoints"],
              ["combat-crt", "Combat & CRT"],
              ["colonial-great-wars", "Colonial & Great Wars"],
              ["war-aims-minors", "War Aims & Minors"],
              ["crisis", "Crisis Table"],
              ["influence-track", "Major Power Influence"],
              ["italy-legend", "Italy & Legend"],
              ["sequence-of-play", "Sequence of Play"],
              ["counter-count", "Counter Count"],
            ].map(([id, caption]) => (
              <figure key={id}><img src={`/imperial-elegy/charts/${id}.png`} alt={caption}/><figcaption>{caption}</figcaption></figure>
            ))}
          </div>
        </IEPanel>
      )}

      {showHelp && (
        <IEPanel title={t.rulesCoverage} actions={<Button size="small" onClick={() => setShowHelp(false)}>{t.close}</Button>}>
          <div style={{fontSize: 12, lineHeight: 1.5}}>
            <p>{actualLocale === "zh_CN" ? "本实现覆盖 1850–1920 六年玩家战役：准备、外交、行动、结束阶段，有限战争（战争目标、联盟、先手、机动、胜利、复员），大战（爆发、计划、机动、冬季、消灭与胜利），以及卡牌事件、响应窗口、国家特性、外交与联盟、征募、工业、殖民、移动、补给、陆战/海战、条约、危机、国家目标与全部战役胜利条件。" : "This implementation covers the 1850–1920 six-player campaign: Prep, Diplomacy, Action and End phases; limited wars (war aims, alliance, initiative, maneuver, victory, demobilization); the Great War (outbreak, planning, maneuver, winter, elimination and victory); card events, response windows, national characteristics, diplomacy and alliances, recruitment, industry, colonial actions, movement, supply, land/naval combat, treaties, crises, national goals and every campaign victory condition."}</p>
            <p>{actualLocale === "zh_CN" ? "资产来自 VASSAL 模块 1.1.0-beta.4；卡牌文字以卡面为准，OCR 仅作辅助。威廉二世 #82 与法国目标 #22 为文本重建，详见 docs/imperial-elegy/CORRECTIONS.md。" : "Assets come from VASSAL module 1.1.0-beta.4; card text follows the printed faces and OCR was advisory only. Wilhelm II #82 and French goal #22 are text reconstructions; see docs/imperial-elegy/CORRECTIONS.md."}</p>
          </div>
        </IEPanel>
      )}
    </IESurface>
  );
};
