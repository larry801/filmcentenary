import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import {ActionGroup} from "../../theme";
import {LogPanel} from "../LogPanel";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {CONTROLLER_COLORS, powerName, powerShortName, hreReligiousPreferenceName, POWER_INFO, POWERS, rulerName} from "../../../constant/general";
import {cardById, cardName} from "../../../constant/cards";
import {leaderName} from "../../../constant/leaders";
import {baseVp, hreReligiousVp, powerVp, protestantOffMapCount, protestantSpaceCount, religiousSpecialVp, scheduledLeaderEntries} from "../../../util";
import {ownerOf, isActivatedMajor} from "../../../ownership";
import {tutorialFortressVp} from "../../../tutorial";
import {scenarioName} from "../../../scenario";

import {useVQBoard} from "../BoardContext";

/**
 * End-of-turn VP record (the rulebook's Victory Record Sheet), used by the
 * 25.3 tie-breaker.  Powers run down the rows and turns across the columns;
 * headers are bare turn numbers so a seven-turn game still fits the sidebar
 * (the full label lives in each cell's tooltip).
 */
const VpHistoryTable = () => {
    const {G, vqLocale} = useVQBoard();
    const years = Object.keys(G.vpHistory ?? {}).map(Number).sort((a, b) => a - b);
    if (years.length === 0) return null;
    const powers = POWERS.filter((p) => years.some((y) => G.vpHistory[String(y)][p] !== undefined));
    const best = (y: number) => Math.max(...powers.map((p) => G.vpHistory[String(y)][p] ?? 0));
    const cell = {px: 0.25, py: 0.125, textAlign: "right" as const, whiteSpace: "nowrap" as const};
    const turnLabel = (year: number): string => i18n.chain.vq.intel.turnLong.replace("{turn}", String(year));
    return <ActionGroup title={i18n.chain.vq.intel.vpHistory}>
        <Box component="table" className="vq-vp-history" sx={{borderCollapse: "collapse", fontSize: "0.75rem", width: "100%"}}>
            <thead><tr>
                <Box component="th" scope="col" sx={{...cell, textAlign: "left"}}>{i18n.chain.vq.intel.turnColumn}</Box>
                {years.map((y) => <Box component="th" scope="col" key={y} sx={cell} title={turnLabel(y)}>{y}</Box>)}
            </tr></thead>
            <tbody>{powers.map((p) => <tr key={p}>
                <Box component="th" scope="row" sx={{...cell, textAlign: "left", fontWeight: 400}}>
                    <Box component="span" sx={{display: "inline-block", width: 7, height: 7, mr: 0.5, bgcolor: CONTROLLER_COLORS[p], borderRadius: 0.5}}/>
                    {powerShortName(p, vqLocale)}
                </Box>
                {years.map((y) => {
                    const vp = G.vpHistory[String(y)][p];
                    // Bold the outright or shared lead; both sides of a two-way tie mark.
                    const leader = vp !== undefined && vp === best(y);
                    return <Box component="td" key={y} className={leader ? "vq-vp-leader" : undefined}
                                title={`${powerShortName(p, vqLocale)} · ${turnLabel(y)} · ${vp ?? "–"} VP`}
                                sx={{...cell, fontWeight: leader ? 700 : 400}}>
                        {vp ?? "–"}
                    </Box>;
                })}
            </tr>)}</tbody>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
            {i18n.chain.vq.intel.vpHistoryHint}
        </Typography>
    </ActionGroup>;
};

/**
 * Turn Track visibility: leaders still in the pool with a future arrival turn.
 * Don John and Leicester enter on turn 2, so a turn-1 hotseat sees them under
 * "leaders entering next turn" before anyone has to reveal the schedule.
 */
const LeaderEntrySchedule = () => {
    const {G, vqLocale} = useVQBoard();
    const entries = scheduledLeaderEntries(G);
    if (entries.length === 0) return null;
    const turns = [...new Set(entries.map((entry) => entry.turn))];
    return <Box sx={{mt: 0.5, pt: 0.5, borderTop: 1, borderColor: "divider"}}>
        <Typography variant="caption" sx={{display: "block", fontWeight: 700}}>
            {i18n.chain.vq.intel.leaderEntries}
        </Typography>
        {turns.map((turn) => <Typography key={turn} variant="caption" color="text.secondary"
                                        title={i18n.chain.vq.intel.leaderEntriesHint} sx={{display: "block"}}>
            {turn === G.year + 1
                ? i18n.chain.vq.intel.leadersNextTurn
                : i18n.chain.vq.intel.leadersLaterTurn.replace("{turn}", String(turn))}
            {i18n.chain.vq.punct.colon}
            {entries.filter((entry) => entry.turn === turn).map((entry) =>
                `${leaderName(entry.id, vqLocale)}${i18n.chain.vq.punct.openParen}${powerShortName(entry.power, vqLocale)}${i18n.chain.vq.punct.closeParen}`
            ).join(i18n.chain.vq.punct.list)}
        </Typography>)}
    </Box>;
};

export const IntelPanel = () => {
    const {G, log, playerID, vqLocale, militaryGoalFor, militaryGoal, setSelected, me, ps, panelProps} = useVQBoard();
    return <section className="vq-panel vq-intel" {...panelProps("intel")}>
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
                <Chip size="small" variant="outlined" label={militaryGoal(p)}
                      title={i18n.chain.vq.intel.militaryGoalHint.replace("{goal}", String(militaryGoalFor(p)))}/>
                <Chip size="small" variant="outlined" label={`${G.handCounts?.[p] ?? G.powers[p].cards.length}${i18n.chain.vq.intel.cards}`}/>
                {(G.homeCardSetAsideCounts?.[p] ?? 0) > 0 &&
                    <Chip size="small" variant="outlined" label={`${i18n.chain.vq.intel.faceDown} ${G.homeCardSetAsideCounts?.[p]}`}/>}
                {G.powers[p].wars.length > 0 && <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.intel.war}{i18n.chain.vq.punct.colon}{G.powers[p].wars.map((w) => powerShortName(w, vqLocale)).join("/")}
                </Typography>}
            </Stack>)}
            <LeaderEntrySchedule/>
        </ActionGroup>
        <VpHistoryTable/>
        {me !== undefined && ps !== undefined && <ActionGroup title={i18n.chain.vq.intel.myPower}>
            <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                <Box sx={{width: 14, height: 14, bgcolor: CONTROLLER_COLORS[me], borderRadius: 0.5}}/>
                <Typography variant="subtitle1" sx={{fontWeight: 700}}>{powerName(me, vqLocale)}</Typography>
                <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                <Chip size="small" variant="outlined" label={militaryGoal(me)}
                      title={i18n.chain.vq.intel.militaryGoalHint.replace("{goal}", String(militaryGoalFor(me)))}/>
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
            <Typography variant="body2" title={G.scenario === "tutorial" ? undefined : i18n.chain.vq.intel.protestantSpacesGoalHint}>{scenarioName(G.scenario, vqLocale)} · {i18n.chain.vq.intel.deck} {G.deckCount ?? 0} · {G.scenario === "tutorial"
                ? `${i18n.chain.vq.intel.protestantSpaces} ${protestantSpaceCount(G)}`
                : i18n.chain.vq.intel.protestantSpacesGoal.replace("{count}", String(protestantSpaceCount(G)))}</Typography>
            {G.scenario !== "tutorial" && <Typography variant="body2" title={protestantOffMapCount(G) > 0
                ? `${i18n.chain.vq.intel.protestantSpacesGoalHint} ${i18n.chain.vq.intel.protestantOffMapHint}`
                : i18n.chain.vq.intel.protestantSpacesGoalHint}>
                {i18n.chain.vq.intel.catholicReligiousGoal}
                {protestantOffMapCount(G) > 0 && ` · ${i18n.chain.vq.intel.protestantOffMap.replace("{count}", String(protestantOffMapCount(G)))}`}
            </Typography>}
            {G.scenario !== "tutorial" && <Typography variant="body2" title={i18n.chain.vq.intel.militaryGoalSummaryHint}>
                {i18n.chain.vq.intel.militaryGoalSummary.replace("{targets}",
                    POWERS.map((p) => `${powerShortName(p, vqLocale)} ${POWER_INFO[p].autoWinKeys}`).join(" / "))}
            </Typography>}
            {G.scenario !== "tutorial" && <Typography variant="body2" title={i18n.chain.vq.intel.vpVictoryGoalHint}>
                {i18n.chain.vq.intel.vpVictoryGoal}
            </Typography>}
            {G.scenario === "tutorial" && <>
                <Typography variant="body2">{i18n.chain.vq.intel.tutorialOttoman}</Typography>
                <Typography variant="body2">{i18n.chain.vq.intel.tutorialOttoman2} {powerVp(G, "ottoman")} VP ({i18n.chain.vq.intel.keys} {baseVp(G, "ottoman")}, {i18n.chain.vq.intel.fortress} {tutorialFortressVp(G)}, {i18n.chain.vq.intel.other} {G.powers.ottoman.bonusVp}). {i18n.chain.vq.intel.remainingTurns}: {Math.max(0, 4 - G.year)}.</Typography>
            </>}
        </ActionGroup>
    </section>;
};
