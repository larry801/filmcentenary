import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Tooltip from "@mui/material/Tooltip";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, landCount, VQGame} from "../../../constant/general";
import {LEADER_BY_ID} from "../../../constant/leaders";
import {SPACES} from "../../../mapData";
import {landNeighbors} from "../../../util";
import {ownerOf} from "../../../ownership";
import {blockingPendingReason} from "../helpers";

import {leaderLabel, placeLabel, unitLabel} from "../helpers";
import {useVQBoard} from "../BoardContext";
import Alert from "@mui/material/Alert";
import {CONTROLLER_COLORS} from "../../../constant/general";
import {foreignWarEnemyName} from "../helpers";
import {ActionModePicker} from "./ActionModePicker";
import {ActionExtras} from "./ActionExtras";

export const ActionPhasePanel = () => {
    const {G, moves, playerID, ctx, vqLocale, from, foreignWarUnits, setForeignWarUnits, foreignWarLeader, setForeignWarLeader, setConfirmAction, me, myTurn, ps, cp, hand, passBlockCodes, passBlockReason, endImpulseBlocked, hotseatWaitHint, space} = useVQBoard();
    if (me === undefined) return null;
    const movementPending = !!(G.pendingWithdraw || G.pendingContinue);
    const movementBlockedReason = movementPending ? blockingPendingReason(G) : undefined;
    return <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
            <Typography variant="body2">{i18n.chain.vq.board.remainingCp}: <b>{cp}</b></Typography>
            {ps !== undefined && (ps.jiltedCp ?? 0) > 0 && <Chip size="small" color="warning"
                label={`${i18n.chain.vq.diplomacy.jiltedCp}: ${ps.jiltedCp}`}/>}
            <Chip size="small" label={`${i18n.chain.vq.board.hand} ${hand.length}`}/>
            {ps !== undefined && ps.cardPlayed && <Chip size="small" color="success" label={i18n.chain.vq.board.playedThisTurn}/>}
        </Stack>
        {hotseatWaitHint() !== undefined && <Alert severity="info" icon={false} className="vq-waiting" role="status">
            <i className="vq-dot" style={{background: CONTROLLER_COLORS[G.activePower]}} aria-hidden="true"/> {hotseatWaitHint()}
        </Alert>}
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
                <Button size="small" variant="outlined" disabled={ctx.gameover !== undefined || ownerOf(G, G.pendingWithdraw.defender) !== playerID}
                    onClick={() => moves.chooseWithdraw({withdraw: true})}>{i18n.chain.vq.board.retreatInto}</Button>
                <Button size="small" variant="outlined" color="error" disabled={ctx.gameover !== undefined || ownerOf(G, G.pendingWithdraw.defender) !== playerID}
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
                {landNeighbors(G.pendingContinue.space).map((neighbor) => {
                    // Rule 13.4: continuing costs 1 CP, or 2 CP across a pass.
                    // Pass crossings used to be filtered out entirely, which hid
                    // a legal (if expensive) continuation from the player.
                    const cost = neighbor.pass ? 2 : 1;
                    return <Button key={neighbor.id} size="small" variant="outlined" disabled={!myTurn || cp < cost}
                        onClick={() => moves.continueMove({to: neighbor.id})}>
                        {placeLabel(neighbor.id)}{neighbor.pass ? ` (${cost} CP)` : ""}
                    </Button>;
                })}
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
        <ActionModePicker/>
        <Divider/>
        {/* Danger zone: pass is muted and pushed away from the primary end-impulse action. */}
        {myTurn && endImpulseBlocked && passBlockReason !== undefined &&
            <Typography variant="caption" color="error" role="status">{passBlockReason}</Typography>}
        <div className="vq-turn-actions">
            <Tooltip title={!myTurn ? i18n.chain.vq.turn.notYourTurn : movementBlockedReason ?? passBlockReason ?? ""}>
                <span>
                    <Button size="small" color="inherit" variant="text" className="vq-pass"
                            disabled={!myTurn || movementPending || passBlockCodes.length > 0}
                            onClick={() => setConfirmAction("pass")}>{i18n.chain.vq.turn.pass}</Button>
                </span>
            </Tooltip>
            <Tooltip title={!myTurn ? i18n.chain.vq.turn.notYourTurn : movementBlockedReason ?? (endImpulseBlocked ? passBlockReason ?? "" : "")}>
                <span>
                    <Button size="small" variant="contained" className="vq-end-impulse"
                            disabled={!myTurn || movementPending || endImpulseBlocked}
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
            <Typography variant="subtitle2">{i18n.chain.vq.actionUi.foreignWarSetup} · {foreignWarEnemyName(G.foreignWars[me]?.enemy)}</Typography>
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
            <Typography variant="subtitle2">{i18n.chain.vq.actionUi.foreignWarActive} · {foreignWarEnemyName(G.foreignWars[me]?.enemy)}</Typography>
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
        <ActionExtras/>
    </Stack>;
};
