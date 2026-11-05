import React, {useCallback, useEffect, useMemo, useRef} from "react";
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
import {LobbyClient} from 'boardgame.io/client';
import {filmCentenaryName, songJinnName, virginQueenName} from "../constant/multi-games";
import {ScenarioID} from "../virginQueen/constant/general";
import {SCENARIO_OPTIONS, seatLabels} from "../virginQueen/configuration";

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

const MUICreateMatch = ({serverURL, gameName}: CreateMatchProps) => {
    i18n.use();
    const navigate = useNavigate();
    const [player, setPlayer] = React.useState<Player>(Player.P0);
    const [clicked, setClicked] = React.useState(false);
    const [matchID, setMatchID] = React.useState("");
    const [error, setError] = React.useState("");
    const [numPlayers, setNumPlayers] = React.useState(gameName === filmCentenaryName ? 4 : gameName === virginQueenName ? 6 : 2);
    const [isPublic, setIsPublic] = React.useState(true);
    const [matches, setMatches] = React.useState<MatchData[]>([]);
    const [vqScenario, setVqScenario] = React.useState<ScenarioID>("campaign");

    React.useEffect(() => {
        if (Number(player) >= numPlayers) setPlayer(Player.P0);
    }, [numPlayers, player]);

    React.useEffect(() => {
        if (matchID) {
            navigate(`/join/${gameName}/${matchID}/${player}`);
        }
    }, [matchID, gameName, player, navigate]);

    const lobbyClient = useMemo(() => new LobbyClient({server: serverURL}), [serverURL]);

    const refreshLobby = useCallback(() => {
        lobbyClient.listMatches(gameName, {isGameover: false}).then((result: any) => {
            setMatches(result?.matches ?? []);
        }).catch(() => {
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

    const gameTitle = gameName === 'film' ? "电影百年" : gameName === virginQueenName ? "Virgin Queen" : "宋金战争";

    const errorMessage = error ? (
        <Typography color="error">
            {error} {i18n.chain.drawer.pleaseTry}
            {gameName === 'film' ? <Link to={'/local4p'}>{i18n.chain.drawer.fourPlayer}</Link> :
                gameName === virginQueenName ? <Link to={'/localVQ'}>本地热座</Link> :
                <Link to={'/local'}>本地</Link>}
        </Typography>
    ) : null;

    return (
        <Grid container spacing={2} sx={{p: 2}}>
            <Grid size={{xs: 12, sm: 8}}>
                <Button fullWidth color="secondary" onClick={refreshLobby} sx={{mb: 1}}>
                    {i18n.chain.dialog.buyCard.refresh}
                </Button>
                <TableContainer component={Paper}>
                    <Table size="small" aria-label="Public match table">
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
                            {matches.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        <Typography variant="body2" color="text.secondary">
                                            No matches yet
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {matches.map((match: MatchData) => {
                                const createdDate = new Date(match.createdAt);
                                const updateDate = new Date(match.updatedAt);
                                const seats = match.gameName === virginQueenName ? seatLabels(match.setupData?.scenario ?? "campaign", match.players.length) : undefined;
                                return (
                                    <TableRow key={match.matchID}>
                                        <TableCell component="th" scope="row">
                                            {match.matchID}
                                        </TableCell>
                                        <TableCell>
                                            {match.players.length}
                                        </TableCell>
                                        <TableCell>
                                            {match.players.map((p, idx) => {
                                                if (p.name === undefined) {
                                                    return (
                                                        <a key={idx} href={`${serverURL}/join/${match.gameName}/${match.matchID}/${idx}`} style={{marginRight: 8}}>
                                                            {`${i18n.chain.lobby.join}|${idx + 1}${seats ? ` ${seats[idx]}` : ""}`}
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <Typography key={idx} component="span" sx={{mr: 1}}>
                                                        {p.name} {seats?.[idx]} {p.isConnected ? "(+)" : "(-)"}
                                                    </Typography>
                                                );
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <a href={`${serverURL}/join/${match.gameName}/${match.matchID}/spectate`}>
                                                {i18n.chain.lobby.spectate}
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            {createdDate.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {updateDate.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Grid>
            <Grid size={{xs: 12, sm: 4}} container spacing={2} sx={{alignContent: "flex-start"}}>
                <Grid size={12}>
                    <Typography variant="h4">{gameTitle}</Typography>
                </Grid>
                {gameName === virginQueenName && (
                    <Grid size={12}>
                        <Button variant="outlined" sx={{mr: 1, mb: 1}}
                                onClick={() => {setVqScenario("tutorial"); setNumPlayers(2); setPlayer(Player.P0);}}>
                            选择双人教学（在线）
                        </Button>
                        <Button component={Link} to="/localVQ/tutorial" variant="contained" sx={{mb: 1}}>
                            开始本地双人教学
                        </Button>
                        {vqScenario === "tutorial" && (
                            <Typography variant="body2">
                                双人教学 · 勒班陀海战：P1 奥斯曼帝国，P2 西班牙，共 3 回合；创建房间后邀请另一位玩家加入。
                            </Typography>
                        )}
                    </Grid>
                )}
                <Grid size={12}>
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
                </Grid>
                <Grid size={12}>
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
                                {seatLabels(vqScenario, numPlayers).map((label, index) => <option key={index} value={String(index)}>{`P${index + 1} ${label}`}</option>)}
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
                </Grid>
                {gameName === virginQueenName && (
                    <Grid size={12}>
                        <FormControl variant="outlined" sx={styles.formControl} fullWidth>
                            <InputLabel htmlFor="vq-scenario">场景</InputLabel>
                            <Select native value={vqScenario} onChange={(e) => {
                                const scenario = e.target.value as ScenarioID;
                                setVqScenario(scenario);
                                if (scenario === "tutorial") setNumPlayers(2);
                            }} label="场景"
                                    inputProps={{name: "scenario", id: "vq-scenario"}}>
                                {SCENARIO_OPTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                            </Select>
                        </FormControl>
                    </Grid>
                )}
                <Grid size={12}>
                    <Grid component="label" container spacing={1} sx={{alignItems: 'center'}}>
                        <Typography>{i18n.chain.lobby.privateGame}</Typography>
                        <Switch checked={isPublic} onChange={handlePublicChange}/>
                        <Typography>{i18n.chain.lobby.publicGame}</Typography>
                    </Grid>
                </Grid>
                <Grid size={12}>
                    {errorMessage}
                    <Button onClick={onClick} disabled={clicked} fullWidth color="primary" variant="contained">
                        {i18n.chain.lobby.createPrivateMatch}
                    </Button>
                </Grid>
            </Grid>
        </Grid>
    );
};

export default MUICreateMatch;