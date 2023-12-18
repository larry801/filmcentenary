import React, {useEffect, useRef} from "react";
import {Player} from "../Game";
import {Link, useHistory} from "react-router-dom";
import {createMatch, Visibility} from "../api/match";
import Button from "@material-ui/core/Button";
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import Typography from "@material-ui/core/Typography";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {Switch} from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableBody from "@material-ui/core/TableBody";
import {LobbyClient} from 'boardgame.io/client';
import {filmCentenaryName, songJinnName} from "../constant/multi-games";

type PlayerMetadata = {
    id: number;
    name?: string;
    data?: any;
    isConnected?: boolean;
};

interface MatchData {
    matchID: string;
    gameName: string;
    players: PlayerMetadata [];
    gameover?: any;
    nextMatchID?: string;
    createdAt: number;
    updatedAt: number;
}

interface CreateMatchProps {
    serverURL: string;
    gameName: string;
}

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        formControl: {
            margin: theme.spacing(1),
            minWidth: 120,
        },
        selectEmpty: {
            marginTop: theme.spacing(2),
        },
    }),
);

interface IUseInterval {
    (callback: () => void, interval: number): void;
}

const useInterval: IUseInterval = (callback, interval) => {
    const savedCallback = useRef<(() => void) | null>(null);
    // After every render, save the latest callback into our ref.
    useEffect(() => {
        savedCallback.current = callback;
    });

    useEffect(() => {
        function tick() {
            if (savedCallback.current) {
                savedCallback.current();
            }
        }

        let id = setInterval(tick, interval);
        return () => clearInterval(id);
    }, [interval]);
};

const MUICreateMatch = ({serverURL, gameName}: CreateMatchProps) => {
    useI18n(i18n);
    const history = useHistory();
    const classes = useStyles();
    const [player, setPlayer] = React.useState(Player.P0);
    const [clicked, setClicked] = React.useState(false);
    const [matchID, setMatchID] = React.useState("");
    const [error, setError] = React.useState("");
    const [numPlayers, setNumPlayers] = React.useState(gameName === filmCentenaryName ? 4 : 2);
    const [isPublic, setIsPublic] = React.useState(true);
    const [matches, setMatches] = React.useState([]);

    const onClick = () => {
        setClicked(true);
        createMatch(serverURL, gameName, isPublic ? Visibility.PUBLIC : Visibility.PRIVATE, numPlayers)
            .then((id) => setMatchID(id))
            .catch((err) => {
                if(gameName === songJinnName){
                    createMatch(serverURL, gameName, isPublic ? Visibility.PUBLIC : Visibility.PRIVATE, 2)
                        .then((id) => setMatchID(id))
                        .catch((err2) => setError(err2.toString));
                }else{
                    setError(JSON.stringify(err))
                }
            });
    };

    const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
        // @ts-ignore
        setNumPlayers(parseInt(event.target.value));
    };

    const handlePlayerChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
        // @ts-ignore
        setPlayer(event.target.value);
    };

    const handlePublicChange = () => {
        setIsPublic(!isPublic);
    }

    const lobbyClient = new LobbyClient({server: serverURL});

    const refreshLobby = () => {
        lobbyClient.listMatches(gameName, {isGameover: false}).then((matches) => {
            // @ts-ignore
            setMatches(matches.matches);
        }).catch(() => {
        });
    }
    const errorMessage = <Typography>
        {error} {i18n.drawer.pleaseTry}
        {gameName === 'film' ? <Link to={'/local4p'}>{i18n.drawer.fourPlayer}</Link> :
            <Link to={'/local'}>本地</Link>}
    </Typography>

    useInterval(refreshLobby, 10000);

    useEffect(() => {
        refeshLobby();
    }, []);

    return <Grid container>
        <Grid item container xs={12} sm={8}>
            <Button fullWidth color={"secondary"} onChange={refreshLobby}>{i18n.dialog.buyCard.refresh}</Button>
            <Table size="small" aria-label="Public match table">
                <TableHead>
                    <TableRow>
                        <TableCell>Match ID</TableCell>
                        <TableCell>{i18n.lobby.numPlayers}</TableCell>
                        <TableCell>{i18n.lobby.join}</TableCell>
                        <TableCell>{i18n.lobby.spectate}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {matches.map((match: MatchData) => {
                        const createdDate = new Date(match.createdAt);
                        const updateDate = new Date(match.updatedAt);
                        return <TableRow key={match.matchID}>
                            <TableCell component="th" scope="row">
                                {match.matchID}
                            </TableCell>
                            <TableCell>
                                {match.players.length}
                            </TableCell>
                            <TableCell>
                                {match.players.map((player, idx) => {
                                    if (player.name === undefined) {
                                        return <a href={`${serverURL}/join/${match.gameName}/${match.matchID}/${idx}`}>
                                            {`${i18n.lobby.join}|${idx + 1}`}
                                        </a>
                                    } else {
                                        return <Typography>{player.name} {player.isConnected ? "(+)" : "(-)"} </Typography>
                                    }
                                })}
                            </TableCell>
                            <TableCell>
                                <a
                                    href={`${serverURL}/join/${match.gameName}/${match.matchID}/spectate`}
                                >{i18n.lobby.spectate}</a>
                            </TableCell>
                            <TableCell>
                                {createdDate.toLocaleString()}
                            </TableCell>
                            <TableCell>
                                {updateDate.toLocaleString()}
                            </TableCell>

                        </TableRow>
                    })}
                </TableBody>
            </Table>
        </Grid>
        <Grid item container xs={12} sm={4}>
            <Grid item container xs={12} alignItems="center">
                <Grid item xs={12}>
                    <Typography variant={"h4"}>{gameName === 'film' ? "电影百年" : "宋金战争"}</Typography>
                </Grid>
                <FormControl variant="outlined" className={classes.formControl}>
                    <Grid component="label" container alignItems="center" spacing={1}>
                        <InputLabel htmlFor="outlined-numPlayers-native-simple">{i18n.lobby.numPlayers}</InputLabel>
                        <Select
                            native
                            value={numPlayers}
                            onChange={handleChange}
                            label={i18n.lobby.numPlayers}
                            inputProps={{
                                name: 'numPlayers',
                                id: 'outlined-numPlayers-native-simple',
                            }}>
                            <option value={2}>2</option>
                            {gameName === 'film' ? <>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                            </> : <></>}
                        </Select>
                    </Grid>
                </FormControl>
            </Grid>
            <FormControl variant="outlined" className={classes.formControl}>
                <Grid component="label" container alignItems="center" spacing={1}>
                    <InputLabel htmlFor="outlined-numPlayers-native-simple">{i18n.lobby.player}</InputLabel>
                    <Select
                        native
                        value={player}
                        onChange={handlePlayerChange}
                        label={i18n.lobby.player}
                        inputProps={{
                            name: 'numPlayers',
                            id: 'outlined-numPlayers-native-simple',
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
                </Grid>
            </FormControl>

            <Grid component="label" container alignItems="center" spacing={1}>
                <Typography>{i18n.lobby.privateGame}</Typography>
                <Switch checked={isPublic} onChange={handlePublicChange}/>
                <Typography>{i18n.lobby.publicGame}</Typography>
            </Grid>
            <Grid item container xs={12} sm={7}>
                {matchID && history.push(`/join/${gameName}/${matchID}/${player}`)}
                {error && errorMessage}
                <Button onClick={onClick} disabled={clicked} fullWidth color={"primary"} variant="contained">
                    {i18n.lobby.createPrivateMatch}
                </Button>
            </Grid>
        </Grid>
    </Grid>
}

export default MUICreateMatch;