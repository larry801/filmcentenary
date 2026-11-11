import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Tooltip from "@mui/material/Tooltip";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, minorName, MINOR_POWERS, POWERS, Power} from "../../../constant/general";
import {cardById} from "../../../constant/cards";
import {LEADER_BY_ID} from "../../../constant/leaders";
import {SPACES} from "../../../mapData";
import {catholicLeagueSpaceOptions, warCost, minorAvailable, seaPathBetweenPorts} from "../../../util";
import {ownerOf} from "../../../ownership";
import {diplomacyActionState, diplomacyBlockText, giftState} from "../../../diplomacyPolicy";

import {betrothalChoices, leaderLabel, placeLabel, royalLabel} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const DiplomacyPanel = () => {
    const {G, ctx, moves, playerID, vqLocale, selected, from, setDiploTarget, loanFromPort, setLoanFromPort, loanToPort, setLoanToPort, loanLeader, setLoanLeader, domesticRoyal, setDomesticRoyal, foreignRoyal, setForeignRoyal, me, myTurn, diploTargetValue, switchToTab, ps, hand, hotseatWaitHint, space} = useVQBoard();
    if (me === undefined) return null;
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
};
