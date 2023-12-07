import React from "react";
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Button from '@material-ui/core/Button';
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import FormControl from "@material-ui/core/FormControl/FormControl";
import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import DialogActions from "@material-ui/core/DialogActions";
import Grid from "@material-ui/core/Grid";
import {usePrevious} from "../../components/board";
import {useDebounce} from "../../components/modals";
import Checkbox from "@material-ui/core/Checkbox";


export interface Choice {
    hidden: boolean,
    disabled: boolean,
    value: string,
    label: string,
}

export interface IChoiceProps {
    callback: (choice: string[]) => void,
    choices: Choice[],
    disabled?: boolean,
    show: boolean,
    title: string,
    toggleText: string | JSX.Element,
    initial: boolean,
    popAfterShow?: boolean,
    buttonColor?: boolean,
}

export const CheckBoxDialog = ({
                                 buttonColor,
                                 initial,
                                 callback,
                                 show,
                                 choices,
                                 title,
                                 disabled,
                                 toggleText,
                                 popAfterShow
                             }: IChoiceProps) => {

    const [open, setOpen] = React.useState(initial);
    const [checked, setChecked] = React.useState(choices.map(() => false));
    const prevShow = usePrevious(show);
    const filteredChoice = choices.filter((_,idx)=>checked[idx]).map(c=>c.value);

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
        callback(filteredChoice);
    };

    const debouncedHandleConfirm = useDebounce(handleConfirm, 400);

    const handleChange = (e: number) => {
        const newChecked = [...checked];
        newChecked[e] = !newChecked[e];
        setChecked(newChecked);
    };

    return show ? <Grid item xs={12}>
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
                        {choices.map((c, idx) => <FormControlLabel key={`checkbox-c-${idx}`}
                            control={<Checkbox checked={checked[idx]} onChange={() => handleChange(idx)} key={`checkbox-${idx}`}/>}
                            label={c.label}/>
                        )}
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={debouncedHandleConfirm} color="primary">
                    确认
                </Button>
            </DialogActions>
        </Dialog>
    </Grid> : <div/>
}

export default CheckBoxDialog;
