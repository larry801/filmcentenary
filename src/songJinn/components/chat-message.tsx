import React, {useState} from "react";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {ChatMessage as Msg, PlayerID} from "boardgame.io";

interface IChatMessageProps {
    sendChatMessage: (c: string) => void;
    chatMessages: Msg[];
    getPlayerName: (p: PlayerID) => string;
    moves: Record<string, (...args: any[]) => void>;
}


export const ChatMessage = ({sendChatMessage, chatMessages, getPlayerName, moves}: IChatMessageProps) => {
    const [message, setMessage] = useState('');

    const messages = chatMessages.map((m) => `${getPlayerName(m.sender)}:${JSON.stringify(m.payload)}`)
        .reverse().join('\n');

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(event.target.value);
    };
    return <Grid container size={12}>
        <TextField
            disabled
            value={messages}
            fullWidth
            maxRows={8}
            multiline
            variant="outlined"
        />
        <Grid size={8}>
            <TextField
                value={message}
                variant="filled"
                fullWidth
                onChange={handleChange}
                onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                        sendChatMessage(message);
                        ev.preventDefault();
                        setMessage('');
                    }
                }}
            />
        </Grid>
        <Grid size={2}>
            <Button
                variant={"outlined"}
                onClick={() => {
                    sendChatMessage(message);
                    setMessage('');
                }}
            >发送</Button>
        </Grid>

        <Grid size={2}>
            <Button
                variant={"contained"}
                onClick={() => {
                    moves.modifyGameState(JSON.parse(message));
                    setMessage('');
                }}
            >debug</Button>
        </Grid>
    </Grid>
}