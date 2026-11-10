import React from "react";
import {BoardProps} from "boardgame.io/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Drawer from "@mui/material/Drawer";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import useMediaQuery from "@mui/material/useMediaQuery";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import {ActionGroup, VQSurface} from "./theme";
import {abjurationOffers, abjurationSelection, acceptAbjurationOffer} from "../abjuration";
import {ConfirmDialog} from "./board/ConfirmDialog";
import {StepBanner} from "./board/StepBanner";
import {LogPanel} from "./board/LogPanel";
import {DiceToast} from "./board/DiceToast";
import {MobileSpaceSheet} from "./board/MobileSpaceSheet";
import {PendingBeaconPanel} from "./board/PendingPanels/BeaconPanel";
import {PendingEspionagePanel} from "./board/PendingPanels/EspionagePanel";
import {PendingAbjurationPanel} from "./board/PendingPanels/AbjurationPanel";
import {PendingCityRebelsPanel} from "./board/PendingPanels/CityRebelsPanel";
import {PendingGregorianPanel} from "./board/PendingPanels/GregorianPanel";
import {PendingCardEventPanel} from "./board/PendingPanels/CardEventPanel";
import {PendingActionResponsePanel} from "./board/PendingPanels/ActionResponsePanel";
import {PendingPiracyPanel} from "./board/PendingPanels/PiracyPanel";
import {PendingTutorialEventPanel} from "./board/PendingPanels/TutorialEventPanel";
import {PendingBattlePanel} from "./board/PendingPanels/BattlePanel";
import {PendingActivationPanel} from "./board/PendingPanels/ActivationPanel";
import {PendingInterceptPanel} from "./board/PendingPanels/InterceptPanel";
import {PendingInterceptionOrderPanel} from "./board/PendingPanels/InterceptionOrderPanel";
import {EventBranchPanel} from "./board/EventBranchPanel";
import {branchParamValues, effectiveBranchIds, eventBranchChoice, eventBranchTarget} from "../eventBranches";
import {eventTargetOptions, eventTargetValue} from "../eventTargets";
export {eventTargetOptions, eventTargetValue} from "../eventTargets";
export type {EventTargetOption} from "../eventTargets";
import {useNotificationPermission, useTurnNotification} from "./board/useNotifications";
import ExportLogButton from "../../components/export-log-button";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import i18n from "../../constant/i18n";
import {AREA_NAMES,
    areaName,
    CardDef,
    CONTROLLER_COLORS,
    controllerName,
    powerName,
    powerShortName,
    minorName,
    HRE_RELIGIOUS_PREFERENCE_NAMES,
    hreReligiousPreferenceName,
    HreReligiousPreference,
    landCount,
    MINOR_POWERS,
    LandStack,
    navalCount,
    NavalStack,
    POWER_INFO,
    POWERS,
    Power,
    RoyalDef,
    rulerName,
    ReligionArea,
    VQGame,
    isPower,
    powerAt, spaceHomes} from "../constant/general";
import {cardById, cardImageUrl, cardName} from "../constant/cards";
import {LEADER_BY_ID, SEA_CAPTAIN_LEADER_BY_CAPTAIN, leaderName} from "../constant/leaders";
import {patronDef, royalAvailable, scenarioSetup, scienceBonusById, seaCaptainById, seaCaptainName} from "../scenario";
import {DUTCH_KEYS, SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES, seaZoneName, spaceName} from "../mapData";
import {WORLD_SEA_ZONES, WORLD_SETTLEMENTS} from "../data/world";
import {PATRONAGE_VP_AWARD_BY_ID} from "../data/patronage";
import {MINOR_DIPLOMACY} from "../data/minorDiplomacy";
import {PatronageVpAward} from "../data/types";
import {
    atWar,
    baseVp,
    capitalSpacesFor,
    catholicLeagueSpaceOptions,
    controlledKeys,
    homeCardChoiceRequired,
    hreReligiousPreferenceRequired,
    hreReligiousVp,
    keepsBothHomeCards,
    powerVp,
    protestantSpaceCount,
    religionCandidates,
    rebellionTargets,
    rulerStats,
    religiousSpecialVp,
    victoryStandings,
    warCost,
    zonePorts,
    minorAvailable,
    formationCapacity,
    friendlyController,
    landNeighbors,
    seaPathBetweenPorts,
    legalTargets,
} from "../util";
import {VQMap} from "./map";
import {TutorialGuide} from "./tutorial-guide";
import {controlledPowers, ownerOf, isActivatedMajor, participatingPowers, playerCount} from "../ownership";
import {tutorialFortressVp, tutorialSpaceAllowed} from "../tutorial";
import {scenarioName} from "../scenario";
import {Controller} from "../constant/general";
import {canPlayBattleCard} from "../combat";
import {canPlayTutorialEvent} from "../tutorialEvents";
import {canPlayGrandVizier, canPlayUntimelyDeath, isGrandVizier, untimelyDeathTargets} from "../cardEvents";
import {actionResponseOptions, passBlockReasons, type PassBlock} from "../moves";
import {diplomacyActionState, diplomacyBlockText, giftState} from "../diplomacyPolicy";
import {interceptionOptions} from "../interception";
import {interceptionOrderOptions} from "../navalCombat";
import {assassinationTargets, canPlayEspionageEvent, canPlayNorthernRising, doubleAgentTargets, isEspionageEvent} from "../espionage";

export type Mode =
    | "inspect"
    | "recruitRegular"
    | "recruitMerc"
    | "recruitCav"
    | "buildGalley"
    | "buildGalleon"
    | "buildRacebuilt"
    | "buildCorsair"
    | "moveLand"
    | "moveNaval"
    | "navalTransport"
    | "spring"
    | "control"
    | "assault"
    | "buildFortress"
    | "rebellion";

export const ACTION_BUTTON_GROUPS: Record<string, Mode[]> = {
    recruit: ["recruitRegular", "recruitMerc", "recruitCav"],
    build: ["buildGalley", "buildGalleon", "buildRacebuilt", "buildCorsair"],
    move: ["moveLand", "moveNaval", "navalTransport"],
    military: ["control", "assault", "buildFortress", "rebellion"],
};

/** Clamp the stored diplomacy target to a legal enemy for the viewing power. */
export const legalDiplomacyTarget = (me: Power | undefined, target: Power): Power => {
    const options = POWERS.filter((p) => p !== me);
    return options.includes(target) ? target : options[0] ?? target;
};

export const MODE_COST: Record<Mode, number> = {
    inspect: 0, recruitRegular: 2, recruitMerc: 1, recruitCav: 1,
    buildGalley: 2, buildGalleon: 2, buildRacebuilt: 2, buildCorsair: 1,
    moveLand: 1, moveNaval: 1, navalTransport: 1, spring: 0,
    control: 1, assault: 1, buildFortress: 2, rebellion: 2,
};

export const modeLabel = (mode: Mode): string =>
    (i18n.chain.vq.action as Record<string, string>)[mode] ?? mode;

export const unitLabel = (kind: "regular" | "merc" | "cav"): string =>
    (i18n.chain.vq.action as Record<string, string>)[kind] ?? kind;

/** Phase label resolved at render time so it follows the active locale. */
const phaseLabel = (phase: string): string =>
    (i18n.chain.vq.header.phase as unknown as Record<string, string>)[phase] ?? phase;

/** Picks the active locale's name from data that carries English and Chinese labels. */
const dataName = (def: {nameEn: string; nameZh?: string} | undefined): string =>
    def === undefined ? "" : (i18n.getLocaleName() === "en" ? def.nameEn : (def.nameZh ?? def.nameEn));

const vqLocaleNow = (): "en" | "zh_CN" => i18n.getLocaleName() === "en" ? "en" : "zh_CN";

/** Localized label for a land space or sea zone id. */
const placeLabel = (id: string): string =>
    SPACE_BY_ID[id] !== undefined ? spaceName(id, vqLocaleNow()) : seaZoneName(id, vqLocaleNow());

/** Localized leader name for a counter id. */
const leaderLabel = (id: string): string => leaderName(id, vqLocaleNow());

/** Localized royal name for a runtime royal. */
const royalLabel = (royal: {name: string; nameZh?: string}): string =>
    vqLocaleNow() === "en" ? royal.name : (royal.nameZh ?? royal.name);

/** Localized patron name (`RuntimePatron` stores the English name in `name`). */
const patronLabel = (patron: {name: string; nameZh?: string}): string =>
    vqLocaleNow() === "en" ? patron.name : (patron.nameZh ?? patron.name);

/**
 * Cards whose event target cannot be enumerated in the UI. The strings are the
 * grammar `playCard` expects for those effects (see `resolvePlayedCardEvent`).
 */
export const EVENT_TARGET_EXAMPLES: Record<string, string> = {
    "vq-030": "spain:return:alba or france:skip",
    "vq-053": "peace:france, give:france:vq-020 or move:paris",
    "vq-059": "cut:spain (remove Spain's spy from your own card), upgrade or leave blank for 5 CP",
    "vq-098": "france:vq-022:vq-021",
    "vq-105": "oporto",
    "vq-107": "york",
    "vq-110": "norwich",
};

export interface EventPlayTargets {
    /** Target chosen through a dedicated selector, if the card has one. */
    selected?: string;
    /** Free-text target typed for this card. */
    typed: string;
}

/** A dedicated selector wins over the free-text field; blank input means "no target". */
export const eventPlayTarget = ({selected, typed}: EventPlayTargets): string | undefined => {
    if (selected !== undefined) return selected;
    const trimmed = typed.trim();
    return trimmed === "" ? undefined : trimmed;
};

/** Calls playCard for an event, omitting `target` when the player entered none. */
export const playEventCard = (
    playCard: (args: {cardId: string; asEvent: true; target?: string}) => void,
    cardId: string,
    targets: EventPlayTargets,
): void => {
    const target = eventPlayTarget(targets);
    playCard({cardId, asEvent: true, ...(target !== undefined ? {target} : {})});
};

/**
 * Which targeting control the event-card drawer renders.  Cards with a
 * dedicated selector never use the generic target list, so #17, #23, #24, #61,
 * #86 and #102 can only be played through their enumerated choices.  The
 * `freeText` fallback now renders the enumerated options from `eventTargets.ts`.
 */
export type EventTargetMode = "espionage" | "foreignWar" | "holyLeague" | "menendez" | "polishElection" | "armyMutiny" | "stafford" | "germanRecruitment" | "freeText";

export const eventTargetMode = (handler: string, espionageTargetCount: number): EventTargetMode => {
    if (espionageTargetCount > 0) return "espionage";
    if (handler === "warInPersia" || handler === "warWithPoland") return "foreignWar";
    if (handler === "holyLeague") return "holyLeague";
    if (handler === "menendezDeAviles") return "menendez";
    if (handler === "polishRoyalElection") return "polishElection";
    if (handler === "armyMutiny") return "armyMutiny";
    if (handler === "sirEdwardStafford") return "stafford";
    if (handler === "germanRecruitmentCurtailed" || handler === "germanRecruitment") return "germanRecruitment";
    return "freeText";
};

/** Every responder in the open action window, in the engine's offer order. */
export const actionWindowResponders = (G: VQGame): Power[] => G.pendingAction === undefined ? [] :
    (G.pendingAction.responders ?? [G.pendingAction.responder ?? (G.pendingAction.power === "ottoman" ? "spain" : "ottoman")]);

export interface ActionResponderChoice {
    responder: Power;
    /** Power name shown in the responder selector. */
    label: string;
    /** Options `respondAction` validates for this responder. */
    options: {id: string; label: string}[];
}

/**
 * Action-window responders controlled by this seat, each with its own
 * validated response options.  A seat may own more than one eligible
 * responder (for example England+Protestant both holding #16), so the board
 * must offer every one instead of silently showing only the first.
 */
export const actionResponderChoices = (G: VQGame, playerID: string | null): ActionResponderChoice[] =>
    actionWindowResponders(G)
        .filter((responder) => ownerOf(G, responder) === playerID)
        .map((responder) => ({responder, label: powerName(responder, "zh_CN"),
            options: actionResponseOptions(G, responder)}));

/** Legacy free-text field retained for older imports; the board now uses `EventTargetSelect`. */
export const EventTargetField = ({cardId, value, onChange}: {
    cardId: string;
    value: string;
    onChange: (value: string) => void;
}) => {
    const localized = i18n.chain.vq.eventTargets;
    const localizedByCard: Record<string, string> = {"vq-030": localized.vq030, "vq-053": localized.vq053, "vq-059": localized.vq059};
    const example = localizedByCard[cardId] ?? EVENT_TARGET_EXAMPLES[cardId];
    return <TextField size="small" fullWidth label={i18n.chain.vq.board.eventTarget} value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={i18n.chain.vq.board.placeholder}
        helperText={example !== undefined ? `${i18n.chain.vq.board.example}${i18n.chain.vq.eventTargets.exampleSeparator}${example}` : i18n.chain.vq.board.noTarget}/>;
};

/** Dropdown replacement for the old free-text event target field. */
export const EventTargetSelect = ({cardId, options, value, onChange}: {
    cardId: string;
    options: {value: string; label: string}[];
    value: string;
    onChange: (value: string) => void;
}) => {
    const labelId = `vq-event-target-${cardId}`;
    return <FormControl size="small" fullWidth sx={{mt: 0.5}}>
        <InputLabel id={labelId}>{i18n.chain.vq.board.eventTargetChoice}</InputLabel>
        <Select labelId={labelId} label={i18n.chain.vq.board.eventTargetChoice} displayEmpty value={value}
                renderValue={(selected: string) => options.find((option) => option.value === selected)?.label ?? ""}
                onChange={(event) => onChange(event.target.value)}>
            {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
    </FormControl>;
};

export interface MenendezTargetOption {
    /** Target grammar for `playCard`; "" omits the target and resolves the Florida branch. */
    value: string;
    label: string;
}

/**
 * #61 has three branches.  Florida is the no-target branch, the escort is the
 * literal `escort` argument, and each Spanish-controlled settlement without a
 * fortress can be fortified with `fortress:<id>`.
 */
export const menendezTargetOptions = (G: VQGame): MenendezTargetOption[] => [
    {value: "", label: i18n.chain.vq.board.florida},
    {value: "escort", label: i18n.chain.vq.board.escort},
    ...WORLD_SETTLEMENTS
        .filter((settlement) => G.worldControls[settlement.id] === "spain" &&
            G.worldFortresses?.[settlement.id] === undefined)
        .map((settlement) => ({value: `fortress:${settlement.id}`, label: `${i18n.chain.vq.board.fortress}${i18n.chain.vq.punct.colon}${dataName(settlement)}`})),
];

/** Drops a stale #61 selection; Florida (blank) yields `undefined` so no target is sent. */
export const menendezTargetValue = (G: VQGame, selected: string): string | undefined => {
    const value = menendezTargetOptions(G).some((option) => option.value === selected) ? selected : "";
    return value === "" ? undefined : value;
};

/** Dedicated #61 selector, replacing the free-text field for that card. */
export const MenendezTargetSelect = ({options, value, onChange}: {
    options: MenendezTargetOption[];
    value: string;
    onChange: (value: string) => void;
}) => <FormControl size="small" fullWidth sx={{mt: 0.5}}>
    <InputLabel id="vq-menendez-target">{i18n.chain.vq.board.menendezTarget}</InputLabel>
    <Select labelId="vq-menendez-target" label={i18n.chain.vq.board.menendezTarget} value={value}
            onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select>
</FormControl>;

// Act of Abjuration helpers live in their own module so the pending panel can
// share them without a circular import.
export {abjurationOfferDetails, abjurationOffers, abjurationSelection, abjurationOfferMove, acceptAbjurationOffer} from "../abjuration";
export type {AbjurationOffer} from "../abjuration";

type HolyLeagueTrack = "papacy" | "venice" | "hre";

const HOLY_LEAGUE_TRACK_NAMES: Record<HolyLeagueTrack, string> = {
    papacy: minorName("papacy", "zh_CN"),
    venice: minorName("venice", "zh_CN"),
    hre: powerName("hre", "zh_CN"),
};

/** The card's default split, also what `playCard` does when no target is given. */
export const HOLY_LEAGUE_DEFAULT_TARGET = "papacy:venice";

/**
 * #24 can influence the HRE track only while the HRE is a non-player major
 * power.  An activated HRE is still non-player: it is run by an ally and only
 * appears in `activatedMajors`, never directly in `playerPowers`.
 */
export const holyLeagueHreAvailable = (G: VQGame): boolean =>
    G.majorInfluence?.hre !== undefined &&
    (G.playerPowers !== undefined
        ? !Object.values(G.playerPowers).some((powers) => powers.includes("hre"))
        : ownerOf(G, "hre") === undefined);

export interface HolyLeagueTargetOption {
    /** Value forwarded to `playCard`, e.g. "papacy:venice:hre". */
    value: string;
    label: string;
}

/**
 * Target choices for #24: each single track (4 influence), each pair (2/2),
 * and, when the HRE track exists, the three 2/1/1 orderings.  `playCard`
 * splits four influence by target order, so the order is part of the value.
 */
export const holyLeagueTargetOptions = (G: VQGame): HolyLeagueTargetOption[] => {
    const hre = holyLeagueHreAvailable(G);
    const values: string[] = hre
        ? ["papacy", "venice", "hre", "papacy:venice", "papacy:hre", "venice:hre",
            "papacy:venice:hre", "venice:papacy:hre", "hre:papacy:venice"]
        : ["papacy", "venice", "papacy:venice"];
    return values.map((value) => {
        const tracks = value.split(":") as HolyLeagueTrack[];
        const shares = tracks.length === 1 ? [4] : tracks.length === 2 ? [2, 2] : [2, 1, 1];
        return {
            value,
            label: tracks.map((track, index) => `${HOLY_LEAGUE_TRACK_NAMES[track]} +${shares[index]}`).join(i18n.chain.vq.punct.comma),
        };
    });
};

/** Falls back to the previous no-target behaviour (Papacy + Venice, 2/2). */
export const holyLeagueTargetValue = (G: VQGame, selected: string): string => {
    const options = holyLeagueTargetOptions(G);
    if (options.some((option) => option.value === selected)) return selected;
    return options.some((option) => option.value === HOLY_LEAGUE_DEFAULT_TARGET)
        ? HOLY_LEAGUE_DEFAULT_TARGET
        : options[0].value;
};

/** Dedicated #24 selector, replacing the free-text field for that card. */
export const HolyLeagueTargetSelect = ({options, value, onChange}: {
    options: HolyLeagueTargetOption[];
    value: string;
    onChange: (value: string) => void;
}) => <FormControl size="small" fullWidth sx={{mt: 0.5}}>
    <InputLabel id="vq-holy-league-target">{i18n.chain.vq.board.holyLeagueTarget}</InputLabel>
    <Select labelId="vq-holy-league-target" label={i18n.chain.vq.board.holyLeagueTarget} value={value}
            onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select>
</FormControl>;

type PolishElectionPower = "france" | "hre" | "spain";

/** #86 bids are resolved in this fixed order, which also breaks ties. */
export const POLISH_ELECTION_POWERS: PolishElectionPower[] = ["france", "hre", "spain"];

export interface PolishElectionBidOption {
    /** Segment value for one power: "" (auto), a card id, or "treasure:N". */
    value: string;
    label: string;
}

/** Chosen segment per bidding power; a missing or empty entry means auto. */
export type PolishElectionBidChoices = Partial<Record<PolishElectionPower, string>>;

/** What `resolvePolishElection` does without a segment: highest-CP card, else highest treasure. */
export const POLISH_ELECTION_AUTO_LABEL = i18n.chain.vq.board.polishAuto;

/**
 * Bid choices for one power in #86, in the same order the engine considers
 * them: non-mandatory hand cards by descending CP, then treasures.  Mandatory
 * cards are never legal bids, so they are not offered.
 */
export const polishElectionBidOptions = (G: VQGame, power: PolishElectionPower, locale: "en" | "zh_CN" = "zh_CN"): PolishElectionBidOption[] => {
    const cards = [...G.powers[power].cards]
        .filter((id) => cardById(id).officialKind !== "mandatory")
        .sort((a, b) => cardById(b).cp - cardById(a).cp || a.localeCompare(b))
        .map((id) => {
            const def = cardById(id);
            return {value: id, label: `${cardName(id, locale)}${i18n.chain.vq.eventTargets.parenOpen}${i18n.chain.vq.board.hand} ${def.cp} CP${i18n.chain.vq.eventTargets.parenClose}`};
        });
    const treasures = [...G.powers[power].treasures].sort((a, b) => b - a)
        .map((value) => ({value: `treasure:${value}`, label: `${i18n.chain.vq.board.treasure} ${value}${i18n.chain.vq.eventTargets.parenOpen}${value} CP${i18n.chain.vq.eventTargets.parenClose}`}));
    return [{value: "", label: i18n.chain.vq.board.polishAuto}, ...cards, ...treasures];
};

/** Drops a stored bid that is no longer a legal choice for that power. */
export const polishElectionBidValue = (G: VQGame, power: PolishElectionPower, selected: string | undefined): string => {
    const value = selected ?? "";
    return polishElectionBidOptions(G, power).some((option) => option.value === value) ? value : "";
};

/**
 * Builds the `france:card|hre:card|spain:treasure:N` grammar `playCard`
 * expects.  Auto-bidding powers are omitted; no explicit bid at all yields
 * `undefined` so `playCard` keeps its no-target defaults.
 */
export const polishElectionTargetValue = (G: VQGame, choices: PolishElectionBidChoices): string | undefined => {
    const segments = POLISH_ELECTION_POWERS
        .map((power) => ({power, value: polishElectionBidValue(G, power, choices[power])}))
        .filter((entry) => entry.value !== "")
        .map((entry) => `${entry.power}:${entry.value}`);
    return segments.length > 0 ? segments.join("|") : undefined;
};

/** Dedicated #86 selector: one bid dropdown per participating power. */
export const PolishElectionTargetSelect = ({G, value, onChange}: {
    G: VQGame;
    value: PolishElectionBidChoices;
    onChange: (power: PolishElectionPower, value: string) => void;
}) => <Stack spacing={0.5} sx={{mt: 1}}>
    <Typography variant="caption" color="text.secondary">
        {i18n.chain.vq.eventTargets.polishBidHint}
    </Typography>
    {POLISH_ELECTION_POWERS.map((power) => {
        const labelId = `vq-polish-bid-${power}`;
        const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
        const label = `${powerName(power, vqLocale)} ${i18n.chain.vq.eventTargets.polishBid}`;
        return <FormControl key={power} size="small" fullWidth>
            <InputLabel id={labelId}>{label}</InputLabel>
            <Select labelId={labelId} label={label} displayEmpty
                    value={polishElectionBidValue(G, power, value[power])}
                    onChange={(event) => onChange(power, event.target.value)}>
                {polishElectionBidOptions(G, power, vqLocale).map((option) =>
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
        </FormControl>;
    })}
</Stack>;

export interface VirginQueenCombatRetrieveOption {
    /** Card in the discard pile that the immediate play would retrieve. */
    cardId: string;
    /** Argument for `playVirginQueenCombat`, e.g. `retrieve:vq-008:play`. */
    target: string;
    label: string;
}

export interface ArmyMutinyTargetOption {
    /** Space id, in map order. */
    value: string;
    label: string;
}

export interface ArmyMutinyOwnerOption {
    /** Major power owning the stack. */
    value: Power;
    label: string;
}

export interface ArmyMutinyTargetSelection {
    /** Selected space id; blank means "the first legal space". */
    space: string;
    /** Owner inside that space; undefined means "the first major power there". */
    owner?: Power;
}

/**
 * Target spaces for #17: every space holding at least one land stack of a
 * major power, in map order.  A stack on the Spanish Armada or on a foreign
 * war card is not in `G.spaces`, so it cannot appear here, which matches the
 * card's "not on the Armada or a foreign war" restriction.
 */
export const armyMutinySpaceOptions = (G: VQGame): ArmyMutinyTargetOption[] =>
    SPACES.filter((def) => G.spaces[def.id] !== undefined &&
        POWERS.some((power) => landCount(G.spaces[def.id].land[power]) > 0))
        .map((def) => ({value: def.id, label: spaceName(def.id, vqLocaleNow())}));

/** Major powers with a land stack in `spaceId`, in the engine's power order. */
export const armyMutinyOwnerOptions = (G: VQGame, spaceId: string, locale: "en" | "zh_CN" = "zh_CN"): ArmyMutinyOwnerOption[] => {
    const space = G.spaces[spaceId];
    if (space === undefined) return [];
    return POWERS.flatMap((power) => {
        const stack = space.land[power];
        if (stack === undefined) return [];
        const parts = [
            stack.regular > 0 ? `${i18n.chain.vq.board.regulars} ${stack.regular}` : "",
            stack.merc > 0 ? `${i18n.chain.vq.board.merc} ${stack.merc}` : "",
            stack.cav > 0 ? `${i18n.chain.vq.board.cav} ${stack.cav}` : "",
        ].filter((part) => part !== "");
        if (parts.length === 0) return [];
        const stackLabel = `${powerName(power, locale)}${i18n.chain.vq.eventTargets.parenOpen}${parts.join(i18n.chain.vq.eventTargets.listSeparator)}${i18n.chain.vq.eventTargets.parenClose}`;
        return [{value: power, label: stackLabel}];
    });
};

/** First legal space when the stored selection is stale or blank ("" if none). */
export const armyMutinySpaceValue = (G: VQGame, selected: string | undefined): string => {
    const options = armyMutinySpaceOptions(G);
    return selected !== undefined && options.some((option) => option.value === selected)
        ? selected
        : options[0]?.value ?? "";
};

/** First legal owner in `spaceId` when the stored selection is stale or missing. */
export const armyMutinyOwnerValue = (G: VQGame, spaceId: string, selected: Power | undefined): Power | undefined => {
    const options = armyMutinyOwnerOptions(G, spaceId);
    return selected !== undefined && options.some((option) => option.value === selected)
        ? selected
        : options[0]?.value;
};

/**
 * Builds the `space:owner` argument `resolveArmyMutiny` already parses.  The
 * owner is always explicit so a shared space cannot silently default to
 * whichever power the engine happens to enumerate first.
 */
export const armyMutinyTargetValue = (G: VQGame, selection: ArmyMutinyTargetSelection): string | undefined => {
    const space = armyMutinySpaceValue(G, selection.space);
    const owner = armyMutinyOwnerValue(G, space, selection.owner);
    return space === "" || owner === undefined ? undefined : `${space}:${owner}`;
};

/** Dedicated #17 selector: target space and the stack's owning major power. */
export const ArmyMutinyTargetSelect = ({G, value, onChange}: {
    G: VQGame;
    value: ArmyMutinyTargetSelection;
    onChange: (space: string, owner: Power) => void;
}) => {
    const space = armyMutinySpaceValue(G, value.space);
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const owners = armyMutinyOwnerOptions(G, space, vqLocale);
    const owner = armyMutinyOwnerValue(G, space, value.owner);
    return <Stack spacing={0.5} sx={{mt: 1}}>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.eventTargets.armyMutinyHint}
        </Typography>
        <FormControl size="small" fullWidth>
            <InputLabel id="vq-army-mutiny-space">{i18n.chain.vq.board.targetRegion}</InputLabel>
            <Select labelId="vq-army-mutiny-space" label={i18n.chain.vq.board.targetRegion} value={space}
                    onChange={(event) => {
                        const nextSpace = event.target.value;
                        const nextOwner = armyMutinyOwnerValue(G, nextSpace, undefined);
                        if (nextOwner !== undefined) onChange(nextSpace, nextOwner);
                    }}>
                {armyMutinySpaceOptions(G).map((option) =>
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl size="small" fullWidth disabled={owners.length === 0}>
            <InputLabel id="vq-army-mutiny-owner">{i18n.chain.vq.board.armyOwner}</InputLabel>
            <Select labelId="vq-army-mutiny-owner" label={i18n.chain.vq.board.armyOwner} value={owner ?? ""}
                    onChange={(event) => onChange(space, event.target.value as Power)}>
                {owners.map((option) =>
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
        </FormControl>
    </Stack>;
};

export interface GermanRecruitmentTargetOption {
    /** Space id, in map order. */
    value: string;
    label: string;
}

export interface GermanRecruitmentPowerOption {
    /** Major power with mercenaries in the chosen space. */
    value: Power;
    label: string;
}

/** Alias matching #17's "owner" wording; #23 removes that power's mercenaries. */
export type GermanRecruitmentOwnerOption = GermanRecruitmentPowerOption;

export interface GermanRecruitmentPick {
    /** Space whose mercenaries are removed. */
    space: string;
    /** Power whose mercenaries are removed; undefined means the first power there. */
    power?: Power;
}

/**
 * Stored #23 selection.  The flat `space`/`power` pair is the common
 * single-space case; the HRE may add a second, distinct pair.  `owner` and the
 * list aliases are accepted so the target builder can also consume the shape
 * produced by older callers without duplicating grammar in the component.
 */
export interface GermanRecruitmentTargetSelection {
    space?: string;
    power?: Power;
    /** Alias for `power`. */
    owner?: Power;
    /** Alternate first-pair names used by some callers. */
    firstSpace?: string;
    firstPower?: Power;
    secondSpace?: string;
    secondPower?: Power;
    /** Alias for `secondPower`. */
    secondOwner?: Power;
    first?: GermanRecruitmentPick;
    second?: GermanRecruitmentPick;
    picks?: readonly GermanRecruitmentPick[];
    spaces?: readonly GermanRecruitmentPick[];
    /** HRE marker, for callers that carry the acting power in the selection. */
    hre?: boolean;
    /** Explicit cap; the HRE uses two, every other power one. */
    maxSpaces?: number;
}

export type GermanRecruitmentSelection = GermanRecruitmentTargetSelection | readonly GermanRecruitmentPick[];

/**
 * #23 target spaces: every space holding mercenaries of at least one major
 * power, in map order.  Minor/independent mercenaries are not selectable
 * because the card removes one major power's mercenaries, and the engine's
 * explicit-power token only accepts a major power.
 */
export const germanRecruitmentSpaceOptions = (G: VQGame, _hre?: boolean): GermanRecruitmentTargetOption[] =>
    SPACES.filter((def) => G.spaces[def.id] !== undefined &&
        POWERS.some((power) => (G.spaces[def.id].land[power]?.merc ?? 0) > 0))
        .map((def) => ({value: def.id, label: spaceName(def.id, vqLocaleNow())}));

/** Major powers with mercenaries in `spaceId`, in the engine's power order. */
export const germanRecruitmentPowerOptions = (G: VQGame, spaceId: string, _hre?: boolean): GermanRecruitmentPowerOption[] => {
    const space = G.spaces[spaceId];
    if (space === undefined) return [];
    return POWERS.flatMap((power) => {
        const merc = space.land[power]?.merc ?? 0;
        return merc > 0 ? [{value: power, label: `${powerName(power, "zh_CN")}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.merc} ${merc}${i18n.chain.vq.punct.closeParen}`}] : [];
    });
};

/** Alias matching #17's owner naming. */
export const germanRecruitmentOwnerOptions = germanRecruitmentPowerOptions;

/** Spaces other than the first pick, for the HRE's second pair. */
export const germanRecruitmentSecondSpaceOptions = (
    G: VQGame,
    firstSpace?: string,
): GermanRecruitmentTargetOption[] =>
    germanRecruitmentSpaceOptions(G).filter((option) => option.value !== firstSpace);

/** The stored selection as ordered picks, accepting both flat and list shapes. */
const germanRecruitmentStoredPicks = (value: GermanRecruitmentSelection): GermanRecruitmentPick[] => {
    if (Array.isArray(value)) return [...value];
    const selection = value as GermanRecruitmentTargetSelection;
    const listed = selection.picks ?? selection.spaces;
    if (listed !== undefined) return [...listed];
    const picks: GermanRecruitmentPick[] = [];
    if (selection.first !== undefined) picks.push(selection.first);
    else if (selection.space !== undefined || selection.power !== undefined || selection.owner !== undefined ||
        selection.firstSpace !== undefined || selection.firstPower !== undefined) {
        const power = selection.power ?? selection.owner ?? selection.firstPower;
        picks.push({space: selection.space ?? selection.firstSpace ?? "", ...(power !== undefined ? {power} : {})});
    }
    if (selection.second !== undefined) picks.push(selection.second);
    else if (selection.secondSpace !== undefined || selection.secondPower !== undefined || selection.secondOwner !== undefined) {
        const power = selection.secondPower ?? selection.secondOwner;
        picks.push({space: selection.secondSpace ?? "", ...(power !== undefined ? {power} : {})});
    }
    return picks;
};

/** First legal space when the stored selection is stale or blank ("" if none). */
export const germanRecruitmentSpaceValue = (G: VQGame, selected: string | undefined): string => {
    const options = germanRecruitmentSpaceOptions(G);
    return selected !== undefined && options.some((option) => option.value === selected)
        ? selected
        : options[0]?.value ?? "";
};

/** First legal power in `spaceId` when the stored selection is stale or missing. */
export const germanRecruitmentPowerValue = (G: VQGame, spaceId: string, selected: Power | undefined): Power | undefined => {
    const options = germanRecruitmentPowerOptions(G, spaceId);
    return selected !== undefined && options.some((option) => option.value === selected)
        ? selected
        : options[0]?.value;
};

/** Alias matching #17's owner naming. */
export const germanRecruitmentOwnerValue = germanRecruitmentPowerValue;

const germanRecruitmentMaxSpaces = (
    G: VQGame,
    hre?: boolean | Power | {hre?: boolean; maxSpaces?: number},
): number => {
    if (typeof hre === "object" && hre !== null) return hre.maxSpaces ?? (hre.hre === true ? 2 : 1);
    if (typeof hre === "boolean") return hre ? 2 : 1;
    if (hre !== undefined) return hre === "hre" ? 2 : 1;
    // A card drawer opened for the HRE can offer the two-space variant without
    // an extra prop; callers that know the acting power can still pass it.
    return G.activePower === "hre" ? 2 : 1;
};

/**
 * Builds the `space:power` argument `resolveGermanRecruitment` already parses.
 * The first legal space/power is used when the selection is blank or stale.
 * A second group is emitted only for the HRE (at most two distinct spaces) and
 * is never defaulted from an empty second selection, so a one-space target
 * cannot accidentally remove mercenaries from a second space.
 */
export const germanRecruitmentTargetValue = (
    G: VQGame,
    selection: GermanRecruitmentSelection,
    hre?: boolean | Power | {hre?: boolean; maxSpaces?: number},
): string | undefined => {
    const flat = Array.isArray(selection) ? undefined : selection as GermanRecruitmentTargetSelection;
    const selectionMax = flat?.maxSpaces;
    const selectionHre = flat?.hre;
    const maxSpaces = selectionMax ?? germanRecruitmentMaxSpaces(G, hre ?? selectionHre);
    const stored = germanRecruitmentStoredPicks(selection);
    const parts: string[] = [];
    const chosen: string[] = [];
    for (const pick of stored) {
        if (parts.length >= maxSpaces) break;
        const space = pick === stored[0] ? germanRecruitmentSpaceValue(G, pick.space) : pick.space;
        if (space === "" || chosen.includes(space)) continue;
        if (!germanRecruitmentSpaceOptions(G).some((option) => option.value === space)) continue;
        const power = germanRecruitmentPowerValue(G, space, pick.power);
        if (power === undefined) continue;
        chosen.push(space);
        parts.push(`${space}:${power}`);
    }
    return parts.length > 0 ? parts.join(":") : undefined;
};

/** Alias used by some callers/tests that describe the value rather than the target. */
export const germanRecruitmentSelectionValue = germanRecruitmentTargetValue;

/** Flat `space:power` choices, useful for a single-space picker. */
export const germanRecruitmentTargetOptions = (G: VQGame, hre?: boolean | Power | {hre?: boolean; maxSpaces?: number}): {value: string; label: string}[] =>
    germanRecruitmentSpaceOptions(G).flatMap((space) =>
        germanRecruitmentPowerOptions(G, space.value).map((power) => ({
            value: `${space.value}:${power.value}`,
            label: `${space.label} · ${power.label}`,
        })));

/** Dedicated #23 selector: space + power, plus a second distinct pair for the HRE. */
export const GermanRecruitmentTargetSelect = ({G, value, onChange, hre, isHre, maxSpaces, twoSpaces}: {
    G: VQGame;
    value: GermanRecruitmentSelection;
    onChange: (...args: any[]) => void;
    hre?: boolean;
    /** Alias for `hre`. */
    isHre?: boolean;
    maxSpaces?: number;
    twoSpaces?: boolean;
}) => {
    const flat = Array.isArray(value) ? undefined : value as GermanRecruitmentTargetSelection;
    const hreSide = hre === true || isHre === true;
    const limit = maxSpaces ?? flat?.maxSpaces ??
        (twoSpaces === true || hreSide || flat?.hre === true ||
            G.activePower === "hre" ? 2 : 1);
    const stored = germanRecruitmentStoredPicks(value);
    const spaceOptions = germanRecruitmentSpaceOptions(G);
    const space = germanRecruitmentSpaceValue(G, stored[0]?.space);
    const powers = germanRecruitmentPowerOptions(G, space);
    const power = germanRecruitmentPowerValue(G, space, stored[0]?.power);
    const secondOptions = spaceOptions.filter((option) => option.value !== space);
    const storedSecond = stored[1]?.space;
    const secondSpace = limit > 1 && storedSecond !== undefined &&
        secondOptions.some((option) => option.value === storedSecond) ? storedSecond : "";
    const secondPowers = germanRecruitmentPowerOptions(G, secondSpace);
    const secondPower = germanRecruitmentPowerValue(G, secondSpace, stored[1]?.power);
    const emit = (nextSpace: string, nextPower: Power | undefined,
        nextSecondSpace: string, nextSecondPower: Power | undefined): void => {
        onChange(nextSpace, nextPower, nextSecondSpace === "" ? undefined : nextSecondSpace,
            nextSecondSpace === "" ? undefined : nextSecondPower);
    };
    const firstSpaceSelect = <FormControl size="small" fullWidth>
        <InputLabel id="vq-german-recruitment-space">{i18n.chain.vq.board.targetRegion}</InputLabel>
        <Select labelId="vq-german-recruitment-space" label={i18n.chain.vq.board.targetRegion} value={space}
                onChange={(event) => {
                    const nextSpace = event.target.value;
                    const nextPower = germanRecruitmentPowerValue(G, nextSpace, undefined);
                    const keepSecond = secondSpace !== "" && secondSpace !== nextSpace ? secondSpace : "";
                    const keepSecondPower = keepSecond === "" ? undefined : germanRecruitmentPowerValue(G, keepSecond, secondPower);
                    emit(nextSpace, nextPower, keepSecond, keepSecondPower);
                }}>
            {spaceOptions.map((option) =>
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
    </FormControl>;
    const firstPowerSelect = <FormControl size="small" fullWidth disabled={powers.length === 0}>
        <InputLabel id="vq-german-recruitment-power">{i18n.chain.vq.board.mercOwner}</InputLabel>
        <Select labelId="vq-german-recruitment-power" label={i18n.chain.vq.board.mercOwner} value={power ?? ""}
                onChange={(event) => emit(space, event.target.value as Power, secondSpace, secondPower)}>
            {powers.map((option) =>
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
    </FormControl>;
    const secondSpaceSelect = <FormControl size="small" fullWidth>
        <InputLabel id="vq-german-recruitment-second-space">{i18n.chain.vq.board.secondSpace}</InputLabel>
        <Select labelId="vq-german-recruitment-second-space" label={i18n.chain.vq.board.secondSpace}
                displayEmpty value={secondSpace}
                onChange={(event) => {
                    const nextSecondSpace = event.target.value;
                    const nextSecondPower = nextSecondSpace === "" ? undefined : germanRecruitmentPowerValue(G, nextSecondSpace, undefined);
                    emit(space, power, nextSecondSpace, nextSecondPower);
                }}>
            <MenuItem value="">{i18n.chain.vq.board.noSecondRegion}</MenuItem>
            {secondOptions.map((option) =>
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
    </FormControl>;
    const secondPowerSelect = <FormControl size="small" fullWidth disabled={secondPowers.length === 0}>
        <InputLabel id="vq-german-recruitment-second-power">{i18n.chain.vq.board.secondPower}</InputLabel>
        <Select labelId="vq-german-recruitment-second-power" label={i18n.chain.vq.board.secondPower}
                displayEmpty value={secondPower ?? ""}
                onChange={(event) => {
                    const nextPowerValue = event.target.value as string;
                    const nextPower = nextPowerValue === "" ? undefined : nextPowerValue as Power;
                    emit(space, power, secondSpace, nextPower);
                }}>
            <MenuItem value="">{i18n.chain.vq.board.noSecondPower}</MenuItem>
            {secondPowers.map((option) =>
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
    </FormControl>;
    return <Stack spacing={0.5} sx={{mt: 1}}>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.board.germanRecruitment}
        </Typography>
        {firstSpaceSelect}
        {firstPowerSelect}
        {limit > 1 && <>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.board.germanSecond}
            </Typography>
            {secondSpaceSelect}
            {secondPowerSelect}
        </>}
    </Stack>;
};

/** Short aliases for callers that name the card rather than its target. */
export const GermanRecruitmentSelect = GermanRecruitmentTargetSelect;
export const germanRecruitmentValue = germanRecruitmentTargetValue;
export const germanRecruitmentOptions = germanRecruitmentTargetOptions;
export const germanRecruitmentSecondPowerOptions = germanRecruitmentPowerOptions;

/**
 * #102 Sir Edward Stafford targets a power's hand and treasures, then names
 * one non-home card or one treasure to discard.  Only powers with something
 * discardable are offered, so the selector never proposes an effect that would
 * find nothing to discard.
 */
export interface StaffordPowerOption {
    value: Power;
    label: string;
}

export interface StaffordDiscardOption {
    /** Segment after the power, e.g. `card:vq-020` or `treasure:5`. */
    value: string;
    label: string;
}

export interface StaffordTargetSelection {
    /** Target power; blank means "the first power with something to discard". */
    power: string;
    /** Chosen discard segment; undefined means "the first legal choice". */
    discard?: string;
}

/** Everything the card drawer remembers while the player picks an event target. */
interface EventSelectionState {
    /** Card the selection belongs to; opening another card resets the rest. */
    cardId?: string;
    text: string;
    espionage: string;
    holyLeague: string;
    menendez: string;
    polish: PolishElectionBidChoices;
    armyMutiny: ArmyMutinyTargetSelection;
    stafford: StaffordTargetSelection;
    germanRecruitment: GermanRecruitmentTargetSelection;
    /** Selected event branch ids (#53 may select two). */
    branches: string[];
    /** Parameter values keyed by branch id, then parameter id. */
    branchParams: Record<string, Record<string, string>>;
}

const EMPTY_EVENT_SELECTION: EventSelectionState = {
    text: "",
    espionage: "",
    holyLeague: "",
    menendez: "",
    polish: {},
    armyMutiny: {space: ""},
    stafford: {power: ""},
    germanRecruitment: {space: ""},
    branches: [],
    branchParams: {},
};

type EventSelectionAction =
    | {type: "open"; cardId?: string}
    | {type: "reset"}
    | {type: "setText"; value: string}
    | {type: "setEspionage"; value: string}
    | {type: "setHolyLeague"; value: string}
    | {type: "setMenendez"; value: string}
    | {type: "setPolish"; value: PolishElectionBidChoices | ((current: PolishElectionBidChoices) => PolishElectionBidChoices)}
    | {type: "setArmyMutiny"; value: ArmyMutinyTargetSelection}
    | {type: "setStafford"; value: StaffordTargetSelection}
    | {type: "setGermanRecruitment"; value: GermanRecruitmentTargetSelection}
    | {type: "setBranches"; value: string[]}
    | {type: "setBranchParam"; branchId: string; paramId: string; value: string};

/**
 * One reducer for every card-specific target selection.  Opening a card clears
 * the whole selection, which replaces the manual reset chain that used to live
 * in the hand's onClick handler.
 */
const eventSelectionReducer = (state: EventSelectionState, action: EventSelectionAction): EventSelectionState => {
    switch (action.type) {
        case "open":
            return {...EMPTY_EVENT_SELECTION, cardId: action.cardId};
        case "reset":
            return EMPTY_EVENT_SELECTION;
        case "setText":
            return {...state, text: action.value};
        case "setEspionage":
            return {...state, espionage: action.value};
        case "setHolyLeague":
            return {...state, holyLeague: action.value};
        case "setMenendez":
            return {...state, menendez: action.value};
        case "setPolish":
            return {...state, polish: typeof action.value === "function" ? action.value(state.polish) : action.value};
        case "setArmyMutiny":
            return {...state, armyMutiny: action.value};
        case "setStafford":
            return {...state, stafford: action.value};
        case "setGermanRecruitment":
            return {...state, germanRecruitment: action.value};
        case "setBranches":
            return {...state, branches: action.value};
        case "setBranchParam":
            return {...state, branchParams: {
                ...state.branchParams,
                [action.branchId]: {...(state.branchParams[action.branchId] ?? {}), [action.paramId]: action.value},
            }};
        default:
            return state;
    }
};

/** Non-home cards in a power's hand, in the order the engine would inspect them. */
const staffordCards = (G: VQGame, power: Power): string[] =>
    G.powers[power].cards.filter((id) => cardById(id).kind !== "home");

/** Target powers that have at least one discardable card or treasure. */
export const staffordPowerOptions = (G: VQGame): StaffordPowerOption[] =>
    POWERS.flatMap((power) => {
        const cards = staffordCards(G, power).length;
        const treasures = G.powers[power].treasures.length;
        return cards === 0 && treasures === 0 ? [] : [{
            value: power,
            label: `${powerName(power, "zh_CN")}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.hand} ${cards}${i18n.chain.vq.punct.comma}${i18n.chain.vq.board.treasure} ${treasures}${i18n.chain.vq.punct.closeParen}`,
        }];
    });

/**
 * One choice per discardable card, then one per distinct treasure value (the
 * engine's grammar names a value, not a treasure counter, so duplicate values
 * collapse into one choice).  Cards are listed by descending CP like #86.
 */
export const staffordDiscardOptions = (G: VQGame, power: Power | string): StaffordDiscardOption[] => {
    if (!isPower(power)) return [];
    const cards = [...staffordCards(G, power)]
        .sort((a, b) => cardById(b).cp - cardById(a).cp || a.localeCompare(b))
        .map((id) => {
            const def = cardById(id);
            return {value: `card:${id}`, label: `${cardName(id, i18n.getLocaleName() === "en" ? "en" : "zh_CN")}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.hand} ${def.cp} CP${i18n.chain.vq.punct.closeParen}`};
        });
    const treasures = [...new Set(G.powers[power].treasures)].sort((a, b) => b - a)
        .map((value) => {
            const count = G.powers[power].treasures.filter((treasure) => treasure === value).length;
            return {
                value: `treasure:${value}`,
                label: `${i18n.chain.vq.board.treasure} ${value}${i18n.chain.vq.punct.openParen}${value} CP${count > 1 ? `${i18n.chain.vq.punct.comma}${i18n.chain.vq.board.total} ${count} ${i18n.chain.vq.board.pieces}` : ""}${i18n.chain.vq.punct.closeParen}`,
            };
        });
    return [...cards, ...treasures];
};

/** First legal target power when the stored selection is stale or blank ("" if none). */
export const staffordPowerValue = (G: VQGame, selected: string | undefined): string => {
    const options = staffordPowerOptions(G);
    return selected !== undefined && options.some((option) => option.value === selected)
        ? selected
        : options[0]?.value ?? "";
};

/** First legal discard choice for `power` when the stored one is stale or missing ("" if none). */
export const staffordDiscardValue = (G: VQGame, power: string, selected: string | undefined): string => {
    const options = staffordDiscardOptions(G, power);
    return selected !== undefined && options.some((option) => option.value === selected)
        ? selected
        : options[0]?.value ?? "";
};

/**
 * Builds the `power:card:<id>` / `power:treasure:<value>` argument
 * `resolveSirEdwardStafford` already parses.  The discard segment is always
 * explicit, so the engine never falls back to its automatic mixed selection.
 */
export const staffordTargetValue = (G: VQGame, selection: StaffordTargetSelection): string | undefined => {
    const power = staffordPowerValue(G, selection.power);
    const discard = staffordDiscardValue(G, power, selection.discard);
    return power === "" || discard === "" ? undefined : `${power}:${discard}`;
};

/** Dedicated #102 selector: target power, then a card or treasure to discard. */
export const StaffordTargetSelect = ({G, value, onChange}: {
    G: VQGame;
    value: StaffordTargetSelection;
    onChange: (power: Power, discard: string) => void;
}) => {
    const power = staffordPowerValue(G, value.power);
    const options = staffordDiscardOptions(G, power);
    const discard = staffordDiscardValue(G, power, value.discard);
    return <Stack spacing={0.5} sx={{mt: 1}}>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.board.staffordTarget}
        </Typography>
        <FormControl size="small" fullWidth disabled={staffordPowerOptions(G).length === 0}>
            <InputLabel id="vq-stafford-power">{i18n.chain.vq.board.targetPower}</InputLabel>
            <Select labelId="vq-stafford-power" label={i18n.chain.vq.board.targetPower} value={power}
                    onChange={(event) => {
                        const nextPower = event.target.value as Power;
                        const nextDiscard = staffordDiscardValue(G, nextPower, undefined);
                        if (nextDiscard !== "") onChange(nextPower, nextDiscard);
                    }}>
                {staffordPowerOptions(G).map((option) =>
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl size="small" fullWidth disabled={options.length === 0}>
            <InputLabel id="vq-stafford-discard">{i18n.chain.vq.board.discard}</InputLabel>
            <Select labelId="vq-stafford-discard" label={i18n.chain.vq.board.discard} value={discard}
                    onChange={(event) => onChange(power as Power, event.target.value)}>
                {options.map((option) =>
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
        </FormControl>
    </Stack>;
};

/**
 * #36 "retrieve and play immediately" choices for the battle panel.
 *
 * The battle stage only exposes `playVirginQueenCombat`, so the client must
 * offer that move's `retrieve:<cardId>:play` argument itself.  An option is
 * listed only when the viewing seat is England, England still holds #36, a
 * battle card window is open, and the discard card could be registered for
 * England in that window right now (`canPlayBattleCard`, the same guard
 * `playCard` uses before it mutates the hand/discard piles).  This mirrors the
 * move's own guards; it does not add any rule of its own.
 */
export const virginQueenCombatRetrieveOptions = (
    G: VQGame,
    playerID: string | null | undefined,
): VirginQueenCombatRetrieveOption[] => {
    if (playerID === null || playerID === undefined) return [];
    if (ownerOf(G, "england") !== playerID) return [];
    if (!G.powers.england.cards.includes("vq-036")) return [];
    if (G.pendingBattle === undefined || G.cardWindow?.kind !== "combat") return [];
    const seen = new Set<string>();
    return G.discard.flatMap((cardId) => {
        if (seen.has(cardId) || !canPlayBattleCard(G, "england", cardId)) return [];
        seen.add(cardId);
        return [{
            cardId,
            target: `retrieve:${cardId}:play`,
            label: `${i18n.chain.vq.board.retrievePlay} ${cardName(cardId, i18n.getLocaleName() === "en" ? "en" : "zh_CN")}`,
        }];
    });
};

export interface BetrothalChoices {
    /** Own royals selectable as the domestic side of the marriage. */
    domestic: RoyalDef[];
    /** Opposite-gender royals selectable as the other side. */
    foreign: RoyalDef[];
    /**
     * #95: the attached Louise counts as a royal of the power that played the
     * card, so that power may pick its own male royal and Louise together even
     * though ordinary same-power marriages are not allowed.
     */
    samePowerLouise: boolean;
    /** The same-power marriage is offered at all (an own male royal exists). */
    louiseAttachable: boolean;
    /** Arguments for proposeBetroth, only when both selections are legal. */
    proposal?: {male: string; female: string};
}

/**
 * Builds the royal-marriage picker.  The #95 attachment is the only case where
 * a same-power pair is selectable: Louise (female) plus the card player's own
 * male royal.  All pre-existing foreign choices use the same filters as before
 * (gender, availability, entry turn, shared family and war).
 */
export const betrothalChoices = (
    G: VQGame,
    me: Power | undefined,
    domesticRoyal: string,
    foreignRoyal?: string,
): BetrothalChoices => {
    const domestic = me === undefined ? [] : G.royals.filter((royal) =>
        royal.power === me && royalAvailable(royal) && (royal.turn ?? 1) <= G.year);
    const domesticDef = G.royals.find((royal) => royal.id === domesticRoyal);
    const targetGender = domesticDef?.gender === "male" ? "female" : "male";
    const louiseAvailable = G.royals.some((royal) => royal.id === "louiseLorraine" && royal.power === me &&
        royalAvailable(royal) && (royal.turn ?? 1) <= G.year);
    const louiseAttachable = domestic.some((royal) => royal.gender === "male") && louiseAvailable &&
        G.louiseAttachment?.available === true && G.louiseAttachment.power === me;
    const samePowerLouise = domesticDef?.gender === "male" && louiseAttachable;
    const foreign = G.royals.filter((royal) => {
        if (samePowerLouise && royal.id === "louiseLorraine") return true;
        return royal.power !== me &&
            royal.gender === targetGender &&
            royalAvailable(royal) &&
            (royal.turn ?? 1) <= G.year &&
            !(domesticDef?.family && royal.family === domesticDef.family) &&
            !(me !== undefined && atWar(G, me, royal.power));
    });
    const domesticPick = domestic.find((royal) => royal.id === domesticRoyal);
    const foreignPick = foreign.find((royal) => royal.id === foreignRoyal);
    const proposal = domesticPick !== undefined && foreignPick !== undefined
        ? domesticPick.gender === "male"
            ? {male: domesticPick.id, female: foreignPick.id}
            : {male: foreignPick.id, female: domesticPick.id}
        : undefined;
    return {domestic, foreign, samePowerLouise, louiseAttachable, proposal};
};

const patronageAwardSummary = (awards: PatronageVpAward[], kind: "artist" | "scientist"): string => {
    const typeNames: Record<string, string> = {writer: i18n.chain.vq.board.writer, painter: i18n.chain.vq.board.painter, architect: i18n.chain.vq.board.architect, any: i18n.chain.vq.board.anyType};
    const selected = awards.filter((award) => award.kind === kind);
    const vpValues = [...new Set(selected.map((award) => award.vp))].sort((a, b) => b - a);
    if (kind === "scientist") {
        return vpValues.map((vp) => `${vp}VP ×${selected.filter((award) => award.vp === vp).length}`).join(i18n.chain.vq.punct.list);
    }
    return vpValues.flatMap((vp) => {
        const ofValue = selected.filter((award) => award.vp === vp);
        const types = ["writer", "painter", "architect", "any"];
        return types.flatMap((type) => {
            const count = ofValue.filter((award) => (award.artistType ?? "any") === type).length;
            return count > 0 ? [`${typeNames[type]} ${vp}VP ×${count}`] : [];
        });
    }).join(i18n.chain.vq.punct.list);
};

const cell = (v: number): string => (v > 0 ? String(v) : "\u2014");

/** Scanned card art, with the text tile as the fallback when it is missing. */
const CardArt = ({def, className, lazy = false}: {def: CardDef; className: string; lazy?: boolean}) => {
    const [failed, setFailed] = React.useState(false);
    const src = cardImageUrl(def);
    if (src === undefined || failed) return null;
    return <img className={className} src={src} alt={`${cardName(def.id, i18n.getLocaleName() === "en" ? "en" : "zh_CN")} ${i18n.chain.vq.board.cardImage}`} width={376} height={526}
        loading={lazy ? "lazy" : "eager"} onError={() => setFailed(true)}/>;
};

/** The five printed card types, so the tray/detail match the card face. */
const cardKindLabel = (def: CardDef): string => {
    switch (def.officialKind) {
        case "home": return i18n.chain.vq.cardTray.homeCard;
        case "event": return i18n.chain.vq.cardTray.eventCard;
        case "mandatory": return i18n.chain.vq.cardTray.mandatoryCard;
        case "response": return i18n.chain.vq.cardTray.responseCard;
        case "combat": return i18n.chain.vq.cardTray.combatCard;
    }
    if (def.kind === "home") return i18n.chain.vq.cardTray.homeCard;
    if (def.kind === "event") return i18n.chain.vq.cardTray.eventCard;
    return i18n.chain.vq.cardTray.actionCard;
};

export interface VirginQueenBoardProps extends BoardProps<VQGame> {
    /** Local hotseat mounts every seat; show "switch to Pn" hints. */
    hotseat?: boolean;
}

export const VirginQueenBoard = ({G, ctx, moves, playerID, isActive, matchID, hotseat = false}: VirginQueenBoardProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const [selected, setSelected] = React.useState<string | undefined>(G.scenario === "tutorial"
        ? playerID === "1" ? "madrid" : "istanbul" : "london");
    const isDesktop = useMediaQuery("(min-width:1024px)");
    const [mobileView, setMobileView] = React.useState("map");
    const [handExpanded, setHandExpanded] = React.useState(true);
    const [selectedCard, setSelectedCard] = React.useState<string>();
    const [eventSelection, dispatchEventSelection] = React.useReducer(eventSelectionReducer, EMPTY_EVENT_SELECTION);
    const actionRef = React.useRef<HTMLElement>(null);
    const sidebarRef = React.useRef<HTMLElement>(null);
    const panelID = React.useId();
    const [mode, setMode] = React.useState<Mode>("inspect");
    const [from, setFrom] = React.useState<string | null>(null);
    const [movingUnits, setMovingUnits] = React.useState<LandStack>({regular: 0, merc: 0, cav: 0});
    const [movingOwner, setMovingOwner] = React.useState<Controller>("ottoman");
    const [movingLeaders, setMovingLeaders] = React.useState<string[]>([]);
    const [transportZones, setTransportZones] = React.useState<string[]>([]);
    const [rebelCp, setRebelCp] = React.useState(2);
    const [seaCaptainChoice, setSeaCaptainChoice] = React.useState("");
    const [seaCaptainPort, setSeaCaptainPort] = React.useState("");
    const [piracyZone, setPiracyZone] = React.useState("");
    const [piracyTarget, setPiracyTarget] = React.useState("");
    const [diploTarget, setDiploTarget] = React.useState<Power>("spain");
    const [actionNotice, setActionNotice] = React.useState<string | undefined>();
    const [loanFromPort, setLoanFromPort] = React.useState("");
    const [loanToPort, setLoanToPort] = React.useState("");
    const [loanLeader, setLoanLeader] = React.useState("");
    const [domesticRoyal, setDomesticRoyal] = React.useState("");
    const [foreignRoyal, setForeignRoyal] = React.useState("");
    const [patronageCp, setPatronageCp] = React.useState(2);
    const [espionageTargetSelection, setEspionageTarget] = React.useState<Power>("spain");
    const [assassinationTarget, setAssassinationTarget] = React.useState("elizabeth");
    const [assassinationCp, setAssassinationCp] = React.useState(2);
    const [catholicRebellionCp, setCatholicRebellionCp] = React.useState(3);
    const [informantSource, setInformantSource] = React.useState("");
    const eventTarget = eventSelection.text;
    const espionageEventTarget = eventSelection.espionage;
    const holyLeagueEventTarget = eventSelection.holyLeague;
    const menendezEventTarget = eventSelection.menendez;
    const polishElectionBids = eventSelection.polish;
    const armyMutinySelection = eventSelection.armyMutiny;
    const staffordSelection = eventSelection.stafford;
    const germanRecruitmentSelection = eventSelection.germanRecruitment;
    const setEventTarget = (value: string): void => dispatchEventSelection({type: "setText", value});
    const setEspionageEventTarget = (value: string): void => dispatchEventSelection({type: "setEspionage", value});
    const setHolyLeagueEventTarget = (value: string): void => dispatchEventSelection({type: "setHolyLeague", value});
    const setMenendezEventTarget = (value: string): void => dispatchEventSelection({type: "setMenendez", value});
    const setPolishElectionBids = (value: PolishElectionBidChoices | ((current: PolishElectionBidChoices) => PolishElectionBidChoices)): void =>
        dispatchEventSelection({type: "setPolish", value});
    const setArmyMutinySelection = (value: ArmyMutinyTargetSelection): void => dispatchEventSelection({type: "setArmyMutiny", value});
    const setStaffordSelection = (value: StaffordTargetSelection): void => dispatchEventSelection({type: "setStafford", value});
    const setGermanRecruitmentSelection = (value: GermanRecruitmentTargetSelection): void => dispatchEventSelection({type: "setGermanRecruitment", value});
    const setEventBranches = (value: string[]): void => dispatchEventSelection({type: "setBranches", value});
    const setEventBranchParam = (branchId: string, paramId: string, value: string): void =>
        dispatchEventSelection({type: "setBranchParam", branchId, paramId, value});
    /** Opens a card and clears every target selection that belonged to the previous one. */
    const openCard = (cardId: string): void => {
        setSelectedCard(cardId);
        dispatchEventSelection({type: "open", cardId});
    };
    const [expeditionCaptain, setExpeditionCaptain] = React.useState("");
    const [expeditionHasColony, setExpeditionHasColony] = React.useState(false);
    const [foreignArmySize, setForeignArmySize] = React.useState(3);
    const [foreignWarUnits, setForeignWarUnits] = React.useState<{space: string; kind: keyof LandStack}[]>([]);
    const [foreignWarLeader, setForeignWarLeader] = React.useState("");
    const [gregorianTarget, setGregorianTarget] = React.useState<Power>("france");
    const [selectedActionResponder, setSelectedActionResponder] = React.useState<Power>();
    const [selectedAbjurationPower, setSelectedAbjurationPower] = React.useState<Power>();
    // Pass / end-impulse are destructive enough to deserve a confirmation.
    const [confirmAction, setConfirmAction] = React.useState<"pass" | "endImpulse" | null>(null);
    const [sheetOpen, setSheetOpen] = React.useState(false);
    // Phones edit the staged formation in a bottom sheet instead of a map overlay.
    const [formationSheetOpen, setFormationSheetOpen] = React.useState(false);

    const [viewPower, setViewPower] = React.useState<Power>();
    const owned = controlledPowers(G, playerID);
    const piracyResponder = G.pendingPiracy && (G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target);
    const actionResponders = actionWindowResponders(G);
    const myActionChoices = actionResponderChoices(G, playerID);
    const myActionResponders = myActionChoices.map((choice) => choice.responder);
    // Ignore a stale selection when the response window shrinks (another
    // holder answered) or a new window offers a different set of powers.
    const actionResponder = (selectedActionResponder !== undefined && myActionResponders.includes(selectedActionResponder)
        ? selectedActionResponder : undefined) ?? myActionResponders[0] ?? actionResponders[0];
    const responsePower = G.gregorianResponse && ownerOf(G, G.gregorianResponse.responder) === playerID ? G.gregorianResponse.responder :
        G.pendingBeacon && ownerOf(G, G.pendingBeacon.defender) === playerID ? G.pendingBeacon.defender :
        G.pendingInterceptionOrder && ownerOf(G, G.pendingInterceptionOrder.defender) === playerID ? G.pendingInterceptionOrder.defender :
        G.pendingIntercept && ownerOf(G, G.pendingIntercept.defender) === playerID ? G.pendingIntercept.defender :
        G.pendingEspionage && ownerOf(G, G.pendingEspionage.responding) === playerID ? G.pendingEspionage.responding :
        actionResponder && ownerOf(G, actionResponder) === playerID ? actionResponder :
        piracyResponder && ownerOf(G, piracyResponder) === playerID ? piracyResponder :
        G.pendingCardEvent && ownerOf(G, G.pendingCardEvent.responding) === playerID ? G.pendingCardEvent.responding :
        G.pendingTutorialEvent && ownerOf(G, G.pendingTutorialEvent.responding) === playerID ? G.pendingTutorialEvent.responding :
        G.pendingCityRebels && isPower(G.pendingCityRebels.controller) && ownerOf(G, G.pendingCityRebels.controller) === playerID ? G.pendingCityRebels.controller :
        G.pendingBattle && ownerOf(G, G.pendingBattle.responding) === playerID ? G.pendingBattle.responding :
        G.pendingBetrothal && ownerOf(G, G.pendingBetrothal.target) === playerID ? G.pendingBetrothal.target :
        G.pendingForeignWar && ownerOf(G, G.pendingForeignWar.power) === playerID ? G.pendingForeignWar.power :
        G.pendingRebelMove && ownerOf(G, G.pendingRebelMove.power) === playerID ? G.pendingRebelMove.power : undefined;
    const me: Power | undefined = responsePower ?? (ctx.currentPlayer === playerID ? G.activePower :
        viewPower && owned.includes(viewPower) ? viewPower : owned[0]);
    const legalEspionageTargets = POWERS.filter((p) => p !== me && !isActivatedMajor(G, p));
    const espionageTarget = legalEspionageTargets.includes(espionageTargetSelection) ? espionageTargetSelection : legalEspionageTargets[0];
    const myTurn = ctx.gameover === undefined && me !== undefined && ctx.currentPlayer === playerID && me === G.activePower;
    const diploTargetValue = legalDiplomacyTarget(me, diploTarget);
    const switchToTab = (power: Power | undefined): string | undefined => {
        if (!hotseat || power === undefined) return undefined;
        const seat = ownerOf(G, power);
        if (seat === undefined || seat === playerID) return undefined;
        return i18n.chain.vq.shell.switchToTab.replace("{tab}", String(Number(seat) + 1));
    };
    useTurnNotification({
        isMyTurn: myTurn,
        needsResponse: responsePower !== undefined && ctx.gameover === undefined,
        titleSuffix: responsePower !== undefined ? i18n.chain.vq.shell.responseNeeded : myTurn ? i18n.chain.vq.shell.yourTurn : undefined,
    });
    useNotificationPermission(myTurn || responsePower !== undefined);
    const phase = ctx.phase ?? "";
    const ps = me !== undefined ? G.powers[me] : undefined;
    const cp = ps?.cp ?? 0;
    const hand = ps?.cards ?? [];
    const passBlockCodes: PassBlock[] = myTurn && phase === "action" && me !== undefined ? passBlockReasons(G, me) : [];
    const passBlockText = (code: PassBlock): string => {
        switch (code) {
            case "played":
                return i18n.chain.vq.turn.passAlreadyPlayed;
            case "mandatory": {
                const id = hand.find((candidate) => cardById(candidate).officialKind === "mandatory");
                return i18n.chain.vq.turn.mustPlayMandatory.replace("{card}", id !== undefined ? cardName(id, vqLocale) : "");
            }
            case "home": {
                const id = hand.find((candidate) => cardById(candidate).kind === "home");
                return i18n.chain.vq.turn.mustPlayHome.replace("{card}", id !== undefined ? cardName(id, vqLocale) : "");
            }
            case "admin":
                return i18n.chain.vq.turn.handOverAdmin
                    .replace("{hand}", String(hand.length))
                    .replace("{admin}", me !== undefined ? String(rulerStats(G, me).admin) : "");
        }
    };
    // Every rule that blocks a pass is listed, not just the first one: a large
    // hand plus an unplayed Home card are independent restrictions.
    const passBlockReason = passBlockCodes.length > 0 ? passBlockCodes.map(passBlockText).join(" · ") : undefined;
    // Ending after a card is the normal way to finish an impulse; only the
    // no-card path is a pass and subject to the pass restrictions.
    const endImpulseBlocked = passBlockCodes.some((code) => code !== "played");
    // Hotseat: every mounted seat shares one screen, so an idle panel has to
    // say which tab the device user should open next.
    const hotseatWaitHint = (): string | undefined => {
        if (myTurn || me === undefined) return undefined;
        const base = `${i18n.chain.vq.board.waiting} ${powerName(G.activePower, vqLocale)} ${i18n.chain.vq.board.act}${i18n.chain.vq.punct.period}`;
        const tab = switchToTab(G.activePower);
        return tab === undefined ? base : `${base} ${tab}`;
    };
    const canAct = myTurn && phase === "action" && !G.pendingEspionage && !G.pendingBattle && !G.pendingActivation && !G.pendingCardEvent && !G.pendingTutorialEvent && !G.pendingPiracy && !G.pendingAction && !G.pendingIntercept && !G.pendingAbjuration && !G.gregorianResponse && !G.pendingBeacon && !G.pendingInterceptionOrder && !G.pendingCityRebels && !G.pendingReliefSplit && !G.pendingRebelMove && !G.pendingForeignWar;
    const vqCombatRetrieve = virginQueenCombatRetrieveOptions(G, playerID);

    /** Why an action mode is unavailable, or undefined when it can be picked. */
    const modeDisabledReason = (candidate: Mode): string | undefined => {
        if (!myTurn || me === undefined) return i18n.chain.vq.turn.notYourTurn;
        if (!canAct && candidate !== "spring") return i18n.chain.vq.turn.disabled;
        const cost = MODE_COST[candidate];
        if (cp < cost) return i18n.chain.vq.turn.neededCp.replace("{need}", String(cost));
        return undefined;
    };

    const isMoveMode = (candidate: Mode): boolean =>
        candidate === "moveLand" || candidate === "moveNaval" || candidate === "navalTransport" || candidate === "spring";

    /** Steps to display in the map banner for the current multi-step action. */
    const stepState = (): {steps: string[]; active: number} | undefined => {
        if (!isMoveMode(mode)) return undefined;
        const e = i18n.chain.vq.step;
        const steps = mode === "moveNaval"
            ? [e.chooseOrigin, e.chooseTarget]
            : [e.chooseOrigin, e.chooseUnit, e.chooseTarget];
        return {steps, active: from === null ? 0 : 1};
    };

    const mapHighlights = mode === "inspect" ? undefined : legalTargets(G, me, mode, from);
    const stepInfo = stepState();

    /** Sea zones that can be appended next to the transport route. */
    const transportCandidates = (() => {
        if (mode !== "navalTransport" || from === null) return [];
        const last = transportZones[transportZones.length - 1];
        const zones = last !== undefined ? SEA_ZONE_BY_ID[last]?.adjacent ?? [] : (SPACE_BY_ID[from]?.ports ?? []);
        return [...new Set(zones)]
            .filter((id) => !transportZones.includes(id))
            .map((id) => SEA_ZONE_BY_ID[id])
            .filter((zone) => zone !== undefined);
    })();

    /**
     * Units staged by default when an origin is chosen: the whole stack clipped
     * to the formation limit so the obvious next click does not fail silently.
     */
    const defaultFormationUnits = (origin: string, leaders: string[]): LandStack => {
        const available = (me !== undefined ? G.spaces[origin]?.land[me] : undefined) ?? {regular: 0, merc: 0, cav: 0};
        let remaining = formationCapacity(leaders);
        const units: LandStack = {regular: 0, merc: 0, cav: 0};
        for (const kind of ["regular", "merc", "cav"] as const) {
            const take = Math.min(available[kind], remaining);
            units[kind] = take;
            remaining -= take;
        }
        return units;
    };

    /**
     * Owner, unit-count and leader controls for a staged land formation.
     * Spring Deployment moves only the active power's own troops, so it hides
     * the owner picker.
     */
    const stackPicker = (spring: boolean) => {
        if (from === null) return null;
        const source = G.spaces[from];
        if (source === undefined) return null;
        const owner: Controller = spring && me !== undefined ? me : movingOwner;
        const available = source.land[owner] ?? {regular: 0, merc: 0, cav: 0};
        const capacity = formationCapacity(movingLeaders);
        const chosen = landCount(movingUnits);
        return <>
            {!spring && <Select size="small" value={movingOwner} onChange={(event) => {
                const nextOwner = event.target.value as Controller;
                setMovingOwner(nextOwner);
                setMovingUnits({...G.spaces[from].land[nextOwner]!});
                setMovingLeaders([]);
            }}>
                {(Object.keys(G.spaces[from].land) as Controller[])
                    .filter((candidate) => ((spring || mode === "navalTransport") ? candidate === me : friendlyController(G, me, candidate)) &&
                        landCount(G.spaces[from].land[candidate]) > 0)
                    .map((candidate) => <MenuItem key={candidate} value={candidate}>{controllerName(candidate, vqLocale)}</MenuItem>)}
            </Select>}
            {(["regular", "merc", "cav"] as const).map((kind) => <Stack key={kind} direction="row" spacing={1}>
                <Typography variant="caption">{unitLabel(kind)}</Typography>
                <Select size="small" value={movingUnits[kind]} onChange={(event) => setMovingUnits({...movingUnits, [kind]: Number(event.target.value)})}>
                    {Array.from({length: (available[kind] ?? 0) + 1}, (_, count) => <MenuItem key={count} value={count}>{count}</MenuItem>)}
                </Select>
            </Stack>)}
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {source.leaders.filter((leader) => LEADER_BY_ID[leader]?.power === owner && LEADER_BY_ID[leader]?.kind === "army").map((leader) =>
                    <Button key={leader} variant={movingLeaders.includes(leader) ? "contained" : "outlined"} onClick={() => setMovingLeaders(movingLeaders.includes(leader) ? movingLeaders.filter((id) => id !== leader) : [...movingLeaders, leader])}>{leaderLabel(leader)}</Button>)}
            </Stack>
            <Typography variant="caption" color={chosen > capacity ? "error" : "text.secondary"}>
                {i18n.chain.vq.springUi.commandLimit.replace("{count}", String(capacity))}
                {chosen > capacity ? ` · ${i18n.chain.vq.springUi.overCapacity}` : ""}
            </Typography>
        </>;
    };

    /** One-line read-out for the map dock that replaces the picker on phones. */
    const formationSummary = (): string => {
        const units = (["regular", "merc", "cav"] as const)
            .map((kind) => `${unitLabel(kind)} ${movingUnits[kind]}`)
            .join(" · ");
        const leaders = movingLeaders.length > 0 ? ` · ${movingLeaders.map(leaderLabel).join(" + ")}` : "";
        return `${units}${leaders} · ${i18n.chain.vq.springUi.commandLimit.replace("{count}", String(formationCapacity(movingLeaders)))}`;
    };

    React.useEffect(() => {
        // Spring deployment is the only map action available in the spring
        // phase, so arm it automatically instead of asking for a dropdown pick.
        setMode(ctx.phase === "spring" && myTurn ? "spring" : "inspect");
        setFrom(null);
        setForeignWarUnits([]);
        setForeignWarLeader("");
    }, [ctx.phase, ctx.currentPlayer, G.activePower, myTurn]);

    React.useEffect(() => {
        // A one-shot action can spend the last CP; do not leave the map in a
        // mode whose next click would be rejected by the engine.
        if (!myTurn || mode === "inspect" || mode === "spring") return;
        if (cp < MODE_COST[mode]) {
            setMode("inspect");
            setFrom(null);
            setTransportZones([]);
            setActionNotice(i18n.chain.vq.actionUi.notEnoughCp);
        }
    }, [cp, mode, myTurn]);

    React.useEffect(() => {
        // The sheet only exists while a formation is being staged; close it as
        // soon as the move ends, the action changes, or the viewport is wide.
        if (isDesktop || from === null || (mode !== "spring" && mode !== "moveLand" && mode !== "navalTransport")) {
            setFormationSheetOpen(false);
        }
    }, [from, mode, isDesktop]);

    React.useEffect(() => {setSelectedCard(undefined);}, [me, playerID]);

    React.useEffect(() => {
        const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented || confirmAction !== null) return;
            if (from !== null) {
                event.preventDefault();
                setFrom(null);
                setTransportZones([]);
            } else if (mode !== "inspect") {
                event.preventDefault();
                setMode(phase === "spring" ? "spring" : "inspect");
            }
        };
        window.addEventListener("keydown", cancelOnEscape);
        return () => window.removeEventListener("keydown", cancelOnEscape);
    }, [from, mode, confirmAction, phase]);

    const doSpaceAction = (id: string): void => {
        // Sea labels share selection with cities; only naval moves and transport routes accept them.
        if (G.spaces[id] === undefined && mode !== "moveNaval" && mode !== "navalTransport") return;
        // While routing a naval transport, clicking sea zones appends them to the
        // ordered route instead of executing anything.
        if (mode === "navalTransport" && from !== null && G.spaces[id] === undefined) {
            setTransportZones((zones) => zones.includes(id) ? zones : [...zones, id]);
            return;
        }
        if ((!canAct && !(myTurn && phase === "spring" && mode === "spring")) || me === undefined) {
            return;
        }
        const oneShot = mode === "recruitRegular" || mode === "recruitMerc" || mode === "recruitCav" ||
            mode === "buildGalley" || mode === "buildGalleon" || mode === "buildRacebuilt" || mode === "buildCorsair" ||
            mode === "control" || mode === "assault" || mode === "buildFortress" || mode === "rebellion";
        if (oneShot && mapHighlights !== undefined && !mapHighlights.has(id)) {
            setActionNotice(i18n.chain.vq.actionUi.illegalTarget);
            return;
        }
        switch (mode) {
            case "recruitRegular":
                moves.recruit({space: id, kind: "regular"});
                break;
            case "recruitMerc":
                moves.recruit({space: id, kind: "merc"});
                break;
            case "recruitCav":
                moves.recruit({space: id, kind: "cav"});
                break;
            case "buildGalley":
                moves.buildNaval({port: id, kind: "galley"});
                break;
            case "buildGalleon":
                moves.buildNaval({port: id, kind: "galleon"});
                break;
            case "buildRacebuilt":
                moves.buildNaval({port: id, kind: "racebuilt"});
                break;
            case "buildCorsair":
                moves.buildNaval({port: id, kind: "corsair"});
                break;
            case "moveLand":
            case "navalTransport":
                if (from === null) {
                    const owner = (Object.keys(G.spaces[id].land) as Controller[]).find((candidate) =>
                        (mode === "navalTransport" ? candidate === me : friendlyController(G, me, candidate)) && landCount(G.spaces[id].land[candidate]) > 0);
                    if (owner) {
                        setFrom(id);
                        setMovingOwner(owner);
                        setMovingUnits({...G.spaces[id].land[owner]!});
                        setMovingLeaders(G.spaces[id].leaders.filter((leader) => LEADER_BY_ID[leader]?.power === owner && LEADER_BY_ID[leader]?.kind === "army"));
                        setTransportZones([]);
                    }
                } else {
                    if (mode === "navalTransport") moves.navalTransport({from, to: id, zones: transportZones, units: movingUnits, leaders: movingLeaders});
                    else moves.moveLand({from, to: id, units: movingUnits, unitPower: movingOwner, leaders: movingLeaders});
                    setFrom(null);
                }
                break;
            case "moveNaval":
                if (from === null) {
                    if (G.seaZones[id as keyof VQGame["seaZones"]]?.naval[me] !== undefined) {
                        setFrom(id);
                    } else if (G.spaces[id] !== undefined && (G.spaces[id].naval[me] !== undefined)) {
                        setFrom(id);
                    }
                } else {
                    moves.moveNaval({from, to: id});
                    setFrom(null);
                }
                break;
            case "spring":
                if (from === null) {
                    const stack = G.spaces[id].land[me];
                    if (capitalSpacesFor(G, me).includes(id) && stack !== undefined && landCount(stack) > 0) {
                        const leaders = G.spaces[id].leaders
                            .filter((leader) => LEADER_BY_ID[leader]?.power === me && LEADER_BY_ID[leader]?.kind === "army")
                            .slice(0, 2);
                        setFrom(id);
                        setMovingOwner(me);
                        setMovingLeaders(leaders);
                        setMovingUnits(defaultFormationUnits(id, leaders));
                    }
                } else {
                    moves.springDeploy({from, to: id, units: movingUnits, leaders: movingLeaders});
                    setFrom(null);
                }
                break;
            case "control":
                moves.controlSpace({space: id});
                break;
            case "assault":
                moves.assault({space: id});
                break;
            case "buildFortress":
                moves.buildFortress({space: id});
                break;
            case "rebellion":
                moves.rebellion({space: id, cp: rebelCp});
                break;
            default:
                break;
        }
    };

    const onSelect = (id: string): void => {
        setSelected(id);
        doSpaceAction(id);
        // Read-only taps open the bottom sheet on phones; an active action keeps
        // the map in front so the target can still be chosen.
        if (!isDesktop && mode === "inspect" && G.spaces[id] !== undefined) setSheetOpen(true);
    };

    const space = selected !== undefined ? G.spaces[selected] : undefined;
    const spaceDef = selected !== undefined ? SPACE_BY_ID[selected] : undefined;
    const standings = victoryStandings(G);

    const cardView = (id: string) => {
        const def = cardById(id);
        const disabled = !canAct || ps === undefined || ps.cardPlayed;
        const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
        const espionageTargets = handler === "walsingham" ? ["offensive", "defensive", ...POWERS.filter((p) => p !== "england" && !isActivatedMajor(G, p))] :
            handler === "cipherKey" ? ["remove", ...POWERS.filter((p) => p !== me && !isActivatedMajor(G, p))] :
                handler === "doubleAgent" && me !== undefined ? doubleAgentTargets(G, me) :
                    handler === "untimelyDeath" && G.scenario !== "tutorial" ? (untimelyDeathTargets(G).length ? untimelyDeathTargets(G) : ["none"]) : [];
        const espionageTarget = espionageTargets.includes(espionageEventTarget) ? espionageEventTarget : espionageTargets[0];
        const targetMode = eventTargetMode(handler, espionageTargets.length);
        const foreignWarPower = targetMode === "foreignWar" ? (handler === "warInPersia" ? "ottoman" : "hre") : undefined;
        const holyLeagueOptions = targetMode === "holyLeague" ? holyLeagueTargetOptions(G) : [];
        const holyLeagueTarget = holyLeagueTargetValue(G, holyLeagueEventTarget);
        const menendezOptions = targetMode === "menendez" ? menendezTargetOptions(G) : [];
        const menendezTarget = menendezTargetValue(G, menendezEventTarget);
        const polishElection = targetMode === "polishElection";
        const armyMutiny = targetMode === "armyMutiny";
        const stafford = targetMode === "stafford";
        const germanRecruitment = targetMode === "germanRecruitment";
        const foreignWarBlocked = foreignWarPower !== undefined && (G.foreignWars[foreignWarPower] !== undefined ||
            (foreignWarPower === "hre" && atWar(G, "hre", "ottoman")) ||
            Object.values(G.spaces).filter((space) => space.siege === undefined)
                .reduce((total, space) => total + landCount(space.land[foreignWarPower]), 0) < 3);
        const canPlayAsEvent = def.kind !== "command" || def.officialKind === "mandatory" || G.scenario === "tutorial";
        const branchChoice = canPlayAsEvent && me !== undefined ? eventBranchChoice(G, id, me, ctx.numPlayers ?? 6) : undefined;
        const branchIds = branchChoice !== undefined ? effectiveBranchIds(branchChoice, eventSelection.branches) : [];
        const branchDefs = branchChoice !== undefined
            ? branchChoice.branches.filter((entry) => branchIds.includes(entry.id))
            : [];
        const branchValues: Record<string, Record<string, string>> = {};
        for (const entry of branchDefs) branchValues[entry.id] = branchParamValues(entry, eventSelection.branchParams[entry.id]);
        const branchTarget = branchChoice !== undefined ? eventBranchTarget(branchDefs, branchValues) : undefined;
        const branchComplete = branchChoice === undefined ||
            branchIds.length >= Math.min(branchChoice.maxSelections, branchChoice.branches.length);
        // Cards without an effect-branch entry or a dedicated selector get an
        // enumerable target dropdown; the old free-text field is gone.
        const targetOptions = canPlayAsEvent && branchChoice === undefined && targetMode === "freeText" && me !== undefined
            ? eventTargetOptions(G, id, me) : [];
        const targetChoice = eventTargetValue(targetOptions, eventTarget);
        return <Paper key={id} variant="outlined" sx={{p: 0.75, mb: 0.5}}>
            <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                <Typography variant="caption" sx={{fontWeight: 700}}>{cardName(id, vqLocale)}</Typography>
                <Chip size="small" label={`${def.cp} CP`} color={def.kind === "home" ? "secondary" : "default"}/>
                <Chip size="small" variant="outlined" label={cardKindLabel(def)}/>
            </Stack>
            <CardArt def={def} className="vq-card-detail-art"/>
            {def.text !== undefined && <Typography variant="caption" color="text.secondary">{def.text}</Typography>}
            {branchChoice !== undefined && <EventBranchPanel choice={branchChoice} selected={eventSelection.branches}
                params={eventSelection.branchParams} onSelect={setEventBranches} onParam={setEventBranchParam}/>}
            {branchChoice === undefined && espionageTargets.length > 0 && <Select size="small" fullWidth value={espionageTarget}
                onChange={(e) => setEspionageEventTarget(e.target.value)}>
                {espionageTargets.map((target) => <MenuItem key={target} value={target}>
                    {target === "offensive" ? i18n.chain.vq.board.offensive : target === "defensive" ? i18n.chain.vq.board.defensive : target === "remove" ? i18n.chain.vq.board.removeAll : target.includes(">")
                        ? `${i18n.chain.vq.board.defect} ${powerName(target.split(">")[0] as Power, vqLocale)} ${i18n.chain.vq.board.spy}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.recall} ${powerName(target.split(">")[1] as Power, vqLocale)} ${i18n.chain.vq.board.ownSpy}${i18n.chain.vq.punct.closeParen}`
                        : handler === "doubleAgent" ? `${i18n.chain.vq.board.defect} ${powerName(target as Power, vqLocale)} ${i18n.chain.vq.board.spy}`
                        : handler === "untimelyDeath" ? (target === "none" ? i18n.chain.vq.board.noRemovableLeader : `${i18n.chain.vq.board.removeGame}: ${leaderLabel(target)}`)
                        : powerName(target as Power, vqLocale)}
                </MenuItem>)}
            </Select>}
            {branchChoice === undefined && foreignWarPower !== undefined && <FormControl size="small" sx={{mt: 0.5, minWidth: 130}}>
                <InputLabel id={`vq-war-size-${id}`}>{i18n.chain.vq.board.foreignArmySize}</InputLabel>
                <Select labelId={`vq-war-size-${id}`} label={i18n.chain.vq.board.foreignArmySize} value={foreignArmySize}
                        onChange={(e) => setForeignArmySize(Number(e.target.value))}>
                    {[3, 5].map((n) => <MenuItem key={n} value={n}>{n} {i18n.chain.vq.board.independentArmies}</MenuItem>)}
                </Select>
            </FormControl>}
            {branchChoice === undefined && holyLeagueOptions.length > 0 && <HolyLeagueTargetSelect options={holyLeagueOptions}
                value={holyLeagueTarget} onChange={setHolyLeagueEventTarget}/>}
            {branchChoice === undefined && menendezOptions.length > 0 && <MenendezTargetSelect options={menendezOptions}
                value={menendezTarget ?? ""} onChange={setMenendezEventTarget}/>}
            {branchChoice === undefined && polishElection && <PolishElectionTargetSelect G={G} value={polishElectionBids}
                onChange={(power, choice) => setPolishElectionBids((current) => ({...current, [power]: choice}))}/>}
            {branchChoice === undefined && armyMutiny && <ArmyMutinyTargetSelect G={G} value={armyMutinySelection}
                onChange={(space, owner) => setArmyMutinySelection({space, owner})}/>}
            {branchChoice === undefined && stafford && <StaffordTargetSelect G={G} value={staffordSelection}
                onChange={(power, discard) => setStaffordSelection({power, discard})}/>}
            {branchChoice === undefined && germanRecruitment && <GermanRecruitmentTargetSelect G={G} hre={me === "hre"}
                value={germanRecruitmentSelection}
                onChange={(space: string, power?: Power, secondSpace?: string, secondPower?: Power) =>
                    setGermanRecruitmentSelection({space, power, secondSpace, secondPower})}/>}
            {targetOptions.length > 0 && <EventTargetSelect cardId={id} options={targetOptions}
                value={targetChoice ?? ""} onChange={setEventTarget}/>}
            <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
                {canPlayAsEvent && <Button size="small" variant="contained"
                                                  disabled={disabled || foreignWarBlocked || !branchComplete ||
                                                      (branchChoice === undefined && isEspionageEvent(handler) && !canPlayEspionageEvent(G, me!, handler, espionageTarget)) ||
                                                      (branchChoice !== undefined && isEspionageEvent(handler) &&
                                                          !canPlayEspionageEvent(G, me!, handler, branchTarget)) ||
                                                      (handler === "untimelyDeath" && G.scenario !== "tutorial" && !canPlayUntimelyDeath(G, espionageTarget)) ||
                                                      (handler === "northernRising" && G.scenario !== "tutorial" && !canPlayNorthernRising(G)) ||
                                                      (isGrandVizier(def) && !canPlayGrandVizier(G, me!, ctx.numPlayers)) ||
                                                      (G.scenario === "tutorial" && !canPlayTutorialEvent(G, me!, id))}
                                                  onClick={() => {
                                                      playEventCard(moves.playCard, id, {
                                                          selected: branchChoice !== undefined ? branchTarget : espionageTargets.length > 0 ? espionageTarget : foreignWarPower !== undefined ? String(foreignArmySize) : holyLeagueOptions.length > 0 ? holyLeagueTarget : menendezOptions.length > 0 ? menendezTarget : polishElection ? polishElectionTargetValue(G, polishElectionBids) : armyMutiny ? armyMutinyTargetValue(G, armyMutinySelection) : stafford ? staffordTargetValue(G, staffordSelection) : germanRecruitment ? germanRecruitmentTargetValue(G, germanRecruitmentSelection, me === "hre") : targetOptions.length > 0 ? targetChoice : undefined,
                                                          // Every target is now picked from a selector.
                                                          typed: "",
                                                      });
                                                      setEventTarget("");
                                                      setHolyLeagueEventTarget("");
                                                      setMenendezEventTarget("");
                                                      setPolishElectionBids({});
                                                      setArmyMutinySelection({space: ""});
                                                      setStaffordSelection({power: ""});
                                                      setGermanRecruitmentSelection({space: ""});
                                                      setEventBranches([]);
                                                      setSelectedCard(undefined);
                                                  }}>
                    {def.kind === "home" ? i18n.chain.vq.board.useAbility : i18n.chain.vq.board.asEvent}
                </Button>}
                <Button size="small" variant="outlined" disabled={disabled || def.officialKind === "mandatory"}
                        onClick={() => {moves.playCard({cardId: id}); setSelectedCard(undefined);}}>{i18n.chain.vq.board.asCp}</Button>
            </Stack>
        </Paper>;
    };

    const actionPanel = () => {
        if (G.pendingEspionage) return <PendingEspionagePanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingAbjuration) return <PendingAbjurationPanel G={G} moves={moves} playerID={playerID}
            selectedPower={selectedAbjurationPower} onSelect={setSelectedAbjurationPower}/>;
        if (G.pendingCityRebels) return <PendingCityRebelsPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.gregorianResponse) return <PendingGregorianPanel G={G} moves={moves} playerID={playerID}
            target={gregorianTarget} onTargetChange={setGregorianTarget}/>;
        if (G.pendingCardEvent) return <PendingCardEventPanel G={G} moves={moves} playerID={playerID}
            numPlayers={ctx.numPlayers ?? 6}/>;
        if (G.pendingBeacon) return <PendingBeaconPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingInterceptionOrder) return <PendingInterceptionOrderPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingIntercept) return <PendingInterceptPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingAction) return <PendingActionResponsePanel G={G} moves={moves} playerID={playerID}
            responders={actionResponders} choices={myActionChoices} responder={actionResponder}
            onSelectResponder={(power) => setSelectedActionResponder(power)}/>;
        if (G.pendingPiracy) return <PendingPiracyPanel G={G} moves={moves} playerID={playerID}
            responder={piracyResponder as Power}/>;
        if (G.pendingTutorialEvent) return <PendingTutorialEventPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingBattle) return <PendingBattlePanel G={G} moves={moves} playerID={playerID} retrieve={vqCombatRetrieve}/>;
        if (G.pendingActivation) return <PendingActivationPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingRebelMove) {
            const pending = G.pendingRebelMove;
            const isResponder = ownerOf(G, pending.power) === playerID;
            const targets = landNeighbors(pending.space).map((n) => n.id);
            const locale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
            return <Stack spacing={1}>
                <Typography>{powerName(pending.power, locale)}: {i18n.chain.vq.board.rebelMove}</Typography>
                <Typography variant="body2">
                    {minorName(pending.minor, locale)} {i18n.chain.vq.board.rebelsIn} {placeLabel(pending.space)}
                </Typography>
                {isResponder && targets.map((id) =>
                    <Button key={id} onClick={() => moves.chooseRebelMove({to: id})}>
                        {i18n.chain.vq.board.moveTo} {placeLabel(id)}
                    </Button>)}
                {isResponder && <Button onClick={() => moves.chooseRebelMove({to: "decline"})}>
                    {i18n.chain.vq.board.declineRebelMove}
                </Button>}
            </Stack>;
        }
        if (me === undefined) {
            return <Typography variant="body2" color="text.secondary">{i18n.chain.vq.actionPanel.spectator}</Typography>;
        }
        if (phase === "cardDraw") {
            const powers = participatingPowers(G);
            const nextPhase = G.scenario === "tutorial" ? i18n.chain.vq.cardDraw.springPhase : i18n.chain.vq.cardDraw.diplomacyPhase;
            const winterLosses = (G.winterLossChoices ?? []).filter((entry) => entry.power === me);
            const winterNavalLosses = (G.winterNavalLossChoices ?? []).filter((entry) => entry.power === me);
            const unitNames: Record<keyof LandStack, string> = {regular: i18n.chain.vq.cardDraw.regular, merc: i18n.chain.vq.cardDraw.merc, cav: i18n.chain.vq.cardDraw.cav};
            const shipNames: Record<keyof NavalStack, string> = {galley: i18n.chain.vq.cardDraw.galley, galleon: i18n.chain.vq.cardDraw.galleon, racebuilt: i18n.chain.vq.cardDraw.racebuilt, corsair: i18n.chain.vq.cardDraw.corsair};
            return <Stack spacing={1}>
                <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.cardDrawPhase} · {i18n.chain.vq.cardDraw.turn} {G.year}</Typography>
                {(G.colonyRolls?.length ?? 0) > 0 && <Stack spacing={0.25} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.colonies}</Typography>
                    {(G.colonyRolls ?? []).map((entry) => <Typography key={entry.settlement} variant="caption">
                        {placeLabel(entry.settlement)} · {powerName(entry.power, vqLocale)} · {entry.total} · {i18n.chain.vq.cardDraw[entry.result === "eliminated" ? "colonyEliminated" : entry.result === "none" ? "colonyNone" : entry.result === "treasure" ? "colonyTreasure" : "colonyTreasureVp"]}
                    </Typography>)}
                </Stack>}
                {winterLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.winterLosses}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.cardDraw.winterLossesDesc}
                    </Typography>
                    {winterLosses.map((entry, index) => {
                        const stack = G.spaces[entry.space]?.land[me];
                        const choices = entry.confirmOnly ? [] : (["regular", "merc", "cav"] as const)
                            .filter((kind) => (stack?.[kind] ?? 0) >= entry.amount);
                        return <Stack key={`${entry.space}-${index}`} spacing={0.5}>
                            <Typography variant="body2">
                                {placeLabel(entry.space)} · {i18n.chain.vq.cardDraw.needLose} {entry.amount} {i18n.chain.vq.cardDraw.units}
                            </Typography>
                            {entry.confirmOnly && <Typography variant="caption" color="text.secondary">
                                {i18n.chain.vq.cardDraw.morisco}
                            </Typography>}
                            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                                {choices.map((kind) => <Button key={kind} size="small" variant="outlined"
                                    disabled={!myTurn}
                                    onClick={() => moves.chooseWinterLoss({space: entry.space, kind})}>
                                    {i18n.chain.vq.cardDraw.changeTo} {unitNames[kind]}
                                </Button>)}
                                <Button size="small" variant="outlined" disabled={!myTurn}
                                    onClick={() => moves.chooseWinterLoss({space: entry.space, kind: "auto"})}>
                                    {entry.confirmOnly ? i18n.chain.vq.cardDraw.confirmRemove : i18n.chain.vq.cardDraw.keepAuto}
                                </Button>
                            </Stack>
                        </Stack>;
                    })}
                </Stack>}
                {winterNavalLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.winterNavalLosses}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.cardDraw.winterNavalDesc}
                    </Typography>
                    {winterNavalLosses.map((entry, index) => (
                        <Stack key={`${entry.zone}-${index}`} spacing={0.5}>
                            <Typography variant="body2">
                                {seaZoneName(entry.zone, vqLocaleNow())} · {i18n.chain.vq.cardDraw.lost} {entry.amount} {i18n.chain.vq.cardDraw.ships}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                                {(Object.keys(shipNames) as (keyof NavalStack)[])
                                    .filter((kind) => entry.removed[kind] > 0)
                                    .map((kind) => <Button key={kind} size="small" variant="outlined"
                                        disabled={!myTurn}
                                        onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind})}>
                                        {i18n.chain.vq.cardDraw.confirm} {shipNames[kind]} ×{entry.removed[kind]}
                                    </Button>)}
                                <Button size="small" variant="outlined" disabled={!myTurn}
                                    onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind: "auto"})}>
                                    {i18n.chain.vq.cardDraw.keepAuto}
                                </Button>
                            </Stack>
                        </Stack>
                    ))}
                </Stack>}
                <Typography variant="body2" color={myTurn ? "primary" : "text.secondary"}>
                    {`${myTurn ? i18n.chain.vq.cardDraw.pleaseConfirm : i18n.chain.vq.cardDraw.waiting} P${Number(ctx.currentPlayer) + 1} · ${powerName(G.activePower, vqLocale)} ${i18n.chain.vq.cardDraw.completeDraw}${i18n.chain.vq.punct.openParen}${powers.indexOf(G.activePower) + 1}/${powers.length}${i18n.chain.vq.punct.closeParen}${i18n.chain.vq.punct.period}${!myTurn && switchToTab(G.activePower) !== undefined ? ` ${switchToTab(G.activePower)}` : ""}`}
                </Typography>
                {me !== "france" && me !== "protestant" ? null : G.seaCaptainsAvailable.map((id) => {
                    const captain = seaCaptainById(id);
                    if (captain === undefined || captain.turn > G.year) {
                        return null;
                    }
                    return <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                                   onClick={() => moves.claimSeaCaptain({captain: id})}>
                        {i18n.chain.vq.cardDraw.claimCaptain}: {seaCaptainName(captain, vqLocale)}
                    </Button>;
                })}
                <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                    {`${i18n.chain.vq.cardDraw.confirm}${vqLocale === "en" ? " " : ""}${powerName(G.activePower, vqLocale)}${vqLocale === "en" ? " " : ""}${i18n.chain.vq.cardDraw.drawDone}`}
                </Button>
                <ActionGroup title={i18n.chain.vq.cardDraw.rules}>
                <Typography variant="body2">{i18n.chain.vq.cardDraw.rule1}</Typography>
                <Typography variant="body2">{`${i18n.chain.vq.cardDraw.rule2a}${vqLocale === "en" ? " " : ""}${nextPhase}${i18n.chain.vq.cardDraw.rule2b}`}</Typography>
                {G.powers.ottoman.ruler === "suleiman" &&
                    <Typography variant="caption" color="text.secondary">{i18n.chain.vq.cardDraw.suleiman}</Typography>}
                <Typography variant="caption" color="text.secondary">{scenarioName(G.scenario, vqLocale)}</Typography>
                </ActionGroup>
            </Stack>;
        }
        if (phase === "action") {
            const patronageSetup = scenarioSetup(G.scenario, playerCount(G)).patronage;
            const vpAwards = patronageSetup.vpAwards.map((id) => PATRONAGE_VP_AWARD_BY_ID[id])
                .filter((award): award is PatronageVpAward => award !== undefined);
            const artistMarkersLeft = vpAwards.filter((award) => award.kind === "artist").length;
            const scientistMarkersLeft = vpAwards.filter((award) => award.kind === "scientist").length;
            const expeditionCaptainDef = seaCaptainById(expeditionCaptain);
            const expeditionBaseCost = expeditionCaptainDef?.expeditionCost ?? 1;
            const hasFreeColonist = expeditionCaptainDef?.freeColonist === true || ps?.scienceBonuses.includes("plantation");
            const expeditionCost = expeditionBaseCost + (expeditionHasColony && !hasFreeColonist ? 1 : 0);
            return <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                    <Typography variant="body2">{i18n.chain.vq.board.remainingCp}: <b>{cp}</b></Typography>
                    {ps !== undefined && (ps.jiltedCp ?? 0) > 0 && <Chip size="small" color="warning"
                        label={`${i18n.chain.vq.diplomacy.jiltedCp}: ${ps.jiltedCp}`}/>}
                    <Chip size="small" label={`${i18n.chain.vq.board.hand} ${hand.length}`}/>
                    {ps !== undefined && ps.cardPlayed && <Chip size="small" color="success" label={i18n.chain.vq.board.playedThisTurn}/>}
                </Stack>
                {hotseatWaitHint() !== undefined && <Typography variant="caption" color="text.secondary">{hotseatWaitHint()}</Typography>}
                {G.pendingNavalOrder !== undefined && G.pendingNavalOrder.attacker === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.board.chooseNavalTarget}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 0.5}}>
                        {G.pendingNavalOrder.enemies.map((enemy) => <Button key={enemy} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseNavalOrder({enemy})}>{powerName(enemy, vqLocale)}</Button>)}
                    </Stack>
                </Paper>}
                {G.pendingWithdraw !== undefined && G.pendingWithdraw.defender === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.board.defenderChoice}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {placeLabel(G.pendingWithdraw.space)} {i18n.chain.vq.board.withdrawOrField}{i18n.chain.vq.punct.period}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
                        <Button size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseWithdraw({withdraw: true})}>{i18n.chain.vq.board.retreatInto}</Button>
                        <Button size="small" variant="outlined" color="error" disabled={!myTurn}
                            onClick={() => moves.chooseWithdraw({withdraw: false})}>{i18n.chain.vq.board.fieldBattle}</Button>
                    </Stack>
                </Paper>}
                {G.pendingReliefSplit !== undefined && G.pendingReliefSplit.power === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.board.reliefFail}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {placeLabel(G.pendingReliefSplit.space)}{i18n.chain.vq.punct.colon}{i18n.chain.vq.board.maxKeep} {G.pendingReliefSplit.keepLimit} {i18n.chain.vq.board.unitsStay}{i18n.chain.vq.punct.period}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                        {Array.from({length: G.pendingReliefSplit.keepLimit + 1}, (_, i) => i).map((k) =>
                            <Button key={k} size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseReliefSplit({keep: k})}>{i18n.chain.vq.board.keep} {k} {i18n.chain.vq.board.pieces}</Button>)}
                    </Stack>
                </Paper>}
                {G.pendingContinue !== undefined && G.pendingContinue.power === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.board.retreatFortress}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.board.continueMarch}{i18n.chain.vq.punct.comma}{i18n.chain.vq.board.orReturn} {placeLabel(G.pendingContinue.origin)}{i18n.chain.vq.punct.period}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 0.5}}>
                        {landNeighbors(G.pendingContinue.space).filter((neighbor) => !neighbor.pass).map((neighbor) =>
                            <Button key={neighbor.id} size="small" variant="outlined" disabled={!myTurn || cp < 1}
                                onClick={() => moves.continueMove({to: neighbor.id})}>{placeLabel(neighbor.id)}</Button>)}
                        <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.stopContinue()}>{i18n.chain.vq.board.returnOrigin}</Button>
                    </Stack>
                </Paper>}
                {me === "spain" && G.armada !== undefined && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.board.armada} · {i18n.chain.vq.board.strength} {G.armada.strength}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.board.locatedAt} {placeLabel(G.armada.location)}{i18n.chain.vq.punct.semicolon}{i18n.chain.vq.board.armadaJoin}{i18n.chain.vq.punct.period}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                        <Button size="small" variant="outlined"
                            disabled={!myTurn || cp < 3 || G.armada.strength >= 8 || !["seville", "corunna", "lisbon"].includes(G.armada.location)}
                            onClick={() => moves.upgradeArmada()}>{i18n.chain.vq.board.upgradeArmada}</Button>
                        {G.spaces[G.armada.location] !== undefined && <Button size="small" variant="outlined"
                            disabled={!myTurn} onClick={() => moves.loadArmada()}>{i18n.chain.vq.board.loadArmy}</Button>}
                        {G.spaces[G.armada.location] !== undefined && G.armada.land !== undefined && <Button size="small" variant="outlined"
                            disabled={!myTurn} onClick={() => moves.unloadArmada()}>{i18n.chain.vq.board.unloadArmy}</Button>}
                    </Stack>
                    {G.armada.land !== undefined && <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.board.carrying}: {G.armada.land.regular} {i18n.chain.vq.board.regulars} / {G.armada.land.merc} {i18n.chain.vq.board.merc} / {G.armada.land.cav} {i18n.chain.vq.board.cav}{i18n.chain.vq.punct.openParen}{i18n.chain.vq.board.max} {G.armada.strength}{i18n.chain.vq.punct.closeParen}
                    </Typography>}
                    {G.seaZones[G.armada.location as keyof VQGame["seaZones"]] !== undefined &&
                        SPACES.filter((space) => (space.ports ?? []).some((zone) => zone === G.armada!.location) && G.spaces[space.id].control === "spain").map((space) =>
                        <Stack key={space.id} direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            <Button size="small" variant="outlined" disabled={!myTurn || cp < 1}
                                onClick={() => moves.armadaTransport({port: space.id, direction: "load"})}>{i18n.chain.vq.board.loadFrom} {placeLabel(space.id)}</Button>
                            <Button size="small" variant="outlined" disabled={!myTurn || cp < 1 || G.armada?.land === undefined}
                                onClick={() => moves.armadaTransport({port: space.id, direction: "unload"})}>{i18n.chain.vq.board.unloadTo} {placeLabel(space.id)}</Button>
                        </Stack>)}
                </Paper>}
                <div className="vq-action-picker" role="group" aria-label={i18n.chain.vq.shell.currentAction}>
                    <Button size="small" variant={mode === "inspect" ? "contained" : "outlined"}
                            onClick={() => {setMode("inspect"); setFrom(null); setTransportZones([]);}}>
                        {modeLabel("inspect")}
                    </Button>
                    {Object.entries(ACTION_BUTTON_GROUPS).map(([group, candidates]) => {
                        const visible = candidates.filter((candidate) =>
                            (candidate !== "recruitMerc" || me !== "ottoman") &&
                            (candidate !== "recruitCav" || me === "ottoman") &&
                            (candidate !== "rebellion" || me === "protestant") &&
                            (G.scenario !== "tutorial" || !["buildFortress", "buildRacebuilt", "rebellion"].includes(candidate)));
                        if (visible.length === 0) return null;
                        return <div key={group} className="vq-action-group">
                            <Typography variant="caption" className="vq-action-group-title">
                                {(i18n.chain.vq.action as unknown as Record<string, string>)[group] ?? group}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                                {visible.map((candidate) => {
                                    const reason = modeDisabledReason(candidate);
                                    const button = <Button size="small"
                                        variant={mode === candidate ? "contained" : "outlined"}
                                        disabled={reason !== undefined}
                                        onClick={() => {setMode(candidate); setFrom(null); setTransportZones([]);}}>
                                        {modeLabel(candidate)}
                                    </Button>;
                                    return reason === undefined ? <React.Fragment key={candidate}>{button}</React.Fragment>
                                        : <Tooltip key={candidate} title={reason}><span className="vq-tip">{button}</span></Tooltip>;
                                })}
                            </Stack>
                        </div>;
                    })}
                </div>
                {(mode === "moveLand" || mode === "navalTransport") && from && <Stack spacing={0.5}>
                    <Typography variant="caption">{i18n.chain.vq.board.moveHint}</Typography>
                    {mode === "navalTransport" && <>
                        <Typography variant="caption">{i18n.chain.vq.board.transportHint}</Typography>
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", alignItems: "center"}}>
                            {transportZones.map((zone, index) => <Chip key={zone} size="small"
                                label={`${index + 1}. ${seaZoneName(zone, vqLocaleNow())}`}
                                onDelete={() => setTransportZones(transportZones.filter((candidate) => candidate !== zone))}/>)}
                            {transportZones.length === 0 &&
                                <Typography variant="caption" color="text.secondary">{i18n.chain.vq.board.notSelected}</Typography>}
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            {transportCandidates.map((zone) => <Button key={zone.id} size="small" variant="outlined"
                                onClick={() => setTransportZones([...transportZones, zone.id])}>{seaZoneName(zone.id, vqLocaleNow())}</Button>)}
                            {transportZones.length > 0 && <Button size="small"
                                onClick={() => setTransportZones([])}>{i18n.chain.vq.actionUi.clear}</Button>}
                        </Stack>
                        <Typography variant="caption">{i18n.chain.vq.board.route}: {transportZones.map((zone) => seaZoneName(zone, vqLocaleNow())).join(" → ") || i18n.chain.vq.board.notSelected}</Typography>
                    </>}
                    {stackPicker(false)}
                </Stack>}
                {mode === "rebellion" && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-rebel">{i18n.chain.vq.board.rebelCp}</InputLabel>
                    <Select labelId="vq-rebel" label={i18n.chain.vq.board.rebelCp} value={rebelCp}
                            onChange={(e) => setRebelCp(Number(e.target.value))}>
                        {[2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                </FormControl>}
                <Typography variant="caption" color="text.secondary">
                    {mode === "inspect" ? i18n.chain.vq.actionUi.clickCityDetail : i18n.chain.vq.actionUi.clickTargetCity}
                    {from !== null ? ` ${i18n.chain.vq.actionUi.originSelected}${placeLabel(from)}` : ""}
                </Typography>
                <Stack direction="row" spacing={1}>
                    {!isDesktop && <Button size="small" variant="contained" onClick={() => setMobileView("map")}>{i18n.chain.vq.shell.goToMap}</Button>}
                    {from !== null && <Button size="small" onClick={() => setFrom(null)}>{i18n.chain.vq.actionUi.cancelOrigin}</Button>}
                </Stack>
                <Divider/>
                {/* Danger zone: pass is muted and pushed away from the primary end-impulse action. */}
                {myTurn && endImpulseBlocked && passBlockReason !== undefined &&
                    <Typography variant="caption" color="error" role="status">{passBlockReason}</Typography>}
                <div className="vq-turn-actions">
                    <Tooltip title={!myTurn ? i18n.chain.vq.turn.notYourTurn : passBlockReason ?? ""}>
                        <span>
                            <Button size="small" color="inherit" variant="text" className="vq-pass"
                                    disabled={!myTurn || passBlockCodes.length > 0}
                                    onClick={() => setConfirmAction("pass")}>{i18n.chain.vq.turn.pass}</Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={!myTurn ? i18n.chain.vq.turn.notYourTurn : endImpulseBlocked ? passBlockReason ?? "" : ""}>
                        <span>
                            <Button size="small" variant="contained" className="vq-end-impulse"
                                    disabled={!myTurn || endImpulseBlocked}
                                    onClick={() => setConfirmAction("endImpulse")}>{i18n.chain.vq.turn.endImpulse}</Button>
                        </span>
                    </Tooltip>
                </div>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 1}}>
                    {myTurn && me === "france" && G.powers.france.cards.includes("vq-089") &&
                        G.royals.some((royal) => royal.id === "maryScots" && royal.alive) &&
                        <Button size="small" variant="outlined" onClick={() => (moves as unknown as {maryInfluence: () => void}).maryInfluence()}>
                            {i18n.chain.vq.actionUi.maryInfluence}
                        </Button>}
                    {myTurn && G.powers[me].cards.includes("vq-011") && G.dragutFought === true &&
                        <Button size="small" variant="outlined" onClick={() => (moves as unknown as {dragutFallsRoll: () => void}).dragutFallsRoll()}>
                            {i18n.chain.vq.actionUi.dragutFallsRoll}
                        </Button>}
                    {G.powers[me].cards.includes("vq-102") && G.espionage?.walsingham !== undefined &&
                        <Button size="small" variant="outlined" onClick={() => (moves as unknown as {cancelWalsingham: () => void}).cancelWalsingham()}>
                            {i18n.chain.vq.actionUi.staffordCancel}
                        </Button>}
                </Stack>
                <Divider/>
                {G.foreignWars[me]?.status === "setup" && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.actionUi.foreignWarSetup} · {G.foreignWars[me]?.enemy}</Typography>
                    <Typography variant="caption" color="text.secondary">{i18n.chain.vq.actionUi.foreignWarSetupHint}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", my: 0.5}}>
                        {foreignWarUnits.map((unit, index) => <Chip key={`${unit.space}-${unit.kind}-${index}`} size="small"
                            label={`${placeLabel(unit.space)} ${unitLabel(unit.kind)}`} onDelete={() => setForeignWarUnits((old) => old.filter((_, i) => i !== index))}/>)}
                        {foreignWarUnits.length > 0 && <Button size="small" onClick={() => setForeignWarUnits([])}>{i18n.chain.vq.actionUi.clear}</Button>}
                    </Stack>
                    {Object.entries(G.spaces).filter(([, state]) => state.siege === undefined && landCount(state.land[me]) > 0).map(([spaceId, state]) => <Stack key={spaceId} direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                        <Typography variant="caption" sx={{minWidth: 80}}>{placeLabel(spaceId)}</Typography>
                        {(["regular", "merc", "cav"] as const).filter((kind) => (state.land[me]?.[kind] ?? 0) > 0).map((kind) => {
                            const picked = foreignWarUnits.filter((unit) => unit.space === spaceId && unit.kind === kind).length;
                            return <Button key={kind} size="small" variant="outlined" disabled={foreignWarUnits.length >= 8 || picked >= (state.land[me]?.[kind] ?? 0)}
                                onClick={() => setForeignWarUnits((old) => [...old, {space: spaceId, kind}])}>+ {unitLabel(kind)} ({(state.land[me]?.[kind] ?? 0) - picked})</Button>;
                        })}
                    </Stack>)}
                    <FormControl size="small" fullWidth sx={{mt: 0.5}}>
                        <InputLabel id="vq-foreign-war-leader">{i18n.chain.vq.actionUi.leaderOptional}</InputLabel>
                        <Select labelId="vq-foreign-war-leader" label={i18n.chain.vq.actionUi.leaderOptional} value={foreignWarLeader}
                                onChange={(e) => setForeignWarLeader(e.target.value)}>
                            <MenuItem value="">{i18n.chain.vq.actionUi.noLeader}</MenuItem>
                            {Object.values(G.leaders).filter((leader) => LEADER_BY_ID[leader.id]?.power === me && LEADER_BY_ID[leader.id]?.kind === "army" &&
                                Object.values(G.spaces).some((state) => state.leaders.includes(leader.id))).map((leader) =>
                                <MenuItem key={leader.id} value={leader.id}>{leaderLabel(leader.id)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="contained" sx={{mt: 0.5}} disabled={(!myTurn && G.pendingForeignWar?.power !== me) || foreignWarUnits.length < 3 || foreignWarUnits.length > 8}
                            onClick={() => moves.commitForeignWarForce({units: foreignWarUnits, ...(foreignWarLeader ? {leaderId: foreignWarLeader} : {})})}>{i18n.chain.vq.actionUi.commitForce}</Button>
                </Paper>}
                {G.foreignWars[me]?.status === "active" && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.actionUi.foreignWarActive} · {G.foreignWars[me]?.enemy}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.actionUi.ourSide} {landCount(G.foreignWars[me]!.units)} {i18n.chain.vq.actionUi.men} · {i18n.chain.vq.actionUi.enemySide} {G.foreignWars[me]!.enemyUnits} {i18n.chain.vq.actionUi.men}
                        {G.foreignWars[me]!.leaderId ? ` · ${i18n.chain.vq.actionUi.leader} ${leaderLabel(G.foreignWars[me]!.leaderId!)}` : ""}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 0.5}}>
                        <Button size="small" variant="contained" disabled={!myTurn || cp < 1 || landCount(G.foreignWars[me]!.units) === 0}
                                onClick={() => moves.fightForeignWar()}>{i18n.chain.vq.actionUi.fight}</Button>
                        {(["regular", "merc", "cav"] as const).filter((kind) => kind !== "cav" || me === "ottoman").filter((kind) => kind !== "merc" || me !== "ottoman").map((kind) =>
                            <Button key={kind} size="small" variant="outlined" disabled={!myTurn || cp < (kind === "regular" ? 2 : 1) || landCount(G.foreignWars[me]!.units) >= 8}
                                    onClick={() => moves.reinforceForeignWar({kind})}>{i18n.chain.vq.actionUi.reinforce} {unitLabel(kind)} ({kind === "regular" ? 2 : 1} CP)</Button>)}
                    </Stack>
                </Paper>}
                <Divider/>
                {G.scenario !== "tutorial" && <ActionGroup title={i18n.chain.vq.actionUi.religionActions}>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {religionActions(me).map((a) => <Button key={a.label} size="small" variant="outlined"
                                                             disabled={!myTurn || cp < 2}
                                                             onClick={() => a.run()}>{a.label}</Button>)}
                </Stack>
                <Divider/>
                </ActionGroup>}
                <ActionGroup title={i18n.chain.vq.empire.minorInfluenceDiplomacy}>
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.empire.minorInfluenceNote}
                </Typography>
                <Stack spacing={0.5}>
                    {MINOR_POWERS.filter((minor) => G.scenario !== "tutorial" || ["papacy", "venice"].includes(minor)).map((minor) => {
                        const influence = ps?.influence[minor] ?? 0;
                        const ally = POWERS.find((candidate) => G.powers[candidate].alliedMinors.includes(minor));
                        const resolved = G.minorDiplomacyResolved.includes(minor);
                        const eligible = (MINOR_DIPLOMACY[minor].eligible.includes(me) || (G.scenario === "tutorial" && minor === "papacy" && me === "ottoman")) &&
                            !G.minorInfluenceBlocked[me].includes(minor);
                        return <Stack key={minor} direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                            <Typography variant="caption" sx={{minWidth: 78}}>
                                {minorName(minor, vqLocale)} {ally ? `· ${powerName(ally, vqLocale)}${i18n.chain.vq.empire.minorAlly}` : `· ${i18n.chain.vq.intel.unactivated}`}
                            </Typography>
                            <Chip size="small" variant="outlined" label={`${i18n.chain.vq.empire.influence} ${influence}`} />
                            <Button size="small" variant="outlined"
                                    disabled={!myTurn || cp < 1 || !eligible || resolved || influence >= 9}
                                    onClick={() => moves.influence({target: minor})}>+1 {i18n.chain.vq.empire.influence}</Button>
                            {resolved && <Chip size="small" color="success" label={i18n.chain.vq.empire.resolvedThisTurn}/>}
                        </Stack>;
                    })}
                    {G.majorInfluence && (["ottoman", "hre"] as Power[]).filter((target) => G.majorInfluence![target]?.[me] !== undefined)
                        .map((target) => <Stack key={target} direction="row" spacing={0.5}>
                            <Typography variant="caption">{powerName(target, vqLocale)} · {i18n.chain.vq.empire.influence} {G.majorInfluence![target]![me]}</Typography>
                            <Button size="small" disabled={!myTurn || cp < 1 || G.majorDiplomacyResolved?.includes(target)}
                                onClick={() => moves.influence({target})}>+1 {i18n.chain.vq.empire.influence}</Button>
                        </Stack>)}
                </Stack>
                <Divider/>
                </ActionGroup>
                {G.scenario !== "tutorial" && !isActivatedMajor(G, me) && <><ActionGroup title={i18n.chain.vq.empire.espionageTable}>
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.empire.espionageNote}
                </Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-espionage-target">{i18n.chain.vq.board.targetPower}</InputLabel>
                    <Select labelId="vq-espionage-target" label={i18n.chain.vq.board.targetPower} value={espionageTarget}
                            onChange={(e) => setEspionageTarget(e.target.value as Power)}>
                        {POWERS.filter((p) => p !== me && !isActivatedMajor(G, p)).map((p) => <MenuItem key={p} value={p}>{powerName(p, vqLocale)}</MenuItem>)}
                    </Select>
                </FormControl>
                <Select size="small" value={informantSource} onChange={(e) => setInformantSource(e.target.value)} displayEmpty>
                    <MenuItem value="">{i18n.chain.vq.empire.spyFromPool}</MenuItem>
                    {G.informants.filter((i) => i.owner === me && !i.neutralized).map((i) =>
                        <MenuItem key={i.target} value={i.target}>{i18n.chain.vq.empire.moveSpyAt}{powerName(i.target, vqLocale)}{i18n.chain.vq.empire.moveSpySuffix}</MenuItem>)}
                </Select>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || espionageTarget === me ||
                        G.informants.some((i) => i.owner === me && i.target === espionageTarget) ||
                        (informantSource === "" && G.informants.filter((i) => i.owner === me).length >= 2)}
                            onClick={() => moves.plantInformant({target: espionageTarget, ...(informantSource ? {fromTarget: informantSource} : {})})}>{i18n.chain.vq.empire.deploySpy}</Button>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || espionageTarget === me}
                            onClick={() => moves.gainIntelligence({target: espionageTarget})}>{i18n.chain.vq.empire.gainIntelligence}</Button>
                </Stack>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-assassination-target">{i18n.chain.vq.empire.assassinationTarget}</InputLabel>
                    <Select labelId="vq-assassination-target" label={i18n.chain.vq.empire.assassinationTarget} value={assassinationTarget}
                            onChange={(e) => setAssassinationTarget(e.target.value)}>
                        <MenuItem value="elizabeth" disabled={!assassinationTargets(G, me).includes("elizabeth")}>{i18n.chain.vq.empire.targetElizabeth}</MenuItem>
                        {assassinationTargets(G, me).includes("rudolf") && <MenuItem value="rudolf">{i18n.chain.vq.empire.targetRudolf}</MenuItem>}
                        {assassinationTargets(G, me).filter((id) => id !== "elizabeth" && id !== "rudolf").map((id) =>
                            <MenuItem key={id} value={id}>{leaderLabel(id)} ({powerName(LEADER_BY_ID[id].power, vqLocale)})</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
                    <Select size="small" value={assassinationCp} onChange={(e) => setAssassinationCp(Number(e.target.value))}>
                        {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < assassinationCp || G.year < 3 || G.assassinationUsed.includes(me) ||
                        !assassinationTargets(G, me).includes(assassinationTarget)}
                            onClick={() => moves.assassinate({target: assassinationTarget, cp: assassinationCp})}>{i18n.chain.vq.empire.attemptAssassination}</Button>
                </Stack>
                {me === "spain" && <>
                    <Typography variant="caption">{i18n.chain.vq.empire.jesuitsOnCard} {G.espionage?.jesuitsOnCard ?? 0} / {i18n.chain.vq.empire.england} {G.espionage?.jesuits.length ?? 0} / {i18n.chain.vq.empire.jesuitsCapNote}</Typography>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || (G.espionage?.jesuitsOnCard ?? 0) < 1 ||
                        spaceDef?.area !== "england" || G.espionage?.jesuits.includes(selected!)}
                        onClick={() => moves.plantInformant({space: selected})}>{i18n.chain.vq.empire.deployJesuitTo} {spaceDef?.area === "england" ? placeLabel(spaceDef.id) : i18n.chain.vq.empire.selectedRegion} (2 CP)</Button>
                    <Stack direction="row" spacing={0.5}>
                        <Select size="small" value={catholicRebellionCp} onChange={(e) => setCatholicRebellionCp(Number(e.target.value))}>
                            {[3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                        </Select>
                        <Button size="small" variant="outlined" disabled={!canAct || cp < catholicRebellionCp || G.year < 3 ||
                            G.assassinationUsed.includes("spain") || G.powers.spain.allies.includes("england")}
                            onClick={() => moves.englishCatholicRebellion({cp: catholicRebellionCp})}>{i18n.chain.vq.empire.englishCatholicRebellion}</Button>
                    </Stack>
                </>}
                {G.informants.map((i) => <Typography key={`${i.owner}:${i.target}`} variant="caption">
                    {powerName(i.owner, vqLocale)} → {powerName(i.target, vqLocale)}{i18n.chain.vq.empire.informantSep}{i.neutralized ? i18n.chain.vq.empire.informantNeutralized : i.plantedImpulse < G.impulse ? i18n.chain.vq.empire.informantActive : i18n.chain.vq.empire.informantPending}
                </Typography>)}
                <Divider/>
                </ActionGroup>
                <ActionGroup title={i18n.chain.vq.worldUi.title}>
                <Typography variant="caption" color="text.secondary">{i18n.chain.vq.worldUi.intro}</Typography>
                <Stack spacing={0.5}>
                    {WORLD_SEA_ZONES.map((zone) => {
                        const here = Object.entries(G.worldCaptains).filter(([, ex]) => ex.location === zone.id);
                        return <Paper key={zone.id} variant="outlined" sx={{p: 0.5}}>
                            <Typography variant="caption" sx={{fontWeight: 700}}>{dataName(zone)}{i18n.getLocaleName() === "en" ? "" : ` (${zone.nameEn})`}</Typography>
                            {here.map(([id, ex]) => <Typography key={id} variant="caption" sx={{display: "block"}}>
                                {seaCaptainName(seaCaptainById(id), vqLocale) || id} · {powerName(ex.power, vqLocale)}{ex.damaged ? " · " + i18n.chain.vq.worldUi.damaged : ""}{ex.colony ? " · " + i18n.chain.vq.worldUi.carryingColony : ""}
                            </Typography>)}
                            {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id).map((s) => <Typography key={s.id} variant="caption" sx={{display: "block"}}>
                                {dataName(s)}: {G.worldControls[s.id] === undefined ? i18n.chain.vq.worldUi.vacant : `${powerName(G.worldControls[s.id]!, vqLocale)} ${i18n.chain.vq.worldUi.controls}`}
                                {G.worldFortresses?.[s.id] !== undefined ? ` · ${powerName(G.worldFortresses[s.id]!, vqLocale)} ${i18n.chain.vq.worldUi.fortress}` : ""}
                            </Typography>)}
                            {(G.worldPatrols?.[zone.id] ?? 0) > 0 && <Typography variant="caption" sx={{display: "block"}}>{i18n.chain.vq.worldUi.spanishPatrols}: {G.worldPatrols?.[zone.id]}</Typography>}
                            {me === "spain" && WORLD_SETTLEMENTS.some((s) => s.seaZone === zone.id &&
                                (G.worldControls[s.id] === "spain" || G.worldColonies[s.id] === "spain")) &&
                                <Button size="small" variant="outlined" disabled={!myTurn || cp < 2}
                                    onClick={() => moves.buildPatrol({zone: zone.id})}>{i18n.chain.vq.worldUi.buildPatrol}</Button>}
                            {me === "spain" && WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id &&
                                (G.worldControls[s.id] === "spain" || G.worldColonies[s.id] === "spain") &&
                                G.worldFortresses?.[s.id] === undefined).map((s) =>
                                <Button key={`fort-${s.id}`} size="small" variant="outlined" disabled={!myTurn || cp < 2 || (G.worldFortressesBuilt ?? 0) >= 2}
                                    onClick={() => moves.buildWorldFortress({settlement: s.id})}>{dataName(s)} · {i18n.chain.vq.worldUi.buildFortress}</Button>)}
                            {here.filter(([, ex]) => ex.power === me).map(([id]) => <Stack key={id} direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                                {zone.adjacent.map((next) => <Button key={next} size="small" variant="text" disabled={!myTurn || (cp < 1 && !Object.values(G.worldCaptains).some((ex) => ex.power === me && ex.movedImpulse === G.impulse)) || G.worldCaptains[id].movedImpulse === G.impulse}
                                    onClick={() => moves.moveExpedition({captain: id, zone: next})}>{i18n.chain.vq.worldUi.sailTo} {dataName(WORLD_SEA_ZONES.find((z) => z.id === next))}</Button>)}
                                {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id && s.id !== "philippines" && G.worldControls[s.id] === undefined && G.worldCaptains[id].colony).map((s) =>
                                    <Button key={s.id} size="small" variant="text" disabled={!myTurn || cp < 1}
                                        onClick={() => moves.settleColony({captain: id, settlement: s.id})}>{dataName(s)} · {i18n.chain.vq.worldUi.foundColony}</Button>)}
                                {me !== "spain" && <Button size="small" variant="outlined" disabled={!myTurn || cp < 2}
                                    onClick={() => moves.worldPiracy({captain: id})}>{i18n.chain.vq.worldUi.worldPiracy}</Button>}
                            </Stack>)}
                        </Paper>;
                    })}
                </Stack>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-expedition-captain">{i18n.chain.vq.worldUi.expeditionCaptain}</InputLabel>
                    <Select labelId="vq-expedition-captain" label={i18n.chain.vq.worldUi.expeditionCaptain} value={expeditionCaptain}
                            onChange={(e) => setExpeditionCaptain(e.target.value)}>
                        {ps?.seaCaptains.filter((id) => (seaCaptainById(id)?.turn ?? 99) <= G.year && G.worldCaptains[id] === undefined).map((id) =>
                            <MenuItem key={id} value={id}>{seaCaptainName(seaCaptainById(id), vqLocale) || id}</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < expeditionCost || expeditionCaptain === "" ||
                        (expeditionHasColony && (me === "hre" || (me === "ottoman" && !G.suezDone)))}
                            onClick={() => moves.buildExpedition({captain: expeditionCaptain, colony: expeditionHasColony})}>
                        {i18n.chain.vq.worldUi.buildExpedition} ({expeditionCost} CP)
                    </Button>
                    <Button size="small" variant={expeditionHasColony ? "contained" : "outlined"}
                            disabled={me === "hre" || (me === "ottoman" && !G.suezDone)}
                            onClick={() => setExpeditionHasColony(!expeditionHasColony)}>{i18n.chain.vq.worldUi.carryColony}</Button>
                </Stack>
                <Divider/>
                </ActionGroup>
                <ActionGroup title={i18n.chain.vq.worldUi.patronageTitle}>
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.worldUi.markersLeft}: {i18n.chain.vq.worldUi.artist} {artistMarkersLeft}{i18n.chain.vq.worldUi.markerCount}, {i18n.chain.vq.worldUi.scientist} {scientistMarkersLeft}{i18n.chain.vq.worldUi.markerCount} ({i18n.chain.vq.worldUi.markersTotal} {vpAwards.length}{i18n.chain.vq.worldUi.markerCount})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.worldUi.artistAwards}: {patronageAwardSummary(vpAwards, "artist")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.worldUi.scientistAwards}: {patronageAwardSummary(vpAwards, "scientist")}
                </Typography>
                {patronageSetup.unavailableVpAwards?.map((id) => {
                    const award = PATRONAGE_VP_AWARD_BY_ID[id];
                    return award === undefined ? null : <Typography key={id} variant="caption" color="text.secondary">
                        {i18n.chain.vq.worldUi.removedInScenario}: {award.nameEn} ({award.vp} VP{award.artistType ? ` · ${award.artistType}` : ""})
                    </Typography>;
                })}
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-patron-cp">{i18n.chain.vq.worldUi.investCp}</InputLabel>
                    <Select labelId="vq-patron-cp" label={i18n.chain.vq.worldUi.investCp} value={patronageCp}
                            onChange={(e) => setPatronageCp(Number(e.target.value))}>
                        {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {G.patronsAvailable.map((id) => patronDef(id)).filter((p): p is NonNullable<typeof p> => p !== undefined && p.region === me && !POWERS.some((x) => G.powers[x].patrons.includes(p.id))).map((p) =>
                        <Button key={p.id} size="small" variant="outlined"
                                disabled={!myTurn || cp < patronageCp || G.patronizedThisTurn.includes(`${me}:${p.kind}`)}
                                onClick={() => moves.patronize({patron: p.id, cp: patronageCp})}>
                            {patronLabel(p)}{p.rating === null ? ` (${i18n.chain.vq.worldUi.ratingPending})` : ` (${i18n.chain.vq.worldUi.rating} ${p.rating})`}{p.kind === "scientist" ? ` · ${i18n.chain.vq.worldUi.scientist}` : ""}
                        </Button>)}
                </Stack>
                </ActionGroup></>}
                {ps !== undefined && ps.seaCaptains.length > 0 && <>
                    <Divider/>
                    <Typography variant="subtitle2">{i18n.chain.vq.worldUi.seaCaptains}</Typography>
                    {ps.seaCaptains.map((id) => {
                        const captain = seaCaptainById(id);
                        return <Typography key={id} variant="caption">{seaCaptainName(captain, vqLocale) || id}{i18n.chain.vq.punct.colon}{captain === undefined ? "" : (vqLocale === "en" ? captain.bonus : (captain.bonusZh ?? captain.bonus))}</Typography>;
                    })}
                </>}
                {ps !== undefined && ps.scienceBonuses.length > 0 && <>
                    <Typography variant="subtitle2">{i18n.chain.vq.worldUi.scienceBonusesEarned}</Typography>
                    {ps.scienceBonuses.map((id) => {
                        const bonus = scienceBonusById(id);
                        return <Typography key={id} variant="caption">{dataName(bonus) || id}{i18n.chain.vq.punct.colon}{bonus?.description}</Typography>;
                    })}
                </>}
                <Divider/>
                <ActionGroup title={i18n.chain.vq.worldUi.piracyTitle}>
                <Stack spacing={0.5}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-pirate-zone">{i18n.chain.vq.worldUi.seaZone}</InputLabel>
                        <Select labelId="vq-pirate-zone" label={i18n.chain.vq.worldUi.seaZone} value={piracyZone}
                                onChange={(e) => setPiracyZone(e.target.value)}>
                            {Object.keys(G.seaZones).filter((z) => G.seaZones[z as keyof VQGame["seaZones"]].naval[me] !== undefined)
                                .map((z) => <MenuItem key={z} value={z}>{seaZoneName(z, vqLocaleNow())}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-pirate-target">{i18n.chain.vq.worldUi.target}</InputLabel>
                        <Select labelId="vq-pirate-target" label={i18n.chain.vq.worldUi.target} value={piracyTarget}
                                onChange={(e) => setPiracyTarget(e.target.value)}>
                            {POWERS.filter((p) => p !== me).map((p) => <MenuItem key={p} value={p}>{powerName(p, vqLocale)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < 1 || piracyZone === "" || piracyTarget === ""}
                            onClick={() => moves.piracy({zone: piracyZone, target: piracyTarget})}>{i18n.chain.vq.worldUi.launchPiracy}</Button>
                </Stack>
                </ActionGroup>
            </Stack>;
        }
        if (phase === "diplomacy") {
            const handCp = hand.reduce((n, id) => n + cardById(id).cp, 0);
            const betrothal = betrothalChoices(G, me, domesticRoyal, foreignRoyal);
            const warState = me !== undefined ? diplomacyActionState(G, me, diploTargetValue, "declareWar") : undefined;
            const peaceState = me !== undefined ? diplomacyActionState(G, me, diploTargetValue, "makePeace") : undefined;
            const allianceState = me !== undefined ? diplomacyActionState(G, me, diploTargetValue, "formAlliance") : undefined;
            const diplomacyReasons = [...new Set([
                warState?.ok === false && warState.reason !== "alreadyAtWar" ? warState.reason : undefined,
                peaceState?.ok === false && peaceState.reason !== "notAtWar" ? peaceState.reason : undefined,
                allianceState?.ok === false && allianceState.reason !== "alreadyAtWar" ? allianceState.reason : undefined,
            ].filter((reason): reason is NonNullable<typeof reason> => reason !== undefined)
                .map((reason) => diplomacyBlockText(reason, i18n.chain.vq.diplomacy.blocks)))];
            const actionTitle = (state: {ok: boolean; reason?: Parameters<typeof diplomacyBlockText>[0]} | undefined): string => {
                if (!myTurn) return i18n.chain.vq.turn.notYourTurn;
                if (state === undefined || state.ok || state.reason === undefined) return "";
                return diplomacyBlockText(state.reason, i18n.chain.vq.diplomacy.blocks);
            };
            const cardGift = me !== undefined ? giftState(G, me, diploTargetValue, "cards") : undefined;
            const mercGift = me !== undefined ? giftState(G, me, diploTargetValue, "mercenaries", selected) : undefined;
            const treasureGift = me !== undefined ? giftState(G, me, diploTargetValue, "treasures") : undefined;
            const giftReason = (state: {ok: boolean; reason?: keyof typeof i18n.chain.vq.diplomacy.giftBlocks} | undefined): string => {
                if (!myTurn) return i18n.chain.vq.turn.notYourTurn;
                if (state === undefined || state.ok || state.reason === undefined) return "";
                return i18n.chain.vq.diplomacy.giftBlocks[state.reason];
            };
            const giftNotice = [...new Set([cardGift, mercGift, treasureGift]
                .filter((state): state is {ok: false; reason: "limit" | "reciprocal" | "ottomanMercs"} =>
                    state?.ok === false && (state.reason === "limit" || state.reason === "reciprocal" || state.reason === "ottomanMercs"))
                .map((state) => i18n.chain.vq.diplomacy.giftBlocks[state.reason]))];
            return <Stack spacing={1}>
                <Typography variant="subtitle2">{i18n.chain.vq.diplomacy.title}</Typography>
                {hotseatWaitHint() !== undefined && <Typography variant="body2" color="text.secondary">{hotseatWaitHint()}</Typography>}
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.diplomacy.handCp}: {handCp} · {i18n.chain.vq.diplomacy.handCpNote}
                </Typography>
                {G.pendingCatholicLeague !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.diplomacy.leagueTitle}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.diplomacy.leagueRemaining} {G.pendingCatholicLeague.remaining} {i18n.chain.vq.diplomacy.leagueRemainingNote}
                    </Typography>
                    {me === "spain" ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {catholicLeagueSpaceOptions(G).map((id) => <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseCatholicLeagueSpace({space: id})}>{placeLabel(id)}</Button>)}
                    </Stack> : <Typography variant="body2" color="text.secondary">{i18n.chain.vq.diplomacy.waitingSpain}</Typography>}
                </Stack>}
                {G.pendingHreReplacement !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.diplomacy.hreTitle}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.diplomacy.hreDesc}
                    </Typography>
                    {playerID !== null && ownerOf(G, "hre") === playerID ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canRegular}
                            onClick={() => moves.chooseHreReplacement({choice: "regular"})}>{i18n.chain.vq.diplomacy.viennaRegular}</Button>
                        <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMercs}
                            onClick={() => moves.chooseHreReplacement({choice: "mercs"})}>{i18n.chain.vq.diplomacy.viennaMercs}</Button>
                        <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMarker || G.mercenariesForHire !== 0}
                            onClick={() => moves.chooseHreReplacement({choice: "marker"})}>{i18n.chain.vq.diplomacy.mercMarket}</Button>
                    </Stack> : <Typography variant="body2" color="text.secondary">{i18n.chain.vq.diplomacy.waitingHre}{G.activePower === "hre" && switchToTab("hre") !== undefined ? ` · ${switchToTab("hre")}` : ""}</Typography>}
                </Stack>}
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-diplo">{i18n.chain.vq.diplomacy.targetPower}</InputLabel>
                    <Select labelId="vq-diplo" label={i18n.chain.vq.diplomacy.targetPower} value={diploTargetValue}
                            disabled={!myTurn}
                            onChange={(e) => setDiploTarget(e.target.value as Power)}>
                        {POWERS.filter((p) => p !== me).map((p) => <MenuItem key={p} value={p}>{powerName(p, vqLocale)}</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Tooltip title={actionTitle(warState)}>
                        <span>
                            <Button size="small" variant="outlined" disabled={!myTurn || warState?.ok === false}
                                    onClick={() => moves.declareWar({target: diploTargetValue})}>
                                {i18n.chain.vq.diplomacy.declareWar} ({warCost(G, me, diploTargetValue)} CP)
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={actionTitle(peaceState)}>
                        <span>
                            <Button size="small" variant="outlined" disabled={!myTurn || peaceState?.ok === false}
                                    onClick={() => moves.makePeace({target: diploTargetValue})}>{i18n.chain.vq.diplomacy.makePeace}</Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={actionTitle(allianceState)}>
                        <span>
                            <Button size="small" variant="outlined" disabled={!myTurn || allianceState?.ok === false}
                                    onClick={() => moves.formAlliance({target: diploTargetValue})}>{i18n.chain.vq.diplomacy.alliance}</Button>
                        </span>
                    </Tooltip>
                </Stack>
                {myTurn && diplomacyReasons.length > 0 && <Typography variant="caption" color="text.secondary" role="status">
                    {diplomacyReasons.join(" · ")}
                </Typography>}
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.diplomacy.note}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Tooltip title={giftReason(cardGift)}>
                        <span>
                            <Button size="small" variant="outlined" disabled={!myTurn || cardGift?.ok === false}
                                onClick={() => moves.giveRandomCard({target: diploTargetValue})}>{i18n.chain.vq.diplomacy.randomGift}</Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={giftReason(mercGift)}>
                        <span>
                            <Button size="small" variant="outlined" disabled={!myTurn || selected === undefined || mercGift?.ok === false}
                                onClick={() => selected !== null && moves.giveMercenary({target: diploTargetValue, space: selected})}>{i18n.chain.vq.diplomacy.giftMerc}</Button>
                        </span>
                    </Tooltip>
                    <Button size="small" variant="outlined" disabled={!myTurn || selected === undefined ||
                        G.spaces[selected]?.control !== me}
                        onClick={() => selected !== undefined && (moves as unknown as {yieldSpace: (args: {target: Power; space: string}) => void}).yieldSpace({target: diploTargetValue, space: selected})}>{i18n.chain.vq.diplomacy.yieldSpace}</Button>
                </Stack>
                {myTurn && giftNotice.length > 0 && <Typography variant="caption" color="text.secondary" role="status">
                    {giftNotice.join(" · ")}
                </Typography>}
                {Object.keys(G.leaders).filter((id) => G.leaders[id].location === "captured" &&
                    (G.leaders[id].capturedBy === undefined || G.leaders[id].capturedBy === me)).length > 0 && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{i18n.chain.vq.diplomacy.returnLeader}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {Object.keys(G.leaders).filter((id) => G.leaders[id].location === "captured" &&
                            (G.leaders[id].capturedBy === undefined || G.leaders[id].capturedBy === me)).map((id) =>
                            <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => (moves as unknown as {returnCapturedLeader: (args: {leaderId: string}) => void}).returnCapturedLeader({leaderId: id})}>
                                {leaderLabel(id)}
                            </Button>)}
                    </Stack>
                </Stack>}
                {ps !== undefined && ps.treasures.length > 0 && <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
                    <Tooltip title={giftReason(treasureGift)}>
                        <span>
                            <Button size="small" variant="outlined" disabled={!myTurn || treasureGift?.ok === false}
                                onClick={() => moves.giveTreasure({target: diploTargetValue})}>
                                {i18n.chain.vq.diplomacy.giftTreasure} {powerName(diploTargetValue, vqLocale)}
                            </Button>
                        </span>
                    </Tooltip>
                    <Typography variant="caption" color="text.secondary">{i18n.chain.vq.diplomacy.randomTreasure}</Typography>
                </Stack>}
                {G.powers[me].allies.includes(diploTargetValue) && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{i18n.chain.vq.diplomacy.navalLoan}</Typography>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-loan-from">{i18n.chain.vq.diplomacy.loanFrom}</InputLabel>
                        <Select labelId="vq-loan-from" label={i18n.chain.vq.diplomacy.loanFrom} value={loanFromPort}
                                onChange={(e) => setLoanFromPort(e.target.value)}>
                            {SPACES.filter((space) => space.control === me && (space.ports?.length ?? 0) > 0)
                                .map((space) => <MenuItem key={space.id} value={space.id}>{placeLabel(space.id)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-loan-to">{i18n.chain.vq.diplomacy.loanTo}</InputLabel>
                        <Select labelId="vq-loan-to" label={i18n.chain.vq.diplomacy.loanTo} value={loanToPort}
                                onChange={(e) => setLoanToPort(e.target.value)}>
                            {SPACES.filter((space) => space.control === diploTargetValue && (space.ports?.length ?? 0) > 0)
                                .map((space) => <MenuItem key={space.id} value={space.id}>{placeLabel(space.id)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-loan-leader">{i18n.chain.vq.diplomacy.loanLeader}</InputLabel>
                        <Select labelId="vq-loan-leader" label={i18n.chain.vq.diplomacy.loanLeader} value={loanLeader}
                                onChange={(e) => setLoanLeader(e.target.value)}>
                            <MenuItem value="">{i18n.chain.vq.diplomacy.noLeader}</MenuItem>
                            {(G.spaces[loanFromPort]?.leaders ?? []).filter((id) => LEADER_BY_ID[id]?.kind === "naval" &&
                                LEADER_BY_ID[id]?.power === me).map((id) =>
                                <MenuItem key={id} value={id}>{leaderLabel(id)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {(["galley", "galleon", "racebuilt"] as const).map((kind) =>
                            <Button key={kind} size="small" variant="outlined"
                                disabled={!myTurn || loanFromPort === "" || loanToPort === "" || !seaPathBetweenPorts(loanFromPort, loanToPort)}
                                onClick={() => moves.loanNaval({target: diploTargetValue, fromPort: loanFromPort, toPort: loanToPort, kind, ...(loanLeader ? {leader: loanLeader} : {})})}>
                                {i18n.chain.vq.diplomacy.loan} {kind === "galley" ? i18n.chain.vq.board.galley : kind === "galleon" ? i18n.chain.vq.board.galleon : i18n.chain.vq.board.racebuilt}
                            </Button>)}
                    </Stack>
                </Stack>}
                <Typography variant="subtitle2">{i18n.chain.vq.diplomacy.declareWarMinor}</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {MINOR_POWERS.map((m) => <Button key={m} size="small" variant="outlined"
                                                      disabled={!myTurn || G.powers[me].warsMinors.includes(m) ||
                                                          POWERS.some((major) => G.powers[major].alliedMinors.includes(m)) ||
                                                          !minorAvailable(G, m)}
                                                      onClick={() => moves.declareWarMinor({target: m})}>
                        {minorName(m, vqLocale)}
                    </Button>)}
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">{i18n.chain.vq.diplomacyUi.betrothal}</Typography>
                {playerID !== null && ctx.activePlayers?.[playerID] === "respondBetroth" && G.pendingBetrothal !== null ? (
                    <Stack spacing={1}>
                        <Typography variant="body2">
                            {powerName(G.pendingBetrothal.proposer, vqLocale)} {i18n.chain.vq.diplomacyUi.proposal}
                            {royalLabel(G.royals.find((r) => r.id === G.pendingBetrothal!.male) ?? {name: G.pendingBetrothal.male})}
                            {" ↔ "}
                            {royalLabel(G.royals.find((r) => r.id === G.pendingBetrothal!.female) ?? {name: G.pendingBetrothal.female})}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" color="success"
                                    onClick={() => moves.acceptBetroth()}>{i18n.chain.vq.diplomacyUi.accept}</Button>
                            <Button size="small" variant="outlined" color="error"
                                    onClick={() => moves.rejectBetroth()}>{i18n.chain.vq.diplomacyUi.reject}</Button>
                        </Stack>
                    </Stack>
                ) : G.pendingBetrothal !== null && G.pendingBetrothal.proposer === me ? (
                    <Typography variant="body2" color="text.secondary">
                        ⏳ {i18n.chain.vq.diplomacyUi.waitingPrefix} {powerName(G.pendingBetrothal.target, vqLocale)} {i18n.chain.vq.diplomacyUi.waitingSuffix}
                    </Typography>
                ) : (<>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-domestic">{i18n.chain.vq.diplomacyUi.domesticRoyal}</InputLabel>
                        <Select labelId="vq-domestic" label={i18n.chain.vq.diplomacyUi.domesticRoyal} value={domesticRoyal}
                                onChange={(e) => { setDomesticRoyal(e.target.value as string); setForeignRoyal(""); }}>
                            {betrothal.domestic.map((r) =>
                                <MenuItem key={r.id} value={r.id}>{royalLabel(r)} ({r.gender === "male" ? i18n.chain.vq.diplomacyUi.male : i18n.chain.vq.diplomacyUi.female})</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-foreign">{i18n.chain.vq.diplomacyUi.foreignRoyal}</InputLabel>
                        <Select labelId="vq-foreign" label={i18n.chain.vq.diplomacyUi.foreignRoyal} value={foreignRoyal}
                                onChange={(e) => setForeignRoyal(e.target.value as string)}
                                disabled={domesticRoyal === ""}>
                            {betrothal.foreign.map((r) =>
                                <MenuItem key={r.id} value={r.id}>{royalLabel(r)}
                                    {r.id === "louiseLorraine" && betrothal.samePowerLouise
                                        ? i18n.chain.vq.diplomacyUi.samePowerMarriage
                                        : ` (${powerName(r.power, vqLocale)})`}</MenuItem>)}
                        </Select>
                    </FormControl>
                    {betrothal.louiseAttachable && <Typography variant="caption" color="success.main">
                        {i18n.chain.vq.diplomacyUi.louiseNote}
                    </Typography>}
                    <Button size="small" variant="outlined"
                            disabled={!myTurn || betrothal.proposal === undefined || G.pendingBetrothal !== null}
                            onClick={() => {
                                if (betrothal.proposal !== undefined) moves.proposeBetroth(betrothal.proposal);
                            }}>{i18n.chain.vq.diplomacyUi.propose}</Button>
                </>)}
                {Object.keys(G.leaders).filter((id) => G.leaders[id].location === "captured" && LEADER_BY_ID[id]?.power === me).length > 0 && <>
                    <Divider/>
                    <Typography variant="subtitle2">{i18n.chain.vq.diplomacyUi.ransom}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {Object.keys(G.leaders).filter((id) => G.leaders[id].location === "captured" && LEADER_BY_ID[id]?.power === me)
                            .map((id) => <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                                                 onClick={() => moves.ransom({leaderId: id})}>
                                {leaderLabel(id)}
                            </Button>)}
                    </Stack>
                </>}
                <Divider/>
                <Button size="small" variant="outlined" disabled={!myTurn || G.pendingBetrothal !== null} onClick={() => moves.endPhaseTurn()}>
                    {i18n.chain.vq.diplomacy.endDiplomacy}
                </Button>
            </Stack>;
        }
        if (phase === "spring") {
            const springHomeCards = hand.filter((id) => cardById(id).kind === "home");
            const choiceRequired = homeCardChoiceRequired(G, me);
            const preferenceRequired = hreReligiousPreferenceRequired(G, me);
            const mayKeepBoth = keepsBothHomeCards(G, me);
            const navalPortChoices = (G.navalLeaderArrivals ?? []).filter((entry) => entry.power === me);
            return <Stack spacing={1}>
                {hotseatWaitHint() !== undefined && <Typography variant="body2" color="text.secondary">{hotseatWaitHint()}</Typography>}
                {navalPortChoices.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                    <Typography variant="subtitle2">{i18n.chain.vq.spring.navalReturn}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.spring.navalReturnDesc}
                    </Typography>
                    {navalPortChoices.map((entry) => <Stack key={entry.leader} spacing={0.5}>
                        <Typography variant="body2">{leaderLabel(entry.leader)}</Typography>
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            {entry.ports.map((port) => <Button key={port} size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseNavalLeaderPort({leader: entry.leader, port})}>
                                {placeLabel(port)}
                            </Button>)}
                        </Stack>
                    </Stack>)}
                </Stack>}
                {preferenceRequired && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{i18n.chain.vq.spring.secretPref}</Typography>
                    <Typography variant="caption" color="text.secondary">{i18n.chain.vq.spring.secretPrefDesc}</Typography>
                    <Stack direction="row" spacing={0.5}>
                        {(Object.keys(HRE_RELIGIOUS_PREFERENCE_NAMES) as HreReligiousPreference[]).map((preference) =>
                            <Button key={preference} size="small" variant="outlined" disabled={!myTurn}
                                    onClick={() => moves.chooseHreReligiousPreference({preference})}>
                                {hreReligiousPreferenceName(preference, vqLocale)}
                            </Button>)}
                    </Stack>
                </Stack>}
                <Typography variant="body2">
                    {choiceRequired ? i18n.chain.vq.springUi.deployHintChoice : i18n.chain.vq.springUi.deployHint}
                </Typography>
                {mayKeepBoth && <Typography variant="caption" color="success.main">
                    {i18n.chain.vq.spring.suleiman}
                </Typography>}
                {choiceRequired && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{i18n.chain.vq.spring.chooseHomeCard}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.spring.chooseHomeCardDesc}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {springHomeCards.map((id) => <Button key={id} size="small" variant="outlined"
                                                           disabled={!myTurn}
                                                           onClick={() => moves.chooseHomeCard({cardId: id})}>
                            {i18n.chain.vq.spring.keep} {cardName(id, vqLocale)}
                        </Button>)}
                    </Stack>
                </Stack>}
                {ps !== undefined && (ps.homeCardSetAside?.length ?? 0) > 0 && <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.spring.faceDown}: {(ps.homeCardSetAside ?? []).map((id) => cardName(id, vqLocale)).join(", ")}
                </Typography>}
                {me === "england" && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{i18n.chain.vq.spring.seaCaptain}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.spring.seaCaptainDesc}
                    </Typography>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-sea-captain">{i18n.chain.vq.springUi.seaCaptain}</InputLabel>
                        <Select labelId="vq-sea-captain" label={i18n.chain.vq.springUi.seaCaptain} value={seaCaptainChoice}
                                onChange={(e) => setSeaCaptainChoice(e.target.value)}>
                            {G.powers.england.seaCaptains.filter((id) => SEA_CAPTAIN_LEADER_BY_CAPTAIN[id] &&
                                (seaCaptainById(id)?.turn ?? 99) <= G.year &&
                                G.leaders[SEA_CAPTAIN_LEADER_BY_CAPTAIN[id]] === undefined)
                                .map((id) => <MenuItem key={id} value={id}>{seaCaptainName(seaCaptainById(id), vqLocaleNow()) || id}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-sea-captain-port">{i18n.chain.vq.spring.port}</InputLabel>
                        <Select labelId="vq-sea-captain-port" label={i18n.chain.vq.spring.port} value={seaCaptainPort}
                                onChange={(e) => setSeaCaptainPort(e.target.value)}>
                            {SPACES.filter((space) => space.control === "england" && spaceHomes(space).includes("england") &&
                                (space.ports?.length ?? 0) > 0 && navalCount(G.spaces[space.id].naval.england) > 0)
                                .map((space) => <MenuItem key={space.id} value={space.id}>{placeLabel(space.id)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="outlined" disabled={!myTurn || seaCaptainChoice === "" || seaCaptainPort === ""}
                        onClick={() => moves.placeSeaCaptainLeader({captain: seaCaptainChoice, port: seaCaptainPort})}>
                        {i18n.chain.vq.spring.placeCaptain}
                    </Button>
                </Stack>}
                {me === "spain" && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{i18n.chain.vq.spring.treasureFleet}</Typography>
                    <Typography variant="caption" color="text.secondary">{i18n.chain.vq.spring.treasureFleetDesc}</Typography>
                    <Stack direction="row" spacing={0.5}>
                        {[0, 1, 2].map((count) => <Button key={count} size="small" variant="outlined"
                            disabled={!myTurn || (G.treasureFleetEscorts ?? 0) === count}
                            onClick={() => moves.setTreasureFleetEscorts({count})}>{i18n.chain.vq.spring.escort} {count}</Button>)}
                    </Stack>
                </Stack>}
                <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.spring.capital}: {(me !== undefined ? capitalSpacesFor(G, me) : []).map((id) => placeLabel(id)).join(" / ")} {from !== null ? `· ${i18n.chain.vq.spring.origin} ${placeLabel(from)}` : ""}
                </Typography>
                {from !== null && <Stack spacing={0.5}>
                    <Typography variant="caption">{i18n.chain.vq.board.moveHint}</Typography>
                    {stackPicker(true)}
                </Stack>}
                <Button size="small" variant="outlined" disabled={!myTurn || choiceRequired || preferenceRequired || navalPortChoices.length > 0} onClick={() => moves.endPhaseTurn()}>
                    {i18n.chain.vq.spring.endSpring}
                </Button>
            </Stack>;
        }
        return null;
    };

    const religionActions = (me: Power): { label: string; run: () => void }[] => {
        const list: { label: string; run: () => void }[] = [];
        const add = (label: string, side: "preach" | "suppress", area: ReligionArea) => {
            list.push({
                label,
                run: () => side === "preach" ? moves.preach({area}) : moves.suppress({area}),
            });
        };
        if (me === "spain") {
            add(i18n.chain.vq.religionActions.preachEngland, "preach", "england");
            add(i18n.chain.vq.religionActions.suppressNetherlands, "suppress", "netherlands");
        }
        if (me === "protestant") {
            add(i18n.chain.vq.religionActions.preachFrance, "preach", "france");
            add(i18n.chain.vq.religionActions.preachNetherlands, "preach", "netherlands");
            add(i18n.chain.vq.religionActions.preachScotland, "preach", "scotland");
        }
        if (me === "england") {
            add(i18n.chain.vq.religionActions.suppressEngland, "suppress", "england");
        }
        if (me === "france") {
            add(i18n.chain.vq.religionActions.suppressFrance, "suppress", "france");
            add(i18n.chain.vq.religionActions.suppressScotland, "suppress", "scotland");
        }
        return list;
    };

    const pendingPower = G.gregorianResponse?.responder ?? G.pendingBeacon?.defender ?? G.pendingInterceptionOrder?.defender ?? G.pendingIntercept?.defender ?? actionResponder ?? piracyResponder ??
        G.pendingEspionage?.responding ?? G.pendingCardEvent?.responding ?? G.pendingTutorialEvent?.responding ?? G.pendingBattle?.responding ?? G.pendingActivation?.ally ?? G.pendingBetrothal?.target ?? G.pendingRebelMove?.power ??
        G.pendingReliefSplit?.power ?? G.pendingForeignWar?.power ??
        (G.pendingCityRebels !== undefined ? (isPower(G.pendingCityRebels.controller) ? G.pendingCityRebels.controller : G.pendingCityRebels.power) : undefined) ??
        (G.pendingAbjuration !== undefined ? "protestant" as Power : undefined);
    const hasResponse = pendingPower !== undefined && ctx.gameover === undefined;
    // Winter attrition choices are mandatory but are not `pending*` responses,
    // so they need their own cue on the action tab (especially on mobile).
    const winterLandChoice = me !== undefined && (G.winterLossChoices ?? []).some((entry) => entry.power === me);
    const winterNavalChoice = me !== undefined && (G.winterNavalLossChoices ?? []).some((entry) => entry.power === me);
    const winterChoiceRequired = phase === "cardDraw" && (winterLandChoice || winterNavalChoice);
    const needsAction = hasResponse || winterChoiceRequired;
    const winterChoiceLabel = winterLandChoice && winterNavalChoice
        ? `${i18n.chain.vq.cardDraw.winterLosses} / ${i18n.chain.vq.cardDraw.winterNavalLosses}`
        : winterLandChoice ? i18n.chain.vq.cardDraw.winterLosses : i18n.chain.vq.cardDraw.winterNavalLosses;
    const selectedSea = selected ? G.seaZones[selected as keyof VQGame["seaZones"]] : undefined;
    const panelProps = (name: string) => ({id: `${panelID}-${name}`, role: isDesktop ? undefined : "tabpanel",
        "aria-labelledby": isDesktop ? undefined : `${panelID}-tab-${name}`, hidden: !isDesktop && mobileView !== name,
        // Lets the skip link land on the action panel for keyboard users.
        tabIndex: name === "action" ? -1 : undefined});
    React.useEffect(() => {
        if (needsAction) {
            if (actionRef.current) actionRef.current.scrollTop = 0;
            if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
        }
    }, [needsAction, pendingPower, G.pendingBattle?.step, G.pendingPiracy?.step, G.pendingTutorialEvent?.step, G.pendingCardEvent, G.pendingEspionage?.step]);

    return <VQSurface><div className="vq-board">
        <a className="vq-skip-link" href={`#${panelID}-action`}>{i18n.chain.vq.shell.skipToActions}</a>
        <header className="vq-status">
            <div><div className="vq-eyebrow">A game of diplomacy & empire · 1559–1598</div>
                <h1 className="vq-title">Virgin Queen</h1></div>
            <div className="vq-status-meta">
                <span>{scenarioName(G.scenario, vqLocale)} · {i18n.chain.vq.header.turn} {G.year}{G.scenario === "tutorial" ? " / 3" : ""}</span>
                <span> / {phaseLabel(phase)}</span>
                <strong>{ctx.gameover !== undefined ? i18n.chain.vq.header.gameOver : `${i18n.chain.vq.header.current}${i18n.chain.vq.punct.colon}${powerName(G.activePower, vqLocale)}`}</strong>
                <span>{me ? `${i18n.chain.vq.header.viewing} ${powerName(me, vqLocale)} · ${cp} CP` : i18n.chain.vq.header.spectator}</span>
                {standings.map((entry) => <span key={entry.power} className="vq-score">
                    <i className="vq-dot" style={{background: CONTROLLER_COLORS[entry.power]}}/>{powerShortName(entry.power, vqLocale)} <b>{entry.vp} VP</b>
                </span>)}
            </div>
        </header>
        {hasResponse && <div className="vq-response" role="status" aria-live="polite">
            <span>{i18n.chain.vq.shell.responseNeeded} · {powerName(pendingPower, vqLocale)}{ownerOf(G, pendingPower) === playerID ? ` · ${i18n.chain.vq.shell.yourTurn}` : ` · ${i18n.chain.vq.shell.waiting}`}{switchToTab(pendingPower) !== undefined ? ` · ${switchToTab(pendingPower)}` : ""}</span>
            {!isDesktop && <Button size="small" onClick={() => setMobileView("action")}>{i18n.chain.vq.shell.viewResponse}</Button>}
        </div>}
        {!hasResponse && winterChoiceRequired && <div className="vq-response" role="status" aria-live="polite">
            <span>{winterChoiceLabel}{me !== undefined ? ` · ${powerName(me, vqLocale)}` : ""}</span>
            {!isDesktop && <Button size="small" onClick={() => setMobileView("action")}>{i18n.chain.vq.shell.viewResponse}</Button>}
        </div>}
        <Tabs className="vq-mobile-tabs" value={mobileView} onChange={(_event, value) => setMobileView(value)} variant="fullWidth" aria-label={i18n.chain.vq.shellUi.panelsAria}>
            {[["map", i18n.chain.vq.shell.map], ["action", needsAction ? i18n.chain.vq.shell.actionNeeded : i18n.chain.vq.shell.action], ["hand", `${i18n.chain.vq.shell.hand} ${hand.length}`], ["intel", i18n.chain.vq.shell.intel]].map(([value, label]) =>
                <Tab key={value} id={`${panelID}-tab-${value}`} aria-controls={`${panelID}-${value}`} value={value} label={label}/>)}
        </Tabs>
        <div className="vq-workspace">
            <section className="vq-panel vq-map-panel" {...panelProps("map")}>
                <VQMap G={G} selected={selected} origin={from} onSelect={onSelect}
                       highlights={mapHighlights} dimUnavailable/>
                {stepInfo !== undefined && <StepBanner steps={stepInfo.steps} active={stepInfo.active}
                    hint={from !== null && (mode === "spring" || mode === "moveLand" || mode === "navalTransport")
                        ? i18n.chain.vq.step.unitsHint : undefined}
                    onCancel={() => {setFrom(null); setTransportZones([]);}}/>}
                {from !== null && (mode === "spring" || mode === "moveLand" || mode === "navalTransport") &&
                    (isDesktop
                        ? <Paper className="vq-map-stack" variant="outlined">
                            <Stack spacing={0.5}>
                                <Typography variant="caption" sx={{fontWeight: 700}}>
                                    {i18n.chain.vq.step.chooseUnit} · {placeLabel(from)}
                                </Typography>
                                {stackPicker(mode === "spring")}
                            </Stack>
                        </Paper>
                        : <Paper className="vq-map-formation" variant="outlined">
                            <Typography className="vq-formation-summary" variant="caption" aria-live="polite"
                                color={landCount(movingUnits) > formationCapacity(movingLeaders) ? "error" : undefined}>
                                {formationSummary()}
                            </Typography>
                            <Button size="small" variant="outlined" onClick={() => setFormationSheetOpen(true)}>
                                {i18n.chain.vq.springUi.adjustFormation}
                            </Button>
                        </Paper>)}
                {!isDesktop && selected && from === null && <div className="vq-map-selection">
                    <Button size="small" variant="contained" onClick={() => setMobileView("action")}>
                        {`${spaceDef !== undefined ? placeLabel(spaceDef.id) : seaZoneName(selected, vqLocaleNow())} · ${i18n.chain.vq.shell.detailOps}`}
                    </Button>
                </div>}
            </section>
            <aside className="vq-sidebar" ref={sidebarRef}>
            <section className="vq-panel vq-actions" ref={actionRef} {...panelProps("action")}>
                <TutorialGuide G={G} ctx={ctx} playerID={playerID}/>
                <div className="vq-panel-heading"><h2>{hasResponse ? i18n.chain.vq.shell.responseSettlement : i18n.chain.vq.shell.currentAction}</h2>
                    <Chip variant="outlined" label={me ? `${cp} CP` : i18n.chain.vq.shell.spectator}/></div>
                {owned.length > 1 && <Stack direction="row" spacing={0.5} useFlexGap sx={{flexWrap: "wrap", mb: 1}}>
                    {owned.map((power) => <Button key={power} size="small" disabled={myTurn || !!responsePower}
                        variant={me === power ? "contained" : "outlined"} onClick={() => setViewPower(power)}>{powerName(power, vqLocale)}</Button>)}
                </Stack>}
                {ctx.gameover !== undefined ? <Paper variant="outlined" sx={{p: 1.5, mb: 1}} role="status">
                    <Typography variant="h6">{i18n.chain.vq.shell.gameOver} · {i18n.chain.vq.shell.winner}{i18n.chain.vq.punct.colon}P{Number(ctx.gameover.winner) + 1} {powerName((ctx.gameover.power ?? powerAt(String(ctx.gameover.winner))) as Power, vqLocale)}</Typography>
                    <Typography variant="body2">{i18n.chain.vq.shell.reason}: {ctx.gameover.reason ?? ""}</Typography>
                    {matchID !== undefined && <ExportLogButton gameName="virginQueen" matchID={matchID}/>}
                </Paper> : actionPanel()}
                {space !== undefined && spaceDef !== undefined && <section className="vq-space-detail" aria-label={i18n.chain.vq.board.spaceDetailLabel}>
                    <Typography variant="subtitle2">{placeLabel(spaceDef.id)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {spaceDef.kind === "key" ? i18n.chain.vq.board.keyCity : spaceDef.kind === "fortress" ? i18n.chain.vq.board.fortress : i18n.chain.vq.board.openCity}
                        {spaceDef.ports !== undefined && spaceDef.ports.length > 0 ? ` · ${i18n.chain.vq.board.port}: ${spaceDef.ports.map((id) => seaZoneName(id, vqLocale)).join(", ")}` : ""}
                        {spaceDef.area !== undefined ? ` · ${areaName(spaceDef.area, vqLocale)}` : ""}
                    </Typography>
                    <Typography variant="body2" sx={{mt: 0.5}}>
                        {i18n.chain.vq.board.control}: <b>{isPower(space.control) ? powerName(space.control, vqLocale) : space.control}</b>
                        {" · "}{space.religion === "protestant" ? i18n.chain.vq.board.protestant : i18n.chain.vq.board.catholic}
                        {space.unrest ? ` · ${i18n.chain.vq.board.unrest}` : ""}
                        {space.siege !== undefined ? ` · ${i18n.chain.vq.board.besiegedBy} ${powerShortName(space.siege.by, vqLocale)}` : ""}
                    </Typography>
                    {Object.keys(space.land).map((c) => {
                        const st = space.land[c as keyof typeof space.land];
                        if (st === undefined) {
                            return null;
                        }
                        return <Typography key={c} variant="caption" sx={{display: "block"}}>
                            {i18n.chain.vq.board.army} {controllerName(c as any, vqLocale)}: {i18n.chain.vq.board.regular} {cell(st.regular)} / {i18n.chain.vq.board.merc} {cell(st.merc)} / {i18n.chain.vq.board.cav} {cell(st.cav)}
                        </Typography>;
                    })}
                    {Object.keys(space.naval).map((c) => {
                        const st = space.naval[c as keyof typeof space.naval];
                        if (st === undefined) {
                            return null;
                        }
                        return <Typography key={c} variant="caption" sx={{display: "block"}}>
                            {i18n.chain.vq.board.navy} {controllerName(c as any, vqLocale)}: {i18n.chain.vq.board.galley} {cell(st.galley)} / {i18n.chain.vq.board.galleon} {cell(st.galleon)} / {i18n.chain.vq.board.racebuilt} {cell(st.racebuilt)} / {i18n.chain.vq.board.corsair} {cell(st.corsair)}
                        </Typography>;
                    })}
                    {G.espionage?.jesuits.includes(selected!) && <Chip size="small" label={i18n.chain.vq.board.jesuits}/>}
                    {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
                        {i18n.chain.vq.board.leaders}: {space.leaders.map((id) => leaderLabel(id)).join(", ")}
                    </Typography>}
                </section>}
                {selectedSea && selected && <section className="vq-space-detail" aria-label={i18n.chain.vq.board.seaDetailLabel}>
                    <Typography variant="subtitle2">{seaZoneName(selected, vqLocaleNow())}</Typography>
                    <Typography variant="caption">{i18n.chain.vq.board.seaFleets}</Typography>
                    {Object.entries(selectedSea.naval).map(([controller, stack]) => <Typography key={controller} variant="body2">
                        {controllerName(controller as Controller, vqLocale)}: {i18n.chain.vq.board.galley} {stack?.galley ?? 0} / {i18n.chain.vq.board.galleon} {stack?.galleon ?? 0} / {i18n.chain.vq.board.racebuilt} {stack?.racebuilt ?? 0} / {i18n.chain.vq.board.corsair} {stack?.corsair ?? 0}
                    </Typography>)}
                    {Object.keys(selectedSea.naval).length === 0 && <Typography variant="body2">{i18n.chain.vq.board.noFleet}</Typography>}
                </section>}
            </section>
            <section className="vq-panel vq-intel" {...panelProps("intel")}>
                <ActionGroup title={i18n.chain.vq.intel.overview}>
                    {POWERS.map((p) => <Stack key={p} direction="row" spacing={0.5} sx={{alignItems: "center", mb: 0.25}}>
                        <Box sx={{width: 10, height: 10, bgcolor: CONTROLLER_COLORS[p], borderRadius: 0.5}}/>
                        <Typography variant="caption" sx={{minWidth: 72}}>{powerShortName(p, vqLocale)} · {ownerOf(G, p) === undefined ? i18n.chain.vq.intel.unactivated : `P${Number(ownerOf(G, p)) + 1}`}</Typography>
                        {isActivatedMajor(G, p) && <Chip size="small" variant="outlined"
                            label={ownerOf(G, p) === undefined ? i18n.chain.vq.intel.pendingActivation : i18n.chain.vq.intel.activated}/>}
                        <Chip size="small" label={`${powerVp(G, p)} VP`}/>
                        {p === "hre" && G.hreReligiousPreferenceChosen && <Chip size="small" variant="outlined"
                            label={G.hreReligiousPreference !== undefined && (me === "hre" || G.hreReligiousPreferenceRevealed)
                                ? `${G.hreReligiousPreferenceRevealed ? i18n.chain.vq.intel.revealed : i18n.chain.vq.intel.secret}${i18n.chain.vq.punct.colon}${hreReligiousPreferenceName(G.hreReligiousPreference, vqLocale)} · ${hreReligiousVp(G)} VP${G.hreReligiousPreferenceRevealed ? "" : i18n.chain.vq.intel.notCounted}`
                                : i18n.chain.vq.intel.secretChosen}/>}
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, p).length} ${i18n.chain.vq.intel.keys}`}/>
                        <Chip size="small" variant="outlined" label={`${G.handCounts?.[p] ?? G.powers[p].cards.length}${i18n.chain.vq.intel.cards}`}/>
                        {(G.homeCardSetAsideCounts?.[p] ?? 0) > 0 &&
                            <Chip size="small" variant="outlined" label={`${i18n.chain.vq.intel.faceDown} ${G.homeCardSetAsideCounts?.[p]}`}/>}
                        {G.powers[p].wars.length > 0 && <Typography variant="caption" color="text.secondary">
                            {i18n.chain.vq.intel.war}{i18n.chain.vq.punct.colon}{G.powers[p].wars.map((w) => powerShortName(w, vqLocale)).join("/")}
                        </Typography>}
                    </Stack>)}
                </ActionGroup>
                {me !== undefined && ps !== undefined && <ActionGroup title={i18n.chain.vq.intel.myPower}>
                    <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                        <Box sx={{width: 14, height: 14, bgcolor: CONTROLLER_COLORS[me], borderRadius: 0.5}}/>
                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>{powerName(me, vqLocale)}</Typography>
                        <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, me).length} ${i18n.chain.vq.intel.keys}`}/>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.intel.ruler}{i18n.chain.vq.punct.colon}{ps.ruler === "elizabethDead" ? i18n.chain.vq.intel.elizabethDead : rulerName(ps.ruler, vqLocale)}{i18n.chain.vq.punct.openParen}{i18n.chain.vq.intel.admin} {ps.ruler === "elizabethDead" ? 1 : POWER_INFO[me].ruler.admin} / {i18n.chain.vq.intel.extraCards} {ps.ruler === "elizabethDead" ? 0 : POWER_INFO[me].ruler.cardBonus}{i18n.chain.vq.punct.closeParen}
                        · {i18n.chain.vq.intel.base} {baseVp(G, me)} + {i18n.chain.vq.intel.religion} {religiousSpecialVp(G, me)} + {i18n.chain.vq.intel.bonus} {ps.bonusVp}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                        <Typography variant="caption">{i18n.chain.vq.intel.wars}: {ps.wars.length > 0 ? ps.wars.map((w) => powerShortName(w, vqLocale)).join(", ") : i18n.chain.vq.intel.none}</Typography>
                        <Typography variant="caption">{i18n.chain.vq.intel.allies}: {ps.allies.length > 0 ? ps.allies.map((w) => powerShortName(w, vqLocale)).join(", ") : i18n.chain.vq.intel.none}</Typography>
                        <Typography variant="caption">{i18n.chain.vq.intel.treasures}: {ps.treasures.length}</Typography>
                    </Stack>
                </ActionGroup>}

                {G.espionage?.inspections.filter((entry) => playerID !== null && ownerOf(G, entry.viewer) === playerID).map((entry) =>
                    <ActionGroup key={`${entry.viewer}:${entry.target}`} title={`${i18n.chain.vq.intel.secretIntel} · ${powerName(entry.target, vqLocale)}${i18n.chain.vq.intel.handSnapshot}`}>
                        <Typography variant="caption">{i18n.chain.vq.intel.onlyYou}</Typography>
                        {entry.cards.map((id) => <Typography key={id} variant="body2">{cardName(id, vqLocale)} · {cardById(id).cp} CP</Typography>)}
                    </ActionGroup>)}
                <ActionGroup title={`${i18n.chain.vq.intel.log} · ${G.log.length}`}>
                    <LogPanel log={G.log} marks={G.logMarks} codes={G.logI18n}
                              myName={me !== undefined ? powerName(me, vqLocale) : undefined}
                              onSelectSpace={(id) => setSelected(id)}/>
                </ActionGroup>
                <ActionGroup title={i18n.chain.vq.intel.scenario}>
                    <Typography variant="body2">{scenarioName(G.scenario, vqLocale)} · {i18n.chain.vq.intel.deck} {G.deckCount ?? 0} · {i18n.chain.vq.intel.protestantSpaces} {protestantSpaceCount(G)}</Typography>
                    {G.scenario === "tutorial" && <>
                        <Typography variant="body2">{i18n.chain.vq.intel.tutorialOttoman}</Typography>
                        <Typography variant="body2">{i18n.chain.vq.intel.tutorialOttoman2} {powerVp(G, "ottoman")} VP ({i18n.chain.vq.intel.keys} {baseVp(G, "ottoman")}, {i18n.chain.vq.intel.fortress} {tutorialFortressVp(G)}, {i18n.chain.vq.intel.other} {G.powers.ottoman.bonusVp}). {i18n.chain.vq.intel.remainingTurns}: {Math.max(0, 4 - G.year)}.</Typography>
                    </>}
                </ActionGroup>
            </section>
            </aside>
            <section className="vq-panel vq-hand" {...panelProps("hand")}>
                <div className="vq-panel-heading"><h2>{i18n.chain.vq.shell.handTitle} <span style={{fontWeight: 400}}>· {hand.length} {i18n.chain.vq.cardTray.cards}</span></h2>
                    <Stack direction="row" spacing={0.5}>
                        {ps?.treasures.map((treasure, index) => <Button key={index} size="small" variant="outlined"
                            disabled={!canAct || !ps.cardPlayed || ps.treasurePlayed} onClick={() => moves.playTreasure({index})}>{i18n.chain.vq.intel.treasures} {treasure} CP</Button>)}
                        {isDesktop && <Button size="small" aria-expanded={handExpanded} aria-controls={`${panelID}-cards`}
                            onClick={() => setHandExpanded(!handExpanded)}>{handExpanded ? i18n.chain.vq.cardTray.collapse : i18n.chain.vq.cardTray.expand}</Button>}
                    </Stack>
                </div>
                <div id={`${panelID}-cards`} hidden={isDesktop && !handExpanded}>
                    {hand.length === 0 && <Typography variant="body2" color="text.secondary">{me ? i18n.chain.vq.cardTray.noCards : i18n.chain.vq.cardTray.spectator}</Typography>}
                    <div className="vq-card-tray">{hand.map((id) => {
                        const card = cardById(id);
                        return <button key={id} className="vq-card" aria-label={`${i18n.chain.vq.cardTray.viewCard} ${cardName(id, vqLocale)} · ${card.cp} CP`} onClick={() => openCard(id)}>
                            <CardArt def={card} className="vq-card-art" lazy/>
                            <small>{cardKindLabel(card)}<span className="vq-card-cp">{card.cp} CP</span></small>
                            <strong>{cardName(id, vqLocale)}</strong><small>{i18n.chain.vq.cardTray.viewDetails} ↗</small>
                        </button>;
                    })}</div>
                </div>
            </section>
        </div>
        <Drawer anchor="right" open={selectedCard !== undefined && hand.includes(selectedCard)} onClose={() => setSelectedCard(undefined)}>
            {selectedCard && hand.includes(selectedCard) && <div className="vq-surface vq-card-detail" role="dialog" aria-modal="true" aria-label={`${i18n.chain.vq.shell.cardDetail} ${cardName(selectedCard, vqLocale)}`}>
                <div className="vq-panel-heading"><h2>{i18n.chain.vq.shell.cardDetail}</h2><Button onClick={() => setSelectedCard(undefined)}>{i18n.chain.vq.shell.close}</Button></div>
                {cardView(selectedCard)}
            </div>}
        </Drawer>
        <DiceToast rolls={G.lastRolls}/>
        <Snackbar open={actionNotice !== undefined} autoHideDuration={3000} onClose={() => setActionNotice(undefined)}
                  anchorOrigin={{vertical: "bottom", horizontal: "center"}}>
            <Alert severity="error" variant="filled" onClose={() => setActionNotice(undefined)}>{actionNotice}</Alert>
        </Snackbar>
        {!isDesktop && <MobileSpaceSheet G={G} spaceId={selected} open={sheetOpen}
                                         onClose={() => setSheetOpen(false)}/>}
        {!isDesktop && <Drawer anchor="bottom" open={formationSheetOpen && from !== null}
                              onClose={() => setFormationSheetOpen(false)}
                              slotProps={{paper: {className: "vq-sheet", sx: {maxHeight: "72dvh", borderRadius: "14px 14px 0 0"}}}}>
            <div className="vq-sheet-handle" aria-hidden="true"/>
            <div className="vq-sheet-head">
                <Typography variant="subtitle1" sx={{fontWeight: 700}}>
                    {i18n.chain.vq.step.chooseUnit}{from !== null ? ` · ${placeLabel(from)}` : ""}
                </Typography>
                <Button size="small" onClick={() => setFormationSheetOpen(false)}>{i18n.chain.vq.shell.close}</Button>
            </div>
            {from !== null && <Stack spacing={0.75}>
                {stackPicker(mode === "spring")}
                <Button variant="contained" fullWidth onClick={() => setFormationSheetOpen(false)}>
                    {i18n.chain.vq.step.chooseTarget}
                </Button>
            </Stack>}
        </Drawer>}
        <ConfirmDialog
            open={confirmAction !== null}
            title={confirmAction === "endImpulse" ? i18n.chain.vq.turn.confirmEnd : i18n.chain.vq.turn.confirmPass}
            confirmLabel={confirmAction === "endImpulse" ? i18n.chain.vq.turn.endImpulse : i18n.chain.vq.turn.pass}
            cancelLabel={i18n.chain.vq.step.cancel}
            onCancel={() => setConfirmAction(null)}
            onConfirm={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "pass") moves.pass();
                if (action === "endImpulse") moves.endImpulse();
            }}/>
    </div></VQSurface>;
};

