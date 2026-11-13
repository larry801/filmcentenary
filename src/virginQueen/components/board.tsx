import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import {VQSurface} from "./theme";
import {ConfirmDialog} from "./board/ConfirmDialog";
import {StepBanner} from "./board/StepBanner";
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
import {PendingTributePanel} from "./board/PendingPanels/TributePanel";
import {PendingMutinyPanel} from "./board/PendingPanels/MutinyPanel";
import {PendingBattlePanel} from "./board/PendingPanels/BattlePanel";
import {PendingActivationPanel} from "./board/PendingPanels/ActivationPanel";
import {PendingInterceptPanel} from "./board/PendingPanels/InterceptPanel";
import {PendingInterceptionOrderPanel} from "./board/PendingPanels/InterceptionOrderPanel";
import {PendingPolishElectionPanel} from "./board/PendingPanels/PolishElectionPanel";
import ExportLogButton from "../../components/export-log-button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../constant/i18n";
import {CONTROLLER_COLORS, powerName, powerShortName, minorName, landCount, Power, powerAt} from "../constant/general";
import {cardById, cardName} from "../constant/cards";
import {seaZoneName} from "../mapData";
import {formationCapacity, landNeighbors} from "../util";
import {VQMap} from "./map";
import {TutorialGuide} from "./tutorial-guide";
import {ownerOf} from "../ownership";
import {scenarioName} from "../scenario";

import {CardArt, VirginQueenBoardProps, cardKindLabel, gameOverReasonText, placeLabel, vpTieBreakSummary, vqLocaleNow} from "./board/helpers";
import {useBoardState} from "./board/useBoardState";
import {VQBoardContext} from "./board/BoardContext";
import {CardDrawPanel} from "./board/panels/CardDrawPanel";
import {ActionPhasePanel} from "./board/panels/ActionPhasePanel";
import {DiplomacyPanel} from "./board/panels/DiplomacyPanel";
import {SpringPanel} from "./board/panels/SpringPanel";
import {CardDetail} from "./board/panels/CardDetail";
import {SpaceDetail} from "./board/panels/SpaceDetail";
import {IntelPanel} from "./board/panels/IntelPanel";
import {StatusOverlay} from "./board/StatusOverlay";
export * from "./board/helpers";

export const VirginQueenBoard = (props: VirginQueenBoardProps) => {
    const board = useBoardState(props);
    const {setMode, G, log, ctx, moves, playerID, matchID, vqLocale, militaryGoal, selected, isDesktop, mobileView, setMobileView, handExpanded, setHandExpanded, selectedCard, setSelectedCard, actionRef, sidebarRef, panelID, mode, from, setFrom, movingUnits, movingLeaders, setTransportZones, actionNotice, setActionNotice, openCard, gregorianTarget, setGregorianTarget, setSelectedActionResponder, selectedAbjurationPower, setSelectedAbjurationPower, confirmAction, setConfirmAction, sheetOpen, setSheetOpen, formationSheetOpen, setFormationSheetOpen, setViewPower, owned, piracyResponder, actionResponders, myActionChoices, actionResponder, responsePower, me, myTurn, switchToTab, phase, phaseText, displayYear, ps, cp, hand, canAct, vqCombatRetrieve, mapHighlights, stepInfo, stackPicker, formationSummary, onSelect, spaceDef, standings, pendingPower, hasResponse, winterChoiceRequired, needsAction, winterChoiceLabel, panelProps} = board;
    const actionPanel = () => {
        if (G.pendingPolishElection) {
            const bidder = G.pendingPolishElection.remaining[0];
            return <PendingPolishElectionPanel G={G} playerID={playerID}
                onBid={(bid) => moves.choosePolishBid({bid})}
                switchToTab={bidder !== undefined ? switchToTab(bidder) : undefined}/>;
        }
        if (G.pendingEspionage) return <PendingEspionagePanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingAbjuration) return <PendingAbjurationPanel G={G} moves={moves} playerID={playerID}
            selectedPower={selectedAbjurationPower} onSelect={setSelectedAbjurationPower}/>;
        if (G.pendingCityRebels) return <PendingCityRebelsPanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingTribute) return <PendingTributePanel G={G} moves={moves} playerID={playerID}/>;
        if (G.pendingMutiny) return <PendingMutinyPanel G={G} moves={moves} playerID={playerID}/>;
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
            const locale = vqLocale;
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
        if (phase === "cardDraw") return <CardDrawPanel/>;
        if (phase === "action") return <ActionPhasePanel/>;
        if (phase === "diplomacy") return <DiplomacyPanel/>;
        if (phase === "spring") return <SpringPanel/>;
        return null;
    };

    // The power whose move the table is waiting on, and whether that is this seat.
    const turnPower: Power = (hasResponse ? pendingPower : undefined) ?? G.activePower;
    const actingNow = ctx.gameover === undefined && (myTurn || responsePower !== undefined || winterChoiceRequired);
    // A top-score tie is decided by recorded VP, not by the panel order; spell
    // out which turn settled it so the result is not mistaken for a bug.  Only
    // Standard and Time Limit victories are decided by score.
    const tieBreakSummary = ctx.gameover !== undefined && (ctx.gameover.reason === "standard" || ctx.gameover.reason === "timeLimit")
        ? vpTieBreakSummary(G, vqLocale) : undefined;
    const singleClickMode = mode !== "inspect" && mode !== "spring" && mode !== "moveLand" && mode !== "moveNaval" && mode !== "navalTransport";

    return <VQBoardContext.Provider value={board}><VQSurface><div className={`vq-board ${actingNow ? "vq-board--my-turn" : "vq-board--waiting"}`}
        style={{"--vq-turn-color": CONTROLLER_COLORS[turnPower]} as React.CSSProperties}>
        <a className="vq-skip-link" href={`#${panelID}-action`}>{i18n.chain.vq.shell.skipToActions}</a>
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
                <StatusOverlay/>
                {stepInfo !== undefined && <StepBanner steps={stepInfo.steps} active={stepInfo.active}
                    hint={from !== null && (mode === "spring" || mode === "moveLand" || mode === "navalTransport")
                        ? i18n.chain.vq.step.unitsHint
                        : singleClickMode ? (i18n.chain.vq.step.hint as Record<string, string>)[mode] : undefined}
                    onCancel={() => {
                        // A staged origin is undone first; otherwise cancel leaves the action mode.
                        if (from !== null) {setFrom(null); setTransportZones([]);} else if (mode !== "spring") setMode("inspect");
                    }}/>}
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
                <div className="vq-panel-heading"><h2>{ctx.gameover !== undefined ? i18n.chain.vq.shell.gameOver :
                    hasResponse ? i18n.chain.vq.shell.responseSettlement : i18n.chain.vq.shell.currentAction}</h2>
                    {ctx.gameover === undefined && <Chip variant="outlined" label={me ? `${cp} CP` : i18n.chain.vq.shell.spectator}/>}</div>
                {actionNotice !== undefined && <Alert severity="error" sx={{mb: 1}} role="alert"
                    onClose={() => setActionNotice(undefined)}>{actionNotice}</Alert>}
                {owned.length > 1 && <Stack direction="row" spacing={0.5} useFlexGap sx={{flexWrap: "wrap", mb: 1}}>
                    {owned.map((power) => <Button key={power} size="small" disabled={myTurn || !!responsePower}
                        variant={me === power ? "contained" : "outlined"} onClick={() => setViewPower(power)}>{powerName(power, vqLocale)}</Button>)}
                </Stack>}
                {ctx.gameover !== undefined ? <Paper variant="outlined" sx={{p: 1.5, mb: 1}} role="status">
                    <Typography variant="h6">{i18n.chain.vq.shell.gameOver} · {i18n.chain.vq.shell.winner}{i18n.chain.vq.punct.colon}P{Number(ctx.gameover.winner) + 1} {powerName((ctx.gameover.power ?? powerAt(String(ctx.gameover.winner))) as Power, vqLocale)}</Typography>
                    <Typography variant="body2">{i18n.chain.vq.shell.reason}: {gameOverReasonText(ctx.gameover.reason, vqLocale)}</Typography>
                    {tieBreakSummary !== undefined && <Typography variant="caption" component="p">
                        {tieBreakSummary}
                    </Typography>}
                    {ctx.gameover.reason === "military" && ctx.gameover.power !== undefined && <Typography variant="caption">
                        {militaryGoal(ctx.gameover.power as Power)}
                    </Typography>}
                    {ctx.gameover.reason === "catholicReligious" && <Typography variant="caption">
                        {i18n.chain.vq.shell.catholicReligiousRule}
                    </Typography>}
                    {matchID !== undefined && <ExportLogButton gameName="virginQueen" matchID={matchID} log={log}/>}
                </Paper> : actionPanel()}
                <SpaceDetail/>
            </section>
            <IntelPanel/>
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
                <CardDetail id={selectedCard}/>
            </div>}
        </Drawer>
        <DiceToast rolls={ctx.gameover === undefined ? G.lastRolls : undefined}/>
        <Snackbar open={actionNotice !== undefined} autoHideDuration={6000} onClose={() => setActionNotice(undefined)}
                  anchorOrigin={{vertical: isDesktop ? "top" : "bottom", horizontal: "center"}}>
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
    </div></VQSurface></VQBoardContext.Provider>;
};
