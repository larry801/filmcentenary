import React from "react";

export const  LobbyLoginForm =(playerName:string,onEnter:(name:string)=>void)=>{
    const [pn,setPn] = React.useState(playerName);
    const [err,setErr] = React.useState("");


    const onClickEnter = () => {
        if (playerName === '') return;
        onEnter(playerName);
    };

    const onKeyPress = (event:React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            onClickEnter();
        }
    };

    const onChangePlayerName = (event:React.ChangeEvent<HTMLInputElement>) => {
        const name = event.target.value.trim();
        setPn(name);
        setErr(name.length > 0 ? '' : 'empty player name');
    };
    return <div>
            <p className="phase-title">Choose a player name:</p>
            <input
                type="text"
                value={playerName}
                onChange={onChangePlayerName}
                onKeyPress={onKeyPress}
            />
            <span className="buttons">
          <button className="buttons" onClick={onClickEnter}>
            Enter
          </button>
        </span>
            <br />
            <span className="error-msg">
          {err}
                <br />
        </span>
        </div>

}
export default LobbyLoginForm;
