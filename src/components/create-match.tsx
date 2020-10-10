import React from "react";
import {Player} from "../Game";
import {useHistory} from "react-router-dom";
import {createMatch, Visibility} from "../api/match";
import Button from "@material-ui/core/Button";
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import Typography from "@material-ui/core/Typography";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";

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

export const MUICreateMatch = ({serverURL}: CreateMatchProps) => {
    useI18n(i18n);
    const history = useHistory();
    const classes = useStyles();
    // eslint-disable-next-line
    const [player, setPlayer] = React.useState(Player.P0);
    const [clicked, setClicked] = React.useState(false);
    const [matchID, setMatchID] = React.useState("");
    const [error, setError] = React.useState("");
    const [numPlayers,setNumPlayers] = React.useState(3);

    const onClick = () => {
        setClicked(true);
        createMatch(serverURL, Visibility.PRIVATE, numPlayers)
            .then((id) => setMatchID(id))
            .catch((err) => setError(err.toString()));
    };

    const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
        // @ts-ignore
        setNumPlayers(parseInt(event.target.value));
    };

    return <>
        <FormControl variant="outlined" className={classes.formControl}>
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
        </FormControl>
        {matchID && history.push(`/join/${matchID}/${player}`)}
        {error && <Typography>{error}</Typography>}
        <Button onClick={onClick} disabled={clicked}>
            {i18n.lobby.createPrivateMatch}
        </Button>
        </>
}
