import React from 'react';
import Checkbox from '@material-ui/core/Checkbox';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';
import {GameMode, GameTurnOrder} from "../../types/core";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";

import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";

export interface ISetupPanelProps {
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
}

export default function SetupPanel({moves, ctx}: ISetupPanelProps) {
    useI18n(i18n);
    const [mode, setMode] = React.useState(GameMode.NORMAL);
    const [order, setOrder] = React.useState(GameTurnOrder.FIXED);
    const [enableSchoolExtension, setEnableSchoolExtension] = React.useState(false);
    const [disableUndo,setDisableUndo] = React.useState(false);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        const newMode: GameMode = event.target.value;
        setMode(newMode);
        moves.setupGameMode({
            mode: newMode,
            order: order,
            enableSchoolExtension: enableSchoolExtension,
            disableUndo: disableUndo
        })
    };

    const handleSchoolExtensionChange =  (event: React.ChangeEvent<{}>, checked: boolean) => {
        setEnableSchoolExtension(checked);
        moves.setupGameMode({
            mode: mode,
            order: order,
            enableSchoolExtension: checked,
            disableUndo: disableUndo
        })
    };

    const handleDisableUndoChange =  (event: React.ChangeEvent<{}>, checked: boolean) => {
        setDisableUndo(checked);
        moves.setupGameMode({
            mode: mode,
            order: order,
            enableSchoolExtension: enableSchoolExtension,
            disableUndo: checked
        })
    };

    const handleFirstPlayerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        const newOrder:GameTurnOrder = event.target.value;
        setOrder(newOrder);
        moves.setupGameMode({
            mode: mode,
            order: newOrder,
            enableSchoolExtension: enableSchoolExtension,
            disableUndo: disableUndo
        })
    };

    return (
        <Grid container>
            <FormControl component="fieldset">
                <FormLabel component="legend">{i18n.setting.mode}</FormLabel>
                <RadioGroup row aria-label={i18n.setting.mode} name="mode" value={mode} onChange={handleChange}>
                    <FormControlLabel
                        value={GameMode.NORMAL} control={<Radio/>} label={i18n.setting.normal}/>
                    <FormControlLabel
                        value={GameMode.NEWBIE} control={<Radio/>} label={i18n.setting.newbie}/>
                    <FormControlLabel
                        disabled={ctx.numPlayers < 4}
                        value={GameMode.TEAM2V2} control={<Radio/>} label={i18n.setting.team}/>
                </RadioGroup>
                <FormControlLabel
                    value={enableSchoolExtension}
                    onChange={handleSchoolExtensionChange}
                    disabled={ctx.numPlayers < 3}
                    control={<Checkbox/>} label={i18n.setting.enableSchoolExtension}/>
                <FormControlLabel
                    value={enableSchoolExtension}
                    onChange={handleDisableUndoChange}
                    control={<Checkbox/>} label={i18n.setting.disableUndo}/>
            </FormControl>
            <FormControl component="fieldset">
                <FormLabel component="legend">{i18n.setting.order}</FormLabel>
                <RadioGroup row aria-label={i18n.setting.order} name="order" value={order}
                            onChange={handleFirstPlayerChange}>
                    <FormControlLabel
                        value={GameTurnOrder.FIXED} control={<Radio/>} label={i18n.setting.fixedFirst}/>
                    <FormControlLabel
                        value={GameTurnOrder.FIRST_RANDOM} control={<Radio/>} label={i18n.setting.randomFirst}/>
                    <FormControlLabel
                        disabled={ctx.numPlayers === 2}
                        value={GameTurnOrder.ALL_RANDOM} control={<Radio/>} label={i18n.setting.allRandom}/>
                </RadioGroup>
            </FormControl>
        </Grid>
    );
}
