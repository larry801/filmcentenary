import React from "react";
import {FixedSizeList} from "react-window";
import Grid from "@material-ui/core/Grid";
import AutoSizer from "react-virtualized-auto-sizer";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import shortid from 'shortid'
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import {getLogText, getMoveText} from "../game/board-util";

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            width: '100%',
            minHeight: 160,
            maxHeight: 800,
            minWidth: 400,
            backgroundColor: theme.palette.background.paper,
        },
    }),
);

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid?: string) => string,
}

export const LogView = ({log, getPlayerName}: ILogViewProps) => {

    useI18n(i18n);
    const classes = useStyles();
    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const moveText = log.map((l: LogEntry) => getMoveText(l)).join("\r\n");
    const onCopyMove = () => {
        copy(moveText, {
            message: i18n.lobby.copyPrompt,
        })
    }
    const logText = log.map((l: LogEntry) => getLogText(l ,getPlayerName)).join("\r\n");
    const onCopyLog = () => {
        copy(logText, {
            message: i18n.lobby.copyPrompt,
        })
    }

    return <Grid item container aria-live="polite" xs={12}>
        <Button fullWidth={true} onClick={toggleGameLog}>
            {i18n.pub.gameLog}
        </Button>
        <IconButton
            color="primary"
            aria-label={i18n.lobby.copyPrompt}
            edge="start"
            onClick={onCopyLog}>
            <ContentCopyIcon/>
        </IconButton>
        <IconButton
            color="secondary"
            aria-label={i18n.lobby.copyPrompt}
            edge="start"
            onClick={onCopyMove}>
            <ContentCopyIcon/>
        </IconButton>
        {open && <>
            <Grid item xs={12} className={classes.root}>
                <AutoSizer
                    defaultHeight={1000}
                    defaultWidth={400}>
                    {({height, width}) => <FixedSizeList
                        className="List"
                        height={height}
                        itemCount={log.length}
                        itemSize={50}
                        width={width}>
                        {({index, style}) => {
                            const i = log.length - index - 1;
                            const text = getLogText(log[i], getPlayerName)
                            return text === "" ? <></> : <ListItem
                                button
                                // @ts-ignore
                                style={style}
                                key={shortid.generate()}>
                                <ListItemText primary={text}/>
                            </ListItem>
                        }}
                    </FixedSizeList>}
                </AutoSizer>
            </Grid>
        </>}
    </Grid>
}

export default LogView;
