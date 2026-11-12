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
import {IE_SEAT_LABELS} from "../imperialElegy/configuration";
import {ScenarioID} from "../virginQueen/constant/general";
import {SCENARIO_OPTIONS, scenarioOptionLabel, seatLabels} from "../virginQueen/configuration";

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
    setupData?: {scenario?: ScenarioID};
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

interface MatchRowData {
    match: MatchData;
    createdText: string;
    updatedText: string;
    seats?: string[];
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
                        if (p.name === undefined) {
                            return (
                                <a key={idx} href={`${serverURL}/join/${match.gameName}/${match.matchID}/${idx}`} style={{marginRight: 8}}>
                                    {`${i18n.chain.lobby.join}|${idx + 1}${seats ? ` ${seats[idx]}` : ""}`}
                                </a>
                            );
                        }
                        return (
                            <Typography key={idx} component="span" variant="body2" sx={{mr: 1, display: "inline-flex", alignItems: "center", gap: 0.5}}>
                                {p.name} {seats?.[idx]}
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
    const navigate = useNavigate();
    const [player, setPlayer] = useState<Player>(Player.P0);
    const [clicked, setClicked] = useState(false);
    const [matchID, setMatchID] = useState("");
    const [error, setError] = useState("");
    const [numPlayers, setNumPlayers] = useState(gameName === filmCentenaryName ? 4 : gameName === virginQueenName || gameName === imperialElegyName ? 6 : 2);
    const [isPublic, setIsPublic] = useState(true);
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [vqScenario, setVqScenario] = useState<ScenarioID>("campaign");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (Number(player) >= numPlayers) setPlayer(Player.P0);
    }, [numPlayers, player]);

    useEffect(() => {
        if (matchID) {
            navigate(`/join/${gameName}/${matchID}/${player}`);
        }
    }, [matchID, gameName, player, navigate]);

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
        createMatch(serverURL, gameName, isPublic ? Visibility.PUBLIC : Visibility.PRIVATE, numPlayers,
            gameName === virginQueenName ? {scenario: vqScenario} : undefined)
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

    const rowData: MatchRowData[] = useMemo(() => matches.map((match) => ({
        match,
        createdText: new Date(match.createdAt).toLocaleString(),
        updatedText: new Date(match.updatedAt).toLocaleString(),
        seats: match.gameName === virginQueenName ? seatLabels(match.setupData?.scenario ?? "campaign", match.players.length, vqLocale) : match.gameName === imperialElegyName ? ["GE","UK","FR","AU","RU","OT"].map((p) => vqLocale === "zh_CN" ? IE_SEAT_LABELS[p as keyof typeof IE_SEAT_LABELS].zh_CN : IE_SEAT_LABELS[p as keyof typeof IE_SEAT_LABELS].en) : undefined,
    })), [matches, vqLocale]);

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
                                <Button variant="outlined" size="small" onClick={() => {setVqScenario("tutorial"); setNumPlayers(2); setPlayer(Player.P0);}}>
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
                                {gameName === virginQueenName ? SCENARIO_OPTIONS.find((entry) => entry.id === vqScenario)!.players.map((count) => <option key={count} value={count}>{count}</option>) : gameName === imperialElegyName ? <option value={6}>6</option> : <>
                                    <option value={2}>2</option>
                                    {gameName === 'film' ? <>
                                        <option value={3}>3</option>
                                        <option value={4}>4</option>
                                    </> : <></>}
                                </>}
                            </Select>
                        </FormControl>
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
                                {gameName === virginQueenName ? <>
                                    {seatLabels(vqScenario, numPlayers, vqLocale).map((label, index) => <option key={index} value={String(index)}>{`P${index + 1} ${label}`}</option>)}
                                </> : gameName === imperialElegyName ? <>
                                    {(["GE","UK","FR","AU","RU","OT"] as const).map((p, index) => <option key={p} value={String(index)}>{`P${index + 1} ${vqLocale === "zh_CN" ? IE_SEAT_LABELS[p].zh_CN : IE_SEAT_LABELS[p].en}`}</option>)}
                                </> : <>
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
                                </>}
                            </Select>
                        </FormControl>
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
            </Grid>
        </Grid>
    );
};

export default MUICreateMatch;
