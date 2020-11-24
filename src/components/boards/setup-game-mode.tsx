import React from 'react';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';
import FormGroup from '@material-ui/core/FormGroup';
import {GameMode} from "../../types/core";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import Switch from '@material-ui/core/Switch';
import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";

export interface ISetupPanelProps {
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
}

export default function SetupPanel({moves, ctx}: ISetupPanelProps) {
    useI18n(i18n);
    const [mode, setMode] = React.useState(GameMode.NORMAL);
    const [randomOrder, setRandomOrder] = React.useState(true);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        setMode(event.target.value);
    };

    const handleFirstPlayerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRandomOrder(event.target.checked);
    };

    const confirm = () => {
        moves.setupGameMode({
            mode: mode,
            randomOrder: randomOrder,
        })
    }

    return (
        <Grid container>
            <FormControl component="fieldset">
                <FormLabel component="legend">{i18n.setting.mode}</FormLabel>
                <RadioGroup row aria-label={i18n.setting.mode} name="mode" value={mode} onChange={handleChange}>
                    <FormControlLabel
                        value={GameMode.NORMAL} control={<Radio/>} label={i18n.setting.normal}/>
                    <FormControlLabel
                        disabled
                        value={GameMode.NEWBIE} control={<Radio/>} label={i18n.setting.newbie}/>
                    <FormControlLabel
                        disabled={ctx.numPlayers < 4}
                        value={GameMode.TEAM2V2} control={<Radio/>} label={i18n.setting.team}/>
                </RadioGroup>
                <FormLabel component="legend">{i18n.setting.fixedFirst}</FormLabel>
                <Switch
                    checked={randomOrder}
                    onChange={handleFirstPlayerChange}
                    name="FirstPlayer"
                    inputProps={{ 'aria-label': i18n.setting.fixedFirst }}
                />
                <FormLabel component="legend">{i18n.setting.randomFirst}</FormLabel>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={confirm}
                >{i18n.setting.changeSetting}</Button>
            </FormControl>
        </Grid>
    );
}
