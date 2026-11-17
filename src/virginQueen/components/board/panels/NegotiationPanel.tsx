import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {Power, POWERS, isPower, powerName} from "../../../constant/general";
import {LEADER_BY_ID} from "../../../constant/leaders";
import {ownerOf, samePlayer} from "../../../ownership";
import {
    GiftKind,
    NegotiationIssue,
    NegotiationTerm,
    NegotiationTermKind,
    NavalLoanShip,
    loanOptions,
    negotiationTermText,
    returnableLeaders,
    royalPairs,
    validateNegotiation,
    yieldableSpaces,
} from "../../../negotiation";
import {leaderLabel, placeLabel, royalLabel} from "../helpers";
import {useVQBoard} from "../BoardContext";

const GIFT_LIMIT: Record<GiftKind, number> = {cards: 2, treasures: 2, mercenaries: 4};
const SHIP_LABEL: Record<NavalLoanShip, "galley" | "galleon" | "racebuilt"> = {
    galley: "galley", galleon: "galleon", racebuilt: "racebuilt",
};

type Direction = "give" | "take";

const DEFAULT_KIND: NegotiationTermKind = "cards";

/**
 * Rule 9.1 negotiation table.  The panel builds a private offer from the
 * binding clauses only; the engine revalidates every clause when the other
 * power seals it.  Non-binding promises are visibly separated so nobody
 * mistakes them for enforceable terms.
 */
export const NegotiationPanel = () => {
    const {G, ctx, moves, playerID, vqLocale, me, myTurn, diploTargetValue, setDiploTarget, switchToTab, hotseatWaitHint} = useVQBoard();
    const [terms, setTerms] = React.useState<NegotiationTerm[]>([]);
    const [promises, setPromises] = React.useState<{from: Power; text: string}[]>([]);
    const [promiseText, setPromiseText] = React.useState("");
    const [kind, setKind] = React.useState<NegotiationTermKind>(DEFAULT_KIND);
    const [direction, setDirection] = React.useState<Direction>("give");
    const [count, setCount] = React.useState(1);
    const [space, setSpace] = React.useState("");
    const [leader, setLeader] = React.useState("");
    const [pair, setPair] = React.useState("");
    const [loanFrom, setLoanFrom] = React.useState("");
    const [loanLeader, setLoanLeader] = React.useState("");
    const [loanShip, setLoanShip] = React.useState<NavalLoanShip>("galley");
    const [countering, setCountering] = React.useState(false);
    const [dealTarget, setDealTarget] = React.useState<Power | "">("");

    const offer = G.negotiation?.offer ?? null;
    const offerId = offer?.id ?? "";
    const isRecipient = offer !== null && playerID !== null && ownerOf(G, offer.to) === playerID;
    const isProposer = offer !== null && playerID !== null && ownerOf(G, offer.from) === playerID;
    const myStage = playerID !== null ? ctx.activePlayers?.[playerID] : undefined;
    const canRespond = isRecipient && myStage === "dealResponse";
    const canWithdraw = isProposer && myStage === "dealOffer";

    React.useEffect(() => {
        setTerms([]);
        setPromises([]);
        setPromiseText("");
        setCountering(false);
        setDealTarget("");
    }, [offerId, me]);

    const targets = me === undefined ? [] : POWERS.filter((power) =>
        power !== me && ownerOf(G, power) !== undefined && !samePlayer(G, me, power));
    const target: Power | undefined = countering && offer !== null
        ? offer.from
        : isPower(dealTarget) && targets.includes(dealTarget)
            ? dealTarget
            : targets.includes(diploTargetValue) ? diploTargetValue : targets[0];

    const issueText = (issue: NegotiationIssue): string => {
        const strings = i18n.chain.vq.negotiationUi.issues as unknown as Record<string, string>;
        const template = strings[issue.code] ?? i18n.chain.vq.negotiationUi.invalid;
        return Object.entries(issue.params ?? {}).reduce(
            (text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
    };
    const issues = me !== undefined && target !== undefined
        ? validateNegotiation(G, me, target, terms, promises, {approxResources: true, viewer: me})
        : [];
    const targetBlocked = target === undefined;

    const pairOptions = React.useMemo(() => target === undefined || me === undefined
        ? [] : royalPairs(G, me, target), [G, me, target]);
    const yieldOptions = React.useMemo(() => {
        if (target === undefined || me === undefined) return [];
        return direction === "give" ? yieldableSpaces(G, me, target) : yieldableSpaces(G, target, me);
    }, [G, me, target, direction]);
    const leaderOptions = React.useMemo(() => {
        if (target === undefined || me === undefined) return [];
        return direction === "give" ? returnableLeaders(G, me, target) : returnableLeaders(G, target, me);
    }, [G, me, target, direction]);
    const loans = React.useMemo(() => target === undefined || me === undefined
        ? [] : loanOptions(G, me, target), [G, me, target]);
    const activeLoan = loans.find((loan) => loan.fromPort === loanFrom) ?? loans[0];
    const availableShips = activeLoan === undefined ? []
        : (["galley", "galleon", "racebuilt"] as const).filter((ship) => activeLoan.ships[ship] > 0);
    const ship = availableShips.includes(loanShip) ? loanShip : availableShips[0];
    const navalLeaders = activeLoan === undefined ? []
        : (G.spaces[activeLoan.fromPort]?.leaders ?? []).filter((id) =>
            LEADER_BY_ID[id]?.kind === "naval" && LEADER_BY_ID[id]?.power === me);

    React.useEffect(() => {
        if (kind !== "yieldSpace") return;
        setSpace((current) => yieldOptions.includes(current) ? current : (yieldOptions[0] ?? ""));
    }, [kind, yieldOptions]);
    React.useEffect(() => {
        if (kind !== "returnLeader") return;
        setLeader((current) => leaderOptions.includes(current) ? current : (leaderOptions[0] ?? ""));
    }, [kind, leaderOptions]);
    React.useEffect(() => {
        if (kind !== "betrothal") return;
        setPair((current) => pairOptions.some((option) => `${option.male.id}:${option.female.id}` === current)
            ? current : (pairOptions[0] === undefined ? "" : `${pairOptions[0].male.id}:${pairOptions[0].female.id}`));
    }, [kind, pairOptions]);
    React.useEffect(() => {
        if (kind !== "navalLoan") return;
        setLoanFrom((current) => loans.some((loan) => loan.fromPort === current)
            ? current : (loans[0]?.fromPort ?? ""));
        setLoanLeader((current) => navalLeaders.includes(current) ? current : "");
    }, [kind, loans, navalLeaders]);

    if (me === undefined) return null;

    const resetDraft = (): void => {
        setTerms([]);
        setPromises([]);
        setPromiseText("");
        setCountering(false);
    };

    const addTerm = (): void => {
        if (target === undefined) return;
        if (kind === "peace" || kind === "alliance") {
            if (!terms.some((term) => term.kind === kind)) setTerms([...terms, {kind}]);
            return;
        }
        if (kind === "cards" || kind === "treasures" || kind === "mercenaries") {
            const from = direction === "give" ? me : target;
            const to = direction === "give" ? target : me;
            setTerms([...terms, {kind, from, to, count}]);
            return;
        }
        if (kind === "yieldSpace") {
            if (space === "") return;
            const from = direction === "give" ? me : target;
            const to = direction === "give" ? target : me;
            setTerms([...terms, {kind, from, to, space}]);
            return;
        }
        if (kind === "returnLeader") {
            if (leader === "") return;
            const from = direction === "give" ? me : target;
            const to = direction === "give" ? target : me;
            setTerms([...terms, {kind, from, to, leaderId: leader}]);
            return;
        }
        if (kind === "betrothal") {
            const [male, female] = pair.split(":");
            if (male === undefined || female === undefined || male === "" || female === "") return;
            setTerms([...terms, {kind: "betrothal", male, female}]);
            return;
        }
        if (kind === "navalLoan") {
            if (!terms.some((term) => term.kind === "alliance") || activeLoan === undefined || ship === undefined) return;
            setTerms([...terms, {
                kind: "navalLoan", from: me, to: target,
                fromPort: activeLoan.fromPort, toPort: activeLoan.toPort, ship,
                ...(loanLeader !== "" ? {leader: loanLeader} : {}),
            }]);
        }
    };

    const addPromise = (): void => {
        const text = promiseText.trim();
        if (text === "" || promises.length >= 4) return;
        setPromises([...promises, {from: me, text}]);
        setPromiseText("");
    };

    const send = (): void => {
        if (target === undefined || terms.length === 0 || issues.length > 0) return;
        if (countering && offer !== null) {
            moves.counterDeal({offerId: offer.id, terms, promises});
        } else {
            moves.proposeDeal({target, terms, promises});
        }
        // The draft is kept until the offer id changes.  If the server rejects
        // the move (for example an opponent's hidden hand changed), the player
        // still has the clauses on screen to adjust.
    };

    const counterpart = offer === null ? undefined : isRecipient ? offer.from : offer.to;
    const visibleHistory = (G.negotiation?.history ?? []).filter((record) => record.year === G.year).slice(-3).reverse();
    const kindOptions = ([
        {kind: "peace", label: i18n.chain.vq.negotiationUi.kinds.peace},
        {kind: "alliance", label: i18n.chain.vq.negotiationUi.kinds.alliance},
        {kind: "cards", label: i18n.chain.vq.negotiationUi.kinds.cards},
        {kind: "treasures", label: i18n.chain.vq.negotiationUi.kinds.treasures},
        {kind: "mercenaries", label: i18n.chain.vq.negotiationUi.kinds.mercenaries},
        {kind: "yieldSpace", label: i18n.chain.vq.negotiationUi.kinds.yieldSpace},
        {kind: "returnLeader", label: i18n.chain.vq.negotiationUi.kinds.returnLeader},
        {kind: "betrothal", label: i18n.chain.vq.negotiationUi.kinds.betrothal},
        {kind: "navalLoan", label: i18n.chain.vq.negotiationUi.kinds.navalLoan},
    ] as {kind: NegotiationTermKind; label: string}[]).filter((option) => option.kind !== "betrothal" || me !== "ottoman");

    return <Box sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
        <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{alignItems: "center", flexWrap: "wrap"}}>
                <Typography variant="subtitle2">{i18n.chain.vq.negotiationUi.title}</Typography>
                <Chip size="small" variant="outlined" label={i18n.chain.vq.negotiationUi.rule}/>
            </Stack>
            <Typography variant="caption" color="text.secondary">{i18n.chain.vq.negotiationUi.note}</Typography>
            {hotseatWaitHint() !== undefined && <Typography variant="body2" color="text.secondary">{hotseatWaitHint()}</Typography>}

            {offer !== null && <Box sx={{p: 1, borderRadius: 1, bgcolor: "action.hover"}}>
                <Stack spacing={0.5}>
                    <Typography variant="subtitle2">
                        {isRecipient ? i18n.chain.vq.negotiationUi.incomingFrom : i18n.chain.vq.negotiationUi.yourOfferTo}
                        {" "}{counterpart === undefined ? "" : <b>{powerName(counterpart, vqLocale)}</b>}
                    </Typography>
                    {offer.terms.map((term, index) =>
                        <Typography key={`${offer.id}-${index}`} variant="body2">• {negotiationTermText(G, term, vqLocale)}</Typography>)}
                    {offer.promises.length > 0 && <>
                        <Typography variant="caption" color="text.secondary">{i18n.chain.vq.negotiationUi.nonBinding}</Typography>
                        {offer.promises.map((promise, index) =>
                            <Typography key={`${offer.id}-p-${index}`} variant="caption" color="text.secondary">
                                “{promise.text}” — {i18n.chain.vq.negotiationUi.promiseBy} {powerName(promise.from, vqLocale)}
                            </Typography>)}
                    </>}
                    {isProposer && <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.negotiationUi.waiting} {powerName(offer.to, vqLocale)} {i18n.chain.vq.negotiationUi.waitingSuffix}
                    </Typography>}
                    {canRespond && <Stack direction="row" spacing={1} sx={{flexWrap: "wrap"}}>
                        <Button size="small" variant="contained" color="success"
                                onClick={() => moves.respondDeal({offerId: offer.id, action: "accept"})}>
                            {i18n.chain.vq.negotiationUi.accept}
                        </Button>
                        <Button size="small" variant="outlined" color="error"
                                onClick={() => moves.respondDeal({offerId: offer.id, action: "reject"})}>
                            {i18n.chain.vq.negotiationUi.reject}
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => {
                            setCountering(true);
                            setDealTarget(offer.from);
                            // Symmetric clauses can be kept; directional ones
                            // would point the wrong way in a counter-offer.
                            setTerms(offer.terms.filter((term) => term.kind === "peace" || term.kind === "alliance"));
                            setPromises([]);
                        }}>{i18n.chain.vq.negotiationUi.counter}</Button>
                    </Stack>}
                    {canWithdraw && <Button size="small" variant="outlined"
                        onClick={() => moves.withdrawDeal({offerId: offer.id})}>
                        {i18n.chain.vq.negotiationUi.withdraw}
                    </Button>}
                </Stack>
            </Box>}

            {(offer === null || countering) && <Stack spacing={1}>
                {countering && <Box sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                    <Typography variant="subtitle2">
                        {i18n.chain.vq.negotiationUi.countering} {offer === null ? "" : powerName(offer.from, vqLocale)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{i18n.chain.vq.negotiationUi.counterHint}</Typography>
                </Box>}
                {!countering && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-deal-target">{i18n.chain.vq.negotiationUi.target}</InputLabel>
                    <Select labelId="vq-deal-target" label={i18n.chain.vq.negotiationUi.target}
                            value={target ?? ""} disabled={!myTurn}
                            onChange={(event) => {
                                const value = event.target.value as Power;
                                setDealTarget(value);
                                setDiploTarget(value);
                                setTerms([]);
                            }}>
                        {targets.map((power) => <MenuItem key={power} value={power}>
                            {powerName(power, vqLocale)}
                        </MenuItem>)}
                    </Select>
                </FormControl>}
                {targetBlocked && <Typography variant="caption" color="warning.main">
                    {i18n.chain.vq.negotiationUi.targetBlocked}
                </Typography>}
                <Typography variant="subtitle2">{i18n.chain.vq.negotiationUi.builder}</Typography>
                <Stack direction={{xs: "column", sm: "row"}} spacing={0.5}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-deal-kind">{i18n.chain.vq.negotiationUi.kind}</InputLabel>
                        <Select labelId="vq-deal-kind" label={i18n.chain.vq.negotiationUi.kind} value={kind}
                                onChange={(event) => setKind(event.target.value as NegotiationTermKind)}>
                            {kindOptions.map((option) => <MenuItem key={option.kind} value={option.kind}>{option.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    {(kind === "cards" || kind === "treasures" || kind === "mercenaries" ||
                        kind === "yieldSpace" || kind === "returnLeader") && <FormControl size="small" fullWidth>
                        <InputLabel id="vq-deal-direction">{i18n.chain.vq.negotiationUi.direction}</InputLabel>
                        <Select labelId="vq-deal-direction" label={i18n.chain.vq.negotiationUi.direction} value={direction}
                                onChange={(event) => setDirection(event.target.value as Direction)}>
                            <MenuItem value="give">{i18n.chain.vq.negotiationUi.give}</MenuItem>
                            <MenuItem value="take">{i18n.chain.vq.negotiationUi.take}</MenuItem>
                        </Select>
                    </FormControl>}
                </Stack>

                {(kind === "cards" || kind === "treasures" || kind === "mercenaries") && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-deal-count">{i18n.chain.vq.negotiationUi.count}</InputLabel>
                    <Select labelId="vq-deal-count" label={i18n.chain.vq.negotiationUi.count} value={count}
                            onChange={(event) => setCount(Number(event.target.value))}>
                        {Array.from({length: GIFT_LIMIT[kind]}, (_, index) => index + 1)
                            .map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </Select>
                </FormControl>}

                {kind === "yieldSpace" && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-deal-space">{i18n.chain.vq.negotiationUi.space}</InputLabel>
                    <Select labelId="vq-deal-space" label={i18n.chain.vq.negotiationUi.space} value={space}
                            onChange={(event) => setSpace(event.target.value)}>
                        {yieldOptions.map((id) => <MenuItem key={id} value={id}>{placeLabel(id)}</MenuItem>)}
                    </Select>
                </FormControl>}

                {kind === "returnLeader" && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-deal-leader">{i18n.chain.vq.negotiationUi.leader}</InputLabel>
                    <Select labelId="vq-deal-leader" label={i18n.chain.vq.negotiationUi.leader} value={leader}
                            onChange={(event) => setLeader(event.target.value)}>
                        {leaderOptions.map((id) => <MenuItem key={id} value={id}>{leaderLabel(id)}</MenuItem>)}
                    </Select>
                </FormControl>}

                {kind === "betrothal" && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-deal-pair">{i18n.chain.vq.negotiationUi.royalPair}</InputLabel>
                    <Select labelId="vq-deal-pair" label={i18n.chain.vq.negotiationUi.royalPair} value={pair}
                            onChange={(event) => setPair(event.target.value)}>
                        {pairOptions.map((option) => {
                            const value = `${option.male.id}:${option.female.id}`;
                            return <MenuItem key={value} value={value}>
                                {royalLabel(option.male)} ↔ {royalLabel(option.female)}
                            </MenuItem>;
                        })}
                    </Select>
                </FormControl>}

                {kind === "navalLoan" && (!terms.some((term) => term.kind === "alliance")
                    ? <Typography variant="caption" color="warning.main">{i18n.chain.vq.negotiationUi.loanNeedsAlliance}</Typography>
                    : activeLoan === undefined || ship === undefined
                        ? <Typography variant="caption" color="warning.main">{i18n.chain.vq.negotiationUi.noLoan}</Typography>
                        : <Stack direction={{xs: "column", sm: "row"}} spacing={0.5}>
                            <FormControl size="small" fullWidth>
                                <InputLabel id="vq-deal-loan-from">{i18n.chain.vq.negotiationUi.loanFrom}</InputLabel>
                                <Select labelId="vq-deal-loan-from" label={i18n.chain.vq.negotiationUi.loanFrom}
                                        value={activeLoan.fromPort}
                                        onChange={(event) => { setLoanFrom(event.target.value); setLoanLeader(""); }}>
                                    {loans.map((loan) => <MenuItem key={loan.fromPort} value={loan.fromPort}>
                                        {placeLabel(loan.fromPort)}
                                    </MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl size="small" fullWidth>
                                <InputLabel id="vq-deal-loan-ship">{i18n.chain.vq.negotiationUi.ship}</InputLabel>
                                <Select labelId="vq-deal-loan-ship" label={i18n.chain.vq.negotiationUi.ship} value={ship}
                                        onChange={(event) => setLoanShip(event.target.value as NavalLoanShip)}>
                                    {availableShips.map((option) => <MenuItem key={option} value={option}>
                                        {i18n.chain.vq.board[SHIP_LABEL[option]]}
                                    </MenuItem>)}
                                </Select>
                            </FormControl>
                            {navalLeaders.length > 0 && <FormControl size="small" fullWidth>
                                <InputLabel id="vq-deal-loan-leader">{i18n.chain.vq.negotiationUi.admiral}</InputLabel>
                                <Select labelId="vq-deal-loan-leader" label={i18n.chain.vq.negotiationUi.admiral}
                                        value={loanLeader} onChange={(event) => setLoanLeader(event.target.value)}>
                                    <MenuItem value="">{i18n.chain.vq.negotiationUi.noAdmiral}</MenuItem>
                                    {navalLeaders.map((id) => <MenuItem key={id} value={id}>{leaderLabel(id)}</MenuItem>)}
                                </Select>
                            </FormControl>}
                        </Stack>)}
                <Button size="small" variant="outlined" onClick={addTerm}
                        disabled={target === undefined || (kind === "navalLoan" &&
                            (!terms.some((term) => term.kind === "alliance") || activeLoan === undefined || ship === undefined))}>
                    {i18n.chain.vq.negotiationUi.add}
                </Button>
                {terms.length > 0 && <Stack spacing={0.25}>
                    {terms.map((term, index) => <Stack key={`draft-${index}`} direction="row" spacing={0.5} sx={{alignItems: "center"}}>
                        <Typography variant="body2" sx={{flex: 1}}>• {negotiationTermText(G, term, vqLocale)}</Typography>
                        <Button size="small" onClick={() => setTerms(terms.filter((_, i) => i !== index))}>×</Button>
                    </Stack>)}
                </Stack>}
                {terms.length === 0 && <Typography variant="caption" color="text.secondary">
                    {i18n.chain.vq.negotiationUi.empty}
                </Typography>}
                <Divider/>
                <TextField size="small" fullWidth label={i18n.chain.vq.negotiationUi.promises}
                           value={promiseText} onChange={(event) => setPromiseText(event.target.value)}
                           slotProps={{htmlInput: {maxLength: 160}}}
                           helperText={i18n.chain.vq.negotiationUi.promiseHint}/>
                <Button size="small" variant="outlined" onClick={addPromise}
                        disabled={promiseText.trim() === "" || promises.length >= 4}>
                    {i18n.chain.vq.negotiationUi.addPromise}
                </Button>
                {promises.map((promise, index) => <Stack key={`promise-${index}`} direction="row" spacing={0.5}>
                    <Typography variant="caption" sx={{flex: 1}}>“{promise.text}”</Typography>
                    <Button size="small" onClick={() => setPromises(promises.filter((_, i) => i !== index))}>×</Button>
                </Stack>)}
                {issues.length > 0 && <Stack spacing={0.25}>
                    <Typography variant="caption" color="error.main">{i18n.chain.vq.negotiationUi.invalid}</Typography>
                    {issues.slice(0, 4).map((issue, index) =>
                        <Typography key={`issue-${index}`} variant="caption" color="error.main">• {issueText(issue)}</Typography>)}
                </Stack>}
                {issues.length === 0 && terms.length > 0 && <Typography variant="caption" color="success.main">
                    {i18n.chain.vq.negotiationUi.valid}
                </Typography>}
                <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" onClick={send}
                            disabled={(!myTurn && !countering) || (countering && !canRespond) ||
                                target === undefined || terms.length === 0 || issues.length > 0}>
                        {countering ? i18n.chain.vq.negotiationUi.sendCounter : i18n.chain.vq.negotiationUi.send}
                    </Button>
                    {countering && <Button size="small" variant="outlined"
                            onClick={() => { setCountering(false); resetDraft(); }}>
                        {i18n.chain.vq.negotiationUi.cancel}
                    </Button>}
                </Stack>
            </Stack>}

            {visibleHistory.length > 0 && <>
                <Divider/>
                <Typography variant="subtitle2">{i18n.chain.vq.negotiationUi.history}</Typography>
                {visibleHistory.map((record) => <Stack key={record.id} spacing={0.25} sx={{p: 0.5, bgcolor: "action.hover", borderRadius: 1}}>
                    <Typography variant="caption" color="text.secondary">
                        {powerName(record.proposer, vqLocale)} ↔ {powerName(record.confirmer, vqLocale)}
                    </Typography>
                    {record.terms.map((term, index) =>
                        <Typography key={`${record.id}-${index}`} variant="body2">• {negotiationTermText(G, term, vqLocale)}</Typography>)}
                    {record.promises.map((promise, index) =>
                        <Typography key={`${record.id}-p-${index}`} variant="caption" color="text.secondary">
                            “{promise.text}” — {i18n.chain.vq.negotiationUi.nonBinding}
                        </Typography>)}
                </Stack>)}
            </>}
            {switchToTab(offer?.to) !== undefined && <Typography variant="caption" color="text.secondary">{switchToTab(offer?.to)}</Typography>}
        </Stack>
    </Box>;
};
