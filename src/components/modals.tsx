import React, {useState, useRef, useEffect} from "react";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Button from '@mui/material/Button';
import i18n from "../constant/i18n";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import FormControl from "@mui/material/FormControl";
import FormGroup from "@mui/material/FormGroup";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
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
    disabled?: boolean,
    show: boolean,
    title: string,
    toggleText: string | React.JSX.Element,
    initial: boolean,
    popAfterShow?: boolean,
    buttonColor?: boolean,
}

export const useDebounce = (callback: () => any, delay: number) => {
    const latestCallback = useRef(() => {
    });
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
                                 buttonColor,
                                 initial,
                                 callback,
                                 show,
                                 choices,
                                 title,
                                 disabled,
                                 toggleText,
                                 defaultChoice,
                                 popAfterShow
                             }: IChoiceProps) => {

    i18n.use();
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
        callback(choice);
        handleClose();
    };

    const debouncedHandleConfirm = useDebounce(handleConfirm, 400);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChoice(e.target.value);
    };

    return show ? <Grid size={12}>
        <Button
            aria-label={title}
            color={buttonColor ? "secondary" : "primary"}
            fullWidth
            disabled={disabled}
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
                            name="choices" value={choice}
                            onChange={handleChange}>
                            {choices.map((choice, idx) =>
                                !choice.hidden ?
                                    <FormControlLabel
                                        disabled={choice.disabled}
                                        key={`${choice.value}-${idx}`} value={choice.value}
                                        control={<Radio/>}
                                        label={choice.label}/> : <React.Fragment key={`hidden-${idx}`}/>
                            )}
                        </RadioGroup>
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleConfirm} color="primary">
                    {i18n.chain.confirm}
                </Button>
            </DialogActions>
        </Dialog>
    </Grid> : <div/>
}

export default React.memo(ChoiceDialog);
