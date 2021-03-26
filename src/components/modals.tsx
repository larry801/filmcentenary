import React, { useState, useRef, useEffect} from "react";
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Button from '@material-ui/core/Button';
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import FormControl from "@material-ui/core/FormControl/FormControl";
import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import DialogActions from "@material-ui/core/DialogActions";
import Grid from "@material-ui/core/Grid";
import {nanoid} from "nanoid";
import {usePrevious} from "./board";


export interface Choice {
    hidden: boolean,
    disabled: boolean,
    value: string,
    label: string,
}

export interface IChoiceProps {
    callback: (choice: string) => void,
    choices: Choice[],
    defaultChoice: string,
    show: boolean,
    title: string,
    toggleText: string | JSX.Element,
    initial: boolean,
    popAfterShow?: boolean,
}

const useDebounce = (callback: ()=>any, delay: number) => {
    const latestCallback = useRef(()=>{});
    const [callCount, setCallCount] = useState(0);

    useEffect(() => {
        latestCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (callCount > 0) {
            const fire = () => {
                setCallCount(0);
                latestCallback.current();
            };

            const id = setTimeout(fire, delay);
            return () => clearTimeout(id);
        }
    }, [callCount, delay]);

    return () => setCallCount(callCount => callCount + 1);
};

export const ChoiceDialog = ({
                                 initial,
                                 callback,
                                 show,
                                 choices,
                                 title,
                                 toggleText,
                                 defaultChoice,
                                 popAfterShow
                             }: IChoiceProps) => {

    useI18n(i18n);
    const [open, setOpen] = React.useState(initial);
    const [choice, setChoice] = React.useState(defaultChoice);
    const prevShow = usePrevious(show);

    React.useEffect(() => {
        if (show && prevShow === false && popAfterShow !== false) {
            setOpen(true);
        }
    }, [prevShow, show, popAfterShow])

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleConfirm = () => {
        handleClose();
        callback(choice);
    };

    const debouncedHandleConfirm = useDebounce(handleConfirm, 400);

    const handleChange = (e: any) => setChoice(e.target.value);

    return show ? <Grid item xs={12}>
        <Button
            aria-label={title}
            fullWidth
            variant={"outlined"}
            onClick={handleClickOpen}
            style={{textTransform: 'none'}}
        > {toggleText}</Button>
        <Dialog
            aria-label={title}
            open={open}
            onClose={handleClose}
        >
            <DialogTitle>
                {title}
            </DialogTitle>
            <DialogContent>
                <FormControl required component="fieldset">
                    <FormGroup>
                        <FormLabel component="legend">{toggleText}</FormLabel>
                        <RadioGroup
                            aria-label={title}
                            name="choice" value={choice}
                            onChange={handleChange}>
                            {choices.map((choice) =>
                                !choice.hidden ?
                                    <FormControlLabel
                                        disabled={choice.disabled}
                                        key={nanoid()} value={choice.value}
                                        control={<Radio/>}
                                        label={choice.label}/> : ""
                            )}
                        </RadioGroup>
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={debouncedHandleConfirm} color="primary">
                    {i18n.confirm}
                </Button>
            </DialogActions>
        </Dialog>
    </Grid> : <div/>
}

export default ChoiceDialog;
