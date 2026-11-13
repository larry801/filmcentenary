import React from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Tooltip from "@mui/material/Tooltip";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {seaZoneName} from "../../../mapData";

import {ACTION_BUTTON_GROUPS, modeLabel, placeLabel, vqLocaleNow} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const ActionModePicker = () => {
    const {navalOrders, setNavalOrders, submitNavalOrders, canAct, cp} = useVQBoard();
    const {G, myTurn, setActionNotice, isDesktop, setMobileView, mode, setMode, from, setFrom, transportZones, setTransportZones, rebelCp, setRebelCp, me, modeDisabledReason, transportCandidates, stackPicker} = useVQBoard();
    if (me === undefined) return null;
    // Off-turn, a grid of disabled buttons only adds noise; the panel's waiting
    // notice already says whose move it is, so keep just the inspect hint.
    if (!myTurn) return <Typography variant="caption" color="text.secondary">{i18n.chain.vq.actionUi.clickCityDetail}</Typography>;
    const pick = (next: typeof mode): void => {setMode(next); setFrom(null); setTransportZones([]); setActionNotice(undefined);};
    return <>
        <div className="vq-action-picker" role="group" aria-label={i18n.chain.vq.shell.currentAction}>
            <Button size="small" variant={mode === "inspect" ? "contained" : "outlined"}
                    onClick={() => pick("inspect")}>
                {modeLabel("inspect")}
            </Button>
            {Object.entries(ACTION_BUTTON_GROUPS).map(([group, candidates]) => {
                const visible = candidates.filter((candidate) =>
                    (candidate !== "recruitMerc" || me !== "ottoman") &&
                    (candidate !== "recruitCav" || me === "ottoman") &&
                    (candidate !== "rebellion" || me === "protestant") &&
                    (G.scenario !== "tutorial" || !["buildFortress", "buildRacebuilt", "rebellion"].includes(candidate)));
                if (visible.length === 0) return null;
                return <div key={group} className="vq-action-group">
                    <Typography variant="caption" className="vq-action-group-title">
                        {(i18n.chain.vq.action as unknown as Record<string, string>)[group] ?? group}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {visible.map((candidate) => {
                            const reason = modeDisabledReason(candidate);
                            const button = <Button size="small"
                                variant={mode === candidate ? "contained" : "outlined"}
                                disabled={reason !== undefined}
                                onClick={() => pick(candidate)}>
                                {modeLabel(candidate)}
                            </Button>;
                            return reason === undefined ? <React.Fragment key={candidate}>{button}</React.Fragment>
                                : <Tooltip key={candidate} title={reason}><span className="vq-tip">{button}</span></Tooltip>;
                        })}
                    </Stack>
                </div>;
            })}
        </div>
        {mode === "moveNaval" && <Stack spacing={1} className="vq-naval-orders">
            <Typography variant="caption">{i18n.chain.vq.actionUi.navalOrdersHint}</Typography>
            {navalOrders.map((order) => <Chip key={order.from}
                label={`${placeLabel(order.from)} → ${placeLabel(order.to)}`}
                onDelete={() => setNavalOrders(navalOrders.filter((entry) => entry.from !== order.from))}/>)}
            <Button variant="contained" disabled={!canAct || cp < 1 || navalOrders.length === 0}
                onClick={submitNavalOrders}>{i18n.chain.vq.actionUi.executeNavalOrders}</Button>
        </Stack>}
        {(mode === "moveLand" || mode === "navalTransport") && from && <Stack spacing={0.5}>
            <Typography variant="caption">{i18n.chain.vq.board.moveHint}</Typography>
            {mode === "navalTransport" && <>
                <Typography variant="caption">{i18n.chain.vq.board.transportHint}</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", alignItems: "center"}}>
                    {transportZones.map((zone, index) => <Chip key={zone} size="small"
                        label={`${index + 1}. ${seaZoneName(zone, vqLocaleNow())}`}
                        onDelete={() => setTransportZones(transportZones.filter((candidate) => candidate !== zone))}/>)}
                    {transportZones.length === 0 &&
                        <Typography variant="caption" color="text.secondary">{i18n.chain.vq.board.notSelected}</Typography>}
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {transportCandidates.map((zone) => <Button key={zone.id} size="small" variant="outlined"
                        onClick={() => setTransportZones([...transportZones, zone.id])}>{seaZoneName(zone.id, vqLocaleNow())}</Button>)}
                    {transportZones.length > 0 && <Button size="small"
                        onClick={() => setTransportZones([])}>{i18n.chain.vq.actionUi.clear}</Button>}
                </Stack>
                <Typography variant="caption">{i18n.chain.vq.board.route}: {transportZones.map((zone) => seaZoneName(zone, vqLocaleNow())).join(" → ") || i18n.chain.vq.board.notSelected}</Typography>
            </>}
            {stackPicker(false)}
        </Stack>}
        {mode === "rebellion" && <FormControl size="small" fullWidth>
            <InputLabel id="vq-rebel">{i18n.chain.vq.board.rebelCp}</InputLabel>
            <Select labelId="vq-rebel" label={i18n.chain.vq.board.rebelCp} value={rebelCp}
                    onChange={(e) => setRebelCp(Number(e.target.value))}>
                {[2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
            </Select>
        </FormControl>}
        <Typography variant="caption" color="text.secondary">
            {mode === "inspect" ? i18n.chain.vq.actionUi.clickCityDetail
                : (i18n.chain.vq.step.hint as Record<string, string>)[mode] ?? i18n.chain.vq.actionUi.clickTargetCity}
            {from !== null ? ` ${i18n.chain.vq.actionUi.originSelected}${placeLabel(from)}` : ""}
        </Typography>
        <Stack direction="row" spacing={1}>
            {!isDesktop && <Button size="small" variant="contained" onClick={() => setMobileView("map")}>{i18n.chain.vq.shell.goToMap}</Button>}
            {from !== null && <Button size="small" onClick={() => setFrom(null)}>{i18n.chain.vq.actionUi.cancelOrigin}</Button>}
        </Stack>
    </>;
};
