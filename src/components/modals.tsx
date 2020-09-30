import React from "react";
import {Dialog,DialogContent, DialogActions, DialogTitle ,FormControl, FormGroup} from "@material-ui/core";
import { makeStyles } from '@material-ui/core/styles';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Button from '@material-ui/core/Button';
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";

const useStyles = makeStyles((theme) => ({
    formControl: {
        margin: theme.spacing(3),
    },
    button: {
        margin: theme.spacing(1, 1, 0, 0),
    },
}));

export interface Choice{
    hidden:boolean,
    disabled:boolean,
    value:string,
    label:string,
}
export interface IChoiceProps {
    callback:(choice:string)=>void,
    choices: Choice[],
    defaultChoice:string,
    show:boolean,
    title:string,
    toggleText: string,
    initial:boolean,
}

export const ChoiceDialog =({initial,callback,show,choices,title,toggleText,defaultChoice}:IChoiceProps)=>{
    const classes = useStyles();
    const [open, setOpen] = React.useState(initial);
    const [choice, setChoice] = React.useState(defaultChoice);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    useI18n(i18n);

    return  show?<>
        <Button variant={"outlined"} onClick={()=>handleClickOpen()}> {toggleText}</Button>
        <Dialog open={open} onClose={()=>handleClose()} aria-label={title}>
            <DialogTitle>
                {title}
            </DialogTitle>
            <DialogContent>
                <FormControl required component="fieldset">
                    <FormGroup className={classes.formControl}>
                        <FormLabel component="legend">{toggleText}</FormLabel>
                        <RadioGroup aria-label={title} name="choice" value={choice}
                                    onChange={(e) => setChoice(e.target.value)}>
                            {choices.map((choice,idx,arr)=>
                                !choice.hidden ?
                                    <FormControlLabel
                                        disabled={choice.disabled}
                                        key={idx} value={choice.value}
                                        control={<Radio/>}
                                        label={choice.label}/> : ""
                            )}
                        </RadioGroup>
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={()=>{
                    //handleClose();
                    callback(choice);
                }} color="primary">
                    {i18n.confirm}
                </Button>
            </DialogActions>
        </Dialog>
    </>:<div></div>
 }

