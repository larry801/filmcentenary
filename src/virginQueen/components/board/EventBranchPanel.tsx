import React from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import i18n from "../../../constant/i18n";
import {
    EventBranchChoice,
    EventBranchOptionValue,
    branchParamValues,
    effectiveBranchIds,
} from "../../eventBranches";

const localeText = (zh: string, en: string): string => i18n.getLocaleName() === "en" ? en : zh;

export interface EventBranchPanelProps {
    choice: EventBranchChoice;
    /** Branch ids stored in the card drawer state. */
    selected: string[];
    /** Per-branch parameter values stored in the card drawer state. */
    params: Record<string, Record<string, string>>;
    onSelect: (ids: string[]) => void;
    onParam: (branchId: string, paramId: string, value: string) => void;
}

const ParamSelect = ({id, label, value, options, optional, onChange}: {
    id: string;
    label: string;
    value: string;
    options: EventBranchOptionValue[];
    optional?: boolean;
    onChange: (value: string) => void;
}) => <FormControl size="small" fullWidth sx={{mt: 0.5}}>
    <InputLabel id={`vq-branch-${id}`}>{label}</InputLabel>
    <Select labelId={`vq-branch-${id}`} label={label} value={value}
            onChange={(event) => onChange(event.target.value)}>
        {optional && <MenuItem value="">{localeText("自动选择", "Automatic")}</MenuItem>}
        {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select>
</FormControl>;

/** Values of the parameters declared before `targetId`, in declaration order. */
const valuesBefore = (branch: EventBranchChoice["branches"][number], targetId: string,
    stored: Record<string, string> | undefined): Record<string, string> => {
    const values: Record<string, string> = {};
    for (const spec of branch.params) {
        if (spec.id === targetId) break;
        const options = spec.options(values);
        const current = stored?.[spec.id];
        values[spec.id] = options.some((option) => option.value === current)
            ? current ?? ""
            : (spec.optional ? "" : options[0]?.value ?? "");
    }
    return values;
};

/**
 * Radio/checkbox branch picker rendered inside the card drawer. The values are
 * interpreted by `eventBranchTarget`; this component only keeps the controls
 * in sync with the stored selection.
 */
export const EventBranchPanel = ({choice, selected, params, onSelect, onParam}: EventBranchPanelProps) => {
    i18n.use();
    const ids = effectiveBranchIds(choice, selected);
    const active = choice.branches.filter((entry) => ids.includes(entry.id));
    const two = choice.mode === "two";
    return <Box sx={{mt: 1}} role="group" aria-label={localeText("事件效果分支", "Event effect branches")}>
        <Typography variant="caption" color="text.secondary">
            {two
                ? localeText(`选择 ${Math.min(choice.maxSelections, choice.branches.length)} 项效果`,
                    `Choose ${Math.min(choice.maxSelections, choice.branches.length)} effects`)
                : localeText("选择效果分支", "Choose an effect branch")}
        </Typography>
        <ToggleButtonGroup
            size="small"
            color="primary"
            value={two ? ids : ids[0]}
            exclusive={!two}
            onChange={(_, value: string | string[] | null) => {
                if (value === null) return;
                const next = Array.isArray(value) ? value : [value];
                onSelect(two ? next.slice(0, choice.maxSelections) : next.slice(0, 1));
            }}
            sx={{display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5}}
        >
            {choice.branches.map((entry) =>
                <ToggleButton key={entry.id} value={entry.id}
                    disabled={two && ids.length >= choice.maxSelections && !ids.includes(entry.id)}
                    sx={{textTransform: "none", py: 0.25, px: 1}}>
                    {entry.label}
                </ToggleButton>)}
        </ToggleButtonGroup>
        <Stack spacing={0.5} sx={{mt: 0.5}}>
            {active.map((entry) => {
                const values = branchParamValues(entry, params[entry.id]);
                return <Box key={entry.id}>
                    {entry.hint !== undefined && <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        {entry.hint}
                    </Typography>}
                    {entry.params.map((spec) => {
                        const options = spec.options(valuesBefore(entry, spec.id, params[entry.id]));
                        return <ParamSelect key={spec.id}
                            id={`${entry.id}-${spec.id}`}
                            label={spec.label}
                            value={values[spec.id] ?? ""}
                            options={options}
                            optional={spec.optional}
                            onChange={(next) => onParam(entry.id, spec.id, next)}/>;
                    })}
                </Box>;
            })}
        </Stack>
    </Box>;
};
