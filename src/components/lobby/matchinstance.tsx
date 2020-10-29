import React from "react";
import Button from "@material-ui/core/Button";

interface IPlayer {
    name: string,
    id: string,
}

interface IMatchInstance {
    gameName: string,
    matchID: string,
    players: IPlayer[],
}

interface matchOpts {
    playerID?: string,
    matchID: string,
    numPlayers: number,
}

export interface ILobbyMatchInstanceProps {
    match: IMatchInstance,
    playerName: string,
    onClickJoin: (game: string, matchID: string, seatID: string) => void,
    onClickLeave: (game: string, matchID: string) => void,
    onClickPlay: (game: string, matchOpt: matchOpts) => void,
    onClickSpectate: () => {},
}

export const LobbyMatchInstance = ({match, playerName, onClickJoin, onClickLeave, onClickPlay, onClickSpectate}: ILobbyMatchInstanceProps) => {

    const [credentials, setCredentials] = React.useState("");

    const _createSeat = (player: any) => {
        return player.name || '[free]';
    };
    const hasPlayer = !match.players.find(player => !player.name);
    const status = hasPlayer ? "RUNNING" : "OPEN"



    const _createButtonJoin = (inst: IMatchInstance, seatId: string) => {
        const join = () => onClickJoin(inst.gameName, inst.matchID, '' + seatId)
        return<Button
            key={'button-join-' + inst.matchID}
            onClick={join}
        >
            Join
        </Button>
    }

    const _createButtonLeave = (inst: IMatchInstance) => {
        const leave = () => onClickLeave(inst.gameName, inst.matchID)
        return <Button
            key={'button-leave-' + inst.matchID}
            onClick={leave}
        >
            Leave
        </Button>
    }

    const _createButtonPlay = (inst: IMatchInstance, seatId: string) => {
        const play = () =>
            onClickPlay(inst.gameName, {
                matchID: inst.matchID,
                playerID: '' + seatId,
                numPlayers: inst.players.length,
            })
        return(
        <Button
            key={'button-play-' + inst.matchID}
            onClick={play}
        >
            Play
        </Button>
    );}

    const _createButtonSpectate = (inst: IMatchInstance) => {
        const spectate = () =>
            onClickPlay(inst.gameName, {
                matchID: inst.matchID,
                numPlayers: inst.players.length,
            })

        return<Button
            key={'button-spectate-' + inst.matchID}
            onClick={spectate}
        >
            Spectate
        </Button>
};

    const _createInstanceButtons = (inst: IMatchInstance) => {
        const playerSeat = inst.players.find(
            player => {
                return player.name === playerName;
            }
        );
        const freeSeat = inst.players.find((player: { name: any; }) => !player.name);
        if (playerSeat && freeSeat) {
            // already seated: waiting for match to start
            return _createButtonLeave(inst);
        }
        if (freeSeat) {
            // at least 1 seat is available
            return _createButtonJoin(inst, freeSeat.id);
        }
        // match is full
        if (playerSeat) {
            return (
                <div>
                    {[
                        _createButtonPlay(inst, playerSeat.id),
                        _createButtonLeave(inst),
                    ]}
                </div>
            );
        }
        // allow spectating
        return _createButtonSpectate(inst);
    };

    return <tr key={'line-' + match.matchID}>
        <td key={'cell-name-' + match.matchID}>{match.gameName}</td>
        <td key={'cell-status-' + match.matchID}>{status}</td>
        <td key={'cell-seats-' + match.matchID}>
            {match.players.map(_createSeat).join(', ')}
        </td>
        <td key={'cell-buttons-' + match.matchID}>
            {_createInstanceButtons(match)}
        </td>
    </tr>
}

export default LobbyMatchInstance;
