import React from "react";
import {BoardProps} from "boardgame.io/react";
import FormControl from "@mui/material/FormControl";
import {abjurationOffers, abjurationSelection, acceptAbjurationOffer} from "../../abjuration";
import {eventTargetOptions, eventTargetValue} from "../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../polishElection";
export {
    POLISH_ELECTION_POWERS,
    POLISH_ELECTION_AUTO_LABEL,
    polishElectionBidOptions,
    polishElectionBidValue,
    polishElectionTargetValue,
} from "../../polishElection";
export type {PolishElectionBidChoices, PolishElectionBidOption, PolishElectionPower} from "../../polishElection";
export {eventTargetOptions, eventTargetValue} from "../../eventTargets";
export type {EventTargetOption} from "../../eventTargets";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import i18n from "../../../constant/i18n";
import {CardDef, powerName, powerShortName, minorName, landCount, POWERS, Power, RoyalDef, VQGame, isPower, VictoryReason, VICTORY_TEXT, victoryText} from "../../constant/general";
import {cardById, cardImageUrl, cardName} from "../../constant/cards";
import {leaderName} from "../../constant/leaders";
import {royalAvailable} from "../../scenario";
import {SPACE_BY_ID, SPACES, seaZoneName, spaceName} from "../../mapData";
import {WORLD_SETTLEMENTS} from "../../data/world";
import {PatronageVpAward} from "../../data/types";
import {atWar, victoryStandings, vpTieBreak, type VpTieBreak} from "../../util";
import {ownerOf} from "../../ownership";
import {canPlayBattleCard} from "../../combat";
import {actionResponseOptions} from "../../moves";

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
export const phaseLabel = (phase: string): string =>
    phase === "" ? "" : ((i18n.chain.vq.header.phase as unknown as Record<string, string>)[phase] ?? phase);

/** Localized game-over reason; unknown reasons stay readable instead of blank. */
export const gameOverReasonText = (reason: string | undefined, locale: "en" | "zh_CN"): string => {
    if (reason === undefined || reason === "") return "";
    return reason in VICTORY_TEXT ? victoryText(reason as VictoryReason, locale) : reason;
};

/**
 * Why a tie for the top score was decided as it was, phrased for the game-over
 * panel.  Returns undefined when there was no tie to explain.
 */
export const vpTieBreakSummary = (G: VQGame, locale: "en" | "zh_CN"): string | undefined => {
    // The tutorial awards its time-limit win to Spain by special rule rather
    // than by score, and keeps no Victory Record Sheet.
    if (G.scenario === "tutorial") return undefined;
    const standings = victoryStandings(G);
    const top = standings[0];
    if (top === undefined) return undefined;
    const tied = standings.filter((entry) => entry.vp === top.vp).map((entry) => entry.power);
    if (tied.length < 2) return undefined;
    // Mirrors checkVictory: the turn just completed is G.year - 1, so the
    // previous turn is G.year - 2.
    return describeVpTieBreak(vpTieBreak(G, tied, G.year - 2), locale);
};

/** Renders one tie-break trace as a single localized sentence. */
export const describeVpTieBreak = (trace: VpTieBreak, locale: "en" | "zh_CN"): string => {
    const t = i18n.chain.vq.shell;
    const names = trace.tied.map((power) => powerShortName(power, locale)).join(i18n.chain.vq.punct.list);
    const stem = t.vpTieIntro.replace("{powers}", names);
    // Only a history-decided trace has a turn that produced a single winner;
    // a trace may still narrow 3 powers to 2 and then run out of records, and
    // that remainder is settled by Impulse Order, not by the narrowing turn.
    const decisive = trace.decidedBy === "history" ? trace.steps.at(-1) : undefined;
    if (decisive === undefined) {
        return `${stem}${t.vpTieImpulseOrder.replace("{winner}", powerShortName(trace.winner, locale))}`;
    }
    return `${stem}${t.vpTieEarlierTurn
        .replace("{turn}", String(decisive.year))
        .replace("{winner}", powerShortName(trace.winner, locale))
        .replace("{history}", Object.entries(decisive.vp)
            .map(([power, vp]) => `${powerShortName(power as Power, locale)} ${vp}`)
            .join(i18n.chain.vq.punct.list))}`;
};

/** Picks the active locale's name from data that carries English and Chinese labels. */
export const dataName = (def: {nameEn: string; nameZh?: string} | undefined): string =>
    def === undefined ? "" : (i18n.getLocaleName() === "en" ? def.nameEn : (def.nameZh ?? def.nameEn));

export const vqLocaleNow = (): "en" | "zh_CN" => i18n.getLocaleName() === "en" ? "en" : "zh_CN";

/** Localized name of an off-map Foreign War enemy ("Persia" / "Poland"). */
export const foreignWarEnemyName = (enemy: string | undefined): string =>
    enemy === undefined ? "" : (i18n.chain.vq.actionUi.foreignWarEnemy as Record<string, string>)[enemy] ?? enemy;

/**
 * The pending resolution that keeps the active power from taking actions,
 * phrased for a disabled-button tooltip; undefined when nothing is pending.
 */
export const blockingPendingReason = (G: VQGame): string | undefined => {
    const b = i18n.chain.vq.turn.blocked;
    const what = G.pendingBattle || G.pendingReliefSplit ? b.battle
        : G.pendingEspionage ? b.espionage
        : G.pendingIntercept || G.pendingInterceptionOrder || G.pendingBeacon ? b.interception
        : G.pendingCardEvent || G.pendingTutorialEvent || G.gregorianResponse || G.pendingAbjuration ? b.cardEvent
        : G.pendingPiracy ? b.piracy
        : G.pendingPolishElection ? b.election
        : G.pendingCityRebels || G.pendingRebelMove ? b.rebels
        : G.pendingTribute ? b.tribute
        : G.pendingMutiny ? b.mutiny
        : G.pendingForeignWar ? b.foreignWar
        : G.pendingActivation ? b.activation
        : G.pendingAction ? b.other
        : undefined;
    return what === undefined ? undefined : i18n.chain.vq.turn.resolveFirst.replace("{what}", what);
};

/** Localized label for a land space or sea zone id. */
export const placeLabel = (id: string): string =>
    SPACE_BY_ID[id] !== undefined ? spaceName(id, vqLocaleNow()) : seaZoneName(id, vqLocaleNow());

/** Localized leader name for a counter id. */
export const leaderLabel = (id: string): string => leaderName(id, vqLocaleNow());

/** Localized royal name for a runtime royal. */
export const royalLabel = (royal: {name: string; nameZh?: string}): string =>
    vqLocaleNow() === "en" ? royal.name : (royal.nameZh ?? royal.name);

/** Localized patron name (`RuntimePatron` stores the English name in `name`). */
export const patronLabel = (patron: {name: string; nameZh?: string}): string =>
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
        .map((responder) => ({responder, label: powerName(responder, vqLocaleNow()),
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
export {abjurationOfferDetails, abjurationOffers, abjurationSelection, abjurationOfferMove, acceptAbjurationOffer} from "../../abjuration";
export type {AbjurationOffer} from "../../abjuration";

export type HolyLeagueTrack = "papacy" | "venice" | "hre";

/** Track names follow the active locale, so they are resolved on each call. */
export const holyLeagueTrackName = (track: HolyLeagueTrack): string =>
    track === "hre" ? powerName("hre", vqLocaleNow()) : minorName(track, vqLocaleNow());

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
            label: tracks.map((track, index) => `${holyLeagueTrackName(track)} +${shares[index]}`).join(i18n.chain.vq.punct.comma),
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
        const vqLocale = vqLocaleNow();
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
export const armyMutinyOwnerOptions = (G: VQGame, spaceId: string, locale: "en" | "zh_CN" = vqLocaleNow()): ArmyMutinyOwnerOption[] => {
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
    const vqLocale = vqLocaleNow();
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
        return merc > 0 ? [{value: power, label: `${powerName(power, vqLocaleNow())}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.merc} ${merc}${i18n.chain.vq.punct.closeParen}`}] : [];
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
export const germanRecruitmentStoredPicks = (value: GermanRecruitmentSelection): GermanRecruitmentPick[] => {
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

export const germanRecruitmentMaxSpaces = (
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
export interface EventSelectionState {
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

export const EMPTY_EVENT_SELECTION: EventSelectionState = {
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

export type EventSelectionAction =
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
export const eventSelectionReducer = (state: EventSelectionState, action: EventSelectionAction): EventSelectionState => {
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
export const staffordCards = (G: VQGame, power: Power): string[] =>
    G.powers[power].cards.filter((id) => cardById(id).kind !== "home");

/** Target powers that have at least one discardable card or treasure. */
export const staffordPowerOptions = (G: VQGame): StaffordPowerOption[] =>
    POWERS.flatMap((power) => {
        const cards = staffordCards(G, power).length;
        const treasures = G.powers[power].treasures.length;
        return cards === 0 && treasures === 0 ? [] : [{
            value: power,
            label: `${powerName(power, vqLocaleNow())}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.hand} ${cards}${i18n.chain.vq.punct.comma}${i18n.chain.vq.board.treasure} ${treasures}${i18n.chain.vq.punct.closeParen}`,
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
            return {value: `card:${id}`, label: `${cardName(id, vqLocaleNow())}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.hand} ${def.cp} CP${i18n.chain.vq.punct.closeParen}`};
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
            label: `${i18n.chain.vq.board.retrievePlay} ${cardName(cardId, vqLocaleNow())}`,
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

export const patronageAwardSummary = (awards: PatronageVpAward[], kind: "artist" | "scientist"): string => {
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

export const cell = (v: number): string => (v > 0 ? String(v) : "\u2014");

/** Scanned card art, with the text tile as the fallback when it is missing. */
export const CardArt = ({def, className, lazy = false}: {def: CardDef; className: string; lazy?: boolean}) => {
    const [failed, setFailed] = React.useState(false);
    const src = cardImageUrl(def);
    if (src === undefined || failed) return null;
    return <img className={className} src={src} alt={`${cardName(def.id, vqLocaleNow())} ${i18n.chain.vq.board.cardImage}`} width={376} height={526}
        loading={lazy ? "lazy" : "eager"} onError={() => setFailed(true)}/>;
};

/** The five printed card types, so the tray/detail match the card face. */
export const cardKindLabel = (def: CardDef): string => {
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
