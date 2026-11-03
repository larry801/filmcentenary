import React from "react";
import {Player} from "../../Game";
import Typography from "@mui/material/Typography";
import i18n from "../../constant/i18n";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@mui/icons-material/FileCopy';
import IconButton from "@mui/material/IconButton";

interface ShareLinkProps {
    matchID: string;
    player: Player;
    numPlayer: number;
    gameName: string;
}

export const ShareLink = ({matchID, player, numPlayer, gameName}: ShareLinkProps) => {
    i18n.use();
    const urlPrefix = `${window.location.origin}/join/${gameName}/${matchID}/`;
    const ids = Array.from({length: Math.max(2, numPlayer)}, (_, i) => String(i));
    const links = ids.map((id) => ({id, url: urlPrefix + id}));
    const spectateURL = urlPrefix + Player.SPECTATE;

    const onCopy = () => {
        const copyText = [
            i18n.chain.lobby.shareLink,
            ...links.filter((l) => l.id !== player).map((l) => l.url),
            i18n.chain.playerName.spectator,
            spectateURL,
        ].join("\r\n");
        copy(copyText, {
            message: i18n.chain.lobby.copyPrompt,
        });
    }
    return <>
        <IconButton
            color="primary"
            aria-label={i18n.chain.lobby.copyPrompt}
            edge="start"
            onClick={onCopy}>
            <ContentCopyIcon/>
            复制邀请链接
        </IconButton>
        <Typography>{i18n.chain.lobby.shareLink}</Typography>
        {links.filter((l) => l.id !== player).map((l) =>
            <a key={l.id} href={l.url} style={{marginRight: 8}}>{matchID}P{Number(l.id) + 1}</a>)}
        <a href={spectateURL}>{i18n.chain.playerName.spectator}</a>
    </>
}

export default ShareLink;
