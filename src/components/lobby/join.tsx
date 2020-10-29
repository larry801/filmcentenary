import React from "react";
import { Player, nameOf } from "../../Game";


interface ShareLinkProps {
    matchID: string;
    player: Player;
}

const ShareLink = ({ matchID, player }: ShareLinkProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const url = `${window.location.origin}/join/${matchID}/${nameOf(player)}`;

    const copyToClipboard = (e: any) => {
        if (inputRef.current && document.queryCommandSupported("copy")) {
            inputRef.current.select();
            document.execCommand("copy");
            e.target.focus();
        }
    };

    return (
        <div className="row flex-center">
            <div className="col no-padding">
                <div className="form-group">
                    <label>Share this link with your opponent (click to copy):</label>
                    <input
                        className="input-block"
                        type="text"
                        readOnly
                        value={url}
                        ref={inputRef}
                        onClick={copyToClipboard}
                    />
                </div>
            </div>
        </div>
    );
};

export default ShareLink;
