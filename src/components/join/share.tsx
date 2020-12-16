import React from "react";
import {Player} from "../../Game";
import Typography from "@material-ui/core/Typography";
import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';

interface ShareLinkProps {
    matchID: string;
    player: Player;
    numPlayer: number,
}

export const ShareLink = ({matchID, player, numPlayer}: ShareLinkProps) => {
    useI18n(i18n);
    const urlPrefix = `${window.location.origin}/join/${matchID}/`;

    const p0URL = Player.P0 !== player ? urlPrefix + Player.P0 : "";
    const p1URL = Player.P1 !== player ? urlPrefix + Player.P1 : "";
    const p2URL = Player.P2 !== player && numPlayer > 2 ? urlPrefix + Player.P2 : "";
    const p3URL = Player.P3 !== player && numPlayer > 3 ? urlPrefix + Player.P3 : "";
    const spectateURL = urlPrefix + Player.spectate;

    const onCopy = () => {
        const copyText = [
            i18n.lobby.shareLink,
            p0URL, p1URL, p2URL, p3URL,
            i18n.playerName.spectator,
            spectateURL
        ].join("\r\n");
        copy(copyText, {
            message: i18n.lobby.copyPrompt,
        });
    }
    return <>
        <IconButton
            color="primary"
            aria-label={i18n.lobby.copyPrompt}
            edge="start"
            onClick={onCopy}>
            <ContentCopyIcon/>
        </IconButton>
        <Typography>{i18n.lobby.shareLink}</Typography>
        {Player.P0 !== player && <Typography>{p0URL}</Typography>}
        {Player.P1 !== player && <Typography>{p1URL}</Typography>}
        {Player.P2 !== player && numPlayer > 2 && <Typography>{p2URL}</Typography>}
        {Player.P3 !== player && numPlayer > 3 && <Typography>{p3URL}</Typography>}
        <Typography>{i18n.playerName.spectator}</Typography>
        <Typography>{urlPrefix + Player.spectate}</Typography>
    </>
}

export default ShareLink;
