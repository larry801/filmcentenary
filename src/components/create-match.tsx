import React from "react";
import {Player} from "../Game";
import {useHistory} from "react-router-dom";
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

interface CreateMatchProps {
    serverURL: string;
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

const MUICreateMatch = ({serverURL}: CreateMatchProps) => {
    useI18n(i18n);
    const history = useHistory();
    const classes = useStyles();
    // eslint-disable-next-line
    const [player, setPlayer] = React.useState(Player.P0);
    const [clicked, setClicked] = React.useState(false);
    const [matchID, setMatchID] = React.useState("");
    const [error, setError] = React.useState("");
    const [numPlayers, setNumPlayers] = React.useState(4);
    const [isPublic, setIsPublic] = React.useState(false);

    const onClick = () => {
        setClicked(true);
        createMatch(serverURL, isPublic ? Visibility.PUBLIC : Visibility.PRIVATE, numPlayers)
            .then((id) => setMatchID(id))
            .catch((err) => setError(err.toString()));
    };

    const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
        // @ts-ignore
        setNumPlayers(parseInt(event.target.value));
    };

    const handlePublicChange = () => {
        setIsPublic(!isPublic);
    }

    return <Grid container>
        <Grid item container xs={12} sm={8}>
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

                </TableBody>
            </Table>
        </Grid>
        <Grid container xs={12} sm={4}>
            <Grid item container xs={12} alignItems="center">
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
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </Select>
                    </Grid>
                </FormControl>
            </Grid>
            <Grid component="label" container alignItems="center" spacing={1}>
                <Typography>{i18n.lobby.privateGame}</Typography>
                <Switch checked={isPublic} onChange={handlePublicChange}/>
                <Typography>{i18n.lobby.publicGame}</Typography>
            </Grid>
            <Grid item container xs={12} sm={7}>
                {matchID && history.push(`/join/${matchID}/${player}`)}
                {error && <Typography>{error}</Typography>}
                <Button onClick={onClick} disabled={clicked} fullWidth color={"primary"} variant="contained">
                    {i18n.lobby.createPrivateMatch}
                </Button>
            </Grid>
        </Grid>
    </Grid>
}

export default MUICreateMatch;
