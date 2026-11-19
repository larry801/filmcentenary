import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Player} from "../Game";
import {Link, useNavigate} from "react-router-dom";
import {createMatch, Visibility} from "../api/match";
import Button from "@mui/material/Button";
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Typography from "@mui/material/Typography";
import i18n from "../constant/i18n";
import {Switch} from "@mui/material";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import {LobbyClient} from 'boardgame.io/client';
import {filmCentenaryName, imperialElegyName, songJinnName, virginQueenName} from "../constant/multi-games";
import {IE_SEAT_LABELS, IE_MIN_HUMANS, IE_SEATS, botsForHumanCount, canToggleBotSeat, firstHumanSeat, humanPowers, toggleBotSeat} from "../imperialElegy/configuration";
import type {Power} from "../imperialElegy/types";
import {ScenarioID} from "../virginQueen/constant/general";
import {SCENARIO_OPTIONS, scenarioOptionLabel, seatLabels} from "../virginQueen/configuration";

import {UpdateHistory} from "../update";
import {CardNameText} from "./card";

type PlayerMetadata = {
    id: number;
    name?: string;
    data?: any;
    isConnected?: boolean;
};

interface MatchData {
    matchID: string;
    gameName: string;
    players: PlayerMetadata[];
    gameover?: any;
    nextMatchID?: string;
    createdAt: number;
    updatedAt: number;
    setupData?: {scenario?: ScenarioID; bots?: string[]};
}

interface CreateMatchProps {
    serverURL: string;
    gameName: string;
}

const styles = {
    formControl: {
        m: 1,
        minWidth: 120,
    },
};

interface IUseInterval {
    (callback: () => void, interval: number): void;
}

const useInterval: IUseInterval = (callback, interval) => {
    const savedCallback = useRef<(() => void) | null>(null);
    useEffect(() => {
        savedCallback.current = callback;
    });
    useEffect(() => {
        function tick() {
            if (savedCallback.current) {
                savedCallback.current();
            }
        }
        const id = setInterval(tick, interval);
        return () => clearInterval(id);
    }, [interval]);
};

interface SeatInfo {
    /** Localized power name ("德国" / "Germany"). */
    label: string;
    /** True when the server's Rule 34 bot plays this seat. */
    bot: boolean;
}

interface MatchRowData {
    match: MatchData;
    createdText: string;
    updatedText: string;
    seats?: SeatInfo[];
}

interface MatchRowProps {
    data: MatchRowData;
    serverURL: string;
}

const MatchRow = React.memo(({data, serverURL}: MatchRowProps) => {
    const {match, createdText, updatedText, seats} = data;
    return (
        <TableRow hover>
            <TableCell component="th" scope="row">
                <Chip label={match.matchID} size="small" variant="outlined"/>
            </TableCell>
            <TableCell>{match.players.length}</TableCell>
            <TableCell>
                <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center"}}>
                    {match.players.map((p, idx) => {
                        // A bot seat is named by the server, so it never shows a
                        // join link: the Rule 34 bot already holds its credentials.
                        if (p.name === undefined && seats?.[idx]?.bot !== true) {
                            return (
                                <a key={idx} href={`${serverURL}/join/${match.gameName}/${match.matchID}/${idx}`} style={{marginRight: 8}}>
                                    {`${i18n.chain.lobby.join}|${idx + 1}${seats ? ` ${seats[idx].label}` : ""}`}
                                </a>
                            );
                        }
                        if (seats?.[idx]?.bot === true) {
                            return (
                                <Chip
                                    key={idx}
                                    size="small"
                                    variant="outlined"
                                    color="default"
                                    label={`🤖 ${seats[idx].label}`}
                                />
                            );
                        }
                        return (
                            <Typography key={idx} component="span" variant="body2" sx={{mr: 1, display: "inline-flex", alignItems: "center", gap: 0.5}}>
                                {p.name} {seats?.[idx]?.label}
                                <Chip size="small" label={p.isConnected ? "(+)" : "(-)"} color={p.isConnected ? "success" : "default"} variant="outlined"/>
                            </Typography>
                        );
                    })}
                </Box>
            </TableCell>
            <TableCell>
                <a href={`${serverURL}/join/${match.gameName}/${match.matchID}/spectate`}>
                    {i18n.chain.lobby.spectate}
                </a>
            </TableCell>
            <TableCell>{createdText}</TableCell>
            <TableCell>{updatedText}</TableCell>
        </TableRow>
    );
}, (prev, next) => {
    return prev.serverURL === next.serverURL
        && prev.data.match.matchID === next.data.match.matchID
        && prev.data.match.updatedAt === next.data.match.updatedAt
        && JSON.stringify(prev.data.seats) === JSON.stringify(next.data.seats);
});

const MUICreateMatch = ({serverURL, gameName}: CreateMatchProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    // VQ and Imperial Elegy fix the first player by scenario (seat 0 always
    // starts), so their lobbies must not offer the "start as player" choice.
    const fixedFirstPlayer = gameName === virginQueenName || gameName === imperialElegyName;
    const navigate = useNavigate();
    const [player, setPlayer] = useState<Player>(Player.P0);
    const [clicked, setClicked] = useState(false);
    const [matchID, setMatchID] = useState("");
    const [error, setError] = useState("");
    const [numPlayers, setNumPlayers] = useState(gameName === filmCentenaryName ? 4 : gameName === virginQueenName || gameName === imperialElegyName ? 6 : 2);
    // Imperial Elegy always seats all six powers, so its lobby picks *which*
    // seats are bots (any seat, not just the tail): `botPowers` is that choice
    // and the server's Rule 34 bot plays exactly those.  Choosing a human count
    // is the same control in bulk — it flips the tail seats — and both write the
    // one list, so the chips and the count never disagree.
    const [botPowers, setBotPowers] = useState<Power[]>([]);
    const humanCount = IE_SEATS.length - botPowers.length;
    const humanSeats = useMemo(() => humanPowers(botPowers), [botPowers]);
    const [isPublic, setIsPublic] = useState(true);
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [vqScenario, setVqScenario] = useState<ScenarioID>("campaign");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (Number(player) >= numPlayers) setPlayer(Player.P0);
    }, [numPlayers, player]);

    useEffect(() => {
        if (matchID) {
            // Seat 0 is always a human seat (bots fill the tail of the seat
            // order), but derive it rather than assuming, so a future lobby
            // that lets the creator pick the bot seats keeps working.
            const seat = fixedFirstPlayer ? firstHumanSeat(botPowers) : Number(player);
            navigate(`/join/${gameName}/${matchID}/${seat}`);
        }
    }, [matchID, gameName, player, fixedFirstPlayer, botPowers, navigate]);

    const lobbyClient = useMemo(() => new LobbyClient({server: serverURL}), [serverURL]);

    const refreshLobby = useCallback(() => {
        if (document.hidden) return;
        setLoading(true);
        lobbyClient.listMatches(gameName, {isGameover: false}).then((result: any) => {
            setMatches(result?.matches ?? []);
        }).catch(() => {
        }).finally(() => {
            setLoading(false);
        });
    }, [lobbyClient, gameName]);

    const onClick = () => {
        setClicked(true);
        setError("");
        // Imperial Elegy: always six boardgame.io seats; the lobby's choice of
        // humans becomes `setupData.bots`, which `engine/setup.ts` stores as the
        // public `G.bots` list the server drives (see game/ieBotDriver.ts).
        const setupData = gameName === imperialElegyName
            ? {bots: botPowers}
            : gameName === virginQueenName ? {scenario: vqScenario} : undefined;
        createMatch(serverURL, gameName, isPublic ? Visibility.PUBLIC : Visibility.PRIVATE, numPlayers, setupData)
            .then((id) => setMatchID(id))
            .catch((err) => {
                if (gameName === songJinnName) {
                    createMatch(serverURL, gameName, isPublic ? Visibility.PUBLIC : Visibility.PRIVATE, 2)
                        .then((id) => setMatchID(id))
                        .catch((err2) => {
                            setError(err2?.toString?.() ?? String(err2));
                            setClicked(false);
                        });
                } else {
                    setError(err?.toString?.() ?? String(err));
                    setClicked(false);
                }
            });
    };

    const handleChange = (event: SelectChangeEvent<number>) => {
        setNumPlayers(Number(event.target.value));
    };

    const handleHumanCountChange = (event: SelectChangeEvent<number>) => {
        setBotPowers(botsForHumanCount(Number(event.target.value)));
    };

    const handleSeatToggle = (power: Power) => {
        setBotPowers((prev) => toggleBotSeat(prev, power));
    };

    const handlePlayerChange = (event: SelectChangeEvent<Player>) => {
        setPlayer(event.target.value as Player);
    };

    const handlePublicChange = () => {
        setIsPublic((prev) => !prev);
    };

    useInterval(refreshLobby, 10000);

    useEffect(() => {
        refreshLobby();
    }, [refreshLobby]);

    const gameTitle = gameName === 'film' ? "电影百年" : gameName === virginQueenName ? "Virgin Queen" : gameName === imperialElegyName ? "Imperial Elegy 帝国挽歌" : "宋金战争";

    const errorMessage = error ? (
        <Alert severity="error" sx={{mb: 1}}>
            {error} {i18n.chain.drawer.pleaseTry}
            {gameName === 'film' ? <Link to={'/local4p'}>{i18n.chain.drawer.fourPlayer}</Link> :
                gameName === virginQueenName ? <Link to={'/localVQ'}>{i18n.chain.vq.local.hotseat}</Link> : gameName === imperialElegyName ? <Link to={'/localIE'}>本地热座 / Local hotseat</Link> :
                <Link to={'/local'}>本地</Link>}
        </Alert>
    ) : null;

    const rowData: MatchRowData[] = useMemo(() => matches.map((match) => {
        let seats: SeatInfo[] | undefined;
        if (match.gameName === virginQueenName) {
            seats = seatLabels(match.setupData?.scenario ?? "campaign", match.players.length, vqLocale).map((label) => ({label, bot: false}));
        } else if (match.gameName === imperialElegyName) {
            const bots = new Set(
                (match.setupData?.bots ?? []).filter((power): power is keyof typeof IE_SEAT_LABELS =>
                    (IE_SEATS as readonly string[]).includes(power as string)),
            );
            seats = IE_SEATS.map((power) => ({
                label: vqLocale === "zh_CN" ? IE_SEAT_LABELS[power].zh_CN : IE_SEAT_LABELS[power].en,
                bot: bots.has(power),
            }));
        }
        return {
            match,
            createdText: new Date(match.createdAt).toLocaleString(),
            updatedText: new Date(match.updatedAt).toLocaleString(),
            seats,
        };
    }), [matches, vqLocale]);

    return (
        <Grid container spacing={3} sx={{p: {xs: 1, sm: 2, md: 3}, maxWidth: 1280, mx: "auto"}}>
            <Grid size={{xs: 12, md: 8}}>
                <Paper elevation={2} sx={{p: 2}}>
                    <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1}}>
                        <Typography variant="h6">公开对局</Typography>
                        <Button variant="outlined" size="small" startIcon={loading ? <CircularProgress size={16}/> : <RefreshIcon/>} onClick={refreshLobby} disabled={loading}>
                            {i18n.chain.dialog.buyCard.refresh}
                        </Button>
                    </Box>
                    <TableContainer sx={{maxHeight: 520}}>
                        <Table size="small" aria-label="Public match table" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Match ID</TableCell>
                                    <TableCell>{i18n.chain.lobby.numPlayers}</TableCell>
                                    <TableCell>{i18n.chain.lobby.join}</TableCell>
                                    <TableCell>{i18n.chain.lobby.spectate}</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Updated</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rowData.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Typography variant="body2" color="text.secondary">
                                                No matches yet
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {loading && rowData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <CircularProgress size={24}/>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {rowData.map((data) => (
                                    <MatchRow key={data.match.matchID} data={data} serverURL={serverURL}/>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Grid>
            <Grid size={{xs: 12, md: 4}} container spacing={2} sx={{alignContent: "flex-start"}}>
                <Grid size={12}>
                    <Paper elevation={2} sx={{p: 2}}>
                        <Typography variant="h5" gutterBottom>{gameTitle}</Typography>
                        {gameName === virginQueenName && (
                            <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, mb: 1}}>
                                <Button variant="outlined" size="small" onClick={() => {setVqScenario("tutorial"); setNumPlayers(2);}}>
                                    选择双人教学（在线）
                                </Button>
                                <Button component={Link} to="/localVQ/tutorial" variant="contained" size="small">
                                    开始本地双人教学
                                </Button>
                                {vqScenario === "tutorial" && (
                                    <Typography variant="body2" sx={{width: "100%"}}>
                                        双人教学 · 勒班陀海战：P1 奥斯曼帝国，P2 西班牙，共 3 回合；创建房间后邀请另一位玩家加入。
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {gameName === imperialElegyName ? (
                            <>
                                <FormControl variant="outlined" sx={styles.formControl} fullWidth>
                                    <InputLabel htmlFor="outlined-ie-humans">{vqLocale === "zh_CN" ? "人类玩家" : "Human players"}</InputLabel>
                                    <Select
                                        native
                                        value={humanCount}
                                        onChange={handleHumanCountChange}
                                        label={vqLocale === "zh_CN" ? "人类玩家" : "Human players"}
                                        inputProps={{
                                            name: 'humanCount',
                                            id: 'outlined-ie-humans',
                                        }}>
                                        {IE_SEATS.map((_, index) => index + 1).filter((count) => count >= IE_MIN_HUMANS).map((count) => (
                                            <option key={count} value={count}>{count}</option>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Box sx={{mx: 1, mb: 1}} data-testid="ie-lobby-seats">
                                    <Typography variant="body2" color="text.secondary" sx={{mb: 0.5}}>
                                        {vqLocale === "zh_CN"
                                            ? `共 6 个席位：${humanSeats.length} 名人类 + ${botPowers.length} 名机器人（规则 34）`
                                            : `Six seats: ${humanSeats.length} human(s) + ${botPowers.length} bot(s) (Rule 34)`}
                                    </Typography>
                                    <Box sx={{display: "flex", flexWrap: "wrap", gap: 0.5}}>
                                        {/* Any seat may be a bot: each chip is a
                                            toggle, and the count above only
                                            derails which seats change. */}
                                        {IE_SEATS.map((power) => {
                                            const bot = botPowers.includes(power);
                                            const label = vqLocale === "zh_CN" ? IE_SEAT_LABELS[power].zh_CN : IE_SEAT_LABELS[power].en;
                                            const enabled = canToggleBotSeat(botPowers, power);
                                            return (
                                                <Chip
                                                    key={power}
                                                    size="small"
                                                    data-testid={`ie-lobby-seat-${power}`}
                                                    data-bot={bot ? "true" : "false"}
                                                    variant={bot ? "outlined" : "filled"}
                                                    color={bot ? "default" : "primary"}
                                                    label={bot ? `🤖 ${label}` : label}
                                                    onClick={enabled ? () => handleSeatToggle(power) : undefined}
                                                    disabled={!enabled}
                                                    aria-label={vqLocale === "zh_CN"
                                                        ? `${label}：${bot ? "机器人" : "人类"}，点击切换`
                                                        : `${label}: ${bot ? "bot" : "human"}, click to toggle`}
                                                />
                                            );
                                        })}
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" component="div" sx={{mt: 0.5}}>
                                        {vqLocale === "zh_CN"
                                            ? "点击任意席位切换人类/机器人；至少保留 2 名人类。只需邀请人类席位的好友。"
                                            : "Click any seat to switch human/bot; at least 2 humans. Only invite friends for the human seats."}
                                    </Typography>
                                </Box>
                            </>
                        ) : (
                        <FormControl variant="outlined" sx={styles.formControl} fullWidth>
                            <InputLabel htmlFor="outlined-numPlayers-native-simple">{i18n.chain.lobby.numPlayers}</InputLabel>
                            <Select
                                native
                                value={numPlayers}
                                onChange={handleChange}
                                label={i18n.chain.lobby.numPlayers}
                                inputProps={{
                                    name: 'numPlayers',
                                    id: 'outlined-numPlayers-native-simple',
                                }}>
                                {gameName === virginQueenName ? SCENARIO_OPTIONS.find((entry) => entry.id === vqScenario)!.players.map((count) => <option key={count} value={count}>{count}</option>) : <>
                                    <option value={2}>2</option>
                                    {gameName === 'film' ? <>
                                        <option value={3}>3</option>
                                        <option value={4}>4</option>
                                    </> : <></>}
                                </>}
                            </Select>
                        </FormControl>
                        )}
                        {!fixedFirstPlayer && (
                            <FormControl variant="outlined" sx={styles.formControl} fullWidth>
                                <InputLabel htmlFor="outlined-player-native-simple">{i18n.chain.lobby.player}</InputLabel>
                                <Select
                                    native
                                    value={player}
                                    onChange={handlePlayerChange}
                                    label={i18n.chain.lobby.player}
                                    inputProps={{
                                        name: 'player',
                                        id: 'outlined-player-native-simple',
                                    }}>
                                    {gameName === 'film' ? <option value={Player.P0}>{Player.P0}</option>
                                        : <option value={Player.P0}>宋</option>}
                                    {gameName === 'film' ? <option value={Player.P1}>{Player.P1}</option>
                                        : <option value={Player.P1}>金</option>}
                                    {gameName === 'film' && numPlayers >= 3 ?
                                        <option value={Player.P2}>{Player.P2}</option>
                                        : <></>}
                                    {gameName === 'film' && numPlayers >= 4 ?
                                        <option value={Player.P3}>{Player.P3}</option>
                                        : <></>}
                                </Select>
                            </FormControl>
                        )}
                        {gameName === virginQueenName && (
                            <FormControl variant="outlined" sx={styles.formControl} fullWidth>
                                <InputLabel htmlFor="vq-scenario">{i18n.chain.vq.local.scenario}</InputLabel>
                                <Select native value={vqScenario} onChange={(e) => {
                                    const scenario = e.target.value as ScenarioID;
                                    setVqScenario(scenario);
                                    if (scenario === "tutorial") setNumPlayers(2);
                                }} label={i18n.chain.vq.local.scenario}
                                        inputProps={{name: "scenario", id: "vq-scenario"}}>
                                    {SCENARIO_OPTIONS.map((entry) => <option key={entry.id} value={entry.id}>{scenarioOptionLabel(entry.id, vqLocale)}</option>)}
                                </Select>
                            </FormControl>
                        )}
                        <Grid container spacing={1} sx={{alignItems: 'center', mt: 1}}>
                            <Typography>{i18n.chain.lobby.privateGame}</Typography>
                            <Switch checked={isPublic} onChange={handlePublicChange}/>
                            <Typography>{i18n.chain.lobby.publicGame}</Typography>
                        </Grid>
                        <Grid size={12} sx={{mt: 1}}>
                            {errorMessage}
                            <Button onClick={onClick} disabled={clicked} fullWidth color="primary" variant="contained">
                                {i18n.chain.lobby.createPrivateMatch}
                            </Button>
                        </Grid>
                    </Paper>
                </Grid>
                <Grid size={12}>
                    <Paper elevation={2} sx={{p: 2}}>
                        <Typography variant="h6" gutterBottom>公告</Typography>
                        {UpdateHistory.map((update) => (
                            <Box key={update.date} sx={{mb: 1}}>
                                <Typography variant="subtitle2">{update.date}</Typography>
                                <Box component="ul" sx={{m: 0, pl: 3}}>
                                    {update.info.map((info, idx) => (
                                        <li key={idx}>
                                            <Typography variant="body2"><CardNameText text={info}/></Typography>
                                        </li>
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Paper>
                </Grid>
            </Grid>
        </Grid>
    );
};

export default MUICreateMatch;
